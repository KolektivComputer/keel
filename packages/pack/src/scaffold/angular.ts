import {
  bootstrapContent,
  envDtsContent,
  headContent,
  idOverride,
  packageJsonContent,
  stylesContent,
  tsconfigContent,
  viteConfigContent,
  type ScaffoldPage,
  type ScaffoldProvider,
} from "./provider.ts"

function rootLayout(): string {
  return `import { Component } from "@angular/core"
import "../styles.css"

@Component({
  selector: "keel-layout",
  standalone: true,
  template: \`<div class="shell"><ng-content /></div>\`,
})
export default class Layout {}
`
}

function selector(id: string): string {
  return `keel-${id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`
}

function pageTs(page: ScaffoldPage): string {
  return `import { Component, JsonPipe } from "@angular/core"
import { page } from "@kolektiv/keel-angular"
import type { ${page.typeName} } from "${page.typesImport}"

@Component({
  selector: ${JSON.stringify(selector(page.id))},
  standalone: true,
  imports: [JsonPipe],
  template: \`
    <p class="lede">${page.id} · <code>${page.path}</code></p>
    <pre>{{ ctx.data | json }}</pre>
  \`,
})
export default class Page {
  readonly ctx = page<${page.typeName}>()
}
`
}

export function angularScaffoldProvider(): ScaffoldProvider {
  return {
    name: "angular",
    packageJson: (project) =>
      packageJsonContent(
        project.id,
        project.version,
        {
          "@angular/common": "^19.0.0",
          "@angular/core": "^19.0.0",
          "@angular/platform-browser": "^19.0.0",
          "@kolektiv/keel": "workspace:*",
          "@kolektiv/keel-angular": "workspace:*",
          "@tanstack/angular-query-experimental": "^5.66.0",
          "@tanstack/query-core": "^5.66.0",
        },
        {
          "@analogjs/vite-plugin-angular": "^1.10.0",
          "@angular/compiler-cli": "^19.0.0",
          "@kolektiv/keel-pack": "workspace:*",
          typescript: "^5.7.0",
          vite: "^6.2.0",
        },
        project.keelVersion,
      ),
    tsconfig: () =>
      tsconfigContent(
        {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          isolatedModules: true,
          skipLibCheck: true,
          noEmit: true,
          verbatimModuleSyntax: true,
          experimentalDecorators: true,
          useDefineForClassFields: false,
          types: ["vite/client"],
        },
        ["src/**/*.ts", "src/**/*.d.ts"],
        { angularCompilerOptions: { strictTemplates: true } },
      ),
    frameworkConfig: () => [],
    viteConfig: (project) =>
      viteConfigContent(project, "angular", {
        import: `import analog from "@analogjs/vite-plugin-angular"`,
        call: "analog()",
      }),
    envDts: () => envDtsContent(),
    bootstrap: () => bootstrapContent("@kolektiv/keel-angular"),
    styles: () => stylesContent(),
    rootLayout: () => ({ file: "src/pages/+layout.ts", content: rootLayout() }),
    pageFiles: (page) => [
      idOverride("+page.id.ts", page.id),
      { file: "+page.ts", content: pageTs(page) },
      { file: "+head.html", content: headContent(page) },
    ],
  }
}
