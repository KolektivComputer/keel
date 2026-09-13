import { adapterSuite } from "./adapter-suite.ts"
import { preactFiles } from "./preact.ts"

adapterSuite({
  name: "preact",
  pageFile: "+page.tsx",
  layoutFile: "+layout.tsx",
  idFile: "+page.ts",
  mount: "@kolektiv/keel-preact/mount",
  factory: preactFiles,
})
