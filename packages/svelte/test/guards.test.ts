import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { test } from "node:test"
import { compileModule } from "svelte/compiler"
import { effect_root } from "svelte/internal/client"
import { router, type NavigationGuard } from "@kolektiv/keel"

interface GuardsModule {
  useNavigationGuard: (guard: NavigationGuard) => void
  useUnloadGuard: (isDirty: () => boolean) => void
}

async function loadGuards(): Promise<GuardsModule> {
  const source = readFileSync(new URL("../dist/guards.svelte.js", import.meta.url), "utf8")
  const compiled = compileModule(source, { filename: "guards.svelte.js", generate: "client" })
  const dir = join(dirname(fileURLToPath(import.meta.url)), ".compiled")
  mkdirSync(dir, { recursive: true })
  const out = join(dir, "guards.js")
  writeFileSync(out, compiled.js.code)
  return (await import(`${pathToFileURL(out).href}?t=${Date.now()}`)) as GuardsModule
}

class FakeWindow {
  listeners = new Map<string, Set<(event: unknown) => void>>()

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener)
  }
}

async function flushEffects(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

test("useNavigationGuard registers on mount and unregisters on destroy", async () => {
  const { useNavigationGuard } = await loadGuards()
  const original = router.beforeEach
  const events: string[] = []
  router.beforeEach = () => {
    events.push("register")
    return () => events.push("unregister")
  }
  try {
    const destroy = effect_root(() => {
      useNavigationGuard(() => false)
    })
    await flushEffects()
    assert.deepEqual(events, ["register"])
    destroy()
    assert.deepEqual(events, ["register", "unregister"])
  } finally {
    router.beforeEach = original
  }
})

test("useUnloadGuard attaches and removes beforeunload, gated by the predicate", async () => {
  const { useUnloadGuard } = await loadGuards()
  const win = new FakeWindow()
  ;(globalThis as { window?: unknown }).window = win
  let dirty = false
  try {
    const destroy = effect_root(() => {
      useUnloadGuard(() => dirty)
    })
    await flushEffects()
    const listener = [...(win.listeners.get("beforeunload") ?? [])][0]
    assert.ok(listener)
    let prevented = 0
    const event = {
      preventDefault() {
        prevented += 1
      },
      returnValue: "keep",
    }
    dirty = true
    listener(event)
    assert.equal(prevented, 1)
    assert.equal(event.returnValue, "")
    dirty = false
    listener(event)
    assert.equal(prevented, 1)
    destroy()
    assert.equal(win.listeners.get("beforeunload")?.size ?? 0, 0)
  } finally {
    delete (globalThis as { window?: unknown }).window
  }
})
