---
name: keel-scaffold
description: >
  Scaffold a Keel pack from a running host's live schema. Use when the user
  wants a new pack directory, blank pages for each page id, or
  `keel-scaffold example.com ./pack --framework react`. Triggers:
  "keel-scaffold", "--framework", "/__keel/schema", "scaffold pack",
  "blank pages". Slash: /keel-scaffold.
---

# keel-scaffold

The host is the source of truth. `GET /__keel/schema` returns `keel/1` JSON
(pages with `type`/`path`/`methods`, actions, types). The CLI writes a blank
pack for the chosen framework that implements those ids.

```
pnpm exec keel-scaffold <origin> <dir>
pnpm exec keel-scaffold --schema schema.json <dir>
pnpm exec keel-scaffold 127.0.0.1:8090 ./pack --id harbor --version 0.1.0 --framework react
```

## Origin and scheme

`localhost`, `127.*`, `0.0.0.0`, and `[::…]` get `http://`. Any other host
gets `https://` unless the origin already names a scheme. Trailing slashes
are trimmed, then the CLI fetches `{origin}/__keel/schema`. `--schema
<file.json>` skips the fetch and parses a saved contract instead. The schema
`format` must be `keel/1` and it must carry a non-empty `pages` object.

## Flags

- `--schema <file.json>` — offline contract instead of an origin.
- `--framework <name>` — `angular`, `lit`, `preact`, `react`, `solid`,
  `svelte`, or `vue`; the default is `svelte`. An unknown name is rejected
  before anything is written.
- `--id <id>` — pack id; defaults to the output directory basename
  (sanitized).
- `--version <v>` — defaults `0.1.0`.
- `--force` — overwrite existing files. Without it the first existing file
  aborts the run.

## What it writes

Always: `package.json`, `tsconfig.json`, `vite.config.ts`, `src/env.d.ts`,
`src/bootstrap.ts`, `src/styles.css`, `src/lib/page-types.ts`, and
`src/lib/page-types.json`.

Per page id (`id.split(".")` becomes directories), the provider emits the
component, the id override, and — except for Svelte — a `+head.html`:

| Framework | Page component | Id override | Head template | Extra root files |
| --- | --- | --- | --- | --- |
| `svelte` | `+page.svelte` | `+page.ts` | none | `svelte.config.js` |
| `react` | `+page.tsx` | `+page.ts` | `+head.html` | — |
| `preact` | `+page.tsx` | `+page.ts` | `+head.html` | — |
| `solid` | `+page.tsx` | `+page.ts` | `+head.html` | — |
| `vue` | `+page.vue` | `+page.ts` | `+head.html` | — |
| `lit` | `+page.ts` | `+page.id.ts` | `+head.html` | — |
| `angular` | `+page.ts` | `+page.id.ts` | `+head.html` | `tsconfig.app.json` |

The root layout is `src/pages/+layout.svelte` / `+layout.vue` /
`+layout.tsx` / `+layout.ts` to match the component extension. Lit pages are
classes extending `KeelElement`; Angular pages use `injectKeelPage<T>()`;
React, Preact, Solid, and Vue pages call `usePage<T>()`; Svelte pages call
`page<T>()`.

Svelte does **not** emit `+head.svelte`; add one per page when you want a
pack-authored document head. Every other framework gets a generated
`+head.html` whose `<title>` uses the payload's `title` field, else the first
string field, else `{seed.page}`.

`vite.config.ts` wires `keelPack` with the id, version, `framework`,
`contract: "src/lib/page-types.json"`, and `pack: "dist/<id>.feb"`, plus the
framework's Vite plugin (`svelte()`, `react()`, `vue()`, `solid()`,
`preact()`, none for Lit, `analog({ tsconfig: "tsconfig.app.json" })` for
Angular). When a page id ends in `.notFound` (or is `not-found`/`notFound`)
it also sets `notFound:`. Type names come from `schema.pagesName`, else
PascalCase(id) + `Pages`.

Framework-specific DX notes:

- **Lit** — `tsconfig.json` sets `experimentalDecorators: true` and
  `useDefineForClassFields: false`.
- **Angular** — Angular 19 (`@angular/*` `^19.0.0`) rejects TypeScript
  ≥ 5.9, so `typescript` is pinned to `~5.8.3`. The build uses the Analog
  Vite plugin plus `@angular/build`; `tsconfig.app.json` extends
  `tsconfig.json` with `noEmit: false` and `outDir: "./out-tsc/app"` because
  Analog compiles from its own program, and `vite.config.ts` passes
  `tsconfig: "tsconfig.app.json"` explicitly (keelPack's lib mode would
  otherwise make Analog look for a missing `tsconfig.lib.prod.json`).

`package.json` pins every `@kolektiv/keel*` dependency to the
`@kolektiv/keel-pack` version that scaffolded it, alongside the framework
runtime and its TanStack query package (see the `keel-pack` skill's
framework table).

## After

`pnpm install`, then `pnpm build`. Point the host at `dist/<id>.feb`, or
`dist/` for `FrontendBundle.fromDirectory`.

Do not invent page ids. If the schema is missing a page the host registered,
fix the host and re-fetch `/__keel/schema`. Schema `path` values are host
URLs, not pack routes.
