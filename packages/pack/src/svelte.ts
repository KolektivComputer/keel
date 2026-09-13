import type { DiscoveredPage, RouterAdapter } from "./adapter.ts"
import { discoverPages, pageEntrySource } from "./discovery.ts"
import { compileHeadTemplate } from "./head-template.ts"

export function svelteFiles(): RouterAdapter {
  return {
    name: "svelte",
    discover(pagesDir: string): DiscoveredPage[] {
      return discoverPages(pagesDir, {
        pageFile: "+page.svelte",
        layoutFile: "+layout.svelte",
        idFile: "+page.ts",
        headFile: "+head.svelte",
        compileHead: compileHeadTemplate,
      })
    },
    entrySource(page: DiscoveredPage): string {
      return pageEntrySource(page, "@kolektiv/keel-svelte/mount")
    },
  }
}
