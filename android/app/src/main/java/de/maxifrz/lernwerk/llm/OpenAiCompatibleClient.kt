package de.maxifrz.lernwerk.llm

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.Base64

/** Chat Completions client for OpenRouter and NVIDIA NIM, which both speak the OpenAI wire format. */
class OpenAiCompatibleClient(
    private val provider: LlmProvider,
    private val apiKey: String,
    private val model: String,
    private val sendsImages: Boolean,
    private val transport: HttpTransport,
    /** Tried in order when the chosen model is overloaded, times out or no longer exists. */
    private val fallbackModels: List<String> = emptyList(),
    /** Shrinks a JPEG below the given size; the Android implementation lives outside the pure logic. */
    private val compressImage: (ByteArray, Int) -> ByteArray = { data, _ -> data },
) : LlmClient {
    override val capabilities = LlmCapabilities(
        acceptsImages = sendsImages,
        documentHandling = if (provider == LlmProvider.OPEN_ROUTER) DocumentHandling.PROVIDER_OCR else DocumentHandling.TEXT_ONLY,
    )

    override suspend fun complete(request: LlmRequest): LlmResponse {
        var lastError: LlmError = LlmError.InvalidResponse
        for (candidate in listOf(model) + fallbackModels.filter { it != model }) {
            try {
                val response = complete(request, candidate)
                return response.copy(model = response.model ?: candidate)
            } catch (error: LlmError) {
                if (!error.isModelUnavailable) throw error
                lastError = error
            }
        }
        throw lastError
    }

    private suspend fun complete(request: LlmRequest, model: String): LlmResponse {
        val url = provider.chatCompletionsUrl ?: throw LlmError.InvalidResponse
        val headers = buildMap {
            put("content-type", "application/json")
            put("authorization", "Bearer $apiKey")
            if (provider == LlmProvider.OPEN_ROUTER) put("X-Title", "Lernwerk")
        }
        val timeout = request.purpose.timeoutSeconds
        var body = body(request, model, provider, sendsImages, compressImage)
        var result = transport.post(url, headers, body.toString(), timeout)

        // Not every NIM model's chat template knows the thinking switch; retry once without it.
        if ((result.status == 400 || result.status == 422) && body.containsKey("chat_template_kwargs")) {
            body = JsonObject(body - "chat_template_kwargs")
            result = transport.post(url, headers, body.toString(), timeout)
        }

        return parse(
            result.body,
            result.status,
            expectsJson = request.jsonSchema != null,
            sentImages = containsImages(request, sendsImages),
        )
    }

    companion object {
        const val OCR_ENGINE = "mistral-ocr"
        const val IMAGE_HINT = " – Falls das Modell keine Bilder versteht: In den Einstellungen „Bilder mitschicken“ ausschalten."

        fun body(
            request: LlmRequest,
            model: String,
            provider: LlmProvider,
            sendsImages: Boolean,
            compressImage: (ByteArray, Int) -> ByteArray = { data, _ -> data },
        ): JsonObject = buildJsonObject {
            put("model", model)
            put("max_tokens", request.maxTokens)
            put("messages", buildJsonArray {
                add(buildJsonObject {
                    put("role", "system")
                    put("content", systemPrompt(request))
                })
                request.messages.forEach { add(encodeMessage(it, provider, sendsImages, compressImage)) }
            })
            if (wantsFastAnswer(request)) {
                when (provider) {
                    // GLM/Qwen templates read enable_thinking, Kimi reads thinking; unknown keys are ignored.
                    LlmProvider.NVIDIA -> put("chat_template_kwargs", buildJsonObject {
                        put("enable_thinking", false)
                        put("thinking", false)
                    })
                    LlmProvider.OPEN_ROUTER -> put("reasoning", buildJsonObject { put("effort", "low") })
                    // Gemini 3 cannot switch thinking off; "low" is the shortest it allows.
                    LlmProvider.GOOGLE -> put("reasoning_effort", "low")
                    LlmProvider.ANTHROPIC -> Unit
                }
            }
            val hasPdf = request.messages.any { message -> message.content.any { it is LlmContent.Pdf } }
            if (hasPdf && provider == LlmProvider.OPEN_ROUTER) {
                put("plugins", buildJsonArray {
                    add(buildJsonObject {
                        put("id", "file-parser")
                        put("pdf", buildJsonObject { put("engine", OCR_ENGINE) })
                    })
                })
            }
        }

        /** All suggested models reason before answering, which takes minutes on free tiers; only the study plan needs that depth. */
        fun wantsFastAnswer(request: LlmRequest) = !request.purpose.needsDepth

        /** Not every hosted model enforces JSON schemas (OpenRouter rejects the request instead), so the schema goes into the prompt. */
        fun systemPrompt(request: LlmRequest): String {
            val schema = request.jsonSchema ?: return request.system
            return listOf(
                request.system,
                "",
                "Output format: reply with exactly one JSON object that validates against this JSON schema. " +
                    "Output only the JSON object, without code fences or explanations.",
                "<json_schema>",
                schema.toString(),
                "</json_schema>",
            ).joinToString("\n")
        }

        fun encodeMessage(
            message: LlmMessage,
            provider: LlmProvider,
            sendsImages: Boolean,
            compressImage: (ByteArray, Int) -> ByteArray = { data, _ -> data },
        ): JsonObject {
            val parts = message.content.mapNotNull { encodeContent(it, provider, sendsImages, compressImage) }
            val isTextOnly = parts.all { it.string("type") == "text" }
            return buildJsonObject {
                put("role", message.role.wire)
                if (message.role == LlmRole.ASSISTANT || isTextOnly) {
                    put("content", parts.mapNotNull { it.string("text") }.joinToString("\n\n"))
                } else {
                    put("content", JsonArray(parts))
                }
            }
        }

        fun encodeContent(
            content: LlmContent,
            provider: LlmProvider,
            sendsImages: Boolean,
            compressImage: (ByteArray, Int) -> ByteArray = { data, _ -> data },
        ): JsonObject? = when (content) {
            is LlmContent.Text -> buildJsonObject {
                put("type", "text")
                put("text", content.text)
            }
            is LlmContent.Image -> if (!sendsImages) null else {
                val data = provider.maxImageBytes?.let { compressImage(content.jpeg, it) } ?: content.jpeg
                buildJsonObject {
                    put("type", "image_url")
                    put("image_url", buildJsonObject {
                        put("url", "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(data))
                    })
                }
            }
            is LlmContent.Pdf -> buildJsonObject {
                put("type", "file")
                put("file", buildJsonObject {
                    put("filename", "material.pdf")
                    put("file_data", "data:application/pdf;base64," + Base64.getEncoder().encodeToString(content.data))
                })
            }
        }

        fun containsImages(request: LlmRequest, sendsImages: Boolean) =
            sendsImages && request.messages.any { message -> message.content.any { it is LlmContent.Image } }

        fun parse(body: String, status: Int, expectsJson: Boolean, sentImages: Boolean): LlmResponse {
            // Gemini's compatibility endpoint wraps errors in a one-element array.
            val obj = parseObject(body) ?: runCatching {
                (kotlinx.serialization.json.Json.parseToJsonElement(body) as? JsonArray)?.firstOrNull() as? JsonObject
            }.getOrNull()
            val apiError = obj?.obj("error")

            if (status !in 200..299 || apiError != null) {
                val code = apiError?.get("code").intOrNull() ?: status
                val message = apiError?.string("message") ?: obj?.string("detail") ?: obj?.string("title") ?: body
                throw when {
                    code == 401 || code == 403 -> LlmError.InvalidApiKey
                    code == 402 -> LlmError.PaymentRequired(message)
                    code == 429 -> LlmError.RateLimited(message)
                    code == 502 || code == 503 || code == 504 -> LlmError.Overloaded(code)
                    (code == 400 || code == 422) && sentImages -> LlmError.Http(code, message + IMAGE_HINT)
                    else -> LlmError.Http(code, message)
                }
            }

            val choice = (obj?.get("choices") as? JsonArray)?.firstOrNull() as? JsonObject
                ?: throw LlmError.InvalidResponse

            val finishReason = choice.string("finish_reason")
            if (finishReason == "content_filter") throw LlmError.Refusal

            val text = ModelText.removingReasoning(contentText(choice.obj("message")?.get("content")))
            if (finishReason == "length" && (expectsJson || text.isEmpty())) throw LlmError.Truncated
            if (text.isEmpty()) throw LlmError.InvalidResponse
            return LlmResponse(text, finishReason, obj.string("model"))
        }

        private fun contentText(content: kotlinx.serialization.json.JsonElement?): String = when (content) {
            is JsonPrimitive -> if (content.isString) content.content else ""
            is JsonArray -> content.mapNotNull { (it as? JsonObject)?.string("text") }.joinToString("")
            else -> ""
        }
    }
}
