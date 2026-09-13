import type { KeelSeed, PageContext } from "@kolektiv/keel"
import { inject, type InjectionKey, type ShallowRef } from "vue"

/** Value provided by the page mount to layouts and the page component. */
export interface KeelProviderValue<T = unknown> {
  seed: ShallowRef<KeelSeed<T> | undefined>
  context: ShallowRef<PageContext<T> | undefined>
}

/** @internal Used by `createPage`; prefer `usePageContext()` in app code. */
export const KEEL_PROVIDER_KEY: InjectionKey<KeelProviderValue> = Symbol("keel:provider")

/**
 * The `PageContext` for the mounted page: route params, payload, validation
 * errors, theme, shared values, and `navigate`. This is the Vue equivalent of
 * the `ctx` prop Svelte pages and layouts receive. The returned ref is
 * reactive: `createPage` swaps its value on `update(ctx)`, so descendants see
 * context changes without remounting.
 */
export function usePageContext<T = unknown>(): ShallowRef<PageContext<T>> {
  const provider = inject(KEEL_PROVIDER_KEY, null)
  if (!provider) throw new Error("Keel: usePageContext() must be called inside a pack page")
  return provider.context as ShallowRef<PageContext<T>>
}
