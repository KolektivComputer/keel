import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, type VisitOptions } from "@kolektiv/keel"
import { defineComponent } from "vue"
import { useForm, type FormState } from "../dist/index.js"
import { render } from "./helpers.ts"

interface Probe {
  current: FormState<{ body: string; tags: string }>
}

function mountForm(): Promise<{ probe: Probe; unmount(): Promise<void> }> {
  const probe = { current: undefined as unknown as Probe["current"] }
  const view = render(
    defineComponent({
      setup() {
        probe.current = useForm({ body: "hi", tags: "" })
        return () => null
      },
    }),
  )
  return view.then((mounted) => ({ probe, unmount: mounted.unmount }))
}

test("useForm tracks dirtiness, set, reset, and clearErrors", async () => {
  const { probe, unmount } = await mountForm()
  const form = probe.current

  assert.equal(form.isDirty, false)
  assert.deepEqual(form.data, { body: "hi", tags: "" })

  form.set("body", "there")
  assert.equal(form.data.body, "there")
  assert.equal(form.isDirty, true)

  form.set({ tags: "news" })
  assert.equal(form.data.tags, "news")

  form.errors = { body: ["required"] }
  assert.deepEqual(form.errors.body, ["required"])

  form.clearErrors()
  assert.deepEqual(form.errors, {})

  form.reset("body")
  assert.equal(form.data.body, "hi")
  assert.equal(form.isDirty, false)

  form.set("body", "x")
  form.reset()
  assert.deepEqual(form.data, { body: "hi", tags: "" })
  assert.equal(form.isDirty, false)

  await unmount()
})

test("useForm submit flows processing, errors, progress, and success", async () => {
  const { probe, unmount } = await mountForm()
  const form = probe.current
  const original = router.visit
  const calls: Array<{ href: string; options?: VisitOptions }> = []
  router.visit = async (href, options) => {
    calls.push({ href, options })
    assert.equal(form.processing, true)
    options?.onError?.({ body: ["required"] })
  }
  try {
    await form.post("/form")
    assert.equal(form.processing, false)
    assert.deepEqual(form.errors.body, ["required"])
    assert.equal(form.wasSuccessful, false)
    assert.equal(calls[0]?.href, "/form")
    assert.equal(calls[0]?.options?.method, "post")
    assert.deepEqual(calls[0]?.options?.data, { body: "hi", tags: "" })

    router.visit = async (_href, options) => {
      options?.onProgress?.({ percentage: 50 })
      options?.onSuccess?.({} as never)
    }
    await form.put("/form")
    assert.equal(form.progress, 50)
    assert.equal(form.wasSuccessful, true)
    assert.deepEqual(form.errors, {})

    const methods: string[] = []
    router.visit = async (_href, options) => {
      methods.push(options?.method ?? "")
      options?.onSuccess?.({} as never)
    }
    await form.get("/form")
    await form.patch("/form")
    await form.delete("/form")
    assert.deepEqual(methods, ["get", "patch", "delete"])
  } finally {
    router.visit = original
    await unmount()
  }
})
