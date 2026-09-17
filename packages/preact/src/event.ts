import { useEffect, useRef } from "preact/hooks"
import { realtime, type RealtimeMessage } from "@kolektiv/keel"

/**
 * Subscribes to a typed realtime event for the component's lifetime. The
 * latest handler is used, so inline closures do not resubscribe.
 */
export function useKeelEvent<T = unknown>(
  event: string,
  handler: (data: T, message: RealtimeMessage<T>) => void,
): void {
  const latest = useRef(handler)
  latest.current = handler
  useEffect(
    () => realtime.on<T>(event, (data, message) => latest.current(data, message)),
    [event],
  )
}
