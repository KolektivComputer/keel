import type { RouterAdapter } from "./adapter.ts"
import { frameworkAdapter } from "./framework-adapter.ts"

/** Vue: `+page.vue`, `+layout.vue`, `+page.ts` id override, `+head.html`. */
export function vueFiles(): RouterAdapter {
  return frameworkAdapter({
    name: "vue",
    mount: "@kolektiv/keel-vue/mount",
    pageFile: "+page.vue",
    layoutFile: "+layout.vue",
    idFile: "+page.ts",
  })
}
