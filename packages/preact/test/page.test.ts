import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { setPage } from "@kolektiv/keel"
import { usePage, type KeelPage } from "../dist/index.js"
import { act, createElement, render, seed } from "./helpers.ts"

test("usePage caches the snapshot until the seed changes", async () => {
  const page = seed("/", { title: "one" })
  setPage(page)

  let current: KeelPage<{ title: string }> | undefined
  const Probe = () => {
    current = usePage<{ title: string }>()
    return null
  }
  const view = await render(createElement(Probe))

  const snapshot = current!
  assert.equal(snapshot.path, "/")
  assert.equal(snapshot.data.title, "one")
  assert.equal(snapshot.processing, false)
  assert.equal(current, snapshot)

  await act(() => {
    setPage(page)
  })
  assert.equal(current, snapshot)

  await act(() => {
    setPage(seed("/next", { title: "two" }))
  })
  assert.notEqual(current, snapshot)
  assert.equal(current!.path, "/next")
  assert.equal(current!.data.title, "two")

  await view.unmount()
})
