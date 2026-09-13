/** Inputs shared by every per-framework scaffold generator. */
export interface ScaffoldProject {
  id: string
  version: string
  /** Published `@kolektiv/keel*` version the generated pack pins. */
  keelVersion: string
  pagesName: string
  notFound?: string
}

export interface ScaffoldPage {
  id: string
  typeName: string
  path: string
  /** Fields of the page's payload type, as emitted by typegen. */
  fields: Record<string, string>
  /** Relative import specifier for the generated `lib/page-types` module. */
  typesImport: string
}

export interface ScaffoldFile {
  /** Path relative to the pack root. */
  file: string
  content: string
}

/**
 * Codegen for one framework. `keel-scaffold` owns schema parsing, typegen,
 * page ids, and notFound detection; providers own everything framework-shaped.
 */
export interface ScaffoldProvider {
  readonly name: string
  packageJson(project: ScaffoldProject): string
  tsconfig(project: ScaffoldProject): string
  /** Extra root config files, e.g. `svelte.config.js`. */
  frameworkConfig(project: ScaffoldProject): ScaffoldFile[]
  viteConfig(project: ScaffoldProject): string
  envDts(project: ScaffoldProject): string
  bootstrap(project: ScaffoldProject): string
  styles(project: ScaffoldProject): string
  rootLayout(project: ScaffoldProject): ScaffoldFile
  /** Page component, id override, and head template for one page id. */
  pageFiles(page: ScaffoldPage): ScaffoldFile[]
}

export function standaloneDependencies(
  keelVersion: string,
  deps: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(deps).map(([name, range]) => [name, range.startsWith("workspace:") ? keelVersion : range]),
  )
}

export function packageJsonContent(
  id: string,
  version: string,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  keelVersion: string,
): string {
  return `${JSON.stringify(
    {
      name: id,
      private: true,
      version,
      type: "module",
      scripts: {
        dev: "vite build --watch",
        build: "vite build",
        typecheck: "tsc --noEmit -p tsconfig.json",
      },
      dependencies: standaloneDependencies(keelVersion, dependencies),
      devDependencies: standaloneDependencies(keelVersion, devDependencies),
    },
    null,
    2,
  )}\n`
}

export function tsconfigContent(
  compilerOptions: Record<string, unknown>,
  include: string[],
  extra: Record<string, unknown> = {},
): string {
  return `${JSON.stringify({ compilerOptions, ...extra, include }, null, 2)}\n`
}

export function viteConfigContent(
  project: ScaffoldProject,
  framework: string,
  plugin?: { import: string; call: string },
): string {
  const notFoundLine = project.notFound ? `\n      notFound: ${JSON.stringify(project.notFound)},` : ""
  return `${[
    ...(plugin ? [plugin.import] : []),
    `import { keelPack } from "@kolektiv/keel-pack/vite"`,
    `import { defineConfig } from "vite"`,
    "",
    "export default defineConfig({",
    "  plugins: [",
    ...(plugin ? [`    ${plugin.call},`] : []),
    "    keelPack({",
    `      id: ${JSON.stringify(project.id)},`,
    `      version: ${JSON.stringify(project.version)},`,
    `      framework: ${JSON.stringify(framework)},`,
    `      pagesDir: "src/pages",`,
    `      bootstrap: "src/bootstrap.ts",`,
    `      contract: "src/lib/page-types.json",${notFoundLine}`,
    `      pack: ${JSON.stringify(`dist/${project.id}.feb`)},`,
    "    }),",
    "  ],",
    "})",
    "",
  ].join("\n")}`
}

export function envDtsContent(declarations = ""): string {
  return `${declarations}declare module "*.css" {
  const css: string
  export default css
}
`
}

export function bootstrapContent(runtime: string): string {
  return `import { bootstrap } from ${JSON.stringify(runtime)}

void bootstrap()
`
}

export function stylesContent(): string {
  return `:root {
  color-scheme: dark;
  font-family: "Source Sans 3", "Segoe UI", system-ui, sans-serif;
  background: #1e1e2e;
  color: #cdd6f4;
}
html, body { margin: 0; min-height: 100%; }
.shell { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
.lede { color: #a6adc8; }
pre { overflow: auto; background: #181825; padding: 1rem; border-radius: 0.5rem; }
`
}

export function idOverride(file: string, id: string): ScaffoldFile {
  return { file, content: `export const id = ${JSON.stringify(id)}\n` }
}

/**
 * A basic head template that fits the generated page payload: the `title`
 * field when present, else the first plain string field, else the page id.
 */
export function headContent(page: ScaffoldPage): string {
  const field = headField(page.fields)
  return `<title>${field ? `{seed.data.${field}}` : "{seed.page}"}</title>\n`
}

function headField(fields: Record<string, string>): string | undefined {
  if (typeof fields.title === "string") return "title"
  for (const [name, type] of Object.entries(fields)) {
    if (type === "string" || type.startsWith("string ")) return name
  }
  return undefined
}
