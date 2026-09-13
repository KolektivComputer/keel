import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { setPage } from "@kolektiv/keel"
import type { Accessor } from "solid-js"
import { usePage, type KeelPage } from "../dist/index.js"
import { render, seed } from "./helpers.ts"

test("usePage caches the snapshot until the seed changes", () => {
  const page = seed("/", { title: "one" })
  setPage(page)

  let current: Accessor<KeelPage<{ title: string }>> | undefined
  const Probe = () => {
    current = usePage<{ title: string }>()
    return null
  }
  const view = render(Probe)

  const snapshot = current!()
  assert.equal(snapshot.path, "/")
  assert.equal(snapshot.data.title, "one")
  assert.equal(snapshot.processing, false)
  assert.equal(current!(), snapshot)

  setPage(page)
  assert.equal(current!(), snapshot)

  setPage(seed("/next", { title: "two" }))
  assert.notEqual(current!(), snapshot)
  assert.equal(current!().path, "/next")
  assert.equal(current!().data.title, "two")

  view.unmount()
})
