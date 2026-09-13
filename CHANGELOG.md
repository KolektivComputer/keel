# Changelog

All notable changes to Keel are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `@kolektiv/keel-react`: React 18/19 binding with
  `usePage`/`useForm`/`useAction`/`useKeelPageQuery`, `Link`/`Form`/`Head`,
  `useKeelAnchor`, navigation/unload guards, `createPage` mount factory, and
  `bootstrap` (#43).
- `@kolektiv/keel-vue`: Vue 3 binding with
  `usePage`/`useForm`/`useAction`/`useKeelPageQuery`, `Link`/`Form`/`Head`,
  `useKeelAnchor`, navigation/unload guards, `createPage`, and `bootstrap`
  (#44).
- `@kolektiv/keel-solid`: Solid 1.9 binding with
  `usePage`/`useForm`/`useAction`/`useKeelPageQuery`, `Link`/`Form`/`Head`,
  `useKeelAnchor`, navigation/unload guards, `createPage`, and `bootstrap`
  (#45).

### Changed

- Framework-neutral binding primitives in `@kolektiv/keel` (head DOM helpers,
  form-state machine, seed-applied hook, `PageContext` parity, query-key
  helpers) so framework adapters share one spine (#37).
- `@kolektiv/keel-pack` gains a framework adapter registry with codegen for
  React, Vue, Solid, Preact, Lit, and Angular packs (`+head.html` replaces
  Svelte-only head authoring for non-Svelte frameworks) (#38).
- `keel-scaffold` grows a per-framework template provider and can scaffold
  React, Vue, Solid, Preact, Lit, and Angular packs (Svelte output unchanged)
  (#39).
- Publish/CI scripts discover all publishable `@kolektiv/*` packages
  automatically and enforce package boilerplate (version lockstep, changelog
  prepack, keel-npm registry) so new framework adapters need no central
  wiring (#40).

### Fixed

- Pack-adapter docs no longer claim a manifest `layouts` map or per-page
  `layout` field: adapters inline the layout chain into each entry module, and
  `keel-pack` writes neither (#38).

## [0.0.2-SNAPSHOT.4] - 2026-09-13

### Changed

- Docs and homepage tell the pack-at-render-time story: call-site pack
  selection, "Choosing a pack" replaces the theme-chain page, no resolver
  language (#11).
- Refreshed the agent skill suite (`keel-host`, `keel-pack`, `keel-scaffold`)
  for pack-at-render, document head + CSP, pack hot reload, and navigation
  guards (#12).
- Docs cover the full current feature surface: pack-at-render, document head
  and CSP, pack hot reload, navigation guards, and the updated protocol/config
  references.
- Repository moved to the KolektivComputer organization; remote, docs/SCM
  links, package metadata, and the skills install command now use
  `KolektivComputer/keel`.
- Installed agent-skill copies (`skills-lock.json`, `.agents/skills/`, other
  agent skill dirs) are gitignored so only `skills/` ships; documented and
  installed the official daisyUI companion skill.

### Fixed

- `keel-scaffold` generates standalone packs with published dependency versions
  instead of `workspace:*`, and rejects unsupported `--framework react` before
  writing files.

## [0.0.2-SNAPSHOT.3] - 2026-09-13

### Added

- Cancelable, pluggable navigation guards (`router.beforeEach`,
  `useNavigationGuard`, `useUnloadGuard`; async `onBefore`; `force`; `blocked`
  event; popstate-safe cancel/redirect) (#23).
- Versioned changelog and release process: the full `CHANGELOG.md` ships in
  the `core` / `ktor` jars (`META-INF/CHANGELOG.md`), the `@kolektiv/keel`,
  `@kolektiv/keel-svelte`, and `@kolektiv/keel-pack` npm tarballs, and as a
  GitHub Release asset (#25).

### Fixed

- Publish unique `X-SNAPSHOT.N` Maven versions to `keel-maven`, the
  repository consumers can anonymously resolve, with CI verification of the
  advertised coordinates (#24).

## [0.0.2-SNAPSHOT.1] - 2026-09-12

### Added

- Pack-authored document head: `+head.svelte` compiles into the `.feb` manifest
  and the host renders it on document GET (#2).
- CSP nonces for pack-declared head assets with opt-in `KeelConfig.csp` (#5).
- Pack hot reload with `seed.build` / `X-Keel-Build`, client full reload,
  host-side `.feb` watcher, and atomic packaging (#7, #14).
- Agent skills installable with `npx skills add KolektivComputer/keel` plus
  `skills.sh.json` grouping (#21).

### Changed

- Call-site pack selection: `respondPage` / `route.keel` take an opened pack;
  the theme chain is removed.
- Repository moved to `KolektivComputer/keel`.
- Docs install snippets paired with release/snapshot repositories (#10, #22).
- Asset filenames are hashed.
- Maven release-prep to `0.0.2-SNAPSHOT.1` (#20).

### Fixed

- `useAction` proxy no longer subscribes effects on method reads, ending
  infinite action loops (#15).
- Gradle signing snapshot detection for `X-SNAPSHOT.N`.
- CI skips or tolerates already-published Maven assets.

### Removed

- `ThemeResolver` / `ChainThemeResolver` / `ThemeRequest` / `ThemeSelection` /
  `MissingPageInThemeException`.
- `KeelConfig.defaultThemeId` / `themeResolver`.
- `X-Keel-Theme` request override.

## [0.0.1] - 2026-09-10

Initial release.

### Added

- Kotlin core (`dev.kolektiv.keel:core`) and Ktor adapter
  (`dev.kolektiv.keel:ktor`).
- `@kolektiv/keel`, `@kolektiv/keel-svelte`, and `@kolektiv/keel-pack`
  (`keel-scaffold`).
- Harbor sample, docs site, and agent skills.
