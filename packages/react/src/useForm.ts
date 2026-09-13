import {
  createFormState,
  type FormSnapshot,
  type Method,
  type VisitOptions,
} from "@kolektiv/keel"
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react"

/** The Svelte-compatible form surface, backed by core `createFormState`. */
export interface FormState<T extends Record<string, unknown>> {
  data: T
  errors: Record<string, string[]>
  processing: boolean
  progress: number | null
  wasSuccessful: boolean
  isDirty: boolean
  set<K extends keyof T>(key: K, value: T[K]): void
  set(values: Partial<T>): void
  reset(...fields: (keyof T)[]): void
  clearErrors(): void
  submit(method: Method, href: string, options?: VisitOptions): Promise<void>
  get(href: string, options?: VisitOptions): Promise<void>
  post(href: string, options?: VisitOptions): Promise<void>
  put(href: string, options?: VisitOptions): Promise<void>
  patch(href: string, options?: VisitOptions): Promise<void>
  delete(href: string, options?: VisitOptions): Promise<void>
}

/**
 * Form state for one component instance. Getters read the latest core
 * snapshot, so values are correct after `await form.submit(...)` without
 * re-reading the hook. State updates re-render normally through
 * `useSyncExternalStore`.
 */
export function useForm<T extends Record<string, unknown>>(initial: T): FormState<T> {
  const [form] = useState(() => createFormState<T>(initial))
  const cache = useRef<FormSnapshot<T>>(form.get())

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      form.subscribe((state) => {
        const previous = cache.current
        if (
          state.data === previous.data &&
          state.errors === previous.errors &&
          state.processing === previous.processing &&
          state.progress === previous.progress &&
          state.wasSuccessful === previous.wasSuccessful &&
          state.isDirty === previous.isDirty
        ) {
          return
        }
        cache.current = state
        onStoreChange()
      }),
    [form],
  )
  const getSnapshot = useCallback(() => cache.current, [])
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return useMemo<FormState<T>>(() => {
    function set<K extends keyof T>(key: K, value: T[K]): void
    function set(values: Partial<T>): void
    function set(keyOrValues: keyof T | Partial<T>, value?: unknown): void {
      if (typeof keyOrValues === "object" && keyOrValues !== null) {
        form.set(keyOrValues as Partial<T>)
      } else {
        form.set(keyOrValues as keyof T, value as T[keyof T])
      }
    }

    return {
      get data() {
        return cache.current.data
      },
      set data(value: T) {
        form.setData(value)
      },
      get errors() {
        return cache.current.errors
      },
      set errors(value: Record<string, string[]>) {
        form.setErrors(value)
      },
      get processing() {
        return cache.current.processing
      },
      get progress() {
        return cache.current.progress
      },
      get wasSuccessful() {
        return cache.current.wasSuccessful
      },
      get isDirty() {
        return cache.current.isDirty
      },
      set,
      reset(...fields: (keyof T)[]) {
        form.reset(...fields)
      },
      clearErrors() {
        form.clearErrors()
      },
      submit(method, href, options = {}) {
        return form.submit(method, href, options)
      },
      get: (href, options) => form.submit("get", href, options),
      post: (href, options) => form.submit("post", href, options),
      put: (href, options) => form.submit("put", href, options),
      patch: (href, options) => form.submit("patch", href, options),
      delete: (href, options) => form.submit("delete", href, options),
    }
  }, [form])
}
