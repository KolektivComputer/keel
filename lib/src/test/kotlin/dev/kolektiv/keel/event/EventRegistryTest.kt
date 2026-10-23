package dev.kolektiv.keel.event

import kotlinx.serialization.Serializable
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class EventRegistryTest {

    @Serializable
    data class Ping(val at: Long)

    @Test
    fun `registers and looks up events`() {
        val registry = events {
            event<Ping>("demo.ping", EventDirection.OUT)
        }
        assertEquals(setOf("demo.ping"), registry.ids())
        assertEquals(EventDirection.OUT, registry.get("demo.ping").direction)
        assertEquals(Ping.serializer().descriptor, registry.outgoing("demo.ping").payload.descriptor)
    }

    @Test
    fun `duplicate ids are rejected`() {
        val registry = events { event<Ping>("demo.ping") }
        assertThrows(DuplicateEventException::class.java) {
            registry.register(EventBinding("demo.ping", EventDirection.BOTH, Ping.serializer()))
        }
    }

    @Test
    fun `unknown ids are rejected`() {
        val registry = EventRegistry()
        val error = assertThrows(UnknownEventException::class.java) { registry.get("nope") }
        assertEquals("nope", error.eventId)
    }

    @Test
    fun `direction guards publishing and receiving`() {
        val registry = events {
            event<Ping>("client.only", EventDirection.IN)
            event<Ping>("host.only", EventDirection.OUT)
        }
        assertThrows(EventDirectionException::class.java) { registry.outgoing("client.only") }
        assertThrows(EventDirectionException::class.java) { registry.incoming("host.only") }
        assertEquals("host.only", registry.outgoing("host.only").id)
        assertEquals("client.only", registry.incoming("client.only").id)
    }

    @Test
    fun `wire directions round trip`() {
        for (direction in EventDirection.entries) {
            assertEquals(direction, EventDirection.fromWire(direction.wireValue))
        }
        assertThrows(IllegalArgumentException::class.java) { EventDirection.fromWire("sideways") }
    }
}
