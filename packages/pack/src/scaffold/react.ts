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
  return `import type { ReactNode } from "react"
import "../styles.css"

export default function Layout({ children }: { children: ReactNode }) {
  return <div className="shell">{children}</div>
}
`
}

function pageTsx(page: ScaffoldPage, runtime: string): string {
  return `import { Head, usePage } from "${runtime}"
import type { ${page.typeName} } from "${page.typesImport}"

export default function Page() {
  const seed = usePage<${page.typeName}>()
  return (
    <>
      <Head />
      <p className="lede">${page.id} · <code>${page.path}</code></p>
      <pre>{JSON.stringify(seed.data, null, 2)}</pre>
    </>
  )
}
`
}

export function reactScaffoldProvider(): ScaffoldProvider {
  return {
    name: "react",
    packageJson: (project) =>
      packageJsonContent(
        project.id,
        project.version,
        {
          "@kolektiv/keel": "workspace:*",
          "@kolektiv/keel-react": "workspace:*",
          "@tanstack/query-core": "^5.66.0",
          "@tanstack/react-query": "^5.66.0",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
        },
        {
          "@kolektiv/keel-pack": "workspace:*",
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
          "@vitejs/plugin-react": "^4.3.4",
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
          types: ["vite/client"],
        },
        ["src/**/*.ts", "src/**/*.tsx", "src/**/*.d.ts"],
      ),
    frameworkConfig: () => [],
    viteConfig: (project) =>
      viteConfigContent(project, "react", {
        import: `import react from "@vitejs/plugin-react"`,
        call: "react()",
      }),
    envDts: () => envDtsContent(),
    bootstrap: () => bootstrapContent("@kolektiv/keel-react"),
    styles: () => stylesContent(),
    rootLayout: () => ({ file: "src/pages/+layout.tsx", content: rootLayout() }),
    pageFiles: (page) => [
      idOverride("+page.ts", page.id),
      { file: "+page.tsx", content: pageTsx(page, "@kolektiv/keel-react") },
      { file: "+head.html", content: headContent(page) },
    ],
  }
}
