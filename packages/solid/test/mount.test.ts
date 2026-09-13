import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { KEEL_HEAD_ATTR, setPage } from "@kolektiv/keel"
import { createRenderEffect, type Component } from "solid-js"
import { usePage, usePageContext } from "../dist/index.js"
import { createPage } from "../dist/mount.js"
import { context, host, render, seed } from "./helpers.ts"

function appendChildren(el: Element, children: unknown): void {
  if (children == null) return
  if (Array.isArray(children)) {
    for (const child of children) appendChildren(el, child)
    return
  }
  if (children instanceof Node) el.append(children)
}

function layout(id: string): Component<{ children?: unknown }> {
  return (props) => {
    const el = document.createElement("div")
    el.id = id
    appendChildren(el, props.children)
    return el
  }
}

test("createPage mounts, nests layouts outermost-first, and unmounts", () => {
  setPage(seed("/"))
  const element = host()
  const Page = () => {
    const p = document.createElement("p")
    p.id = "page"
    p.textContent = "hello"
    return p
  }
  const page = createPage(Page, [layout("outer"), layout("inner")])

  page.mount(element, context("/"))

  assert.ok(element.querySelector("#outer > #inner > #page"))
  assert.equal(element.textContent, "hello")

  page.unmount()
  assert.equal(element.childNodes.length, 0)
  element.remove()
})

test("createPage provides seed and a reactive PageContext and updates them", () => {
  setPage(seed("/", { title: "one" }))
  const element = host()
  const Page = () => {
    const ctx = usePageContext<{ title: string }>()
    const current = usePage<{ title: string }>()
    const p = document.createElement("p")
    p.id = "page"
    createRenderEffect(() => {
      p.textContent = `${ctx().path}:${current().data.title}:${String(current().processing)}`
    })
    return p
  }
  const page = createPage<{ title: string }>(Page)

  page.mount(element, context("/", { title: "one" }))
  assert.equal(element.textContent, "/:one:false")

  setPage(seed("/next", { title: "two" }))
  page.update!(context("/next", { title: "two" }))
  assert.equal(element.textContent, "/next:two:false")

  page.unmount()
  element.remove()
})

test("the root applies the seed head exactly once and cleans it up", () => {
  setPage(seed("/", {}, { title: "Seed title", description: "Seed description" }))
  const element = host()
  const Page = () => document.createElement("p")
  const page = createPage(Page, [layout("outer")])

  page.mount(element, context("/"))

  assert.equal(document.title, "Seed title")
  assert.equal(document.querySelectorAll(`meta[${KEEL_HEAD_ATTR}][name="description"]`).length, 1)

  page.unmount()
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

test("usePageContext throws outside a pack page", () => {
  const Probe = () => {
    usePageContext()
    return null
  }
  assert.throws(() => render(Probe), /must be called inside a pack page/)
})
