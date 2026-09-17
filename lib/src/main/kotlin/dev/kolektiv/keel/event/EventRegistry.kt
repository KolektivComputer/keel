package dev.kolektiv.keel.event

import kotlinx.serialization.KSerializer
import kotlinx.serialization.serializer

/**
 * Which way an event may travel.
 *
 * [IN] is client to host, [OUT] is host to client, [BOTH] allows either
 * direction. The wire value is lowercase (`in` / `out` / `both`).
 */
enum class EventDirection {
    IN,
    OUT,
    BOTH,
    ;

    val wireValue: String get() = name.lowercase()

    companion object {
        fun fromWire(value: String): EventDirection =
            entries.firstOrNull { it.wireValue == value.lowercase() }
                ?: throw IllegalArgumentException("unknown event direction '$value' (expected in|out|both)")
    }
}

/**
 * A realtime event the host knows how to encode. [id] is the contract key
 * packs subscribe to or send; it is not a URL. [payload] is the JSON payload
 * serializer.
 */
data class EventBinding(
    val id: String,
    val direction: EventDirection,
    val payload: KSerializer<*>,
)

class DuplicateEventException(id: String) : IllegalStateException("event '$id' is already registered")

class UnknownEventException(
    id: String,
    message: String = "unknown event '$id'",
) : NoSuchElementException(message) {
    val eventId: String = id
}

class EventDirectionException(
    id: String,
    message: String,
) : IllegalStateException(message) {
    val eventId: String = id
}

/**
 * Source of truth for event ids, directions, and payload serializers.
 *
 * A realtime host walks this registry to encode outgoing events and decode
 * incoming ones; Typegen walks it to emit the event section of the contract.
 * This module does not depend on Ktor.
 */
class EventRegistry {
    private val byId = linkedMapOf<String, EventBinding>()

    val events: Collection<EventBinding> get() = byId.values

    fun ids(): Set<String> = byId.keys

    fun register(binding: EventBinding): EventBinding {
        require(binding.id.isNotBlank()) { "event id is required" }
        if (byId.containsKey(binding.id)) throw DuplicateEventException(binding.id)
        byId[binding.id] = binding
        return binding
    }

    inline fun <reified T : Any> event(
        id: String,
        direction: EventDirection = EventDirection.BOTH,
    ): EventBinding = register(EventBinding(id, direction, serializer<T>()))

    fun get(id: String): EventBinding =
        byId[id] ?: throw UnknownEventException(id)

    /** Looks up an event the host may publish. [EventDirection.IN] is rejected. */
    fun outgoing(id: String): EventBinding = get(id).also {
        if (it.direction == EventDirection.IN) {
            throw EventDirectionException(id, "event '$id' is client-to-host only (IN)")
        }
    }

    /** Looks up an event the host may receive. [EventDirection.OUT] is rejected. */
    fun incoming(id: String): EventBinding = get(id).also {
        if (it.direction == EventDirection.OUT) {
            throw EventDirectionException(id, "event '$id' is host-to-client only (OUT)")
        }
    }
}

fun events(block: EventRegistry.() -> Unit): EventRegistry = EventRegistry().apply(block)
