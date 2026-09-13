import { router, type NavigationGuard } from "@kolektiv/keel"
import { onMounted, onScopeDispose } from "vue"

/**
 * Registers a navigation guard for the lifetime of the calling component.
 * The guard is registered on mount and unregistered when the component's
 * effect scope is disposed.
 */
export function useNavigationGuard(guard: NavigationGuard): void {
  let unregister: (() => void) | undefined
  onMounted(() => {
    unregister = router.beforeEach(guard)
  })
  onScopeDispose(() => {
    unregister?.()
    unregister = undefined
  })
}

/**
 * Native `beforeunload` prompt while `isDirty()` returns true. The listener
 * is attached on mount and removed when the component's effect scope is
 * disposed. The predicate is evaluated when the event fires, so the guard
 * does not need to be re-registered when dirtiness changes.
 */
export function useUnloadGuard(isDirty: () => boolean): void {
  if (typeof window === "undefined") return
  const listener = (event: BeforeUnloadEvent) => {
    if (!isDirty()) return
    event.preventDefault()
    event.returnValue = ""
  }
  onMounted(() => window.addEventListener("beforeunload", listener))
  onScopeDispose(() => window.removeEventListener("beforeunload", listener))
}
