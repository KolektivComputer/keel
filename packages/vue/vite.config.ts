import { fileURLToPath } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

const entry = (file: string) => fileURLToPath(new URL(`./src/${file}`, import.meta.url))

export default defineConfig({
  plugins: [vue()],
  build: {
    target: "es2022",
    sourcemap: true,
    lib: {
      entry: {
        index: entry("index.ts"),
        mount: entry("mount.ts"),
        bootstrap: entry("bootstrap.ts"),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: ["vue", "@kolektiv/keel", "@tanstack/vue-query"],
    },
  },
})
