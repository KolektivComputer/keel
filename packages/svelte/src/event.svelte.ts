import { realtime, type RealtimeMessage } from "@kolektiv/keel"

/**
 * Subscribes to a typed realtime event for the component's lifetime. Must be
 * called during component initialisation; `event` is tracked, the handler is
 * read through a closure so it may capture `$state`.
 *
 * ```svelte
 * <script lang="ts">
 *   import type { HarborEvents } from "$lib/page-types"
 *   useKeelEvent<HarborEvents["harbor.message"]>("harbor.message", (message) => {
 *     messages = [message, ...messages]
 *   })
 * </script>
 * ```
 */
export function useKeelEvent<T = unknown>(
  event: string,
  handler: (data: T, message: RealtimeMessage<T>) => void,
): void {
  $effect(() => {
    const release = realtime.on<T>(event, (data, message) => handler(data, message))
    return () => release()
  })
}
