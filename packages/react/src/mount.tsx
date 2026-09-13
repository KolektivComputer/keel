import { applyHead, fromPageHead, type PageContext, type PageModule } from "@kolektiv/keel"
import {
  Component,
  createElement,
  useEffect,
  type ComponentType,
  type ReactNode,
} from "react"
import { flushSync } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import { KeelProvider } from "./context.js"
import { usePage } from "./page.js"

/** Layout component: wraps `children`, outermost layout first. */
type KeelLayout = ComponentType<{ children?: ReactNode }>

interface MountErrorBoundaryProps {
  host: Element
  children?: ReactNode
}

interface MountErrorBoundaryState {
  failed: boolean
}

/**
 * Marks render errors on the host with `<pre data-keel-mount-error>` and
 * rethrows, matching the mount contract in other adapters.
 */
class MountErrorBoundary extends Component<MountErrorBoundaryProps, MountErrorBoundaryState> {
  state: MountErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): MountErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    const pre = this.props.host.ownerDocument.createElement("pre")
    pre.setAttribute("data-keel-mount-error", "")
    pre.textContent = message
    this.props.host.append(pre)
    throw error
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

function Nest({ layouts, Page, index }: { layouts: KeelLayout[]; Page: ComponentType; index: number }): ReactNode {
  if (index >= layouts.length) return createElement(Page)
  const Layout = layouts[index]
  return createElement(Layout, null, createElement(Nest, { layouts, Page, index: index + 1 }))
}

/** Applied once by the root, never by nested layouts or pages. */
function PageHead() {
  const seed = usePage()
  useEffect(() => {
    if (!seed.head) return
    return applyHead(fromPageHead(seed.head))
  }, [seed.head])
  return null
}

function Root({ layouts, Page, ctx }: { layouts: KeelLayout[]; Page: ComponentType; ctx: PageContext }) {
  const seed = usePage()
  return createElement(
    KeelProvider,
    { seed, context: ctx },
    createElement(PageHead),
    createElement(Nest, { layouts, Page, index: 0 }),
  )
}

/**
 * Mount factory for pack entries. Renders into the host with
 * `createRoot().render()` — never `hydrateRoot` — because the document shell
 * is Kotlin-authored HTML, not React markup. Layouts nest outermost-first;
 * the seed head is applied once at the root; `update` re-renders with the
 * new context. Rendering is wrapped in `flushSync`, so the DOM is committed
 * when `mount` / `update` return, like the other adapters.
 */
export function createPage<T = unknown>(
  Page: ComponentType,
  layouts: KeelLayout[] = [],
): PageModule<T> {
  let root: Root | undefined
  let host: Element | undefined
  let ctx: PageContext<T> | undefined

  function render(): void {
    if (!root || !host || !ctx) return
    const current = root
    const currentHost = host
    const context = ctx
    flushSync(() => {
      current.render(
        createElement(
          MountErrorBoundary,
          { host: currentHost },
          createElement(Root, { layouts, Page, ctx: context }),
        ),
      )
    })
  }

  return {
    mount(nextHost, context) {
      if (root) {
        root.unmount()
        root = undefined
      }
      nextHost.replaceChildren()
      host = nextHost
      ctx = context
      try {
        root = createRoot(nextHost)
        render()
      } catch (error) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error)
        const pre = nextHost.ownerDocument.createElement("pre")
        pre.setAttribute("data-keel-mount-error", "")
        pre.textContent = message
        nextHost.append(pre)
        throw error
      }
    },
    unmount() {
      if (!root) return
      const current = root
      root = undefined
      ctx = undefined
      current.unmount()
    },
    update(context) {
      ctx = context
      render()
    },
  }
}
