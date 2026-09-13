import {
  bootstrapContent,
  envDtsContent,
  headContent,
  idOverride,
  packageJsonContent,
  stylesContent,
  tsconfigContent,
  viteConfigContent,
  type ScaffoldPage,
  type ScaffoldProvider,
} from "./provider.ts"

const VUE_DTS = `declare module "*.vue" {
  import type { Component } from "vue"
  const component: Component
  export default component
}

`

function rootLayout(): string {
  return `<script setup lang="ts">
import "../styles.css"
</script>

<template>
  <div class="shell">
    <slot />
  </div>
</template>
`
}

function pageVue(page: ScaffoldPage): string {
  return `<script setup lang="ts">
import { Head, usePage } from "@kolektiv/keel-vue"
import type { ${page.typeName} } from "${page.typesImport}"

const seed = usePage<${page.typeName}>()
</script>

<template>
  <Head />
  <p class="lede">${page.id} · <code>${page.path}</code></p>
  <pre>{{ JSON.stringify(seed.data, null, 2) }}</pre>
</template>
`
}

export function vueScaffoldProvider(): ScaffoldProvider {
  return {
    name: "vue",
    packageJson: (project) =>
      packageJsonContent(
        project.id,
        project.version,
        {
          "@kolektiv/keel": "workspace:*",
          "@kolektiv/keel-vue": "workspace:*",
          "@tanstack/query-core": "^5.66.0",
          "@tanstack/vue-query": "^5.66.0",
          vue: "^3.5.13",
        },
        {
          "@kolektiv/keel-pack": "workspace:*",
          "@vitejs/plugin-vue": "^5.2.1",
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
          jsx: "preserve",
          types: ["vite/client"],
        },
        ["src/**/*.ts", "src/**/*.d.ts"],
      ),
    frameworkConfig: () => [],
    viteConfig: (project) =>
      viteConfigContent(project, "vue", {
        import: `import vue from "@vitejs/plugin-vue"`,
        call: "vue()",
      }),
    envDts: () => envDtsContent(VUE_DTS),
    bootstrap: () => bootstrapContent("@kolektiv/keel-vue"),
    styles: () => stylesContent(),
    rootLayout: () => ({ file: "src/pages/+layout.vue", content: rootLayout() }),
    pageFiles: (page) => [
      idOverride("+page.ts", page.id),
      { file: "+page.vue", content: pageVue(page) },
      { file: "+head.html", content: headContent(page) },
    ],
  }
}
