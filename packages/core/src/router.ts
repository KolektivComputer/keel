import { announce, focusHost } from "./a11y.ts"
import { toContext } from "./context.ts"
import { syncCss } from "./css.ts"
import { emit, on } from "./events.ts"
import { beforeEach, runGuards } from "./guards.ts"
import {
  currentSeedIndex,
  pushSeed,
  restoreSteps,
  seedFromHistory,
  seedIndexFromHistory,
} from "./history.ts"
import { cacheSeed, clearPrefetch, prefetchSeed, readSeed, warmModule } from "./prefetch.ts"
import { beginVisit, endVisit, getPage, peekPage, setPage } from "./store.ts"
import { sendVisit } from "./transport.ts"
import {
  KEEL_HEADERS,
  type KeelSeed,
  type Method,
  type NavigationSource,
  type NavigationTarget,
  type PageModule,
  type PendingVisit,
  type VisitOptions,
} from "./types.ts"

export interface RouterConfig {
  navigatePath?: string
  host?: Element | null
  focusOnNavigate?: boolean
  announce?: boolean | ((seed: KeelSeed) => string)
}

interface VisitResult {
  seed: KeelSeed
  partial: string[] | null
}

/** Internal navigation identity: how it started and how many redirects deep. */
interface NavMeta {
  source: NavigationSource
  redirects: number
}

const MAX_REDIRECTS = 10

let config: RouterConfig = {}
let mounted: PageModule | null = null
let currentEntry: string | null = null
let mountedBuild: string | null = null
let inflight: AbortController | null = null
/** Last seed applied to the page; best-effort `from` for guards. */
let lastTarget: NavigationTarget | null = null
/** Popstate events still owed to a `history.go` restore are skipped. */
let restoring = 0

const pendingRedirects = new WeakMap<PendingVisit, { href: string | null }>()

/** Thrown when a visit raced a host-side pack swap; the page is reloading. */
export class KeelBuildMismatchError extends Error {
  readonly build: string | null

  constructor(build: string | null) {
    super(`Keel: pack build changed to ${build ?? "unknown"}; reloading`)
    this.name = "KeelBuildMismatchError"
    this.build = build
  }
}

/**
 * True when the mounted pack build is known and differs from the build the
 * server just advertised. Unknown builds on either side never trigger a
 * reload, so older hosts and first paints are unaffected.
 */
export function isBuildMismatch(
  mountedBuild: string | null | undefined,
  responseBuild: string | null | undefined,
): boolean {
  if (!mountedBuild || !responseBuild) return false
  return mountedBuild !== responseBuild
}

function reloadForBuildMismatch(): void {
  clearPrefetch()
  if (typeof window !== "undefined") window.location.reload()
}

function hostEl(seed: KeelSeed): Element {
  if (config.host) return config.host
  const el = document.querySelector(seed.host || "#__keel_root")
  if (!el) throw new Error(`Keel: host node '${seed.host}' not found`)
  return el
}

function shouldPreserveScroll(options: VisitOptions, seed: KeelSeed): boolean {
  if (options.preserveScroll === "errors") return seed.hasOwnProperty("errors") && Object.keys(seed.errors).length > 0
  return Boolean(options.preserveScroll)
}

function buildUrl(href: string, method: Method, data: VisitOptions["data"]): string {
  if (method !== "get" || !data || data instanceof FormData) return href
  const url = new URL(href, typeof location === "undefined" ? "http://local.test" : location.origin)
  const params = data instanceof URLSearchParams ? data : new URLSearchParams()
  if (!(data instanceof URLSearchParams) && !(data instanceof FormData)) {
    for (const [key, value] of Object.entries(data)) {
      if (value == null) continue
      params.set(key, String(value))
    }
  }
  params.forEach((value, key) => url.searchParams.set(key, value))
  return url.pathname + url.search
}

export function visitRequestUrl(href: string, navigatePath?: string): string {
  if (navigatePath) return `${navigatePath}?to=${encodeURIComponent(href)}`
  return href
}

function mergePartial(seed: KeelSeed, partial: string[] | null): KeelSeed {
  if (!partial) return seed
  const previous = peekPage()?.data
  if (!previous || typeof previous !== "object" || Array.isArray(previous)) return seed
  if (!seed.data || typeof seed.data !== "object" || Array.isArray(seed.data)) return seed
  return { ...seed, data: { ...(previous as Record<string, unknown>), ...(seed.data as Record<string, unknown>) } }
}

function announcementFor(seed: KeelSeed): string | null {
  const option = config.announce
  if (option === false) return null
  if (typeof option === "function") return option(seed)
  return seed.head?.title ?? (typeof document !== "undefined" ? document.title : "")
}

function resolveHref(href: string): string {
  if (typeof location === "undefined") return href
  try {
    const url = new URL(href, location.href)
    return url.pathname + url.search + url.hash
  } catch {
    return href
  }
}

function currentUrl(): string | null {
  if (typeof location === "undefined") return null
  return location.pathname + location.search + location.hash
}

/**
 * Best-effort `from` for guards: the current URL plus the method/source of the
 * last applied seed (default `get`/`visit`).
 */
function currentTarget(): NavigationTarget {
  return {
    url: currentUrl() ?? lastTarget?.url ?? "",
    method: lastTarget?.method ?? "get",
    replace: lastTarget?.replace ?? false,
    source: lastTarget?.source ?? "visit",
  }
}

function createPendingVisit(url: string, method: Method): PendingVisit {
  const state = { href: null as string | null }
  const visit: PendingVisit = {
    url,
    method,
    cancelled: false,
    cancel() {
      visit.cancelled = true
    },
    redirect(href: string) {
      state.href = href
    },
  }
  pendingRedirects.set(visit, state)
  return visit
}

function redirectOf(visit: PendingVisit): string | null {
  return pendingRedirects.get(visit)?.href ?? null
}

async function fetchSeed(href: string, options: VisitOptions, signal: AbortSignal): Promise<VisitResult> {
  const method = options.method ?? "get"
  const url = visitRequestUrl(href, config.navigatePath)
  const headers = new Headers(options.headers)
  headers.set(KEEL_HEADERS.visit, "true")
  headers.set("Accept", "application/json")
  if (options.only?.length) headers.set(KEEL_HEADERS.only, options.only.join(","))
  if (options.except?.length) headers.set(KEEL_HEADERS.except, options.except.join(","))

  let body: BodyInit | undefined
  if (method !== "get" && options.data) {
    if (options.data instanceof FormData) {
      body = options.data
    } else {
      headers.set("Content-Type", "application/json")
      body = JSON.stringify(options.data)
    }
  }

  const response = await sendVisit(url, {
    method: method.toUpperCase(),
    headers,
    body,
    signal,
    onProgress: options.onProgress,
  })
  const build = response.headers.get(KEEL_HEADERS.build)
  if (isBuildMismatch(mountedBuild, build)) {
    reloadForBuildMismatch()
    throw new KeelBuildMismatchError(build)
  }
  const partialHeader = response.headers.get(KEEL_HEADERS.partial)
  const partial = partialHeader != null ? partialHeader.split(",").map((part) => part.trim()).filter(Boolean) : null

  if (response.status === 422 || response.status === 404) {
    const seed = (await response.json()) as KeelSeed
    if (seed && typeof seed.page === "string") return { seed, partial }
  }
  if (!response.ok) {
    throw new Error(`Keel visit failed (${response.status}) for ${href}`)
  }
  return { seed: (await response.json()) as KeelSeed, partial }
}

async function applySeed(
  seed: KeelSeed,
  options: VisitOptions,
  replace: boolean,
  meta: { initial?: boolean; target?: NavigationTarget } = {},
): Promise<boolean> {
  if (isBuildMismatch(mountedBuild, seed.build)) {
    reloadForBuildMismatch()
    return false
  }
  if (seed.build) mountedBuild = seed.build
  const sameEntry = currentEntry === seed.entry
  const samePage = peekPage()?.page === seed.page
  const preserve = Boolean(options.preserveState) && sameEntry && samePage && mounted?.update

  const run = async () => {
    const previousScroll = { x: window.scrollX, y: window.scrollY }
    if (preserve && mounted?.update) {
      setPage(seed)
      await mounted.update(toContext(seed, (href, opts) => visit(href, opts)))
    } else {
      if (mounted) await mounted.unmount()
      const mod = (await import(/* @vite-ignore */ seed.entry)) as PageModule
      mounted = mod
      currentEntry = seed.entry
      setPage(seed)
      await mod.mount(hostEl(seed), toContext(seed, (href, opts) => visit(href, opts)))
    }
    syncCss(seed.css ?? [])
    pushSeed(seed, replace)
    if (!shouldPreserveScroll(options, seed)) window.scrollTo(0, 0)
    else window.scrollTo(previousScroll.x, previousScroll.y)
    if (!meta.initial) {
      if (config.focusOnNavigate !== false) focusHost(hostEl(seed))
      const text = announcementFor(seed)
      if (text) announce(text)
    }
    if (meta.target) lastTarget = meta.target
    emit("navigate", { page: seed })
  }

  if (options.viewTransition && typeof document !== "undefined" && "startViewTransition" in document) {
    await document.startViewTransition(() => run()).finished.catch(() => undefined)
    return true
  }
  await run()
  return true
}

async function redirectTo(href: string, options: VisitOptions, meta: NavMeta): Promise<void> {
  await navigate(resolveHref(href), { ...options, method: "get", data: undefined }, {
    source: "redirect",
    redirects: meta.redirects + 1,
  })
}

/**
 * One navigation. Runs, in order: the `before` event, `options.onBefore`, and
 * the registered `beforeEach` guards. A cancel or redirect at any stage
 * short-circuits the later stages and happens before inflight abort, fetch,
 * and any history/DOM change.
 */
async function navigate(
  href: string,
  options: VisitOptions = {},
  meta: NavMeta = { source: "visit", redirects: 0 },
): Promise<void> {
  if (meta.redirects > MAX_REDIRECTS) {
    throw new Error(`Keel: more than ${MAX_REDIRECTS} redirects`)
  }
  const method: Method = options.method ?? "get"
  const url = buildUrl(href, method, options.data)
  const replace = Boolean(options.replace)
  const to: NavigationTarget = { url, method, replace, source: meta.source }
  const from = currentTarget()
  const visitState = createPendingVisit(url, method)

  if (meta.source === "redirect") {
    const outcome = await runGuards(to, from, { force: options.force })
    if (outcome.cancelled) {
      if (outcome.error) throw outcome.error
      emit("blocked", { to, from })
      return
    }
    if (outcome.redirect) {
      await redirectTo(outcome.redirect, options, meta)
      return
    }
  } else {
    emit("before", { visit: visitState })
    if (visitState.cancelled) {
      emit("blocked", { to, from })
      return
    }
    let redirect = redirectOf(visitState)
    if (redirect) {
      await redirectTo(redirect, options, meta)
      return
    }

    const onBeforeResult = await options.onBefore?.(visitState)
    if (visitState.cancelled || onBeforeResult === false) {
      emit("blocked", { to, from })
      return
    }
    redirect = redirectOf(visitState)
    if (redirect) {
      await redirectTo(redirect, options, meta)
      return
    }

    const outcome = await runGuards(to, from, { force: options.force })
    if (outcome.cancelled) {
      if (outcome.error) throw outcome.error
      emit("blocked", { to, from })
      return
    }
    if (outcome.redirect) {
      await redirectTo(outcome.redirect, options, meta)
      return
    }
  }

  inflight?.abort()
  const controller = new AbortController()
  inflight = controller

  beginVisit()
  options.onStart?.(visitState)
  emit("start", { visit: visitState })

  try {
    const isPartial = Boolean(options.only?.length || options.except?.length)
    const cached = method === "get" && !isPartial ? readSeed(url) : null
    const fetched = cached ? { seed: cached, partial: null } : await fetchSeed(url, options, controller.signal)
    if (controller.signal.aborted) {
      visitState.cancelled = true
      options.onCancel?.()
      emit("cancel", { visit: visitState })
      return
    }
    const seed = mergePartial(fetched.seed, fetched.partial)
    if (seed.redirect) {
      await navigate(seed.redirect, { ...options, method: "get", data: undefined }, {
        source: "redirect",
        redirects: meta.redirects + 1,
      })
      return
    }
    const applied = await applySeed(seed, options, replace, {
      target: { url: seed.path, method, replace, source: meta.source },
    })
    if (!applied) return
    if (Object.keys(seed.errors ?? {}).length > 0) {
      options.onError?.(seed.errors)
      emit("error", { errors: seed.errors })
    } else {
      options.onSuccess?.(seed)
      emit("success", { page: seed })
    }
  } catch (error) {
    if (error instanceof KeelBuildMismatchError || (error as Error).name === "AbortError") {
      visitState.cancelled = true
      options.onCancel?.()
      emit("cancel", { visit: visitState })
    } else {
      throw error
    }
  } finally {
    options.onFinish?.(visitState)
    emit("finish", { visit: visitState })
    endVisit()
    if (inflight === controller) inflight = null
  }
}

function visit(href: string, options: VisitOptions = {}): Promise<void> {
  return navigate(href, options, { source: "visit", redirects: 0 })
}

async function prefetch(href: string, options: VisitOptions = {}): Promise<void> {
  try {
    emit("prefetching", { href })
    const url = buildUrl(href, "get", options.data)
    const isPartial = Boolean(options.only?.length || options.except?.length)
    if (isPartial) {
      const result = await fetchSeed(url, { ...options, method: "get" }, new AbortController().signal)
      await warmModule(result.seed.entry)
      emit("prefetched", { href, page: result.seed })
      return
    }
    const seed = await prefetchSeed(url, async () => {
      const result = await fetchSeed(url, { ...options, method: "get" }, new AbortController().signal)
      if (result.partial) return result.seed
      cacheSeed(url, result.seed)
      return result.seed
    })
    await warmModule(seed.entry)
    emit("prefetched", { href, page: seed })
  } catch (error) {
    if (error instanceof KeelBuildMismatchError) return
    throw error
  }
}

function cancel(): void {
  inflight?.abort()
}

async function reload(options: VisitOptions = {}): Promise<void> {
  const page = getPage()
  await navigate(page.path, { ...options, replace: true }, { source: "reload", redirects: 0 })
}

function restorePopstate(targetIndex: number | null): void {
  if (typeof history === "undefined") return
  const steps = restoreSteps(currentSeedIndex(), targetIndex)
  if (steps === 0) return
  restoring += 1
  history.go(steps)
}

/**
 * Back/forward: the browser already moved the pointer, so resolve the target
 * seed from `history.state` and run guards before `applySeed`. On cancel or a
 * guard error, `history.go` walks the pointer back to the entry the mounted
 * page belongs to; the resulting popstate is skipped so guards do not re-run
 * and no entry is duplicated or truncated.
 */
async function handlePopstate(event: PopStateEvent): Promise<void> {
  if (restoring > 0) {
    restoring -= 1
    return
  }
  const seed = seedFromHistory(event)
  if (!seed) return
  const targetIndex = seedIndexFromHistory(event)
  const to: NavigationTarget = { url: seed.path, method: "get", replace: true, source: "popstate" }
  const from: NavigationTarget = lastTarget
    ? { ...lastTarget }
    : { url: seed.path, method: "get", replace: false, source: "visit" }

  const outcome = await runGuards(to, from)
  if (outcome.cancelled) {
    emit("blocked", { to, from, ...(outcome.error ? { error: outcome.error } : {}) })
    restorePopstate(targetIndex)
    return
  }
  if (outcome.redirect) {
    await redirectTo(outcome.redirect, { replace: true }, { source: "redirect", redirects: 0 })
    return
  }
  await applySeed(seed, { preserveScroll: true, replace: true }, true, { target: to })
}

function listenHistory(): void {
  if (typeof window === "undefined" || (window as unknown as { __keelHistory?: boolean }).__keelHistory) return
  ;(window as unknown as { __keelHistory?: boolean }).__keelHistory = true
  window.addEventListener("popstate", (event) => {
    void handlePopstate(event)
  })
}

export const router = {
  visit,
  get: (href: string, data?: VisitOptions["data"], options?: VisitOptions) =>
    visit(href, { ...options, method: "get", data }),
  post: (href: string, data?: VisitOptions["data"], options?: VisitOptions) =>
    visit(href, { ...options, method: "post", data }),
  put: (href: string, data?: VisitOptions["data"], options?: VisitOptions) =>
    visit(href, { ...options, method: "put", data }),
  patch: (href: string, data?: VisitOptions["data"], options?: VisitOptions) =>
    visit(href, { ...options, method: "patch", data }),
  delete: (href: string, data?: VisitOptions["data"], options?: VisitOptions) =>
    visit(href, { ...options, method: "delete", data }),
  beforeEach,
  reload,
  replace: (href: string, options?: VisitOptions) => visit(href, { ...options, replace: true }),
  prefetch,
  cancel,
  on,
  configure(next: RouterConfig) {
    config = { ...config, ...next }
    listenHistory()
  },
}

export async function bootstrap(options: RouterConfig = {}): Promise<void> {
  router.configure(options)
  const node = document.getElementById("__keel_seed")
  if (!node?.textContent) throw new Error("Keel: missing #__keel_seed")
  const seed = JSON.parse(node.textContent) as KeelSeed
  await applySeed(seed, { replace: true }, true, {
    initial: true,
    target: { url: seed.path, method: "get", replace: true, source: "visit" },
  })
}
