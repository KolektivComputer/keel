import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { realtime, type RealtimeMessage } from "@kolektiv/keel"
import { injectKeelEvent } from "../dist/index.js"
import { createPage } from "../dist/mount.js"
import { context, host, jit } from "./helpers.ts"

interface Captured {
  event: string
  handler: (data: unknown, message: RealtimeMessage) => void
}

let probe: { seen: string[] } | undefined

const EventProbe = jit({
  selector: "keel-test-event-probe",
  template: `<p>probe</p>`,
})(class {
  readonly seen: string[] = []

  constructor() {
    injectKeelEvent<{ text: string }>("harbor.message", (data) => {
      this.seen.push(data.text)
    })
    probe = this
  }
})

test("injectKeelEvent releases when the injector is destroyed", async () => {
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
    const element = host()
    const page = createPage(EventProbe)
    await page.mount(element, context("/"))

    assert.equal(captured.length, 1)
    assert.equal(captured[0].event, "harbor.message")
    captured[0].handler(
      { text: "one" },
      { event: "harbor.message", channel: "page:harbor.home", data: { text: "one" }, id: null },
    )
    assert.deepEqual(probe?.seen, ["one"])

    await page.unmount()
    assert.equal(released, 1)
  } finally {
    ;(realtime as { on: typeof realtime.on }).on = originalOn
  }
})
