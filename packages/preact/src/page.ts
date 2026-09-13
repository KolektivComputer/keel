import {
  getPage,
  getProcessing,
  subscribe,
  subscribeProcessing,
  type KeelSeed,
} from "@kolektiv/keel"
import { useMemo } from "preact/hooks"
import { useCoreStore } from "./store.js"

/** Seed plus router state, shaped like Svelte's `page()` proxy. */
export type KeelPage<T = unknown> = KeelSeed<T> & { processing: boolean }

/**
 * Subscribes to the core seed store and returns the current seed with a
 * `processing` flag. The seed comes straight from the store (never a clone)
 * and the memo caches the spread object, so repeated reads between store
 * changes return the same snapshot and only a visit or reload re-renders the
 * caller.
 */
export function usePage<T = unknown>(): KeelPage<T> {
  const seed = useCoreStore(subscribe, () => getPage<T>())
  const processing = useCoreStore(subscribeProcessing, getProcessing)
  return useMemo<KeelPage<T>>(() => ({ ...seed, processing: processing > 0 }), [seed, processing])
}
