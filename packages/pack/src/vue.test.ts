import { adapterSuite } from "./adapter-suite.ts"
import { vueFiles } from "./vue.ts"

adapterSuite({
  name: "vue",
  pageFile: "+page.vue",
  layoutFile: "+layout.vue",
  idFile: "+page.ts",
  mount: "@kolektiv/keel-vue/mount",
  factory: vueFiles,
})
