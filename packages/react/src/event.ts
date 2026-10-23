import { useEffect, useRef } from "react"
import { realtime, type RealtimeMessage } from "@kolektiv/keel"

/**
 * Subscribes to a typed realtime event for the component's lifetime. The
 * latest handler is used, so inline closures do not resubscribe.
 *
 * ```tsx
 * useKeelEvent<HarborEvents["harbor.message"]>("harbor.message", (message) => {
 *   setFeed((feed) => [message, ...feed])
 * })
 * ```
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
