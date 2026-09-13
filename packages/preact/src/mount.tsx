import {
  applyHead,
  fromPageHead,
  type PageContext,
  type PageModule,
} from "@kolektiv/keel"
import { Component, createElement, render, type ComponentChildren, type ComponentType } from "preact"
import { useLayoutEffect } from "preact/hooks"
import { KeelProvider } from "./context.js"
import { usePage } from "./page.js"

/** Layout component: wraps `children`, outermost layout first. */
type KeelLayout = ComponentType<{ children?: ComponentChildren }>

function markMountError(target: Element, error: unknown): void {
  if (target.querySelector("[data-keel-mount-error]")) return
  const pre = target.ownerDocument.createElement("pre")
  pre.setAttribute("data-keel-mount-error", "")
  pre.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
  target.append(pre)
}

interface MountErrorBoundaryProps {
  host: Element
  children?: ComponentChildren
}

/**
 * Preact error boundaries call `componentDidCatch`; rethrowing there keeps the
 * error unhandled, so Preact walks on to outer boundaries and finally throws it
 * out of `render()` — the marker stays on the host for the mount contract.
 */
class MountErrorBoundary extends Component<MountErrorBoundaryProps> {
  componentDidCatch(error: unknown): void {
    markMountError(this.props.host, error)
    throw error
  }

  render(): ComponentChildren {
    return this.props.children
  }
}

function Nest({
  layouts,
  Page,
  index,
}: {
  layouts: KeelLayout[]
  Page: ComponentType
  index: number
}): ComponentChildren {
  if (index >= layouts.length) return createElement(Page, null)
  const Layout = layouts[index]
  return createElement(Layout, null, createElement(Nest, { layouts, Page, index: index + 1 }))
}

/** Applied once by the root, never by nested layouts or pages. */
function PageHead(): null {
  const seed = usePage()
  useLayoutEffect(() => {
    if (!seed.head) return
    return applyHead(fromPageHead(seed.head))
  }, [seed.head])
  return null
}

function Root({
  layouts,
  Page,
  ctx,
}: {
  layouts: KeelLayout[]
  Page: ComponentType
  ctx: PageContext
}) {
  const seed = usePage()
  return (
    <KeelProvider seed={seed} context={ctx}>
      <PageHead />
      <Nest layouts={layouts} Page={Page} index={0} />
    </KeelProvider>
  )
}

/**
 * Mount factory for pack entries. Renders into the host with `render()` from
 * `preact` — never hydration — because the document shell is Kotlin-authored
 * HTML, not Preact markup. Layouts nest outermost-first; the seed head is
 * applied once at the root; `update(ctx)` re-renders with the new context so
 * descendants see it without remounting; `unmount()` calls `render(null, …)`
 * to tear the tree down. Preact commits synchronously, so the DOM is up to
 * date when `mount` / `update` return. Mount errors are marked on the host
 * with `<pre data-keel-mount-error>` and rethrown.
 */
export function createPage<T = unknown>(
  Page: ComponentType,
  layouts: KeelLayout[] = [],
): PageModule<T> {
  let host: Element | undefined
  let ctx: PageContext<T> | undefined

  function renderTree(): void {
    if (!host || !ctx) return
    render(
      <MountErrorBoundary host={host}>
        <Root layouts={layouts} Page={Page} ctx={ctx} />
      </MountErrorBoundary>,
      host,
    )
  }

  return {
    mount(nextHost, nextContext) {
      if (host) render(null, host)
      nextHost.replaceChildren()
      host = nextHost
      ctx = nextContext
      try {
        renderTree()
      } catch (error) {
        markMountError(nextHost, error)
        throw error
      }
    },
    unmount() {
      if (!host) return
      const current = host
      host = undefined
      ctx = undefined
      render(null, current)
    },
    update(nextContext) {
      if (!host) return
      ctx = nextContext
      renderTree()
    },
  }
}
