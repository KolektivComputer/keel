import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, type NavigationGuard } from "@kolektiv/keel"
import { h } from "preact"
import { useNavigationGuard, useUnloadGuard } from "../dist/index.js"
import { render } from "./helpers.ts"

test("useNavigationGuard registers on mount and unregisters on unmount", async () => {
  const events: string[] = []
  const original = router.beforeEach
  const guard: NavigationGuard = () => true
  router.beforeEach = (registered: NavigationGuard) => {
    events.push(registered === guard ? "register" : "register-other")
    return () => events.push("unregister")
  }
  try {
    const view = await render(
      h(() => {
        useNavigationGuard(guard)
        return null
      }),
    )
    assert.deepEqual(events, ["register"])

    await view.unmount()
    assert.deepEqual(events, ["register", "unregister"])
  } finally {
    router.beforeEach = original
  }
})

test("useUnloadGuard attaches and removes beforeunload, gated by the predicate", async () => {
  const added: Array<(event: Event) => void> = []
  const removed: Array<(event: Event) => void> = []
  const originalAdd = window.addEventListener.bind(window)
  const originalRemove = window.removeEventListener.bind(window)
  window.addEventListener = ((type: string, listener: EventListener) => {
    if (type === "beforeunload") added.push(listener as (event: Event) => void)
    return originalAdd(type, listener)
  }) as typeof window.addEventListener
  window.removeEventListener = ((type: string, listener: EventListener) => {
    if (type === "beforeunload") removed.push(listener as (event: Event) => void)
    return originalRemove(type, listener)
  }) as typeof window.removeEventListener

  let dirty = false
  try {
    const view = await render(
      h(() => {
        useUnloadGuard(() => dirty)
        return null
      }),
    )

    assert.equal(added.length, 1)
    const listener = added[0]!
    let prevented = 0
    const event = {
      preventDefault() {
        prevented += 1
      },
      returnValue: "keep",
    }
    listener(event as unknown as Event)
    assert.equal(prevented, 0)
    assert.equal(event.returnValue, "keep")

    dirty = true
    listener(event as unknown as Event)
    assert.equal(prevented, 1)
    assert.equal(event.returnValue, "")

    await view.unmount()
    assert.equal(removed.length, 1)
    assert.equal(removed[0], listener)
  } finally {
    window.addEventListener = originalAdd
    window.removeEventListener = originalRemove
  }
})
