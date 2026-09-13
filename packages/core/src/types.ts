export const KEEL_FORMAT = "keel/1" as const
export const KEEL_SEED_VERSION = 1
export const KEEL_DEFAULT_HOST = "#__keel_root"
export const KEEL_SEED_ELEMENT_ID = "__keel_seed"
export const KEEL_NAVIGATE_PATH = "/__keel/navigate"
export const KEEL_ACTION_PATH = "/__keel/action"
export const KEEL_SCHEMA_PATH = "/__keel/schema"

export const KEEL_HEADERS = {
  visit: "X-Keel-Visit",
  only: "X-Keel-Only",
  except: "X-Keel-Except",
  theme: "X-Keel-Theme",
  version: "X-Keel-Version",
  build: "X-Keel-Build",
  partial: "X-Keel-Partial",
} as const

export type Method = "get" | "post" | "put" | "patch" | "delete"

/** How a navigation was started. */
export type NavigationSource = "visit" | "popstate" | "redirect" | "reload"

export interface NavigationTarget {
  url: string
  method: Method
  replace: boolean
  source: NavigationSource
}

/**
 * `false` cancels, `true`/`void` allows, `string` / `{ redirect }` redirects.
 * Relative redirects resolve against the current location.
 */
export type GuardResult = boolean | void | string | { redirect: string }

export type NavigationGuard = (
  to: NavigationTarget,
  from: NavigationTarget,
) => GuardResult | Promise<GuardResult>

export interface KeelThemeRef {
  id: string
  version: string
}

/**
 * Resolved document head on the seed. `html` is sanitized pack markup for
 * the document GET; visits may still carry it so the client can sync.
 */
export interface PageHead {
  title: string
  description?: string | null
  canonical?: string | null
  image?: string | null
  type?: string | null
  html?: string | null
}

export interface KeelSeed<T = unknown> {
  v: number
  page: string
  path: string
  params: Record<string, string>
  data: T
  errors: Record<string, string[]>
  theme: KeelThemeRef
  entry: string
  css: string[]
  /** Content hash of the serving pack; a change forces a full reload. */
  build?: string
  shared?: Record<string, unknown> | null
  host: string
  layout?: string | null
  redirect?: string | null
  head?: PageHead | null
}

export interface KeelPageEntry {
  module: string
  css?: string[]
  layout?: string | null
  /** Pack-authored head HTML template (`{{data.user.displayName}}`). */
  head?: string | null
}

export interface KeelManifest {
  format: string
  id: string
  version: string
  framework: string
  host?: string
  pages: Record<string, KeelPageEntry>
  layouts?: Record<string, string>
  notFound?: string | null
  compat?: { contract: string } | null
}

/**
 * The module a pack entry exports for a page id.
 *
 * Adapters are **client-mount-only**: the host renders the shell HTML and the
 * browser mounts the entry, so there is no SSR / hydration seam. Core calls
 * `mount(host, ctx)` for a newly applied seed and `update(ctx)` when a visit
 * keeps the same page id and entry with `preserveState`. `ctx` is the exact
 * context built from that seed — adapters must forward it to framework code
 * (context, props, or DI), even when they also read the global seed store.
 */
export interface PageModule<T = unknown> {
  mount(host: Element, ctx: PageContext<T>): void | Promise<void>
  unmount(): void | Promise<void>
  update?(ctx: PageContext<T>): void | Promise<void>
}

/**
 * The data a page module receives for one applied seed: ids, route params,
 * payload, validation errors, theme, shared values, and `navigate`. Every
 * applied seed produces one context; reactive adapters may keep reading the
 * seed store for updates, but `ctx.data` is always that seed's payload.
 */
export interface PageContext<T = unknown> {
  page: string
  path: string
  params: Record<string, string>
  data: T
  errors: Record<string, string[]>
  theme: KeelThemeRef
  shared: Record<string, unknown>
  navigate: (href: string, options?: VisitOptions) => Promise<void>
}

export type PreserveScroll = boolean | "errors"

export type PrefetchMode = boolean | "hover" | "mousedown" | "mount"

export interface VisitOptions {
  method?: Method
  data?: Record<string, unknown> | FormData | URLSearchParams
  replace?: boolean
  preserveScroll?: PreserveScroll
  preserveState?: boolean
  only?: string[]
  except?: string[]
  headers?: Record<string, string>
  prefetch?: PrefetchMode
  viewTransition?: boolean
  /** Skip registered `beforeEach` guards for an app-confirmed navigation. */
  force?: boolean
  onBefore?: (visit: PendingVisit) => boolean | void | Promise<boolean | void>
  onStart?: (visit: PendingVisit) => void
  onProgress?: (progress: { percentage: number | null }) => void
  onSuccess?: (page: KeelSeed) => void
  onError?: (errors: Record<string, string[]>) => void
  onCancel?: () => void
  onFinish?: (visit: PendingVisit) => void
}

export interface PendingVisit {
  url: string
  method: Method
  cancelled: boolean
  /** Cancel the navigation: no fetch, no history change. */
  cancel(): void
  /** Replace the target with `href`; guards re-run for it. */
  redirect(href: string): void
}

export type RouterEvent =
  | "before"
  | "start"
  | "progress"
  | "success"
  | "error"
  | "cancel"
  | "blocked"
  | "finish"
  | "navigate"
  | "prefetching"
  | "prefetched"

export type RouterListener = (detail: Record<string, unknown>) => void
