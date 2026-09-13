import type { KeelSeed } from "./types.ts"

const STATE_KEY = "keel"
const INDEX_KEY = "keelIndex"

let currentIndex = 0

function stateIndex(state: unknown): number | null {
  if (!state || typeof state !== "object") return null
  const value = (state as Record<string, unknown>)[INDEX_KEY]
  return typeof value === "number" ? value : null
}

export function pushSeed(seed: KeelSeed, replace: boolean): void {
  if (typeof history === "undefined") return
  const url = seed.path
  if (replace) {
    const existing = stateIndex(history.state)
    if (existing !== null) currentIndex = existing
    history.replaceState({ [STATE_KEY]: seed, [INDEX_KEY]: currentIndex }, "", url)
  } else {
    currentIndex += 1
    history.pushState({ [STATE_KEY]: seed, [INDEX_KEY]: currentIndex }, "", url)
  }
}

export function seedFromHistory(event: PopStateEvent): KeelSeed | null {
  const state = event.state as { [STATE_KEY]?: KeelSeed } | null
  return state?.[STATE_KEY] ?? null
}

export function seedIndexFromHistory(event: PopStateEvent): number | null {
  return stateIndex(event.state)
}

/** Index of the entry the mounted page belongs to, as far as history went. */
export function currentSeedIndex(): number {
  return currentIndex
}

/**
 * History delta that returns the pointer from `target` to `current`. A null
 * target is a legacy entry without an index; assume back navigation.
 */
export function restoreSteps(current: number, target: number | null): number {
  if (target === null) return 1
  return current - target
}

export function replaceSeed(seed: KeelSeed): void {
  pushSeed(seed, true)
}
