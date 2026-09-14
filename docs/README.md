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

`@kolektiv/common-docs-chrome` is currently wired as a local `link:` to a sibling
checkout:

```json
"@kolektiv/common-docs-chrome": "link:../../../../github.com/KolektivComputer/common-docs-chrome"
```

TODO: once the package is published to the `keel-npm` registry
(`https://repo.yuri.capital/repository/keel-npm/`), replace that value with
`^0.0.1-SNAPSHOT.1` and run `pnpm install` to refresh `pnpm-lock.yaml`.

CI implication: `.github/workflows/pages.yml` runs
`pnpm install --frozen-lockfile`, and the linked path does not exist in a CI
checkout of this repo alone. The Pages workflow therefore cannot install/build
until the package is published and the dependency is switched to the versioned
range above (or CI is given a sibling checkout of the package).
