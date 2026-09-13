<script lang="ts">
  import type { Component } from "svelte"
  import type { Writable } from "svelte/store"
  import type { PageContext } from "@kolektiv/keel"
  import Wrap from "./Wrap.svelte"
  import { applyHead, fromPageHead } from "./head.js"
  import { page } from "./page.js"

  let {
    layouts,
    Page,
    head = true,
    ctx,
  }: {
    layouts: Component[]
    Page: Component
    head?: boolean
    ctx?: Writable<PageContext | undefined>
  } = $props()
  const Layout = $derived(layouts[0])
  const rest = $derived(layouts.slice(1))
  const seed = page()
  const context = $derived(ctx ? $ctx : undefined)

  $effect(() => {
    if (!head) return
    if (!seed.head) return
    return applyHead(fromPageHead(seed.head))
  })
</script>

{#if Layout}
  <Layout ctx={context}>
    <Wrap layouts={rest} {Page} head={false} {ctx} />
  </Layout>
{:else}
  <Page ctx={context} />
{/if}
