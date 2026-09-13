import { router, type Method, type PrefetchMode, type VisitOptions } from "@kolektiv/keel"
import { useEffect, type MouseEvent as ReactMouseEvent } from "react"

export interface KeelAnchorParams extends VisitOptions {
  href?: string
  prefetch?: PrefetchMode
}

export interface KeelAnchorProps {
  href: string
  onClick: (event: ReactMouseEvent<HTMLAnchorElement>) => void
  onPointerEnter: () => void
  onPointerDown: () => void
}

function intercepted(event: ReactMouseEvent<HTMLElement>): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return true
}

/**
 * React replacement for Svelte's `keel` action: spreads visit interception
 * and prefetch behavior onto an existing anchor.
 *
 * ```tsx
 * <a {...useKeelAnchor({ href: "/about", prefetch: "hover" })}>About</a>
 * ```
 */
export function useKeelAnchor(params: KeelAnchorParams = {}): KeelAnchorProps {
  const href = params.href ?? ""

  useEffect(() => {
    if (params.prefetch === "mount" && href) void router.prefetch(href)
  }, [params.prefetch, href])

  return {
    href,
    onClick(event) {
      if (!intercepted(event)) return
      const method: Method = params.method ?? "get"
      if (method === "get" && event.currentTarget.target === "_blank") return
      event.preventDefault()
      void router.visit(href, params)
    },
    onPointerEnter() {
      if (params.prefetch === true || params.prefetch === "hover") void router.prefetch(href)
    },
    onPointerDown() {
      if (params.prefetch === "mousedown") void router.prefetch(href)
    },
  }
}
