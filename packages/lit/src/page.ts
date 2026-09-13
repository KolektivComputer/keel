import {
  getPage,
  getProcessing,
  subscribe,
  subscribeProcessing,
  type KeelSeed,
} from "@kolektiv/keel"
import type { ReactiveController, ReactiveControllerHost } from "lit"

/** Seed plus router state, shaped like Svelte's `page()` proxy. */
export type KeelPage<T = unknown> = KeelSeed<T> & { processing: boolean }

/**
 * Reactive read of the core seed store for one host. Subscribes on connect and
 * caches the last `{ ...seed, processing }` snapshot, so repeated reads
 * between store changes return the same object and only a visit, reload, or
 * processing change requests an update — exactly one snapshot identity per
 * change, like the other adapters' `usePage`.
 */
export class KeelPageController<T = unknown> implements ReactiveController {
  #seed: KeelSeed<T> | undefined
  #processing = false
  #snapshot: KeelPage<T> | undefined
  #unsubscribe: (() => void) | undefined
  #unsubscribeProcessing: (() => void) | undefined

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this)
  }

  hostConnected(): void {
    this.#unsubscribe = subscribe(() => this.#refresh())
    this.#unsubscribeProcessing = subscribeProcessing(() => this.#refresh())
  }

  hostDisconnected(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = undefined
    this.#unsubscribeProcessing?.()
    this.#unsubscribeProcessing = undefined
  }

  /** The cached snapshot; reads the store directly before the first update. */
  get current(): KeelPage<T> {
    if (!this.#snapshot) this.#refresh()
    return this.#snapshot!
  }

  #refresh(): void {
    const seed = getPage<T>()
    const processing = getProcessing() > 0
    if (seed === this.#seed && processing === this.#processing) return
    this.#seed = seed
    this.#processing = processing
    this.#snapshot = { ...seed, processing }
    this.host.requestUpdate()
  }
}

/** Controller factory: `readonly page = usePage(this)` in a `KeelElement`. */
export function usePage<T = unknown>(host: ReactiveControllerHost): KeelPageController<T> {
  return new KeelPageController<T>(host)
}
