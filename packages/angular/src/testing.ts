import { keelApplicationSync } from "./runtime.js"

/**
 * Runs a synchronous change-detection pass on the shared Keel application.
 * Zoneless Angular otherwise schedules ticks asynchronously; tests and
 * imperative callers can use this to observe signal-driven updates
 * immediately. No-op before the application exists.
 */
export function flushKeel(): void {
  keelApplicationSync()?.tick()
}

/**
 * Destroys the shared application and forgets it, so the next `bootstrap` or
 * `createPage` mounts a fresh one. Test-only; the host page never calls it.
 */
export { resetKeelApplication as destroyKeelApplication } from "./runtime.js"
