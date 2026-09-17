package dev.kolektiv.keel.realtime

import dev.kolektiv.keel.Keel
import dev.kolektiv.keel.KeelJson
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.encodeToJsonElement

/**
 * The boring JSON envelope both realtime transports speak, in both
 * directions.
 *
 * `type` is one of [READY], [EVENT], [INVALIDATE], [ERROR], [PING] from the
 * host, or [SUBSCRIBE], [UNSUBSCRIBE], [SEND], [PING] from a client.
 * `channel` scopes subscriptions and events; `channels` is the subscribe /
 * ready list. `sid` names a server-created stream so a client can address it
 * over plain HTTP (SSE sends go through `POST`). `id` is an optional client
 * correlation id echoed on the matching event.
 */
@Serializable
data class KeelRealtimeEnvelope(
    val v: Int = Keel.REALTIME_VERSION,
    val type: String,
    val sid: String? = null,
    val channel: String? = null,
    val channels: List<String>? = null,
    val event: String? = null,
    val data: JsonElement? = null,
    val id: String? = null,
    val error: String? = null,
) {
    companion object {
        const val READY = "ready"
        const val EVENT = "event"
        const val INVALIDATE = "invalidate"
        const val ERROR = "error"
        const val PING = "ping"
        const val SUBSCRIBE = "subscribe"
        const val UNSUBSCRIBE = "unsubscribe"
        const val SEND = "send"

        fun ready(sid: String, channels: List<String>): KeelRealtimeEnvelope =
            KeelRealtimeEnvelope(
                type = READY,
                sid = sid,
                channels = channels,
            )

        fun event(
            channel: String,
            event: String,
            data: JsonElement? = null,
            id: String? = null,
        ): KeelRealtimeEnvelope =
            KeelRealtimeEnvelope(
                type = EVENT,
                channel = channel,
                event = event,
                data = data,
                id = id,
            )

        fun invalidate(
            channel: String,
            path: String? = null,
            only: List<String>? = null,
            except: List<String>? = null,
        ): KeelRealtimeEnvelope =
            KeelRealtimeEnvelope(
                type = INVALIDATE,
                channel = channel,
                data = KeelJson.codec.encodeToJsonElement(
                    KeelRealtimeInvalidate.serializer(),
                    KeelRealtimeInvalidate(path, only, except),
                ),
            )

        fun error(message: String, channel: String? = null): KeelRealtimeEnvelope =
            KeelRealtimeEnvelope(type = ERROR, channel = channel, error = message)

        fun ping(): KeelRealtimeEnvelope = KeelRealtimeEnvelope(type = PING)

        fun subscribe(channels: List<String>): KeelRealtimeEnvelope =
            KeelRealtimeEnvelope(type = SUBSCRIBE, channels = channels)

        fun unsubscribe(channels: List<String>): KeelRealtimeEnvelope =
            KeelRealtimeEnvelope(type = UNSUBSCRIBE, channels = channels)

        fun send(
            event: String,
            data: JsonElement? = null,
            channel: String? = null,
            id: String? = null,
        ): KeelRealtimeEnvelope =
            KeelRealtimeEnvelope(
                type = SEND,
                channel = channel,
                event = event,
                data = data,
                id = id,
            )
    }
}

/**
 * Payload of an [KeelRealtimeEnvelope.INVALIDATE] event: rehydrate the seed
 * with a normal visit. [path] targets a specific page path, [only] / [except]
 * limit the seed keys the way [dev.kolektiv.keel.visit.KeelHeaders.only] does.
 */
@Serializable
data class KeelRealtimeInvalidate(
    val path: String? = null,
    val only: List<String>? = null,
    val except: List<String>? = null,
)
