import {
  getPage,
  getProcessing,
  subscribe,
  subscribeProcessing,
  type KeelSeed,
} from "@kolektiv/keel"
import { useMemo, useSyncExternalStore } from "react"

/** Seed plus router state, shaped like Svelte's `page()` proxy. */
export type KeelPage<T = unknown> = KeelSeed<T> & { processing: boolean }

/**
 * Subscribes to the core seed store and returns the current seed with a
 * `processing` flag. `getSnapshot` returns the cached seed object, so React
 * only re-renders when a visit or reload applies a new seed.
 */
export function usePage<T = unknown>(): KeelPage<T> {
  const seed = useSyncExternalStore(
    subscribe,
    () => getPage<T>(),
    () => getPage<T>(),
  )
  const processing = useSyncExternalStore(subscribeProcessing, getProcessing, getProcessing)
  return useMemo(() => ({ ...seed, processing: processing > 0 }), [seed, processing])
}
