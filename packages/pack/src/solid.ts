import type { RouterAdapter } from "./adapter.ts"
import { frameworkAdapter } from "./framework-adapter.ts"

/** Solid: `+page.tsx`, `+layout.tsx`, `+page.ts` id override, `+head.html`. */
export function solidFiles(): RouterAdapter {
  return frameworkAdapter({
    name: "solid",
    mount: "@kolektiv/keel-solid/mount",
    pageFile: "+page.tsx",
    layoutFile: "+layout.tsx",
    idFile: "+page.ts",
  })
}
