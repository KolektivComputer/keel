import {
  router,
  type Method,
  type PrefetchMode,
  type PreserveScroll,
  type VisitOptions,
} from "@kolektiv/keel"
import type { ComplexAttributeConverter } from "lit"
import { html, LitElement, nothing } from "lit"
import { property } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"

const prefetchConverter: ComplexAttributeConverter<PrefetchMode> = {
  fromAttribute(value) {
    if (value === null || value === "" || value === "true") return value === null ? false : true
    if (value === "hover" || value === "mousedown" || value === "mount") return value
    return false
  },
  toAttribute(value) {
    if (value === true) return ""
    if (value === false) return null
    return value
  },
}

const preserveScrollConverter: ComplexAttributeConverter<PreserveScroll> = {
  fromAttribute(value) {
    if (value === null || value === "false") return false
    if (value === "" || value === "true") return true
    return "errors"
  },
  toAttribute(value) {
    if (value === true) return ""
    if (value === false) return null
    return "errors"
  },
}

function intercepted(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return true
}

/**
 * SPA navigation link element. GET renders an `<a href>` in its shadow root;
 * other methods render a `<button type="button">`. Clicking calls
 * `router.visit` unless the click is modified, non-left, or a GET into
 * `target="_blank"`.
 *
 * ```ts
 * html`<keel-link href="/about" prefetch="hover">About</keel-link>`
 * ```
 */
export class Link extends LitElement {
  @property({ attribute: "href" }) href = ""
  @property({ attribute: "method" }) method: Method = "get"
  @property({ attribute: "prefetch", converter: prefetchConverter }) prefetch: PrefetchMode = false
  @property({ attribute: "target" }) target?: string
  @property({ attribute: "replace", type: Boolean }) replace = false
  @property({ attribute: "preserve-state", type: Boolean }) preserveState = false
  @property({ attribute: "preserve-scroll", converter: preserveScrollConverter })
  preserveScroll: PreserveScroll = false
  @property({ attribute: "force", type: Boolean }) force = false
  @property({ attribute: false }) data?: VisitOptions["data"]
  @property({ attribute: false }) headers?: Record<string, string>
  @property({ attribute: false }) only?: string[]
  @property({ attribute: false }) except?: string[]
  @property({ attribute: false }) onBefore?: VisitOptions["onBefore"]
  @property({ attribute: false }) onSuccess?: VisitOptions["onSuccess"]
  @property({ attribute: false }) onError?: VisitOptions["onError"]
  /** Runs before interception; `preventDefault()` cancels the visit. */
  @property({ attribute: false }) onClick?: (event: MouseEvent) => void

  private prefetchedFor: string | undefined

  override connectedCallback(): void {
    super.connectedCallback()
    this.prefetchOnMount()
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has("prefetch") || changed.has("href")) this.prefetchOnMount()
  }

  private prefetchOnMount(): void {
    if (this.prefetch !== "mount" || !this.href || this.prefetchedFor === this.href) return
    this.prefetchedFor = this.href
    void router.prefetch(this.href)
  }

  private readonly visit = (event: MouseEvent): void => {
    this.onClick?.(event)
    if (!intercepted(event)) return
    if (this.method === "get" && (event.currentTarget as HTMLAnchorElement | null)?.target === "_blank") return
    event.preventDefault()
    void router.visit(this.href, this.visitOptions())
  }

  private readonly pointerEnter = (): void => {
    if (this.prefetch === true || this.prefetch === "hover") void router.prefetch(this.href)
  }

  private readonly pointerDown = (): void => {
    if (this.prefetch === "mousedown") void router.prefetch(this.href)
  }

  private visitOptions(): VisitOptions {
    return {
      method: this.method,
      data: this.data,
      replace: this.replace,
      preserveScroll: this.preserveScroll,
      preserveState: this.preserveState,
      only: this.only,
      except: this.except,
      headers: this.headers,
      force: this.force,
      onBefore: this.onBefore,
      onSuccess: this.onSuccess,
      onError: this.onError,
    }
  }

  override render() {
    if (this.method === "get") {
      return html`<a
        href=${this.href}
        target=${ifDefined(this.target)}
        @click=${this.visit}
        @pointerenter=${this.pointerEnter}
        @pointerdown=${this.pointerDown}
        ><slot></slot
      ></a>`
    }
    return html`<button type="button" @click=${this.visit}><slot></slot></button>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "keel-link": Link
  }
}
