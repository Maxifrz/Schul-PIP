package de.maxifrz.lernwerk

import de.maxifrz.lernwerk.llm.DocumentHandling
import de.maxifrz.lernwerk.llm.LlmCapabilities
import de.maxifrz.lernwerk.llm.LlmClient
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmError
import de.maxifrz.lernwerk.llm.LlmMessage
import de.maxifrz.lernwerk.llm.LlmProvider
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.LlmRequest
import de.maxifrz.lernwerk.llm.LlmResponse
import de.maxifrz.lernwerk.llm.LlmRole
import de.maxifrz.lernwerk.llm.LlmTask
import de.maxifrz.lernwerk.llm.ModelSelection
import de.maxifrz.lernwerk.llm.StructuredOutput
import de.maxifrz.lernwerk.plan.MaterialDocument
import de.maxifrz.lernwerk.plan.PdfMaterialText
import de.maxifrz.lernwerk.plan.PlanGenerator
import de.maxifrz.lernwerk.plan.PlanScheduler
import de.maxifrz.lernwerk.plan.TopicDraft
import de.maxifrz.lernwerk.review.ReviewGrade
import de.maxifrz.lernwerk.review.SchedulingState
import de.maxifrz.lernwerk.review.SpacedRepetition
import de.maxifrz.lernwerk.tutor.DemoLlmClient
import de.maxifrz.lernwerk.tutor.HintLevel
import de.maxifrz.lernwerk.tutor.TutorContext
import de.maxifrz.lernwerk.tutor.TutorPrompt
import de.maxifrz.lernwerk.tutor.TutorSession
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/** Returns canned replies and records every request. */
class ScriptedClient(
    private val replies: MutableList<String>,
    override val capabilities: LlmCapabilities = LlmCapabilities(true, DocumentHandling.TEXT_ONLY),
) : LlmClient {
    val requests = mutableListOf<LlmRequest>()
    override suspend fun complete(request: LlmRequest): LlmResponse {
        requests += request
        return LlmResponse(replies.removeAt(0), "stop", "m")
    }
}

class StructuredOutputTest {
    @Test
    fun extractsJsonFromFencesAndReasoning() {
        assertEquals("{\"a\":1}", StructuredOutput.extractJson("<think>{no}</think>\n```json\n{\"a\":1}\n```"))
        assertEquals("{\"a\":1}", StructuredOutput.extractJson("Hier: {\"a\":1} fertig"))
    }

    @Test
    fun retriesOnceWithTheInvalidAnswerInContext() = runTest {
        val client = ScriptedClient(mutableListOf("kein json", """{"topics":[{"title":"A"}]}"""))
        val request = LlmRequest(LlmPurpose.StudyPlan, "s", listOf(LlmMessage(LlmRole.USER, listOf(LlmContent.Text("x")))), 100)
        val topics = StructuredOutput.complete(request, client, TopicDraft::parseResponse) { it.isNotEmpty() }
        assertEquals("A", topics.single().title)
        val retry = client.requests[1].messages
        assertEquals(3, retry.size)
        assertEquals(StructuredOutput.RETRY_INSTRUCTION, (retry[2].content[0] as LlmContent.Text).text)
    }

    @Test
    fun givesUpAfterTheRetry() = runTest {
        val client = ScriptedClient(mutableListOf("nope", "still nope"))
        val request = LlmRequest(LlmPurpose.StudyPlan, "s", emptyList(), 100)
        try {
            StructuredOutput.complete(request, client, TopicDraft::parseResponse)
            fail("Expected an error")
        } catch (error: LlmError) {
            assertEquals(LlmError.InvalidResponse, error)
        }
    }

    @Test
    fun topicDraftsAreDecodedLeniently() {
        val drafts = TopicDraft.parseResponse(
            """{"topics":[{"title":"A","materialIndex":"1","sourcePages":["2","x",3],"estimatedMinutes":25.0},{"summary":"no title"}]}""",
        )
        assertEquals(1, drafts.size)
        assertEquals(TopicDraft("A", "", emptyList(), 1, listOf(2, 3), 25), drafts[0])
    }
}

class PlanSchedulerTest {
    private fun draft(title: String, minutes: Int = 30, vararg prerequisites: String) =
        TopicDraft(title, prerequisites = prerequisites.toList(), estimatedMinutes = minutes)

    @Test
    fun prerequisitesComeFirst() {
        val ordered = PlanScheduler.order(listOf(draft("C", 30, "B"), draft("B", 30, "a"), draft("A")))
        assertEquals(listOf("A", "B", "C"), ordered.map { it.title })
    }

    @Test
    fun cyclesAreBroken() {
        val ordered = PlanScheduler.order(listOf(draft("A", 30, "B"), draft("B", 30, "A")))
        assertEquals(listOf("A", "B"), ordered.map { it.title })
    }

    @Test
    fun daysArePackedByCapacity() {
        val start = LocalDate.of(2026, 10, 1)
        val dates = PlanScheduler.assignDates(listOf(20, 20, 30, 90), start, 45)
        assertEquals(listOf(start, start, start.plusDays(1), start.plusDays(2)), dates)
    }

    @Test
    fun overbookingIsDetected() {
        val start = LocalDate.of(2026, 10, 1)
        val drafts = listOf(draft("A", 60), draft("B", 60), draft("C", 60))
        assertFalse(PlanScheduler.schedule(drafts, start, start.plusDays(5), 60).isOverbooked)
        assertTrue(PlanScheduler.schedule(drafts, start, start.plusDays(2), 60).isOverbooked)
    }
}

class PlanContentTest {
    private class FakeDocument(
        override val pageTexts: List<String>,
        private val ocr: Map<Int, String> = emptyMap(),
    ) : MaterialDocument {
        override suspend fun recognizeText(pageNumber: Int) = ocr[pageNumber] ?: ""
        override suspend fun pageImage(pageNumber: Int) = byteArrayOf(pageNumber.toByte())
    }

    private val text = "Die Kettenregel: äußere mal innere Ableitung."

    @Test
    fun claudeGetsThePdfItself() = runTest {
        val content = PlanGenerator.content(
            listOf(PlanGenerator.Input("A", byteArrayOf(1, 2))),
            LlmCapabilities(true, DocumentHandling.NATIVE_PDF),
        ) { error("must not open") }
        assertTrue(content[1] is LlmContent.Pdf)
        assertEquals(PlanGenerator.INSTRUCTIONS, (content.last() as LlmContent.Text).text)
    }

    @Test
    fun textLayerIsLabeledWithPages() = runTest {
        val content = PlanGenerator.content(
            listOf(PlanGenerator.Input("A", byteArrayOf(1))),
            LlmCapabilities(false, DocumentHandling.TEXT_ONLY),
        ) { FakeDocument(listOf(text, text)) }
        val labeled = (content[0] as LlmContent.Text).text
        assertTrue(labeled.startsWith("=== Material 0: A ==="))
        assertTrue(labeled.contains("--- Page 2 ---"))
    }

    @Test
    fun scannedPagesUseOcrThenImages() = runTest {
        val content = PlanGenerator.content(
            listOf(PlanGenerator.Input("A", byteArrayOf(1))),
            LlmCapabilities(true, DocumentHandling.TEXT_ONLY),
        ) { FakeDocument(listOf("", "", text), ocr = mapOf(1 to text)) }
        val labeled = (content[0] as LlmContent.Text).text
        assertTrue(labeled.contains("--- Page 1 (recognized from scan, may contain OCR errors) ---"))
        assertEquals(1, content.count { it is LlmContent.Image })
        assertEquals("Material 0, page 2 (scanned):", (content[1] as LlmContent.Text).text)
    }

    @Test
    fun openRouterGetsScansAsPdf() = runTest {
        val content = PlanGenerator.content(
            listOf(PlanGenerator.Input("A", byteArrayOf(1))),
            LlmCapabilities(true, DocumentHandling.PROVIDER_OCR),
        ) { FakeDocument(listOf("")) }
        assertTrue(content[1] is LlmContent.Pdf)
    }

    @Test
    fun textOnlyModelCannotReadScans() = runTest {
        try {
            PlanGenerator.content(
                listOf(PlanGenerator.Input("Scan", byteArrayOf(1))),
                LlmCapabilities(false, DocumentHandling.TEXT_ONLY),
            ) { FakeDocument(listOf("", "")) }
            fail("Expected an error")
        } catch (error: LlmError) {
            assertEquals(LlmError.ScannedPdf("Scan", 2), error)
        }
    }

    @Test
    fun unreadablePdfIsReported() = runTest {
        try {
            PlanGenerator.content(
                listOf(PlanGenerator.Input("Kaputt", byteArrayOf(1))),
                LlmCapabilities(false, DocumentHandling.TEXT_ONLY),
            ) { null }
            fail("Expected an error")
        } catch (error: LlmError) {
            assertEquals(LlmError.UnreadablePdf("Kaputt"), error)
        }
    }

    @Test
    fun scannedPageDetection() {
        assertEquals(listOf(2), PdfMaterialText.scannedPages(listOf(text, "  ")))
    }

    @Test
    fun demoPlanDecodes() = runTest {
        val drafts = PlanGenerator(DemoLlmClient(0)) { null }
            .generate(listOf(PlanGenerator.Input("Demo", byteArrayOf(1))))
        assertEquals(3, drafts.size)
        assertEquals(listOf("Kettenregel anwenden"), drafts[2].prerequisites)
    }
}

class SpacedRepetitionTest {
    @Test
    fun intervalsFollowSm2() {
        var state = SchedulingState.NEW
        state = SpacedRepetition.next(state, ReviewGrade.GOOD)
        assertEquals(1, state.intervalDays)
        state = SpacedRepetition.next(state, ReviewGrade.GOOD)
        assertEquals(6, state.intervalDays)
        state = SpacedRepetition.next(state, ReviewGrade.EASY)
        assertEquals(16, state.intervalDays)
        assertEquals(2.6, state.easeFactor, 1e-9)
    }

    @Test
    fun againResetsAndComesBackSoon() {
        val learned = SchedulingState(intervalDays = 6, easeFactor = 2.5, repetitions = 2, lapses = 0)
        val state = SpacedRepetition.next(learned, ReviewGrade.AGAIN)
        assertEquals(0, state.intervalDays)
        assertEquals(0, state.repetitions)
        assertEquals(1, state.lapses)
        assertEquals(1.7, state.easeFactor, 1e-9)
        val now = Instant.parse("2026-10-01T12:00:00Z")
        assertEquals(now.plusSeconds(600), SpacedRepetition.dueDate(state, now, ZoneOffset.UTC))
    }

    @Test
    fun easeNeverDropsBelowMinimum() {
        var state = SchedulingState.NEW
        repeat(10) { state = SpacedRepetition.next(state, ReviewGrade.AGAIN) }
        assertEquals(SchedulingState.MINIMUM_EASE, state.easeFactor, 1e-9)
    }

    @Test
    fun dueDateIsStartOfDay() {
        val now = Instant.parse("2026-10-01T15:30:00Z")
        val due = SpacedRepetition.dueDate(SchedulingState(intervalDays = 6), now, ZoneOffset.UTC)
        assertEquals(Instant.parse("2026-10-07T00:00:00Z"), due)
    }
}

class TutorTest {
    private val context = TutorContext(
        materialTitle = "Analysis",
        pageNumber = 3,
        selectedText = "f(x) = (2x − 7)³",
        pageText = "x".repeat(7000),
        topicTitle = "Kettenregel",
        topicSummary = "ableiten",
        weakSpots = listOf("Produktregel"),
    )

    @Test
    fun contextBlockContainsEverything() {
        val block = TutorPrompt.contextBlock(context.copy(recognizedText = "f(x) = (2x - 7)3"))
        assertTrue(block.contains("<material title=\"Analysis\" page=\"3\"/>"))
        assertTrue(block.contains("<marked_text>\nf(x) = (2x − 7)³\n</marked_text>"))
        assertTrue(block.contains("<recognized_text source=\"on-device OCR\">"))
        assertTrue(block.contains("[...]"))
        assertTrue(block.contains("<study_topic>Kettenregel - ableiten</study_topic>"))
        assertTrue(block.contains("- Produktregel"))
    }

    @Test
    fun missingTextFallsBackToImageOrAsking() {
        val empty = context.copy(selectedText = "")
        assertTrue(TutorPrompt.contextBlock(empty, hasImage = true).contains("read the marked region from the image"))
        assertTrue(TutorPrompt.contextBlock(empty, hasImage = false).contains("ask the student to type out"))
    }

    @Test
    fun hintLadderClimbs() {
        assertEquals(HintLevel.HINT, HintLevel.QUESTION.next)
        assertNull(HintLevel.EXPLANATION.next)
        assertEquals("[help level 2: hint]\nhi", TutorPrompt.studentTurn("hi", HintLevel.HINT))
    }

    @Test
    fun sessionRunsTheLadderWithOcrAndImage() = runTest {
        val client = ScriptedClient(mutableListOf("Frage?", "Hinweis.", "Erklärung."))
        val session = TutorSession(context.copy(selectedText = ""), byteArrayOf(1), client, recognizeText = { "OCR" })
        session.start()
        session.requestMoreHelp()
        session.revealExplanation()

        val first = client.requests[0].messages[0].content
        assertTrue(first[0] is LlmContent.Image)
        assertTrue((first[1] as LlmContent.Text).text.contains("<recognized_text"))
        assertEquals(LlmPurpose.Tutor(HintLevel.EXPLANATION), client.requests[2].purpose)
        assertEquals(5, session.turns.size)
        assertEquals(HintLevel.HINT, session.turns[2].level)
        assertFalse(session.isLoading)
    }

    @Test
    fun failedRequestIsRolledBack() = runTest {
        val client = object : LlmClient {
            override val capabilities = LlmCapabilities(false, DocumentHandling.TEXT_ONLY)
            override suspend fun complete(request: LlmRequest): LlmResponse = throw LlmError.Timeout(75)
        }
        val session = TutorSession(context, null, client)
        session.answer("Meine Antwort")
        assertTrue(session.turns.isEmpty())
        assertTrue(session.errorMessage!!.contains("75 Sekunden"))
    }

    @Test
    fun demoFlashcardDecodes() = runTest {
        val session = TutorSession(context, null, DemoLlmClient(0))
        session.start()
        val card = session.makeFlashcard()
        assertTrue(card.front.contains("verkettete"))
        assertTrue(session.isDemo)
    }
}

class ProviderTest {
    @Test
    fun defaultsMatchIos() {
        assertEquals("google/gemma-4-31b-it", ModelSelection.default(LlmTask.TUTOR, LlmProvider.NVIDIA).model)
        assertEquals(
            "nvidia/nemotron-3-super-120b-a12b:free",
            ModelSelection.default(LlmTask.PLAN, LlmProvider.OPEN_ROUTER).model,
        )
        assertFalse(ModelSelection.default(LlmTask.PLAN, LlmProvider.OPEN_ROUTER).sendsImages)
        assertEquals("claude-opus-5", ModelSelection.default(LlmTask.TUTOR, LlmProvider.ANTHROPIC).model)
        assertEquals("gemini-3.8-flash", ModelSelection.default(LlmTask.TUTOR, LlmProvider.GOOGLE).model)
    }

    @Test
    fun everyDefaultIsInItsModelList() {
        for (provider in LlmProvider.entries) {
            for (task in LlmTask.entries) {
                assertTrue(provider.option(ModelSelection.default(task, provider).model) != null)
            }
        }
    }
}
