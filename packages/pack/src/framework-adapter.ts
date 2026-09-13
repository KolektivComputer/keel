import type { RouterAdapter } from "./adapter.ts"
import { discoverPages, pageEntrySource } from "./discovery.ts"
import { compileHtmlHeadTemplate } from "./head-template.ts"

const HEAD_FILE = "+head.html"

/**
 * A codegen-only framework adapter: no runtime framework imports, just file
 * conventions and the mount subpath the emitted entry imports `createPage`
 * from.
 *
 * Page/layout extensions differ per framework. The id override lives in
 * `idFile`: `+page.ts` beside `+page.tsx` / `+page.vue`, and `+page.id.ts`
 * when the page itself is `+page.ts` (Lit, Angular), where a sibling
 * `+page.ts` would collide. Every adapter uses the neutral `+head.html`.
 */
export interface FrameworkAdapterSpec {
  name: string
  /** Runtime mount module, e.g. `@kolektiv/keel-react/mount`. */
  mount: string
  pageFile: string
  layoutFile: string
  idFile: string
}

export function frameworkAdapter(spec: FrameworkAdapterSpec): RouterAdapter {
  return {
    name: spec.name,
    discover(pagesDir: string) {
      return discoverPages(pagesDir, {
        pageFile: spec.pageFile,
        layoutFile: spec.layoutFile,
        idFile: spec.idFile,
        headFile: HEAD_FILE,
        compileHead: compileHtmlHeadTemplate,
      })
    },
    entrySource(page) {
      return pageEntrySource(page, spec.mount)
    },
  }
}
