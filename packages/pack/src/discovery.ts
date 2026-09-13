import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { basename, dirname, join, relative } from "node:path"
import type { DiscoveredPage } from "./adapter.ts"

/**
 * File conventions an adapter discovers under `pagesDir`.
 *
 * - `pageFile` marks a page; its directory path, minus `(group)` segments and
 *   with `/` becoming `.`, is the page id.
 * - `layoutFile` files wrap descendant pages, root-first.
 * - `idFile`, when present, may `export const id` to override the path id.
 * - `headFile` compiles through `compileHead` into the page's manifest `head`.
 * - `_`-prefixed files and directories are skipped.
 */
export interface DiscoverySpec {
  pageFile: string
  layoutFile: string
  idFile?: string
  headFile?: string
  compileHead?: (source: string, from: string) => string
}

const ID_OVERRIDE = /export\s+const\s+id\s*=\s*["']([^"']+)["']/

export function discoverPages(pagesDir: string, spec: DiscoverySpec): DiscoveredPage[] {
  if (!existsSync(pagesDir) || !statSync(pagesDir).isDirectory()) {
    throw new Error(`pagesDir is not a directory: ${pagesDir}`)
  }
  const pages: DiscoveredPage[] = []
  const seen = new Map<string, string>()
  for (const file of listFiles(pagesDir)) {
    if (basename(file) !== spec.pageFile) continue
    const id = pageId(pagesDir, file, spec)
    const previous = seen.get(id)
    if (previous) {
      throw new Error(`duplicate page id '${id}' from ${previous} and ${file}`)
    }
    seen.set(id, file)
    const head = compiledHead(file, spec)
    pages.push({
      id,
      file,
      layouts: layoutsFor(pagesDir, file, spec.layoutFile),
      ...(head !== undefined ? { head } : {}),
    })
  }
  pages.sort((a, b) => a.id.localeCompare(b.id))
  return pages
}

/** Stable entry module source: page, layouts root-first, runtime `createPage`. */
export function pageEntrySource(page: DiscoveredPage, mount: string): string {
  const lines = [`import Page from ${JSON.stringify(page.file)}`]
  page.layouts.forEach((layout, index) => {
    lines.push(`import L${index} from ${JSON.stringify(layout)}`)
  })
  const layoutList = page.layouts.map((_, index) => `L${index}`).join(", ")
  lines.push(`import { createPage } from ${JSON.stringify(mount)}`)
  lines.push(`export const { mount, unmount, update } = createPage(Page, [${layoutList}])`)
  return `${lines.join("\n")}\n`
}

function listFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listFiles(full))
      continue
    }
    if (entry.isFile()) out.push(full)
  }
  return out
}

function pageId(pagesDir: string, file: string, spec: DiscoverySpec): string {
  if (spec.idFile) {
    const overrideFile = join(dirname(file), spec.idFile)
    const override = idOverride(overrideFile)
    if (override !== undefined) {
      if (override === "") {
        throw new Error(`empty page id override in ${overrideFile}`)
      }
      return override
    }
  }
  const rel = relative(pagesDir, file).replaceAll("\\", "/")
  const segments = rel.split("/").slice(0, -1).filter((segment) => !isGroup(segment))
  const id = segments.join(".")
  if (id === "") {
    const hint = spec.idFile
      ? `export const id in a sibling ${spec.idFile}`
      : "put the page in a named directory"
    throw new Error(`root ${spec.pageFile} has an empty page id; ${hint} (${file})`)
  }
  return id
}

function idOverride(file: string): string | undefined {
  if (!existsSync(file)) return undefined
  const match = readFileSync(file, "utf8").match(ID_OVERRIDE)
  return match?.[1]
}

function compiledHead(file: string, spec: DiscoverySpec): string | undefined {
  if (!spec.headFile || !spec.compileHead) return undefined
  const headFile = join(dirname(file), spec.headFile)
  if (!existsSync(headFile)) return undefined
  return spec.compileHead(readFileSync(headFile, "utf8"), headFile)
}

function layoutsFor(pagesDir: string, file: string, layoutFile: string): string[] {
  const relDir = relative(pagesDir, dirname(file)).replaceAll("\\", "/")
  const segments = relDir === "" || relDir === "." ? [] : relDir.split("/")
  const layouts: string[] = []
  let current = pagesDir
  const rootLayout = join(current, layoutFile)
  if (existsSync(rootLayout)) layouts.push(rootLayout)
  for (const segment of segments) {
    current = join(current, segment)
    const layout = join(current, layoutFile)
    if (existsSync(layout)) layouts.push(layout)
  }
  return layouts
}

function isGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")")
}
