import {
  getPage,
  getProcessing,
  subscribe,
  subscribeProcessing,
  type KeelSeed,
} from "@kolektiv/keel"
import { onScopeDispose, shallowRef, type ShallowRef } from "vue"

/** Seed plus router state, shaped like the Svelte `page()` store. */
export type KeelPage<T = unknown> = KeelSeed<T> & { processing: boolean }

/**
 * Subscribes to the core seed store and returns the current seed with a
 * `processing` flag as a shallow ref. The snapshot object is cached until a
 * visit or reload applies a new seed or the processing flag flips, so
 * shallow-ref identity is stable and consumers only re-render on real
 * changes. The subscriptions are released with the calling effect scope.
 */
export function usePage<T = unknown>(): ShallowRef<KeelPage<T>> {
  let cachedSeed: KeelSeed<T> | null = null
  let cachedProcessing: boolean | null = null
  let cached: KeelPage<T> | null = null

  function snapshot(): KeelPage<T> {
    const seed = getPage<T>()
    const processing = getProcessing() > 0
    if (!cached || seed !== cachedSeed || processing !== cachedProcessing) {
      cachedSeed = seed
      cachedProcessing = processing
      cached = { ...seed, processing }
    }
    return cached
  }

  const page = shallowRef<KeelPage<T>>(snapshot())
  const update = () => {
    page.value = snapshot()
  }
  const stops = [subscribe(update), subscribeProcessing(update)]
  onScopeDispose(() => {
    for (const stop of stops) stop()
  })
  return page
}
