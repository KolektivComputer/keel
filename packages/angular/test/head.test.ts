import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { KEEL_HEAD_ATTR, setPage } from "@kolektiv/keel"
import { KeelHead } from "../dist/index.js"
import { createPage } from "../dist/mount.js"
import { context, host, jit, seed } from "./helpers.ts"

function keelMeta(name: string): Element | null {
  return document.querySelector(`meta[${KEEL_HEAD_ATTR}][name="${name}"]`)
}

const ExplicitPage = jit({
  selector: "keel-test-head-explicit",
  imports: [KeelHead],
  template: `<keel-head title="Explicit" description="Explicit description" />`,
})(class {})

const FallbackPage = jit({
  selector: "keel-test-head-fallback",
  imports: [KeelHead],
  template: `<keel-head />`,
})(class {})

test("KeelHead applies explicit inputs and cleans up on unmount", async () => {
  setPage(seed("/"))
  const element = host()
  const page = createPage(ExplicitPage)
  await page.mount(element, context("/"))

  assert.equal(document.title, "Explicit")
  assert.equal(keelMeta("description")?.getAttribute("content"), "Explicit description")
  assert.equal(
    document.querySelector(`meta[${KEEL_HEAD_ATTR}][property="og:title"]`)?.getAttribute("content"),
    "Explicit",
  )

  page.unmount()
  assert.equal(keelMeta("description"), null)
  assert.equal(document.querySelector(`meta[${KEEL_HEAD_ATTR}][property="og:title"]`), null)
  element.remove()
})

test("KeelHead falls back to the seed head", async () => {
  setPage(seed("/", {}, { title: "Seed", description: "From seed" }))
  const element = host()
  const page = createPage(FallbackPage)
  await page.mount(element, context("/"))

  assert.equal(document.title, "Seed")
  assert.equal(keelMeta("description")?.getAttribute("content"), "From seed")

  page.unmount()
  assert.equal(keelMeta("description"), null)
  element.remove()
})
