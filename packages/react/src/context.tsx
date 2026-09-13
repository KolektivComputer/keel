import type { KeelSeed, PageContext } from "@kolektiv/keel"
import { createContext, useContext, type ReactNode } from "react"

/** Value provided by the page mount to layouts and the page component. */
export interface KeelProviderValue<T = unknown> {
  seed: KeelSeed<T>
  context: PageContext<T>
}

const KeelContext = createContext<KeelProviderValue | null>(null)

/** @internal Used by `createPage`; prefer `usePageContext()` in app code. */
export function KeelProvider<T>({
  seed,
  context,
  children,
}: KeelProviderValue<T> & { children?: ReactNode }) {
  return <KeelContext.Provider value={{ seed, context } as KeelProviderValue}>{children}</KeelContext.Provider>
}

/**
 * The `PageContext` for the mounted page: route params, payload, validation
 * errors, theme, shared values, and `navigate`. This is the React equivalent
 * of the `ctx` prop Svelte pages and layouts receive.
 */
export function usePageContext<T = unknown>(): PageContext<T> {
  const value = useContext(KeelContext)
  if (!value) throw new Error("Keel: usePageContext() must be called inside a pack page")
  return value.context as PageContext<T>
}
