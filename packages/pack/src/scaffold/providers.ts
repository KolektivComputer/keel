import { supportedFrameworks } from "../registry.ts"
import { angularScaffoldProvider } from "./angular.ts"
import { litScaffoldProvider } from "./lit.ts"
import { preactScaffoldProvider } from "./preact.ts"
import { reactScaffoldProvider } from "./react.ts"
import { solidScaffoldProvider } from "./solid.ts"
import { svelteScaffoldProvider } from "./svelte.ts"
import { vueScaffoldProvider } from "./vue.ts"
import type { ScaffoldProvider } from "./provider.ts"

const PROVIDERS = {
  angular: angularScaffoldProvider,
  lit: litScaffoldProvider,
  preact: preactScaffoldProvider,
  react: reactScaffoldProvider,
  solid: solidScaffoldProvider,
  svelte: svelteScaffoldProvider,
  vue: vueScaffoldProvider,
} as const satisfies Record<string, () => ScaffoldProvider>

export type ScaffoldFramework = keyof typeof PROVIDERS

/** Framework names `keel-scaffold` can emit, from the keel-pack registry. */
export const scaffoldFrameworks: readonly ScaffoldFramework[] = supportedFrameworks.filter(isScaffoldFramework)

export function isScaffoldFramework(value: string): value is ScaffoldFramework {
  return Object.hasOwn(PROVIDERS, value)
}

export function scaffoldProvider(framework: string): ScaffoldProvider {
  if (!isScaffoldFramework(framework)) {
    throw new Error(
      `keel-scaffold: unsupported framework '${framework}'; supported frameworks: ${scaffoldFrameworks.join(", ")}`,
    )
  }
  return PROVIDERS[framework]()
}

for (const framework of supportedFrameworks) {
  if (!isScaffoldFramework(framework)) {
    throw new Error(
      `keel-scaffold: no template provider for framework '${framework}'; add one in packages/pack/src/scaffold/providers.ts`,
    )
  }
}
