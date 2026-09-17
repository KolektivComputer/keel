import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { test } from "node:test"
import { compileModule } from "svelte/compiler"
import { effect_root } from "svelte/internal/client"
import { realtime, type RealtimeMessage } from "@kolektiv/keel"

interface EventModule {
  useKeelEvent: (event: string, handler: (data: unknown, message: RealtimeMessage) => void) => void
}

async function loadEventModule(): Promise<EventModule> {
  const source = readFileSync(new URL("../dist/event.svelte.js", import.meta.url), "utf8")
  const compiled = compileModule(source, { filename: "event.svelte.js", generate: "client" })
  const dir = join(dirname(fileURLToPath(import.meta.url)), ".compiled")
  mkdirSync(dir, { recursive: true })
  const out = join(dir, "event.js")
  writeFileSync(out, compiled.js.code)
  return (await import(`${pathToFileURL(out).href}?t=${Date.now()}`)) as EventModule
}

async function flushEffects(): Promise<void> {
  await Promise.resolve()
}

test("useKeelEvent subscribes in an effect and cleans up when the root is destroyed", async () => {
  const { useKeelEvent } = await loadEventModule()
  const captured: Array<{ event: string; handler: (data: unknown, message: RealtimeMessage) => void }> = []
  let released = 0
  const originalOn = realtime.on
  ;(realtime as { on: typeof realtime.on }).on = ((event: string, handler: never) => {
    captured.push({ event, handler })
    return () => {
      released += 1
    }
  }) as typeof realtime.on

  try {
    const seen: string[] = []
    const destroy = effect_root(() => {
      useKeelEvent("harbor.message", (data: { text: string }) => {
        seen.push(data.text)
      })
    })
    await flushEffects()

    assert.equal(captured.length, 1)
    assert.equal(captured[0].event, "harbor.message")
    captured[0].handler(
      { text: "one" },
      { event: "harbor.message", channel: "page:harbor.home", data: { text: "one" }, id: null },
    )
    assert.deepEqual(seen, ["one"])

    destroy()
    await flushEffects()
    assert.equal(released, 1)
  } finally {
    ;(realtime as { on: typeof realtime.on }).on = originalOn
  }
})
