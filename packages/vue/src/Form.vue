<script lang="ts">
import type { Method, VisitOptions } from "@kolektiv/keel"

export interface FormProps {
  action: string
  method?: Method
  resetOnSuccess?: boolean
  replace?: boolean
  preserveScroll?: VisitOptions["preserveScroll"]
  preserveState?: boolean
  headers?: Record<string, string>
  force?: boolean
  onBefore?: VisitOptions["onBefore"]
  onSuccess?: VisitOptions["onSuccess"]
  onError?: VisitOptions["onError"]
  onSubmit?: (event: SubmitEvent) => void
}
</script>

<script setup lang="ts">
import { router } from "@kolektiv/keel"

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<FormProps>(), {
  method: "post",
  resetOnSuccess: false,
  replace: false,
  preserveScroll: false,
  preserveState: true,
  force: false,
})

function handleSubmit(event: SubmitEvent) {
  props.onSubmit?.(event)
  if (event.defaultPrevented) return
  event.preventDefault()
  const form = event.currentTarget as HTMLFormElement
  void router.visit(props.action, {
    method: props.method,
    data: new FormData(form),
    preserveScroll: props.preserveScroll,
    preserveState: props.preserveState,
    replace: props.replace,
    headers: props.headers,
    force: props.force,
    onBefore: props.onBefore,
    onError: props.onError,
    onSuccess(page) {
      if (props.resetOnSuccess) form.reset()
      props.onSuccess?.(page)
    },
  })
}
</script>

<template>
  <form :action="action" :method="method" v-bind="$attrs" @submit="handleSubmit">
    <slot />
  </form>
</template>
