import assert from "node:assert/strict"
import { test } from "node:test"
import { KEEL_HEAD_ATTR, setPage } from "@kolektiv/keel"
import { Head } from "../dist/Head.js"
import { createElement, render, seed } from "./helpers.ts"

function keelMeta(name: string): Element | null {
  return document.querySelector(`meta[${KEEL_HEAD_ATTR}][name="${name}"]`)
}

test("Head applies explicit props and cleans up on unmount", async () => {
  setPage(seed("/"))
  const view = await render(createElement(Head, { title: "Explicit", description: "Explicit description" }))

  assert.equal(document.title, "Explicit")
  assert.equal(keelMeta("description")?.getAttribute("content"), "Explicit description")
  assert.equal(document.querySelector(`meta[${KEEL_HEAD_ATTR}][property="og:title"]`)?.getAttribute("content"), "Explicit")

  await view.unmount()
  assert.equal(keelMeta("description"), null)
  assert.equal(document.querySelector(`meta[${KEEL_HEAD_ATTR}][property="og:title"]`), null)
})

test("Head falls back to the seed head and updates on a new seed", async () => {
  setPage(seed("/", {}, { title: "Seed", description: "From seed" }))
  const view = await render(createElement(Head))

  assert.equal(document.title, "Seed")
  assert.equal(keelMeta("description")?.getAttribute("content"), "From seed")

  await view.unmount()
  assert.equal(keelMeta("description"), null)
})

test("Head renders children into document.head through a portal", async () => {
  setPage(seed("/"))
  const view = await render(createElement(Head, null, createElement("meta", { name: "custom", content: "x" })))

  assert.equal(document.head.querySelector('meta[name="custom"]')?.getAttribute("content"), "x")
  await view.unmount()
  assert.equal(document.head.querySelector('meta[name="custom"]'), null)
})
