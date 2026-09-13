import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { ActionError, KEEL_PAGE_QUERY_KEY, pageQueryKey, router, setPage } from "@kolektiv/keel"
import { html, LitElement, nothing } from "lit"
import {
  getQueryClient,
  hydrateKeelQuery,
  useAction,
  useKeelPageQuery,
} from "../dist/index.js"
import { flush, host, seed } from "./helpers.ts"

class ActionProbe extends LitElement {
  readonly save = useAction<{ name: string }, { ok: boolean }>(this, "demo.save")
  render() {
    return nothing
  }
}

class NoReloadProbe extends LitElement {
  readonly tick = useAction<Record<string, never>, number>(this, "demo.tick", { reload: false })
  render() {
    return nothing
  }
}

class PageQueryProbe extends LitElement {
  readonly query = useKeelPageQuery(this)
  render() {
    return html`${this.query.data?.page ?? ""}`
  }
}

customElements.define("test-action-probe", ActionProbe)
customElements.define("test-no-reload-probe", NoReloadProbe)
customElements.define("test-page-query-probe", PageQueryProbe)

test("query keys follow the core convention", () => {
  assert.deepEqual(KEEL_PAGE_QUERY_KEY, ["keel", "page"])
  assert.deepEqual(pageQueryKey("/p/hello"), ["keel", "page", "/p/hello"])
})

test("hydrateKeelQuery fills the root and path keys", () => {
  const client = getQueryClient()
  client.clear()
  const page = seed("/p/hello", { title: "hi" })
  hydrateKeelQuery(page)
  assert.equal(client.getQueryData(KEEL_PAGE_QUERY_KEY), page)
  assert.equal(client.getQueryData(pageQueryKey("/p/hello")), page)
})

test("useAction reloads, hydrates, and invalidates the root key on success", async () => {
  const client = getQueryClient()
  client.clear()
  const page = seed("/p/hello", { title: "hi" })
  setPage(page)

  const originalFetch = globalThis.fetch
  const originalReload = router.reload
  const invalidations: unknown[] = []
  const originalInvalidate = client.invalidateQueries.bind(client)
  client.invalidateQueries = (async (filters: unknown, options: unknown) => {
    invalidations.push({ filters, options })
    return originalInvalidate(filters as never, options as never)
  }) as typeof client.invalidateQueries

  const reloads: unknown[] = []
  router.reload = async (options) => {
    reloads.push(options)
  }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), "/__keel/action/demo.save")
    assert.equal(init?.method, "POST")
    assert.deepEqual(JSON.parse(String(init?.body)), { name: "x" })
    return new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }) as typeof fetch

  const view = host()
  const probe = document.createElement("test-action-probe") as ActionProbe
  view.append(probe)
  await probe.updateComplete
  try {
    const result = await probe.save.mutateAsync({ name: "x" })
    assert.deepEqual(result, { ok: true })
    assert.deepEqual(reloads, [{ preserveScroll: true, preserveState: true }])
    assert.equal(client.getQueryData(KEEL_PAGE_QUERY_KEY), page)
    assert.deepEqual(invalidations, [
      { filters: { queryKey: KEEL_PAGE_QUERY_KEY, refetchType: "none" }, options: undefined },
    ])

    await flush()
    assert.equal(probe.save.isSuccess, true)
    assert.deepEqual(probe.save.data, { ok: true })
    await probe.updateComplete
    assert.equal(probe.save.isPending, false)
  } finally {
    globalThis.fetch = originalFetch
    router.reload = originalReload
    client.invalidateQueries = originalInvalidate
    view.remove()
  }
})

test("useAction with reload false keeps the current page", async () => {
  const client = getQueryClient()
  client.clear()
  const originalFetch = globalThis.fetch
  const originalReload = router.reload
  let reloads = 0
  router.reload = async () => {
    reloads += 1
  }
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ data: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch

  const view = host()
  const probe = document.createElement("test-no-reload-probe") as NoReloadProbe
  view.append(probe)
  await probe.updateComplete
  try {
    assert.equal(await probe.tick.mutateAsync({}), 1)
    assert.equal(reloads, 0)
    assert.equal(client.getQueryData(KEEL_PAGE_QUERY_KEY), undefined)
  } finally {
    globalThis.fetch = originalFetch
    router.reload = originalReload
    view.remove()
  }
})

test("useAction surfaces ActionError from a 422", async () => {
  const originalFetch = globalThis.fetch
  const originalReload = router.reload
  router.reload = async () => undefined
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ errors: { name: ["required"] } }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch

  const view = host()
  const probe = document.createElement("test-action-probe") as ActionProbe
  view.append(probe)
  await probe.updateComplete
  try {
    let error: unknown
    try {
      await probe.save.mutateAsync({ name: "x" })
    } catch (caught) {
      error = caught
    }
    assert.ok(error instanceof ActionError)
    assert.deepEqual((error as ActionError).errors, { name: ["required"] })
  } finally {
    globalThis.fetch = originalFetch
    router.reload = originalReload
    view.remove()
  }
})

test("useKeelPageQuery exposes the current seed as initial data", async () => {
  const client = getQueryClient()
  client.clear()
  const page = seed("/p/hello", { title: "hi" })
  setPage(page)

  const view = host()
  const probe = document.createElement("test-page-query-probe") as PageQueryProbe
  view.append(probe)
  await probe.updateComplete
  try {
    assert.equal(probe.query.data, page)
    assert.equal(probe.query.current.isSuccess, true)
    assert.equal(client.getQueryData(KEEL_PAGE_QUERY_KEY), page)
    await probe.updateComplete
    assert.equal(probe.shadowRoot!.textContent, "harbor.home")
  } finally {
    view.remove()
  }
})
