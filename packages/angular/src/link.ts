import { Component, Directive, ElementRef, Input, inject } from "@angular/core"
import {
  router,
  type Method,
  type PrefetchMode,
  type PreserveScroll,
  type VisitOptions,
} from "@kolektiv/keel"
import { blankTarget, intercepted, shouldPrefetch } from "./anchor.js"

/** Options for the `[keelLink]` directive; a string is shorthand for `href`. */
export interface KeelLinkOptions extends VisitOptions {
  href?: string
  method?: Method
  prefetch?: PrefetchMode
}

/**
 * SPA navigation directive for an existing anchor, area, or button. GET hosts
 * render their own `<a href>`; other methods prevent the native behavior and
 * call `router.visit` with the given method. Clicks are skipped when already
 * handled, non-left, modified, or a GET into `target="_blank"`.
 *
 * ```html
 * <a [keelLink]="'/about'">About</a>
 * <a [keelLink]="{ href: '/notes', method: 'post', prefetch: true }">New</a>
 * ```
 */
@Directive({
  selector: "[keelLink]",
  standalone: true,
  host: {
    "(click)": "visit($event)",
    "(pointerenter)": "enter()",
    "(pointerdown)": "down()",
  },
})
export class KeelLinkDirective {
  /** Target plus visit options, or a bare href string. */
  @Input() keelLink: string | KeelLinkOptions = ""

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef)
  private prefetchedFor: string | undefined

  private get options(): KeelLinkOptions {
    return typeof this.keelLink === "string"
      ? this.keelLink
        ? { href: this.keelLink }
        : {}
      : this.keelLink
  }

  /** The visit href: options or the host's `href` attribute. */
  get href(): string {
    return this.options.href ?? this.element.nativeElement.getAttribute("href") ?? ""
  }

  ngOnInit(): void {
    this.prefetchOnMount()
  }

  ngOnChanges(): void {
    this.prefetchOnMount()
  }

  visit(event: MouseEvent): void {
    if (!intercepted(event)) return
    const method: Method = this.options.method ?? "get"
    if (method === "get" && blankTarget(event)) return
    event.preventDefault()
    void router.visit(this.href, this.options)
  }

  enter(): void {
    if (shouldPrefetch(this.options.prefetch, "hover")) void router.prefetch(this.href)
  }

  down(): void {
    if (shouldPrefetch(this.options.prefetch, "mousedown")) void router.prefetch(this.href)
  }

  private prefetchOnMount(): void {
    if (!shouldPrefetch(this.options.prefetch, "mount")) return
    const href = this.href
    if (!href || this.prefetchedFor === href) return
    this.prefetchedFor = href
    void router.prefetch(href)
  }
}

/**
 * SPA navigation link element. GET renders an `<a href>`; other methods
 * render a `<button type="button">`. Clicking calls `router.visit` unless the
 * click is modified, non-left, or a GET into `target="_blank"`.
 *
 * ```html
 * <keel-link href="/about" prefetch="hover">About</keel-link>
 * <keel-link href="/notes" method="post">New note</keel-link>
 * ```
 */
@Component({
  selector: "keel-link",
  standalone: true,
  template: `
    @if (method === "get") {
      <a
        [attr.href]="href"
        [attr.target]="target ?? null"
        (click)="visit($event)"
        (pointerenter)="enter()"
        (pointerdown)="down()"
      >
        <ng-content />
      </a>
    } @else {
      <button type="button" (click)="visit($event)">
        <ng-content />
      </button>
    }
  `,
})
export class KeelLink {
  @Input() href = ""
  @Input() method: Method = "get"
  @Input() prefetch: PrefetchMode = false
  @Input() target?: string
  @Input() data?: VisitOptions["data"]
  @Input() replace = false
  @Input() preserveScroll: PreserveScroll = false
  @Input() preserveState = false
  @Input() only?: string[]
  @Input() except?: string[]
  @Input() headers?: Record<string, string>
  @Input() force = false
  @Input() onBefore?: VisitOptions["onBefore"]
  @Input() onSuccess?: VisitOptions["onSuccess"]
  @Input() onError?: VisitOptions["onError"]

  private prefetchedFor: string | undefined

  ngOnInit(): void {
    this.prefetchOnMount()
  }

  ngOnChanges(): void {
    this.prefetchOnMount()
  }

  visit(event: MouseEvent): void {
    if (!intercepted(event)) return
    if (this.method === "get" && blankTarget(event)) return
    event.preventDefault()
    void router.visit(this.href, this.visitOptions())
  }

  enter(): void {
    if (shouldPrefetch(this.prefetch, "hover")) void router.prefetch(this.href)
  }

  down(): void {
    if (shouldPrefetch(this.prefetch, "mousedown")) void router.prefetch(this.href)
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

  private prefetchOnMount(): void {
    if (!shouldPrefetch(this.prefetch, "mount") || !this.href || this.prefetchedFor === this.href) return
    this.prefetchedFor = this.href
    void router.prefetch(this.href)
  }
}
