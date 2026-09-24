package de.maxifrz.lernwerk.llm

import kotlinx.serialization.json.Json

object ModelText {
    /** Some open models put their reasoning into the answer; only the part after it is meant for the student. */
    fun removingReasoning(text: String): String {
        val end = text.lastIndexOf("</think>")
        val result = if (end >= 0) text.substring(end + "</think>".length) else text
        return result.trim()
    }
}

/** Gets JSON out of any model: strict schemas where the API enforces them, tolerant parsing and one retry otherwise. */
object StructuredOutput {
    const val RETRY_INSTRUCTION =
        "Your last reply was not a valid JSON object for the schema. Reply again with only the JSON object and nothing else."

    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    fun extractJson(text: String): String {
        var candidate = ModelText.removingReasoning(text)
        val fenceStart = candidate.indexOf("```")
        if (fenceStart >= 0) {
            val afterFence = candidate.substring(fenceStart + 3)
            val newline = afterFence.indexOf('\n')
            val body = if (newline >= 0) afterFence.substring(newline + 1) else afterFence
            val fenceEnd = body.indexOf("```")
            if (fenceEnd >= 0) candidate = body.substring(0, fenceEnd)
        }
        val first = candidate.indexOf('{')
        val last = candidate.lastIndexOf('}')
        if (first in 0 until last) candidate = candidate.substring(first, last + 1)
        return candidate.trim()
    }

    fun <T> decode(text: String, parse: (String) -> T): T? =
        runCatching { parse(extractJson(text)) }.getOrNull()

    suspend fun <T> complete(
        request: LlmRequest,
        client: LlmClient,
        parse: (String) -> T,
        isValid: (T) -> Boolean = { true },
    ): T {
        val first = client.complete(request)
        decode(first.text, parse)?.takeIf(isValid)?.let { return it }

        val retry = request.copy(
            messages = request.messages +
                LlmMessage(LlmRole.ASSISTANT, listOf(LlmContent.Text(first.text))) +
                LlmMessage(LlmRole.USER, listOf(LlmContent.Text(RETRY_INSTRUCTION))),
        )
        val second = client.complete(retry)
        return decode(second.text, parse)?.takeIf(isValid) ?: throw LlmError.InvalidResponse
    }
}
