import type { RouterAdapter } from "./adapter.ts"
import { angularFiles } from "./angular.ts"
import { litFiles } from "./lit.ts"
import { preactFiles } from "./preact.ts"
import { reactFiles } from "./react.ts"
import { solidFiles } from "./solid.ts"
import { svelteFiles } from "./svelte.ts"
import { vueFiles } from "./vue.ts"

const REGISTRY: Record<string, () => RouterAdapter> = {
  angular: angularFiles,
  lit: litFiles,
  preact: preactFiles,
  react: reactFiles,
  solid: solidFiles,
  svelte: svelteFiles,
  vue: vueFiles,
}

/** Framework names with a built-in adapter, sorted. */
export const supportedFrameworks: readonly string[] = Object.keys(REGISTRY).sort()

/** Resolve a framework name to its built-in adapter. */
export function routerFor(framework: string): RouterAdapter {
  const factory = REGISTRY[framework]
  if (!factory) {
    throw new Error(
      `keelPack: no router for framework '${framework}'; supported frameworks: ${supportedFrameworks.join(", ")} (or pass router)`,
    )
  }
  return factory()
}
