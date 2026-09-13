import { Directive, ElementRef, Input, inject } from "@angular/core"
import { router, type Method, type PrefetchMode, type VisitOptions } from "@kolektiv/keel"

/** Options for {@link KeelAnchorDirective}. `href` defaults to the host attribute. */
export interface KeelAnchorParams extends VisitOptions {
  href?: string
  method?: Method
  prefetch?: PrefetchMode
}

/** Clicks Keel must not handle: already handled, non-left, or modified. */
export function intercepted(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return true
}

/** A GET visit into `target="_blank"` belongs to the browser. */
export function blankTarget(event: Event): boolean {
  return (event.currentTarget as HTMLAnchorElement | null)?.target === "_blank"
}

/**
 * Normalizes a prefetch option. Static template attributes arrive as strings
 * (`prefetch`, `prefetch=""`, and `prefetch="true"` all mean `true`), while
 * bindings pass the `PrefetchMode` through unchanged.
 */
function normalizePrefetch(mode: PrefetchMode | string | undefined): PrefetchMode {
  if (mode === true || mode === "" || mode === "true") return true
  if (mode === "hover" || mode === "mousedown" || mode === "mount") return mode
  return false
}

/** Whether a prefetch mode reacts to the given trigger. */
export function shouldPrefetch(
  mode: PrefetchMode | string | undefined,
  trigger: "mount" | "hover" | "mousedown",
): boolean {
  const normalized = normalizePrefetch(mode)
  if (trigger === "mount") return normalized === "mount"
  if (trigger === "hover") return normalized === true || normalized === "hover"
  return normalized === "mousedown"
}

/**
 * Decorates an existing anchor with Keel visit interception and prefetch
 * behavior — the Angular equivalent of Svelte's `use:keel` and the other
 * adapters' anchor helpers.
 *
 * ```html
 * <a href="/about" [keelAnchor]="{ prefetch: 'hover' }">About</a>
 * <a [keelAnchor]="'/about'" keelAnchor>About</a>
 * ```
 */
@Directive({
  selector: "a[keelAnchor], area[keelAnchor]",
  standalone: true,
  host: {
    "(click)": "visit($event)",
    "(pointerenter)": "enter()",
    "(pointerdown)": "down()",
  },
})
export class KeelAnchorDirective {
  /** Visit options; a string shorthand is treated as `{ href }`. */
  @Input() keelAnchor: KeelAnchorParams | string = ""

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef)
  private prefetchedFor: string | undefined

  private get params(): KeelAnchorParams {
    return typeof this.keelAnchor === "object" && this.keelAnchor !== null
      ? this.keelAnchor
      : this.keelAnchor
        ? { href: this.keelAnchor }
        : {}
  }

  private get href(): string {
    return this.params.href ?? this.element.nativeElement.getAttribute("href") ?? ""
  }

  ngOnInit(): void {
    this.prefetchOnMount()
  }

  ngOnChanges(): void {
    this.prefetchOnMount()
  }

  visit(event: MouseEvent): void {
    if (!intercepted(event)) return
    const method: Method = this.params.method ?? "get"
    if (method === "get" && blankTarget(event)) return
    event.preventDefault()
    void router.visit(this.href, this.params)
  }

  enter(): void {
    if (shouldPrefetch(this.params.prefetch, "hover")) void router.prefetch(this.href)
  }

  down(): void {
    if (shouldPrefetch(this.params.prefetch, "mousedown")) void router.prefetch(this.href)
  }

  private prefetchOnMount(): void {
    if (!shouldPrefetch(this.params.prefetch, "mount")) return
    const href = this.href
    if (!href || this.prefetchedFor === href) return
    this.prefetchedFor = href
    void router.prefetch(href)
  }
}
