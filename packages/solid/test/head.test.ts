import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { KEEL_HEAD_ATTR, setPage } from "@kolektiv/keel"
import { Head } from "../dist/index.js"
import { render, seed } from "./helpers.ts"

function keelMeta(name: string): Element | null {
  return document.querySelector(`meta[${KEEL_HEAD_ATTR}][name="${name}"]`)
}

test("Head applies explicit props and cleans up on unmount", () => {
  setPage(seed("/"))
  const view = render(Head, { title: "Explicit", description: "Explicit description" })

  assert.equal(document.title, "Explicit")
  assert.equal(keelMeta("description")?.getAttribute("content"), "Explicit description")
  assert.equal(
    document.querySelector(`meta[${KEEL_HEAD_ATTR}][property="og:title"]`)?.getAttribute("content"),
    "Explicit",
  )

  view.unmount()
  assert.equal(keelMeta("description"), null)
  assert.equal(document.querySelector(`meta[${KEEL_HEAD_ATTR}][property="og:title"]`), null)
})

test("Head falls back to the seed head and updates on a new seed", () => {
  setPage(seed("/", {}, { title: "Seed", description: "From seed" }))
  const view = render(Head)

  assert.equal(document.title, "Seed")
  assert.equal(keelMeta("description")?.getAttribute("content"), "From seed")

  view.unmount()
  assert.equal(keelMeta("description"), null)
})

test("Head renders children into document.head through a portal", () => {
  setPage(seed("/"))
  const meta = document.createElement("meta")
  meta.setAttribute("name", "custom")
  meta.setAttribute("content", "x")
  const view = render(Head, { children: meta })

  assert.equal(document.head.querySelector('meta[name="custom"]')?.getAttribute("content"), "x")
  view.unmount()
  assert.equal(document.head.querySelector('meta[name="custom"]'), null)
})
