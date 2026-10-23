package dev.kolektiv.keel.event

import dev.kolektiv.keel.KeelEvent
import kotlinx.serialization.KSerializer
import kotlinx.serialization.serializer
import java.lang.reflect.InvocationTargetException
import kotlin.reflect.KFunction
import kotlin.reflect.KParameter
import kotlin.reflect.full.callSuspendBy
import kotlin.reflect.full.extensionReceiverParameter
import kotlin.reflect.full.findAnnotation
import kotlin.reflect.full.instanceParameter
import kotlin.reflect.jvm.kotlinFunction

/**
 * A `@KeelEvent` function the host can run when a client sends the event.
 * [payload] describes the JSON the client must send.
 */
class DiscoveredEvent(
    val id: String,
    val direction: EventDirection,
    val payload: KSerializer<*>,
    val function: KFunction<*>,
    val instance: Any?,
) {
    val binding: EventBinding get() = EventBinding(id, direction, payload)

    suspend fun invoke(payload: Any, extension: Any? = null) {
        val args = HashMap<KParameter, Any?>()
        function.instanceParameter?.let { parameter ->
            args[parameter] = instance ?: error("@KeelEvent '${function.name}' needs a host instance")
        }
        function.extensionReceiverParameter?.let { parameter ->
            args[parameter] = extension
                ?: error("@KeelEvent '${function.name}' needs an extension receiver")
        }
        args[valueParameter()] = payload
        try {
            if (function.isSuspend) {
                function.callSuspendBy(args)
            } else {
                function.callBy(args)
            }
        } catch (error: InvocationTargetException) {
            throw error.targetException ?: error
        }
    }

    private fun valueParameter(): KParameter {
        val values = function.parameters.filter { it.kind == KParameter.Kind.VALUE }
        require(values.size == 1) {
            "@KeelEvent '${function.name}' must take exactly one value parameter, found ${values.size}"
        }
        return values.single()
    }
}

object EventDiscovery {
    fun discover(host: Any): List<DiscoveredEvent> {
        val instance = if (host is Class<*>) host.kotlin.objectInstance else host
        val kClass = when (host) {
            is Class<*> -> host.kotlin
            else -> host::class
        }
        return discover(kClass.java, instance)
    }

    fun discover(clazz: Class<*>, instance: Any? = clazz.kotlin.objectInstance): List<DiscoveredEvent> {
        val seen = LinkedHashSet<KFunction<*>>()
        val out = ArrayList<DiscoveredEvent>()
        for (method in clazz.declaredMethods) {
            val function = method.kotlinFunction ?: continue
            if (!seen.add(function)) continue
            val annotation = function.findAnnotation<KeelEvent>() ?: continue
            out.add(bind(annotation, function, instance))
        }
        return out
    }

    fun registry(vararg hosts: Any): EventRegistry {
        val registry = EventRegistry()
        for (host in hosts) {
            for (event in discover(host)) {
                registry.register(event.binding)
            }
        }
        return registry
    }

    private fun bind(annotation: KeelEvent, function: KFunction<*>, instance: Any?): DiscoveredEvent {
        require(annotation.direction != EventDirection.OUT) {
            "@KeelEvent '${function.name}' is OUT but handlers receive client events (use IN or BOTH)"
        }
        val values = function.parameters.filter { it.kind == KParameter.Kind.VALUE }
        require(values.size == 1) {
            "@KeelEvent '${function.name}' must take exactly one value parameter"
        }
        require(function.returnType.classifier == Unit::class) {
            "@KeelEvent '${function.name}' must return Unit"
        }
        val id = annotation.value.ifBlank { function.name }
        return DiscoveredEvent(
            id = id,
            direction = annotation.direction,
            payload = serializer(values.single().type),
            function = function,
            instance = instance,
        )
    }
}
