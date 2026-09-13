import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, type VisitOptions } from "@kolektiv/keel"
import { Link, useKeelAnchor } from "../dist/index.js"
import { dispatch, mouseEvent, render } from "./helpers.ts"
import { spread } from "solid-js/web"

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

function renderLink(props: Record<string, unknown>) {
  return render(Link, { children: "About", ...props })
}

test("Link GET renders an anchor and visits on left click", () => {
  const spy = captureVisit()
  try {
    const view = renderLink({ href: "/about" })
    const anchor = view.host.querySelector("a")!
    assert.equal(anchor.getAttribute("href"), "/about")

    const event = mouseEvent("click")
    dispatch(anchor, event)

    assert.equal(spy.calls.length, 1)
    assert.equal(spy.calls[0]?.href, "/about")
    assert.equal(spy.calls[0]?.options?.method, "get")
    assert.equal(event.defaultPrevented, true)
    view.unmount()
  } finally {
    spy.restore()
  }
})

test("Link skips modified clicks and non-left buttons", () => {
  const spy = captureVisit()
  try {
    const view = renderLink({ href: "/about" })
    const anchor = view.host.querySelector("a")!

    dispatch(anchor, mouseEvent("click", { metaKey: true }))
    dispatch(anchor, mouseEvent("click", { ctrlKey: true }))
    dispatch(anchor, mouseEvent("click", { shiftKey: true }))
    dispatch(anchor, mouseEvent("click", { altKey: true }))
    dispatch(anchor, mouseEvent("click", { button: 1 }))

    assert.equal(spy.calls.length, 0)
    view.unmount()
  } finally {
    spy.restore()
  }
})

test("Link does not intercept a GET into target=_blank", () => {
  const spy = captureVisit()
  try {
    const view = renderLink({ href: "/about", target: "_blank" })
    const anchor = view.host.querySelector("a")!
    const event = mouseEvent("click")
    dispatch(anchor, event)
    assert.equal(spy.calls.length, 0)
    assert.equal(event.defaultPrevented, false)
    view.unmount()
  } finally {
    spy.restore()
  }
})

test("Link non-GET renders a button and visits with the method and options", () => {
  const spy = captureVisit()
  try {
    const view = renderLink({ href: "/logout", method: "delete", preserveScroll: true, children: "Log out" })
    const button = view.host.querySelector("button")!
    assert.equal(button.getAttribute("type"), "button")
    assert.equal(view.host.querySelector("a"), null)

    dispatch(button, mouseEvent("click"))

    assert.equal(spy.calls.length, 1)
    assert.equal(spy.calls[0]?.href, "/logout")
    assert.equal(spy.calls[0]?.options?.method, "delete")
    assert.equal(spy.calls[0]?.options?.preserveScroll, true)
    view.unmount()
  } finally {
    spy.restore()
  }
})

test("Link calls a caller onClick before visiting and respects preventDefault", () => {
  const spy = captureVisit()
  try {
    const clicks: string[] = []
    const view = renderLink({
      href: "/about",
      onClick: (event: MouseEvent) => {
        clicks.push("clicked")
        event.preventDefault()
      },
    })
    dispatch(view.host.querySelector("a")!, mouseEvent("click"))
    assert.deepEqual(clicks, ["clicked"])
    assert.equal(spy.calls.length, 0)

    const plain = renderLink({ href: "/about", onClick: () => clicks.push("clicked") })
    dispatch(plain.host.querySelector("a")!, mouseEvent("click"))
    assert.deepEqual(clicks, ["clicked", "clicked"])
    assert.equal(spy.calls.length, 1)
    view.unmount()
    plain.unmount()
  } finally {
    spy.restore()
  }
})

test("Link prefetch modes trigger router.prefetch", () => {
  const spy = captureVisit()
  const prefetched: string[] = []
  router.prefetch = async (href: string) => {
    prefetched.push(href)
  }
  try {
    const mountView = renderLink({ href: "/mount", prefetch: "mount" })
    assert.deepEqual(prefetched, ["/mount"])
    mountView.unmount()

    const hoverView = renderLink({ href: "/hover", prefetch: "hover" })
    dispatch(hoverView.host.querySelector("a")!, new window.Event("pointerenter"))
    assert.deepEqual(prefetched, ["/mount", "/hover"])
    hoverView.unmount()

    const downView = renderLink({ href: "/down", prefetch: "mousedown" })
    dispatch(downView.host.querySelector("a")!, new window.Event("pointerdown"))
    assert.deepEqual(prefetched, ["/mount", "/hover", "/down"])
    downView.unmount()

    const noneView = renderLink({ href: "/none" })
    dispatch(noneView.host.querySelector("a")!, new window.Event("pointerenter"))
    dispatch(noneView.host.querySelector("a")!, new window.Event("pointerdown"))
    assert.deepEqual(prefetched, ["/mount", "/hover", "/down"])
    noneView.unmount()
  } finally {
    spy.restore()
  }
})

test("useKeelAnchor intercepts clicks and prefetches like Link", () => {
  const spy = captureVisit()
  const prefetched: string[] = []
  router.prefetch = async (href: string) => {
    prefetched.push(href)
  }
  try {
    const Anchor = () => {
      const anchor = useKeelAnchor({ href: "/about", prefetch: "hover" })
      const el = document.createElement("a")
      spread(el, anchor, false)
      return el
    }
    const view = render(Anchor)
    const anchor = view.host.querySelector("a")!
    assert.equal(anchor.getAttribute("href"), "/about")

    dispatch(anchor, new window.Event("pointerenter"))
    assert.deepEqual(prefetched, ["/about"])

    const event = mouseEvent("click")
    dispatch(anchor, event)
    assert.equal(event.defaultPrevented, true)
    assert.equal(spy.calls.length, 1)
    assert.equal(spy.calls[0]?.href, "/about")
    view.unmount()
  } finally {
    spy.restore()
  }
})
