import { adapterSuite } from "./adapter-suite.ts"
import { angularFiles } from "./angular.ts"

adapterSuite({
  name: "angular",
  pageFile: "+page.ts",
  layoutFile: "+layout.ts",
  idFile: "+page.id.ts",
  mount: "@kolektiv/keel-angular/mount",
  factory: angularFiles,
})
