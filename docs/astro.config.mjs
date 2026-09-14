// @ts-check
import { copyFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "astro/config"
import mdx from "@astrojs/mdx"
import tailwindcss from "@tailwindcss/vite"
import { createShikiConfig } from "@kolektiv/common-docs-chrome"

import { docs } from "./src/docs-chrome.ts"

const sandboxPlugin = fileURLToPath(new URL("../scripts/grok-pwa-plugin.mjs", import.meta.url))
/** @type {any[]} */
const extraVitePlugins = []
if (existsSync(sandboxPlugin)) {
  const [{ grokPwaPlugin }, { appEnvPlugin }] = await Promise.all([
    import(sandboxPlugin),
    import(fileURLToPath(new URL("../scripts/app-env-plugin.mjs", import.meta.url))),
  ])
  extraVitePlugins.push(grokPwaPlugin(), appEnvPlugin())
}

const llmsTxt = fileURLToPath(new URL("../llms.txt", import.meta.url))

/** Canonical file is repo-root `llms.txt`. Copy a real file into dist so Pages is not a dangling symlink. */
function llmsTxtIntegration() {
  return {
    name: "keel-llms-txt",
    hooks: {
      /** @param {{ dir: URL }} ctx */
      "astro:build:done": ({ dir }) => {
        const base = dir.href.endsWith("/") ? dir : new URL(`${dir.href}/`)
        copyFileSync(llmsTxt, fileURLToPath(new URL("llms.txt", base)))
      },
    },
  }
}

export default defineConfig({
  site: docs.siteUrl,
  base: docs.base,
  output: "static",
  redirects: {
    "/docs/getting-started/install": "/docs/getting-started/server",
    "/docs/advanced/theme-chain": "/docs/advanced/choosing-a-pack",
  },
  outDir: "../dist",
  publicDir: "../public",
  srcDir: "./src",
  integrations: [mdx(), llmsTxtIntegration()],
  markdown: {
    // Registers every built-in Kolektiv, Catppuccin, Nord and daisyUI theme.
    shikiConfig: {
      ...createShikiConfig(docs.themes),
      wrap: true,
    },
  },
  vite: {
    plugins: [tailwindcss(), ...extraVitePlugins],
    server: {
      host: "0.0.0.0",
      port: 8080,
      strictPort: true,
    },
    preview: {
      host: "127.0.0.1",
      port: 8081,
      strictPort: true,
    },
  },
})
