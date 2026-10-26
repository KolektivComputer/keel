package dev.kolektiv.keel.ktor

import dev.kolektiv.keel.KeelJson
import dev.kolektiv.keel.bundle.FrontendBundle
import dev.kolektiv.keel.event.EventDirection
import dev.kolektiv.keel.ktor.realtime.KeelRealtime
import dev.kolektiv.keel.ktor.realtime.KeelRealtimeKey
import dev.kolektiv.keel.ktor.realtime.KeelRealtimeMissingPluginException
import dev.kolektiv.keel.ktor.realtime.RealtimeDsl
import dev.kolektiv.keel.ktor.realtime.keelRealtime
import dev.kolektiv.keel.realtime.KeelRealtimeEnvelope
import io.ktor.client.plugins.websocket.DefaultClientWebSocketSession
import io.ktor.client.plugins.websocket.WebSockets as ClientWebSockets
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.prepareGet
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.sse.SSE
import io.ktor.server.testing.testApplication
import io.ktor.server.websocket.WebSockets
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import kotlin.io.path.createDirectories
import kotlin.io.path.writeText

class RealtimeTest {

    @Serializable
    data class Home(val greeting: String)

    @Serializable
    data class Tick(val at: Long)

    @Serializable
    data class Shout(val text: String)

    @TempDir
    lateinit var pack: Path

    private val handled = mutableListOf<String>()
    private var hub: KeelRealtime? = null
    private var published: Int = 0

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

    private fun Application.installSample(configure: RealtimeDsl.() -> Unit = {}) {
        writePack()
        keel {
            bundle = FrontendBundle.fromDirectory(pack)
            pages {
                page<Home>("home", "/") { Home("hello") }
            }
            realtime {
                heartbeatSeconds = 0
                event<Tick>("demo.tick", EventDirection.OUT)
                on<Shout>("demo.shout") { input -> handled.add(input.text) }
                configure()
            }
        }
        hub = attributes.getOrNull(KeelRealtimeKey)
    }

    private fun Application.installTransports() {
        install(SSE)
        install(WebSockets)
    }

    @Test
    fun `websocket subscribe publish and send`() = testApplication {
        application {
            installTransports()
            installSample()
        }
        val client = createClient { install(ClientWebSockets) }
        client.webSocket("/__keel/events?channels=demo") {
            val ready = nextEnvelope()
            assertEquals(KeelRealtimeEnvelope.READY, ready.type)
            assertEquals(listOf("demo"), ready.channels)
            assertNotNull(ready.sid)

            hub!!.publish("demo", "demo.tick", Tick(7L))
            val event = nextEnvelope()
            assertEquals(KeelRealtimeEnvelope.EVENT, event.type)
            assertEquals("demo.tick", event.event)
            assertEquals("7", event.data!!.jsonObject.getValue("at").jsonPrimitive.content)

            send(
                Frame.Text(
                    encode(KeelRealtimeEnvelope.send("demo.shout", buildJsonObject { put("text", "ahoy") })),
                ),
            )
            withTimeout(5000) {
                while (handled.isEmpty()) delay(10)
            }
            assertEquals(listOf("ahoy"), handled)
        }
    }

    @Test
    fun `websocket client can subscribe and unsubscribe`() = testApplication {
        application {
            installTransports()
            installSample()
        }
        val client = createClient { install(ClientWebSockets) }
        client.webSocket("/__keel/events") {
            assertEquals(KeelRealtimeEnvelope.READY, nextEnvelope().type)
            send(Frame.Text(encode(KeelRealtimeEnvelope.subscribe(listOf("demo")))))
            var envelope = nextEnvelope()
            assertEquals(KeelRealtimeEnvelope.READY, envelope.type)
            assertEquals(listOf("demo"), envelope.channels)

            hub!!.publish("demo", "demo.tick", Tick(1L))
            assertEquals("demo.tick", nextEnvelope().event)

            send(Frame.Text(encode(KeelRealtimeEnvelope.unsubscribe(listOf("demo")))))
            assertEquals(emptyList<String>(), nextEnvelope().channels)
            assertEquals(0, hub!!.connectionCount("demo"))
        }
        withTimeout(5000) {
            while (hub!!.connectionCount() != 0) delay(10)
        }
    }

    @Test
    fun `post rejects unknown stream malformed envelope and unknown events`() = testApplication {
        application {
            installTransports()
            installSample()
        }
        val unknownSid = client.post("/__keel/events") {
            contentType(ContentType.Application.Json)
            setBody(encode(KeelRealtimeEnvelope.subscribe(listOf("demo"), sid = "nope")))
        }
        assertEquals(HttpStatusCode.NotFound, unknownSid.status)

        val malformed = client.post("/__keel/events") {
            contentType(ContentType.Application.Json)
            setBody("{")
        }
        assertEquals(HttpStatusCode.BadRequest, malformed.status)

        val unknownEvent = client.post("/__keel/events") {
            contentType(ContentType.Application.Json)
            setBody(encode(KeelRealtimeEnvelope.send("demo.nope")))
        }
        assertEquals(HttpStatusCode.NotFound, unknownEvent.status)

        val outboundOnly = client.post("/__keel/events") {
            contentType(ContentType.Application.Json)
            setBody(encode(KeelRealtimeEnvelope.send("demo.tick")))
        }
        assertEquals(HttpStatusCode.NotFound, outboundOnly.status)
    }

    @Test
    fun `authorize denies channels at handshake`() = testApplication {
        application {
            installTransports()
            installSample {
                authorize = { _, channel -> channel == "demo" }
            }
        }
        val client = createClient { install(ClientWebSockets) }
        client.webSocket("/__keel/events?channels=demo,secret") {
            assertEquals(KeelRealtimeEnvelope.READY, nextEnvelope().type)
            val denied = nextEnvelope()
            assertEquals(KeelRealtimeEnvelope.ERROR, denied.type)
            assertEquals("secret", denied.channel)
            assertEquals(setOf("demo"), hub!!.channels())
        }
    }

    @Test
    fun `typed event published from a handler reaches the channel`() = testApplication {
        application {
            installTransports()
            installSample {
                on<Shout>("demo.broadcast") { input ->
                    published = call.keelRealtime.publish("demo", "demo.tick", Tick(input.text.length.toLong()))
                }
            }
        }
        val client = createClient { install(ClientWebSockets) }
        client.webSocket("/__keel/events?channels=demo") {
            assertEquals(KeelRealtimeEnvelope.READY, nextEnvelope().type)
            val response = client.post("/__keel/events") {
                contentType(ContentType.Application.Json)
                setBody(
                    encode(
                        KeelRealtimeEnvelope.send(
                            "demo.broadcast",
                            buildJsonObject { put("text", "four") },
                        ),
                    ),
                )
            }
            assertEquals(HttpStatusCode.Accepted, response.status)
            assertEquals(1, published)
            val event = nextEnvelope()
            assertEquals("demo.tick", event.event)
            assertEquals("4", event.data!!.jsonObject.getValue("at").jsonPrimitive.content)
        }
    }

    @Test
    fun `post enforces the same-origin csrf policy`() = testApplication {
        application {
            installTransports()
            installSample()
        }
        val denied = client.post("/__keel/events") {
            contentType(ContentType.Application.Json)
            header(HttpHeaders.Origin, "https://evil.example")
            setBody(encode(KeelRealtimeEnvelope.ping()))
        }
        assertEquals(HttpStatusCode.Forbidden, denied.status)

        val allowed = client.post("/__keel/events") {
            contentType(ContentType.Application.Json)
            header("Sec-Fetch-Site", "same-origin")
            setBody(encode(KeelRealtimeEnvelope.ping()))
        }
        assertEquals(HttpStatusCode.Accepted, allowed.status, allowed.bodyAsText())
    }

    @Test
    fun `websocket only hosts skip the sse route`() = testApplication {
        application {
            install(WebSockets)
            installSample()
        }
        assertEquals(HttpStatusCode.NotFound, client.prepareGet("/__keel/events").execute { it.status })
        val client = createClient { install(ClientWebSockets) }
        client.webSocket("/__keel/events?channels=demo") {
            assertEquals(KeelRealtimeEnvelope.READY, nextEnvelope().type)
        }
    }

    @Test
    fun `schema documents events`() = testApplication {
        application {
            installTransports()
            installSample()
        }
        val schema = client.prepareGet("/__keel/schema").execute { it.bodyAsText() }
        assertTrue(schema.contains("\"events\""), schema)
        assertTrue(schema.contains("\"demo.tick\""), schema)
        assertTrue(schema.contains("\"direction\": \"out\""), schema)
        assertTrue(schema.contains("\"demo.shout\""), schema)
        assertTrue(schema.contains("\"direction\": \"in\""), schema)
    }

    @Test
    fun `realtime without plugins fails the install`() {
        val failure = assertThrows<KeelRealtimeMissingPluginException> {
            testApplication {
                application {
                    keel {
                        realtime { heartbeatSeconds = 0 }
                    }
                }
            }
        }
        assertTrue(failure.message!!.contains("install(SSE)"), failure.message)
    }

    @Test
    fun `realtime routes do not exist without the opt-in`() = testApplication {
        writePack()
        application {
            installTransports()
            keel {
                bundle = FrontendBundle.fromDirectory(pack)
                pages {
                    page<Home>("home", "/") { Home("hello") }
                }
            }
            hub = attributes.getOrNull(KeelRealtimeKey)
        }
        assertNull(hub)
        assertEquals(HttpStatusCode.NotFound, client.prepareGet("/__keel/events").execute { it.status })
    }

    private suspend fun DefaultClientWebSocketSession.nextEnvelope(): KeelRealtimeEnvelope =
        decode((withTimeout(5000) { incoming.receive() } as Frame.Text).readText())

    private fun encode(envelope: KeelRealtimeEnvelope): String =
        KeelJson.codec.encodeToString(KeelRealtimeEnvelope.serializer(), envelope)

    private fun decode(raw: String): KeelRealtimeEnvelope =
        KeelJson.codec.decodeFromString(KeelRealtimeEnvelope.serializer(), raw)
}
