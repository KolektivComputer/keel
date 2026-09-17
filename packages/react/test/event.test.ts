import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { act, createElement } from "react"
import { realtime, type RealtimeMessage } from "@kolektiv/keel"
import { useKeelEvent } from "../dist/index.js"
import { render } from "./helpers.ts"

interface Captured {
  event: string
  handler: (data: unknown, message: RealtimeMessage) => void
}

const message = (text: string): RealtimeMessage<{ text: string }> => ({
  event: "harbor.message",
  channel: "page:harbor.home",
  data: { text },
  id: null,
})

test("useKeelEvent subscribes once, keeps the latest handler, and releases on unmount", async () => {
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
    captured[0].handler({ text: "one" }, message("one"))

    await act(async () => {
      mounted.root.render(createElement(Probe, { label: "b" }))
    })
    assert.equal(captured.length, 1)
    captured[0].handler({ text: "two" }, message("two"))
    assert.deepEqual(seen, ["a:one", "b:two"])

    await mounted.unmount()
    assert.equal(released, 1)
  } finally {
    ;(realtime as { on: typeof realtime.on }).on = originalOn
  }
})
