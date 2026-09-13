import "./setup.ts"
import { createApp, nextTick, type App, type Component } from "vue"
import type { KeelSeed, PageContext } from "@kolektiv/keel"

export interface Mounted {
  host: HTMLDivElement
  app: App
  unmount(): Promise<void>
}

export async function render(component: Component, props: Record<string, unknown> = {}): Promise<Mounted> {
  const host = document.createElement("div")
  document.body.append(host)
  const app = createApp(component, props)
  app.mount(host)
  await nextTick()
  return {
    host,
    app,
    async unmount() {
      app.unmount()
      host.remove()
      await nextTick()
    },
  }
}

export function host(): HTMLDivElement {
  const element = document.createElement("div")
  document.body.append(element)
  return element
}

export async function dispatch(target: EventTarget, event: Event): Promise<void> {
  target.dispatchEvent(event)
  await nextTick()
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
