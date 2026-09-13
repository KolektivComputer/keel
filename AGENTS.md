# Keel

This file is for humans and coding agents working in this repository.

Keel is a protocol and libraries for serving MPAs with a frameworked UI from
Kotlin. The **host** owns URLs, page ids, payload types, and which frontend
**pack** to pass at render time. Packs implement ids — never paths. Keel does
not choose packs. One pack is an app UI. Many packs are installed themes
against the same typed contract.

## Layout

| Path | What |
| --- | --- |
| `lib/` | Kotlin core (`dev.kolektiv.keel:core`) — seed, manifest, `PageRegistry`, `ActionRegistry`, `FrontendBundle`, typegen. No Ktor dependency. |
| `ktor/` | `dev.kolektiv.keel:ktor` — binds the registry, `respondPage`, actions, HTML shell, visits, pack files. |
| `samples/harbor` | In-memory message board: Ktor + Svelte pack. `./gradlew :samples:harbor:run` → http://127.0.0.1:8090 |
| `packages/core` | `@kolektiv/keel` — visits, history, prefetch, `action()` |
| `packages/svelte` | `@kolektiv/keel-svelte` — `Link`, `Form`, `Head`, `page()`, `useForm`, `useAction` |
| `packages/pack` | `@kolektiv/keel-pack` — `.feb` zip, Vite plugin, `keel-scaffold` |
| `skills/` | Agent Skills (`keel-host`, `keel-pack`, `keel-scaffold`) for Claude / Grok / `.agents` — `npx skills add KolektivComputer/keel` |
| `docs/` | Homepage and guides (Astro 7, Tailwind 4, daisyUI 5, Shiki Catppuccin). pnpm workspace package `@kolektiv/keel-docs`. Getting started splits **Server Installation** and **Client Setup**. Search, SCM links, and a combined theme popup live in the site chrome. |
| `buildSrc/` | Gradle conventions (JVM 17, Maven publish) |
| `public/` | `logo.svg` / `favicon.svg` product mark, `mark.svg` hull glyph. `.idea/icon.svg` is the same mark as the IntelliJ project icon. |

## Commands

```bash
./gradlew :lib:test :ktor:test :samples:harbor:test
./gradlew :samples:harbor:generateKeelTypes
pnpm install
pnpm test && pnpm typecheck
pnpm build:packages
pnpm --filter @kolektiv/keel-docs build
pnpm --filter @kolektiv/harbor-pack build
pnpm exec keel-scaffold 127.0.0.1:8090 ./pack
pnpm dev                        # docs, http://127.0.0.1:8080
./gradlew :samples:harbor:run    # sample host, http://127.0.0.1:8090
```

Java 17 (toolchain; the daemon also runs on 21 and 25), Kotlin 2.2, Gradle
9.5, pnpm 9. `pnpm build:packages` emits `dist/` for the npm packages. The
JS workspace root is this repository (`packages/*` and `docs`).

## Protocol

- Page ids + kotlinx.serialization payload types **are** the contract. A live
  host serves that contract at `GET /__keel/schema`. `keel-scaffold <origin>
  <dir>` writes a blank Svelte pack from it. Gradle `generateKeelTypes` is the
  offline classpath scan. Actions are a Kotlin function `(In) -> Out`.
- Packs ship as `.feb` (zip of `manifest.json` + modules). Hosts load a
  `FrontendBundle` from a jar resource, a file, or an exploded directory.
- Visits hit the real page URL with `X-Keel-Visit: true`. `/__keel/navigate`
  is a compatibility proxy for the pages DSL only.
- Actions POST `/__keel/action/{id}` with JSON. They are **writes**. Reads stay
  the seed. After a mutation, TanStack Query invalidates and a visit rehydrates.
- Document GET writes `seed.head` into the HTML shell — the pack's
  `+head.svelte` template (sanitized) or the host `head(...)` fallback. Visits
  return JSON and are not the SEO unit.
- Pack choice is the call site's: `respondPage(pack, …)` or
  `route.keel(pack)`. Keel does not resolve themes, and packs do not read a
  visitor theme from the browser.
- The seed JSON is the only **read** model. Packs must not fetch a second
  source of truth or own URL patterns.
- One pack and many packs use the same host API. A single-pack app passes its
  one pack at render.
- First adapter is Svelte 5.

## Docs site

Catppuccin daisyUI themes (`catppuccin-mocha` default). Type: Source Serif 4
(display), Source Sans 3 (body / UI), Iosevka (code) in
`docs/src/styles/global.css`. Site chrome uses daisyUI
primitives. Code samples: Svelte, Ktor host. TS/JS toggles live on docs pages
and on individual snippets.

Production docs are `https://keel.mey.cat` (GitHub Pages custom domain, site
root). All in-app links must go through `path()` in `docs/src/lib/paths.ts`
(or `import.meta.env.BASE_URL`). The Pages workflow sets `DOCS_SITE`; local
`astro dev` stays at `/`. Astro emits to `/dist` at the repo root.

## Contributing

Apache-2.0. Keep page ids stable. Do not commit `node_modules/`, `**/build/`,
`.gradle/`, `.env`, or signing material. Match the style of the file you are
in; do not reformat unrelated code or add deps without a need.

## Publishing

Maven publishing (`bash .github/scripts/publish-maven.sh`) always goes to
`https://repo.yuri.capital/repository/keel-maven/`. Versions that end
exactly in `-SNAPSHOT` (canonical snapshots) also go to
`…/maven-snapshots/`; numbered releases also go to `…/maven-releases/`.
Unique pre-release versions such as `0.0.2-SNAPSHOT.1` are not canonical
Maven snapshots — they do not end in `-SNAPSHOT` — and both of those hosted
repos reject them, so they go to `keel-maven` only. Consumers configure
exactly one Maven repository: `maven-releases` for numbered releases,
`maven-snapshots` for canonical `-SNAPSHOT` builds, or `keel-maven` for the
unique `X-SNAPSHOT.N` pre-release line. Versions already present in the
target repo are skipped, and conflicts from redeploys to `keel-maven` are
tolerated. `bash .github/scripts/verify-maven-resolution.sh <version>`
anonymously checks that `core` and `ktor` resolve from the advertised repo;
`.github/workflows/publish.yml` runs it after publishing.

npm (`bash .github/scripts/publish-npm.sh`) publishes only to the hosted
repo `https://repo.yuri.capital/repository/keel-npm/`, which is also the
advertised consumer registry; the `npm-releases` / `npm-snapshots` group
URLs are not available on this Nexus instance. Consumers point the
`@kolektiv` scope at hosted `keel-npm`. `publish.yml` verifies resolution
after publishing with `.github/scripts/verify-npm-resolution.sh`. Workflow:
`.github/workflows/publish.yml` (tag `v*` or `workflow_dispatch`).

### Adding an npm package

A new package lives in `packages/<dir>/` and is named `@kolektiv/keel-<dir>`
(router: `@kolektiv/keel`). Copy the boilerplate from an existing adapter:
version locked to `packages/core`'s version, `publishConfig.registry` =
hosted `keel-npm`, `files` including `dist` and `CHANGELOG.md`, and the
standard `prepack` one-liner that copies the root `CHANGELOG.md`. A
`"private": true` package is skipped. `pnpm build:packages`,
`publish-npm.sh`, `verify-npm-resolution.sh`, and
`check-publishable-packages.sh` all discover packages from
`packages/*/package.json` — never edit a central package list. CI runs the
checker after `pnpm build:packages`; publish runs it before publishing.

**Credentials (never commit values).** Same Nexus login for Maven and npm:

1. **CI** — GitHub repo **Settings → Secrets and variables → Actions**:
   `YURI_CAPITAL_REPO_USERNAME`, `YURI_CAPITAL_REPO_PASSWORD`.
2. **Local Maven** — `~/.gradle/gradle.properties`:
   `keel.publishing.yuriCapitalRepoUsername` /
   `keel.publishing.yuriCapitalRepoPassword`, or the same names as env.
3. **Local npm** — those env vars are enough for `publish-npm.sh`. Optional
   user `~/.npmrc` (publish only; consumers do not need auth):

```
@kolektiv:registry=https://repo.yuri.capital/repository/keel-npm/
//repo.yuri.capital/repository/keel-npm/:_auth=<base64 of user:password>
//repo.yuri.capital/repository/keel-npm/:always-auth=true
```

Consumers add exactly **one** Maven repository — `maven-releases`,
`maven-snapshots`, or `keel-maven` — never more than one. npm consumers
point the `@kolektiv` scope at hosted `keel-npm`.

## Changelog and releases

`CHANGELOG.md` (Keep a Changelog) is the versioned list of user-facing changes.
Every user-facing PR adds a bullet under `[Unreleased]` in the matching
`Added` / `Changed` / `Fixed` / `Removed` / `Security` list and pastes that
section into the PR body.

At release time, move the `[Unreleased]` entries under the new
`## [version] - YYYY-MM-DD` heading; use that section as the tag message and the
GitHub Release body. `.github/scripts/changelog-section.sh <version>` prints the
section, and `.github/workflows/release.yml` runs it on `v*` tags (or
`workflow_dispatch`) to create or update the Release with the full changelog
attached.

The full changelog ships in every artifact: `META-INF/CHANGELOG.md` in the
`core` / `ktor` jars, `CHANGELOG.md` in every publishable
`@kolektiv/keel*` npm tarball, and as a GitHub Release asset.
