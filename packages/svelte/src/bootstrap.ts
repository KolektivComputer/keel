import { bootstrap as start, type RouterConfig } from "@kolektiv/keel"
import { getQueryClient, hydrateKeelQuery } from "./query.js"

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
