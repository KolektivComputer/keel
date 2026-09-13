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
  QueryClient,
  useMutation,
  useQuery,
  type CreateMutationResult,
  type CreateQueryResult,
} from "@tanstack/solid-query"

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
 * Typed POST to `/__keel/action/{id}`. On success, unless `reload` is false,
 * the current page is re-visited so the TanStack cache rehydrates from the
 * host, then the root query key is invalidated without an immediate refetch
 * (`refetchType: "none"`).
 *
 * Returns the Solid Query mutation directly. Its state fields (`isPending`,
 * `error`) are reactive getters, so reading them in JSX subscribes the caller;
 * its methods (`mutateAsync`, `reset`) are plain functions, so calling one
 * never subscribes — the same state-reads-subscribe / method-reads-do-not
 * contract as the Svelte adapter (issue #15).
 */
export function useAction<I = unknown, O = unknown>(
  id: string,
  options: UseActionOptions = {},
): CreateMutationResult<O, ActionError, I> {
  const queryClient = getQueryClient()
  return useMutation<O, ActionError, I>(
    () => ({
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
    }),
    () => queryClient,
  )
}

/**
 * The current seed as a TanStack query under the root key. `initialData` is
 * computed lazily from the store — the seed object itself, never a clone — and
 * a refetch reloads the current URL and returns the new seed.
 */
export function useKeelPageQuery<T = unknown>(): CreateQueryResult<KeelSeed<T>, Error> {
  const queryClient = getQueryClient()
  return useQuery<KeelSeed<T>, Error>(
    () => ({
      queryKey: KEEL_PAGE_QUERY_KEY,
      queryFn: async () => {
        await router.reload({ preserveScroll: true, preserveState: true })
        return getPage<T>()
      },
      initialData: () => getPage<T>(),
      staleTime: Infinity,
    }),
    () => queryClient,
  )
}
