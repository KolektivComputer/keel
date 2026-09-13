import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { setPage } from "@kolektiv/keel"
import { defineComponent, watch, type ShallowRef } from "vue"
import { usePage, type KeelPage } from "../dist/index.js"
import { render, seed } from "./helpers.ts"

test("usePage caches the snapshot until the seed changes", async () => {
  const page = seed("/", { title: "one" })
  setPage(page)

  let current: ShallowRef<KeelPage<{ title: string }>> | undefined
  let changes = 0
  const Probe = defineComponent({
    setup() {
      current = usePage<{ title: string }>()
      watch(current, () => (changes += 1), { flush: "sync" })
      return () => null
    },
  })
  const view = await render(Probe)

  assert.equal(current!.value.path, "/")
  assert.equal(current!.value.data.title, "one")
  assert.equal(current!.value.processing, false)
  assert.equal(changes, 0)

  setPage(page)
  assert.equal(changes, 0)

  setPage(seed("/next", { title: "two" }))
  assert.equal(changes, 1)
  assert.equal(current!.value.path, "/next")
  assert.equal(current!.value.data.title, "two")

  await view.unmount()
})
