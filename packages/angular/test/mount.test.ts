import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { DestroyRef, Injector, inject, runInInjectionContext } from "@angular/core"
import { KEEL_HEAD_ATTR, setPage } from "@kolektiv/keel"
import { injectKeelContext, injectKeelPage } from "../dist/index.js"
import { createPage } from "../dist/mount.js"
import { context, host, jit, seed } from "./helpers.ts"

const destroyed: string[] = []

function trackDestroy(name: string): void {
  inject(DestroyRef).onDestroy(() => destroyed.push(name))
}

const Page = jit({
  selector: "keel-test-page",
  template: `<p id="page">{{ page().data.title }} · {{ ctx().path }}</p>`,
})(class {
  readonly page = injectKeelPage<{ title: string }>()
  readonly ctx = injectKeelContext<{ title: string }>()
  constructor() {
    trackDestroy("page")
  }
})

const Inner = jit({
  selector: "keel-test-inner",
  template: `<div id="inner"><ng-content /></div>`,
})(class {
  constructor() {
    trackDestroy("inner")
  }
})

const Outer = jit({
  selector: "keel-test-outer",
  template: `<section id="outer"><ng-content /></section>`,
})(class {
  constructor() {
    trackDestroy("outer")
  }
})

test("createPage mounts, nests layouts outermost-first, and unmounts", async () => {
  destroyed.length = 0
  setPage(seed("/", { title: "hello" }))
  const element = host()
  const page = createPage<{ title: string }>(Page, [Outer, Inner])

  await page.mount(element, context("/", { title: "hello" }))

  const root = element.firstElementChild!
  assert.equal(root.tagName, "KEEL-TEST-OUTER")
  const section = root.firstElementChild!
  assert.equal(section.tagName, "SECTION")
  assert.equal(section.id, "outer")
  const inner = section.firstElementChild!
  assert.equal(inner.tagName, "KEEL-TEST-INNER")
  const pageHost = inner.firstElementChild!.firstElementChild!
  assert.equal(pageHost.tagName, "KEEL-TEST-PAGE")
  assert.equal(pageHost.textContent, "hello · /")

  page.unmount()
  assert.equal(element.childNodes.length, 0)
  assert.deepEqual(destroyed, ["outer", "inner", "page"])
  element.remove()
})

test("createPage context updates propagate without remounting", async () => {
  setPage(seed("/", { title: "one" }))
  const element = host()
  const page = createPage<{ title: string }>(Page)

  await page.mount(element, context("/", { title: "one" }))
  const pageHost = element.firstElementChild!
  assert.equal(pageHost.textContent, "one · /")

  setPage(seed("/next", { title: "two" }))
  await page.update(context("/next", { title: "two" }))

  assert.equal(element.firstElementChild, pageHost)
  assert.equal(pageHost.textContent, "two · /next")
  page.unmount()
  element.remove()
})

test("the root applies the seed head exactly once and cleans it up", async () => {
  setPage(seed("/", {}, { title: "Seed title", description: "Seed description" }))
  const element = host()
  const page = createPage(Page)

  await page.mount(element, context("/"))

  assert.equal(document.title, "Seed title")
  assert.equal(document.querySelectorAll(`meta[${KEEL_HEAD_ATTR}][name="description"]`).length, 1)

  page.unmount()
  assert.equal(document.querySelectorAll(`meta[${KEEL_HEAD_ATTR}][name="description"]`).length, 0)
  element.remove()
})

test("a page constructor error is marked on the host and rethrown", async () => {
  setPage(seed("/"))
  const element = host()
  const Broken = jit({
    selector: "keel-test-broken-ctor",
    template: `<span>never</span>`,
  })(class {
    constructor() {
      throw new Error("ctor boom")
    }
  })
  const page = createPage(Broken)

  await assert.rejects(() => page.mount(element, context("/")), /ctor boom/)
  const marker = element.querySelector("pre[data-keel-mount-error]")
  assert.ok(marker)
  assert.match(marker.textContent ?? "", /ctor boom/)
  page.unmount()
  element.remove()
})

test("a template error is marked on the host and rethrown", async () => {
  setPage(seed("/"))
  const element = host()
  const Broken = jit({
    selector: "keel-test-broken-template",
    template: `<span>{{ explode() }}</span>`,
  })(class {
    explode(): string {
      throw new Error("template boom")
    }
  })
  const page = createPage(Broken)

  const original = console.error
  console.error = () => undefined
  try {
    await assert.rejects(() => page.mount(element, context("/")), /template boom/)
  } finally {
    console.error = original
  }
  const marker = element.querySelector("pre[data-keel-mount-error]")
  assert.ok(marker)
  assert.match(marker.textContent ?? "", /template boom/)
  page.unmount()
  element.remove()
})

test("injectKeelContext throws outside a createPage tree", () => {
  assert.throws(
    () => runInInjectionContext(Injector.NULL, () => injectKeelContext()),
    /only available inside a page mounted by createPage/,
  )
})
