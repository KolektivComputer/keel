import type { RouterAdapter } from "./adapter.ts"
import { frameworkAdapter } from "./framework-adapter.ts"

/** Lit: `+page.ts`, `+layout.ts`, `+page.id.ts` id override, `+head.html`. */
export function litFiles(): RouterAdapter {
  return frameworkAdapter({
    name: "lit",
    mount: "@kolektiv/keel-lit/mount",
    pageFile: "+page.ts",
    layoutFile: "+layout.ts",
    idFile: "+page.id.ts",
  })
}
