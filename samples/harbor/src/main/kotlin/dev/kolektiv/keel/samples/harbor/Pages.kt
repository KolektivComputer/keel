package dev.kolektiv.keel.samples.harbor

import dev.kolektiv.keel.KeelEvent
import dev.kolektiv.keel.KeelType
import dev.kolektiv.keel.event.EventDirection
import kotlinx.serialization.Serializable

@KeelType
@Serializable
data class UserRef(
    val id: String,
    val displayName: String,
)

@KeelEvent("harbor.message", EventDirection.OUT)
@KeelType
@Serializable
data class FeedItem(
    val id: String,
    val userId: String,
    val displayName: String,
    val body: String,
    val at: String,
)

@KeelType("harbor.home")
@Serializable
data class HomePage(
    val viewer: UserRef?,
    val feed: List<FeedItem>,
)

@KeelType("harbor.user")
@Serializable
data class UserPage(
    val user: UserRef,
    val messages: List<FeedItem>,
)

@KeelType("harbor.notFound")
@Serializable
data class NotFoundPage(
    val path: String,
    val title: String = "Not on this board",
)

@KeelType
@Serializable
data class SetNameIn(val displayName: String)

@KeelType
@Serializable
data class SetNameOut(val user: UserRef)

@KeelType
@Serializable
data class PostMessageIn(val body: String)

@KeelType
@Serializable
data class PostMessageOut(val message: FeedItem)

/** Client-sent "someone is writing" notice, echoed to the same channel. */
@KeelEvent("harbor.typing", EventDirection.BOTH)
@Serializable
data class TypingNotice(val displayName: String)
