package dev.kolektiv.keel.event

import dev.kolektiv.keel.KeelEvent
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class EventDiscoveryTest {

    @Serializable
    data class NoteIn(val text: String)

    object Host {
        var seen: String? = null

        @KeelEvent("demo.note", EventDirection.IN)
        fun note(input: NoteIn) {
            seen = input.text
        }
    }

    @Test
    fun `discovers an inbound handler and invokes it`() {
        val discovered = EventDiscovery.discover(Host)
        assertEquals(1, discovered.size)
        assertEquals("demo.note", discovered.single().id)
        assertEquals(EventDirection.IN, discovered.single().direction)
        Host.seen = null
        runBlocking { discovered.single().invoke(NoteIn("hi")) }
        assertEquals("hi", Host.seen)
    }

    @Test
    fun `registry uses the function name when the id is omitted`() {
        val registry = EventDiscovery.registry(UnnamedHost)
        assertEquals(setOf("whisper"), registry.ids())
    }

    object UnnamedHost {
        @KeelEvent
        fun whisper(input: NoteIn) = Unit
    }

    class Ctx(val prefix: String)

    object ExtensionHost {
        var seen: String? = null

        @KeelEvent("demo.ctx")
        fun Ctx.note(input: NoteIn) {
            seen = prefix + input.text
        }
    }

    @Test
    fun `extension receiver is passed at invoke`() {
        val discovered = EventDiscovery.discover(ExtensionHost).single()
        runBlocking { discovered.invoke(NoteIn("hi"), extension = Ctx("X")) }
        assertEquals("Xhi", ExtensionHost.seen)
    }

    @Test
    fun `outbound-only handlers are rejected`() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            EventDiscovery.discover(OutboundHost)
        }
        assertEquals(true, error.message!!.contains("is OUT"), error.message)
    }

    object OutboundHost {
        @KeelEvent("demo.out", EventDirection.OUT)
        fun out(input: NoteIn) = Unit
    }

    @Test
    fun `handlers must return unit`() {
        assertThrows(IllegalArgumentException::class.java) {
            EventDiscovery.discover(ReturningHost)
        }
    }

    object ReturningHost {
        @KeelEvent("demo.echo")
        fun echo(input: NoteIn): NoteIn = input
    }
}
