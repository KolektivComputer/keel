import { adapterSuite } from "./adapter-suite.ts"
import { reactFiles } from "./react.ts"

adapterSuite({
  name: "react",
  pageFile: "+page.tsx",
  layoutFile: "+layout.tsx",
  idFile: "+page.ts",
  mount: "@kolektiv/keel-react/mount",
  factory: reactFiles,
})
