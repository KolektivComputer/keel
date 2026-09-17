package dev.kolektiv.keel

import dev.kolektiv.keel.event.EventDirection

/**
 * Marks a realtime event payload or a host event handler.
 *
 * On a `@Serializable` class, [value] is the event id (`harbor.message`).
 * Empty uses the class simple name.
 *
 * On a host function, the function takes **one** value parameter (the
 * payload), returns `Unit`, and handles client-sent events. It may be an
 * extension so cookies/session are `this`. Empty uses the function name.
 *
 * Event ids are the contract keys packs subscribe to and send; they are not
 * URLs.
 */
@Target(AnnotationTarget.CLASS, AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
@MustBeDocumented
annotation class KeelEvent(
    val value: String = "",
    val direction: EventDirection = EventDirection.BOTH,
)
