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
  return `import type { JSX } from "solid-js"
import "../styles.css"

export default function Layout(props: { children: JSX.Element }) {
  return <div class="shell">{props.children}</div>
}
`
}

function pageTsx(page: ScaffoldPage): string {
  return `import { Head, usePage } from "@kolektiv/keel-solid"
import type { ${page.typeName} } from "${page.typesImport}"

export default function Page() {
  const page = usePage<${page.typeName}>()
  return (
    <>
      <Head />
      <p class="lede">${page.id} · <code>${page.path}</code></p>
      <pre>{JSON.stringify(page().data, null, 2)}</pre>
    </>
  )
}
`
}

export function solidScaffoldProvider(): ScaffoldProvider {
  return {
    name: "solid",
    packageJson: (project) =>
      packageJsonContent(
        project.id,
        project.version,
        {
          "@kolektiv/keel": "workspace:*",
          "@kolektiv/keel-solid": "workspace:*",
          "@tanstack/query-core": "^5.66.0",
          "@tanstack/solid-query": "^5.66.0",
          "solid-js": "^1.9.4",
        },
        {
          "@kolektiv/keel-pack": "workspace:*",
          typescript: "^5.7.0",
          vite: "^6.2.0",
          "vite-plugin-solid": "^2.11.1",
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
          jsx: "preserve",
          jsxImportSource: "solid-js",
          types: ["vite/client"],
        },
        ["src/**/*.ts", "src/**/*.tsx", "src/**/*.d.ts"],
      ),
    frameworkConfig: () => [],
    viteConfig: (project) =>
      viteConfigContent(project, "solid", {
        import: `import solid from "vite-plugin-solid"`,
        call: "solid()",
      }),
    envDts: () => envDtsContent(),
    bootstrap: () => bootstrapContent("@kolektiv/keel-solid"),
    styles: () => stylesContent(),
    rootLayout: () => ({ file: "src/pages/+layout.tsx", content: rootLayout() }),
    pageFiles: (page) => [
      idOverride("+page.ts", page.id),
      { file: "+page.tsx", content: pageTsx(page) },
      { file: "+head.html", content: headContent(page) },
    ],
  }
}
