import { bootstrap as start, type RouterConfig } from "@kolektiv/keel"
import { getQueryClient, hydrateKeelQuery } from "./query.js"

/**
 * Reads `#__keel_seed`, hydrates the TanStack cache from it, and mounts the
 * pack entry. The caller's `onSeed` still runs, after hydration, for both the
 * initial seed and every applied visit.
 */
export async function bootstrap(options: RouterConfig = {}): Promise<void> {
  getQueryClient()
  const onSeed = options.onSeed
  await start({
    ...options,
    onSeed(seed, phase) {
      hydrateKeelQuery(seed)
      return onSeed?.(seed, phase)
    },
  })
}
