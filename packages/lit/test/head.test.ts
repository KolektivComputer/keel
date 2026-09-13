import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { KEEL_HEAD_ATTR, setPage } from "@kolektiv/keel"
import { Head } from "../dist/index.js"
import { seed } from "./helpers.ts"

function keelMeta(name: string): Element | null {
  return document.querySelector(`meta[${KEEL_HEAD_ATTR}][name="${name}"]`)
}

test("Head applies explicit props and cleans up on unmount", async () => {
  setPage(seed("/"))
  const element = document.createElement("keel-head") as Head
  element.title = "Explicit"
  element.description = "Explicit description"
  document.body.append(element)
  await element.updateComplete

  assert.equal(document.title, "Explicit")
  assert.equal(keelMeta("description")?.getAttribute("content"), "Explicit description")
  assert.equal(
    document.querySelector(`meta[${KEEL_HEAD_ATTR}][property="og:title"]`)?.getAttribute("content"),
    "Explicit",
  )

  element.remove()
  assert.equal(keelMeta("description"), null)
  assert.equal(document.querySelector(`meta[${KEEL_HEAD_ATTR}][property="og:title"]`), null)
})

test("Head falls back to the seed head", async () => {
  setPage(seed("/", {}, { title: "Seed", description: "From seed" }))
  const element = document.createElement("keel-head") as Head
  document.body.append(element)
  await element.updateComplete

  assert.equal(document.title, "Seed")
  assert.equal(keelMeta("description")?.getAttribute("content"), "From seed")

  element.remove()
  assert.equal(keelMeta("description"), null)
})
