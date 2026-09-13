import {
  applyHead,
  fromPageHead,
  getPage,
  type KeelSeed,
  type PageContext,
  type PageModule,
} from "@kolektiv/keel"
import { createEffect, createSignal, onCleanup, type Component, type JSX } from "solid-js"
import { render } from "solid-js/web"
import { KEEL_CONTEXT, type KeelProviderValue } from "./context.js"
import { usePage } from "./page.js"

/** Layout component: wraps `children`, outermost layout first. */
type KeelLayout = Component<{ children?: JSX.Element }>

function markMountError(target: Element, error: unknown): void {
  if (target.querySelector("[data-keel-mount-error]")) return
  const pre = target.ownerDocument.createElement("pre")
  pre.setAttribute("data-keel-mount-error", "")
  pre.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
  target.append(pre)
}

/** Applied once by the root, never by nested layouts or pages. */
function PageHead(): JSX.Element {
  const seed = usePage()
  createEffect(() => {
    const head = seed().head
    if (!head) return
    onCleanup(applyHead(fromPageHead(head)))
  })
  return null
}

function Nest(props: { layouts: KeelLayout[]; Page: Component; index: number }): JSX.Element {
  const Layout = props.layouts[props.index]
  if (!Layout) {
    const Page = props.Page
    return <Page />
  }
  return (
    <Layout>
      <Nest layouts={props.layouts} Page={props.Page} index={props.index + 1} />
    </Layout>
  )
}

/**
 * Mount factory for pack entries. Renders into the host with `render()` from
 * `solid-js/web` — never hydration — because the document shell is
 * Kotlin-authored HTML, not Solid markup. Layouts nest outermost-first; the
 * seed head is applied once at the root; `update(ctx)` writes the shared seed
 * and context signals, so descendants re-render in place with the new context
 * without remounting. Solid commits synchronously, so the DOM is up to date
 * when `mount` / `update` return. Mount errors are marked on the host with
 * `<pre data-keel-mount-error>` and rethrown.
 */
export function createPage<T = unknown>(
  Page: Component,
  layouts: KeelLayout[] = [],
): PageModule<T> {
  const [seed, setSeed] = createSignal<KeelSeed<T>>()
  const [context, setContext] = createSignal<PageContext<T>>()
  const provider: KeelProviderValue = { seed, context }
  let dispose: (() => void) | undefined

  function Root(): JSX.Element {
    return (
      <KEEL_CONTEXT.Provider value={provider}>
        <PageHead />
        <Nest layouts={layouts} Page={Page} index={0} />
      </KEEL_CONTEXT.Provider>
    )
  }

  return {
    mount(nextHost, nextContext) {
      dispose?.()
      dispose = undefined
      nextHost.replaceChildren()
      setSeed(() => getPage<T>())
      setContext(() => nextContext)
      try {
        dispose = render(() => <Root />, nextHost)
      } catch (error) {
        markMountError(nextHost, error)
        throw error
      }
    },
    unmount() {
      if (!dispose) return
      const current = dispose
      dispose = undefined
      current()
    },
    update(nextContext) {
      if (!dispose) return
      setSeed(() => getPage<T>())
      setContext(() => nextContext)
    },
  }
}
