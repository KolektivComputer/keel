import {
  createFormState,
  type FormSnapshot,
  type Method,
  type VisitOptions,
} from "@kolektiv/keel"
import type { ReactiveController, ReactiveControllerHost } from "lit"

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

function sameSnapshot<T extends Record<string, unknown>>(
  left: FormSnapshot<T>,
  right: FormSnapshot<T>,
): boolean {
  return (
    left.data === right.data &&
    left.errors === right.errors &&
    left.processing === right.processing &&
    left.progress === right.progress &&
    left.wasSuccessful === right.wasSuccessful &&
    left.isDirty === right.isDirty
  )
}

/**
 * Form state for one host, created once in the element constructor. Getters
 * read a cached core snapshot so values are correct after
 * `await form.submit(...)` without awaiting an update, while the store
 * subscription requests a Lit update only when the snapshot actually changed.
 */
export class KeelFormController<T extends Record<string, unknown>>
  implements FormState<T>, ReactiveController
{
  private readonly store = createFormState<T>(this.initial)
  private cache: FormSnapshot<T>
  private unsubscribe: (() => void) | undefined

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly initial: T,
  ) {
    this.cache = this.store.get()
    host.addController(this)
  }

  hostConnected(): void {
    this.unsubscribe = this.store.subscribe((state) => {
      if (sameSnapshot(this.cache, state)) return
      this.cache = state
      this.host.requestUpdate()
    })
  }

  hostDisconnected(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
  }

  get data(): T {
    return this.cache.data
  }

  set data(value: T) {
    this.store.setData(value)
  }

  get errors(): Record<string, string[]> {
    return this.cache.errors
  }

  set errors(value: Record<string, string[]>) {
    this.store.setErrors(value)
  }

  get processing(): boolean {
    return this.cache.processing
  }

  get progress(): number | null {
    return this.cache.progress
  }

  get wasSuccessful(): boolean {
    return this.cache.wasSuccessful
  }

  get isDirty(): boolean {
    return this.cache.isDirty
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

/** Controller factory: `readonly form = useForm(this, { body: "" })`. */
export function useForm<T extends Record<string, unknown>>(
  host: ReactiveControllerHost,
  initial: T,
): KeelFormController<T> {
  return new KeelFormController<T>(host, initial)
}
