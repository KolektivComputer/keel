import { path as chromePath } from "@kolektiv/common-docs-chrome"

/** Site base. `/` locally and on keel.mey.cat. */
export const base = import.meta.env.BASE_URL

/**
 * Base-aware site path. Thin wrapper over the shared chrome helper so content
 * and `.mdx` files keep importing `path()` from here.
 */
export function path(to: string): string {
  return chromePath(to, base)
}
