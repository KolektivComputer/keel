import { router, type Method, type PrefetchMode, type VisitOptions } from "@kolektiv/keel"
import { nothing, type ElementPart } from "lit"
import { AsyncDirective } from "lit/async-directive.js"
import { directive } from "lit/directive.js"

export interface KeelAnchorParams extends VisitOptions {
  href?: string
  prefetch?: PrefetchMode
}

function intercepted(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return true
}

/**
 * Lit replacement for Svelte's `keel` action: an element-part directive that
 * decorates an existing anchor with visit interception and prefetch
 * behavior.
 *
 * ```ts
 * html`<a ${keelAnchor({ href: "/about", prefetch: "hover" })}>About</a>`
 * ```
 */
export class KeelAnchorDirective extends AsyncDirective {
  private element: HTMLElement | undefined
  private params: KeelAnchorParams = {}
  private listeners: Array<[string, EventListener]> = []
  private prefetchedFor: string | undefined

  override update(part: ElementPart, [params]: [KeelAnchorParams]): typeof nothing {
    this.bind(part.element as HTMLElement, params)
    return this.render(params)
  }

  render(_params: KeelAnchorParams): typeof nothing {
    return nothing
  }

  override disconnected(): void {
    this.unbind()
  }

  override reconnected(): void {
    if (this.element) this.bind(this.element, this.params)
  }

  private bind(element: HTMLElement, params: KeelAnchorParams): void {
    this.unbind()
    this.element = element
    this.params = params
    const href = params.href ?? element.getAttribute("href") ?? ""
    if (params.href && element instanceof HTMLAnchorElement) element.setAttribute("href", params.href)

    const visit = (event: MouseEvent): void => {
      if (!intercepted(event)) return
      const method: Method = params.method ?? "get"
      if (method === "get" && (event.currentTarget as HTMLAnchorElement | null)?.target === "_blank") return
      event.preventDefault()
      void router.visit(href, params)
    }
    const enter = (): void => {
      if (params.prefetch === true || params.prefetch === "hover") void router.prefetch(href)
    }
    const down = (): void => {
      if (params.prefetch === "mousedown") void router.prefetch(href)
    }

    element.addEventListener("click", visit as EventListener)
    element.addEventListener("pointerenter", enter)
    element.addEventListener("pointerdown", down)
    this.listeners = [
      ["click", visit as EventListener],
      ["pointerenter", enter],
      ["pointerdown", down],
    ]

    if (params.prefetch === "mount" && href && this.prefetchedFor !== href) {
      this.prefetchedFor = href
      void router.prefetch(href)
    }
  }

  private unbind(): void {
    if (this.element) {
      for (const [type, listener] of this.listeners) this.element.removeEventListener(type, listener)
    }
    this.listeners = []
  }
}

/** Element-part directive factory. */
export const keelAnchor = directive(KeelAnchorDirective)
