import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const entry = (file: string) => fileURLToPath(new URL(`./src/${file}`, import.meta.url))

export default defineConfig({
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
      external: ["lit", /^lit\//, "@lit/context", "@kolektiv/keel", "@tanstack/query-core"],
    },
  },
})
