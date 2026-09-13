import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, type VisitOptions } from "@kolektiv/keel"
import { html, LitElement } from "lit"
import { keelAnchor, Link } from "../dist/index.js"
import { host, mouseEvent, pointerEvent } from "./helpers.ts"

interface VisitCall {
  href: string
  options?: VisitOptions
}

function captureVisit(): { calls: VisitCall[]; restore(): void } {
  const calls: VisitCall[] = []
  const visit = router.visit
  const prefetch = router.prefetch
  router.visit = async (href, options) => {
    calls.push({ href, options })
  }
  router.prefetch = async () => undefined
  return {
    calls,
    restore() {
      router.visit = visit
      router.prefetch = prefetch
    },
  }
}

test("Link GET renders an anchor and visits on left click", async () => {
  const spy = captureVisit()
  try {
    const element = document.createElement("keel-link") as Link
    element.href = "/about"
    document.body.append(element)
    await element.updateComplete

    const anchor = element.shadowRoot!.querySelector("a")!
    assert.equal(anchor.getAttribute("href"), "/about")

    const event = mouseEvent("click")
    anchor.dispatchEvent(event)

    assert.equal(spy.calls.length, 1)
    assert.equal(spy.calls[0]?.href, "/about")
    assert.equal(spy.calls[0]?.options?.method, "get")
    assert.equal(event.defaultPrevented, true)
    element.remove()
  } finally {
    spy.restore()
  }
})

test("Link skips modified clicks and non-left buttons", async () => {
  const spy = captureVisit()
  try {
    const element = document.createElement("keel-link") as Link
    element.href = "/about"
    document.body.append(element)
    await element.updateComplete
    const anchor = element.shadowRoot!.querySelector("a")!

    anchor.dispatchEvent(mouseEvent("click", { metaKey: true }))
    anchor.dispatchEvent(mouseEvent("click", { ctrlKey: true }))
    anchor.dispatchEvent(mouseEvent("click", { shiftKey: true }))
    anchor.dispatchEvent(mouseEvent("click", { altKey: true }))
    anchor.dispatchEvent(mouseEvent("click", { button: 1 }))

    assert.equal(spy.calls.length, 0)
    element.remove()
  } finally {
    spy.restore()
  }
})

test("Link does not intercept a GET into target=_blank", async () => {
  const spy = captureVisit()
  try {
    const element = document.createElement("keel-link") as Link
    element.href = "/about"
    element.target = "_blank"
    document.body.append(element)
    await element.updateComplete
    const anchor = element.shadowRoot!.querySelector("a")!
    assert.equal(anchor.getAttribute("target"), "_blank")

    const event = mouseEvent("click")
    anchor.dispatchEvent(event)
    assert.equal(spy.calls.length, 0)
    assert.equal(event.defaultPrevented, false)
    element.remove()
  } finally {
    spy.restore()
  }
})

test("Link non-GET renders a button and visits with the method and options", async () => {
  const spy = captureVisit()
  try {
    const element = document.createElement("keel-link") as Link
    element.href = "/logout"
    element.method = "delete"
    element.preserveScroll = true
    document.body.append(element)
    await element.updateComplete

    const button = element.shadowRoot!.querySelector("button")!
    assert.equal(button.getAttribute("type"), "button")
    assert.equal(element.shadowRoot!.querySelector("a"), null)

    button.dispatchEvent(mouseEvent("click"))

    assert.equal(spy.calls.length, 1)
    assert.equal(spy.calls[0]?.href, "/logout")
    assert.equal(spy.calls[0]?.options?.method, "delete")
    assert.equal(spy.calls[0]?.options?.preserveScroll, true)
    element.remove()
  } finally {
    spy.restore()
  }
})

test("Link calls a caller onClick before visiting and respects preventDefault", async () => {
  const spy = captureVisit()
  try {
    const clicks: string[] = []
    const element = document.createElement("keel-link") as Link
    element.href = "/about"
    element.onClick = (event) => {
      clicks.push("clicked")
      event.preventDefault()
    }
    document.body.append(element)
    await element.updateComplete

    element.shadowRoot!.querySelector("a")!.dispatchEvent(mouseEvent("click"))
    assert.deepEqual(clicks, ["clicked"])
    assert.equal(spy.calls.length, 0)

    element.onClick = () => clicks.push("clicked")
    await element.updateComplete
    element.shadowRoot!.querySelector("a")!.dispatchEvent(mouseEvent("click"))
    assert.deepEqual(clicks, ["clicked", "clicked"])
    assert.equal(spy.calls.length, 1)
    element.remove()
  } finally {
    spy.restore()
  }
})

test("Link attribute bindings drive method, href, target, and prefetch", async () => {
  const spy = captureVisit()
  const prefetched: string[] = []
  router.prefetch = async (href: string) => {
    prefetched.push(href)
  }
  try {
    const element = document.createElement("keel-link") as Link
    element.setAttribute("href", "/logout")
    element.setAttribute("method", "delete")
    element.setAttribute("preserve-state", "")
    element.setAttribute("prefetch", "mousedown")
    document.body.append(element)
    await element.updateComplete

    assert.equal(element.shadowRoot!.querySelector("a"), null)
    const button = element.shadowRoot!.querySelector("button")!
    button.dispatchEvent(mouseEvent("click"))
    assert.equal(spy.calls[0]?.href, "/logout")
    assert.equal(spy.calls[0]?.options?.method, "delete")
    assert.equal(spy.calls[0]?.options?.preserveState, true)

    const anchor = document.createElement("keel-link")
    anchor.setAttribute("href", "/about")
    anchor.setAttribute("prefetch", "")
    document.body.append(anchor)
    await (anchor as Link).updateComplete
    assert.equal(anchor.shadowRoot!.querySelector("a")!.getAttribute("href"), "/about")
    anchor.shadowRoot!.querySelector("a")!.dispatchEvent(pointerEvent("pointerenter"))
    assert.deepEqual(prefetched, ["/about"])

    element.remove()
    anchor.remove()
  } finally {
    spy.restore()
  }
})

test("Link prefetch modes trigger router.prefetch", async () => {
  const spy = captureVisit()
  const prefetched: string[] = []
  router.prefetch = async (href: string) => {
    prefetched.push(href)
  }
  try {
    const mount = document.createElement("keel-link") as Link
    mount.href = "/mount"
    mount.prefetch = "mount"
    document.body.append(mount)
    await mount.updateComplete
    assert.deepEqual(prefetched, ["/mount"])

    const hover = document.createElement("keel-link") as Link
    hover.href = "/hover"
    hover.prefetch = "hover"
    document.body.append(hover)
    await hover.updateComplete
    hover.shadowRoot!.querySelector("a")!.dispatchEvent(pointerEvent("pointerenter"))
    assert.deepEqual(prefetched, ["/mount", "/hover"])

    const down = document.createElement("keel-link") as Link
    down.href = "/down"
    down.prefetch = "mousedown"
    document.body.append(down)
    await down.updateComplete
    down.shadowRoot!.querySelector("a")!.dispatchEvent(pointerEvent("pointerdown"))
    assert.deepEqual(prefetched, ["/mount", "/hover", "/down"])

    const none = document.createElement("keel-link") as Link
    none.href = "/none"
    document.body.append(none)
    await none.updateComplete
    none.shadowRoot!.querySelector("a")!.dispatchEvent(pointerEvent("pointerenter"))
    none.shadowRoot!.querySelector("a")!.dispatchEvent(pointerEvent("pointerdown"))
    assert.deepEqual(prefetched, ["/mount", "/hover", "/down"])

    mount.remove()
    hover.remove()
    down.remove()
    none.remove()
  } finally {
    spy.restore()
  }
})

class AnchorHost extends LitElement {
  render() {
    return html`<a ${keelAnchor({ href: "/about", prefetch: "hover" })}>About</a>`
  }
}

customElements.define("test-anchor-host", AnchorHost)

test("keelAnchor intercepts clicks and prefetches like Link", async () => {
  const spy = captureVisit()
  const prefetched: string[] = []
  router.prefetch = async (href: string) => {
    prefetched.push(href)
  }
  try {
    const view = host()
    const element = document.createElement("test-anchor-host") as AnchorHost
    view.append(element)
    await element.updateComplete
    const anchor = element.shadowRoot!.querySelector("a")!
    assert.equal(anchor.getAttribute("href"), "/about")

    anchor.dispatchEvent(pointerEvent("pointerenter"))
    assert.deepEqual(prefetched, ["/about"])

    const event = mouseEvent("click")
    anchor.dispatchEvent(event)
    assert.equal(event.defaultPrevented, true)
    assert.equal(spy.calls.length, 1)
    assert.equal(spy.calls[0]?.href, "/about")

    const removed: string[] = []
    const originalRemove = anchor.removeEventListener.bind(anchor)
    anchor.removeEventListener = ((type: string, listener: EventListener) => {
      removed.push(type)
      return originalRemove(type, listener)
    }) as typeof anchor.removeEventListener
    view.remove()
    assert.deepEqual(removed.sort(), ["click", "pointerdown", "pointerenter"])
  } finally {
    spy.restore()
  }
})
