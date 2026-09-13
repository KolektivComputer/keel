import { router, type NavigationGuard } from "@kolektiv/keel"
import { useEffect } from "react"

/**
 * Registers a navigation guard for the lifetime of the calling component.
 * Re-registers when `guard` changes; unregisters on unmount.
 */
export function useNavigationGuard(guard: NavigationGuard): void {
  useEffect(() => router.beforeEach(guard), [guard])
}

/**
 * Native `beforeunload` prompt while `isDirty()` returns true. The listener
 * is attached on mount and removed on unmount.
 */
export function useUnloadGuard(isDirty: () => boolean): void {
  useEffect(() => {
    if (typeof window === "undefined") return
    const listener = (event: BeforeUnloadEvent) => {
      if (!isDirty()) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", listener)
    return () => window.removeEventListener("beforeunload", listener)
  }, [isDirty])
}
