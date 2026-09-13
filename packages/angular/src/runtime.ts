import {
  ApplicationRef,
  createEnvironmentInjector,
  provideExperimentalZonelessChangeDetection,
  type EnvironmentInjector,
  type Type,
} from "@angular/core"
import { createApplication } from "@angular/platform-browser"
import { provideTanStackQuery } from "@tanstack/angular-query-experimental"
import { KEEL_CONTEXT, type KeelContext } from "./context.js"
import { getQueryClient } from "./query.js"

let application: ApplicationRef | undefined
let applicationPromise: Promise<ApplicationRef> | undefined

/**
 * The pack-wide Angular application, created once per page load. `bootstrap`
 * awaits it before core applies the embedded seed; `createPage` awaits it on
 * mount, so mounting without `bootstrap` still works.
 *
 * The application is **zoneless** (`provideExperimentalZonelessChangeDetection`,
 * still experimental in Angular 19) with TanStack Query provided from the
 * shared {@link getQueryClient}. Angular 20 promotes the provider to
 * `provideZonelessChangeDetection`; until the peer range moves there this
 * package stays on the experimental name.
 */
export function keelApplication(): Promise<ApplicationRef> {
  applicationPromise ??= createApplication({
    providers: [
      provideExperimentalZonelessChangeDetection(),
      ...provideTanStackQuery(getQueryClient()),
    ],
  }).then((app) => {
    application = app
    return app
  })
  return applicationPromise
}

/** The application once {@link keelApplication} has resolved. */
export function keelApplicationSync(): ApplicationRef | undefined {
  return application
}

/** @internal Test-only: destroy and drop the cached application. */
export function resetKeelApplication(): void {
  application?.destroy()
  application = undefined
  applicationPromise = undefined
}

/**
 * Creates the per-mount environment injector that provides the reactive
 * `PageContext` holder. Every page and layout component is created with this
 * injector, so `injectKeelContext()` resolves to the same holder for the
 * whole tree.
 */
export function createKeelInjector(
  parent: EnvironmentInjector,
  context: KeelContext,
): EnvironmentInjector {
  return createEnvironmentInjector([{ provide: KEEL_CONTEXT, useValue: context }], parent)
}

function componentSelectors(type: Type<unknown>): string[][] | undefined {
  return (type as { ɵcmp?: { selectors?: string[][] } }).ɵcmp?.selectors
}

/**
 * Host tag for a page or layout component. `createComponent` accepts any
 * element as host; using the component's own element selector keeps global
 * pack CSS (e.g. `keel-layout { … }`) working. Selectors that are not a plain
 * tag name (attribute or class selectors) fall back to `div`.
 */
export function mountHostTag(type: Type<unknown>): string {
  const selector = componentSelectors(type)?.[0]?.[0]
  return selector && /^[a-z][a-z0-9-]*$/.test(selector) ? selector : "div"
}

/** Marks a failed mount on the host, matching the other adapters. */
export function markMountError(target: Element, error: unknown): void {
  if (target.querySelector("[data-keel-mount-error]")) return
  const pre = target.ownerDocument.createElement("pre")
  pre.setAttribute("data-keel-mount-error", "")
  pre.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
  target.append(pre)
}
