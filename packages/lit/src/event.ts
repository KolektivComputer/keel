import type { ReactiveController, ReactiveControllerHost } from "lit"
import { realtime, type RealtimeMessage } from "@kolektiv/keel"

/**
 * Lit controller that holds one typed realtime subscription for the host's
 * lifetime. Prefer {@link useKeelEvent}.
 */
export class KeelEventController<T = unknown> implements ReactiveController {
  private release: (() => void) | null = null

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly event: string,
    private readonly handler: (data: T, message: RealtimeMessage<T>) => void,
  ) {
    host.addController(this)
  }

  hostConnected(): void {
    this.release = realtime.on<T>(this.event, (data, message) => this.handler(data, message))
  }

  hostDisconnected(): void {
    this.release?.()
    this.release = null
  }
}

/** Subscribes the host element to a typed realtime event. */
export function useKeelEvent<T = unknown>(
  host: ReactiveControllerHost,
  event: string,
  handler: (data: T, message: RealtimeMessage<T>) => void,
): KeelEventController<T> {
  return new KeelEventController(host, event, handler)
}
