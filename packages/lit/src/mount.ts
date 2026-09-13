import type { PageContext, PageModule } from "@kolektiv/keel"
import { html, nothing, render, type LitElement } from "lit"
import { KEEL_ROOT_TAG, KeelRoot } from "./root.js"

/** A page or layout class: any `LitElement` subclass, typically `KeelElement`. */
type KeelElementConstructor = new () => LitElement

function markMountError(target: Element, error: unknown): void {
  if (target.querySelector("[data-keel-mount-error]")) return
  const pre = target.ownerDocument.createElement("pre")
  pre.setAttribute("data-keel-mount-error", "")
  pre.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
  target.append(pre)
}

const autoTags = new WeakMap<KeelElementConstructor, string>()
let autoTagCount = 0

/**
 * Returns the registered tag for a page/layout class, registering it under a
 * derived `kebab-case` name when the pack did not use `@customElement`.
 * Custom element constructors cannot be invoked before registration — the
 * platform throws "Illegal constructor" — so `createPage` owns this fallback
 * for plain classes.
 */
function elementFor(ctor: KeelElementConstructor): LitElement {
  if (typeof customElements === "undefined") return new ctor()
  const registered = customElements.getName(ctor)
  if (registered) return document.createElement(registered) as LitElement

  let tag = autoTags.get(ctor)
  if (!tag) {
    const kebab = ctor.name
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
    const base = kebab.includes("-") ? kebab : `keel-${kebab || "view"}`
    tag = base
    while (customElements.get(tag) && customElements.get(tag) !== ctor) {
      autoTagCount += 1
      tag = `${base}-${autoTagCount}`
    }
    if (!customElements.get(tag)) customElements.define(tag, ctor)
    autoTags.set(ctor, tag)
  }
  return document.createElement(tag) as LitElement
}

/**
 * Mount factory for pack entries. Renders a `KeelRoot` context provider into
 * the host with `render()` from `lit` — never hydration — because the
 * document shell is Kotlin-authored HTML, not Lit markup. Page and layout
 * classes are instantiated once and nested outermost-first through their
 * default slots: each layout renders `<slot></slot>`, so the page lives in the
 * innermost layout's light DOM. The root owns the `PageContext` provider and
 * the single seed-head application; `update(ctx)` pushes the new context to
 * every `KeelElement` without re-instantiating the tree; `unmount()` renders
 * `nothing` and clears the host. Mount errors are marked on the host with
 * `<pre data-keel-mount-error>` and rethrown from the returned promise (Lit
 * first updates run on a microtask, so `mount` awaits the chain).
 */
export function createPage<T = unknown>(
  Page: KeelElementConstructor,
  layouts: KeelElementConstructor[] = [],
): PageModule<T> {
  let host: Element | undefined
  let root: KeelRoot | undefined

  function instantiate(ctx: PageContext<T>): { root: KeelRoot; chain: LitElement[] } {
    const chain: LitElement[] = []
    let child: LitElement = elementFor(Page)
    chain.push(child)
    for (let index = layouts.length - 1; index >= 0; index -= 1) {
      const layout = elementFor(layouts[index])
      layout.append(child)
      chain.push(layout)
      child = layout
    }
    const nextRoot = document.createElement(KEEL_ROOT_TAG) as KeelRoot
    nextRoot.ctx = ctx as PageContext
    nextRoot.append(child)
    return { root: nextRoot, chain }
  }

  function teardown(): void {
    if (!host) return
    const current = host as HTMLElement
    host = undefined
    root = undefined
    render(nothing, current)
    current.replaceChildren()
  }

  return {
    async mount(nextHost: Element, nextContext: PageContext<T>): Promise<void> {
      if (host) teardown()
      nextHost.replaceChildren()
      const composed = instantiate(nextContext)
      host = nextHost
      root = composed.root
      try {
        render(html`${composed.root}`, nextHost as HTMLElement)
        await Promise.all(composed.chain.map((element) => element.updateComplete))
      } catch (error) {
        markMountError(nextHost, error)
        throw error
      }
    },
    unmount(): void {
      teardown()
    },
    update(nextContext: PageContext<T>): void {
      if (!root) return
      root.ctx = nextContext as PageContext
    },
  }
}
