import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { KEEL_HEAD_ATTR, setPage } from "@kolektiv/keel"
import { createApp, defineComponent, h, type Component } from "vue"
import { createPage } from "../dist/mount.js"
import { usePage } from "../dist/index.js"
import { usePageContext } from "../dist/index.js"
import { context, host, seed } from "./helpers.ts"

function layout(id: string): Component {
  return defineComponent({
    setup(_props, { slots }) {
      return () => h("div", { id }, slots.default?.())
    },
  })
}

test("createPage mounts, nests layouts outermost-first, and unmounts", () => {
  setPage(seed("/"))
  const element = host()
  const Page = defineComponent({ setup: () => () => h("p", { id: "page" }, "hello") })
  const page = createPage(Page, [layout("outer"), layout("inner")])

  page.mount(element, context("/"))

  assert.ok(element.querySelector("#outer > #inner > #page"))
  assert.equal(element.textContent, "hello")

  page.unmount()
  assert.equal(element.childNodes.length, 0)
  element.remove()
})

test("createPage provides seed and a reactive PageContext and updates them", async () => {
  setPage(seed("/", { title: "one" }))
  const element = host()
  const Page = defineComponent({
    setup() {
      const ctx = usePageContext<{ title: string }>()
      const current = usePage<{ title: string }>()
      return () =>
        h(
          "p",
          { id: "page" },
          `${ctx.value?.path}:${current.value.data.title}:${String(current.value.processing)}`,
        )
    },
  })
  const page = createPage<{ title: string }>(Page)

  page.mount(element, context("/", { title: "one" }))
  assert.equal(element.textContent, "/:one:false")

  setPage(seed("/next", { title: "two" }))
  await page.update!(context("/next", { title: "two" }))
  assert.equal(element.textContent, "/next:two:false")

  page.unmount()
  element.remove()
})

test("the root applies the seed head exactly once and cleans it up", () => {
  setPage(seed("/", {}, { title: "Seed title", description: "Seed description" }))
  const element = host()
  const Page = defineComponent({ setup: () => () => h("p", null, "hello") })
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
  const Page = defineComponent({
    setup() {
      throw new Error("boom")
    },
    render: () => null,
  })
  const page = createPage(Page)

  assert.throws(() => page.mount(element, context("/")), /boom/)
  const marker = element.querySelector("pre[data-keel-mount-error]")
  assert.ok(marker)
  assert.match(marker.textContent ?? "", /boom/)
  element.remove()
})

test("usePageContext throws outside a pack page", () => {
  let failure: unknown
  const Probe = defineComponent({
    setup() {
      usePageContext()
      return () => null
    },
    render: () => null,
  })
  const app = createApp(Probe)
  app.config.errorHandler = (error) => {
    failure = error
  }
  app.mount(host())
  assert.match(String(failure), /must be called inside a pack page/)
})
