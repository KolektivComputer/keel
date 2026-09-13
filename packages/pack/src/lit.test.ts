import { adapterSuite } from "./adapter-suite.ts"
import { litFiles } from "./lit.ts"

adapterSuite({
  name: "lit",
  pageFile: "+page.ts",
  layoutFile: "+layout.ts",
  idFile: "+page.id.ts",
  mount: "@kolektiv/keel-lit/mount",
  factory: litFiles,
})
