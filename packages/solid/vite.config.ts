import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

const entry = (file: string) => fileURLToPath(new URL(`./src/${file}`, import.meta.url))

export default defineConfig({
  plugins: [solid()],
  build: {
    target: "es2022",
    sourcemap: true,
    lib: {
      entry: {
        index: entry("index.ts"),
        mount: entry("mount.tsx"),
        bootstrap: entry("bootstrap.ts"),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: ["solid-js", /^solid-js\//, "@kolektiv/keel", "@tanstack/solid-query"],
    },
  },
})
