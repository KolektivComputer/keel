import {
  applyHead,
  fromPageHead,
  getPage,
  type KeelSeed,
  type PageContext,
  type PageModule,
} from "@kolektiv/keel"
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  onScopeDispose,
  shallowRef,
  watch,
  type App,
  type Component,
} from "vue"
import { KEEL_PROVIDER_KEY, type KeelProviderValue } from "./context.js"
import { usePage } from "./page.js"

/** Layout component: renders its default slot, outermost layout first. */
type KeelLayout = Component

/** Applied once by the root, never by nested layouts or pages. */
const PageHead = defineComponent({
  name: "KeelPageHead",
  setup() {
    const seed = usePage()
    let cleanup: (() => void) | undefined
    watch(
      () => seed.value.head,
      (head) => {
        cleanup?.()
        cleanup = head ? applyHead(fromPageHead(head)) : undefined
      },
      { immediate: true },
    )
    onScopeDispose(() => {
      cleanup?.()
      cleanup = undefined
    })
    return () => null
  },
})

function nest(layouts: KeelLayout[], Page: Component, index: number) {
  if (index >= layouts.length) return h(Page)
  const Layout = layouts[index]!
  return h(Layout, null, { default: () => nest(layouts, Page, index + 1) })
}

function markMountError(target: Element, error: unknown): void {
  if (target.querySelector("[data-keel-mount-error]")) return
  const pre = target.ownerDocument.createElement("pre")
  pre.setAttribute("data-keel-mount-error", "")
  pre.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
  target.append(pre)
}

/**
 * Mount factory for pack entries. Renders into the host with
 * `createApp(Root).mount(host)` — never hydration — because the document shell
 * is Kotlin-authored HTML, not Vue markup. Layouts nest outermost-first; the
 * seed head is applied once at the root; `update` swaps the reactive
 * `PageContext` and awaits `nextTick()` so descendants have committed the new
 * context (and seed) before the router continues. Mount errors are caught by
 * the app error handler, marked on the host with
 * `<pre data-keel-mount-error>`, and rethrown.
 */
export function createPage<T = unknown>(
  Page: Component,
  layouts: KeelLayout[] = [],
): PageModule<T> {
  let app: App<Element> | null = null
  const seedRef = shallowRef<KeelSeed<T>>()
  const contextRef = shallowRef<PageContext<T>>()
  const provider: KeelProviderValue<T> = { seed: seedRef, context: contextRef }

  const Root = defineComponent({
    name: "KeelRoot",
    setup() {
      return () => [h(PageHead), nest(layouts, Page, 0)]
    },
  })

  return {
    mount(host, context) {
      if (app) {
        app.unmount()
        app = null
      }
      host.replaceChildren()
      seedRef.value = getPage<T>()
      contextRef.value = context
      let failure: unknown
      const instance = createApp(Root)
      instance.provide(KEEL_PROVIDER_KEY, provider)
      instance.config.errorHandler = (error) => {
        failure ??= error
        markMountError(host, error)
      }
      app = instance
      instance.mount(host)
      if (failure) throw failure
    },
    unmount() {
      if (!app) return
      const current = app
      app = null
      current.unmount()
    },
    async update(context) {
      if (!app) return
      contextRef.value = context
      seedRef.value = getPage<T>()
      await nextTick()
    },
  }
}
