<script lang="ts">
import type { Method, PrefetchMode, VisitOptions } from "@kolektiv/keel"

export interface LinkProps {
  href: string
  method?: Method
  data?: VisitOptions["data"]
  replace?: boolean
  preserveScroll?: VisitOptions["preserveScroll"]
  preserveState?: boolean
  prefetch?: PrefetchMode
  only?: string[]
  except?: string[]
  headers?: Record<string, string>
  force?: boolean
  onBefore?: VisitOptions["onBefore"]
  onSuccess?: VisitOptions["onSuccess"]
  onError?: VisitOptions["onError"]
  target?: string
  onClick?: (event: MouseEvent) => void
}
</script>

<script setup lang="ts">
import { router } from "@kolektiv/keel"
import { watchEffect } from "vue"

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<LinkProps>(), { method: "get" })

function intercepted(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return true
}

function handleClick(event: MouseEvent) {
  props.onClick?.(event)
  if (!intercepted(event)) return
  if (props.method === "get" && (event.currentTarget as HTMLAnchorElement).target === "_blank") return
  event.preventDefault()
  void router.visit(props.href, {
    method: props.method,
    data: props.data,
    replace: props.replace ?? false,
    preserveScroll: props.preserveScroll ?? false,
    preserveState: props.preserveState ?? false,
    only: props.only,
    except: props.except,
    headers: props.headers,
    force: props.force ?? false,
    onBefore: props.onBefore,
    onSuccess: props.onSuccess,
    onError: props.onError,
  })
}

function handlePointerEnter() {
  if (props.prefetch === true || props.prefetch === "hover") void router.prefetch(props.href)
}

function handlePointerDown() {
  if (props.prefetch === "mousedown") void router.prefetch(props.href)
}

watchEffect(() => {
  if (props.prefetch === "mount") void router.prefetch(props.href)
})
</script>

<template>
  <a
    v-if="method === 'get'"
    :href="href"
    :target="target"
    v-bind="$attrs"
    @click="handleClick"
    @pointerenter="handlePointerEnter"
    @pointerdown="handlePointerDown"
  >
    <slot />
  </a>
  <button v-else type="button" v-bind="$attrs" @click="handleClick">
    <slot />
  </button>
</template>
