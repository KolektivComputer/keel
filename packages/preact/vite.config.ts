import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import preact from "@preact/preset-vite"

const entry = (file: string) => fileURLToPath(new URL(`./src/${file}`, import.meta.url))

export default defineConfig({
  plugins: [preact()],
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
      external: ["preact", /^preact\//, "@kolektiv/keel", "@tanstack/preact-query"],
    },
  },
})
