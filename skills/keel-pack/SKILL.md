---
name: keel-pack
description: >
  Author or adapt a Keel frontend pack for Svelte, React, Vue, Solid,
  Preact, Lit, or Angular. Use when writing pages and +head templates,
  keelPack Vite config and .feb builds, typed contracts, navigation guards,
  action/effect patterns, or a RouterAdapter. Triggers: "keel pack",
  "+page.svelte", "+page.tsx", "+page.ts", "+head.html", "keelPack",
  "PageModule", ".feb", "supportedFrameworks", "beforeEach".
  Slash: /keel-pack.
---

# Keel pack

A pack implements page ids. It never owns paths. Spec:
`docs/src/content/docs/implementing/pack-adapter.mdx`.

## Page modules

Every compiled page exports `mount` / `unmount` / optional `update`. The
framework's `/mount` subpath (`@kolektiv/keel-svelte/mount`, …) `createPage`
wraps the page component + layouts.

Files live under `pagesDir` using the adapter's convention (Svelte shown
here; the full table is under Framework adapters). Id is the directory path
with `/` → `.` (`pages/harbor/home/+page.svelte` → `harbor.home`). A sibling
id-override file may `export const id = "harbor.home"`. `_`-prefixed files
and directories are skipped, `(group)` directory segments are not part of the
id, and a root-level page needs an explicit id. `+layout.svelte`
(`+layout.tsx` / `+layout.vue` / `+layout.ts` elsewhere) wraps descendants
root-first. Duplicate ids fail the build.

`page<T>()` returns the current seed (`processing` is true while a visit is
in flight). Reads come from the seed — never fetch a second read model.

## Framework adapters

Seven adapters ship: `svelte` (default), `react`, `vue`, `solid`, `preact`,
`lit`, and `angular`. `keelPack({ framework })` resolves one through the
registry:

- `supportedFrameworks` — sorted `["angular", "lit", "preact", "react",
  "solid", "svelte", "vue"]`.
- `routerFor(framework)` — returns the built-in adapter; an unknown name
  throws with the supported list. A passed `router` takes precedence over
  the registry.
- `RouterAdapter { name, discover(pagesDir), entrySource(page) }` — maps
  files to page ids, never URL params.

| Framework | Page / layout | Id override | Head template |
| --- | --- | --- | --- |
| Svelte | `+page.svelte`, `+layout.svelte` | `+page.ts` | `+head.svelte` |
| React | `+page.tsx`, `+layout.tsx` | `+page.ts` | `+head.html` |
| Vue | `+page.vue`, `+layout.vue` | `+page.ts` | `+head.html` |
| Solid | `+page.tsx`, `+layout.tsx` | `+page.ts` | `+head.html` |
| Preact | `+page.tsx`, `+layout.tsx` | `+page.ts` | `+head.html` |
| Lit | `+page.ts`, `+layout.ts` | `+page.id.ts` | `+head.html` |
| Angular | `+page.ts`, `+layout.ts` | `+page.id.ts` | `+head.html` |

Lit and Angular pages are themselves `+page.ts` modules, so the id override
moves to `+page.id.ts`. Every generated entry has the same shape — the page,
layouts root-first, and `createPage` from the framework's `/mount` subpath:

```ts
import Page from "/proj/src/pages/harbor/home/+page.tsx"
import L0 from "/proj/src/pages/+layout.tsx"
import { createPage } from "@kolektiv/keel-react/mount"
export const { mount, unmount, update } = createPage(Page, [L0])
```

Runtime package and query dependency per framework:

| Framework | Runtime | Query |
| --- | --- | --- |
| Svelte 5 | `@kolektiv/keel-svelte` | `@tanstack/svelte-query` |
| React 18/19 | `@kolektiv/keel-react` | `@tanstack/react-query` |
| Vue 3 | `@kolektiv/keel-vue` | `@tanstack/vue-query` |
| Solid 1.9 | `@kolektiv/keel-solid` | `@tanstack/solid-query` |
| Preact 10 | `@kolektiv/keel-preact` | `@tanstack/preact-query` |
| Lit 3 | `@kolektiv/keel-lit` | `@tanstack/query-core` controllers |
| Angular 19 | `@kolektiv/keel-angular` | `@tanstack/angular-query-experimental` |

Each runtime re-exports `bootstrap()` and exposes `./mount`; see
`docs/src/content/docs/implementing/framework-adapters.mdx` for each
framework's page/form/action/mount API.

### Writing a new adapter

1. Reuse the shared discovery helpers `discoverPages(pagesDir, spec)` and
   `pageEntrySource(page, mount)`; the common codegen case is one
   `frameworkAdapter({ name, mount, pageFile, layoutFile, idFile })` call
   (that helper always discovers `+head.html` via
   `compileHtmlHeadTemplate`).
2. Implement `RouterAdapter` when conventions differ: `discover` returns
   `DiscoveredPage[]`, `entrySource` emits `createPage(Page, [layouts])`.
3. Register the factory in `packages/pack/src/registry.ts`; `keelPack`
   resolves through `routerFor`, so `vite.ts` needs no change.
4. Add the runtime package `@kolektiv/keel-<fw>` (a `./mount` subpath
   exporting `createPage`) and a scaffold provider in
   `packages/pack/src/scaffold/providers.ts`. The provider registry must
   cover every framework in the adapter registry, and each provider owns its
   package.json deps, tsconfig, vite plugin, bootstrap, layout, and page
   files.

## +head.svelte / +head.html

A page may declare a sibling `+head.svelte` (Svelte) or `+head.html` (every
other adapter). `compileHeadTemplate` runs at pack build time:

- strips `<script>` / `<style>` blocks and HTML comments, unwraps
  `<svelte:head>` when present;
- turns `{seed.data.user.name}` into `{{data.user.name}}` (optional chaining
  is normalized away); only `seed.*` expressions are allowed — blocks,
  `{@html}`, and anything else fail the build;
- rejects empty output.

`+head.html` compiles through `compileHtmlHeadTemplate`: the same
`{seed.*}` → `{{…}}` interpolation and sanitizing rules, no `<svelte:head>`
unwrap, and existing `{{path}}`-style placeholders pass through. It is plain
markup with no framework imports.

```svelte
<script lang="ts">
  import type { KeelSeed } from "@kolektiv/keel"
  import type { UserPage } from "@app/page-types"

  let { seed }: { seed: KeelSeed<UserPage> } = $props()
</script>

<title>{seed.data.user.displayName} — Harbor</title>
<meta name="description" content="Messages from {seed.data.user.displayName}." />
```

At document render the host substitutes `{{page}}`, `{{path}}`,
`{{params.*}}`, `{{data.*}}`, `{{shared.*}}`, `{{theme.*}}` and drops a tag
whose placeholder is unknown. Only `<title>`, `<meta>`, `<link>`, and
`<script src>` survive; scripts need an external `src` and no inline body.
URL attributes are resolved against the document URL and must be
root-relative (`/…`) or absolute `http(s)`. In the SPA, `<Head />` applies
`page().head`; `+page.ts` metadata is not the head contract.

## Contract and types

Generate `page-types.ts` / `.json` from a live host
(`GET /__keel/schema` via `keel-scaffold`) or offline (Gradle
`generateKeelTypes`, `TypegenCli`). Point `keelPack({ contract })` at the
JSON so a pack implementing an unknown id fails the build. The loader accepts
a `keel/1` document, a raw id array/object, or an
`export interface *Pages` fallback.

## Actions and effects

`useAction(id)` returns a reactive proxy over the TanStack mutation: state
reads (`isPending`, `error`, …) subscribe the current `$effect` / `$derived`;
method reads (`mutateAsync`, `reset`) return the function bound to the
current store and do **not** subscribe. An effect that reads state re-runs on
every mutation transition, so an unguarded load that checks `isPending` can
fire the action again and again — an endless `POST /__keel/action/{id}` loop.

Rules:

1. Never read action state inside `$effect` / `$derived` tracking scope.
2. Load from event handlers, or wrap all proxy access in `untrack(...)`.
3. Guard effect-driven loads by a key so they run once per open/id.
4. `reload: false` skips the visit after success, not the proxy subscription.

```svelte
<!-- RIGHT: guard by id, keep action proxy access inside untrack -->
import { untrack } from "svelte"

let loadedId: string | undefined

$effect(() => {
  const id = sharingId
  if (!id || loadedId === id) return
  loadedId = id
  untrack(() => {
    getSharing.reset()
    void getSharing.mutateAsync({ id })
  })
})
```

Prefer event handlers for user-initiated writes. `useAction` visits the page
on success by default so `page()` and the query cache rehydrate; reads still
come from the seed. `action(id, input)` is the same POST without the reactive
wrapper.

## Navigation guards

`router.beforeEach(guard)` runs before the inflight visit is aborted, before
any fetch, and before history or DOM changes. Guards are async-capable, run
serially in registration order, and the returned function unsubscribes.

```ts
const stop = router.beforeEach((to, from) => {
  if (to.source === "reload") return true
  return isDirty() ? "/settings/account?leave=1" : true
})
stop()
```

`to` / `from` are `NavigationTarget`s: `{ url, method, replace, source }`,
where `source` is `"visit" | "popstate" | "redirect" | "reload"`. `from` is
best-effort: the current URL plus the last applied seed's method, replace,
and source. A guard returns a `GuardResult`:

| Result | Effect |
| --- | --- |
| `true`, `void` | Allow. |
| `false` | Cancel: no fetch, no history or DOM change. |
| `string` / `{ redirect }` | Redirect, resolved against the current location. |
| thrown / rejected | Cancel and surface; a blocked `popstate` restores and reports via `blocked`. |

Order per navigation: the `router.on("before")` event, then
`VisitOptions.onBefore` (async-capable), then `beforeEach` guards; a cancel
or redirect at any stage skips the later stages. `PendingVisit.cancel()` and
`redirect(href)` let event-style guards do the same. `VisitOptions.force`
skips the registered guards for an app-confirmed navigation; the `before`
event and `onBefore` still run. `Link` / `Form` forward both.

Popstate resolves the target seed from `history.state` and runs guards before
applying it; a cancel walks history back with a skip flag and emits
`router.on("blocked", ({ to, from }) => …)`. Redirect re-entry reruns guards
with `source: "redirect"`; 10 consecutive redirects stop loops.

Svelte hooks: `useNavigationGuard(guard)` registers during component init and
unregisters on destroy; `useUnloadGuard(() => form.isDirty)` adds the native
`beforeunload` prompt. Prefetch never runs guards, and `bootstrap()` applies
the initial seed without them.

## Build

`keelPack` in Vite discovers pages, writes `manifest.json` with each page's
module/css/head, and — when `pack` is set — zips the `.feb` via `packFeb`
(through a temp file and rename, so a host watcher never reads a partial
zip). Options: `id`, `version`, `framework`, `host`, `pagesDir`, `bootstrap`,
`contract`, `notFound`, `pack`, plus optional `router`, `manifest(base)`, and
`packager(opts)` hooks. Chunks and assets get hashed names
(`chunks/[name]-[hash].js`, `assets/[name]-[hash][ext]`), so host asset URLs
are immutable.

`framework` is required: pass a `supportedFrameworks` name (for Svelte,
`"svelte"`) or a custom `router` to bypass the registry. See Framework
adapters for the registry and file conventions.

## Dev loop

Run `pnpm --filter <pack> dev` (`vite build --watch`) and point the host at
the rebuilt file:

```bash
./gradlew :samples:harbor:run --args="pack/dist/harbor.feb"
```

The host needs `watchPacks = true`. Every save rewrites the `.feb`; the host
swaps the bundle and clients full-reload when `seed.build` changes. Failed
reopens keep the old pack serving.
