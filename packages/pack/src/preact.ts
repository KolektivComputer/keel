import type { RouterAdapter } from "./adapter.ts"
import { frameworkAdapter } from "./framework-adapter.ts"

/** Preact: `+page.tsx`, `+layout.tsx`, `+page.ts` id override, `+head.html`. */
export function preactFiles(): RouterAdapter {
  return frameworkAdapter({
    name: "preact",
    mount: "@kolektiv/keel-preact/mount",
    pageFile: "+page.tsx",
    layoutFile: "+layout.tsx",
    idFile: "+page.ts",
  })
}
