import assert from "node:assert/strict"
import { test } from "node:test"
import { createFormState } from "./form.ts"
import { router } from "./router.ts"

test("form state tracks dirtiness, set, and reset", () => {
  const form = createFormState({ body: "hi", tags: "" })
  assert.equal(form.get().isDirty, false)

  form.set("body", "there")
  assert.equal(form.get().data.body, "there")
  assert.equal(form.get().isDirty, true)

  form.set({ tags: "news" })
  assert.equal(form.get().data.tags, "news")
  assert.equal(form.get().isDirty, true)

  form.reset()
  assert.deepEqual(form.get().data, { body: "hi", tags: "" })
  assert.equal(form.get().isDirty, false)

  form.set("body", "x")
  form.reset("body")
  assert.deepEqual(form.get().data, { body: "hi", tags: "" })
  assert.equal(form.get().isDirty, false)
})

test("form subscribers receive the current snapshot on subscribe and on change", () => {
  const form = createFormState({ body: "" })
  const seen: Array<{ processing: boolean; errors: Record<string, string[]> }> = []
  const stop = form.subscribe((state) => seen.push({ processing: state.processing, errors: state.errors }))
  assert.deepEqual(seen, [{ processing: false, errors: {} }])

  form.setErrors({ body: ["required"] })
  form.clearErrors()
  assert.deepEqual(seen, [
    { processing: false, errors: {} },
    { processing: false, errors: { body: ["required"] } },
    { processing: false, errors: {} },
  ])

  stop()
  form.clearErrors()
  assert.equal(seen.length, 3)
})

test("form submit drives processing, errors, and success through router.visit", async () => {
  const form = createFormState({ body: "hi" })
  const original = router.visit
  let sent: unknown
  router.visit = async (_href, options) => {
    sent = options?.data
    assert.equal(form.get().processing, true)
    options?.onError?.({ body: ["required"] })
  }
  try {
    await form.submit("post", "/form")
    assert.equal(form.get().processing, false)
    assert.deepEqual(form.get().errors.body, ["required"])
    assert.equal(form.get().wasSuccessful, false)

    router.visit = async (_href, options) => {
      options?.onProgress?.({ percentage: 50 })
      options?.onSuccess?.({} as never)
    }
    await form.submit("post", "/form")
    assert.equal(form.get().processing, false)
    assert.equal(form.get().wasSuccessful, true)
    assert.deepEqual(form.get().errors, {})
    assert.equal(form.get().progress, 50)
  } finally {
    router.visit = original
  }
  assert.deepEqual(sent, { body: "hi" })
})
