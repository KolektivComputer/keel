import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { supportedFrameworks } from "./registry.ts"
import { originFromHost, schemaUrl } from "./schema.ts"
import { emitTypescript, scaffoldFrameworks, scaffoldPack, type ScaffoldFramework } from "./scaffold.ts"

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

interface FrameworkConventions {
  page: string
  layout: string
  id: string
  head?: string
  runtime: string
  plugin?: string
  pluginImport?: string
}

const MATRIX: Record<ScaffoldFramework, FrameworkConventions> = {
  svelte: {
    page: "+page.svelte",
    layout: "+layout.svelte",
    id: "+page.ts",
    runtime: "@kolektiv/keel-svelte",
    plugin: "svelte()",
    pluginImport: "@sveltejs/vite-plugin-svelte",
  },
  react: {
    page: "+page.tsx",
    layout: "+layout.tsx",
    id: "+page.ts",
    head: "+head.html",
    runtime: "@kolektiv/keel-react",
    plugin: "react()",
    pluginImport: "@vitejs/plugin-react",
  },
  vue: {
    page: "+page.vue",
    layout: "+layout.vue",
    id: "+page.ts",
    head: "+head.html",
    runtime: "@kolektiv/keel-vue",
    plugin: "vue()",
    pluginImport: "@vitejs/plugin-vue",
  },
  solid: {
    page: "+page.tsx",
    layout: "+layout.tsx",
    id: "+page.ts",
    head: "+head.html",
    runtime: "@kolektiv/keel-solid",
    plugin: "solid()",
    pluginImport: "vite-plugin-solid",
  },
  preact: {
    page: "+page.tsx",
    layout: "+layout.tsx",
    id: "+page.ts",
    head: "+head.html",
    runtime: "@kolektiv/keel-preact",
    plugin: "preact()",
    pluginImport: "@preact/preset-vite",
  },
  lit: {
    page: "+page.ts",
    layout: "+layout.ts",
    id: "+page.id.ts",
    head: "+head.html",
    runtime: "@kolektiv/keel-lit",
  },
  angular: {
    page: "+page.ts",
    layout: "+layout.ts",
    id: "+page.id.ts",
    head: "+head.html",
    runtime: "@kolektiv/keel-angular",
    plugin: 'analog({ tsconfig: "tsconfig.app.json" })',
    pluginImport: "@analogjs/vite-plugin-angular",
  },
}

function expectedFiles(framework: ScaffoldFramework): string[] {
  const conventions = MATRIX[framework]
  const files = [
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "src/env.d.ts",
    "src/bootstrap.ts",
    "src/styles.css",
    "src/lib/page-types.ts",
    "src/lib/page-types.json",
    `src/pages/${conventions.layout}`,
  ]
  if (framework === "svelte") files.push("svelte.config.js")
  if (framework === "angular") files.push("tsconfig.app.json")
  for (const dir of ["harbor/home", "harbor/notFound"]) {
    files.push(`src/pages/${dir}/${conventions.id}`, `src/pages/${dir}/${conventions.page}`)
    if (conventions.head) files.push(`src/pages/${dir}/${conventions.head}`)
  }
  return files.sort()
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

test("scaffold providers cover the keel-pack framework registry", () => {
  assert.deepEqual(scaffoldFrameworks, supportedFrameworks)
  assert.deepEqual([...scaffoldFrameworks].sort(), [
    "angular",
    "lit",
    "preact",
    "react",
    "solid",
    "svelte",
    "vue",
  ])
})

test("scaffoldPack rejects an unknown framework before writing files", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-"))
  const out = join(root, "pack")
  await assert.rejects(
    () => scaffoldPack({ outDir: out, schema, framework: "qwik" as unknown as ScaffoldFramework }),
    /unsupported framework 'qwik'/,
  )
  assert.equal(existsSync(out), false)
})

test("svelte provider output keeps its pre-provider bytes", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-"))
  const out = join(root, "pack")
  await scaffoldPack({ outDir: out, schema, id: "harbor" })
  assert.equal(
    readFileSync(join(out, "vite.config.ts"), "utf8"),
    `import { svelte } from "@sveltejs/vite-plugin-svelte"
import { keelPack } from "@kolektiv/keel-pack/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    svelte(),
    keelPack({
      id: "harbor",
      version: "0.1.0",
      framework: "svelte",
      pagesDir: "src/pages",
      bootstrap: "src/bootstrap.ts",
      contract: "src/lib/page-types.json",
      notFound: "harbor.notFound",
      pack: "dist/harbor.feb",
    }),
  ],
})
`,
  )
  assert.equal(
    readFileSync(join(out, "src/pages/harbor/home/+page.svelte"), "utf8"),
    `<script lang="ts">
  import { Head, page } from "@kolektiv/keel-svelte"
  import type { HomePage } from "../../../lib/page-types"

  const ctx = page<HomePage>()
</script>

<Head />

<p class="lede">harbor.home · <code>/</code></p>
<pre>{JSON.stringify(ctx.data, null, 2)}</pre>
`,
  )
})

test("react provider pages use the usePage hook", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-react-"))
  const out = join(root, "pack")
  await scaffoldPack({ outDir: out, schema, id: "harbor", framework: "react" })
  const page = readFileSync(join(out, "src/pages/harbor/home/+page.tsx"), "utf8")
  assert.match(page, /import \{ Head, usePage \} from "@kolektiv\/keel-react"/)
  assert.match(page, /const seed = usePage<HomePage>\(\)/)
  assert.match(page, /seed\.data/)
  assert.doesNotMatch(page, /\bpage<HomePage>/)
  const layout = readFileSync(join(out, "src/pages/+layout.tsx"), "utf8")
  assert.match(layout, /children: ReactNode/)
  const bootstrap = readFileSync(join(out, "src/bootstrap.ts"), "utf8")
  assert.equal(bootstrap, `import { bootstrap } from "@kolektiv/keel-react"\n\nvoid bootstrap()\n`)
})

test("vue provider pages use the usePage composable", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-vue-"))
  const out = join(root, "pack")
  await scaffoldPack({ outDir: out, schema, id: "harbor", framework: "vue" })
  const page = readFileSync(join(out, "src/pages/harbor/home/+page.vue"), "utf8")
  assert.match(page, /import \{ Head, usePage \} from "@kolektiv\/keel-vue"/)
  assert.match(page, /const seed = usePage<HomePage>\(\)/)
  assert.match(page, /seed\.data/)
  assert.doesNotMatch(page, /\bpage<HomePage>/)
  const layout = readFileSync(join(out, "src/pages/+layout.vue"), "utf8")
  assert.match(layout, /<slot \/>/)
  const bootstrap = readFileSync(join(out, "src/bootstrap.ts"), "utf8")
  assert.equal(bootstrap, `import { bootstrap } from "@kolektiv/keel-vue"\n\nvoid bootstrap()\n`)
})

test("solid provider pages use the usePage accessor", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-solid-"))
  const out = join(root, "pack")
  await scaffoldPack({ outDir: out, schema, id: "harbor", framework: "solid" })
  const page = readFileSync(join(out, "src/pages/harbor/home/+page.tsx"), "utf8")
  assert.match(page, /import \{ Head, usePage \} from "@kolektiv\/keel-solid"/)
  assert.match(page, /const page = usePage<HomePage>\(\)/)
  assert.match(page, /page\(\)\.data/)
  assert.doesNotMatch(page, /\bpage<HomePage>/)
  const layout = readFileSync(join(out, "src/pages/+layout.tsx"), "utf8")
  assert.match(layout, /children: JSX.Element/)
  const bootstrap = readFileSync(join(out, "src/bootstrap.ts"), "utf8")
  assert.equal(bootstrap, `import { bootstrap } from "@kolektiv/keel-solid"\n\nvoid bootstrap()\n`)
})

test("preact provider pages use the usePage hook", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-preact-"))
  const out = join(root, "pack")
  await scaffoldPack({ outDir: out, schema, id: "harbor", framework: "preact" })
  const page = readFileSync(join(out, "src/pages/harbor/home/+page.tsx"), "utf8")
  assert.match(page, /import \{ Head, usePage \} from "@kolektiv\/keel-preact"/)
  assert.match(page, /const seed = usePage<HomePage>\(\)/)
  assert.match(page, /seed\.data/)
  assert.doesNotMatch(page, /\bpage<HomePage>/)
  const layout = readFileSync(join(out, "src/pages/+layout.tsx"), "utf8")
  assert.match(layout, /children: ComponentChildren/)
  const bootstrap = readFileSync(join(out, "src/bootstrap.ts"), "utf8")
  assert.equal(bootstrap, `import { bootstrap } from "@kolektiv/keel-preact"\n\nvoid bootstrap()\n`)
})

test("lit provider pages extend the KeelElement base class", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-lit-"))
  const out = join(root, "pack")
  await scaffoldPack({ outDir: out, schema, id: "harbor", framework: "lit" })
  const page = readFileSync(join(out, "src/pages/harbor/home/+page.ts"), "utf8")
  assert.match(page, /import \{ html \} from "lit"/)
  assert.match(page, /import \{ KeelElement \} from "@kolektiv\/keel-lit"/)
  assert.match(page, /export default class Page extends KeelElement<HomePage>/)
  assert.match(page, /this\.page\.data/)
  assert.doesNotMatch(page, /\bpage<HomePage>/)
  const layout = readFileSync(join(out, "src/pages/+layout.ts"), "utf8")
  assert.match(layout, /import \{ KeelElement \} from "@kolektiv\/keel-lit"/)
  assert.match(layout, /export default class Layout extends KeelElement/)
  assert.match(layout, /<slot><\/slot>/)
  const bootstrap = readFileSync(join(out, "src/bootstrap.ts"), "utf8")
  assert.equal(bootstrap, `import { bootstrap } from "@kolektiv/keel-lit"\n\nvoid bootstrap()\n`)
  const manifest = JSON.parse(readFileSync(join(out, "package.json"), "utf8")) as {
    dependencies: Record<string, string>
  }
  assert.equal(manifest.dependencies["@kolektiv/keel-lit"], ownPackage.version)
  assert.equal(manifest.dependencies.lit, "^3.2.1")
  assert.equal(manifest.dependencies["@tanstack/query-core"], "^5.66.0")
  assert.equal(manifest.dependencies["@tanstack/lit-query"], undefined)
})

test("angular provider pages use the injectKeelPage signal", async () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-angular-"))
  const out = join(root, "pack")
  await scaffoldPack({ outDir: out, schema, id: "harbor", framework: "angular" })
  const page = readFileSync(join(out, "src/pages/harbor/home/+page.ts"), "utf8")
  assert.match(page, /import \{ injectKeelPage \} from "@kolektiv\/keel-angular"/)
  assert.match(page, /readonly page = injectKeelPage<HomePage>\(\)/)
  assert.match(page, /page\(\)\.data/)
  assert.doesNotMatch(page, /\bpage<HomePage>/)
  const layout = readFileSync(join(out, "src/pages/+layout.ts"), "utf8")
  assert.match(layout, /standalone: true/)
  assert.match(layout, /<ng-content \/>/)
  const tsconfig = readFileSync(join(out, "tsconfig.app.json"), "utf8")
  assert.match(tsconfig, /"extends": "\.\/tsconfig\.json"/)
  assert.match(tsconfig, /"noEmit": false/)
  const vite = readFileSync(join(out, "vite.config.ts"), "utf8")
  assert.match(vite, /analog\(\{ tsconfig: "tsconfig\.app\.json" \}\)/)
  const bootstrap = readFileSync(join(out, "src/bootstrap.ts"), "utf8")
  assert.equal(bootstrap, `import { bootstrap } from "@kolektiv/keel-angular"\n\nvoid bootstrap()\n`)
  const manifest = JSON.parse(readFileSync(join(out, "package.json"), "utf8")) as {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }
  assert.equal(manifest.dependencies["@kolektiv/keel-angular"], ownPackage.version)
  assert.equal(manifest.dependencies["@tanstack/angular-query-experimental"], "^5.66.0")
  assert.equal(manifest.dependencies["@angular/core"], "^19.0.0")
  assert.equal(manifest.devDependencies["@analogjs/vite-plugin-angular"], "^1.10.0")
  assert.equal(manifest.devDependencies["@angular/build"], "^19.0.0")
  assert.equal(manifest.devDependencies.typescript, "~5.8.3")
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

test("scaffoldPack generates the per-framework file matrix", async () => {
  for (const framework of scaffoldFrameworks) {
    const conventions = MATRIX[framework]
    const root = mkdtempSync(join(tmpdir(), `keel-scaffold-${framework}-`))
    const out = join(root, "pack")
    const written = await scaffoldPack({ outDir: out, schema, id: "harbor", framework })
    assert.deepEqual([...written].sort(), expectedFiles(framework), `${framework} file list`)

    const app = join(out, "src/pages/harbor/home")
    assert.equal(readFileSync(join(app, conventions.id), "utf8"), 'export const id = "harbor.home"\n')
    assert.ok(existsSync(join(out, "src/pages", conventions.layout)), `${framework} root layout`)
    if (conventions.head) {
      assert.equal(readFileSync(join(app, conventions.head), "utf8"), "<title>{seed.data.greeting}</title>\n")
    } else {
      assert.equal(existsSync(join(app, "+head.html")), false)
      assert.equal(existsSync(join(app, "+head.svelte")), false)
    }

    const manifestSource = readFileSync(join(out, "package.json"), "utf8")
    assert.doesNotMatch(manifestSource, /workspace:/, `${framework} package.json`)
    const manifest = JSON.parse(manifestSource) as {
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    for (const [name, range] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
      if (name.startsWith("@kolektiv/")) {
        assert.equal(range, ownPackage.version, `${framework} ${name}`)
      }
    }
    assert.equal(manifest.dependencies["@kolektiv/keel"], ownPackage.version)
    assert.equal(manifest.dependencies[conventions.runtime], ownPackage.version)
    assert.equal(manifest.devDependencies["@kolektiv/keel-pack"], ownPackage.version)

    const vite = readFileSync(join(out, "vite.config.ts"), "utf8")
    assert.match(vite, new RegExp(`framework: "${framework}"`), `${framework} keelPack framework`)
    assert.match(vite, /notFound: "harbor\.notFound"/, `${framework} notFound`)
    if (conventions.plugin && conventions.pluginImport) {
      assert.ok(vite.includes(conventions.pluginImport), `${framework} plugin import`)
      assert.ok(vite.includes(`${conventions.plugin},`), `${framework} plugin call`)
    }
    if (framework === "angular") {
      assert.ok(vite.indexOf("analog()") < vite.indexOf("keelPack("), "Angular plugin runs first")
    }

    const bootstrap = readFileSync(join(out, "src/bootstrap.ts"), "utf8")
    assert.equal(bootstrap, `import { bootstrap } from "${conventions.runtime}"\n\nvoid bootstrap()\n`)
  }
})

test("scaffold CLI rejects an unknown framework before writing files", () => {
  const root = mkdtempSync(join(tmpdir(), "keel-scaffold-"))
  const schemaFile = join(root, "schema.json")
  writeFileSync(schemaFile, JSON.stringify(schema))
  const out = join(root, "pack")
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", cliPath, "--schema", schemaFile, "--framework", "qwik", out],
    { encoding: "utf8" },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unsupported framework 'qwik'/)
  assert.match(result.stderr, /angular, lit, preact, react, solid, svelte, vue/)
  assert.equal(existsSync(out), false)
})

test("scaffold CLI accepts every supported framework", () => {
  for (const framework of scaffoldFrameworks) {
    const root = mkdtempSync(join(tmpdir(), `keel-scaffold-cli-${framework}-`))
    const schemaFile = join(root, "schema.json")
    writeFileSync(schemaFile, JSON.stringify(schema))
    const out = join(root, "pack")
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", cliPath, "--schema", schemaFile, "--framework", framework, out],
      { encoding: "utf8" },
    )
    assert.equal(result.status, 0, result.stderr)
    assert.ok(existsSync(join(out, "package.json")), `${framework} package.json`)
    assert.ok(existsSync(join(out, "src/pages", MATRIX[framework].layout)), `${framework} layout`)
  }
})

test("scaffold CLI --help lists every supported framework", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, "--help"], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  for (const framework of scaffoldFrameworks) {
    assert.ok(result.stdout.includes(framework), `${framework} in --help`)
  }
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
