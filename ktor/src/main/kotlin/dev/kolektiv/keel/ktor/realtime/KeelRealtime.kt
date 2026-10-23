package dev.kolektiv.keel.ktor.realtime

import dev.kolektiv.keel.KeelJson
import dev.kolektiv.keel.event.EventDirectionException
import dev.kolektiv.keel.event.UnknownEventException
import dev.kolektiv.keel.realtime.KeelRealtimeEnvelope
import dev.kolektiv.keel.ktor.KeelConfig
import dev.kolektiv.keel.ktor.PageValidationException
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.log
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.decodeFromJsonElement
import java.util.Collections
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * A live realtime connection: one WebSocket session, or one SSE stream
 * addressed by [id] (the `sid` in the ready envelope). Channels are the
 * routing unit; the outbound channel is bounded and drops the oldest
 * envelope when a slow client falls behind, so publishing never blocks.
 */
internal class RealtimeConnection(
    val id: String,
    val call: ApplicationCall,
    val transport: String,
) {
    val channels: MutableSet<String> = Collections.synchronizedSet(LinkedHashSet())

    private val outbound = Channel<KeelRealtimeEnvelope>(
        capacity = 256,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    val outgoing: ReceiveChannel<KeelRealtimeEnvelope> get() = outbound

    fun offer(envelope: KeelRealtimeEnvelope): Boolean = outbound.trySend(envelope).isSuccess

    fun close() {
        outbound.close()
    }
}

/** Channels a subscribe / unsubscribe request added and had rejected. */
internal class SubscribeOutcome(
    val channels: List<String>,
    val accepted: List<String>,
    val denied: List<String>,
)

/**
 * Host-facing realtime bus. Publish typed events or invalidations from
 * actions and loaders; the hub fans them out to every connection subscribed
 * to the channel. Keel owns routing, auth, and reconnect semantics — clients
 * subscribe by channel id and rehydrate through normal visits.
 *
 * Reach it from a call with `call.keelRealtime` or from the application with
 * `application.keelRealtime`.
 */
class KeelRealtime internal constructor(private val config: KeelConfig) {
    private val connections = ConcurrentHashMap<String, RealtimeConnection>()

    private val realtime: RealtimeDsl
        get() = config.realtime
            ?: throw IllegalStateException("realtime is not configured on this keel { } block")

    /** Number of live connections, optionally only those on [channel]. */
    fun connectionCount(channel: String? = null): Int =
        if (channel == null) connections.size else connections.values.count { channel in it.channels }

    /** Stream ids (`sid`) of live connections. */
    fun connections(): Set<String> = connections.keys.toSet()

    /** Every channel with at least one subscriber right now. */
    fun channels(): Set<String> = connections.values.flatMap { it.channels }.toSet()

    /**
     * Publishes a typed event to [channel]. [data] is encoded with the
     * serializer registered for [event]; returns how many connections the
     * envelope was queued for. Unknown or `IN`-only events throw
     * [UnknownEventException] / [EventDirectionException].
     */
    fun publish(channel: String, event: String, data: Any? = null): Int {
        val binding = config.eventRegistry.outgoing(event)
        val payload = data?.let { encode(binding.payload, it) }
        return broadcast(KeelRealtimeEnvelope.event(channel, event, payload))
    }

    /**
     * Publishes an already-encoded payload to [channel]. The event must still
     * be registered and publishable, so packs keep a typed contract.
     */
    fun publishJson(channel: String, event: String, data: JsonElement? = null): Int {
        config.eventRegistry.outgoing(event)
        return broadcast(KeelRealtimeEnvelope.event(channel, event, data))
    }

    /** Publishes a typed event to one connection. Returns false for a stale sid. */
    fun send(sid: String, event: String, data: Any? = null): Boolean {
        val connection = connections[sid] ?: return false
        val binding = config.eventRegistry.outgoing(event)
        val payload = data?.let { encode(binding.payload, it) }
        return connection.offer(KeelRealtimeEnvelope.event(channel = "", event = event, data = payload))
    }

    /**
     * Tells every connection subscribed to [channel] to rehydrate the seed
     * with a normal visit. [path], [only], and [except] narrow the visit the
     * way a visit request does. Returns the delivery count.
     */
    fun invalidate(
        channel: String,
        path: String? = null,
        only: List<String>? = null,
        except: List<String>? = null,
    ): Int = broadcast(KeelRealtimeEnvelope.invalidate(channel, path, only, except))

    // --- transport plumbing ---------------------------------------------

    internal fun open(call: ApplicationCall, transport: String): RealtimeConnection {
        val connection = RealtimeConnection(
            id = "rt-${UUID.randomUUID().toString().take(12)}",
            call = call,
            transport = transport,
        )
        connections[connection.id] = connection
        return connection
    }

    internal fun close(connection: RealtimeConnection) {
        connections.remove(connection.id)
        connection.close()
    }

    internal fun ready(connection: RealtimeConnection): KeelRealtimeEnvelope =
        KeelRealtimeEnvelope.ready(connection.id, connection.channels.toList())

    internal fun startHeartbeat(scope: CoroutineScope, connection: RealtimeConnection): Job? {
        val seconds = realtime.heartbeatSeconds
        if (seconds <= 0) return null
        return scope.launch {
            while (isActive) {
                delay(seconds * 1000)
                connection.offer(KeelRealtimeEnvelope.ping())
            }
        }
    }

    /** Applies a subscribe request, authorizing each channel for [call]. */
    internal suspend fun subscribe(
        connection: RealtimeConnection,
        requested: List<String>,
        call: ApplicationCall,
    ): SubscribeOutcome {
        val accepted = mutableListOf<String>()
        val denied = mutableListOf<String>()
        for (channel in requested.distinct()) {
            if (channel.isBlank()) continue
            if (authorize(call, channel)) {
                connection.channels.add(channel)
                accepted.add(channel)
            } else {
                denied.add(channel)
            }
        }
        return SubscribeOutcome(connection.channels.toList(), accepted, denied)
    }

    internal fun unsubscribe(connection: RealtimeConnection, requested: List<String>): List<String> {
        val removed = requested.filter { connection.channels.remove(it) }
        return removed
    }

    /** Handles a subscribe / unsubscribe / send envelope from a live stream. */
    internal suspend fun handle(
        connection: RealtimeConnection,
        envelope: KeelRealtimeEnvelope,
        call: ApplicationCall,
    ) {
        when (envelope.type) {
            KeelRealtimeEnvelope.PING -> connection.offer(KeelRealtimeEnvelope.ping())
            KeelRealtimeEnvelope.SUBSCRIBE -> {
                val outcome = subscribe(connection, envelope.channels.orEmpty(), call)
                acknowledge(connection, outcome)
            }
            KeelRealtimeEnvelope.UNSUBSCRIBE -> {
                unsubscribe(connection, envelope.channels.orEmpty())
                connection.offer(ready(connection))
            }
            KeelRealtimeEnvelope.SEND -> {
                try {
                    invokeSend(call, envelope)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (failure: Throwable) {
                    connection.offer(KeelRealtimeEnvelope.error(messageFor(failure), envelope.channel))
                }
            }
            else -> connection.offer(
                KeelRealtimeEnvelope.error("unsupported envelope type '${envelope.type}'", envelope.channel),
            )
        }
    }

    /** Subscribe request over plain HTTP (SSE clients POST it). */
    internal suspend fun subscribeBySid(
        call: ApplicationCall,
        sid: String?,
        channels: List<String>,
    ): SubscribeOutcome? {
        val connection = sid?.let { connections[it] } ?: return null
        val outcome = subscribe(connection, channels, call)
        acknowledge(connection, outcome)
        return outcome
    }

    /** Unsubscribe request over plain HTTP (SSE clients POST it). Returns the remaining channels. */
    internal fun unsubscribeBySid(sid: String?, channels: List<String>): List<String>? {
        val connection = sid?.let { connections[it] } ?: return null
        unsubscribe(connection, channels)
        connection.offer(ready(connection))
        return connection.channels.toList()
    }

    /**
     * Runs a client `send` envelope through the registered handler. Throws
     * [UnknownEventException] / [EventDirectionException] for unregistered or
     * inbound-forbidden events, [PageValidationException] for domain errors,
     * and [IllegalArgumentException] for a missing event id.
     */
    internal suspend fun invokeSend(call: ApplicationCall, envelope: KeelRealtimeEnvelope) {
        val id = envelope.event?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("send envelope requires an event id")
        config.eventRegistry.incoming(id)
        val handler = config.eventHandlers[id] ?: throw UnknownEventException(id)
        val payload = envelope.data ?: JsonNull
        val request = RealtimeRequest(
            call = call,
            event = id,
            channel = envelope.channel,
            correlationId = envelope.id,
            data = payload,
        )
        RealtimeRequest.with(request) {
            request.handler(payload)
        }
    }

    private fun acknowledge(connection: RealtimeConnection, outcome: SubscribeOutcome) {
        connection.offer(ready(connection))
        for (channel in outcome.denied) {
            connection.offer(KeelRealtimeEnvelope.error("not authorized for channel '$channel'", channel))
        }
    }

    private suspend fun authorize(call: ApplicationCall, channel: String): Boolean {
        val policy = realtime.authorize ?: return true
        return try {
            policy(call, channel)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Throwable) {
            call.application.log.warn("keel: realtime channel authorization failed for '$channel'", failure)
            false
        }
    }

    private fun broadcast(envelope: KeelRealtimeEnvelope): Int {
        var delivered = 0
        for (connection in connections.values) {
            val channel = envelope.channel
            if (channel != null && channel.isNotEmpty() && channel !in connection.channels) continue
            connection.offer(envelope)
            delivered += 1
        }
        return delivered
    }

    @Suppress("UNCHECKED_CAST")
    private fun encode(serializer: KSerializer<*>, value: Any): JsonElement =
        KeelJson.codec.encodeToJsonElement(serializer as KSerializer<Any>, value)

    private fun messageFor(failure: Throwable): String = when (failure) {
        is PageValidationException -> failure.errors.entries.joinToString("; ") { (field, messages) ->
            "$field: ${messages.joinToString(", ")}"
        }
        else -> failure.message ?: "realtime handler failed"
    }

    internal fun closeAll() {
        for (connection in connections.values) close(connection)
    }
}
