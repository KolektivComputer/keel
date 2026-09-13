import "./setup.ts"
import type { KeelSeed, PageContext } from "@kolektiv/keel"
import { createElement, render as renderRoot, type ComponentChild } from "preact"
import { act as preactAct } from "preact/test-utils"

export interface Mounted {
  host: HTMLDivElement
  unmount(): Promise<void>
}

export async function render(vnode: ComponentChild): Promise<Mounted> {
  const host = document.createElement("div")
  document.body.append(host)
  try {
    await preactAct(() => {
      renderRoot(vnode, host)
    })
  } catch (error) {
    host.remove()
    throw error
  }
  return {
    host,
    async unmount() {
      await preactAct(() => {
        renderRoot(null, host)
      })
      host.remove()
    },
  }
}

export async function dispatch(target: EventTarget, event: Event): Promise<void> {
  await preactAct(() => {
    target.dispatchEvent(event)
  })
}

export function mouseEvent(type: string, init: MouseEventInit = {}): MouseEvent {
  return new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })
}

export function pointerEvent(type: string, init: MouseEventInit = {}): PointerEvent {
  return new window.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })
}

export function host(): HTMLDivElement {
  const element = document.createElement("div")
  document.body.append(element)
  return element
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

export { createElement, preactAct as act }
export type { ComponentChild }
