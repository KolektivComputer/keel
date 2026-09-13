import type { PageContext } from "@kolektiv/keel"
import { ContextConsumer } from "@lit/context"
import { css, LitElement } from "lit"
import { keelPageContext } from "./context.js"
import { KeelPageController, type KeelPage } from "./page.js"

/**
 * Page and layout base class. Extends `LitElement` with the two reactive
 * reads every pack page needs:
 *
 * - `ctx` is the current `PageContext` provided by the `createPage` root
 *   (`params`, `data`, `errors`, `theme`, `shared`, `navigate`); an
 *   `update(ctx)` on the mount pushes a new value to every descendant.
 * - `page` is the cached seed-store snapshot including `processing`.
 *
 * Elements are instantiated directly by `createPage`, so they do not need to
 * be registered with `customElements.define`.
 */
export class KeelElement<T = unknown> extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `

  private readonly keelContext = new ContextConsumer(this, {
    context: keelPageContext,
    subscribe: true,
  })
  private readonly keelPage = new KeelPageController<T>(this)

  /** The `PageContext` for the mounted seed. */
  get ctx(): PageContext<T> {
    const value = this.keelContext.value
    if (!value) {
      throw new Error("Keel: page context is only available inside a createPage() tree")
    }
    return value as PageContext<T>
  }

  /** The current seed plus router `processing`, cached between store changes. */
  get page(): KeelPage<T> {
    return this.keelPage.current
  }
}
