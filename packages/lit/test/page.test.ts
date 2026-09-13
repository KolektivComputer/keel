import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { setPage } from "@kolektiv/keel"
import { html, LitElement } from "lit"
import { usePage, type KeelPage } from "../dist/index.js"
import { host, seed } from "./helpers.ts"

class PageProbe extends LitElement {
  readonly page = usePage<{ title: string }>(this)
  render() {
    return html`${this.page.current.path}`
  }
}

customElements.define("test-page-probe", PageProbe)

test("usePage caches the snapshot until the seed changes", async () => {
  const first = seed("/", { title: "one" })
  setPage(first)

  const view = host()
  const element = document.createElement("test-page-probe") as PageProbe
  view.append(element)
  await element.updateComplete

  const snapshot = element.page.current
  assert.equal(snapshot.path, "/")
  assert.equal(snapshot.data.title, "one")
  assert.equal(snapshot.processing, false)
  assert.equal(element.shadowRoot!.textContent, "/")

  setPage(first)
  await element.updateComplete
  assert.equal(element.page.current, snapshot)

  setPage(seed("/next", { title: "two" }))
  await element.updateComplete
  assert.notEqual(element.page.current, snapshot)
  assert.equal(element.page.current.path, "/next")
  assert.equal(element.page.current.data.title, "two")
  assert.equal(element.shadowRoot!.textContent, "/next")

  view.remove()
})

test("KeelPage type exposes processing", () => {
  const page: KeelPage<{ title: string }> = { ...seed("/", { title: "x" }), processing: true }
  assert.equal(page.processing, true)
})
