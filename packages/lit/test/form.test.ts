import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { router, type KeelSeed, type VisitOptions } from "@kolektiv/keel"
import { html } from "lit"
import { form } from "../dist/index.js"
import { renderInto, seed } from "./helpers.ts"

interface VisitCall {
  href: string
  options?: VisitOptions
}

test("form submits FormData and resets on success when asked", async () => {
  const calls: VisitCall[] = []
  const original = router.visit
  router.visit = async (href, options) => {
    calls.push({ href, options })
  }
  try {
    const container = renderInto(
      form(
        { action: "/notes", method: "post", resetOnSuccess: true },
        html`<input name="body" value="seed" />`,
      ),
    )
    const element = container.querySelector("form")!
    const input = element.querySelector("input") as HTMLInputElement
    input.value = "typed"
    let resets = 0
    const originalReset = element.reset.bind(element)
    element.reset = () => {
      resets += 1
      originalReset()
    }

    const event = new window.Event("submit", { bubbles: true, cancelable: true })
    element.dispatchEvent(event)

    assert.equal(event.defaultPrevented, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.href, "/notes")
    assert.equal(calls[0]?.options?.method, "post")
    const data = calls[0]?.options?.data
    assert.ok(data instanceof FormData)
    assert.equal((data as FormData).get("body"), "typed")
    assert.equal(calls[0]?.options?.preserveState, true)
    assert.equal(resets, 0)

    calls[0]?.options?.onSuccess?.(seed("/notes") as KeelSeed)
    assert.equal(resets, 1)
    assert.equal(input.value, "seed")
    container.remove()
  } finally {
    router.visit = original
  }
})

test("form leaves the fields alone when resetOnSuccess is absent", async () => {
  const calls: VisitCall[] = []
  const original = router.visit
  router.visit = async (href, options) => {
    calls.push({ href, options })
  }
  try {
    const container = renderInto(
      form({ action: "/notes" }, html`<input name="body" value="seed" />`),
    )
    const element = container.querySelector("form")!
    let resets = 0
    element.reset = () => {
      resets += 1
    }
    element.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))
    calls[0]?.options?.onSuccess?.(seed("/notes") as KeelSeed)
    assert.equal(resets, 0)
    container.remove()
  } finally {
    router.visit = original
  }
})

test("form skips a caller-onSubmit-prevented event", async () => {
  const original = router.visit
  let visits = 0
  router.visit = async () => {
    visits += 1
  }
  try {
    const container = renderInto(
      form(
        {
          action: "/notes",
          onSubmit: (event) => event.preventDefault(),
        },
        html`<input name="body" />`,
      ),
    )
    container
      .querySelector("form")!
      .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))
    assert.equal(visits, 0)
    container.remove()
  } finally {
    router.visit = original
  }
})
