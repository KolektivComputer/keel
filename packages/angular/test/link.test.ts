import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, type VisitOptions } from "@kolektiv/keel"
import { setPage } from "@kolektiv/keel"
import {
  KeelAnchorDirective,
  KeelLink,
  KeelLinkDirective,
} from "../dist/index.js"
import { createPage } from "../dist/mount.js"
import { context, host, jit, mouseEvent, pointerEvent, seed } from "./helpers.ts"

const LinkPage = jit({
  selector: "keel-test-link-page",
  imports: [KeelLink, KeelLinkDirective, KeelAnchorDirective],
  template: `
    <keel-link id="get" href="/about" prefetch="hover">About</keel-link>
    <keel-link id="post" href="/notes" method="post" target="_self">New</keel-link>
    <keel-link id="blank" href="/blank" target="_blank">Blank</keel-link>
    <keel-link id="mount" href="/mount" prefetch="mount">Mount</keel-link>
    <keel-link id="down" href="/down" prefetch="mousedown">Down</keel-link>
    <keel-link id="bare" href="/bare" prefetch>Bare</keel-link>
    <keel-link id="truthy" href="/truthy" prefetch="true">Truthy</keel-link>
    <a id="directive" href="/plain" [keelLink]="'/opt'">Directive</a>
    <button id="delete" type="button" [keelLink]="{ href: '/del', method: 'delete' }">Delete</button>
    <a id="anchored" href="/anchor" [keelAnchor]="{ prefetch: 'hover' }">Anchor</a>
  `,
})(class {})

interface Patched {
  visits: Array<{ href: string; options?: VisitOptions }>
  prefetches: string[]
  restore(): void
}

function patchRouter(): Patched {
  const originalVisit = router.visit
  const originalPrefetch = router.prefetch
  const visits: Array<{ href: string; options?: VisitOptions }> = []
  const prefetches: string[] = []
  router.visit = async (href, options) => {
    visits.push({ href, options })
  }
  router.prefetch = async (href) => {
    prefetches.push(href)
  }
  return {
    visits,
    prefetches,
    restore() {
      router.visit = originalVisit
      router.prefetch = originalPrefetch
    },
  }
}

async function mountPage(): Promise<{ element: HTMLDivElement; unmount(): void }> {
  setPage(seed("/"))
  const element = host()
  const page = createPage(LinkPage)
  await page.mount(element, context("/"))
  return { element, unmount: () => page.unmount() }
}

test("KeelLink renders an anchor for GET and a button otherwise", async () => {
  const patched = patchRouter()
  const { element, unmount } = await mountPage()
  try {
    const get = element.querySelector<HTMLElement>("#get")!
    const anchor = get.querySelector("a")!
    assert.equal(anchor.getAttribute("href"), "/about")
    assert.equal(get.querySelector("button"), null)

    const post = element.querySelector<HTMLElement>("#post")!
    assert.equal(post.querySelector("a"), null)
    const button = post.querySelector("button")!
    assert.equal(button.getAttribute("type"), "button")

    anchor.dispatchEvent(mouseEvent("click"))
    assert.equal(patched.visits.length, 1)
    assert.equal(patched.visits[0]?.href, "/about")
    assert.equal(patched.visits[0]?.options?.method, "get")

    button.dispatchEvent(mouseEvent("click"))
    assert.equal(patched.visits.length, 2)
    assert.equal(patched.visits[1]?.href, "/notes")
    assert.equal(patched.visits[1]?.options?.method, "post")
  } finally {
    patched.restore()
    unmount()
    element.remove()
  }
})

test("link interception skips modified, non-left, handled, and _blank clicks", async () => {
  const patched = patchRouter()
  const { element, unmount } = await mountPage()
  try {
    const anchor = element.querySelector<HTMLAnchorElement>("#get a")!
    anchor.dispatchEvent(mouseEvent("click", { metaKey: true }))
    anchor.dispatchEvent(mouseEvent("click", { ctrlKey: true }))
    anchor.dispatchEvent(mouseEvent("click", { shiftKey: true }))
    anchor.dispatchEvent(mouseEvent("click", { altKey: true }))
    anchor.dispatchEvent(mouseEvent("click", { button: 1 }))
    assert.equal(patched.visits.length, 0)

    element.addEventListener("click", (event) => event.preventDefault(), { capture: true })
    anchor.dispatchEvent(mouseEvent("click"))
    assert.equal(patched.visits.length, 0)
    element.removeEventListener("click", (event) => event.preventDefault(), { capture: true })

    const blank = element.querySelector<HTMLAnchorElement>("#blank a")!
    blank.dispatchEvent(mouseEvent("click"))
    assert.equal(patched.visits.length, 0)
  } finally {
    patched.restore()
    unmount()
    element.remove()
  }
})

test("prefetch modes fire on mount, hover, and pointerdown", async () => {
  const patched = patchRouter()
  const { element, unmount } = await mountPage()
  try {
    assert.deepEqual(patched.prefetches, ["/mount"])

    const anchor = element.querySelector<HTMLAnchorElement>("#get a")!
    anchor.dispatchEvent(pointerEvent("pointerenter"))
    assert.deepEqual(patched.prefetches, ["/mount", "/about"])

    const down = element.querySelector<HTMLAnchorElement>("#down a")!
    down.dispatchEvent(pointerEvent("pointerdown"))
    assert.deepEqual(patched.prefetches, ["/mount", "/about", "/down"])

    const anchored = element.querySelector<HTMLAnchorElement>("#anchored")!
    anchored.dispatchEvent(pointerEvent("pointerenter"))
    assert.deepEqual(patched.prefetches, ["/mount", "/about", "/down", "/anchor"])

    const bare = element.querySelector<HTMLAnchorElement>("#bare a")!
    bare.dispatchEvent(pointerEvent("pointerenter"))
    const truthy = element.querySelector<HTMLAnchorElement>("#truthy a")!
    truthy.dispatchEvent(pointerEvent("pointerenter"))
    assert.deepEqual(patched.prefetches, ["/mount", "/about", "/down", "/anchor", "/bare", "/truthy"])
  } finally {
    patched.restore()
    unmount()
    element.remove()
  }
})

test("[keelLink] intercepts anchors and buttons with their own href", async () => {
  const patched = patchRouter()
  const { element, unmount } = await mountPage()
  try {
    const anchor = element.querySelector<HTMLAnchorElement>("#directive")!
    assert.equal(anchor.getAttribute("href"), "/plain")
    anchor.dispatchEvent(mouseEvent("click"))
    assert.equal(patched.visits[0]?.href, "/opt")

    const button = element.querySelector<HTMLButtonElement>("#delete")!
    button.dispatchEvent(mouseEvent("click"))
    assert.equal(patched.visits[1]?.href, "/del")
    assert.equal(patched.visits[1]?.options?.method, "delete")
  } finally {
    patched.restore()
    unmount()
    element.remove()
  }
})
