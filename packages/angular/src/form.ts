import { DestroyRef, inject, signal, type Signal } from "@angular/core"
import {
  createFormState,
  type FormSnapshot,
  type Method,
  type VisitOptions,
} from "@kolektiv/keel"

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
  setData(data: T): void
  setErrors(errors: Record<string, string[]>): void
  submit(method: Method, href: string, options?: VisitOptions): Promise<void>
  get(href: string, options?: VisitOptions): Promise<void>
  post(href: string, options?: VisitOptions): Promise<void>
  put(href: string, options?: VisitOptions): Promise<void>
  patch(href: string, options?: VisitOptions): Promise<void>
  delete(href: string, options?: VisitOptions): Promise<void>
}

class KeelFormState<T extends Record<string, unknown>> implements FormState<T> {
  private readonly store: ReturnType<typeof createFormState<T>>
  private readonly state: Signal<FormSnapshot<T>>

  constructor(initial: T) {
    const destroyRef = inject(DestroyRef)
    this.store = createFormState<T>(initial)
    const state = signal(this.store.get())
    this.state = state.asReadonly()
    const unsubscribe = this.store.subscribe((snapshot) => state.set(snapshot))
    destroyRef.onDestroy(unsubscribe)
  }

  get data(): T {
    return this.state().data
  }

  set data(value: T) {
    this.store.setData(value)
  }

  get errors(): Record<string, string[]> {
    return this.state().errors
  }

  set errors(value: Record<string, string[]>) {
    this.store.setErrors(value)
  }

  get processing(): boolean {
    return this.state().processing
  }

  get progress(): number | null {
    return this.state().progress
  }

  get wasSuccessful(): boolean {
    return this.state().wasSuccessful
  }

  get isDirty(): boolean {
    return this.state().isDirty
  }

  set<K extends keyof T>(key: K, value: T[K]): void
  set(values: Partial<T>): void
  set(keyOrValues: keyof T | Partial<T>, value?: unknown): void {
    if (typeof keyOrValues === "object" && keyOrValues !== null) {
      this.store.set(keyOrValues as Partial<T>)
    } else {
      this.store.set(keyOrValues as keyof T, value as T[keyof T])
    }
  }

  reset(...fields: (keyof T)[]): void {
    this.store.reset(...fields)
  }

  clearErrors(): void {
    this.store.clearErrors()
  }

  setData(data: T): void {
    this.store.setData(data)
  }

  setErrors(errors: Record<string, string[]>): void {
    this.store.setErrors(errors)
  }

  submit(method: Method, href: string, options: VisitOptions = {}): Promise<void> {
    return this.store.submit(method, href, options)
  }

  get(href: string, options?: VisitOptions): Promise<void> {
    return this.store.submit("get", href, options)
  }

  post(href: string, options?: VisitOptions): Promise<void> {
    return this.store.submit("post", href, options)
  }

  put(href: string, options?: VisitOptions): Promise<void> {
    return this.store.submit("put", href, options)
  }

  patch(href: string, options?: VisitOptions): Promise<void> {
    return this.store.submit("patch", href, options)
  }

  delete(href: string, options?: VisitOptions): Promise<void> {
    return this.store.submit("delete", href, options)
  }
}

/**
 * Form state for one component instance, mirroring the other adapters'
 * `FormState` surface. Getters read the latest core snapshot through a
 * signal, so templates see `form.data` / `form.errors` / `form.processing`
 * reactively and values are correct after `await form.submit(...)`.
 *
 * ```ts
 * export default class NoteForm {
 *   readonly form = injectKeelForm({ body: "" })
 * }
 * ```
 */
export function injectKeelForm<T extends Record<string, unknown>>(initial: T): FormState<T> {
  return new KeelFormState<T>(initial)
}
