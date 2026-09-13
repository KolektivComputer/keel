import { applyHead, fromPageHead } from "@kolektiv/keel"
import { Show, createEffect, onCleanup, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import { usePage } from "./page.js"

export interface HeadProps {
  title?: string
  description?: string
  canonical?: string
  image?: string
  type?: string
  /** Raw sanitized head markup, like `seed.head.html`. */
  html?: string
  /** Extra head nodes, the Solid equivalent of `<svelte:head>` children. */
  children?: JSX.Element
}

/**
 * Applies document head from explicit props, falling back to the current
 * seed's `head`. Cleanup removes everything Keel created on re-render or
 * unmount. Children render into `document.head` through a portal.
 */
export function Head(props: HeadProps): JSX.Element {
  const seed = usePage()
  createEffect(() => {
    onCleanup(
      applyHead(
        fromPageHead(seed().head, {
          title: props.title,
          description: props.description,
          canonical: props.canonical,
          image: props.image,
          type: props.type,
          html: props.html,
        }),
      ),
    )
  })

  if (typeof document === "undefined") return null
  return (
    <Show when={props.children}>
      <Portal mount={document.head}>{props.children}</Portal>
    </Show>
  )
}
