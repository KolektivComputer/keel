import "./setup.ts"
import { act, createElement, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { KeelSeed, PageContext } from "@kolektiv/keel"

export interface Mounted {
  host: HTMLDivElement
  root: Root
  unmount(): Promise<void>
}

export async function render(element: ReactElement): Promise<Mounted> {
  const host = document.createElement("div")
  document.body.append(host)
  let root: Root
  await act(async () => {
    root = createRoot(host)
    root.render(element)
  })
  return {
    host,
    root: root!,
    async unmount() {
      await act(async () => {
        root.unmount()
      })
      host.remove()
    },
  }
}

export async function dispatch(target: EventTarget, event: Event): Promise<void> {
  await act(async () => {
    target.dispatchEvent(event)
  })
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

export type { ReactElement }
export { act, createElement }
