import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, type KeelSeed, type VisitOptions } from "@kolektiv/keel"
import { Form } from "../dist/index.js"
import { dispatch, render, seed } from "./helpers.ts"

interface VisitCall {
  href: string
  options?: VisitOptions
}

function input(value = "seed"): HTMLInputElement {
  const el = document.createElement("input")
  el.name = "body"
  el.defaultValue = value
  return el
}

function renderForm(props: Record<string, unknown>) {
  return render(Form, { children: input(), ...props })
}

test("Form submits FormData and resets on success when asked", async () => {
  const calls: VisitCall[] = []
  const original = router.visit
  router.visit = async (href, options) => {
    calls.push({ href, options })
  }
  try {
    const view = renderForm({ action: "/notes", method: "post", resetOnSuccess: true })
    const form = view.host.querySelector("form")!
    const field = form.querySelector("input") as HTMLInputElement
    field.value = "typed"
    let resets = 0
    const originalReset = form.reset.bind(form)
    form.reset = () => {
      resets += 1
      originalReset()
    }

    const event = new window.Event("submit", { bubbles: true, cancelable: true })
    dispatch(form, event)

    assert.equal(event.defaultPrevented, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.href, "/notes")
    assert.equal(calls[0]?.options?.method, "post")
    const data = calls[0]?.options?.data
    assert.ok(data instanceof FormData)
    assert.equal((data as FormData).get("body"), "typed")
    assert.equal(calls[0]?.options?.preserveState, true)
    assert.equal(resets, 0)

    await calls[0]?.options?.onSuccess?.(seed("/notes") as KeelSeed)
    assert.equal(resets, 1)
    assert.equal(field.value, "seed")
    view.unmount()
  } finally {
    router.visit = original
  }
})

test("Form leaves the fields alone when resetOnSuccess is absent", async () => {
  const calls: VisitCall[] = []
  const original = router.visit
  router.visit = async (href, options) => {
    calls.push({ href, options })
  }
  try {
    const view = renderForm({ action: "/notes" })
    const form = view.host.querySelector("form")!
    let resets = 0
    form.reset = () => {
      resets += 1
    }
    dispatch(form, new window.Event("submit", { bubbles: true, cancelable: true }))
    await calls[0]?.options?.onSuccess?.(seed("/notes") as KeelSeed)
    assert.equal(resets, 0)
    view.unmount()
  } finally {
    router.visit = original
  }
})

test("Form calls a caller onSubmit first and respects preventDefault", () => {
  const calls: VisitCall[] = []
  const original = router.visit
  router.visit = async (href, options) => {
    calls.push({ href, options })
  }
  try {
    const events: string[] = []
    const view = renderForm({
      action: "/notes",
      onSubmit: (event: SubmitEvent) => {
        events.push("submit")
        event.preventDefault()
      },
    })
    const form = view.host.querySelector("form")!
    dispatch(form, new window.Event("submit", { bubbles: true, cancelable: true }))
    assert.deepEqual(events, ["submit"])
    assert.equal(calls.length, 0)
    view.unmount()
  } finally {
    router.visit = original
  }
})
