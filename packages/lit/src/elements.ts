import { Head } from "./HeadElement.js"
import { Link } from "./Link.js"

export const KEEL_LINK_TAG = "keel-link"
export const KEEL_HEAD_TAG = "keel-head"

/**
 * Registers the `<keel-link>` and `<keel-head>` elements. Idempotent and
 * called automatically when the package entry loads; import and call it
 * directly when a bundle needs explicit registration.
 */
export function defineKeelElements(registry?: CustomElementRegistry): void {
  const target = registry ?? (typeof customElements === "undefined" ? undefined : customElements)
  if (!target) return
  if (!target.get(KEEL_LINK_TAG)) target.define(KEEL_LINK_TAG, Link)
  if (!target.get(KEEL_HEAD_TAG)) target.define(KEEL_HEAD_TAG, Head)
}

if (typeof customElements !== "undefined") defineKeelElements()
