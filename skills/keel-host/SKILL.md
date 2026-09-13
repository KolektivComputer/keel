---
name: keel-host
description: >
  Implement or extend a Keel host (server). Use when adding pages, actions,
  CSRF, the live schema, pack loading and render-time pack choice, document
  head, CSP, or pack hot reload, or for a non-Ktor backend that speaks Keel.
  Triggers: "keel host", "KeelEngine", "respondPage", "route.keel",
  "FrontendBundle", "/__keel/schema", "@KeelAction", "page registry".
  Slash: /keel-host.
---

# Keel host

The host owns URLs, page ids, payload types, actions, and which pack to pass
at render. Packs implement ids — never paths. Keel does not choose packs:
there is no resolver, no theme chain, and no request header or cookie that
selects one.

Canonical protocol: repo `docs/src/content/docs/implementing/protocol.mdx` and
`host-adapter.mdx`. Kotlin reference: `lib/` (no Ktor) and `ktor/KeelEngine.kt`.

## Do this

1. Register pages with id + absolute path + serializer. Default method is GET;
   POST/PUT/PATCH/DELETE are opt-in. Path grammar: `{name}`, `{name?}` last,
   `{name...}` last. Match by specificity, not registration order.
2. Build a seed for every document and visit (`v`, `page`, `path`, `params`,
   `data`, `errors`, `theme`, `entry`, `css`, `build`, `host`; optional
   `shared`, `layout`, `redirect`, `head`). Document GET writes `head` into
   HTML and `modulepreload`s bootstrap + `seed.entry`; visits return JSON when
   `X-Keel-Visit: true` (or `/__keel/navigate?to=` for the pages DSL).
3. Serve **`GET /__keel/schema`** as `keel/1` JSON from the live page and
   action registries (`Typegen.emitJson`). This is how `keel-scaffold` learns
   the contract.
4. Actions: `POST /__keel/action/{id}`, JSON in/out. Validation is 422
   `{ "errors": … }`. Bind request context across coroutine hops
   (`ThreadLocal.asContextElement` on JVM).
5. CSRF on writes: non-simple marker (`application/json` or `X-Keel-Visit`)
   plus same-origin Origin / Sec-Fetch-Site. Session cookies `SameSite=Lax`.
6. Assets at `/__keel/pack/{bundleId}/…`: strong ETag, 304, `immutable` for
   hashed chunks/`assets/`, otherwise `must-revalidate`.
7. Open packs up front and pass one at render — see Pack at render.
8. Let the pack author the document head, with `head(...)` as fallback — see
   Document head.

## Pack at render

Open each `FrontendBundle` once and reuse the instance:

```kotlin
val harbor = FrontendBundle.fromFile(Path.of("pack/dist/harbor.feb"))
// fromResource("keel/harbor.feb") for the classpath, fromDirectory(dir) in dev

routing {
    keel(harbor) {
        get("/") { call.respondPage(harbor, "harbor.home", HomePage(...)) }
    }
}
```

- `respondPage(pack, pageId, data, …)` is canonical. Optional args: `params`,
  `status`, `head`.
- `route.keel(pack) { … }` scopes a pack to a route subtree; inside it a
  bundle-less `respondPage(pageId, data)` resolves to that pack.
- Outside a scope, a bundle-less `respondPage` resolves only when exactly one
  pack is configured in total (`KeelConfig.bundle` plus `KeelConfig.bundles`).
  None throws `MissingPackException`; several throws `AmbiguousPackException`.
- A passed pack that does not implement the page id throws
  `UnknownPageInBundleException`. Keel never substitutes another installed
  pack.
- The seed's `theme { id, version }` and the `X-Keel-Theme` /
  `X-Keel-Version` response headers name the serving pack. They are
  responses, never request overrides.
- Unmatched URLs map to `KeelConfig.notFoundPageId`; a pack that declares a
  `notFound` module can serve those documents.

## Document head

A pack's `+head.svelte` compiles into a `head` template in its manifest. On a
document GET the host:

1. substitutes `{{page}}`, `{{path}}`, `{{params.*}}`, `{{data.*}}`,
   `{{shared.*}}`, `{{theme.*}}` from the seed;
2. allowlists tags (`title`, `meta`, `link`, `script`) and their attributes,
   drops unsafe URLs and inline script bodies, and **drops any tag with an
   unknown placeholder**;
3. writes the result into `<head>` and returns it as `seed.head.html`. A
   missing `<title>` gets the host title.

Visits return the same `seed.head` as JSON so `<Head>` stays in sync; visits
are not the SEO unit. `PageRequest.head(title, description = …, canonical =
documentUrl(), …)` is the host fallback: the whole head when the pack has no
`+head.svelte`, and a fill for fields the pack omits. Canonical defaults to
the document URL.

## CSP

`KeelConfig.csp = CspPolicy.nonce()` opts into `Content-Security-Policy` on
document responses. Keel generates one nonce per document (16 random bytes,
Base64 URL-safe, unpadded) and stamps it on the shell scripts
(`#__keel_seed`, the bootstrap module, fallback `application/ld+json`) and on
pack-declared `<script src>` / `<link>` tags. A pack-supplied `nonce` is
stripped. Visits get no nonce and no header. Default policy:
`script-src 'nonce-…' 'strict-dynamic'; style-src 'self'; object-src 'none';
base-uri 'none'`.

## Pack hot reload

- `KeelConfig.watchPacks = true` and `packWatchIntervalMs` (default 500,
  floored at 50) make Keel fingerprint file/directory bundles (size + mtime,
  recursive for directories), reopen changed sources, and swap them into the
  live registry. Classpath resource bundles are never watched.
- Each bundle has a `contentHash` (SHA-256 over the manifest and entry
  metadata). It goes out as `seed.build` and `X-Keel-Build`;
  `X-Keel-Version` stays the manifest semver.
- When a client sees a fetched seed whose build differs from the mounted one,
  it clears the prefetch cache and calls `window.location.reload()`.
- A bad manifest, truncated archive, or IO error keeps the previous bundle
  serving; the host warns and retries on the next poll. A rebuild that
  changes the manifest `id` re-registers under the new id.

## Do not

- Let packs own URL patterns or fetch a second read model.
- Select a pack from a request header, cookie, or scan — there is no resolver.
- Apply `only`/`except` to document GETs (visits only; respond
  `X-Keel-Partial`).
- Skip `/__keel/schema` — scaffold and other languages consume it.
