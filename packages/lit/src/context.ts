import type { PageContext } from "@kolektiv/keel"
import { createContext } from "@lit/context"

/**
 * Context key for the active `PageContext`. `KeelRoot` (owned by `createPage`)
 * provides it and every `KeelElement` consumes it, so an `update(ctx)` on the
 * mount propagates through the tree without re-instantiating elements.
 *
 * @internal
 */
export const keelPageContext = createContext<PageContext | undefined>(
  Symbol.for("@kolektiv/keel-lit/page-context"),
)
