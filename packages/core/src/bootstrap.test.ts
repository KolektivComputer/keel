import assert from "node:assert/strict"
import { test } from "node:test"
import { cacheSeed } from "./prefetch.ts"
import { bootstrap, router } from "./router.ts"
import type { KeelSeed, PageContext } from "./types.ts"

type Call = [string, unknown]

const ENTRY =
  "data:text/javascript," +
  encodeURIComponent(
    [
      "export function mount(host, ctx) { (globalThis.__keelCalls ??= []).push(['mount', ctx]) }",
      "export function unmount() { (globalThis.__keelCalls ??= []).push(['unmount']) }",
      "export function update(ctx) { (globalThis.__keelCalls ??= []).push(['update', ctx]) }",
    ].join("\n"),
  )

function seed(overrides: Partial<KeelSeed> = {}): KeelSeed {
  return {
    v: 1,
    page: "harbor.home",
    path: "/",
    params: {},
    data: { title: "Home" },
    errors: {},
    theme: { id: "harbor", version: "1" },
    entry: ENTRY,
    css: [],
    host: "#__keel_root",
    ...overrides,
  }
}

function resetCalls(): Call[] {
  const calls: Call[] = []
  ;(globalThis as { __keelCalls?: Call[] }).__keelCalls = calls
  return calls
}

interface FakeDom {
  host: Element
  restore(): void
}

function installDom(seedJson: string | null = null): FakeDom {
  const host = { tagName: "DIV" }
  const documentFake = {
    head: { querySelectorAll: () => [], appendChild: () => undefined },
    title: "",
    getElementById: (id: string) => (id === "__keel_seed" && seedJson !== null ? { textContent: seedJson } : null),
    querySelector: (selector: string) => (selector === "#__keel_root" ? host : null),
    createElement: () => ({ setAttribute() {}, style: {}, remove() {} }),
    dispatchEvent: () => true,
    addEventListener: () => undefined,
  }
  const windowFake = {
    scrollX: 0,
    scrollY: 0,
    scrollTo: () => undefined,
    addEventListener: () => undefined,
  }
  const globals = globalThis as Record<string, unknown>
  const previous = { document: globals.document, window: globals.window }
  globals.document = documentFake
  globals.window = windowFake
  return {
    host: host as unknown as Element,
    restore() {
      if (previous.document === undefined) delete globals.document
      else globals.document = previous.document
      if (previous.window === undefined) delete globals.window
      else globals.window = previous.window
    },
  }
}

test("bootstrap applies the embedded seed through onSeed before mount", async () => {
  const calls = resetCalls()
  const dom = installDom(JSON.stringify(seed()))
  const phases: string[] = []
  try {
    await bootstrap({
      host: dom.host,
      focusOnNavigate: false,
      onSeed(_seed, phase) {
        phases.push(phase)
        calls.push(["seed", phase])
      },
    })
  } finally {
    dom.restore()
  }

  assert.deepEqual(phases, ["initial"])
  assert.equal(calls[0]?.[0], "seed")
  assert.equal(calls[1]?.[0], "mount")
  const ctx = calls[1]?.[1] as PageContext
  assert.equal(ctx.page, "harbor.home")
  assert.deepEqual(ctx.data, { title: "Home" })
  assert.equal(typeof ctx.navigate, "function")
})

test("visits call onSeed and forward the context to update", async () => {
  const calls = resetCalls()
  const dom = installDom(JSON.stringify(seed()))
  const phases: string[] = []
  const next = seed({ path: "/next", data: { title: "Next" } })
  try {
    await bootstrap({ host: dom.host, focusOnNavigate: false })
    router.configure({
      onSeed(_seed, phase) {
        phases.push(phase)
      },
    })
    cacheSeed("/next", next)
    await router.visit("/next", { preserveState: true })
  } finally {
    dom.restore()
  }

  assert.deepEqual(phases, ["visit"])
  const update = calls.find((call) => call[0] === "update")
  assert.ok(update, "expected the page module update to run")
  const ctx = update[1] as PageContext
  assert.equal(ctx.page, "harbor.home")
  assert.equal(ctx.path, "/next")
  assert.equal(ctx.data, next.data)
  assert.equal(typeof ctx.navigate, "function")
})
