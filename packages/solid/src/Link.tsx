import { router, type Method, type PrefetchMode, type VisitOptions } from "@kolektiv/keel"
import { createEffect, splitProps, type JSX } from "solid-js"

export interface LinkProps
  extends Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick" | "onError" | "target">,
    Pick<
      VisitOptions,
      | "method"
      | "data"
      | "replace"
      | "preserveScroll"
      | "preserveState"
      | "only"
      | "except"
      | "headers"
      | "force"
      | "onBefore"
      | "onSuccess"
      | "onError"
    > {
  href: string
  prefetch?: PrefetchMode
  target?: string
  onClick?: (event: MouseEvent) => void
  children?: JSX.Element
}

/**
 * SPA navigation link. GET renders an `<a href>`; other methods render a
 * `<button type="button">`. Clicking calls `router.visit` unless the click is
 * modified, non-left, or a GET into `target="_blank"`.
 *
 * Handlers use `on:` so the native event carries the element as
 * `currentTarget` (Solid delegates plain `onClick` to `document`).
 */
export function Link(props: LinkProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "href",
    "method",
    "data",
    "replace",
    "preserveScroll",
    "preserveState",
    "prefetch",
    "only",
    "except",
    "headers",
    "force",
    "onBefore",
    "onSuccess",
    "onError",
    "onClick",
    "target",
    "children",
  ])
  const method = () => local.method ?? "get"

  createEffect(() => {
    if (local.prefetch === "mount") void router.prefetch(local.href)
  })

  function visit(event: MouseEvent & { currentTarget: Element }): void {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (method() === "get" && local.target === "_blank") return
    event.preventDefault()
    void router.visit(local.href, {
      method: method(),
      data: local.data,
      replace: local.replace ?? false,
      preserveScroll: local.preserveScroll ?? false,
      preserveState: local.preserveState ?? false,
      only: local.only,
      except: local.except,
      headers: local.headers,
      force: local.force ?? false,
      onBefore: local.onBefore,
      onSuccess: local.onSuccess,
      onError: local.onError,
    })
  }

  function handleClick(event: MouseEvent & { currentTarget: HTMLAnchorElement | HTMLButtonElement }): void {
    local.onClick?.(event)
    visit(event)
  }

  function onPointerEnter(): void {
    if (local.prefetch === true || local.prefetch === "hover") void router.prefetch(local.href)
  }

  function onPointerDown(): void {
    if (local.prefetch === "mousedown") void router.prefetch(local.href)
  }

  if (method() !== "get") {
    return (
      <button
        type="button"
        on:click={handleClick}
        {...(rest as JSX.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {local.children}
      </button>
    )
  }
  return (
    <a
      href={local.href}
      target={local.target}
      on:click={handleClick}
      on:pointerenter={onPointerEnter}
      on:pointerdown={onPointerDown}
      {...rest}
    >
      {local.children}
    </a>
  )
}
