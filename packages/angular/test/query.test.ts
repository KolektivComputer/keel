import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ActionError,
  KEEL_PAGE_QUERY_KEY,
  router,
  setPage,
} from "@kolektiv/keel"
import {
  getQueryClient,
  hydrateKeelQuery,
  injectKeelAction,
  injectKeelPageQuery,
  pageQueryKey,
} from "../dist/index.js"
import { createPage } from "../dist/mount.js"
import { context, flush, host, jit, seed } from "./helpers.ts"

let actionProbe: { save: ReturnType<typeof injectKeelAction<{ name: string }, { ok: boolean }>> } | undefined
let reloadProbe: { tick: ReturnType<typeof injectKeelAction<Record<string, never>, number>> } | undefined
let queryProbe: { query: ReturnType<typeof injectKeelPageQuery<{ title: string }>> } | undefined

const ActionProbe = jit({
  selector: "keel-test-action-probe",
  template: `<p>{{ save.isSuccess() ? "ok" : "idle" }}</p>`,
})(class {
  readonly save = injectKeelAction<{ name: string }, { ok: boolean }>("demo.save")
  constructor() {
    actionProbe = this
  }
})

const ReloadProbe = jit({
  selector: "keel-test-reload-probe",
  template: `<p>tick</p>`,
})(class {
  readonly tick = injectKeelAction<Record<string, never>, number>("demo.tick", { reload: false })
  constructor() {
    reloadProbe = this
  }
})

const QueryProbe = jit({
  selector: "keel-test-query-probe",
  template: `<p>{{ query.data()?.path ?? "" }}</p>`,
})(class {
  readonly query = injectKeelPageQuery<{ title: string }>()
  constructor() {
    queryProbe = this
  }
})

async function mountProbe<T>(Page: T): Promise<{ element: HTMLDivElement; unmount(): void }> {
  const element = host()
  const page = createPage(Page)
  await page.mount(element, context("/"))
  return { element, unmount: () => page.unmount() }
}

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

test("injectKeelAction reloads, hydrates, and invalidates the root key on success", async () => {
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

  const { unmount } = await mountProbe(ActionProbe)
  try {
    assert.ok(actionProbe)
    const result = await actionProbe.save.mutateAsync({ name: "x" })
    assert.deepEqual(result, { ok: true })
    assert.deepEqual(reloads, [{ preserveScroll: true, preserveState: true }])
    assert.equal(client.getQueryData(KEEL_PAGE_QUERY_KEY), page)
    assert.deepEqual(invalidations, [
      { filters: { queryKey: KEEL_PAGE_QUERY_KEY, refetchType: "none" }, options: undefined },
    ])

    await flush()
    assert.equal(actionProbe.save.isSuccess(), true)
    assert.deepEqual(actionProbe.save.data(), { ok: true })
    assert.equal(actionProbe.save.isPending(), false)
  } finally {
    globalThis.fetch = originalFetch
    router.reload = originalReload
    client.invalidateQueries = originalInvalidate
    unmount()
  }
})

test("injectKeelAction with reload false keeps the current page", async () => {
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

  const { unmount } = await mountProbe(ReloadProbe)
  try {
    assert.ok(reloadProbe)
    assert.equal(await reloadProbe.tick.mutateAsync({}), 1)
    assert.equal(reloads, 0)
    assert.equal(client.getQueryData(KEEL_PAGE_QUERY_KEY), undefined)
  } finally {
    globalThis.fetch = originalFetch
    router.reload = originalReload
    unmount()
  }
})

test("injectKeelAction surfaces ActionError from a 422", async () => {
  const originalFetch = globalThis.fetch
  const originalReload = router.reload
  router.reload = async () => undefined
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ errors: { name: ["required"] } }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch

  const { unmount } = await mountProbe(ActionProbe)
  try {
    assert.ok(actionProbe)
    let error: unknown
    try {
      await actionProbe.save.mutateAsync({ name: "x" })
    } catch (caught) {
      error = caught
    }
    assert.ok(error instanceof ActionError)
    assert.deepEqual((error as ActionError).errors, { name: ["required"] })
  } finally {
    globalThis.fetch = originalFetch
    router.reload = originalReload
    unmount()
  }
})

test("injectKeelPageQuery starts from the seed and refetches through router.reload", async () => {
  const client = getQueryClient()
  client.clear()
  const first = seed("/p/hello", { title: "hi" })
  setPage(first)

  const originalReload = router.reload
  const reloads: unknown[] = []
  const next = seed("/p/next", { title: "next" })
  router.reload = async (options) => {
    reloads.push(options)
    setPage(next)
  }

  const { unmount } = await mountProbe(QueryProbe)
  try {
    assert.ok(queryProbe)
    assert.equal(queryProbe.query.data()?.path, "/p/hello")
    const result = await queryProbe.query.refetch()
    assert.deepEqual(reloads, [{ preserveScroll: true, preserveState: true }])
    assert.equal(result.data?.path, "/p/next")
    assert.equal(result.data?.data.title, "next")
  } finally {
    router.reload = originalReload
    unmount()
  }
})
