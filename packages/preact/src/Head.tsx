import { applyHead } from "@kolektiv/keel"
import type { ComponentChildren } from "preact"
import { createPortal } from "preact/compat"
import { useLayoutEffect } from "preact/hooks"
import { usePage } from "./page.js"

export interface HeadProps {
  title?: string
  description?: string
  canonical?: string
  image?: string
  type?: string
  /** Raw sanitized head markup, like `seed.head.html`. */
  html?: string
  /** Extra head nodes, the Preact equivalent of `<svelte:head>` children. */
  children?: ComponentChildren
}

/**
 * Applies document head from explicit props, falling back to the current
 * seed's `head`. Cleanup removes everything Keel created on re-render or
 * unmount. Children render into `document.head` through `preact/compat`'s
 * portal — Preact ships portals only in compat, so this is the one place the
 * adapter pulls in that runtime.
 */
export function Head({ title, description, canonical, image, type, html, children }: HeadProps) {
  const seed = usePage()
  const head = seed.head
  const resolved = {
    title: title ?? head?.title,
    description: description ?? head?.description,
    canonical: canonical ?? head?.canonical,
    image: image ?? head?.image,
    type: type ?? head?.type,
    html: html ?? head?.html,
  }

  useLayoutEffect(
    () => applyHead(resolved),
    [resolved.title, resolved.description, resolved.canonical, resolved.image, resolved.type, resolved.html],
  )

  if (children == null || typeof document === "undefined") return null
  return createPortal(children, document.head)
}
