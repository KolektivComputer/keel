---
name: keel-pack
description: >
  Author or adapt a Keel frontend pack. Use when writing Svelte pages,
  +head.svelte, keelPack Vite config and .feb builds, typed contracts,
  navigation guards, action/effect patterns, or a RouterAdapter for another
  framework. Triggers: "keel pack", "+page.svelte", "+head.svelte",
  "keelPack", "PageModule", ".feb", "svelteFiles", "beforeEach".
  Slash: /keel-pack.
---

# Keel pack

A pack implements page ids. It never owns paths. Spec:
`docs/src/content/docs/implementing/pack-adapter.mdx`.

## Page modules

Every compiled page exports `mount` / `unmount` / optional `update`.
`@kolektiv/keel-svelte/mount` `createPage` wraps `+page.svelte` + layouts.

Svelte files live under `pagesDir` as `+page.svelte`. Id is the directory
path with `/` → `.` (`pages/harbor/home/+page.svelte` → `harbor.home`). A
sibling `+page.ts` may `export const id = "harbor.home"`. `_`-prefixed files
and directories are skipped, `(group)` directory segments are not part of the
id, and a root-level `+page.svelte` needs an explicit id. `+layout.svelte`
wraps descendants root-first. Duplicate ids fail the build.

`page<T>()` returns the current seed (`processing` is true while a visit is
in flight). Reads come from the seed — never fetch a second read model.

## +head.svelte

A page may declare a sibling `+head.svelte`. `compileHeadTemplate` runs at
pack build time:

- strips `<script>` / `<style>` blocks and HTML comments, unwraps
  `<svelte:head>` when present;
- turns `{seed.data.user.name}` into `{{data.user.name}}` (optional chaining
  is normalized away); only `seed.*` expressions are allowed — blocks,
  `{@html}`, and anything else fail the build;
- rejects empty output.

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

`RouterAdapter`: `{ name, discover(pagesDir), entrySource(page) }`.
`svelteFiles()` ships today; any other framework must pass `router`.

## Dev loop

Run `pnpm --filter <pack> dev` (`vite build --watch`) and point the host at
the rebuilt file:

```bash
./gradlew :samples:harbor:run --args="pack/dist/harbor.feb"
```

The host needs `watchPacks = true`. Every save rewrites the `.feb`; the host
swaps the bundle and clients full-reload when `seed.build` changes. Failed
reopens keep the old pack serving.
