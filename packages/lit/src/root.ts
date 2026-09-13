import {
  applyHead,
  fromPageHead,
  subscribe,
  type KeelSeed,
  type PageContext,
} from "@kolektiv/keel"
import { ContextProvider } from "@lit/context"
import { css, html, LitElement, type ReactiveController, type ReactiveControllerHost } from "lit"
import { keelPageContext } from "./context.js"

/**
 * Applies the mounted seed's head from the core store at the root of the page
 * tree, once per seed — never from layouts or the page itself. The returned
 * core cleanup disposes the created nodes on disconnect or on the next seed.
 */
class SeedHeadController implements ReactiveController {
  private unsubscribe: (() => void) | undefined
  private cleanup: (() => void) | undefined

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this)
  }

  hostConnected(): void {
    this.unsubscribe = subscribe((seed) => this.apply(seed))
  }

  hostDisconnected(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
    this.cleanup?.()
    this.cleanup = undefined
  }

  private apply(seed: KeelSeed): void {
    this.cleanup?.()
    this.cleanup = seed.head ? applyHead(fromPageHead(seed.head)) : undefined
  }
}

/**
 * Internal root of a `createPage()` tree: a context provider for the current
 * `PageContext` plus the single seed-head application. Rendered once per
 * mount; `ctx` updates reuse the same root and element chain.
 *
 * Registered with a side-effecting `customElements.define` because HTML
 * element constructors (`new`, and `document.createElement` for an
 * unregistered tag) throw "Illegal constructor" otherwise.
 *
 * @internal
 */
export class KeelRoot extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `

  private readonly provider = new ContextProvider(this, {
    context: keelPageContext,
    initialValue: undefined,
  })
  private readonly head = new SeedHeadController(this)

  set ctx(value: PageContext) {
    this.provider.setValue(value)
  }

  get ctx(): PageContext | undefined {
    return this.provider.value
  }

  render() {
    return html`<slot></slot>`
  }
}

export const KEEL_ROOT_TAG = "keel-root"

if (typeof customElements !== "undefined" && !customElements.get(KEEL_ROOT_TAG)) {
  customElements.define(KEEL_ROOT_TAG, KeelRoot)
}
