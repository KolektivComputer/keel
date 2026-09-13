import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { KEEL_PAGE_QUERY_KEY, pageQueryKey, router, setPage, ActionError } from "@kolektiv/keel"
import type { UseMutationReturnType, UseQueryReturnType } from "@tanstack/vue-query"
import { defineComponent } from "vue"
import { getQueryClient, hydrateKeelQuery, useAction, useKeelPageQuery } from "../dist/index.js"
import { render, seed } from "./helpers.ts"

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

  let mutation: UseMutationReturnType<{ ok: boolean }, ActionError, { name: string }, unknown> | undefined
  const Probe = defineComponent({
    setup() {
      mutation = useAction<{ name: string }, { ok: boolean }>("demo.save")
      return () => null
    },
  })
  const view = await render(Probe)
  try {
    const result = await mutation!.mutateAsync({ name: "x" })
    assert.deepEqual(result, { ok: true })
    assert.deepEqual(reloads, [{ preserveScroll: true, preserveState: true }])
    assert.equal(client.getQueryData(KEEL_PAGE_QUERY_KEY), page)
    assert.deepEqual(invalidations, [
      { filters: { queryKey: KEEL_PAGE_QUERY_KEY, refetchType: "none" }, options: undefined },
    ])
  } finally {
    globalThis.fetch = originalFetch
    router.reload = originalReload
    client.invalidateQueries = originalInvalidate
    await view.unmount()
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

  let mutation: UseMutationReturnType<number, ActionError, Record<string, never>, unknown> | undefined
  const Probe = defineComponent({
    setup() {
      mutation = useAction<Record<string, never>, number>("demo.tick", { reload: false })
      return () => null
    },
  })
  const view = await render(Probe)
  try {
    assert.equal(await mutation!.mutateAsync({}), 1)
    assert.equal(reloads, 0)
    assert.equal(client.getQueryData(KEEL_PAGE_QUERY_KEY), undefined)
  } finally {
    globalThis.fetch = originalFetch
    router.reload = originalReload
    await view.unmount()
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

  let mutation: UseMutationReturnType<unknown, ActionError, Record<string, never>, unknown> | undefined
  const Probe = defineComponent({
    setup() {
      mutation = useAction<Record<string, never>, unknown>("demo.save")
      return () => null
    },
  })
  const view = await render(Probe)
  try {
    let error: unknown
    try {
      await mutation!.mutateAsync({})
    } catch (caught) {
      error = caught
    }
    assert.ok(error instanceof ActionError)
    assert.deepEqual((error as ActionError).errors, { name: ["required"] })
  } finally {
    globalThis.fetch = originalFetch
    router.reload = originalReload
    await view.unmount()
  }
})

test("useKeelPageQuery exposes the current seed as initial data", async () => {
  const client = getQueryClient()
  client.clear()
  const page = seed("/p/hello", { title: "hi" })
  setPage(page)

  let query: UseQueryReturnType<typeof page, Error> | undefined
  const Probe = defineComponent({
    setup() {
      query = useKeelPageQuery<{ title: string }>()
      return () => null
    },
  })
  const view = await render(Probe)
  try {
    assert.deepEqual(query!.data.value, page)
    assert.equal(client.getQueryData(KEEL_PAGE_QUERY_KEY), page)
    assert.equal(query!.isSuccess.value, true)
  } finally {
    await view.unmount()
  }
})
