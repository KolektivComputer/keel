package dev.kolektiv.keel.typegen

import dev.kolektiv.keel.KeelAction
import dev.kolektiv.keel.KeelEvent
import dev.kolektiv.keel.KeelType
import dev.kolektiv.keel.event.EventDirection
import kotlinx.serialization.Serializable
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

@KeelType("demo.home")
@Serializable
data class DemoHome(val title: String)

@KeelType
@Serializable
data class DemoRenameIn(val name: String)

@KeelType
@Serializable
data class DemoRenameOut(val ok: Boolean)

@KeelEvent("demo.tick", EventDirection.OUT)
@Serializable
data class DemoTick(val at: Long)

@KeelType
@Serializable
data class DemoNoteIn(val text: String)

object DemoActions {
    @KeelAction("demo.rename")
    fun rename(input: DemoRenameIn): DemoRenameOut = DemoRenameOut(true)

    @KeelEvent("demo.note", EventDirection.IN)
    fun note(input: DemoNoteIn) = Unit
}

class TypegenAnnotationTest {

    @Test
    fun `emits pages and actions from annotations`() {
        val contract = ClasspathContract.scan(listOf("dev.kolektiv.keel.typegen"))
        val ts = Typegen.emit(contract, pagesName = "DemoPages")
        assertTrue(ts.contains("export interface DemoHome {"), ts)
        assertTrue(ts.contains("\"demo.home\": DemoHome"), ts)
        assertTrue(ts.contains("\"demo.rename\": { in: DemoRenameIn; out: DemoRenameOut }"), ts)
        assertTrue(ts.contains("export type DemoActionId = keyof DemoActions"), ts)
        assertTrue(ts.contains("export interface DemoPages"), ts)
    }

    @Test
    fun `emits events from annotations in both places`() {
        val contract = ClasspathContract.scan(listOf("dev.kolektiv.keel.typegen"))
        val ts = Typegen.emit(contract, pagesName = "DemoPages")
        assertTrue(ts.contains("export interface DemoEvents {"), ts)
        assertTrue(ts.contains("\"demo.tick\": DemoTick"), ts)
        assertTrue(ts.contains("\"demo.note\": DemoNoteIn"), ts)
        assertTrue(ts.contains("export type DemoEventId = keyof DemoEvents"), ts)
        val json = Typegen.emitJson(contract, pagesName = "DemoPages")
        assertTrue(json.contains("\"direction\": \"out\""), json)
        assertTrue(json.contains("\"direction\": \"in\""), json)
    }
}
