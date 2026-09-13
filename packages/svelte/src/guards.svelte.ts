import { router, type NavigationGuard } from "@kolektiv/keel"

/**
 * Registers a navigation guard for the lifetime of the calling component or
 * layout. Must be called during component initialisation.
 */
export function useNavigationGuard(guard: NavigationGuard): void {
  $effect(() => router.beforeEach(guard))
}

/**
 * Native `beforeunload` prompt while `isDirty()` returns true. The listener is
 * attached during component initialisation and removed on destroy.
 */
export function useUnloadGuard(isDirty: () => boolean): void {
  $effect(() => {
    if (typeof window === "undefined") return
    const listener = (event: BeforeUnloadEvent) => {
      if (!isDirty()) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", listener)
    return () => window.removeEventListener("beforeunload", listener)
  })
}
