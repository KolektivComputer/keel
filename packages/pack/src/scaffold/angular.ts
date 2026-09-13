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
  return `import { JsonPipe } from "@angular/common"
import { Component } from "@angular/core"
import { injectKeelPage } from "@kolektiv/keel-angular"
import type { ${page.typeName} } from "${page.typesImport}"

@Component({
  selector: ${JSON.stringify(selector(page.id))},
  standalone: true,
  imports: [JsonPipe],
  template: \`
    <p class="lede">${page.id} · <code>${page.path}</code></p>
    <pre>{{ page().data | json }}</pre>
  \`,
})
export default class Page {
  readonly page = injectKeelPage<${page.typeName}>()
}
`
}

/**
 * Analog emits from its own program, so `noEmit: true` from the shared
 * `tsconfig.json` must be switched off here or every module compiles to an
 * empty string. Analog resolves the app config itself, except when `keelPack`
 * turns on Vite lib mode after the plugin's config hook ran, which makes it
 * look for a `tsconfig.lib.prod.json` this scaffold does not generate — so
 * `vite.config.ts` passes the path explicitly.
 */
function tsconfigApp(): string {
  return `${JSON.stringify(
    {
      extends: "./tsconfig.json",
      compilerOptions: {
        noEmit: false,
        outDir: "./out-tsc/app",
      },
      include: ["src/**/*.ts", "src/**/*.d.ts"],
    },
    null,
    2,
  )}\n`
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
          "@angular/build": "^19.0.0",
          "@angular/compiler-cli": "^19.0.0",
          "@kolektiv/keel-pack": "workspace:*",
          typescript: "~5.8.3",
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
    frameworkConfig: () => [{ file: "tsconfig.app.json", content: tsconfigApp() }],
    viteConfig: (project) =>
      viteConfigContent(project, "angular", {
        import: `import analog from "@analogjs/vite-plugin-angular"`,
        call: `analog({ tsconfig: "tsconfig.app.json" })`,
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
