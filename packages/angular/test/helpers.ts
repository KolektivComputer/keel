import "./setup.ts"
import { Component } from "@angular/core"
import type { KeelSeed, PageContext } from "@kolektiv/keel"

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

/**
 * Test-only component factory using the `Component()` decorator function
 * instead of decorator syntax, because `node --experimental-strip-types`
 * cannot strip TypeScript decorators. Components compile through JIT.
 */
export function jit(options: Record<string, unknown>) {
  return Component({ standalone: true, ...options } as never)
}

export function mouseEvent(type: string, init: MouseEventInit = {}): MouseEvent {
  return new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })
}

export function pointerEvent(type: string, init: MouseEventInit = {}): MouseEvent {
  return new window.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })
}

/** Flushes query-core's `setTimeout(0)` notification batcher. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
