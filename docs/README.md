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
versioned range (`^0.0.1-SNAPSHOT.8`). Run `pnpm install` after changing it to
refresh `pnpm-lock.yaml`.

Chrome `0.0.1-SNAPSHOT.8` brings the canonical grouped theme picker: site
themes are grouped by family (Catppuccin, Kolektiv, Nordic, daisyUI) and code
themes are curated to the Catppuccin flavours plus Nord, Kolektiv, and
`follow`. Its footer renders an enlarged built-by mark above the copyright, the
active sidebar link stays readable under `kolektiv-dark`, nord, and light
themes, and the source-control menu is driven by the `repo.remotes` list
(Keel points it at GitHub and `git.yuri.capital`).

Chrome owns the switcher state. It renders one navbar control per configured
`switcher`, persists the choice, sets `<html data-<id>>`, and injects CSS that
hides every `[data-<id>-panel]` then reveals the one matching the html-level
value (or `="all"`). A control only appears on a page that contains a matching
panel. Keel's content components therefore emit `data-<id>-panel` markers
instead of their own selects or buttons: the `gradle` switcher uses
`data-gradle-panel`, and the framework dropdown appears wherever
`data-framework-panel` exists.

## Customizing the navbar

The shared navbar is driven by `NavbarConfig`, set site-wide through
`docs-chrome.ts` (`docs.config.navbar`) and overridable per page with the
`navbar` prop on `Base.astro` / `Docs.astro`:

```ts
navbar: {
  showBrand: true,
  showLabel: true,
  showLang: true,
  showSwitchers: true,
  showFramework: true,
  showScm: true,
  showTheme: true,
  links: [{ label: "GitHub", href: "https://github.com/KolektivComputer/keel" }],
}
```

Every flag defaults to `true`, so leaving `config.navbar` unset renders exactly
as before; `links` are appended to the navbar end. Per-page overrides are
partial and merged over `config.navbar` by the chrome's `resolveNavbar`.

The chrome layouts also accept the named slots `brand`, `navbar-start`,
`navbar-center`, and `navbar-end` for full markup takeovers, but those are only
usable when a page consumes the chrome `BaseLayout` / `DocsLayout` directly.
Keel's wrappers cannot forward them: Astro registers a forwarded
`<slot slot="…">` statically, so the chrome's `Astro.slots.has` check reports the
slot as filled even when the page supplies nothing, which suppresses the default
brand and label. Use the `navbar` prop here instead.
