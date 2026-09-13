import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, type VisitOptions } from "@kolektiv/keel"
import { LitElement, nothing } from "lit"
import { useForm, type FormState } from "../dist/index.js"
import { host } from "./helpers.ts"

class FormProbe extends LitElement {
  readonly form = useForm(this, { body: "hi", tags: "" })
  render() {
    return nothing
  }
}

customElements.define("test-form-probe", FormProbe)

function mountForm(): { probe: FormProbe; cleanup(): void } {
  const view = host()
  const probe = document.createElement("test-form-probe") as FormProbe
  view.append(probe)
  return {
    probe,
    cleanup() {
      view.remove()
    },
  }
}

test("useForm tracks dirtiness, set, reset, and clearErrors", async () => {
  const { probe, cleanup } = mountForm()
  await probe.updateComplete
  const form: FormState<{ body: string; tags: string }> = probe.form

  assert.equal(form.isDirty, false)
  assert.deepEqual(form.data, { body: "hi", tags: "" })

  form.set("body", "there")
  assert.equal(form.data.body, "there")
  assert.equal(form.isDirty, true)
  await probe.updateComplete

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

  cleanup()
})

test("useForm submit flows processing, errors, progress, and success", async () => {
  const { probe, cleanup } = mountForm()
  await probe.updateComplete
  const form = probe.form
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
    cleanup()
  }
})
