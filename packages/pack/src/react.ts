import type { RouterAdapter } from "./adapter.ts"
import { frameworkAdapter } from "./framework-adapter.ts"

/** React: `+page.tsx`, `+layout.tsx`, `+page.ts` id override, `+head.html`. */
export function reactFiles(): RouterAdapter {
  return frameworkAdapter({
    name: "react",
    mount: "@kolektiv/keel-react/mount",
    pageFile: "+page.tsx",
    layoutFile: "+layout.tsx",
    idFile: "+page.ts",
  })
}
