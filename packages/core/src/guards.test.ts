import assert from "node:assert/strict"
import { test } from "node:test"
import { beforeEach, clearGuards } from "./guards.ts"
import { currentSeedIndex, pushSeed, restoreSteps, seedIndexFromHistory } from "./history.ts"
import { clearPrefetch } from "./prefetch.ts"
import { bootstrap, router } from "./router.ts"
import { getPage, peekPage } from "./store.ts"
import type { KeelSeed, NavigationTarget, PendingVisit } from "./types.ts"

const MODULE_ENTRY = `data:text/javascript,${encodeURIComponent(
  "export function mount() {};export function unmount() {}",
)}`

function seed(page: string, patch: Partial<KeelSeed> = {}): KeelSeed {
  return {
    v: 1,
    page,
    path: `/${page}`,
    params: {},
    data: {},
    errors: {},
    theme: { id: "t", version: "1" },
    entry: MODULE_ENTRY,
    css: [],
    host: "#__keel_root",
    ...patch,
  }
}

function globals(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>
}

interface FakeWindow {
  scrollX: number
  scrollY: number
  scrollTo(): void
  addEventListener(type: string, listener: (event: unknown) => void): void
  removeEventListener(type: string, listener: (event: unknown) => void): void
  __keelHistory?: boolean
  dispatch(type: string, event: unknown): void
}

function installWindow(): FakeWindow {
  const listeners = new Map<string, Array<(event: unknown) => void>>()
  const win: FakeWindow = {
    scrollX: 0,
    scrollY: 0,
    scrollTo() {},
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener])
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== listener))
    },
    dispatch(type, event) {
      for (const listener of listeners.get(type) ?? []) listener(event)
    },
  }
  globals().window = win
  return win
}

class FakeHistory {
  entries: Array<Record<string, unknown>> = []
  index = -1
  goCalls: number[] = []

  get state(): Record<string, unknown> | null {
    return this.index >= 0 ? this.entries[this.index] ?? null : null
  }

  pushState(state: Record<string, unknown>): void {
    this.entries.splice(this.index + 1)
    this.entries.push(state)
    this.index += 1
  }

  replaceState(state: Record<string, unknown>): void {
    if (this.index >= 0) this.entries[this.index] = state
  }

  go(delta: number): void {
    this.goCalls.push(delta)
    this.index += delta
  }
}

function installHistory(fake: FakeHistory): void {
  globals().history = fake
}

function stubFetch(seeds: Record<string, KeelSeed>): string[] {
  const calls: string[] = []
  globals().fetch = async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    const found = seeds[url]
    if (!found) return new Response("missing seed", { status: 500 })
    return new Response(JSON.stringify(found), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
  return calls
}

function configureRouter(): void {
  router.configure({ host: {} as Element, focusOnNavigate: false, announce: false })
}

function reset(): void {
  clearGuards()
  clearPrefetch()
  for (const key of ["window", "history", "document", "location", "fetch"]) {
    delete globals()[key]
  }
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test("restoreSteps walks from the target entry back to the mounted page", () => {
  assert.equal(restoreSteps(2, 1), 1)
  assert.equal(restoreSteps(1, 2), -1)
  assert.equal(restoreSteps(1, 1), 0)
  assert.equal(restoreSteps(1, null), 1)
})

test("sync guard false cancels a visit before fetch, URL, or history change", async () => {
  installWindow()
  const fakeHistory = new FakeHistory()
  installHistory(fakeHistory)
  configureRouter()
  const calls = stubFetch({ "/next": seed("next") })
  const stop = beforeEach(() => false)
  const page = peekPage()
  try {
    await router.visit("/next")
    assert.equal(calls.length, 0)
    assert.equal(fakeHistory.entries.length, 0)
    assert.equal(fakeHistory.goCalls.length, 0)
    assert.equal(peekPage(), page)
  } finally {
    stop()
    reset()
  }
})

test("async guards are awaited serially and short-circuit on cancel", async () => {
  installWindow()
  configureRouter()
  const calls = stubFetch({ "/next": seed("next") })
  const order: string[] = []
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const stopFirst = beforeEach(async () => {
    order.push("first:start")
    await gate
    order.push("first:end")
    return false
  })
  let secondRan = false
  const stopSecond = beforeEach(() => {
    secondRan = true
    return true
  })
  try {
    const pending = router.visit("/next")
    await tick()
    assert.deepEqual(order, ["first:start"])
    assert.equal(calls.length, 0)
    release()
    await pending
    assert.deepEqual(order, ["first:start", "first:end"])
    assert.equal(secondRan, false)
    assert.equal(calls.length, 0)
  } finally {
    stopFirst()
    stopSecond()
    reset()
  }
})

test("guard redirects navigate and guards re-run for the target", async () => {
  installWindow()
  configureRouter()
  const calls = stubFetch({ "/b": seed("b") })
  const seen: Array<{ url: string; source: string }> = []
  const stop = beforeEach((to) => {
    seen.push({ url: to.url, source: to.source })
    return to.url === "/a" ? "/b" : undefined
  })
  try {
    await router.visit("/a")
    assert.deepEqual(seen, [
      { url: "/a", source: "visit" },
      { url: "/b", source: "redirect" },
    ])
    assert.deepEqual(calls, ["/b"])
    assert.equal(peekPage()?.path, "/b")
  } finally {
    stop()
    reset()
  }
})

test("guard { redirect } objects also redirect", async () => {
  installWindow()
  configureRouter()
  stubFetch({ "/b": seed("b") })
  const stop = beforeEach((to) => (to.url === "/a" ? { redirect: "/b" } : true))
  try {
    await router.visit("/a")
    assert.equal(peekPage()?.path, "/b")
  } finally {
    stop()
    reset()
  }
})

test("server redirect seeds re-run guards for the target", async () => {
  installWindow()
  configureRouter()
  const calls = stubFetch({ "/a": seed("a", { redirect: "/b" }), "/b": seed("b") })
  const seen: Array<{ url: string; source: string }> = []
  const stop = beforeEach((to) => {
    seen.push({ url: to.url, source: to.source })
    return true
  })
  try {
    await router.visit("/a")
    assert.deepEqual(seen, [
      { url: "/a", source: "visit" },
      { url: "/b", source: "redirect" },
    ])
    assert.deepEqual(calls, ["/a", "/b"])
    assert.equal(peekPage()?.path, "/b")
  } finally {
    stop()
    reset()
  }
})

test("a guard can cancel a server redirect target", async () => {
  installWindow()
  configureRouter()
  const calls = stubFetch({ "/a": seed("a", { redirect: "/b" }), "/b": seed("b") })
  const stop = beforeEach((to) => (to.url === "/b" ? false : undefined))
  const page = peekPage()
  try {
    await router.visit("/a")
    assert.deepEqual(calls, ["/a"])
    assert.equal(peekPage(), page)
  } finally {
    stop()
    reset()
  }
})

test("guard redirect loops are capped", async () => {
  installWindow()
  configureRouter()
  let calls = 0
  const stop = beforeEach(() => {
    calls += 1
    return "/loop"
  })
  try {
    await assert.rejects(router.visit("/start"), /redirects/)
    assert.ok(calls >= 10 && calls <= 12, `guard ran ${calls} times`)
  } finally {
    stop()
    reset()
  }
})

test("force bypasses registered guards but still runs onBefore", async () => {
  installWindow()
  configureRouter()
  const calls = stubFetch({ "/forced": seed("forced") })
  let guardRan = false
  const stop = beforeEach(() => {
    guardRan = true
    return false
  })
  let onBeforeRan = false
  try {
    await router.visit("/forced", {
      force: true,
      onBefore: () => {
        onBeforeRan = true
      },
    })
    assert.equal(guardRan, false)
    assert.equal(onBeforeRan, true)
    assert.equal(calls.length, 1)
    assert.equal(peekPage()?.path, "/forced")
  } finally {
    stop()
    reset()
  }
})

test("prefetch does not run guards", async () => {
  installWindow()
  configureRouter()
  const calls = stubFetch({ "/warm": seed("warm") })
  let guardRan = false
  const stop = beforeEach(() => {
    guardRan = true
    return false
  })
  try {
    await router.prefetch("/warm")
    assert.equal(guardRan, false)
    assert.equal(calls.length, 1)
  } finally {
    stop()
    reset()
  }
})

test("bootstrap does not run guards", async () => {
  installWindow()
  const document = {
    getElementById: (id: string) => (id === "__keel_seed" ? { textContent: JSON.stringify(seed("home")) } : null),
    head: { querySelectorAll: () => [] },
    dispatchEvent: () => true,
  }
  globals().document = document
  let guardRan = false
  const stop = beforeEach(() => {
    guardRan = true
  })
  try {
    await bootstrap({ host: {} as Element, focusOnNavigate: false, announce: false })
    assert.equal(guardRan, false)
    assert.equal(peekPage()?.path, "/home")
  } finally {
    stop()
    reset()
  }
})

test("reload is tagged source reload and stays guardable", async () => {
  installWindow()
  configureRouter()
  stubFetch({ "/page": seed("page") })
  await router.visit("/page")
  const sources: string[] = []
  const stop = beforeEach((to) => {
    sources.push(to.source)
    return false
  })
  try {
    await router.reload()
    assert.deepEqual(sources, ["reload"])
    assert.equal(peekPage()?.path, "/page")
  } finally {
    stop()
    reset()
  }
})

test("before listeners cancel or redirect the PendingVisit", async () => {
  installWindow()
  configureRouter()
  const calls = stubFetch({ "/target": seed("target") })
  const stopCancel = router.on("before", (detail) => {
    ;(detail.visit as PendingVisit).cancel()
  })
  const page = peekPage()
  try {
    await router.visit("/cancelled")
    assert.equal(calls.length, 0)
    assert.equal(peekPage(), page)

    stopCancel()
    let onBeforeRan = false
    const stopRedirect = router.on("before", (detail) => {
      ;(detail.visit as PendingVisit).redirect("/target")
    })
    try {
      await router.visit("/from", {
        onBefore: () => {
          onBeforeRan = true
        },
      })
      assert.equal(onBeforeRan, false)
      assert.equal(peekPage()?.path, "/target")
      assert.deepEqual(calls, ["/target"])
    } finally {
      stopRedirect()
    }
  } finally {
    stopCancel()
    reset()
  }
})

test("a thrown guard rejects the visit without navigating", async () => {
  installWindow()
  configureRouter()
  const calls = stubFetch({ "/boom": seed("boom") })
  const stop = beforeEach(() => {
    throw new Error("guard exploded")
  })
  const page = peekPage()
  try {
    await assert.rejects(router.visit("/boom"), /guard exploded/)
    assert.equal(calls.length, 0)
    assert.equal(peekPage(), page)
  } finally {
    stop()
    reset()
  }
})

test("before event, async onBefore, and guards run in that order", async () => {
  installWindow()
  configureRouter()
  stubFetch({ "/x": seed("x") })
  const order: string[] = []
  const stopBefore = router.on("before", () => order.push("before"))
  const stopFirst = beforeEach(() => {
    order.push("guard:1")
  })
  const stopSecond = beforeEach(async () => {
    order.push("guard:2")
  })
  try {
    await router.visit("/x", {
      onBefore: async () => {
        order.push("onBefore")
        return true
      },
    })
    assert.deepEqual(order, ["before", "onBefore", "guard:1", "guard:2"])
    assert.equal(peekPage()?.path, "/x")
  } finally {
    stopBefore()
    stopFirst()
    stopSecond()
    reset()
  }
})

test("async onBefore can cancel a visit", async () => {
  installWindow()
  configureRouter()
  const calls = stubFetch({ "/y": seed("y") })
  const page = peekPage()
  try {
    await router.visit("/y", {
      onBefore: async () => {
        await Promise.resolve()
        return false
      },
    })
    assert.equal(calls.length, 0)
    assert.equal(peekPage(), page)
  } finally {
    reset()
  }
})

test("guards receive from as the last applied page", async () => {
  installWindow()
  configureRouter()
  stubFetch({ "/one": seed("one"), "/two": seed("two") })
  const froms: string[] = []
  const stop = beforeEach((to, from) => {
    if (to.url === "/two") froms.push(from.url)
  })
  try {
    await router.visit("/one")
    await router.visit("/two")
    assert.deepEqual(froms, ["/one"])
  } finally {
    stop()
    reset()
  }
})

test("blocked popstate keeps the page, restores the entry, and emits the target", async () => {
  const win = installWindow()
  const fakeHistory = new FakeHistory()
  installHistory(fakeHistory)
  configureRouter()
  stubFetch({ "/form": seed("form") })
  pushSeed(seed("home"), false)
  await router.visit("/form")
  assert.equal(getPage().path, "/form")
  assert.equal(fakeHistory.entries.length, 2)

  const blocked: Array<{ to: NavigationTarget; from: NavigationTarget }> = []
  let guardCalls = 0
  const stopBlocked = router.on("blocked", (detail) => {
    blocked.push(detail as { to: NavigationTarget; from: NavigationTarget })
  })
  const stopGuard = beforeEach((to) => {
    guardCalls += 1
    return to.url === "/home" ? false : undefined
  })
  try {
    const targetIndex = seedIndexFromHistory({ state: fakeHistory.entries[0] } as PopStateEvent)
    assert.equal(targetIndex, 1)
    assert.equal(currentSeedIndex(), 2)

    fakeHistory.index = 0
    win.dispatch("popstate", { state: fakeHistory.state })
    await tick()

    assert.equal(getPage().path, "/form")
    assert.equal(fakeHistory.entries.length, 2)
    assert.deepEqual(fakeHistory.goCalls, [1])
    assert.equal(fakeHistory.index, 1)
    assert.equal(blocked.length, 1)
    assert.equal(blocked[0]?.to.url, "/home")
    assert.equal(blocked[0]?.from.url, "/form")

    const entries = [...fakeHistory.entries]
    win.dispatch("popstate", { state: fakeHistory.state })
    await tick()
    assert.equal(guardCalls, 1)
    assert.equal(blocked.length, 1)
    assert.deepEqual(fakeHistory.goCalls, [1])
    assert.deepEqual(fakeHistory.entries, entries)
  } finally {
    stopGuard()
    stopBlocked()
    reset()
  }
})
