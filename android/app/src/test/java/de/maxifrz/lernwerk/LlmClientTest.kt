package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.llm.ClaudeClient
import de.maxifrz.lernwerk.llm.HttpResult
import de.maxifrz.lernwerk.llm.HttpTransport
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmEffort
import de.maxifrz.lernwerk.llm.LlmError
import de.maxifrz.lernwerk.llm.LlmMessage
import de.maxifrz.lernwerk.llm.LlmProvider
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.LlmRequest
import de.maxifrz.lernwerk.llm.LlmRole
import de.maxifrz.lernwerk.llm.OpenAiCompatibleClient
import de.maxifrz.lernwerk.tutor.Flashcard
import de.maxifrz.lernwerk.tutor.HintLevel
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.util.Base64

/** Replays canned HTTP replies and records the request bodies. */
class ScriptedTransport(private val replies: MutableList<HttpResult>) : HttpTransport {
    val bodies = mutableListOf<JsonObject>()
    val headers = mutableListOf<Map<String, String>>()

    override suspend fun post(url: String, headers: Map<String, String>, body: String, timeoutSeconds: Long): HttpResult {
        bodies += Json.parseToJsonElement(body).jsonObject
        this.headers += headers
        return replies.removeAt(0)
    }

    val requestedModels get() = bodies.map { it["model"]!!.jsonPrimitive.content }
}

private fun request(
    content: List<LlmContent>,
    schema: JsonObject? = null,
    purpose: LlmPurpose = LlmPurpose.Flashcard,
) = LlmRequest(
    purpose = purpose,
    system = "system",
    messages = listOf(LlmMessage(LlmRole.USER, content)),
    maxTokens = 500,
    effort = LlmEffort.LOW,
    jsonSchema = schema,
)

private fun JsonObject.messages() = this["messages"] as JsonArray

class OpenAiCompatibleClientTest {
    @Test
    fun systemPromptComesFirstAndCarriesTheSchema() {
        val body = OpenAiCompatibleClient.body(
            request(listOf(LlmContent.Text("Hallo")), Flashcard.schema),
            "moonshotai/kimi-k3",
            LlmProvider.NVIDIA,
            sendsImages = true,
        )
        assertEquals("moonshotai/kimi-k3", body["model"]!!.jsonPrimitive.content)
        assertEquals(500, body["max_tokens"]!!.jsonPrimitive.content.toInt())
        assertNull(body["response_format"])
        val system = body.messages()[0].jsonObject
        assertEquals("system", system["role"]!!.jsonPrimitive.content)
        val text = system["content"]!!.jsonPrimitive.content
        assertTrue(text.startsWith("system"))
        assertTrue(text.contains("<json_schema>"))
        assertTrue(text.contains("\"front\""))
    }

    @Test
    fun tutorAndFlashcardsSkipLongReasoningButThePlanKeepsIt() {
        val tutor = request(listOf(LlmContent.Text("x")), purpose = LlmPurpose.Tutor(HintLevel.QUESTION))
        val nim = OpenAiCompatibleClient.body(tutor, "m", LlmProvider.NVIDIA, false)
        val kwargs = nim["chat_template_kwargs"]!!.jsonObject
        assertFalse(kwargs["enable_thinking"]!!.jsonPrimitive.boolean)
        assertFalse(kwargs["thinking"]!!.jsonPrimitive.boolean)
        assertNull(nim["reasoning"])

        val openRouter = OpenAiCompatibleClient.body(tutor, "m", LlmProvider.OPEN_ROUTER, false)
        assertEquals("low", openRouter["reasoning"]!!.jsonObject["effort"]!!.jsonPrimitive.content)
        assertNull(openRouter["chat_template_kwargs"])

        val plan = tutor.copy(purpose = LlmPurpose.StudyPlan)
        assertNull(OpenAiCompatibleClient.body(plan, "m", LlmProvider.NVIDIA, false)["chat_template_kwargs"])
        assertNull(OpenAiCompatibleClient.body(plan, "m", LlmProvider.OPEN_ROUTER, false)["reasoning"])
    }

    @Test
    fun geminiUsesLowReasoningAndReadsArrayErrors() {
        val tutor = request(listOf(LlmContent.Text("x")), purpose = LlmPurpose.Tutor(HintLevel.QUESTION))
        val body = OpenAiCompatibleClient.body(tutor, "gemini-3.8-flash", LlmProvider.GOOGLE, true)
        assertEquals("low", body["reasoning_effort"]!!.jsonPrimitive.content)
        assertNull(body["chat_template_kwargs"])
        assertNull(body["reasoning"])
        val plan = tutor.copy(purpose = LlmPurpose.StudyPlan)
        assertNull(OpenAiCompatibleClient.body(plan, "m", LlmProvider.GOOGLE, true)["reasoning_effort"])

        try {
            OpenAiCompatibleClient.parse(
                """[{"error":{"code":429,"message":"Quota exceeded","status":"RESOURCE_EXHAUSTED"}}]""",
                429, expectsJson = false, sentImages = false,
            )
            fail("Expected an error")
        } catch (error: LlmError) {
            assertEquals(LlmError.RateLimited("Quota exceeded"), error)
        }
    }

    @Test
    fun timeoutsMatchWhatTheStudentWaitsFor() {
        assertEquals(75L, LlmPurpose.Tutor(HintLevel.HINT).timeoutSeconds)
        assertEquals(90L, LlmPurpose.Flashcard.timeoutSeconds)
        assertEquals(600L, LlmPurpose.StudyPlan.timeoutSeconds)
        assertTrue(LlmError.Timeout(75).message!!.contains("75 Sekunden"))
    }

    @Test
    fun overloadedModelFallsBackToTheNextOne() = runTest {
        val transport = ScriptedTransport(
            mutableListOf(
                HttpResult(504, """{"error":{"message":"Gateway Timeout","code":504}}"""),
                HttpResult(200, """{"choices":[{"message":{"content":"Welche Funktion ist innen?"},"finish_reason":"stop"}]}"""),
            ),
        )
        val client = OpenAiCompatibleClient(
            LlmProvider.NVIDIA, "k", "z-ai/glm-5.3-flash", false, transport,
            fallbackModels = listOf("google/gemma-4-31b-it"),
        )
        val response = client.complete(request(listOf(LlmContent.Text("x")), purpose = LlmPurpose.Tutor(HintLevel.QUESTION)))

        assertEquals("Welche Funktion ist innen?", response.text)
        assertEquals("google/gemma-4-31b-it", response.model)
        assertEquals(listOf("z-ai/glm-5.3-flash", "google/gemma-4-31b-it"), transport.requestedModels)
        assertEquals("Bearer k", transport.headers[0]["authorization"])
    }

    @Test
    fun fallbackGivesUpWithAClearError() = runTest {
        val transport = ScriptedTransport(mutableListOf(HttpResult(504, "{}"), HttpResult(503, "{}")))
        val client = OpenAiCompatibleClient(LlmProvider.NVIDIA, "k", "a", false, transport, listOf("b"))
        try {
            client.complete(request(listOf(LlmContent.Text("x")), purpose = LlmPurpose.Tutor(HintLevel.HINT)))
            fail("Expected an error")
        } catch (error: LlmError) {
            assertEquals(LlmError.Overloaded(503), error)
        }
    }

    @Test
    fun thinkingSwitchIsDroppedWhenTheTemplateRejectsIt() = runTest {
        val transport = ScriptedTransport(
            mutableListOf(
                HttpResult(400, """{"detail":"unknown kwarg"}"""),
                HttpResult(200, """{"choices":[{"message":{"content":"ok"},"finish_reason":"stop"}]}"""),
            ),
        )
        val client = OpenAiCompatibleClient(LlmProvider.NVIDIA, "k", "m", false, transport)
        client.complete(request(listOf(LlmContent.Text("x")), purpose = LlmPurpose.Tutor(HintLevel.HINT)))
        assertTrue(transport.bodies[0].containsKey("chat_template_kwargs"))
        assertFalse(transport.bodies[1].containsKey("chat_template_kwargs"))
    }

    @Test
    fun requestErrorsDoNotTriggerAFallback() {
        assertFalse(LlmError.InvalidApiKey.isModelUnavailable)
        assertFalse(LlmError.RateLimited("x").isModelUnavailable)
        assertTrue(LlmError.Overloaded(504).isModelUnavailable)
        assertTrue(LlmError.Timeout(75).isModelUnavailable)
        assertTrue(LlmError.Http(404, "model not found").isModelUnavailable)
    }

    @Test
    fun textOnlyUserMessageIsAPlainString() {
        val body = OpenAiCompatibleClient.body(
            request(listOf(LlmContent.Text("a"), LlmContent.Text("b"))), "m", LlmProvider.NVIDIA, true,
        )
        assertEquals("a\n\nb", body.messages()[1].jsonObject["content"]!!.jsonPrimitive.content)
    }

    @Test
    fun imagesBecomeDataUrlsOrAreDropped() {
        val content = listOf(LlmContent.Image(byteArrayOf(1, 2, 3)), LlmContent.Text("x"))
        val body = OpenAiCompatibleClient.body(request(content), "m", LlmProvider.OPEN_ROUTER, true)
        val parts = body.messages()[1].jsonObject["content"] as JsonArray
        assertEquals(2, parts.size)
        assertEquals("image_url", parts[0].jsonObject["type"]!!.jsonPrimitive.content)
        assertEquals(
            "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3)),
            parts[0].jsonObject["image_url"]!!.jsonObject["url"]!!.jsonPrimitive.content,
        )

        val withoutImages = OpenAiCompatibleClient.body(request(content), "m", LlmProvider.OPEN_ROUTER, false)
        assertEquals("x", withoutImages.messages()[1].jsonObject["content"]!!.jsonPrimitive.content)
    }

    @Test
    fun nvidiaImagesAreCompressed() {
        var limit = 0
        OpenAiCompatibleClient.body(
            request(listOf(LlmContent.Image(byteArrayOf(1)))), "m", LlmProvider.NVIDIA, true,
        ) { data, max -> limit = max; data }
        assertEquals(180_000, limit)
    }

    @Test
    fun openRouterPdfsUseTheOcrPlugin() {
        val body = OpenAiCompatibleClient.body(
            request(listOf(LlmContent.Pdf(byteArrayOf(9)), LlmContent.Text("x")), purpose = LlmPurpose.StudyPlan),
            "m", LlmProvider.OPEN_ROUTER, false,
        )
        val plugin = (body["plugins"] as JsonArray)[0].jsonObject
        assertEquals("file-parser", plugin["id"]!!.jsonPrimitive.content)
        assertEquals("mistral-ocr", plugin["pdf"]!!.jsonObject["engine"]!!.jsonPrimitive.content)
        val file = (body.messages()[1].jsonObject["content"] as JsonArray)[0].jsonObject
        assertEquals("file", file["type"]!!.jsonPrimitive.content)
    }

    @Test
    fun errorsMapToClearMessages() {
        fun failure(status: Int, body: String, images: Boolean = false): LlmError = try {
            OpenAiCompatibleClient.parse(body, status, expectsJson = false, sentImages = images)
            throw AssertionError("no error")
        } catch (e: LlmError) {
            e
        }
        assertEquals(LlmError.InvalidApiKey, failure(401, "{}"))
        assertTrue(failure(402, """{"error":{"message":"credits","code":402}}""") is LlmError.PaymentRequired)
        assertTrue(failure(429, """{"error":{"message":"slow down"}}""") is LlmError.RateLimited)
        // OpenRouter reports provider errors with status 200 and an error object.
        assertTrue(failure(200, """{"error":{"message":"busy","code":503}}""") is LlmError.Overloaded)
        assertTrue(failure(400, """{"detail":"bad image"}""", images = true).message!!.contains("Bilder mitschicken"))
        assertEquals(
            LlmError.Refusal,
            failure(200, """{"choices":[{"message":{"content":""},"finish_reason":"content_filter"}]}"""),
        )
    }

    @Test
    fun reasoningIsStrippedAndTruncationDetected() {
        val response = OpenAiCompatibleClient.parse(
            """{"model":"x","choices":[{"message":{"content":"<think>hm</think>\nAntwort"},"finish_reason":"stop"}]}""",
            200, expectsJson = false, sentImages = false,
        )
        assertEquals("Antwort", response.text)
        assertEquals("x", response.model)

        try {
            OpenAiCompatibleClient.parse(
                """{"choices":[{"message":{"content":"{\"front\":"},"finish_reason":"length"}]}""",
                200, expectsJson = true, sentImages = false,
            )
            fail("Expected truncation")
        } catch (error: LlmError) {
            assertEquals(LlmError.Truncated, error)
        }
    }

    @Test
    fun contentPartsAreJoined() {
        val response = OpenAiCompatibleClient.parse(
            """{"choices":[{"message":{"content":[{"type":"text","text":"a"},{"type":"text","text":"b"}]},"finish_reason":"stop"}]}""",
            200, expectsJson = false, sentImages = false,
        )
        assertEquals("ab", response.text)
    }
}

class ClaudeClientTest {
    @Test
    fun bodyUsesSchemaEffortAndFallbacks() {
        val body = ClaudeClient.body(request(listOf(LlmContent.Text("x")), Flashcard.schema), "claude-opus-5")
        val config = body["output_config"]!!.jsonObject
        assertEquals("low", config["effort"]!!.jsonPrimitive.content)
        assertEquals("json_schema", config["format"]!!.jsonObject["type"]!!.jsonPrimitive.content)
        assertEquals("default", body["fallbacks"]!!.jsonPrimitive.content)
        assertEquals("system", body["system"]!!.jsonPrimitive.content)

        val haiku = ClaudeClient.body(request(listOf(LlmContent.Text("x"))), "claude-haiku-4-5")
        assertNull(haiku["output_config"])
        assertNull(haiku["fallbacks"])
    }

    @Test
    fun pdfsAndImagesAreBase64Blocks() {
        val pdf = ClaudeClient.encodeContent(LlmContent.Pdf(byteArrayOf(1)))
        assertEquals("document", pdf["type"]!!.jsonPrimitive.content)
        assertEquals("application/pdf", pdf["source"]!!.jsonObject["media_type"]!!.jsonPrimitive.content)
        val image = ClaudeClient.encodeContent(LlmContent.Image(byteArrayOf(1)))
        assertEquals("image/jpeg", image["source"]!!.jsonObject["media_type"]!!.jsonPrimitive.content)
    }

    @Test
    fun parseHandlesTextRefusalAndTruncation() {
        val ok = ClaudeClient.parse(
            """{"model":"claude-opus-5","stop_reason":"end_turn","content":[{"type":"text","text":"Hallo"}]}""",
            200, expectsJson = false,
        )
        assertEquals("Hallo", ok.text)
        assertEquals("claude-opus-5", ok.model)

        fun failure(body: String, status: Int = 200, json: Boolean = false): LlmError = try {
            ClaudeClient.parse(body, status, json)
            throw AssertionError("no error")
        } catch (e: LlmError) {
            e
        }
        assertEquals(LlmError.Refusal, failure("""{"stop_reason":"refusal","content":[]}"""))
        assertEquals(
            LlmError.Truncated,
            failure("""{"stop_reason":"max_tokens","content":[{"type":"text","text":"{"}]}""", json = true),
        )
        assertEquals(
            LlmError.Http(400, "bad"),
            failure("""{"error":{"message":"bad"}}""", status = 400),
        )
    }

    @Test
    fun clientSendsVersionAndBetaHeaders() = runTest {
        val transport = ScriptedTransport(
            mutableListOf(HttpResult(200, """{"content":[{"type":"text","text":"ok"}],"stop_reason":"end_turn"}""")),
        )
        ClaudeClient("key", "claude-opus-5", transport).complete(request(listOf(LlmContent.Text("x"))))
        assertEquals("key", transport.headers[0]["x-api-key"])
        assertEquals(ClaudeClient.API_VERSION, transport.headers[0]["anthropic-version"])
        assertEquals(ClaudeClient.FALLBACK_BETA, transport.headers[0]["anthropic-beta"])
        assertTrue(transport.bodies[0]["messages"] is JsonArray)
        assertTrue((transport.bodies[0]["max_tokens"] as JsonPrimitive).content == "500")
    }
}
