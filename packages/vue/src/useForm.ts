import {
  createFormState,
  type Method,
  type VisitOptions,
} from "@kolektiv/keel"
import { onScopeDispose, shallowRef } from "vue"

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
 * Form state for one component instance, backed by the core state machine.
 * The returned getters read a shallow-ref snapshot that core updates
 * synchronously, so values are correct after `await form.submit(...)` and
 * templates that read them re-render on every transition. The subscription
 * is released with the calling effect scope.
 */
export function useForm<T extends Record<string, unknown>>(initial: T): FormState<T> {
  const form = createFormState<T>(initial)
  const state = shallowRef(form.get())
  const stop = form.subscribe((next) => {
    state.value = next
  })
  onScopeDispose(stop)

  return {
    get data() {
      return state.value.data
    },
    set data(value: T) {
      form.setData(value)
    },
    get errors() {
      return state.value.errors
    },
    set errors(value: Record<string, string[]>) {
      form.setErrors(value)
    },
    get processing() {
      return state.value.processing
    },
    get progress() {
      return state.value.progress
    },
    get wasSuccessful() {
      return state.value.wasSuccessful
    },
    get isDirty() {
      return state.value.isDirty
    },
    set(keyOrValues: keyof T | Partial<T>, value?: unknown) {
      if (typeof keyOrValues === "object" && keyOrValues !== null) {
        form.set(keyOrValues as Partial<T>)
      } else {
        form.set(keyOrValues as keyof T, value as T[keyof T])
      }
    },
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
