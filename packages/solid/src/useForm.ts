import {
  createFormState,
  type FormSnapshot,
  type Method,
  type VisitOptions,
} from "@kolektiv/keel"
import { createSignal, onCleanup } from "solid-js"

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
 * Form state for one component instance. The returned object's getters read a
 * signal mirror of the core form snapshot, so reading `form.data` / `processing`
 * in JSX subscribes to changes, while the methods stay plain functions. Values
 * are correct after `await form.submit(...)` without re-reading the hook.
 */
export function useForm<T extends Record<string, unknown>>(initial: T): FormState<T> {
  const form = createFormState<T>(initial)
  const [snapshot, setSnapshot] = createSignal<FormSnapshot<T>>(form.get())
  onCleanup(form.subscribe((state) => setSnapshot(state)))

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
      return snapshot().data
    },
    set data(value: T) {
      form.setData(value)
    },
    get errors() {
      return snapshot().errors
    },
    set errors(value: Record<string, string[]>) {
      form.setErrors(value)
    },
    get processing() {
      return snapshot().processing
    },
    get progress() {
      return snapshot().progress
    },
    get wasSuccessful() {
      return snapshot().wasSuccessful
    },
    get isDirty() {
      return snapshot().isDirty
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
}
