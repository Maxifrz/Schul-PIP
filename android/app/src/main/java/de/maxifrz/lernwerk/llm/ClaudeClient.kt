package de.maxifrz.lernwerk.llm

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import java.util.Base64

/** Calls the Claude Messages API over plain HTTP. */
class ClaudeClient(
    private val apiKey: String,
    private val model: String,
    private val transport: HttpTransport,
) : LlmClient {
    override val capabilities = LlmCapabilities(acceptsImages = true, documentHandling = DocumentHandling.NATIVE_PDF)

    override suspend fun complete(request: LlmRequest): LlmResponse {
        val headers = buildMap {
            put("content-type", "application/json")
            put("x-api-key", apiKey)
            put("anthropic-version", API_VERSION)
            if (supportsFallbacks(model)) put("anthropic-beta", FALLBACK_BETA)
        }
        val result = transport.post(ENDPOINT, headers, body(request, model).toString(), request.purpose.timeoutSeconds)
        return parse(result.body, result.status, expectsJson = request.jsonSchema != null)
    }

    companion object {
        const val ENDPOINT = "https://api.anthropic.com/v1/messages"
        const val API_VERSION = "2023-06-01"
        const val FALLBACK_BETA = "server-side-fallback-2026-07-01"

        fun body(request: LlmRequest, model: String): JsonObject = buildJsonObject {
            put("model", model)
            put("max_tokens", request.maxTokens)
            put("system", request.system)
            put("messages", JsonArray(request.messages.map(::encodeMessage)))

            val outputConfig = buildJsonObject {
                if (request.effort != null && supportsEffort(model)) put("effort", request.effort.wire)
                request.jsonSchema?.let { schema ->
                    put("format", buildJsonObject {
                        put("type", "json_schema")
                        put("schema", schema)
                    })
                }
            }
            if (outputConfig.isNotEmpty()) put("output_config", outputConfig)
            if (supportsFallbacks(model)) put("fallbacks", "default")
        }

        fun encodeMessage(message: LlmMessage): JsonObject = buildJsonObject {
            put("role", message.role.wire)
            put("content", JsonArray(message.content.map(::encodeContent)))
        }

        fun encodeContent(content: LlmContent): JsonObject = when (content) {
            is LlmContent.Text -> buildJsonObject {
                put("type", "text")
                put("text", content.text)
            }
            is LlmContent.Image -> buildJsonObject {
                put("type", "image")
                put("source", base64Source("image/jpeg", content.jpeg))
            }
            is LlmContent.Pdf -> buildJsonObject {
                put("type", "document")
                put("source", base64Source("application/pdf", content.data))
            }
        }

        private fun base64Source(mediaType: String, data: ByteArray) = buildJsonObject {
            put("type", "base64")
            put("media_type", mediaType)
            put("data", Base64.getEncoder().encodeToString(data))
        }

        fun supportsFallbacks(model: String) = model == "claude-opus-5" || model == "claude-fable-5-1"

        fun supportsEffort(model: String) =
            model.startsWith("claude-opus") || model.startsWith("claude-sonnet-5") || model.startsWith("claude-fable")

        fun parse(body: String, status: Int, expectsJson: Boolean): LlmResponse {
            val obj = parseObject(body)
            if (status !in 200..299) {
                val message = obj?.obj("error")?.string("message") ?: body
                throw LlmError.Http(status, message)
            }
            val blocks = (obj?.get("content") as? JsonArray) ?: throw LlmError.InvalidResponse

            val stopReason = obj.string("stop_reason")
            if (stopReason == "refusal") throw LlmError.Refusal

            val text = blocks.mapNotNull { it as? JsonObject }
                .filter { it.string("type") == "text" }
                .mapNotNull { it.string("text") }
                .joinToString("")

            if (stopReason == "max_tokens" && (expectsJson || text.isEmpty())) throw LlmError.Truncated
            if (text.isEmpty()) throw LlmError.InvalidResponse
            return LlmResponse(text, stopReason, obj.string("model"))
        }
    }
}

internal fun parseObject(body: String): JsonObject? =
    runCatching { Json.parseToJsonElement(body).jsonObject }.getOrNull()

internal fun JsonObject.string(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

internal fun JsonObject.obj(key: String): JsonObject? = this[key] as? JsonObject

internal fun JsonElement?.intOrNull(): Int? = (this as? JsonPrimitive)?.contentOrNull?.toDoubleOrNull()?.toInt()
