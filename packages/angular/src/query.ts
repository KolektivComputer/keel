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
  injectMutation,
  injectQuery,
  injectQueryClient,
  type CreateMutationResult,
  type CreateQueryResult,
} from "@tanstack/angular-query-experimental"
import { QueryClient } from "@tanstack/query-core"

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

/** Options for {@link injectKeelAction}. */
export interface KeelActionOptions {
  /** Visit the current URL after a successful action. Default true. */
  reload?: boolean
  preserveScroll?: boolean
  preserveState?: boolean
}

/**
 * Typed POST to `/__keel/action/{id}` as an Angular Query mutation. On
 * success, unless `reload` is false, the current page is re-visited so the
 * seed store and the TanStack cache rehydrate from the host, then the root
 * query key is invalidated without an immediate refetch
 * (`refetchType: "none"`).
 *
 * The result is the native `CreateMutationResult`: read `isPending()`,
 * `isSuccess()`, and `error()` as signals, and call `mutate` / `mutateAsync`
 * from event handlers.
 *
 * ```ts
 * export default class SaveButton {
 *   readonly save = injectKeelAction<{ name: string }, { ok: boolean }>("demo.save")
 *   // template: <button [disabled]="save.isPending()" (click)="save.mutate({ name: 'x' })">
 * }
 * ```
 */
export function injectKeelAction<I = unknown, O = unknown>(
  id: string,
  options: KeelActionOptions = {},
): CreateMutationResult<O, ActionError, I> {
  const queryClient = injectQueryClient()
  return injectMutation<O, ActionError, I>(() => ({
    mutationFn: (input: I) => action<I, O>(id, input),
    onSuccess: async () => {
      if (options.reload === false) return
      await router.reload({
        preserveScroll: options.preserveScroll ?? true,
        preserveState: options.preserveState ?? true,
      })
      hydrateKeelQuery(getPage())
      void queryClient.invalidateQueries({ queryKey: KEEL_PAGE_QUERY_KEY, refetchType: "none" })
    },
  }))
}

/**
 * The current seed as a TanStack query under the root key: `initialData` is
 * the store's seed, and a refetch reloads the current URL and returns the new
 * seed. The result is the native `CreateQueryResult` (`data()`, `isPending()`,
 * `refetch()`, …).
 */
export function injectKeelPageQuery<T = unknown>(): CreateQueryResult<KeelSeed<T>, Error> {
  return injectQuery<KeelSeed<T>, Error>(() => ({
    queryKey: KEEL_PAGE_QUERY_KEY,
    queryFn: async () => {
      await router.reload({ preserveScroll: true, preserveState: true })
      return getPage<T>()
    },
    initialData: () => getPage<T>(),
    staleTime: Infinity,
  }))
}
