import { adapterSuite } from "./adapter-suite.ts"
import { solidFiles } from "./solid.ts"

adapterSuite({
  name: "solid",
  pageFile: "+page.tsx",
  layoutFile: "+layout.tsx",
  idFile: "+page.ts",
  mount: "@kolektiv/keel-solid/mount",
  factory: solidFiles,
})
