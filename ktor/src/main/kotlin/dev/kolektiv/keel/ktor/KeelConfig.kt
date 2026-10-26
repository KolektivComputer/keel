package dev.kolektiv.keel.ktor

import dev.kolektiv.keel.Keel
import dev.kolektiv.keel.action.ActionDiscovery
import dev.kolektiv.keel.action.ActionRegistry
import dev.kolektiv.keel.bundle.FrontendBundle
import dev.kolektiv.keel.event.EventRegistry
import dev.kolektiv.keel.ktor.realtime.RealtimeDsl
import dev.kolektiv.keel.ktor.realtime.RealtimeRequest
import dev.kolektiv.keel.page.PageMethod
import dev.kolektiv.keel.page.PageRegistry
import dev.kolektiv.keel.security.CsrfPolicy
import io.ktor.http.Parameters
import io.ktor.server.application.ApplicationCall
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

fun interface SharedProvider {
    fun load(call: ApplicationCall, path: String, params: Map<String, String>, query: Parameters): JsonObject?
}

class PagesDsl @PublishedApi internal constructor(
    @PublishedApi internal val registry: PageRegistry,
    @PublishedApi internal val handlers: MutableMap<String, suspend PageRequest.() -> Any>,
) {
    inline fun <reified T : Any> page(
        id: String,
        path: String,
        methods: Set<PageMethod> = setOf(PageMethod.GET),
        noinline load: suspend PageRequest.() -> T,
    ) {
        registry.page<T>(id, path, methods)
        handlers[id] = load
    }
}

class ActionsDsl @PublishedApi internal constructor(
    @PublishedApi internal val registry: ActionRegistry,
    @PublishedApi internal val handlers: MutableMap<String, suspend ActionRequest.(Any) -> Any>,
) {
    inline fun <reified I : Any, reified O : Any> action(
        id: String,
        noinline handler: suspend ActionRequest.(I) -> O,
    ) {
        registry.action<I, O>(id)
        @Suppress("UNCHECKED_CAST")
        handlers[id] = handler as suspend ActionRequest.(Any) -> Any
    }
}

class KeelConfig {
    /**
     * The pack the pages DSL renders from. The host chooses it up front; Keel
     * never picks a pack and a visitor header cannot override it.
     */
    var bundle: FrontendBundle? = null

    /**
     * Additional installed packs. Address them per route with
     * `route.keel(pack)`; a bundle-less `respondPage` only resolves when
     * exactly one pack is configured in total.
     */
    var bundles: List<FrontendBundle> = emptyList()
    var packUrlPrefix: String = Keel.PACK_URL_PREFIX
    var bootstrap: String = "bootstrap.js"
    var title: String = "Keel"
    var shared: SharedProvider? = null
    var notFoundPageId: String? = null
    var csrf: CsrfPolicy? = null
    var csrfAllowedOrigins: Set<String> = emptySet()

    /**
     * Dev-time pack hot reload. When enabled, Keel fingerprints file and
     * directory bundles and swaps in a freshly opened pack when the source
     * changes. Classpath resource bundles are never watched. Default off.
     */
    var watchPacks: Boolean = false

    /** Poll interval for [watchPacks], in milliseconds. */
    var packWatchIntervalMs: Long = 500

    /**
     * Opt-in CSP for document responses. When set, Keel stamps one nonce
     * per document onto its shell scripts and pack-declared head
     * `<script>`/`<link>` tags, then sends [CspPolicy.header]. Visits stay
     * nonce-less and header-less. Default off so existing hosts are
     * unaffected.
     */
    var csp: CspPolicy? = null

    @PublishedApi
    internal val registry: PageRegistry = PageRegistry()
    @PublishedApi
    internal val handlers: MutableMap<String, suspend PageRequest.() -> Any> = linkedMapOf()
    @PublishedApi
    internal val actionRegistry: ActionRegistry = ActionRegistry()
    @PublishedApi
    internal val actionHandlers: MutableMap<String, suspend ActionRequest.(Any) -> Any> = linkedMapOf()
    @PublishedApi
    internal val eventRegistry: EventRegistry = EventRegistry()
    @PublishedApi
    internal val eventHandlers: MutableMap<String, suspend RealtimeRequest.(JsonElement) -> Unit> = linkedMapOf()

    @PublishedApi
    internal var realtimeDsl: RealtimeDsl? = null

    /**
     * Realtime transports (`GET`/`POST /__keel/events`, WebSocket upgrade on
     * the same path). Null — the default — means realtime is off: no
     * endpoints and no event registry entries. Enabling requires the host to
     * `install(SSE)` and/or `install(WebSockets)` before `keel { }`.
     */
    val realtime: RealtimeDsl? get() = realtimeDsl

    /**
     * Opt in to realtime: declare typed events and client-sent handlers,
     * authorize channels, tune the keepalive.
     */
    fun realtime(block: RealtimeDsl.() -> Unit) {
        realtimeDsl = RealtimeDsl(eventRegistry, eventHandlers).apply(block)
    }

    fun pages(block: PagesDsl.() -> Unit) {
        PagesDsl(registry, handlers).block()
    }

    fun actions(block: ActionsDsl.() -> Unit) {
        ActionsDsl(actionRegistry, actionHandlers).block()
    }

    /**
     * Register `@KeelAction` functions on [hosts] (objects or classes). Each
     * function is `(In) -> Out`; JSON in/out is the contract. An
     * `ApplicationCall.(In) -> Out` extension gets [ActionRequest.call] as
     * `this`.
     */
    fun actions(vararg hosts: Any) {
        for (host in hosts) {
            for (discovered in ActionDiscovery.discover(host)) {
                actionRegistry.register(discovered.binding)
                actionHandlers[discovered.id] = { input ->
                    discovered.invoke(input, extension = call)
                }
            }
        }
    }

    internal fun configuredBundles(): List<FrontendBundle> =
        buildList {
            bundle?.let { add(it) }
            addAll(bundles)
        }.distinctBy { it.id }
}
