import { router, type Method, type PrefetchMode, type VisitOptions } from "@kolektiv/keel"
import { createEffect } from "solid-js"

export interface KeelAnchorParams extends VisitOptions {
  href?: string
  prefetch?: PrefetchMode
}

export interface KeelAnchorProps {
  href: string
  onClick: (event: MouseEvent) => void
  onPointerEnter: () => void
  onPointerDown: () => void
}

function anchorOf(event: MouseEvent): HTMLAnchorElement | null {
  const current = event.currentTarget
  if (current instanceof HTMLAnchorElement) return current
  const target = event.target
  return target instanceof Element ? target.closest("a") : null
}

/**
 * Solid replacement for Svelte's `keel` action: spreads visit interception
 * and prefetch behavior onto an existing anchor.
 *
 * ```tsx
 * <a {...useKeelAnchor({ href: "/about", prefetch: "hover" })}>About</a>
 * ```
 */
export function useKeelAnchor(params: KeelAnchorParams = {}): KeelAnchorProps {
  const href = params.href ?? ""

  createEffect(() => {
    if (params.prefetch === "mount" && href) void router.prefetch(href)
  })

  return {
    href,
    onClick(event) {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const method: Method = params.method ?? "get"
      if (method === "get" && anchorOf(event)?.target === "_blank") return
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
