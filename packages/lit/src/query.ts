import {
  action,
  getPage,
  KEEL_PAGE_QUERY_KEY,
  pageQueryKey,
  router,
  type ActionError,
  type KeelSeed,
} from "@kolektiv/keel"
import {
  MutationObserver,
  QueryClient,
  QueryObserver,
  type MutationObserverResult,
  type QueryObserverResult,
} from "@tanstack/query-core"
import type { ReactiveController, ReactiveControllerHost } from "lit"

let client: QueryClient | null = null

/** The pack-wide TanStack client. `staleTime: Infinity`: only Keel writes. */
export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
        },
      },
    })
  }
  return client
}

export { pageQueryKey }

/**
 * Stores a seed under both the root "current page" key and its path key.
 * `bootstrap` calls this for the embedded seed and every applied visit.
 */
export function hydrateKeelQuery(seed: KeelSeed): void {
  const qc = getQueryClient()
  qc.setQueryData(KEEL_PAGE_QUERY_KEY, seed)
  qc.setQueryData(pageQueryKey(seed.path), seed)
}

/** Options for {@link useAction}. */
export interface UseActionOptions {
  /** Visit the current URL after a successful action. Default true. */
  reload?: boolean
  preserveScroll?: boolean
  preserveState?: boolean
}

/**
 * Typed POST to `/__keel/action/{id}` as a Lit controller. On success, unless
 * `reload` is false, the current page is re-visited so the seed store and the
 * TanStack cache rehydrate from the host, then the root query key is
 * invalidated without an immediate refetch (`refetchType: "none"`).
 *
 * ```ts
 * class SaveButton extends KeelElement {
 *   readonly save = useAction<{ name: string }, { ok: boolean }>(this, "demo.save")
 *   render() {
 *     return html`<button ?disabled=${this.save.isPending}
 *       @click=${() => this.save.mutate({ name: "x" })}>Save</button>`
 *   }
 * }
 * ```
 */
export class KeelActionController<I = unknown, O = unknown> implements ReactiveController {
  private readonly observer: MutationObserver<O, ActionError, I>
  private result: MutationObserverResult<O, ActionError, I>
  private unsubscribe: (() => void) | undefined

  constructor(
    private readonly host: ReactiveControllerHost,
    id: string,
    options: UseActionOptions = {},
  ) {
    const queryClient = getQueryClient()
    this.observer = new MutationObserver<O, ActionError, I>(queryClient, {
      mutationFn: (input: I) => action<I, O>(id, input),
      onSuccess: async () => {
        if (options.reload === false) return
        await router.reload({
          preserveScroll: options.preserveScroll ?? true,
          preserveState: options.preserveState ?? true,
        })
        hydrateKeelQuery(getPage())
        await queryClient.invalidateQueries({ queryKey: KEEL_PAGE_QUERY_KEY, refetchType: "none" })
      },
    })
    this.result = this.observer.getCurrentResult()
    host.addController(this)
  }

  hostConnected(): void {
    this.unsubscribe ??= this.observer.subscribe((result) => {
      this.result = result
      this.host.requestUpdate()
    })
  }

  hostDisconnected(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
  }

  /** The latest `MutationObserverResult`. */
  get current(): MutationObserverResult<O, ActionError, I> {
    return this.result
  }

  get isIdle(): boolean {
    return this.result.isIdle
  }

  get isPending(): boolean {
    return this.result.isPending
  }

  get isError(): boolean {
    return this.result.isError
  }

  get isSuccess(): boolean {
    return this.result.isSuccess
  }

  get data(): O | undefined {
    return this.result.data
  }

  get error(): ActionError | null {
    return this.result.error
  }

  get variables(): I | undefined {
    return this.result.variables
  }

  /** Fire-and-forget mutation; read `error` from the controller or catch `mutateAsync`. */
  mutate(variables: I): void {
    void this.observer.mutate(variables)
  }

  mutateAsync(variables: I): Promise<O> {
    return this.observer.mutate(variables)
  }

  reset(): void {
    this.observer.reset()
    this.result = this.observer.getCurrentResult()
  }
}

/** Controller factory: `readonly save = useAction(this, "demo.save")`. */
export function useAction<I = unknown, O = unknown>(
  host: ReactiveControllerHost,
  id: string,
  options: UseActionOptions = {},
): KeelActionController<I, O> {
  return new KeelActionController<I, O>(host, id, options)
}

/**
 * The current seed as a TanStack query under the root key: `initialData` is
 * the store's seed, and a refetch reloads the current URL and returns the new
 * seed. Exposes the core `QueryObserverResult` surface (`data`, `isPending`,
 * `refetch`, …) for the host to render.
 */
export class KeelPageQueryController<T = unknown> implements ReactiveController {
  private readonly observer: QueryObserver<KeelSeed<T>, Error>
  private result: QueryObserverResult<KeelSeed<T>, Error>
  private unsubscribe: (() => void) | undefined

  constructor(private readonly host: ReactiveControllerHost) {
    const queryClient = getQueryClient()
    const options = queryClient.defaultQueryOptions<KeelSeed<T>, Error, KeelSeed<T>, KeelSeed<T>>({
      queryKey: KEEL_PAGE_QUERY_KEY,
      queryFn: async () => {
        await router.reload({ preserveScroll: true, preserveState: true })
        return getPage<T>()
      },
      initialData: getPage<T>(),
      staleTime: Infinity,
    })
    options._optimisticResults = "optimistic"
    this.observer = new QueryObserver(queryClient, options)
    this.result = this.observer.getOptimisticResult(options)
    host.addController(this)
  }

  hostConnected(): void {
    this.unsubscribe ??= this.observer.subscribe((result) => {
      this.result = result
      this.host.requestUpdate()
    })
  }

  hostDisconnected(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
  }

  /** The latest `QueryObserverResult`. */
  get current(): QueryObserverResult<KeelSeed<T>, Error> {
    return this.result
  }

  get data(): KeelSeed<T> | undefined {
    return this.result.data
  }

  refetch(): Promise<QueryObserverResult<KeelSeed<T>, Error>> {
    return this.observer.refetch()
  }
}

/** Controller factory: `readonly query = useKeelPageQuery(this)`. */
export function useKeelPageQuery<T = unknown>(
  host: ReactiveControllerHost,
): KeelPageQueryController<T> {
  return new KeelPageQueryController<T>(host)
}
