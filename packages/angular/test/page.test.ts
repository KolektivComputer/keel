import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { setPage } from "@kolektiv/keel"
import { injectKeelPage, type KeelPage } from "../dist/index.js"
import { flushKeel } from "../dist/testing.js"
import { createPage } from "../dist/mount.js"
import { context, host, jit, seed } from "./helpers.ts"

let captured: { page: () => KeelPage<{ title: string }> } | undefined

const Page = jit({
  selector: "keel-test-page-state",
  template: `<p id="seed">{{ page().data.title }}|{{ page().processing }}|{{ page().path }}</p>`,
})(class {
  readonly page = injectKeelPage<{ title: string }>()
  constructor() {
    captured = this
  }
})

test("injectKeelPage exposes the seed and caches the snapshot", async () => {
  const first = seed("/", { title: "one" })
  setPage(first)
  const element = host()
  const page = createPage(Page)

  await page.mount(element, context("/", { title: "one" }))
  assert.ok(captured)
  const snapshot = captured.page()
  assert.equal(snapshot.path, "/")
  assert.equal(snapshot.data.title, "one")
  assert.equal(snapshot.processing, false)
  assert.match(element.textContent ?? "", /one\|false\|\//)

  setPage(first)
  flushKeel()
  assert.equal(captured.page(), snapshot)
  assert.match(element.textContent ?? "", /one\|false\|\//)

  setPage(seed("/next", { title: "two" }))
  flushKeel()
  assert.notEqual(captured.page(), snapshot)
  assert.equal(captured.page().path, "/next")
  assert.equal(captured.page().data.title, "two")
  assert.match(element.textContent ?? "", /two\|false\|\/next/)

  page.unmount()
  element.remove()
})

test("injectKeelPage disposes its store subscription with the component", async () => {
  setPage(seed("/", { title: "one" }))
  const element = host()
  const page = createPage(Page)
  await page.mount(element, context("/", { title: "one" }))
  page.unmount()
  element.remove()

  // The destroyed component must not react to later seed changes.
  setPage(seed("/after", { title: "after" }))
  flushKeel()
  assert.equal(captured.page().path, "/")
})
