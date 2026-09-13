import { router, type NavigationGuard } from "@kolektiv/keel"
import { onCleanup, onMount } from "solid-js"

/**
 * Registers a navigation guard for the lifetime of the calling component.
 * Registration happens in `onMount` and unregistration in `onCleanup`, since
 * returning a function from `onMount` is not treated as cleanup in Solid.
 */
export function useNavigationGuard(guard: NavigationGuard): void {
  onMount(() => {
    const unregister = router.beforeEach(guard)
    onCleanup(unregister)
  })
}

/**
 * Native `beforeunload` prompt while `isDirty()` returns true. The listener is
 * attached on mount and removed on cleanup.
 */
export function useUnloadGuard(isDirty: () => boolean): void {
  onMount(() => {
    if (typeof window === "undefined") return
    const listener = (event: BeforeUnloadEvent) => {
      if (!isDirty()) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", listener)
    onCleanup(() => window.removeEventListener("beforeunload", listener))
  })
}
