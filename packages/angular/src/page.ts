import { DestroyRef, inject, signal, type Signal } from "@angular/core"
import {
  getPage,
  getProcessing,
  subscribe,
  subscribeProcessing,
  type KeelSeed,
} from "@kolektiv/keel"

/** Seed plus router state, shaped like Svelte's `page()` proxy. */
export type KeelPage<T = unknown> = KeelSeed<T> & { processing: boolean }

/**
 * The current seed store snapshot as a signal, including the router
 * `processing` flag. One store subscription per injecting component or
 * service, disposed with the injection context; the snapshot object identity
 * only changes when a visit, reload, or processing change actually applies.
 *
 * ```ts
 * export default class Page {
 *   readonly page = injectKeelPage<HomePage>()
 * }
 * ```
 */
export function injectKeelPage<T = unknown>(): Signal<KeelPage<T>> {
  const destroyRef = inject(DestroyRef)
  const state = signal<KeelPage<T>>({ ...getPage<T>(), processing: getProcessing() > 0 })
  let seed: KeelSeed<T> = getPage<T>()
  let processing = getProcessing() > 0

  const refresh = (): void => {
    const nextSeed = getPage<T>()
    const nextProcessing = getProcessing() > 0
    if (nextSeed === seed && nextProcessing === processing) return
    seed = nextSeed
    processing = nextProcessing
    state.set({ ...nextSeed, processing: nextProcessing })
  }

  const unsubscribe = subscribe(refresh)
  const unsubscribeProcessing = subscribeProcessing(refresh)
  destroyRef.onDestroy(() => {
    unsubscribe()
    unsubscribeProcessing()
  })
  return state.asReadonly()
}
