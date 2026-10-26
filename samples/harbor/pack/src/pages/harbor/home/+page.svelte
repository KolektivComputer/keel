<script lang="ts">
  import { ActionError, Link, page, realtime, useAction, useKeelEvent } from "@kolektiv/keel-svelte"
  import type {
    FeedItem,
    HarborEvents,
    HomePage,
    PostMessageIn,
    PostMessageOut,
    SetNameIn,
    SetNameOut,
  } from "../../../lib/page-types"

  const ctx = page<HomePage>()
  const setName = useAction<SetNameIn, SetNameOut>("harbor.setName")
  const postMessage = useAction<PostMessageIn, PostMessageOut>("harbor.postMessage")

  let displayName = $state(ctx.data.viewer?.displayName ?? "")
  let body = $state("")
  let liveFeed = $state<FeedItem[]>([])
  let typingBy = $state<string | null>(null)

  let typingTimer: ReturnType<typeof setTimeout> | undefined
  let lastTypingSent = 0

  // Typed push: new posts arrive without a visit.
  useKeelEvent<HarborEvents["harbor.message"]>("harbor.message", (item) => {
    if (!liveFeed.some((existing) => existing.id === item.id)) {
      liveFeed = [item, ...liveFeed]
    }
  })

  // Client-to-host send: "is typing" notices from everyone on the channel.
  useKeelEvent<HarborEvents["harbor.typing"]>("harbor.typing", (notice) => {
    typingBy = notice.displayName
    clearTimeout(typingTimer)
    typingTimer = setTimeout(() => {
      typingBy = null
    }, 4000)
  })

  const feed = $derived.by(() => {
    const seen = new Set<string>()
    return [...liveFeed, ...ctx.data.feed].filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  })

  $effect(() => {
    const name = ctx.data.viewer?.displayName
    if (name) displayName = name
  })

  $effect(() => () => clearTimeout(typingTimer))

  function fieldError(error: unknown, field: string): string | undefined {
    if (error instanceof ActionError) return error.errors[field]?.join(" ")
    return undefined
  }

  function onSetName(event: SubmitEvent) {
    event.preventDefault()
    void setName.mutateAsync({ displayName }).catch(() => undefined)
  }

  function onPost(event: SubmitEvent) {
    event.preventDefault()
    void postMessage
      .mutateAsync({ body })
      .then(() => {
        body = ""
      })
      .catch(() => undefined)
  }

  function onTyping() {
    const viewer = ctx.data.viewer
    if (!viewer) return
    const now = Date.now()
    if (now - lastTypingSent < 1500) return
    lastTypingSent = now
    void realtime.send("harbor.typing", { displayName: viewer.displayName }).catch(() => undefined)
  }
</script>

<h1>Harbor</h1>
<p class="lede">A message board. The seed is the read model. Actions write; visits rehydrate. Posts stream in live.</p>

<form class="stack" onsubmit={onSetName}>
  <div class="field">
    <label for="displayName">Display name</label>
    <input id="displayName" name="displayName" bind:value={displayName} autocomplete="nickname" maxlength="40" />
    {#if fieldError(setName.error, "displayName")}
      <p class="error">{fieldError(setName.error, "displayName")}</p>
    {/if}
  </div>
  <button type="submit" disabled={setName.isPending}>
    {setName.isPending ? "Saving…" : ctx.data.viewer ? "Update name" : "Set name"}
  </button>
</form>

{#if ctx.data.viewer}
  <p class="meta">Posting as {ctx.data.viewer.displayName}</p>
  <form class="stack" onsubmit={onPost}>
    <div class="field">
      <label for="body">Message</label>
      <textarea id="body" name="body" bind:value={body} oninput={onTyping} rows="4" maxlength="2000"></textarea>
      {#if fieldError(postMessage.error, "body")}
        <p class="error">{fieldError(postMessage.error, "body")}</p>
      {/if}
    </div>
    <button type="submit" disabled={postMessage.isPending}>
      {postMessage.isPending ? "Posting…" : "Post"}
    </button>
  </form>
  {#if typingBy}
    <p class="meta">{typingBy} is typing…</p>
  {/if}
{/if}

<h2>Recent</h2>
{#if feed.length === 0}
  <p class="lede">No messages yet. Set a display name and write the first one.</p>
{:else}
  <ol class="feed">
    {#each feed as item (item.id)}
      <li>
        <Link href={`/u/${item.userId}`} prefetch="hover">{item.displayName}</Link>
        <p class="excerpt">{item.body}</p>
        <p class="meta">{item.at}</p>
      </li>
    {/each}
  </ol>
{/if}
