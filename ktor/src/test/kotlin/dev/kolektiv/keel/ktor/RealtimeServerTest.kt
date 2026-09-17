package dev.kolektiv.keel.ktor

import dev.kolektiv.keel.KeelJson
import dev.kolektiv.keel.bundle.FrontendBundle
import dev.kolektiv.keel.event.EventDirection
import dev.kolektiv.keel.ktor.realtime.KeelRealtime
import dev.kolektiv.keel.ktor.realtime.KeelRealtimeKey
import dev.kolektiv.keel.realtime.KeelRealtimeEnvelope
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.sse.ClientSSESession
import io.ktor.client.plugins.sse.SSE as ClientSSE
import io.ktor.client.plugins.sse.sseSession
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.application.install
import io.ktor.server.engine.EmbeddedServer
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.netty.NettyApplicationEngine
import io.ktor.server.sse.SSE
import io.ktor.server.websocket.WebSockets
import io.ktor.sse.ServerSentEvent
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import kotlin.io.path.createDirectories
import kotlin.io.path.writeText

/**
 * SSE needs a real HTTP server: the test-host client buffers whole
 * responses, so an open stream never reaches it. Netty on an ephemeral port
 * plus the CIO client exercises the actual wire.
 */
class RealtimeServerTest {

    @Serializable
    data class Home(val greeting: String)

    @Serializable
    data class Tick(val at: Long)

    @Serializable
    data class Shout(val text: String)

    @TempDir
    lateinit var pack: Path

    private var server: EmbeddedServer<NettyApplicationEngine, NettyApplicationEngine.Configuration>? = null
    private var port: Int = 0
    private var hub: KeelRealtime? = null
    private val handled = mutableListOf<String>()

    private fun writePack() {
        val manifest = buildJsonObject {
            put("format", "keel/1")
            put("id", "harbor")
            put("version", "0.1.0")
            put("framework", "svelte")
            put("host", "#__keel_root")
            put(
                "pages",
                buildJsonObject {
                    put("home", buildJsonObject { put("module", "pages/home.js") })
                },
            )
        }
        pack.resolve("manifest.json").writeText(manifest.toString())
        pack.resolve("bootstrap.js").writeText("export {}")
        pack.resolve("pages").createDirectories()
        pack.resolve("pages/home.js").writeText("export async function mount() {}")
    }

    private fun start(sse: Boolean = true, webSockets: Boolean = true) {
        writePack()
        val launched = embeddedServer(Netty, port = 0, host = "127.0.0.1") {
            if (sse) install(SSE)
            if (webSockets) install(WebSockets)
            keel {
                bundle = FrontendBundle.fromDirectory(pack)
                pages {
                    page<Home>("home", "/") { Home("hello") }
                }
                realtime {
                    heartbeatSeconds = 1
                    event<Tick>("demo.tick", EventDirection.OUT)
                    on<Shout>("demo.shout") { input -> handled.add(input.text) }
                }
            }
            hub = attributes.getOrNull(KeelRealtimeKey)
        }
        launched.start(wait = false)
        server = launched
        port = runBlocking { launched.engine.resolvedConnectors().first().port }
    }

    private fun stop() {
        server?.stop(100, 500)
        server = null
    }

    private fun base(): String = "http://127.0.0.1:$port"

    private fun client(): HttpClient = HttpClient(CIO) { install(ClientSSE) }

    private suspend fun decode(event: ServerSentEvent): KeelRealtimeEnvelope =
        KeelJson.codec.decodeFromString(KeelRealtimeEnvelope.serializer(), event.data!!)

    @Test
    fun `sse stream receives typed events and invalidations over the wire`() = runBlocking {
        start()
        val client = client()
        try {
            val events = Channel<ServerSentEvent>(Channel.UNLIMITED)
            val session = client.sseSession("${base()}/__keel/events?channels=demo")
            val reader = launch { session.incoming.collect { events.send(it) } }
            try {
                val ready = nextEnvelope(events)
                assertEquals(KeelRealtimeEnvelope.READY, ready.type)
                assertEquals(listOf("demo"), ready.channels)
                assertTrue(ready.sid!!.startsWith("rt-"))

                hub!!.publish("demo", "demo.tick", Tick(9L))
                val event = nextEnvelope(events)
                assertEquals("demo.tick", event.event)
                assertEquals("9", event.data!!.jsonObject.getValue("at").jsonPrimitive.content)

                hub!!.invalidate("demo", path = "/")
                val invalid = nextEnvelope(events)
                assertEquals(KeelRealtimeEnvelope.INVALIDATE, invalid.type)
                assertEquals("/", invalid.data!!.jsonObject.getValue("path").jsonPrimitive.content)

                assertEquals(1, hub!!.connectionCount())
            } finally {
                reader.cancel()
                session.cancel()
            }
        } finally {
            awaitConnections(0)
            client.close()
            stop()
        }
    }

    @Test
    fun `sse client subscribes and sends by sid over http`() = runBlocking {
        start()
        val client = client()
        try {
            val events = Channel<ServerSentEvent>(Channel.UNLIMITED)
            val session = client.sseSession("${base()}/__keel/events")
            val reader = launch { session.incoming.collect { events.send(it) } }
            try {
                val ready = nextEnvelope(events)

                val subscribed = client.post("${base()}/__keel/events") {
                    contentType(ContentType.Application.Json)
                    setBody(
                        encode(KeelRealtimeEnvelope.subscribe(listOf("demo"), sid = ready.sid)),
                    )
                }
                assertEquals(HttpStatusCode.Accepted, subscribed.status)
                val ack = nextEnvelope(events)
                assertEquals(listOf("demo"), ack.channels)

                val sent = client.post("${base()}/__keel/events") {
                    contentType(ContentType.Application.Json)
                    setBody(
                        encode(
                            KeelRealtimeEnvelope.send(
                                "demo.shout",
                                buildJsonObject { put("text", "over sse") },
                            ),
                        ),
                    )
                }
                assertEquals(HttpStatusCode.Accepted, sent.status)
                assertEquals(listOf("over sse"), handled)

                val unsubscribed = client.post("${base()}/__keel/events") {
                    contentType(ContentType.Application.Json)
                    setBody(
                        encode(KeelRealtimeEnvelope.unsubscribe(listOf("demo"), sid = ready.sid)),
                    )
                }
                assertEquals(HttpStatusCode.Accepted, unsubscribed.status)
                assertEquals(0, hub!!.connectionCount("demo"))
            } finally {
                reader.cancel()
                session.cancel()
            }
        } finally {
            client.close()
            stop()
        }
    }

    @Test
    fun `reconnect gets a fresh stream and resubscribes`() = runBlocking {
        start()
        val client = client()
        try {
            val firstEvents = Channel<ServerSentEvent>(Channel.UNLIMITED)
            val firstSession = client.sseSession("${base()}/__keel/events?channels=demo")
            val firstReader = launch { firstSession.incoming.collect { firstEvents.send(it) } }
            val firstReady = nextEnvelope(firstEvents)
            hub!!.publish("demo", "demo.tick", Tick(1L))
            assertEquals("demo.tick", nextEnvelope(firstEvents).event)
            firstReader.cancel()
            firstSession.cancel()
            awaitConnections(0)

            val secondEvents = Channel<ServerSentEvent>(Channel.UNLIMITED)
            val secondSession = client.sseSession("${base()}/__keel/events?channels=demo")
            val secondReader = launch { secondSession.incoming.collect { secondEvents.send(it) } }
            try {
                val secondReady = nextEnvelope(secondEvents)
                assertEquals(KeelRealtimeEnvelope.READY, secondReady.type)
                assertTrue(secondReady.sid != firstReady.sid, "reconnect must not reuse the stream id")
                assertEquals(listOf("demo"), secondReady.channels)
                hub!!.publish("demo", "demo.tick", Tick(2L))
                assertEquals("2", nextEnvelope(secondEvents).data!!.jsonObject.getValue("at").jsonPrimitive.content)
            } finally {
                secondReader.cancel()
                secondSession.cancel()
            }
        } finally {
            client.close()
            stop()
        }
    }

    @Test
    fun `sse only host serves the stream`() = runBlocking {
        start(webSockets = false)
        val client = client()
        try {
            val events = Channel<ServerSentEvent>(Channel.UNLIMITED)
            val session = client.sseSession("${base()}/__keel/events?channels=demo")
            val reader = launch { session.incoming.collect { events.send(it) } }
            try {
                val ready = nextEnvelope(events)
                assertEquals(KeelRealtimeEnvelope.READY, ready.type)
                assertEquals(listOf("demo"), ready.channels)
            } finally {
                reader.cancel()
                session.cancel()
            }
        } finally {
            client.close()
            stop()
        }
    }

    private suspend fun nextEnvelope(events: Channel<ServerSentEvent>): KeelRealtimeEnvelope {
        while (true) {
            val envelope = decode(withTimeout(5000) { events.receive() })
            if (envelope.type != KeelRealtimeEnvelope.PING) return envelope
        }
    }

    private suspend fun awaitConnections(expected: Int) {
        withTimeout(10_000) {
            while (hub!!.connectionCount() != expected) kotlinx.coroutines.delay(20)
        }
    }

    private fun encode(envelope: KeelRealtimeEnvelope): String =
        KeelJson.codec.encodeToString(KeelRealtimeEnvelope.serializer(), envelope)
}
