import { defineDocsChrome } from "@kolektiv/common-docs-chrome"

/**
 * Shared docs chrome configuration for keel.mey.cat.
 *
 * The sidebar nav is generated from the `docs` content collection in
 * `src/lib/nav.ts` and merged in by `src/layouts/Docs.astro`, so the collection
 * stays the single source of truth. `nav` stays empty here because this module
 * is also imported by `astro.config.mjs`, where `astro:content` is unavailable.
 */
const siteUrl = process.env.DOCS_SITE ?? "http://localhost:8080"

export const docs = defineDocsChrome({
  name: "Keel",
  description:
    "Host-owned routing and render-time frontend packs for Kotlin servers. Svelte, React, Vue, Solid, Preact, Lit, and Angular adapters.",
  siteUrl,
  base: "/",
  logo: "/logo.svg",
  mark: "/logo.svg",
  defaultTheme: "catppuccin-mocha",
  defaultCodeTheme: "follow",
  themeFamily: "catppuccin",
  themeFamilies: ["catppuccin", "kolektiv", "nord", "daisyui"],
  nav: [],
  repo: {
    url: "https://github.com/KolektivComputer/keel",
    branch: "main",
  },
  scm: [
    { label: "GitHub", href: "https://github.com/KolektivComputer/keel" },
    { label: "yuri.capital", href: "https://git.yuri.capital/kolektiv/keel" },
  ],
  langs: [
    { id: "ts", label: "TypeScript" },
    { id: "js", label: "JavaScript" },
  ],
  frameworks: [
    { id: "svelte", label: "Svelte" },
    { id: "react", label: "React" },
    { id: "vue", label: "Vue" },
    { id: "solid", label: "Solid" },
    { id: "preact", label: "Preact" },
    { id: "lit", label: "Lit" },
    { id: "angular", label: "Angular" },
  ],
  switchers: [
    {
      id: "gradle",
      label: "Build script",
      options: [
        { id: "kts", label: "Kotlin DSL" },
        { id: "groovy", label: "Groovy" },
      ],
      default: "kts",
    },
  ],
  defaultLang: "ts",
  defaultFramework: "svelte",
  footer: {
    tagline: "The host owns the contract. Packs implement the pages.",
    links: [
      { label: "Getting started", href: "/docs/getting-started" },
      { label: "Core concepts", href: "/docs/core-concepts/routing" },
      { label: "Advanced cases", href: "/docs/advanced/choosing-a-pack" },
      { label: "Implementing Keel", href: "/docs/implementing/protocol" },
      { label: "llms.txt", href: "/llms.txt" },
      { label: "GitHub", href: "https://github.com/KolektivComputer/keel" },
      { label: "git.yuri.capital", href: "https://git.yuri.capital/kolektiv/keel" },
    ],
  },
})
