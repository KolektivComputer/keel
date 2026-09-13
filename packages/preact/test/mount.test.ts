import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { KEEL_HEAD_ATTR, setPage } from "@kolektiv/keel"
import { createElement, type ComponentChildren } from "preact"
import { usePage, usePageContext } from "../dist/index.js"
import { createPage } from "../dist/mount.js"
import { act, context, host, render, seed } from "./helpers.ts"

test("createPage mounts, nests layouts outermost-first, and unmounts", async () => {
  setPage(seed("/"))
  const element = host()
  const Outer = ({ children }: { children?: ComponentChildren }) =>
    createElement("section", { id: "outer" }, children)
  const Inner = ({ children }: { children?: ComponentChildren }) =>
    createElement("div", { id: "inner" }, children)
  const Page = () => createElement("p", { id: "page" }, "hello")
  const page = createPage(Page, [Outer, Inner])

  await act(() => {
    page.mount(element, context("/"))
  })

  assert.ok(element.querySelector("#outer > #inner > #page"))
  assert.equal(element.textContent, "hello")

  await act(() => {
    page.unmount()
  })
  assert.equal(element.childNodes.length, 0)
  element.remove()
})

test("createPage provides seed and PageContext and updates them", async () => {
  setPage(seed("/", { title: "one" }))
  const element = host()
  const Page = () => {
    const ctx = usePageContext<{ title: string }>()
    const current = usePage<{ title: string }>()
    return createElement("p", { id: "page" }, `${ctx.path}:${current.data.title}:${String(current.processing)}`)
  }
  const page = createPage<{ title: string }>(Page)

  await act(() => {
    page.mount(element, context("/", { title: "one" }))
  })
  assert.equal(element.textContent, "/:one:false")
  const rendered = element.querySelector("#page")

  await act(() => {
    setPage(seed("/next", { title: "two" }))
    page.update!(context("/next", { title: "two" }))
  })
  assert.equal(element.textContent, "/next:two:false")
  assert.equal(element.querySelector("#page"), rendered)

  await act(() => {
    page.unmount()
  })
  element.remove()
})

test("the root applies the seed head exactly once and cleans it up", async () => {
  setPage(seed("/", {}, { title: "Seed title", description: "Seed description" }))
  const element = host()
  const Outer = ({ children }: { children?: ComponentChildren }) => createElement("div", null, children)
  const Page = () => createElement("p", null, "hello")
  const page = createPage(Page, [Outer])

  await act(() => {
    page.mount(element, context("/"))
  })

  assert.equal(document.title, "Seed title")
  assert.equal(document.querySelectorAll(`meta[${KEEL_HEAD_ATTR}][name="description"]`).length, 1)

  await act(() => {
    page.unmount()
  })
  assert.equal(document.querySelectorAll(`meta[${KEEL_HEAD_ATTR}][name="description"]`).length, 0)
  element.remove()
})

test("createPage marks mount errors with data-keel-mount-error and rethrows", () => {
  setPage(seed("/"))
  const element = host()
  const Page = () => {
    throw new Error("boom")
  }
  const page = createPage(Page)

  assert.throws(() => page.mount(element, context("/")), /boom/)
  const marker = element.querySelector("pre[data-keel-mount-error]")
  assert.ok(marker)
  assert.match(marker.textContent ?? "", /boom/)
  element.remove()
})

test("usePageContext throws outside a pack page", async () => {
  const Probe = () => {
    usePageContext()
    return null
  }
  await assert.rejects(() => render(createElement(Probe)), /must be called inside a pack page/)
})
