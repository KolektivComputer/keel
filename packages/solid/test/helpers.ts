import "./setup.ts"
import type { KeelSeed, PageContext } from "@kolektiv/keel"
import { createComponent, type Component } from "solid-js"
import { render as renderRoot } from "solid-js/web"

export interface Mounted {
  host: HTMLDivElement
  unmount(): void
}

export function render(component: Component<any>, props: Record<string, unknown> = {}): Mounted {
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = renderRoot(() => createComponent(component, props), host)
  return {
    host,
    unmount() {
      dispose()
      host.remove()
    },
  }
}

export function host(): HTMLDivElement {
  const element = document.createElement("div")
  document.body.append(element)
  return element
}

export function dispatch(target: EventTarget, event: Event): void {
  target.dispatchEvent(event)
}

export function mouseEvent(type: string, init: MouseEventInit = {}): MouseEvent {
  return new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })
}

export function pointerEvent(type: string, init: MouseEventInit = {}): PointerEvent {
  return new window.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })
}

export function seed<T = unknown>(path: string, data: T = {} as T, head?: KeelSeed["head"]): KeelSeed<T> {
  return {
    v: 1,
    page: "harbor.home",
    path,
    params: {},
    data,
    errors: {},
    theme: { id: "harbor", version: "1.0.0" },
    entry: "/packs/harbor/home.js",
    css: [],
    host: "#__keel_root",
    shared: {},
    head: head ?? null,
  }
}

export function context<T = unknown>(path: string, data: T = {} as T): PageContext<T> {
  return {
    page: "harbor.home",
    path,
    params: {},
    data,
    errors: {},
    theme: { id: "harbor", version: "1.0.0" },
    shared: {},
    navigate: async () => undefined,
  }
}
