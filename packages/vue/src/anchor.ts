import { router, type Method, type PrefetchMode, type VisitOptions } from "@kolektiv/keel"
import { computed, watchEffect } from "vue"

export interface KeelAnchorParams extends VisitOptions {
  href?: string
  prefetch?: PrefetchMode
}

export interface KeelAnchorProps {
  href: string
  onClick: (event: MouseEvent) => void
  onPointerenter: () => void
  onPointerdown: () => void
}

function intercepted(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return true
}

/**
 * Vue replacement for Svelte's `keel` action: spreads visit interception and
 * prefetch behavior onto an existing anchor. `href` is a getter, so a
 * reactive `params` object keeps the rendered attribute in sync.
 *
 * ```vue
 * <script setup>
 * const anchor = useKeelAnchor({ href: "/about", prefetch: "hover" })
 * </script>
 * <template>
 *   <a v-bind="anchor">About</a>
 * </template>
 * ```
 */
export function useKeelAnchor(params: KeelAnchorParams = {}): KeelAnchorProps {
  const href = computed(() => params.href ?? "")

  watchEffect(() => {
    if (params.prefetch === "mount" && href.value) void router.prefetch(href.value)
  })

  return {
    get href() {
      return href.value
    },
    onClick(event) {
      if (!intercepted(event)) return
      const method: Method = params.method ?? "get"
      if (method === "get" && (event.currentTarget as HTMLAnchorElement).target === "_blank") return
      event.preventDefault()
      void router.visit(href.value, params)
    },
    onPointerenter() {
      if (params.prefetch === true || params.prefetch === "hover") void router.prefetch(href.value)
    },
    onPointerdown() {
      if (params.prefetch === "mousedown") void router.prefetch(href.value)
    },
  }
}
