package dev.kolektiv.keel.samples.harbor

import dev.kolektiv.keel.bundle.FrontendBundle
import dev.kolektiv.keel.event.EventDirection
import dev.kolektiv.keel.ktor.CspPolicy
import dev.kolektiv.keel.ktor.PageMissingException
import dev.kolektiv.keel.ktor.SharedProvider
import dev.kolektiv.keel.ktor.keel
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.sse.SSE
import io.ktor.server.websocket.WebSockets
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

fun Application.harbor(bundle: FrontendBundle) {
    install(WebSockets)
    install(SSE)
    keel {
        this.bundle = bundle
        watchPacks = true
        title = "Harbor"
        notFoundPageId = "harbor.notFound"
        csp = CspPolicy.nonce()
        shared = SharedProvider { call, _, _, _ ->
            buildJsonObject {
                put("site", "Harbor")
                val viewer = Board.viewer(call)
                if (viewer != null) {
                    put(
                        "viewer",
                        buildJsonObject {
                            put("id", viewer.id)
                            put("displayName", viewer.displayName)
                        },
                    )
                }
            }
        }
        pages {
            page<HomePage>("harbor.home", "/") {
                HomePage(viewer = Board.viewer(call)?.toRef(), feed = Board.feed())
            }
            page<UserPage>("harbor.user", "/u/{id}") {
                val user = Board.user(params.getValue("id"))
                    ?: throw PageMissingException(path)
                UserPage(user = user.toRef(), messages = Board.messagesFor(user.id))
            }
            page<NotFoundPage>("harbor.notFound", "/__not-found") {
                NotFoundPage(path = path)
            }
        }
        actions(Board)
        realtime {
            // Typed board events the host pushes, plus the `@KeelEvent`
            // handlers on Board for client-sent notices.
            event<FeedItem>("harbor.message", EventDirection.OUT)
            events(Board)
        }
    }
}
