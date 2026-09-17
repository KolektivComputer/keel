package dev.kolektiv.keel.ktor.realtime

import dev.kolektiv.keel.KeelJson
import dev.kolektiv.keel.event.EventDirection
import dev.kolektiv.keel.event.EventDiscovery
import dev.kolektiv.keel.event.EventRegistry
import io.ktor.server.application.ApplicationCall
import kotlinx.coroutines.asContextElement
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.serializer

/**
 * Context handed to a realtime event handler. Cookie/session state is on
 * [call]; [channel] is the channel the client addressed (optional), and
 * [correlationId] echoes the client's envelope id.
 */
class RealtimeRequest internal constructor(
    val call: ApplicationCall,
    val event: String,
    val channel: String?,
    val correlationId: String?,
    val data: JsonElement?,
) {
    /** The envelope payload as received; [JsonNull] when the client sent none. */
    fun receiveJson(): JsonElement = data ?: JsonNull

    /** The typed payload the registry declares for [data]. */
    inline fun <reified T : Any> decode(): T =
        KeelJson.codec.decodeFromJsonElement(serializer<T>(), receiveJson())

    fun decode(serializer: KSerializer<*>): Any {
        @Suppress("UNCHECKED_CAST")
        return KeelJson.codec.decodeFromJsonElement(serializer as KSerializer<Any>, receiveJson())
    }

    companion object {
        private val current = ThreadLocal<RealtimeRequest>()

        /**
         * The realtime event currently running on this thread. Annotated
         * `@KeelEvent` functions use this for cookies/session without taking
         * [call] as an input field.
         */
        fun current(): RealtimeRequest =
            current.get() ?: error("not inside a Keel realtime event handler")

        internal suspend fun <T> with(request: RealtimeRequest, block: suspend () -> T): T =
            withContext(current.asContextElement(request)) { block() }
    }
}

/**
 * Realtime opt-in for `keel { }`. Declares the typed events the host speaks
 * and how connections are authorized. Endpoints only exist when this block is
 * present and the host installed the matching Ktor plugins first.
 */
class RealtimeDsl @PublishedApi internal constructor(
    @PublishedApi internal val registry: EventRegistry,
    @PublishedApi internal val handlers: MutableMap<String, suspend RealtimeRequest.(JsonElement) -> Unit>,
) {
    /**
     * Channel authorization, evaluated at subscribe time with the call that
     * asks (the handshake call for the query string, the POST call for
     * `subscribe` envelopes). Default allows every channel.
     */
    var authorize: (suspend (ApplicationCall, String) -> Boolean)? = null

    /**
     * Server keepalive interval in seconds. `ping` envelopes keep proxies
     * from closing idle streams and let clients notice dead connections.
     * `0` disables. Default 25.
     */
    var heartbeatSeconds: Long = 25

    /** Declares a typed event payload without a handler (typically `OUT`). */
    inline fun <reified T : Any> event(
        id: String,
        direction: EventDirection = EventDirection.BOTH,
    ) {
        registry.event<T>(id, direction)
    }

    /**
     * Registers a handler for client-sent events. Registers the binding as
     * [EventDirection.IN] when the event is not declared yet; a declared
     * `OUT` event is rejected.
     */
    inline fun <reified I : Any> on(
        id: String,
        noinline handler: suspend RealtimeRequest.(I) -> Unit,
    ) {
        val existing = registry.find(id)
        if (existing == null) {
            registry.event<I>(id, EventDirection.IN)
        } else {
            check(existing.direction != EventDirection.OUT) {
                "event '$id' is declared OUT and cannot have a client handler; use IN or BOTH"
            }
            check(existing.payload.descriptor == serializer<I>().descriptor) {
                "event '$id' is declared with a different payload type"
            }
        }
        handlers[id] = { element ->
            @Suppress("UNCHECKED_CAST")
            handler(
                KeelJson.codec.decodeFromJsonElement(
                    registry.get(id).payload as KSerializer<I>,
                    element,
                ),
            )
        }
    }

    /**
     * Registers `@KeelEvent` functions on [hosts] (objects or classes). Each
     * function takes one payload and returns `Unit`; an
     * `ApplicationCall.(Payload) -> Unit` extension gets [RealtimeRequest.call]
     * as `this`.
     */
    fun events(vararg hosts: Any) {
        for (host in hosts) {
            for (discovered in EventDiscovery.discover(host)) {
                registry.register(discovered.binding)
                handlers[discovered.id] = { element ->
                    @Suppress("UNCHECKED_CAST")
                    val payload = KeelJson.codec.decodeFromJsonElement(
                        discovered.payload as KSerializer<Any>,
                        element,
                    )
                    discovered.invoke(payload, extension = call)
                }
            }
        }
    }
}
