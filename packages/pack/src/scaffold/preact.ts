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
  return `import type { ComponentChildren } from "preact"
import "../styles.css"

export default function Layout({ children }: { children: ComponentChildren }) {
  return <div class="shell">{children}</div>
}
`
}

function pageTsx(page: ScaffoldPage): string {
  return `import { Head, page } from "@kolektiv/keel-preact"
import type { ${page.typeName} } from "${page.typesImport}"

export default function Page() {
  const ctx = page<${page.typeName}>()
  return (
    <>
      <Head />
      <p class="lede">${page.id} · <code>${page.path}</code></p>
      <pre>{JSON.stringify(ctx.data, null, 2)}</pre>
    </>
  )
}
`
}

export function preactScaffoldProvider(): ScaffoldProvider {
  return {
    name: "preact",
    packageJson: (project) =>
      packageJsonContent(
        project.id,
        project.version,
        {
          "@kolektiv/keel": "workspace:*",
          "@kolektiv/keel-preact": "workspace:*",
          "@tanstack/preact-query": "^5.66.0",
          "@tanstack/query-core": "^5.66.0",
          preact: "^10.25.4",
        },
        {
          "@kolektiv/keel-pack": "workspace:*",
          "@preact/preset-vite": "^2.10.1",
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
          jsx: "react-jsx",
          jsxImportSource: "preact",
          types: ["vite/client"],
        },
        ["src/**/*.ts", "src/**/*.tsx", "src/**/*.d.ts"],
      ),
    frameworkConfig: () => [],
    viteConfig: (project) =>
      viteConfigContent(project, "preact", {
        import: `import preact from "@preact/preset-vite"`,
        call: "preact()",
      }),
    envDts: () => envDtsContent(),
    bootstrap: () => bootstrapContent("@kolektiv/keel-preact"),
    styles: () => stylesContent(),
    rootLayout: () => ({ file: "src/pages/+layout.tsx", content: rootLayout() }),
    pageFiles: (page) => [
      idOverride("+page.ts", page.id),
      { file: "+page.tsx", content: pageTsx(page) },
      { file: "+head.html", content: headContent(page) },
    ],
  }
}
