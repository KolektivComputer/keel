import { Component, effect, input } from "@angular/core"
import { applyHead } from "@kolektiv/keel"
import { injectKeelPage } from "./page.js"

/**
 * Document head override for pack content, the Angular counterpart of
 * `<svelte:head>` and the other adapters' `Head` component. Signal inputs win
 * over the current seed's head; `createPage`'s root still owns the base
 * application, so this component is only needed when a page overrides fields.
 *
 * Applies on creation and after every input or seed change, and removes
 * everything Keel created on destroy.
 *
 * ```html
 * <keel-head title="Notes" />
 * ```
 */
@Component({
  selector: "keel-head",
  standalone: true,
  template: "",
})
export class KeelHead {
  /** Wins over the seed title; empty falls back to the seed. */
  readonly title = input<string>()
  readonly description = input<string>()
  readonly canonical = input<string>()
  readonly image = input<string>()
  readonly type = input<string>()
  /** Raw sanitized head markup, like `seed.head.html`. */
  readonly html = input<string>()

  constructor() {
    const page = injectKeelPage()
    effect((onCleanup) => {
      const head = page().head
      onCleanup(
        applyHead({
          title: this.title() || head?.title,
          description: this.description() ?? head?.description,
          canonical: this.canonical() ?? head?.canonical,
          image: this.image() ?? head?.image,
          type: this.type() ?? head?.type,
          html: this.html() ?? head?.html,
        }),
      )
    })
  }
}

export {
  applyHead,
  fromPageHead,
  KEEL_HEAD_ATTR,
  setTitle,
  syncHead,
  type HeadInput,
} from "@kolektiv/keel"
