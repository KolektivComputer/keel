import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, type NavigationGuard } from "@kolektiv/keel"
import { LitElement, nothing } from "lit"
import { useNavigationGuard, useUnloadGuard } from "../dist/index.js"
import { host } from "./helpers.ts"

class GuardProbe extends LitElement {
  static guard: NavigationGuard = () => true
  readonly registered = useNavigationGuard(this, GuardProbe.guard)
  render() {
    return nothing
  }
}

class UnloadProbe extends LitElement {
  static dirty = () => false
  readonly unload = useUnloadGuard(this, UnloadProbe.dirty)
  render() {
    return nothing
  }
}

customElements.define("test-guard-probe", GuardProbe)
customElements.define("test-unload-probe", UnloadProbe)

test("useNavigationGuard registers on connect and unregisters on disconnect", async () => {
  const events: string[] = []
  const original = router.beforeEach
  const guard: NavigationGuard = () => true
  GuardProbe.guard = guard
  router.beforeEach = (registered: NavigationGuard) => {
    events.push(registered === guard ? "register" : "register-other")
    return () => events.push("unregister")
  }
  try {
    const view = host()
    const probe = document.createElement("test-guard-probe") as GuardProbe
    view.append(probe)
    await probe.updateComplete
    assert.deepEqual(events, ["register"])

    view.remove()
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
  UnloadProbe.dirty = () => dirty
  try {
    const view = host()
    const probe = document.createElement("test-unload-probe") as UnloadProbe
    view.append(probe)
    await probe.updateComplete

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

    view.remove()
    assert.equal(removed.length, 1)
    assert.equal(removed[0], listener)
  } finally {
    window.addEventListener = originalAdd
    window.removeEventListener = originalRemove
  }
})
