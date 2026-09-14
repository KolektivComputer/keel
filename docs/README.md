# @kolektiv/keel-docs

Astro 7 + Tailwind 4 + daisyUI 5 documentation site for Keel. It renders the
shared Kolektiv docs chrome from `@kolektiv/common-docs-chrome` and the `docs`
content collection under `src/content/docs`.

```bash
pnpm --filter @kolektiv/keel-docs dev        # http://0.0.0.0:8080
pnpm --filter @kolektiv/keel-docs build      # static output -> ../dist
pnpm --filter @kolektiv/keel-docs preview    # http://127.0.0.1:8081
pnpm --filter @kolektiv/keel-docs check      # astro check
```

## Shared chrome dependency

`@kolektiv/common-docs-chrome` is consumed from the `@kolektiv` registry as a
versioned range (`^0.0.1-SNAPSHOT.1`). Run `pnpm install` after changing it to
refresh `pnpm-lock.yaml`.
