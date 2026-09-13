import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement, type ReactNode } from "react"
import { setPage } from "@kolektiv/keel"
import { usePage } from "../dist/page.js"
import { usePageContext } from "../dist/context.js"
import { createPage } from "../dist/mount.js"
import { KEEL_HEAD_ATTR } from "@kolektiv/keel"
import { act, context, seed } from "./helpers.ts"

function host(): HTMLDivElement {
  const el = document.createElement("div")
  document.body.append(el)
  return el
}

test("createPage mounts, nests layouts outermost-first, and unmounts", async () => {
  setPage(seed("/"))
  const element = host()
  const Outer = ({ children }: { children?: ReactNode }) => createElement("section", { id: "outer" }, children)
  const Inner = ({ children }: { children?: ReactNode }) => createElement("div", { id: "inner" }, children)
  const Page = () => createElement("p", { id: "page" }, "hello")
  const page = createPage(Page, [Outer, Inner])

  await act(async () => {
    page.mount(element, context("/"))
  })

  assert.ok(element.querySelector("#outer > #inner > #page"))
  assert.equal(element.textContent, "hello")

  await act(async () => {
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
  const page = createPage(Page)

  await act(async () => {
    page.mount(element, context("/", { title: "one" }))
  })
  assert.equal(element.textContent, "/:one:false")

  await act(async () => {
    setPage(seed("/next", { title: "two" }))
    page.update!(context("/next", { title: "two" }))
  })
  assert.equal(element.textContent, "/next:two:false")

  await act(async () => {
    page.unmount()
  })
  element.remove()
})

test("the root applies the seed head exactly once and cleans it up", async () => {
  setPage(seed("/", {}, { title: "Seed title", description: "Seed description" }))
  const element = host()
  const Outer = ({ children }: { children?: ReactNode }) => createElement("div", null, children)
  const Page = () => createElement("p", null, "hello")
  const page = createPage(Page, [Outer])

  await act(async () => {
    page.mount(element, context("/"))
  })

  assert.equal(document.title, "Seed title")
  assert.equal(document.querySelectorAll(`meta[${KEEL_HEAD_ATTR}][name="description"]`).length, 1)

  await act(async () => {
    page.unmount()
  })
  assert.equal(document.querySelectorAll(`meta[${KEEL_HEAD_ATTR}][name="description"]`).length, 0)
  element.remove()
})
