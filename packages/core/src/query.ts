/**
 * Query-cache key convention for adapters that hydrate caches from seeds.
 *
 * Every Keel query lives under the root {@link KEEL_PAGE_QUERY_KEY}
 * (`["keel", "page"]`). The current seed is stored there, and each path also
 * gets its own entry from {@link pageQueryKey} (`["keel", "page", path]`) so
 * a visit can replace the path-scoped entry while the root key stays the
 * general "current page" subscription.
 */
export const KEEL_PAGE_QUERY_KEY = ["keel", "page"] as const

export function pageQueryKey(path: string) {
  return ["keel", "page", path] as const
}
