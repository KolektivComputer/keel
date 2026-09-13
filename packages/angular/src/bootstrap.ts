import { bootstrap as start, type RouterConfig } from "@kolektiv/keel"
import { hydrateKeelQuery } from "./query.js"
import { keelApplication } from "./runtime.js"

/**
 * Reads `#__keel_seed`, hydrates the TanStack cache from it, and mounts the
 * pack entry. The Keel Angular application (zoneless, TanStack Query
 * provided) is created before core applies the seed, so pack `createPage`
 * mounts share it. The caller's `onSeed` still runs, after hydration, for
 * both the initial seed and every applied visit.
 */
export async function bootstrap(options: RouterConfig = {}): Promise<void> {
  await keelApplication()
  const onSeed = options.onSeed
  await start({
    ...options,
    onSeed(seed, phase) {
      hydrateKeelQuery(seed)
      return onSeed?.(seed, phase)
    },
  })
}
