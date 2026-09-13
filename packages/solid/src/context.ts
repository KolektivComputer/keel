import type { KeelSeed, PageContext } from "@kolektiv/keel"
import { createContext, useContext, type Accessor } from "solid-js"

/**
 * Value provided by the page mount to layouts and the page component. The
 * signals are stable for the lifetime of the page module, so `update(ctx)`
 * propagates by writing them instead of remounting the tree.
 */
export interface KeelProviderValue<T = unknown> {
  seed: Accessor<KeelSeed<T> | undefined>
  context: Accessor<PageContext<T> | undefined>
}

/** @internal Used by `createPage`; prefer `usePageContext()` in app code. */
export const KEEL_CONTEXT = createContext<KeelProviderValue>()

/**
 * The `PageContext` accessor for the mounted page: route params, payload,
 * validation errors, theme, shared values, and `navigate`. This is the Solid
 * equivalent of the `ctx` prop Svelte pages and layouts receive. The accessor
 * is reactive: `createPage` writes the shared context signal on `update(ctx)`,
 * so descendants see context changes without remounting.
 */
export function usePageContext<T = unknown>(): Accessor<PageContext<T>> {
  const value = useContext(KEEL_CONTEXT)
  if (!value) throw new Error("Keel: usePageContext() must be called inside a pack page")
  return value.context as Accessor<PageContext<T>>
}
