import type { GuardResult, NavigationGuard, NavigationTarget } from "./types.ts"

export interface GuardOutcome {
  cancelled: boolean
  redirect: string | null
  error?: unknown
}

const guards: NavigationGuard[] = []

/**
 * Registers a navigation guard. Guards run serially in registration order and
 * return an idempotent unsubscribe.
 */
export function beforeEach(guard: NavigationGuard): () => void {
  guards.push(guard)
  let active = true
  return () => {
    if (!active) return
    active = false
    const index = guards.indexOf(guard)
    if (index >= 0) guards.splice(index, 1)
  }
}

/**
 * Runs the registered guards for one navigation target. `force` skips the
 * registry entirely. A thrown guard cancels and surfaces its error.
 */
export async function runGuards(
  to: NavigationTarget,
  from: NavigationTarget,
  options: { force?: boolean } = {},
): Promise<GuardOutcome> {
  if (options.force) return { cancelled: false, redirect: null }
  for (const guard of [...guards]) {
    let result: GuardResult
    try {
      result = await guard(to, from)
    } catch (error) {
      return { cancelled: true, redirect: null, error }
    }
    if (result === false) return { cancelled: true, redirect: null }
    if (typeof result === "string") return { cancelled: false, redirect: result }
    if (result && typeof result === "object" && typeof result.redirect === "string") {
      return { cancelled: false, redirect: result.redirect }
    }
  }
  return { cancelled: false, redirect: null }
}

/** Test helper: forget every registered guard. */
export function clearGuards(): void {
  guards.length = 0
}
