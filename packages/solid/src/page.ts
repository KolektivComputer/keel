import {
  getPage,
  getProcessing,
  subscribe,
  subscribeProcessing,
  type KeelSeed,
} from "@kolektiv/keel"
import { createMemo, createSignal, onCleanup, type Accessor } from "solid-js"

/** Seed plus router state, shaped like Svelte's `page()` proxy. */
export type KeelPage<T = unknown> = KeelSeed<T> & { processing: boolean }

/**
 * Subscribes to the core seed store for the lifetime of the calling root and
 * returns an accessor for the current seed plus a `processing` flag. The
 * accessor is a memo over stable seed and processing signals, so reading it
 * subscribes to visits/reloads, and repeated reads between changes return the
 * same cached snapshot object.
 */
export function usePage<T = unknown>(): Accessor<KeelPage<T>> {
  const [seed, setSeed] = createSignal(getPage<T>())
  const [processing, setProcessing] = createSignal(getProcessing() > 0)
  onCleanup(subscribe((next) => setSeed(() => next as KeelSeed<T>)))
  onCleanup(subscribeProcessing((count) => setProcessing(count > 0)))
  return createMemo<KeelPage<T>>(() => ({ ...seed(), processing: processing() }))
}
