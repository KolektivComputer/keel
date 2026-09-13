import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, setPage, type VisitOptions } from "@kolektiv/keel"
import { injectKeelForm, KeelFormDirective, type FormState } from "../dist/index.js"
import { createPage } from "../dist/mount.js"
import { context, host, jit, seed } from "./helpers.ts"

let form: FormState<{ body: string; tags: string }> | undefined

const FormProbe = jit({
  selector: "keel-test-form-probe",
  template: `<p>{{ form.data.body }}|{{ form.processing }}</p>`,
})(class {
  readonly form = injectKeelForm({ body: "hi", tags: "" })
  constructor() {
    form = this.form
  }
})

const FormPage = jit({
  selector: "keel-test-form-page",
  imports: [KeelFormDirective],
  template: `
    <form id="plain" [keelForm]="'/notes'" method="post">
      <input name="body" value="hi" />
    </form>
    <form
      id="reset"
      [keelForm]="{ action: '/notes', method: 'put', resetOnSuccess: true, preserveScroll: true }"
    >
      <input name="body" value="hi" />
    </form>
  `,
})(class {})

async function mountProbe(): Promise<{ element: HTMLDivElement; unmount(): void }> {
  setPage(seed("/"))
  const element = host()
  const page = createPage(FormProbe)
  await page.mount(element, context("/"))
  return { element, unmount: () => page.unmount() }
}

test("injectKeelForm tracks dirtiness, set, reset, and clearErrors", async () => {
  const { element, unmount } = await mountProbe()
  try {
    assert.ok(form)
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

    form.setData({ body: "set", tags: "data" })
    assert.equal(form.isDirty, true)
    form.setErrors({ body: ["bad"] })
    assert.deepEqual(form.errors, { body: ["bad"] })
  } finally {
    unmount()
    element.remove()
  }
})

test("injectKeelForm submit flows processing, errors, progress, and success", async () => {
  const { unmount } = await mountProbe()
  assert.ok(form)
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
    unmount()
  }
})

test("[keelForm] serializes FormData and resets on success", async () => {
  setPage(seed("/"))
  const element = host()
  const page = createPage(FormPage)
  const original = router.visit
  const calls: Array<{ href: string; options?: VisitOptions }> = []
  router.visit = async (href, options) => {
    calls.push({ href, options })
  }
  try {
    await page.mount(element, context("/"))

    const plain = element.querySelector<HTMLFormElement>("#plain")!
    plain.dispatchEvent(new window.SubmitEvent("submit", { bubbles: true, cancelable: true }))
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.href, "/notes")
    assert.equal(calls[0]?.options?.method, "post")
    assert.equal(calls[0]?.options?.preserveState, true)
    assert.equal(calls[0]?.options?.preserveScroll, false)
    assert.ok(calls[0]?.options?.data instanceof FormData)
    assert.equal((calls[0]?.options?.data as FormData).get("body"), "hi")

    const reset = element.querySelector<HTMLFormElement>("#reset")!
    const input = reset.querySelector("input")!
    input.value = "changed"
    reset.dispatchEvent(new window.SubmitEvent("submit", { bubbles: true, cancelable: true }))
    assert.equal(calls.length, 2)
    assert.equal(calls[1]?.options?.method, "put")
    assert.equal(calls[1]?.options?.preserveScroll, true)
    calls[1]?.options?.onSuccess?.({} as never)
    assert.equal(input.value, "hi")
  } finally {
    router.visit = original
    page.unmount()
    element.remove()
  }
})
