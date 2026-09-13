import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { KEEL_HEAD_ATTR, setPage } from "@kolektiv/keel"
import { html, LitElement } from "lit"
import { KeelElement } from "../dist/index.js"
import { createPage } from "../dist/mount.js"
import { context, host, seed } from "./helpers.ts"

class OuterLayout extends KeelElement {
  render() {
    return html`<section id="outer"><slot></slot></section>`
  }
}

class InnerLayout extends KeelElement {
  render() {
    return html`<div id="inner"><slot></slot></div>`
  }
}

class TestPage extends KeelElement<{ title: string }> {
  render() {
    return html`<p id="page">${this.page.data.title}</p>`
  }
}

test("createPage mounts, nests layouts outermost-first, and unmounts", async () => {
  setPage(seed("/", { title: "hello" }))
  const element = host()
  const page = createPage<{ title: string }>(TestPage, [OuterLayout, InnerLayout])

  await page.mount(element, context("/", { title: "hello" }))

  const root = element.firstElementChild!
  const outer = root.firstElementChild as LitElement
  const inner = outer.firstElementChild as LitElement
  const pageElement = inner.firstElementChild as LitElement
  assert.equal(root.tagName, "KEEL-ROOT")
  assert.ok(outer instanceof OuterLayout)
  assert.ok(inner instanceof InnerLayout)
  assert.ok(pageElement instanceof TestPage)
  assert.equal(pageElement.shadowRoot!.textContent, "hello")
  assert.ok(outer.shadowRoot!.querySelector("#outer slot"))

  page.unmount()
  assert.equal(element.childNodes.length, 0)
  assert.equal(outer.isConnected, false)
  element.remove()
})

test("createPage context updates propagate without remounting", async () => {
  setPage(seed("/", { title: "one" }))
  const element = host()
  const page = createPage<{ title: string }>(TestPage)

  await page.mount(element, context("/", { title: "one" }))
  const root = element.firstElementChild!
  const pageElement = root.firstElementChild as LitElement
  assert.equal(pageElement.shadowRoot!.textContent, "one")

  setPage(seed("/next", { title: "two" }))
  page.update!(context("/next", { title: "two" }))
  await pageElement.updateComplete

  assert.equal(element.firstElementChild, root)
  assert.equal(root.firstElementChild, pageElement)
  assert.equal(pageElement.shadowRoot!.textContent, "two")
  element.remove()
})

test("the root applies the seed head exactly once and cleans it up", async () => {
  setPage(seed("/", {}, { title: "Seed title", description: "Seed description" }))
  const element = host()
  const page = createPage(TestPage, [OuterLayout])

  await page.mount(element, context("/"))

  assert.equal(document.title, "Seed title")
  assert.equal(document.querySelectorAll(`meta[${KEEL_HEAD_ATTR}][name="description"]`).length, 1)

  page.unmount()
  assert.equal(document.querySelectorAll(`meta[${KEEL_HEAD_ATTR}][name="description"]`).length, 0)
  element.remove()
})

test("createPage marks render errors with data-keel-mount-error and rethrows", async () => {
  setPage(seed("/"))
  const element = host()
  class BrokenPage extends KeelElement {
    render(): unknown {
      throw new Error("boom")
    }
  }
  const page = createPage(BrokenPage)

  await assert.rejects(() => page.mount(element, context("/")), /boom/)
  const marker = element.querySelector("pre[data-keel-mount-error]")
  assert.ok(marker)
  assert.match(marker.textContent ?? "", /boom/)
  page.unmount()
  element.remove()
})

test("a layout render error is marked on the host and rethrown", async () => {
  setPage(seed("/"))
  const element = host()
  class BrokenLayout extends KeelElement {
    render(): unknown {
      throw new Error("layout boom")
    }
  }
  const page = createPage(TestPage, [BrokenLayout])

  await assert.rejects(() => page.mount(element, context("/")), /layout boom/)
  assert.ok(element.querySelector("pre[data-keel-mount-error]"))
  page.unmount()
  element.remove()
})

test("KeelElement.ctx throws outside a createPage tree", async () => {
  class Probe extends KeelElement {
    render() {
      return html`${this.ctx.path}`
    }
  }
  setPage(seed("/"))
  customElements.define("test-ctx-probe", Probe)
  const element = document.createElement("test-ctx-probe") as Probe
  document.body.append(element)
  await assert.rejects(() => element.updateComplete, /only available inside a createPage/)
  element.remove()
})
