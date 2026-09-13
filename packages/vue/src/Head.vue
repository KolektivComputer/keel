<script lang="ts">
export interface HeadProps {
  title?: string
  description?: string
  canonical?: string
  image?: string
  type?: string
  /** Raw sanitized head markup, like `seed.head.html`. */
  html?: string
}
</script>

<script setup lang="ts">
import { applyHead } from "@kolektiv/keel"
import { computed, onScopeDispose, watch } from "vue"
import { usePage } from "./page.js"

const props = defineProps<HeadProps>()

const seed = usePage()
const resolved = computed(() => ({
  title: props.title ?? seed.value.head?.title,
  description: props.description ?? seed.value.head?.description,
  canonical: props.canonical ?? seed.value.head?.canonical,
  image: props.image ?? seed.value.head?.image,
  type: props.type ?? seed.value.head?.type,
  html: props.html ?? seed.value.head?.html,
}))

let cleanup: (() => void) | undefined
watch(
  resolved,
  (head) => {
    cleanup?.()
    cleanup = applyHead(head)
  },
  { immediate: true },
)
onScopeDispose(() => {
  cleanup?.()
  cleanup = undefined
})
</script>

<template>
  <Teleport v-if="$slots.default" to="head">
    <slot />
  </Teleport>
</template>
