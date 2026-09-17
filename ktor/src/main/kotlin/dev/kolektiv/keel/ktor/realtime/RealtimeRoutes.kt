package dev.kolektiv.keel.ktor.realtime

import dev.kolektiv.keel.Keel
import dev.kolektiv.keel.KeelJson
import dev.kolektiv.keel.event.EventDirectionException
import dev.kolektiv.keel.event.UnknownEventException
import dev.kolektiv.keel.ktor.KeelEngine
import dev.kolektiv.keel.ktor.PageValidationException
import dev.kolektiv.keel.realtime.KeelRealtimeEnvelope
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.pluginOrNull
import io.ktor.server.request.receiveText
import io.ktor.server.response.respondText
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import io.ktor.server.sse.SSE
import io.ktor.server.sse.ServerSSESession
import io.ktor.server.sse.sse
import io.ktor.server.websocket.DefaultWebSocketServerSession
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.webSocket
import io.ktor.sse.ServerSentEvent
import io.ktor.util.AttributeKey
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** `keel { realtime { } }` is configured but neither Ktor transport plugin is installed. */
class KeelRealtimeMissingPluginException : IllegalStateException(
    "keel { realtime { } } needs a transport: install(SSE) and/or install(WebSockets) before keel { }",
)

/** `call.keelRealtime` was read on a host that never opted in. */
class KeelRealtimeNotConfiguredException : IllegalStateException(
    "realtime is not configured: add keel { realtime { } } and install(SSE) / install(WebSockets)",
)

internal val KeelRealtimeKey = AttributeKey<KeelRealtime>("KeelRealtime")

/** The realtime bus for this application; throws when realtime is not configured. */
val Application.keelRealtime: KeelRealtime
    get() = attributes.getOrNull(KeelRealtimeKey) ?: throw KeelRealtimeNotConfiguredException()

/** The realtime bus, reachable from actions and page loaders. */
val ApplicationCall.keelRealtime: KeelRealtime get() = application.keelRealtime

internal fun KeelEngine.installRealtime(application: Application) {
    if (config.realtime == null) return
    val webSockets = application.pluginOrNull(WebSockets) != null
    val sse = application.pluginOrNull(SSE) != null
    if (!webSockets && !sse) throw KeelRealtimeMissingPluginException()
    val hub = KeelRealtime(config)
    realtimeHub = hub
    application.attributes.put(KeelRealtimeKey, hub)
    val engine = this
    application.routing {
        if (webSockets) {
            webSocket(Keel.REALTIME_PATH) {
                engine.handleRealtimeSocket(hub, this)
            }
        }
        if (sse) {
            sse(Keel.REALTIME_PATH) {
                engine.handleRealtimeSse(hub, this)
            }
        }
        post(Keel.REALTIME_PATH) {
            engine.respondRealtimePost(hub, call)
        }
    }
}

private suspend fun KeelEngine.handleRealtimeSocket(
    hub: KeelRealtime,
    session: DefaultWebSocketServerSession,
) {
    val call = session.call
    val connection = hub.open(call, "ws")
    openConnection(hub, connection, call)
    val heartbeat = hub.startHeartbeat(session, connection)
    val writer = session.launch {
        for (envelope in connection.outgoing) {
            session.send(Frame.Text(encode(envelope)))
        }
    }
    try {
        for (frame in session.incoming) {
            if (frame !is Frame.Text) continue
            val envelope = try {
                KeelJson.codec.decodeFromString(KeelRealtimeEnvelope.serializer(), frame.readText())
            } catch (failure: Throwable) {
                if (failure is CancellationException) throw failure
                connection.offer(KeelRealtimeEnvelope.error("malformed envelope"))
                continue
            }
            hub.handle(connection, envelope, call)
        }
    } finally {
        heartbeat?.cancel()
        writer.cancel()
        hub.close(connection)
    }
}

private suspend fun KeelEngine.handleRealtimeSse(hub: KeelRealtime, session: ServerSSESession) {
    val call = session.call
    val connection = hub.open(call, "sse")
    openConnection(hub, connection, call)
    val heartbeat = hub.startHeartbeat(session, connection)
    try {
        for (envelope in connection.outgoing) {
            session.send(
                ServerSentEvent(
                    data = encode(envelope),
                    event = envelope.type,
                ),
            )
        }
    } finally {
        heartbeat?.cancel()
        hub.close(connection)
    }
}

/** Subscribes the query-string channels and queues the ready envelope. */
private suspend fun openConnection(
    hub: KeelRealtime,
    connection: RealtimeConnection,
    call: ApplicationCall,
) {
    val requested = parseChannels(call.request.queryParameters["channels"])
    val outcome = hub.subscribe(connection, requested, call)
    connection.offer(hub.ready(connection))
    for (channel in outcome.denied) {
        connection.offer(KeelRealtimeEnvelope.error("not authorized for channel '$channel'", channel))
    }
}

private suspend fun KeelEngine.respondRealtimePost(hub: KeelRealtime, call: ApplicationCall) {
    if (!guardCsrf(call)) return
    val text = call.receiveText()
    val envelope = try {
        KeelJson.codec.decodeFromString(
            KeelRealtimeEnvelope.serializer(),
            if (text.isBlank()) "{}" else text,
        )
    } catch (failure: Throwable) {
        if (failure is CancellationException) throw failure
        respondEnvelopeErrors(call, HttpStatusCode.BadRequest, "envelope", "malformed JSON envelope")
        return
    }
    when (envelope.type) {
        KeelRealtimeEnvelope.SUBSCRIBE -> {
            val outcome = hub.subscribeBySid(call, envelope.sid, envelope.channels.orEmpty())
            if (outcome == null) {
                respondEnvelopeErrors(call, HttpStatusCode.NotFound, "sid", "unknown stream")
                return
            }
            respondAccepted(call, envelope.sid, outcome.channels, outcome.accepted, outcome.denied)
        }
        KeelRealtimeEnvelope.UNSUBSCRIBE -> {
            val channels = hub.unsubscribeBySid(envelope.sid, envelope.channels.orEmpty())
            if (channels == null) {
                respondEnvelopeErrors(call, HttpStatusCode.NotFound, "sid", "unknown stream")
                return
            }
            respondAccepted(call, envelope.sid, channels, envelope.channels.orEmpty(), emptyList())
        }
        KeelRealtimeEnvelope.SEND -> {
            try {
                hub.invokeSend(call, envelope)
            } catch (invalid: PageValidationException) {
                respondValidationErrors(call, invalid)
                return
            } catch (unknown: UnknownEventException) {
                respondEnvelopeErrors(call, HttpStatusCode.NotFound, "event", unknown.message ?: "unknown event")
                return
            } catch (direction: EventDirectionException) {
                respondEnvelopeErrors(call, HttpStatusCode.NotFound, "event", direction.message ?: "unknown event")
                return
            } catch (illegal: IllegalArgumentException) {
                respondEnvelopeErrors(call, HttpStatusCode.BadRequest, "event", illegal.message ?: "invalid send")
                return
            }
            respondOk(call)
        }
        KeelRealtimeEnvelope.PING -> respondOk(call)
        else -> respondEnvelopeErrors(
            call,
            HttpStatusCode.BadRequest,
            "type",
            "unsupported envelope type '${envelope.type}'",
        )
    }
}

private suspend fun respondOk(call: ApplicationCall) {
    call.respondText(
        KeelJson.codec.encodeToString(JsonObject.serializer(), buildJsonObject { put("ok", true) }),
        ContentType.Application.Json,
        HttpStatusCode.Accepted,
    )
}

private suspend fun respondAccepted(
    call: ApplicationCall,
    sid: String?,
    channels: List<String>,
    accepted: List<String>,
    denied: List<String>,
) {
    val payload = buildJsonObject {
        put("sid", sid)
        put("channels", buildJsonArray { channels.forEach { add(JsonPrimitive(it)) } })
        put("accepted", buildJsonArray { accepted.forEach { add(JsonPrimitive(it)) } })
        put("denied", buildJsonArray { denied.forEach { add(JsonPrimitive(it)) } })
    }
    call.respondText(
        KeelJson.codec.encodeToString(JsonObject.serializer(), payload),
        ContentType.Application.Json,
        HttpStatusCode.Accepted,
    )
}

private suspend fun respondEnvelopeErrors(
    call: ApplicationCall,
    status: HttpStatusCode,
    field: String,
    message: String,
) {
    val errors = JsonObject(mapOf(field to JsonArray(listOf(JsonPrimitive(message)))))
    val payload = JsonObject(mapOf("errors" to errors))
    call.respondText(
        KeelJson.codec.encodeToString(JsonObject.serializer(), payload),
        ContentType.Application.Json,
        status,
    )
}

private suspend fun respondValidationErrors(call: ApplicationCall, invalid: PageValidationException) {
    val errors = JsonObject(
        invalid.errors.mapValues { (_, messages) ->
            JsonArray(messages.map { JsonPrimitive(it) })
        },
    )
    val payload = JsonObject(mapOf("errors" to errors))
    call.respondText(
        KeelJson.codec.encodeToString(JsonObject.serializer(), payload),
        ContentType.Application.Json,
        HttpStatusCode.UnprocessableEntity,
    )
}

private fun parseChannels(raw: String?): List<String> =
    raw?.split(',')?.map { it.trim() }?.filter { it.isNotEmpty() }?.distinct().orEmpty()

private fun encode(envelope: KeelRealtimeEnvelope): String =
    KeelJson.codec.encodeToString(KeelRealtimeEnvelope.serializer(), envelope)
