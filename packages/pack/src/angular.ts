import type { RouterAdapter } from "./adapter.ts"
import { frameworkAdapter } from "./framework-adapter.ts"

/** Angular: `+page.ts`, `+layout.ts`, `+page.id.ts` id override, `+head.html`. */
export function angularFiles(): RouterAdapter {
  return frameworkAdapter({
    name: "angular",
    mount: "@kolektiv/keel-angular/mount",
    pageFile: "+page.ts",
    layoutFile: "+layout.ts",
    idFile: "+page.id.ts",
  })
}
