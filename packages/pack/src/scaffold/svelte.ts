import {
  bootstrapContent,
  envDtsContent,
  idOverride,
  packageJsonContent,
  stylesContent,
  tsconfigContent,
  viteConfigContent,
  type ScaffoldPage,
  type ScaffoldProvider,
} from "./provider.ts"

const SVELTE_DTS = `declare module "*.svelte" {
  import type { Component } from "svelte"
  const component: Component
  export default component
}

`

function svelteConfig(): string {
  return `/** @type {import('@sveltejs/vite-plugin-svelte').Options} */
export default {
  compilerOptions: { runes: true },
  vitePlugin: {
    dynamicCompileOptions({ filename }) {
      if (filename.includes("node_modules")) return { runes: false }
    },
  },
}
`
}

function rootLayout(): string {
  return `<script lang="ts">
  import type { Snippet } from "svelte"
  import "../styles.css"

  let { children }: { children: Snippet } = $props()
</script>

<div class="shell">
  {@render children()}
</div>
`
}

function pageSvelte(page: ScaffoldPage): string {
  return `<script lang="ts">
  import { Head, page } from "@kolektiv/keel-svelte"
  import type { ${page.typeName} } from "${page.typesImport}"

  const ctx = page<${page.typeName}>()
</script>

<Head />

<p class="lede">${page.id} · <code>${page.path}</code></p>
<pre>{JSON.stringify(ctx.data, null, 2)}</pre>
`
}

export function svelteScaffoldProvider(): ScaffoldProvider {
  return {
    name: "svelte",
    packageJson: (project) =>
      packageJsonContent(
        project.id,
        project.version,
        {
          "@kolektiv/keel": "workspace:*",
          "@kolektiv/keel-svelte": "workspace:*",
          "@tanstack/query-core": "^5.66.0",
          "@tanstack/svelte-query": "^5.66.0",
          svelte: "^5.16.0",
        },
        {
          "@kolektiv/keel-pack": "workspace:*",
          "@sveltejs/vite-plugin-svelte": "^5.0.3",
          typescript: "^5.7.0",
          vite: "^6.2.0",
        },
        project.keelVersion,
      ),
    tsconfig: () =>
      tsconfigContent(
        {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          isolatedModules: true,
          skipLibCheck: true,
          noEmit: true,
          verbatimModuleSyntax: true,
          types: ["vite/client"],
        },
        ["src/**/*.ts", "src/**/*.d.ts"],
      ),
    frameworkConfig: () => [{ file: "svelte.config.js", content: svelteConfig() }],
    viteConfig: (project) =>
      viteConfigContent(project, "svelte", {
        import: `import { svelte } from "@sveltejs/vite-plugin-svelte"`,
        call: "svelte()",
      }),
    envDts: () => envDtsContent(SVELTE_DTS),
    bootstrap: () => bootstrapContent("@kolektiv/keel-svelte"),
    styles: () => stylesContent(),
    rootLayout: () => ({ file: "src/pages/+layout.svelte", content: rootLayout() }),
    pageFiles: (page) => [idOverride("+page.ts", page.id), { file: "+page.svelte", content: pageSvelte(page) }],
  }
}
