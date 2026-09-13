import { router, type Method, type PrefetchMode, type VisitOptions } from "@kolektiv/keel"
import {
  useEffect,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react"

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick" | "onError" | "target">,
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
  onClick?: (event: ReactMouseEvent<HTMLAnchorElement>) => void
  children?: ReactNode
}

function intercepted(event: ReactMouseEvent<HTMLElement>): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return true
}

/**
 * SPA navigation link. GET renders an `<a href>`; other methods render a
 * `<button type="button">`. Clicking calls `router.visit` unless the click is
 * modified, non-left, or a GET into `target="_blank"`.
 */
export function Link({
  href,
  method = "get",
  data,
  replace = false,
  preserveScroll = false,
  preserveState = false,
  prefetch = false,
  only,
  except,
  headers,
  force = false,
  onBefore,
  onSuccess,
  onError,
  onClick,
  target,
  type,
  children,
  ...rest
}: LinkProps) {
  useEffect(() => {
    if (prefetch === "mount") void router.prefetch(href)
  }, [prefetch, href])

  function visit(event: ReactMouseEvent<HTMLElement>) {
    if (!intercepted(event)) return
    if (method === "get" && (event.currentTarget as HTMLAnchorElement).target === "_blank") return
    event.preventDefault()
    void router.visit(href, {
      method,
      data,
      replace,
      preserveScroll,
      preserveState,
      only,
      except,
      headers,
      force,
      onBefore,
      onSuccess,
      onError,
    })
  }

  function handleClick(event: ReactMouseEvent<HTMLElement>) {
    onClick?.(event as ReactMouseEvent<HTMLAnchorElement>)
    visit(event)
  }

  function onPointerEnter() {
    if (prefetch === true || prefetch === "hover") void router.prefetch(href)
  }

  function onPointerDown() {
    if (prefetch === "mousedown") void router.prefetch(href)
  }

  if (method === "get") {
    return (
      <a
        href={href}
        target={target}
        type={type}
        onClick={handleClick}
        onPointerEnter={onPointerEnter}
        onPointerDown={onPointerDown}
        {...rest}
      >
        {children}
      </a>
    )
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  )
}
