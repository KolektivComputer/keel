import { useEffect, useRef, useState } from "preact/hooks"

/**
 * `preact/hooks` does not export `useSyncExternalStore` (it only exists in
 * `preact/compat`), so core-store reads subscribe with `useState` +
 * `useEffect` instead of pulling in the compat runtime for a hook.
 *
 * The listener compares the store's next value against the previously
 * rendered one with `Object.is` and only sets state when the identity
 * changes. Core stores return stable objects and primitive counts, so a
 * no-op notification never re-renders and a repeated snapshot never loops.
 * `subscribe` emits the current value immediately on subscribe, which closes
 * the window between the first render and the effect running.
 *
 * `useEffect` (not `useLayoutEffect`) matches the compat hook's timing and the
 * other adapters' commit contract: `createPage` renders synchronously, then
 * effects flush.
 *
 * @internal
 */
export function useCoreStore<T>(
  subscribe: (onChange: () => void) => () => void,
  getSnapshot: () => T,
): T {
  const [snapshot, setSnapshot] = useState<T>(getSnapshot)
  const latest = useRef(getSnapshot)
  latest.current = getSnapshot

  useEffect(() => {
    function update(): void {
      setSnapshot((previous) => {
        const next = latest.current()
        return Object.is(previous, next) ? previous : next
      })
    }
    update()
    return subscribe(update)
  }, [subscribe])

  return snapshot
}
