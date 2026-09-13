import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, type VisitOptions } from "@kolektiv/keel"
import { defineComponent, h } from "vue"
import { Link } from "../dist/index.js"
import { useKeelAnchor } from "../dist/index.js"
import { dispatch, mouseEvent, render } from "./helpers.ts"

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

function renderLink(props: Record<string, unknown>, slot = "About") {
  return render(
    defineComponent({
      setup: () => () => h(Link, props, { default: () => slot }),
    }),
  )
}

test("Link GET renders an anchor and visits on left click", async () => {
  const spy = captureVisit()
  try {
    const view = await renderLink({ href: "/about" })
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
    const view = await renderLink({ href: "/about" })
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
    const view = await renderLink({ href: "/about", target: "_blank" })
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
    const view = await renderLink({ href: "/logout", method: "delete", preserveScroll: true }, "Log out")
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

test("Link calls a caller onClick before visiting and respects preventDefault", async () => {
  const spy = captureVisit()
  try {
    const clicks: string[] = []
    const view = await renderLink(
      {
        href: "/about",
        onClick: (event: MouseEvent) => {
          clicks.push("clicked")
          event.preventDefault()
        },
      },
    )
    await dispatch(view.host.querySelector("a")!, mouseEvent("click"))
    assert.deepEqual(clicks, ["clicked"])
    assert.equal(spy.calls.length, 0)

    const plain = await renderLink({ href: "/about", onClick: () => clicks.push("clicked") })
    await dispatch(plain.host.querySelector("a")!, mouseEvent("click"))
    assert.deepEqual(clicks, ["clicked", "clicked"])
    assert.equal(spy.calls.length, 1)
    await view.unmount()
    await plain.unmount()
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
    const mountView = await renderLink({ href: "/mount", prefetch: "mount" })
    assert.deepEqual(prefetched, ["/mount"])
    await mountView.unmount()

    const hoverView = await renderLink({ href: "/hover", prefetch: "hover" })
    await dispatch(hoverView.host.querySelector("a")!, new window.Event("pointerenter"))
    assert.deepEqual(prefetched, ["/mount", "/hover"])
    await hoverView.unmount()

    const downView = await renderLink({ href: "/down", prefetch: "mousedown" })
    await dispatch(downView.host.querySelector("a")!, new window.Event("pointerdown"))
    assert.deepEqual(prefetched, ["/mount", "/hover", "/down"])
    await downView.unmount()

    const noneView = await renderLink({ href: "/none" })
    await dispatch(noneView.host.querySelector("a")!, new window.Event("pointerenter"))
    await dispatch(noneView.host.querySelector("a")!, new window.Event("pointerdown"))
    assert.deepEqual(prefetched, ["/mount", "/hover", "/down"])
    await noneView.unmount()
  } finally {
    spy.restore()
  }
})

test("useKeelAnchor intercepts clicks and prefetches like Link", async () => {
  const spy = captureVisit()
  const prefetched: string[] = []
  router.prefetch = async (href: string) => {
    prefetched.push(href)
  }
  try {
    const view = await render(
      defineComponent({
        setup() {
          const anchor = useKeelAnchor({ href: "/about", prefetch: "hover" })
          return () => h("a", anchor, "About")
        },
      }),
    )
    const anchor = view.host.querySelector("a")!
    assert.equal(anchor.getAttribute("href"), "/about")

    await dispatch(anchor, new window.Event("pointerenter"))
    assert.deepEqual(prefetched, ["/about"])

    const event = mouseEvent("click")
    await dispatch(anchor, event)
    assert.equal(event.defaultPrevented, true)
    assert.equal(spy.calls.length, 1)
    assert.equal(spy.calls[0]?.href, "/about")
    await view.unmount()
  } finally {
    spy.restore()
  }
})
