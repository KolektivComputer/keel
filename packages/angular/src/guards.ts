import { DestroyRef, inject } from "@angular/core"
import { router, type NavigationGuard } from "@kolektiv/keel"

/**
 * Registers a navigation guard for the lifetime of the calling component,
 * service, or directive. Registration happens at injection time and the
 * dispose function runs from `DestroyRef.onDestroy`.
 */
export function injectNavigationGuard(guard: NavigationGuard): void {
  const destroyRef = inject(DestroyRef)
  destroyRef.onDestroy(router.beforeEach(guard))
}

/**
 * Native `beforeunload` prompt while `isDirty()` returns true. The listener
 * is attached at injection time and removed from `DestroyRef.onDestroy`.
 */
export function injectUnloadGuard(isDirty: () => boolean): void {
  const destroyRef = inject(DestroyRef)
  if (typeof window === "undefined") return
  const listener = (event: BeforeUnloadEvent): void => {
    if (!isDirty()) return
    event.preventDefault()
    event.returnValue = ""
  }
  window.addEventListener("beforeunload", listener)
  destroyRef.onDestroy(() => window.removeEventListener("beforeunload", listener))
}
