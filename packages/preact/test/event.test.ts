import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "preact"
import { realtime, type RealtimeMessage } from "@kolektiv/keel"
import { useKeelEvent } from "../dist/index.js"
import { render } from "./helpers.ts"

interface Captured {
  event: string
  handler: (data: unknown, message: RealtimeMessage) => void
}

test("useKeelEvent subscribes on mount and releases on unmount", async () => {
  const captured: Captured[] = []
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
    function Probe({ label }: { label: string }) {
      useKeelEvent<{ text: string }>("harbor.message", (data) => {
        seen.push(`${label}:${data.text}`)
      })
      return createElement("span", null, label)
    }

    const mounted = await render(createElement(Probe, { label: "a" }))
    assert.equal(captured.length, 1)
    assert.equal(captured[0].event, "harbor.message")
    captured[0].handler(
      { text: "one" },
      { event: "harbor.message", channel: "page:harbor.home", data: { text: "one" }, id: null },
    )
    assert.deepEqual(seen, ["a:one"])

    await mounted.unmount()
    assert.equal(released, 1)
  } finally {
    ;(realtime as { on: typeof realtime.on }).on = originalOn
  }
})
