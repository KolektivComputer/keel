import { router } from "./router.ts"
import { peekPage, subscribe as subscribeSeed } from "./store.ts"
import {
  KEEL_REALTIME_PATH,
  KEEL_REALTIME_VERSION,
  type KeelSeed,
} from "./types.ts"

/** Connection lifecycle the client reports to [realtime.onStatus] listeners. */
export type RealtimeStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed"

/** Envelope types both directions of the wire contract use. */
export type RealtimeEnvelopeType =
  | "ready"
  | "event"
  | "invalidate"
  | "error"
  | "ping"
  | "subscribe"
  | "unsubscribe"
  | "send"

/**
 * The boring JSON envelope Keel realtime speaks. Server-to-client envelopes
 * carry a `channel` and, for `event`, an `event` id and payload `data`.
 * `sid` names a stream so SSE clients can address it over HTTP `POST`.
 */
export interface KeelRealtimeEnvelope<T = unknown> {
  v: number
  type: RealtimeEnvelopeType
  sid?: string | null
  channel?: string | null
  channels?: string[] | null
  event?: string | null
  data?: T
  id?: string | null
  error?: string | null
}

/** Payload of an `invalidate` envelope: rehydrate the seed with a visit. */
export interface KeelRealtimeInvalidate {
  path?: string | null
  only?: string[] | null
  except?: string[] | null
}

/** One typed domain event delivered to [realtime.on] handlers. */
export interface RealtimeMessage<T = unknown> {
  event: string
  channel: string | null
  data: T
  id: string | null
}

export interface RealtimeOptions {
  /** Realtime endpoint. Defaults to [KEEL_REALTIME_PATH] on this origin. */
  url?: string
  /**
   * `auto` (default) tries WebSocket and falls back to SSE. `websocket` and
   * `sse` pin one transport.
   */
  transport?: "auto" | "websocket" | "sse"
  /**
   * Extra channels to hold. A seed-derived default of `page:<page id>` is
   * added unless [autoChannels] is `false`.
   */
  channels?: string[] | ((seed: KeelSeed | null) => string[])
  /** Auto-subscribe to `page:<page id>` as the seed changes. Default true. */
  autoChannels?: boolean
  /** Reconnect with backoff after a dropped transport. Default true. */
  reconnect?: boolean
  /** First reconnect delay in ms. Default 500. */
  minReconnectDelayMs?: number
  /** Reconnect delay ceiling in ms. Default 15000. */
  maxReconnectDelayMs?: number
  /**
   * Rehydrate the current page with `router.reload()` after a reconnect that
   * followed a live connection, so events missed while offline are covered by
   * a fresh seed. Default true.
   */
  resyncOnReconnect?: boolean
  /**
   * Reload the current page when an `invalidate` envelope arrives on a
   * subscribed channel and no `onInvalidate` handler is registered. Default
   * true.
   */
  reloadOnInvalidate?: boolean
  /** Called on every status change. */
  onStatus?: (status: RealtimeStatus) => void
}

type RealtimeEvent<T = unknown> = (data: T, message: RealtimeMessage<T>) => void
type InvalidateHandler = (invalidate: KeelRealtimeInvalidate) => void

const DEFAULTS = {
  url: KEEL_REALTIME_PATH,
  transport: "auto" as const,
  autoChannels: true,
  reconnect: true,
  minReconnectDelayMs: 500,
  maxReconnectDelayMs: 15_000,
  resyncOnReconnect: true,
  reloadOnInvalidate: true,
}

let options: RealtimeOptions = { ...DEFAULTS }
let status: RealtimeStatus = "idle"
let sid: string | null = null
let socket: WebSocket | null = null
let stream: AbortController | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
let connectedOnce = false
let stopped = true
let lastSeen = 0
let seedUnsubscribe: (() => void) | null = null

const manualChannels = new Set<string>()
const autoChannels = new Set<string>()
const serverChannels = new Set<string>()
const eventHandlers = new Map<string, Set<RealtimeEvent>>()
const invalidateHandlers = new Set<InvalidateHandler>()
const statusListeners = new Set<(status: RealtimeStatus) => void>()

function setStatus(next: RealtimeStatus): void {
  if (status === next) return
  status = next
  options.onStatus?.(next)
  for (const listener of statusListeners) listener(next)
}

function desiredChannels(): string[] {
  return [...new Set([...autoChannels, ...manualChannels])]
}

function applySeedChannels(seed: KeelSeed | null): void {
  const extra = typeof options.channels === "function"
    ? options.channels(seed)
    : options.channels ?? []
  const page = options.autoChannels === false || !seed ? [] : [`page:${seed.page}`]
  autoChannels.clear()
  for (const channel of [...page, ...extra]) autoChannels.add(channel)
  syncChannels()
}

function startSeedTracking(): void {
  if (seedUnsubscribe) return
  seedUnsubscribe = subscribeSeed((seed) => applySeedChannels(seed))
}

function endpoint(): string {
  return options.url ?? DEFAULTS.url
}

function absoluteEndpoint(): string {
  const url = endpoint()
  if (/^[a-z]+:\/\//i.test(url) || typeof location === "undefined") return url
  return new URL(url, location.href).toString()
}

function socketEndpoint(): string | null {
  if (typeof WebSocket === "undefined") return null
  const url = endpoint()
  if (!/^[a-z]+:\/\//i.test(url) && typeof location === "undefined") return null
  const resolved = new URL(url, typeof location === "undefined" ? undefined : location.href)
  resolved.protocol = resolved.protocol === "https:" ? "wss:" : "ws:"
  return resolved.toString()
}

function withChannels(url: string, channels: string[]): string {
  if (channels.length === 0) return url
  const resolved = new URL(url)
  resolved.searchParams.set("channels", channels.join(","))
  return resolved.toString()
}

function parseEnvelope(raw: string): KeelRealtimeEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as KeelRealtimeEnvelope
    return typeof parsed?.type === "string" ? parsed : null
  } catch {
    return null
  }
}

function encode(envelope: KeelRealtimeEnvelope): string {
  return JSON.stringify(envelope)
}

// --- transport -------------------------------------------------------

/** Opens the connection if it is not already connecting or open. */
function connect(): void {
  stopped = false
  startSeedTracking()
  if (socket || stream || reconnectTimer) return
  openTransport()
}

function openTransport(): void {
  const preferred = options.transport ?? "auto"
  setStatus(connectedOnce ? "reconnecting" : "connecting")
  if (preferred === "sse") {
    void openSse()
    return
  }
  openWebSocket(() => {
    if (preferred === "websocket") {
      scheduleReconnect()
    } else {
      void openSse()
    }
  })
}

function openWebSocket(onUnavailable: () => void): void {
  const url = socketEndpoint()
  if (!url) {
    onUnavailable()
    return
  }
  let ws: WebSocket
  try {
    ws = new WebSocket(withChannels(url, desiredChannels()))
  } catch {
    onUnavailable()
    return
  }
  let opened = false
  let settled = false
  const unavailable = () => {
    if (settled) return
    settled = true
    if (socket === ws) socket = null
    onUnavailable()
  }
  socket = ws
  ws.onopen = () => {
    if (stopped) {
      ws.close()
      return
    }
    opened = true
    settled = true
    socket = ws
  }
  ws.onmessage = (event) => {
    const envelope = parseEnvelope(String(event.data))
    if (envelope) handleEnvelope(envelope)
  }
  ws.onerror = () => {
    if (!opened) unavailable()
  }
  ws.onclose = () => {
    if (socket === ws) socket = null
    if (!opened) {
      unavailable()
      return
    }
    if (stopped) {
      setStatus("closed")
      return
    }
    scheduleReconnect()
  }
}

async function openSse(): Promise<void> {
  if (stream) return
  const controller = new AbortController()
  stream = controller
  try {
    const response = await fetch(withChannels(absoluteEndpoint(), desiredChannels()), {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      credentials: "same-origin",
      signal: controller.signal,
    })
    if (!response.ok || !response.body) {
      throw new Error(`Keel realtime SSE failed (${response.status})`)
    }
    await readEvents(response.body, (envelope) => handleEnvelope(envelope))
    if (stopped || controller.signal.aborted) return
    stream = null
    scheduleReconnect()
  } catch {
    if (stopped || controller.signal.aborted) return
    stream = null
    scheduleReconnect()
  }
}

async function readEvents(
  body: ReadableStream<Uint8Array>,
  onEnvelope: (envelope: KeelRealtimeEnvelope) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let data = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf("\n")
    while (newline >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, "")
      buffer = buffer.slice(newline + 1)
      if (line === "") {
        if (data) {
          const envelope = parseEnvelope(data)
          if (envelope) onEnvelope(envelope)
        }
        data = ""
      } else if (line.startsWith("data:")) {
        data += line.slice(5).trimStart()
      }
      newline = buffer.indexOf("\n")
    }
  }
}

function closeTransport(): void {
  const ws = socket
  socket = null
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    try {
      ws.close()
    } catch {
      // already closed
    }
  }
  const controller = stream
  stream = null
  controller?.abort()
  clearReconnectTimer()
  sid = null
  serverChannels.clear()
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect(): void {
  if (stopped || options.reconnect === false) {
    setStatus("closed")
    return
  }
  setStatus("reconnecting")
  const min = options.minReconnectDelayMs ?? DEFAULTS.minReconnectDelayMs
  const max = options.maxReconnectDelayMs ?? DEFAULTS.maxReconnectDelayMs
  const base = Math.min(max, min * 2 ** reconnectAttempt)
  const delay = Math.round(base * (0.5 + Math.random() * 0.5))
  reconnectAttempt += 1
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    openTransport()
  }, delay)
}

// --- envelopes -------------------------------------------------------

function handleEnvelope(envelope: KeelRealtimeEnvelope): void {
  lastSeen = Date.now()
  switch (envelope.type) {
    case "ready": {
      sid = envelope.sid ?? null
      serverChannels.clear()
      for (const channel of envelope.channels ?? []) serverChannels.add(channel)
      const reconnect = connectedOnce
      connectedOnce = true
      reconnectAttempt = 0
      setStatus("open")
      syncChannels()
      if (reconnect && options.resyncOnReconnect !== false) void router.reload({ preserveState: true })
      break
    }
    case "event": {
      const event = envelope.event
      if (!event) return
      const message: RealtimeMessage = {
        event,
        channel: envelope.channel ?? null,
        data: envelope.data,
        id: envelope.id ?? null,
      }
      for (const handler of eventHandlers.get(event) ?? []) {
        try {
          handler(message.data, message)
        } catch (error) {
          reportHandlerError(error)
        }
      }
      break
    }
    case "invalidate": {
      const invalidate = (envelope.data ?? {}) as KeelRealtimeInvalidate
      let handled = false
      for (const handler of invalidateHandlers) {
        handled = true
        try {
          handler(invalidate)
        } catch (error) {
          reportHandlerError(error)
        }
      }
      if (!handled && options.reloadOnInvalidate !== false) {
        const page = peekPage()
        const path = invalidate.path
        if (!path || !page || path === page.path || path.split("?")[0] === page.path.split("?")[0]) {
          void router.reload({
            preserveState: true,
            ...(invalidate.only?.length ? { only: invalidate.only } : {}),
            ...(invalidate.except?.length ? { except: invalidate.except } : {}),
          })
        }
      }
      break
    }
    case "error":
      // Server-reported rejections (unknown event, denied channel) are not
      // fatal; the connection stays up.
      break
    case "ping":
      break
    default:
      break
  }
}

function reportHandlerError(error: unknown): void {
  if (typeof console !== "undefined") console.error("Keel realtime handler failed", error)
}

function sendEnvelope(envelope: KeelRealtimeEnvelope): void {
  if (socket && socket.readyState === 1) {
    socket.send(encode(envelope))
    return
  }
  if (sid) {
    void postEnvelope({ ...envelope, sid }).catch(reportHandlerError)
  }
}

function postEnvelope(envelope: KeelRealtimeEnvelope): Promise<Response> {
  return fetch(absoluteEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: encode(envelope),
  })
}

function syncChannels(): void {
  const desired = desiredChannels()
  if (socket && socket.readyState === 1) {
    const added = desired.filter((channel) => !serverChannels.has(channel))
    const removed = [...serverChannels].filter((channel) => !desired.includes(channel))
    if (added.length > 0) sendEnvelope({ v: KEEL_REALTIME_VERSION, type: "subscribe", channels: added })
    if (removed.length > 0) sendEnvelope({ v: KEEL_REALTIME_VERSION, type: "unsubscribe", channels: removed })
    for (const channel of added) serverChannels.add(channel)
    for (const channel of removed) serverChannels.delete(channel)
    return
  }
  // SSE subscribes through POST once the stream reported its sid.
  if (sid) {
    const added = desired.filter((channel) => !serverChannels.has(channel))
    const removed = [...serverChannels].filter((channel) => !desired.includes(channel))
    if (added.length > 0) {
      void postEnvelope({ v: KEEL_REALTIME_VERSION, type: "subscribe", sid, channels: added })
      for (const channel of added) serverChannels.add(channel)
    }
    if (removed.length > 0) {
      void postEnvelope({ v: KEEL_REALTIME_VERSION, type: "unsubscribe", sid, channels: removed })
      for (const channel of removed) serverChannels.delete(channel)
    }
  }
}

// --- public surface --------------------------------------------------

function subscribe(channel: string): () => void {
  manualChannels.add(channel)
  connect()
  syncChannels()
  return () => {
    manualChannels.delete(channel)
    syncChannels()
  }
}

function on<T = unknown>(event: string, handler: RealtimeEvent<T>): () => void {
  let handlers = eventHandlers.get(event)
  if (!handlers) {
    handlers = new Set()
    eventHandlers.set(event, handlers)
  }
  handlers.add(handler as RealtimeEvent)
  connect()
  return () => {
    handlers.delete(handler as RealtimeEvent)
    if (handlers.size === 0) eventHandlers.delete(event)
  }
}

function onInvalidate(handler: InvalidateHandler): () => void {
  invalidateHandlers.add(handler)
  connect()
  return () => {
    invalidateHandlers.delete(handler)
  }
}

function onStatus(listener: (next: RealtimeStatus) => void): () => void {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

function send<I = unknown>(event: string, data?: I): Promise<void> {
  connect()
  if (socket && socket.readyState === 1) {
    socket.send(encode({ v: KEEL_REALTIME_VERSION, type: "send", event, data }))
    return Promise.resolve()
  }
  if (sid) {
    return postEnvelope({ v: KEEL_REALTIME_VERSION, type: "send", sid, event, data }).then(() => undefined)
  }
  return Promise.reject(new Error("Keel realtime: not connected"))
}

function disconnect(): void {
  stopped = true
  closeTransport()
  setStatus("closed")
}

/** Disconnect and drop handlers, subscriptions, and options (tests, SSR). */
function reset(): void {
  disconnect()
  manualChannels.clear()
  autoChannels.clear()
  eventHandlers.clear()
  invalidateHandlers.clear()
  statusListeners.clear()
  seedUnsubscribe?.()
  seedUnsubscribe = null
  reconnectAttempt = 0
  connectedOnce = false
  options = { ...DEFAULTS }
  status = "idle"
}

/**
 * Realtime client, sibling to visits and actions. Register handlers with
 * [on], hold channels with [subscribe], send client events with [send], and
 * let `invalidate` envelopes rehydrate the page. Connections resume with
 * backoff; on reconnect the client resubscribes and (by default) reloads the
 * current seed.
 */
export const realtime = {
  configure(next: RealtimeOptions): void {
    options = { ...options, ...next }
  },
  connect,
  disconnect,
  reset,
  subscribe,
  on,
  onInvalidate,
  onStatus,
  send,
  status: (): RealtimeStatus => status,
  sid: (): string | null => sid,
  lastSeen: (): number => lastSeen,
}
