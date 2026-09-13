import { router } from "./router.ts"
import type { Method, VisitOptions } from "./types.ts"

/** A point-in-time view of a form. `data` is the live internal object. */
export interface FormSnapshot<T extends Record<string, unknown>> {
  data: T
  errors: Record<string, string[]>
  processing: boolean
  progress: number | null
  wasSuccessful: boolean
  isDirty: boolean
}

export type FormListener<T extends Record<string, unknown>> = (state: FormSnapshot<T>) => void

/**
 * Framework-neutral form state machine. Adapters mirror {@link FormStore.get}
 * into their own reactive primitives and delegate `set` / `reset` /
 * `clearErrors` / `submit` here, so every binding shares the same dirtiness,
 * processing, progress, and error semantics.
 *
 * `subscribe` immediately invokes the listener with the current snapshot and
 * returns an unsubscribe function. `submit` is a write: it visits `href`
 * through the core router with `data`, maps 422 seeds into `errors`, and sets
 * `wasSuccessful` for successful visits.
 */
export interface FormStore<T extends Record<string, unknown>> {
  get(): FormSnapshot<T>
  subscribe(listener: FormListener<T>): () => void
  set<K extends keyof T>(key: K, value: T[K]): void
  set(values: Partial<T>): void
  reset(...fields: (keyof T)[]): void
  clearErrors(): void
  setErrors(errors: Record<string, string[]>): void
  setData(data: T): void
  submit(method: Method, href: string, options?: VisitOptions): Promise<void>
}

export function createFormState<T extends Record<string, unknown>>(initial: T): FormStore<T> {
  const defaults = { ...initial }
  let data = { ...initial }
  let errors: Record<string, string[]> = {}
  let processing = false
  let progress: number | null = null
  let wasSuccessful = false
  let isDirty = false
  const listeners = new Set<FormListener<T>>()

  function snapshot(): FormSnapshot<T> {
    return { data, errors, processing, progress, wasSuccessful, isDirty }
  }

  function notify(): void {
    const state = snapshot()
    for (const listener of listeners) listener(state)
  }

  function markDirty(): void {
    isDirty = JSON.stringify(data) !== JSON.stringify(defaults)
  }

  const form: FormStore<T> = {
    get: snapshot,
    subscribe(listener) {
      listeners.add(listener)
      listener(snapshot())
      return () => {
        listeners.delete(listener)
      }
    },
    set(keyOrValues: keyof T | Partial<T>, value?: unknown) {
      if (typeof keyOrValues === "object" && keyOrValues !== null) {
        Object.assign(data, keyOrValues)
      } else {
        data[keyOrValues as keyof T] = value as T[keyof T]
      }
      markDirty()
      notify()
    },
    reset(...fields: (keyof T)[]) {
      if (fields.length === 0) {
        data = { ...defaults }
      } else {
        for (const field of fields) data[field] = defaults[field]
      }
      isDirty = false
      notify()
    },
    clearErrors() {
      errors = {}
      notify()
    },
    setErrors(next) {
      errors = next
      notify()
    },
    setData(value) {
      data = value
      markDirty()
      notify()
    },
    async submit(method, href, options = {}) {
      processing = true
      wasSuccessful = false
      notify()
      try {
        await router.visit(href, {
          ...options,
          method,
          data,
          onError(next) {
            errors = next
            notify()
            options.onError?.(next)
          },
          onSuccess(page) {
            errors = {}
            wasSuccessful = true
            notify()
            options.onSuccess?.(page)
          },
          onProgress(next) {
            progress = next.percentage
            notify()
            options.onProgress?.(next)
          },
        })
      } finally {
        processing = false
        notify()
      }
    },
  }
  return form
}
