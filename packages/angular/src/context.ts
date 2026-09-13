import { InjectionToken, inject, signal, type Signal, type WritableSignal } from "@angular/core"
import type { PageContext } from "@kolektiv/keel"

/**
 * Reactive holder for the `PageContext` of the mounted page. `createPage()`
 * provides one instance per mount through the mount's environment injector,
 * and `update(ctx)` replaces the value without re-creating the component
 * tree, so every descendant that reads {@link KeelContext.context} sees the
 * new route params, payload, and errors from the next change detection pass.
 */
export class KeelContext<T = unknown> {
  private readonly state: WritableSignal<PageContext<T>>

  /** The current context as a signal; read it in templates and computeds. */
  readonly context: Signal<PageContext<T>>

  constructor(initial: PageContext<T>) {
    this.state = signal(initial)
    this.context = this.state.asReadonly()
  }

  set(value: PageContext<T>): void {
    this.state.set(value)
  }
}

/**
 * Token for the active mount's {@link KeelContext}. `createPage()` provides
 * it in the per-mount environment injector; there is exactly one holder per
 * mounted page tree.
 */
export const KEEL_CONTEXT = new InjectionToken<KeelContext>("keel.context")

/**
 * The `PageContext` for the mounted page as a signal: route params, payload,
 * validation errors, theme, shared values, and `navigate`. This is the
 * Angular equivalent of the `ctx` prop Svelte pages and layouts receive.
 *
 * ```ts
 * export default class Page {
 *   readonly ctx = injectKeelContext<HomePage>()
 * }
 * ```
 */
export function injectKeelContext<T = unknown>(): Signal<PageContext<T>> {
  const holder = inject(KEEL_CONTEXT, { optional: true })
  if (!holder) {
    throw new Error("Keel: injectKeelContext() is only available inside a page mounted by createPage()")
  }
  return holder.context as Signal<PageContext<T>>
}
