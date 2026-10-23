import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { realtime, type RealtimeMessage } from "@kolektiv/keel"
import { html, LitElement } from "lit"
import { useKeelEvent } from "../dist/index.js"
import { host } from "./helpers.ts"

interface Captured {
  event: string
  handler: (data: unknown, message: RealtimeMessage) => void
}

class EventProbe extends LitElement {
  readonly seen: string[] = []

  constructor() {
    super()
    useKeelEvent<{ text: string }>(this, "harbor.message", (data) => {
      this.seen.push(data.text)
    })
  }

  render() {
    return html`<span>probe</span>`
  }
}

customElements.define("test-event-probe", EventProbe)

test("useKeelEvent holds the subscription for the element lifetime", async () => {
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
    const view = host()
    const element = document.createElement("test-event-probe") as EventProbe
    view.append(element)
    await element.updateComplete

    assert.equal(captured.length, 1)
    assert.equal(captured[0].event, "harbor.message")
    captured[0].handler(
      { text: "one" },
      { event: "harbor.message", channel: "page:harbor.home", data: { text: "one" }, id: null },
    )
    assert.deepEqual(element.seen, ["one"])

    element.remove()
    assert.equal(released, 1)
  } finally {
    ;(realtime as { on: typeof realtime.on }).on = originalOn
  }
})
