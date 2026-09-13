import {
  createFormState,
  type FormSnapshot,
  type Method,
  type VisitOptions,
} from "@kolektiv/keel"

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

export function useForm<T extends Record<string, unknown>>(initial: T): FormState<T> {
  const form = createFormState<T>(initial)
  let data = $state<T>(form.get().data)
  let errors = $state<Record<string, string[]>>(form.get().errors)
  let processing = $state(form.get().processing)
  let progress = $state<number | null>(form.get().progress)
  let wasSuccessful = $state(form.get().wasSuccessful)
  let isDirty = $state(form.get().isDirty)

  function sync(state: FormSnapshot<T> = form.get()) {
    data = state.data
    errors = state.errors
    processing = state.processing
    progress = state.progress
    wasSuccessful = state.wasSuccessful
    isDirty = state.isDirty
  }

  const state: FormState<T> = {
    get data() {
      return data
    },
    set data(value) {
      form.setData(value)
      sync()
    },
    get errors() {
      return errors
    },
    set errors(value) {
      form.setErrors(value)
      sync()
    },
    get processing() {
      return processing
    },
    get progress() {
      return progress
    },
    get wasSuccessful() {
      return wasSuccessful
    },
    get isDirty() {
      return isDirty
    },
    set(keyOrValues: keyof T | Partial<T>, value?: unknown) {
      if (typeof keyOrValues === "object" && keyOrValues !== null) {
        form.set(keyOrValues as Partial<T>)
      } else {
        form.set(keyOrValues as keyof T, value as T[keyof T])
      }
      sync()
    },
    reset(...fields: (keyof T)[]) {
      form.reset(...fields)
      sync()
    },
    clearErrors() {
      form.clearErrors()
      sync()
    },
    async submit(method, href, options = {}) {
      const stop = form.subscribe(sync)
      try {
        await form.submit(method, href, options)
      } finally {
        stop()
        sync()
      }
    },
    get: (href, options) => state.submit("get", href, options),
    post: (href, options) => state.submit("post", href, options),
    put: (href, options) => state.submit("put", href, options),
    patch: (href, options) => state.submit("patch", href, options),
    delete: (href, options) => state.submit("delete", href, options),
  }
  return state
}
