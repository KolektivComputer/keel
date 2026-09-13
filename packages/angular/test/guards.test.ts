import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, setPage, type NavigationGuard } from "@kolektiv/keel"
import { injectNavigationGuard, injectUnloadGuard } from "../dist/index.js"
import { createPage } from "../dist/mount.js"
import { context, host, jit, seed } from "./helpers.ts"

const guard: NavigationGuard = () => true
let dirty = () => false

const GuardProbe = jit({
  selector: "keel-test-guard-probe",
  template: `<p>guard</p>`,
})(class {
  readonly registered = injectNavigationGuard(guard)
})

const UnloadProbe = jit({
  selector: "keel-test-unload-probe",
  template: `<p>unload</p>`,
})(class {
  readonly unload = injectUnloadGuard(() => dirty())
})

test("injectNavigationGuard registers immediately and disposes on destroy", async () => {
  const events: string[] = []
  const original = router.beforeEach
  router.beforeEach = (registered: NavigationGuard) => {
    events.push(registered === guard ? "register" : "register-other")
    return () => events.push("unregister")
  }
  try {
    setPage(seed("/"))
    const element = host()
    const page = createPage(GuardProbe)
    await page.mount(element, context("/"))
    assert.deepEqual(events, ["register"])

    page.unmount()
    assert.deepEqual(events, ["register", "unregister"])
    element.remove()
  } finally {
    router.beforeEach = original
  }
})

test("injectUnloadGuard attaches and removes beforeunload, gated by the predicate", async () => {
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

  dirty = () => false
  try {
    setPage(seed("/"))
    const element = host()
    const page = createPage(UnloadProbe)
    await page.mount(element, context("/"))
    assert.equal(added.length, 1)

    const listener = added[0]!
    let prevented = 0
    const event = {
      preventDefault() {
        prevented += 1
      },
      returnValue: "keep",
    } as unknown as BeforeUnloadEvent
    listener(event)
    assert.equal(prevented, 0)
    assert.equal(event.returnValue, "keep")

    dirty = () => true
    listener(event)
    assert.equal(prevented, 1)
    assert.equal(event.returnValue, "")

    page.unmount()
    assert.equal(removed.length, 1)
    assert.equal(removed[0], listener)
    element.remove()
  } finally {
    window.addEventListener = originalAdd as typeof window.addEventListener
    window.removeEventListener = originalRemove as typeof window.removeEventListener
  }
})
