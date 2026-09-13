import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { originFromHost, schemaUrl } from "./schema.ts"
import { emitTypescript, scaffoldPack } from "./scaffold.ts"

const ownPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
const cliPath = fileURLToPath(new URL("./scaffold-cli.ts", import.meta.url))
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

const schema = {
  format: "keel/1" as const,
  pagesName: "HarborPages",
  pages: {
    "harbor.home": { type: "HomePage", path: "/", methods: ["GET"] },
    "harbor.notFound": { type: "NotFoundPage", path: "/__not-found", methods: ["GET"] },
  },
  actions: {
    "harbor.setName": { in: "SetNameIn", out: "SetNameOut" },
  },
  types: {
    HomePage: { kind: "object", fields: { greeting: "string" } },
    NotFoundPage: { kind: "object", fields: { path: "string" } },
    SetNameIn: { kind: "object", fields: { displayName: "string" } },
    SetNameOut: { kind: "object", fields: { ok: "boolean" } },
  },
}

test("originFromHost defaults localhost to http and domains to https", () => {
  assert.equal(originFromHost("127.0.0.1:8090"), "http://127.0.0.1:8090")
  assert.equal(originFromHost("example.com"), "https://example.com")
  assert.equal(schemaUrl("example.com"), "https://example.com/__keel/schema")
})

test("emitTypescript writes pages and actions", () => {
  const ts = emitTypescript(schema, "HarborPages")
  assert.match(ts, /export interface HomePage/)
  assert.match(ts, /greeting: string/)
  assert.match(ts, /"harbor.home": HomePage/)
  assert.match(ts, /export interface HarborActions/)
  assert.match(ts, /"harbor.setName": \{ in: SetNameIn; out: SetNameOut \}/)
})

test("scaffoldPack writes svelte pages from a schema file", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-"))
  const schemaFile = join(root, "schema.json")
  writeFileSync(schemaFile, JSON.stringify(schema))
  const out = join(root, "pack")
  const written = await scaffoldPack({
    outDir: out,
    schemaPath: schemaFile,
    id: "harbor",
  })
  assert.ok(written.includes("src/pages/harbor/home/+page.svelte"))
  assert.ok(written.includes("src/pages/harbor/notFound/+page.svelte"))
  const page = readFileSync(join(out, "src/pages/harbor/home/+page.svelte"), "utf8")
  assert.match(page, /page<HomePage>/)
  assert.match(page, /from "\.\.\/\.\.\/\.\.\/lib\/page-types"/)
  const vite = readFileSync(join(out, "vite.config.ts"), "utf8")
  assert.match(vite, /notFound: "harbor.notFound"/)
  assert.ok(existsSync(join(out, "src/lib/page-types.json")))
  assert.ok(existsSync(join(out, "src/bootstrap.ts")))
})

test("scaffoldPack refuses to overwrite without --force", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-"))
  await scaffoldPack({ outDir: root, schema, id: "demo" })
  await assert.rejects(
    () => scaffoldPack({ outDir: root, schema, id: "demo" }),
    /exists/,
  )
})

test("scaffoldPack writes published @kolektiv versions instead of workspace protocol", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-"))
  const out = join(root, "pack")
  await scaffoldPack({ outDir: out, schema, id: "harbor" })
  const source = readFileSync(join(out, "package.json"), "utf8")
  assert.doesNotMatch(source, /workspace:/)
  const manifest = JSON.parse(source) as {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }
  assert.equal(manifest.dependencies["@kolektiv/keel"], ownPackage.version)
  assert.equal(manifest.dependencies["@kolektiv/keel-svelte"], ownPackage.version)
  assert.equal(manifest.devDependencies["@kolektiv/keel-pack"], ownPackage.version)
  assert.match(manifest.dependencies["@kolektiv/keel"], semver)
  assert.match(manifest.dependencies["@kolektiv/keel-svelte"], semver)
  assert.match(manifest.devDependencies["@kolektiv/keel-pack"], semver)
  assert.equal(manifest.dependencies.svelte, "^5.16.0")
  assert.equal(manifest.devDependencies.vite, "^6.2.0")
})

test("scaffold CLI rejects --framework react before writing files", () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-"))
  const schemaFile = join(root, "schema.json")
  writeFileSync(schemaFile, JSON.stringify(schema))
  const out = join(root, "pack")
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", cliPath, "--schema", schemaFile, "--framework", "react", out],
    { encoding: "utf8" },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /React packs are not generated yet/)
  assert.match(result.stderr, /use --framework svelte/)
  assert.equal(existsSync(out), false)
})

test("scaffold CLI writes a standalone package.json", () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-"))
  const schemaFile = join(root, "schema.json")
  writeFileSync(schemaFile, JSON.stringify(schema))
  const out = join(root, "pack")
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", cliPath, "--schema", schemaFile, "--id", "demo", out],
    { encoding: "utf8" },
  )
  assert.equal(result.status, 0, result.stderr)
  const source = readFileSync(join(out, "package.json"), "utf8")
  assert.doesNotMatch(source, /workspace:/)
  assert.match(source, new RegExp(`"@kolektiv/keel": "${ownPackage.version}"`))
})

test("react framework is reserved", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-"))
  await assert.rejects(
    () => scaffoldPack({ outDir: root, schema, framework: "react" }),
    /not generated yet/,
  )
})
