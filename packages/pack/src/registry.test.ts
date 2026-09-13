import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import type { RouterAdapter } from "./adapter.ts"
import { routerFor, supportedFrameworks } from "./registry.ts"
import { keelPack } from "./vite.ts"

function writeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "keel-registry-"))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

type ConfigHook = (config: { root: string }) => unknown

function runConfig(plugin: ReturnType<typeof keelPack>, root: string): { build?: { lib?: { entry?: Record<string, string> } } } {
  return (plugin.config as ConfigHook)({ root }) as { build?: { lib?: { entry?: Record<string, string> } } }
}

test("routerFor resolves every supported framework", () => {
  assert.deepEqual(supportedFrameworks, ["angular", "lit", "preact", "react", "solid", "svelte", "vue"])
  for (const name of supportedFrameworks) {
    assert.equal(routerFor(name).name, name)
  }
})

test("routerFor lists supported frameworks for unknown names", () => {
  assert.throws(() => routerFor("qwik"), /no router for framework 'qwik'/)
  assert.throws(() => routerFor("qwik"), /angular, lit, preact, react, solid, svelte, vue/)
  assert.throws(() => routerFor("qwik"), /pass router/)
})

test("keelPack resolves a non-Svelte framework through the registry", () => {
  const root = writeTree({
    "src/bootstrap.ts": "// bootstrap\n",
    "src/pages/home/+page.tsx": "// home\n",
  })
  const plugin = keelPack({
    id: "demo",
    version: "0.1.0",
    framework: "react",
    pagesDir: "src/pages",
    bootstrap: "src/bootstrap.ts",
  })
  const config = runConfig(plugin, root)
  assert.ok(config.build?.lib?.entry?.["pages/home"])
})

test("keelPack throws an unknown framework before discovery", () => {
  const root = writeTree({
    "src/bootstrap.ts": "// bootstrap\n",
    "src/pages/home/+page.tsx": "// home\n",
  })
  const plugin = keelPack({
    id: "demo",
    version: "0.1.0",
    framework: "qwik",
    pagesDir: "src/pages",
    bootstrap: "src/bootstrap.ts",
  })
  assert.throws(() => runConfig(plugin, root), /supported frameworks/)
})

test("keelPack prefers a caller-supplied router over the registry", () => {
  const root = writeTree({
    "src/bootstrap.ts": "// bootstrap\n",
    "src/pages/+page.svelte": "<!-- no id override, default adapter would throw -->\n",
  })
  let discovered = false
  const router: RouterAdapter = {
    name: "custom",
    discover() {
      discovered = true
      return [{ id: "home", file: "/virtual/home", layouts: [] }]
    },
    entrySource() {
      return "export const mount = () => {}\n"
    },
  }
  const plugin = keelPack({
    id: "demo",
    version: "0.1.0",
    framework: "svelte",
    pagesDir: "src/pages",
    bootstrap: "src/bootstrap.ts",
    router,
  })
  const config = runConfig(plugin, root)
  assert.equal(discovered, true)
  assert.ok(config.build?.lib?.entry?.["pages/home"])
})
