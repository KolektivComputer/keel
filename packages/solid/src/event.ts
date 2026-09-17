import { onCleanup } from "solid-js"
import { realtime, type RealtimeMessage } from "@kolektiv/keel"

/**
 * Subscribes to a typed realtime event for the component's lifetime. The
 * handler is invoked as-is; read reactive values inside it.
 */
export function useKeelEvent<T = unknown>(
  event: string,
  handler: (data: T, message: RealtimeMessage<T>) => void,
): void {
  onCleanup(realtime.on<T>(event, (data, message) => handler(data, message)))
}
