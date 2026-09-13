import { createComponent, type ComponentRef, type Type } from "@angular/core"
import {
  applyHead,
  fromPageHead,
  subscribe,
  type KeelSeed,
  type PageModule,
} from "@kolektiv/keel"
import { KeelContext } from "./context.js"
import {
  createKeelInjector,
  keelApplication,
  markMountError,
  mountHostTag,
} from "./runtime.js"

/**
 * Mount factory for pack entries. Creates the page component and nests the
 * layouts around it outermost-first with `createComponent` +
 * `projectableNodes`, so each layout's `<ng-content />` receives the tree
 * below it. The per-mount environment injector provides the reactive
 * `PageContext` and a scoped error handler; the root applies the seed head
 * once and cleans it up on unmount.
 *
 * `createComponent` never hydrates — the document shell is Kotlin-authored
 * HTML, not Angular markup. Views are attached to the shared Keel
 * `ApplicationRef` for zoneless change detection, and `mount` / `update` run
 * `detectChanges()` on each view synchronously. That keeps DOM assertions
 * true right after the call *and* lets template errors be caught, because
 * `ApplicationRef.tick()` swallows errors into the app `ErrorHandler` while
 * a detached view's `detectChanges()` rethrows them. A failed mount is
 * marked on the host as `<pre data-keel-mount-error>` and rethrown.
 */
export function createPage<T = unknown>(
  Page: Type<unknown>,
  layouts: Type<unknown>[] = [],
): PageModule<T> {
  let refs: ComponentRef<unknown>[] | undefined
  let context: KeelContext<T> | undefined
  let teardown: (() => void) | undefined

  function unmountCurrent(): void {
    const current = teardown
    teardown = undefined
    refs = undefined
    context = undefined
    current?.()
  }

  function detectAll(): void {
    if (!refs) return
    for (let index = refs.length - 1; index >= 0; index -= 1) {
      refs[index]!.changeDetectorRef.detectChanges()
    }
  }

  return {
    async mount(host, nextContext): Promise<void> {
      const runtime = await keelApplication()
      unmountCurrent()
      host.replaceChildren()

      const ctx = new KeelContext<T>(nextContext)
      const injector = createKeelInjector(runtime.injector, ctx)
      const mountedRefs: ComponentRef<unknown>[] = []
      let unsubscribe: (() => void) | undefined
      let headCleanup: (() => void) | undefined

      try {
        const pageHost = host.ownerDocument.createElement(mountHostTag(Page))
        mountedRefs.push(createComponent(Page, { environmentInjector: injector, hostElement: pageHost }))
        let current: Node = pageHost
        for (let index = layouts.length - 1; index >= 0; index -= 1) {
          const layout = layouts[index]!
          const layoutHost = host.ownerDocument.createElement(mountHostTag(layout))
          mountedRefs.push(
            createComponent(layout, {
              environmentInjector: injector,
              hostElement: layoutHost,
              projectableNodes: [[current]],
            }),
          )
          current = layoutHost
        }

        host.replaceChildren(current)
        for (const ref of mountedRefs) runtime.attachView(ref.hostView)
        refs = mountedRefs
        detectAll()

        unsubscribe = subscribe((seed: KeelSeed) => {
          headCleanup?.()
          headCleanup = seed.head ? applyHead(fromPageHead(seed.head)) : undefined
        })
      } catch (error) {
        refs = undefined
        for (const ref of [...mountedRefs].reverse()) {
          runtime.detachView(ref.hostView)
          ref.destroy()
        }
        injector.destroy()
        markMountError(host, error)
        throw error
      }

      context = ctx
      teardown = () => {
        for (const ref of [...mountedRefs].reverse()) {
          runtime.detachView(ref.hostView)
          ref.destroy()
        }
        injector.destroy()
        unsubscribe?.()
        unsubscribe = undefined
        headCleanup?.()
        headCleanup = undefined
        host.replaceChildren()
      }
    },
    unmount(): void {
      unmountCurrent()
    },
    update(nextContext): void {
      if (!context) return
      context.set(nextContext)
      detectAll()
    },
  }
}
