import { DestroyRef, inject } from "@angular/core"
import { realtime, type RealtimeMessage } from "@kolektiv/keel"

/**
 * Subscribes to a typed realtime event until the injection context (usually
 * the component) is destroyed. The latest handler is used, so inline
 * closures do not resubscribe.
 */
export function injectKeelEvent<T = unknown>(
  event: string,
  handler: (data: T, message: RealtimeMessage<T>) => void,
): void {
  const latest = { current: handler }
  const release = realtime.on<T>(event, (data, message) => latest.current(data, message))
  inject(DestroyRef).onDestroy(release)
}
