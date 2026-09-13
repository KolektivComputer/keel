import assert from "node:assert/strict"
import { test } from "node:test"
import { router, type VisitOptions } from "@kolektiv/keel"
import { Link } from "../dist/Link.js"
import { act, createElement, dispatch, mouseEvent, pointerEvent, render } from "./helpers.ts"

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
    const view = await render(createElement(Link, { href: "/about" }, "About"))
    const anchor = view.host.querySelector("a")!
    assert.equal(anchor.getAttribute("href"), "/about")

    const event = mouseEvent("click")
    await dispatch(anchor, event)

    assert.equal(spy.calls.length, 1)
    assert.equal(spy.calls[0]?.href, "/about")
    assert.equal(spy.calls[0]?.options?.method, "get")
    assert.equal(event.defaultPrevented, true)
    await view.unmount()
  } finally {
    spy.restore()
  }
})

test("Link skips modified clicks and non-left buttons", async () => {
  const spy = captureVisit()
  try {
    const view = await render(createElement(Link, { href: "/about" }))
    const anchor = view.host.querySelector("a")!

    await dispatch(anchor, mouseEvent("click", { metaKey: true }))
    await dispatch(anchor, mouseEvent("click", { ctrlKey: true }))
    await dispatch(anchor, mouseEvent("click", { shiftKey: true }))
    await dispatch(anchor, mouseEvent("click", { altKey: true }))
    await dispatch(anchor, mouseEvent("click", { button: 1 }))

    assert.equal(spy.calls.length, 0)
    await view.unmount()
  } finally {
    spy.restore()
  }
})

test("Link does not intercept a GET into target=_blank", async () => {
  const spy = captureVisit()
  try {
    const view = await render(createElement(Link, { href: "/about", target: "_blank" }))
    const anchor = view.host.querySelector("a")!
    const event = mouseEvent("click")
    await dispatch(anchor, event)
    assert.equal(spy.calls.length, 0)
    assert.equal(event.defaultPrevented, false)
    await view.unmount()
  } finally {
    spy.restore()
  }
})

test("Link non-GET renders a button and visits with the method and options", async () => {
  const spy = captureVisit()
  try {
    const view = await render(
      createElement(Link, { href: "/logout", method: "delete", preserveScroll: true }, "Log out"),
    )
    const button = view.host.querySelector("button")!
    assert.equal(button.getAttribute("type"), "button")
    assert.equal(view.host.querySelector("a"), null)

    await dispatch(button, mouseEvent("click"))

    assert.equal(spy.calls.length, 1)
    assert.equal(spy.calls[0]?.href, "/logout")
    assert.equal(spy.calls[0]?.options?.method, "delete")
    assert.equal(spy.calls[0]?.options?.preserveScroll, true)
    await view.unmount()
  } finally {
    spy.restore()
  }
})

test("Link calls a caller onClick before visiting", async () => {
  const spy = captureVisit()
  try {
    const clicks: string[] = []
    const view = await render(
      createElement(Link, { href: "/about", onClick: () => clicks.push("clicked") }),
    )
    await dispatch(view.host.querySelector("a")!, mouseEvent("click"))
    assert.deepEqual(clicks, ["clicked"])
    assert.equal(spy.calls.length, 1)
    await view.unmount()
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
    const mountView = await render(createElement(Link, { href: "/mount", prefetch: "mount" }))
    assert.deepEqual(prefetched, ["/mount"])
    await mountView.unmount()

    const hoverView = await render(createElement(Link, { href: "/hover", prefetch: "hover" }))
    await dispatch(hoverView.host.querySelector("a")!, pointerEvent("pointerover"))
    assert.deepEqual(prefetched, ["/mount", "/hover"])
    await hoverView.unmount()

    const downView = await render(createElement(Link, { href: "/down", prefetch: "mousedown" }))
    await act(async () => {
      downView.host.querySelector("a")!.dispatchEvent(pointerEvent("pointerdown"))
    })
    assert.deepEqual(prefetched, ["/mount", "/hover", "/down"])
    await downView.unmount()

    const noneView = await render(createElement(Link, { href: "/none" }))
    await dispatch(noneView.host.querySelector("a")!, pointerEvent("pointerover"))
    await dispatch(noneView.host.querySelector("a")!, pointerEvent("pointerdown"))
    assert.deepEqual(prefetched, ["/mount", "/hover", "/down"])
    await noneView.unmount()
  } finally {
    spy.restore()
  }
})
