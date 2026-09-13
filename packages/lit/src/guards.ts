import { router, type NavigationGuard } from "@kolektiv/keel"
import type { ReactiveController, ReactiveControllerHost } from "lit"

/**
 * Registers a navigation guard for the lifetime of the host element and
 * unregisters it on disconnect. The guard is read through the instance, so
 * `setGuard` can swap in a fresh closure.
 */
export class KeelNavigationGuardController implements ReactiveController {
  private dispose: (() => void) | undefined

  constructor(
    private readonly host: ReactiveControllerHost,
    private guard: NavigationGuard,
  ) {
    host.addController(this)
  }

  hostConnected(): void {
    this.dispose = router.beforeEach(this.guard)
  }

  hostDisconnected(): void {
    this.dispose?.()
    this.dispose = undefined
  }

  /** Replaces and re-registers the guard while the host stays connected. */
  setGuard(guard: NavigationGuard): void {
    if (this.dispose) {
      this.dispose()
      this.guard = guard
      this.dispose = router.beforeEach(guard)
    } else {
      this.guard = guard
    }
  }
}

/**
 * Native `beforeunload` prompt while `isDirty()` returns true. The listener
 * is attached on connect and removed on disconnect.
 */
export class KeelUnloadGuardController implements ReactiveController {
  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly isDirty: () => boolean,
  ) {
    host.addController(this)
  }

  private readonly listener = (event: BeforeUnloadEvent): void => {
    if (!this.isDirty()) return
    event.preventDefault()
    event.returnValue = ""
  }

  hostConnected(): void {
    if (typeof window === "undefined") return
    window.addEventListener("beforeunload", this.listener)
  }

  hostDisconnected(): void {
    if (typeof window === "undefined") return
    window.removeEventListener("beforeunload", this.listener)
  }
}

/** Controller factory for `useNavigationGuard` parity. */
export function useNavigationGuard(
  host: ReactiveControllerHost,
  guard: NavigationGuard,
): KeelNavigationGuardController {
  return new KeelNavigationGuardController(host, guard)
}

/** Controller factory for `useUnloadGuard` parity. */
export function useUnloadGuard(
  host: ReactiveControllerHost,
  isDirty: () => boolean,
): KeelUnloadGuardController {
  return new KeelUnloadGuardController(host, isDirty)
}
