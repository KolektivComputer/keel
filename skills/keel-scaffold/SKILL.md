---
name: keel-scaffold
description: >
  Scaffold a Keel pack from a running host's live schema. Use when the user
  wants a new pack directory, blank pages for each page id, or
  `keel-scaffold example.com ./pack`. Triggers: "keel-scaffold",
  "/__keel/schema", "scaffold pack", "blank pages". Slash: /keel-scaffold.
---

# keel-scaffold

The host is the source of truth. `GET /__keel/schema` returns `keel/1` JSON
(pages with `type`/`path`/`methods`, actions, types). The CLI writes a blank
Svelte pack that implements those ids.

```
pnpm exec keel-scaffold <origin> <dir>
pnpm exec keel-scaffold --schema schema.json <dir>
pnpm exec keel-scaffold 127.0.0.1:8090 ./pack --id harbor --version 0.1.0
```

## Origin and scheme

`localhost`, `127.*`, `0.0.0.0`, and `[::…]` get `http://`. Any other host
gets `https://` unless the origin already names a scheme. Trailing slashes
are trimmed, then the CLI fetches `{origin}/__keel/schema`. `--schema
<file.json>` skips the fetch and parses a saved contract instead. The schema
`format` must be `keel/1` and it must carry a non-empty `pages` object.

## Flags

- `--schema <file.json>` — offline contract instead of an origin.
- `--framework svelte` — the default. `--framework react` parses but fails:
  "not generated yet".
- `--id <id>` — pack id; defaults to the output directory basename
  (sanitized).
- `--version <v>` — defaults `0.1.0`.
- `--force` — overwrite existing files. Without it the first existing file
  aborts the run.

## What it writes

Always: `package.json`, `tsconfig.json`, `svelte.config.js`, `vite.config.ts`,
`src/env.d.ts`, `src/bootstrap.ts`, `src/styles.css`,
`src/pages/+layout.svelte`, `src/lib/page-types.ts`, and
`src/lib/page-types.json`.

Per page id (`id.split(".")` becomes directories):

- `src/pages/{dirs}/+page.ts` — `export const id = "…"`.
- `src/pages/{dirs}/+page.svelte` — `page<T>()`, `<Head />`, JSON dump.

It does **not** emit `+head.svelte`; add one per page when you want a
pack-authored document head. `vite.config.ts` wires `keelPack` with the id,
version, `contract: "src/lib/page-types.json"`, and `pack: "dist/<id>.feb"`.
When a page id ends in `.notFound` (or is `not-found`/`notFound`) it also
sets `notFound:`. Type names come from `schema.pagesName`, else
PascalCase(id) + `Pages`.

## After

`pnpm install` in a workspace with `@kolektiv/keel*` (or change `workspace:*`
to published versions), then `pnpm build`. Point the host at `dist/<id>.feb`,
or `dist/` for `FrontendBundle.fromDirectory`.

Do not invent page ids. If the schema is missing a page the host registered,
fix the host and re-fetch `/__keel/schema`. Schema `path` values are host
URLs, not pack routes.
