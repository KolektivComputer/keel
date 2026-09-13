# Changelog

All notable changes to Keel are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cancelable, pluggable navigation guards (`router.beforeEach`,
  `useNavigationGuard`, `useUnloadGuard`; async `onBefore`; `force`; `blocked`
  event; popstate-safe cancel/redirect) (#23).

## [0.0.2-SNAPSHOT.1] - 2026-09-12

### Added

- Pack-authored document head: `+head.svelte` compiles into the `.feb` manifest
  and the host renders it on document GET (#2).
- CSP nonces for pack-declared head assets with opt-in `KeelConfig.csp` (#5).
- Pack hot reload with `seed.build` / `X-Keel-Build`, client full reload,
  host-side `.feb` watcher, and atomic packaging (#7, #14).
- Agent skills installable with `npx skills add kolektivdev/keel` plus
  `skills.sh.json` grouping (#21).

### Changed

- Call-site pack selection: `respondPage` / `route.keel` take an opened pack;
  the theme chain is removed.
- Repository moved to `kolektivdev/keel`.
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
