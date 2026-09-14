import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { ScaffoldPage, ScaffoldProject } from "./scaffold/provider.ts"
import { scaffoldProvider, type ScaffoldFramework } from "./scaffold/providers.ts"
import { originFromHost, parsePackSchema, schemaUrl, type PackSchema, type SchemaType } from "./schema.ts"

export type { ScaffoldFramework } from "./scaffold/providers.ts"
export { isScaffoldFramework, scaffoldFrameworks } from "./scaffold/providers.ts"

export interface ScaffoldOptions {
  outDir: string
  origin?: string
  schema?: PackSchema
  schemaPath?: string
  framework?: ScaffoldFramework
  id?: string
  version?: string
  pagesName?: string
  force?: boolean
  fetchImpl?: typeof fetch
}

export async function loadSchema(options: ScaffoldOptions): Promise<PackSchema> {
  if (options.schema) return options.schema
  if (options.schemaPath) {
    const source = readFileSync(options.schemaPath, "utf8")
    return parsePackSchema(JSON.parse(source), options.schemaPath)
  }
  if (!options.origin) {
    throw new Error("keel-scaffold: pass an origin or --schema <file>")
  }
  const url = schemaUrl(options.origin)
  const fetchFn = options.fetchImpl ?? fetch
  const response = await fetchFn(url)
  if (!response.ok) {
    throw new Error(`keel-scaffold: GET ${url} failed (${response.status})`)
  }
  return parsePackSchema(await response.json(), url)
}

export async function scaffoldPack(options: ScaffoldOptions): Promise<string[]> {
  const provider = scaffoldProvider(options.framework ?? "svelte")
  const schema = await loadSchema(options)
  const pageIds = Object.keys(schema.pages)
  if (pageIds.length === 0) {
    throw new Error("keel-scaffold: schema has no pages")
  }
  const outDir = options.outDir
  mkdirSync(outDir, { recursive: true })
  const id = options.id ?? basenameId(outDir)
  const version = options.version ?? "0.1.0"
  const pagesName = options.pagesName ?? schema.pagesName ?? pascal(id) + "Pages"
  const notFound = pageIds.find((pageId) => pageId.endsWith(".notFound") || pageId === "not-found" || pageId === "notFound")
  const project: ScaffoldProject = {
    id,
    version,
    keelVersion: packVersion(),
    pagesName,
    notFound,
  }
  const written: string[] = []

  write(outDir, "package.json", provider.packageJson(project), options.force, written)
  write(outDir, "tsconfig.json", provider.tsconfig(project), options.force, written)
  for (const file of provider.frameworkConfig(project)) {
    write(outDir, file.file, file.content, options.force, written)
  }
  write(outDir, "vite.config.ts", provider.viteConfig(project), options.force, written)
  write(outDir, "src/env.d.ts", provider.envDts(project), options.force, written)
  write(outDir, "src/bootstrap.ts", provider.bootstrap(project), options.force, written)
  write(outDir, "src/styles.css", provider.styles(project), options.force, written)
  write(outDir, "src/lib/page-types.ts", emitTypescript(schema, pagesName), options.force, written)
  write(outDir, "src/lib/page-types.json", `${JSON.stringify(schema, null, 2)}\n`, options.force, written)
  const layout = provider.rootLayout(project)
  write(outDir, layout.file, layout.content, options.force, written)

  for (const pageId of pageIds) {
    const page = schema.pages[pageId]
    const dir = pageId.split(".").join("/")
    const depth = pageId.split(".").length
    const typesImport = `${"../".repeat(depth + 1)}lib/page-types`
    const context: ScaffoldPage = {
      id: pageId,
      typeName: page.type,
      path: page.path ?? "/",
      fields: schema.types?.[page.type]?.fields ?? {},
      typesImport,
    }
    for (const file of provider.pageFiles(context)) {
      write(outDir, `src/pages/${dir}/${file.file}`, file.content, options.force, written)
    }
  }
  return written
}

function write(root: string, relative: string, content: string, force: boolean | undefined, written: string[]): void {
  const file = join(root, relative)
  if (existsSync(file) && !force) {
    throw new Error(`keel-scaffold: ${relative} exists (pass --force to overwrite)`)
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
  written.push(relative)
}

function basenameId(outDir: string): string {
  const base = outDir.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "pack"
  return base.replace(/[^A-Za-z0-9._-]+/g, "-")
}

function pascal(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("")
}

export function emitTypescript(schema: PackSchema, pagesName: string): string {
  const pageIdName = pagesName.endsWith("Pages")
    ? `${pagesName.slice(0, -5) || ""}PageId`
    : `${pagesName}Id`
  const actionsName = pagesName.endsWith("Pages")
    ? `${pagesName.slice(0, -5) || ""}Actions`
    : `${pagesName}Actions`
  const actionIdName = pagesName.endsWith("Pages")
    ? `${pagesName.slice(0, -5) || ""}ActionId`
    : `${pagesName}ActionId`
  const lines = ["// Generated by keel-scaffold from GET /__keel/schema. Do not edit.", ""]
  for (const [name, type] of Object.entries(schema.types ?? {})) {
    lines.push(...emitType(name, type), "")
  }
  lines.push(`export interface ${pagesName} {`)
  for (const [id, page] of Object.entries(schema.pages)) {
    lines.push(`  ${JSON.stringify(id)}: ${page.type}`)
  }
  lines.push("}", "", `export type ${pageIdName} = keyof ${pagesName}`)
  const actions = schema.actions ?? {}
  if (Object.keys(actions).length > 0) {
    lines.push("", `export interface ${actionsName} {`)
    for (const [id, action] of Object.entries(actions)) {
      lines.push(`  ${JSON.stringify(id)}: { in: ${action.in}; out: ${action.out} }`)
    }
    lines.push("}", "", `export type ${actionIdName} = keyof ${actionsName}`)
  }
  return `${lines.join("\n")}\n`
}

function emitType(name: string, type: SchemaType): string[] {
  if (type.kind === "enum" && type.values) {
    return [`export type ${name} = ${type.values.map((value) => JSON.stringify(value)).join(" | ")}`]
  }
  const fields = type.fields ?? {}
  const body = Object.entries(fields).map(([field, ts]) => `  ${field}: ${ts}`)
  return [`export interface ${name} {`, ...body, `}`]
}

const FALLBACK_KEEL_VERSION = "0.1.0"

function packVersion(): string {
  try {
    const parsed = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: unknown }
    if (typeof parsed.version === "string" && parsed.version.length > 0) return parsed.version
  } catch {}
  return FALLBACK_KEEL_VERSION
}

export { originFromHost, schemaUrl }
