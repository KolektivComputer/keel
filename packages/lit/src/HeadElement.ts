import { applyHead } from "@kolektiv/keel"
import { LitElement, nothing } from "lit"
import { property } from "lit/decorators.js"
import { usePage } from "./page.js"

/**
 * Document head override for pack content, the Lit counterpart of
 * `<svelte:head>` and the other adapters' `Head` component. Properties win
 * over the current seed's head; `createPage`'s root owns the base
 * application, so this element is only needed when a page overrides head
 * fields.
 *
 * Applies on connect and after each property update, and removes everything
 * Keel created on disconnect.
 */
export class Head extends LitElement {
  /** Wins over the seed title; empty falls back to the seed. */
  @property() title = ""
  @property() description?: string
  @property() canonical?: string
  @property() image?: string
  @property() type?: string
  /** Raw sanitized head markup, like `seed.head.html`. */
  @property() html?: string

  private readonly keelPage = usePage<unknown>(this)
  private cleanup: (() => void) | undefined

  override connectedCallback(): void {
    super.connectedCallback()
    this.apply()
  }

  protected override updated(): void {
    this.apply()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.cleanup?.()
    this.cleanup = undefined
  }

  override render(): typeof nothing {
    return nothing
  }

  private apply(): void {
    const head = this.keelPage.current.head
    this.cleanup?.()
    this.cleanup = applyHead({
      title: this.title || head?.title,
      description: this.description ?? head?.description,
      canonical: this.canonical ?? head?.canonical,
      image: this.image ?? head?.image,
      type: this.type ?? head?.type,
      html: this.html ?? head?.html,
    })
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "keel-head": Head
  }
}
