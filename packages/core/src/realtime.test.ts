import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { realtime } from "./realtime.ts"
import { router } from "./router.ts"
import { setPage } from "./store.ts"
import type { KeelRealtimeEnvelope, KeelSeed } from "./types.ts"

class FakeSocket {
  static instances: FakeSocket[] = []

  readonly url: string
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeSocket.instances.push(this)
  }

  open(): void {
    this.readyState = 1
    this.onopen?.()
  }

  receive(envelope: KeelRealtimeEnvelope): void {
    this.onmessage?.({ data: JSON.stringify(envelope) })
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    if (this.readyState === 3) return
    this.readyState = 3
    this.onclose?.()
  }

  sentEnvelopes(): KeelRealtimeEnvelope[] {
    return this.sent.map((raw) => JSON.parse(raw) as KeelRealtimeEnvelope)
  }
}

class FakeController {
  static current: FakeController | null = null

  private readonly controller: ReadableStreamDefaultController<Uint8Array>
  readonly response: Response

  constructor(initial: KeelRealtimeEnvelope[] = []) {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller
        for (const envelope of initial) this.push(envelope)
      },
    })
    this.response = new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    })
    FakeController.current = this
  }

  push(envelope: KeelRealtimeEnvelope): void {
    const payload = `data: ${JSON.stringify(envelope)}\n\n`
    this.controller.enqueue(new TextEncoder().encode(payload))
  }
}

const globals = globalThis as Record<string, unknown>
const original = {
  location: globals.location,
  WebSocket: globals.WebSocket,
  fetch: globals.fetch,
}
const originalReload = router.reload

let fetchCalls: Array<{ url: string; init?: RequestInit }> = []
let reloadCalls: Array<Record<string, unknown> | undefined> = []
let fetchResponder: (url: string, init?: RequestInit) => Promise<Response>

function seed(page = "harbor.home", path = "/"): KeelSeed {
  return {
    v: 1,
    page,
    path,
    params: {},
    data: {},
    errors: {},
    theme: { id: "harbor", version: "1" },
    entry: "data:text/javascript,export%20function%20mount()%20%7B%7D",
    css: [],
    host: "#__keel_root",
  }
}

function installGlobals(options: { socket?: boolean } = {}): void {
  globals.location = { href: "http://localhost/", protocol: "http:", host: "localhost" }
  if (options.socket === false) delete globals.WebSocket
  else globals.WebSocket = FakeSocket
  globals.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    fetchCalls.push({ url, init })
    return fetchResponder(url, init)
  }) as unknown as typeof fetch
}

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error("timed out waiting for condition"))
      setTimeout(tick, 5)
    }
    tick()
  })
}

function ready(channels: string[] = ["page:harbor.home"], sid = "rt-test"): KeelRealtimeEnvelope {
  return { v: 1, type: "ready", sid, channels }
}

beforeEach(() => {
  FakeSocket.instances = []
  FakeController.current = null
  fetchCalls = []
  reloadCalls = []
  fetchResponder = async () => new Response("{}", { status: 202 })
  ;(router as { reload: typeof router.reload }).reload = async (options) => {
    reloadCalls.push(options as Record<string, unknown> | undefined)
  }
  installGlobals()
  realtime.reset()
  realtime.configure({ minReconnectDelayMs: 1, maxReconnectDelayMs: 5 })
})

afterEach(() => {
  realtime.reset()
  ;(router as { reload: typeof router.reload }).reload = originalReload
  if (original.location === undefined) delete globals.location
  else globals.location = original.location
  if (original.WebSocket === undefined) delete globals.WebSocket
  else globals.WebSocket = original.WebSocket
  globals.fetch = original.fetch
})

test("connects over websocket and subscribes the page channel", async () => {
  setPage(seed())
  realtime.connect()
  const socket = FakeSocket.instances[0]
  assert.ok(socket, "websocket opened")
  assert.match(socket.url, /^ws:\/\/localhost\/__keel\/events\?channels=page%3Aharbor\.home$/)
  socket.open()
  assert.equal(realtime.status(), "connecting")

  socket.receive(ready())
  assert.equal(realtime.status(), "open")
  assert.equal(realtime.sid(), "rt-test")

  // A later seed change diffs the page channel.
  setPage(seed("harbor.user", "/u/1"))
  const envelopes = socket.sentEnvelopes()
  const subscribe = envelopes.filter((envelope) => envelope.type === "subscribe").at(-1)
  const unsubscribe = envelopes.filter((envelope) => envelope.type === "unsubscribe").at(-1)
  assert.deepEqual(subscribe?.channels, ["page:harbor.user"])
  assert.deepEqual(unsubscribe?.channels, ["page:harbor.home"])
})

test("subscribe and unsubscribe diff channels", async () => {
  setPage(seed())
  realtime.connect()
  const socket = FakeSocket.instances[0]
  socket.open()
  socket.receive(ready())

  const release = realtime.subscribe("user:42")
  assert.deepEqual(socket.sentEnvelopes().at(-1), {
    v: 1,
    type: "subscribe",
    channels: ["user:42"],
  })

  release()
  assert.deepEqual(socket.sentEnvelopes().at(-1), {
    v: 1,
    type: "unsubscribe",
    channels: ["user:42"],
  })
})

test("typed events reach handlers with channel and id", async () => {
  setPage(seed())
  const seen: Array<unknown> = []
  const release = realtime.on<{ text: string }>("harbor.message", (data, message) => {
    seen.push({ data, channel: message.channel, id: message.id })
  })
  const socket = FakeSocket.instances[0]
  socket.open()
  socket.receive(ready())

  socket.receive({
    v: 1,
    type: "event",
    channel: "page:harbor.home",
    event: "harbor.message",
    id: "c1",
    data: { text: "ahoy" },
  })
  assert.deepEqual(seen, [{ data: { text: "ahoy" }, channel: "page:harbor.home", id: "c1" }])

  release()
  socket.receive({ v: 1, type: "event", event: "harbor.message", data: { text: "ignored" } })
  assert.equal(seen.length, 1)
})

test("invalidate reloads the page unless a handler is registered", async () => {
  setPage(seed())
  realtime.connect()
  const socket = FakeSocket.instances[0]
  socket.open()
  socket.receive(ready())

  socket.receive({ v: 1, type: "invalidate", channel: "page:harbor.home", data: { path: "/" } })
  await waitFor(() => reloadCalls.length === 1)
  assert.deepEqual(reloadCalls[0], { preserveState: true })

  const seen: unknown[] = []
  realtime.onInvalidate((invalidate) => seen.push(invalidate))
  socket.receive({
    v: 1,
    type: "invalidate",
    channel: "page:harbor.home",
    data: { path: "/", only: ["feed"] },
  })
  await waitFor(() => seen.length === 1)
  assert.deepEqual(seen[0], { path: "/", only: ["feed"] })
  assert.equal(reloadCalls.length, 1)
})

test("sse fallback streams events and posts sends by sid", async () => {
  installGlobals({ socket: false })
  const stream = new FakeController([ready(["page:harbor.home"])])
  fetchResponder = async (url, init) => {
    if (init?.method === "POST") return new Response("{}", { status: 202 })
    return stream.response
  }
  realtime.configure({ transport: "sse" })
  setPage(seed())

  const received: unknown[] = []
  realtime.on("harbor.message", (data) => received.push(data))
  await waitFor(() => realtime.status() === "open")
  assert.equal(realtime.sid(), "rt-test")

  stream.push({
    v: 1,
    type: "event",
    channel: "page:harbor.home",
    event: "harbor.message",
    data: { text: "over sse" },
  })
  await waitFor(() => received.length === 1)
  assert.deepEqual(received[0], { text: "over sse" })

  await realtime.send("harbor.shout", { text: "hello" })
  const post = fetchCalls.find((call) => call.init?.method === "POST")
  assert.ok(post, "send posted to the host")
  const body = JSON.parse(String(post.init?.body)) as KeelRealtimeEnvelope
  assert.equal(body.type, "send")
  assert.equal(body.event, "harbor.shout")
  assert.equal(body.sid, "rt-test")

  realtime.subscribe("user:7")
  await waitFor(() => fetchCalls.filter((call) => call.init?.method === "POST").length === 2)
  const subscribe = JSON.parse(String(fetchCalls.at(-1)?.init?.body)) as KeelRealtimeEnvelope
  assert.equal(subscribe.type, "subscribe")
  assert.deepEqual(subscribe.channels, ["user:7"])
})

test("reconnects with backoff, resubscribes, and resyncs the seed", async () => {
  setPage(seed())
  realtime.connect()
  const first = FakeSocket.instances[0]
  first.open()
  first.receive(ready())

  first.close()
  assert.equal(realtime.status(), "reconnecting")
  await waitFor(() => FakeSocket.instances.length === 2)
  const second = FakeSocket.instances[1]
  assert.match(second.url, /channels=page%3Aharbor\.home/)
  second.open()
  second.receive(ready())
  assert.equal(realtime.status(), "open")
  await waitFor(() => reloadCalls.length === 1)
  assert.deepEqual(reloadCalls[0], { preserveState: true })
})

test("send before the stream is ready rejects", async () => {
  installGlobals({ socket: false })
  fetchResponder = async () => new Response("{}", { status: 202 })
  realtime.configure({ transport: "sse", reconnect: false })
  setPage(seed())
  realtime.connect()
  await assert.rejects(() => realtime.send("harbor.shout", {}))
})
