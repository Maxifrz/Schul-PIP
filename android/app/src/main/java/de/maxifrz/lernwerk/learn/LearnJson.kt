package de.maxifrz.lernwerk.learn

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Tolerant decoding of persisted JSON, the way the Swift types do it: a field that is missing, null or of the wrong
// type falls back on its default. A decoder returns the value, or null for a failure; any failure inside a field makes
// the whole field fall back, like a throwing Codable init.

typealias Decoder<T> = (JsonElement) -> T?

internal fun JsonElement.asObject(): JsonObject? = this as? JsonObject

/** Int: a JSON number without a fraction. */
val dInt: Decoder<Int> = { v ->
    if (v is JsonPrimitive && !v.isString && v !is JsonNull) {
        val l = v.content.toLongOrNull() ?: v.content.toDoubleOrNull()?.takeIf { it.isFinite() && it == Math.floor(it) && Math.abs(it) < 9.0e15 }?.toLong()
        if (l != null && l >= Int.MIN_VALUE && l <= Int.MAX_VALUE) l.toInt() else null
    } else null
}
val dDouble: Decoder<Double> = { v ->
    if (v is JsonPrimitive && !v.isString && v !is JsonNull) v.content.toDoubleOrNull()?.takeIf { it.isFinite() } else null
}
val dBool: Decoder<Boolean> = { v ->
    if (v is JsonPrimitive && !v.isString && v !is JsonNull) (if (v.content == "true") true else if (v.content == "false") false else null) else null
}
val dString: Decoder<String> = { v -> if (v is JsonPrimitive && v.isString) v.content else null }

fun <T : Any> dArray(element: Decoder<T>): Decoder<List<T>> = { v ->
    if (v is JsonArray) {
        val out = ArrayList<T>(v.size)
        var ok = true
        for (item in v) {
            val d = element(item)
            if (d == null) { ok = false; break }
            out.add(d)
        }
        if (ok) out else null
    } else null
}

/** A Set stored as an array; later duplicates (by `key`) are dropped. */
fun <T : Any> dSet(element: Decoder<T>, key: (T) -> String = { it.toString() }): Decoder<Set<T>> {
    val array = dArray(element)
    return { v ->
        val list = array(v)
        if (list == null) null else {
            val seen = HashSet<String>()
            val out = LinkedHashSet<T>()
            for (item in list) if (seen.add(key(item))) out.add(item)
            out
        }
    }
}

/** [String: T] (a JSON object). */
fun <T : Any> dRecord(element: Decoder<T>): Decoder<Map<String, T>> = { v ->
    if (v is JsonObject) {
        val out = LinkedHashMap<String, T>()
        var ok = true
        for ((k, item) in v) {
            val d = element(item)
            if (d == null) { ok = false; break }
            out[k] = d
        }
        if (ok) out else null
    } else null
}

fun <T : Enum<T>> dEnum(values: Array<T>, raw: (T) -> String): Decoder<T> = { v ->
    if (v is JsonPrimitive && v.isString) values.firstOrNull { raw(it) == v.content } else null
}

/** `value(key, fallback)` of the Swift initializers: the decoded field, or the fallback when absent, null or wrong. */
fun <T> JsonObject.field(key: String, decoder: Decoder<T & Any>, fallback: T): T {
    val raw = this[key]
    if (raw == null || raw is JsonNull) return fallback
    return decoder(raw) ?: fallback
}

/** A strict field of a synthesized Decodable: absent, null or invalid gives null. */
fun <T : Any> JsonObject.required(key: String, decoder: Decoder<T>): T? {
    val raw = this[key]
    if (raw == null || raw is JsonNull) return null
    return decoder(raw)
}

val dLearnDay: Decoder<LearnDay> = { v ->
    val o = v.asObject()
    val year = o?.required("year", dInt)
    val month = o?.required("month", dInt)
    val day = o?.required("day", dInt)
    if (year == null || month == null || day == null) null else LearnDay(year, month, day)
}

fun LearnDay.toJson(): JsonObject = buildJsonObject {
    put("year", year)
    put("month", month)
    put("day", day)
}

internal val learnJson = Json { ignoreUnknownKeys = true }

/** Parses text to a JsonElement, or null when it is broken. */
fun parseJsonOrNull(text: String?): JsonElement? {
    if (text == null) return null
    return try { learnJson.parseToJsonElement(text) } catch (e: Exception) { null }
}
