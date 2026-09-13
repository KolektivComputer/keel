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
  return `import { LitElement, html } from "lit"
import "../styles.css"

export default class Layout extends LitElement {
  render() {
    return html\`<div class="shell"><slot></slot></div>\`
  }
}
`
}

function pageTs(page: ScaffoldPage): string {
  return `import { LitElement, html } from "lit"
import { page } from "@kolektiv/keel-lit"
import type { ${page.typeName} } from "${page.typesImport}"

export default class Page extends LitElement {
  private readonly ctx = page<${page.typeName}>()

  render() {
    return html\`
      <p class="lede">${page.id} · <code>${page.path}</code></p>
      <pre>\${JSON.stringify(this.ctx.data, null, 2)}</pre>
    \`
  }
}
`
}

export function litScaffoldProvider(): ScaffoldProvider {
  return {
    name: "lit",
    packageJson: (project) =>
      packageJsonContent(
        project.id,
        project.version,
        {
          "@kolektiv/keel": "workspace:*",
          "@kolektiv/keel-lit": "workspace:*",
          "@tanstack/lit-query": "^5.66.0",
          "@tanstack/query-core": "^5.66.0",
          lit: "^3.2.1",
        },
        {
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
      ),
    frameworkConfig: () => [],
    viteConfig: (project) => viteConfigContent(project, "lit"),
    envDts: () => envDtsContent(),
    bootstrap: () => bootstrapContent("@kolektiv/keel-lit"),
    styles: () => stylesContent(),
    rootLayout: () => ({ file: "src/pages/+layout.ts", content: rootLayout() }),
    pageFiles: (page) => [
      idOverride("+page.id.ts", page.id),
      { file: "+page.ts", content: pageTs(page) },
      { file: "+head.html", content: headContent(page) },
    ],
  }
}
