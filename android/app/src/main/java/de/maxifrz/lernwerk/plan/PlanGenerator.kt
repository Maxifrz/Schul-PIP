package de.maxifrz.lernwerk.plan

import de.maxifrz.lernwerk.llm.DocumentHandling
import de.maxifrz.lernwerk.llm.LlmCapabilities
import de.maxifrz.lernwerk.llm.LlmClient
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmEffort
import de.maxifrz.lernwerk.llm.LlmError
import de.maxifrz.lernwerk.llm.LlmMessage
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.LlmRequest
import de.maxifrz.lernwerk.llm.LlmRole
import de.maxifrz.lernwerk.llm.StructuredOutput
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/** A PDF opened for text extraction; the Android implementation uses PdfBox, PdfRenderer and ML Kit. */
interface MaterialDocument {
    /** Trimmed text layer of every page. */
    val pageTexts: List<String>

    /** On-device OCR of a 1-based page; empty when nothing was recognized. */
    suspend fun recognizeText(pageNumber: Int): String

    /** JPEG of a 1-based page. */
    suspend fun pageImage(pageNumber: Int): ByteArray?
}

/** Extracts page text locally so providers without PDF support still get page-accurate material. */
object PdfMaterialText {
    /** Pages with less text than this are treated as scanned images. */
    const val MINIMUM_TEXT_LENGTH = 20

    /** 1-based numbers of pages without a usable text layer. */
    fun scannedPages(texts: List<String>): List<Int> =
        texts.mapIndexedNotNull { index, text -> if (text.length < MINIMUM_TEXT_LENGTH) index + 1 else null }

    fun labeledText(materialIndex: Int, title: String, pages: List<String>, recognizedPages: Set<Int> = emptySet()): String {
        val lines = mutableListOf("=== Material $materialIndex: $title ===")
        pages.forEachIndexed { offset, text ->
            val pageNumber = offset + 1
            lines += if (pageNumber in recognizedPages) {
                "--- Page $pageNumber (recognized from scan, may contain OCR errors) ---"
            } else {
                "--- Page $pageNumber ---"
            }
            lines += if (text.length < MINIMUM_TEXT_LENGTH) "(scanned page without text layer)" else text
        }
        return lines.joinToString("\n")
    }
}

class PlanGenerator(
    private val client: LlmClient,
    private val openDocument: suspend (ByteArray) -> MaterialDocument?,
) {
    class Input(val title: String, val pdf: ByteArray)

    suspend fun generate(inputs: List<Input>): List<TopicDraft> {
        val content = content(inputs, client.capabilities, openDocument = openDocument)
        val request = LlmRequest(
            purpose = LlmPurpose.StudyPlan,
            system = SYSTEM,
            messages = listOf(LlmMessage(LlmRole.USER, content)),
            maxTokens = 16000,
            effort = LlmEffort.HIGH,
            jsonSchema = schema,
        )
        return StructuredOutput.complete(request, client, TopicDraft::parseResponse) { it.isNotEmpty() }
    }

    companion object {
        /** Base64 inflates PDFs by a third; this keeps requests below the API upload limits. */
        const val MAX_TOTAL_BYTES = 22_000_000

        /** Roughly 100k tokens of extracted text. */
        const val MAX_TEXT_CHARACTERS = 400_000
        const val MAX_SCANNED_PAGE_IMAGES = 12

        const val SYSTEM =
            "You design study plans for a German upper-secondary student preparing for an exam. " +
                "You read the student's own material and split it into learning units, each small enough for one focused " +
                "study session. Only use content that is actually in the material."

        val INSTRUCTIONS = """
            Split the material above into 5 to 25 learning topics, in the order they should be learned.
            For every topic provide:
            - title: short German title, unique within the plan
            - summary: one German sentence saying what the student can do after studying it
            - prerequisites: exact titles of other topics in this plan that must be learned first (may be empty)
            - materialIndex: the number of the material that covers the topic
            - sourcePages: the 1-based page numbers in that material (use the "--- Page N ---" markers when present)
            - estimatedMinutes: realistic study time between 15 and 60 minutes, including practice
        """.trimIndent()

        val schema: JsonObject = Json.parseToJsonElement(
            """
            {
              "type": "object",
              "properties": {
                "topics": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "title": { "type": "string" },
                      "summary": { "type": "string" },
                      "prerequisites": { "type": "array", "items": { "type": "string" } },
                      "materialIndex": { "type": "integer" },
                      "sourcePages": { "type": "array", "items": { "type": "integer" } },
                      "estimatedMinutes": { "type": "integer" }
                    },
                    "required": ["title", "summary", "prerequisites", "materialIndex", "sourcePages", "estimatedMinutes"],
                    "additionalProperties": false
                  }
                }
              },
              "required": ["topics"],
              "additionalProperties": false
            }
            """,
        ).jsonObject

        /**
         * Picks the cheapest way each provider can read the material: native PDF, local text (from the text layer or
         * on-device OCR), provider OCR or page images.
         */
        suspend fun content(
            inputs: List<Input>,
            capabilities: LlmCapabilities,
            instructions: String = INSTRUCTIONS,
            openDocument: suspend (ByteArray) -> MaterialDocument?,
        ): List<LlmContent> {
            val content = mutableListOf<LlmContent>()
            var pdfBytes = 0
            var textCharacters = 0
            var imageBudget = MAX_SCANNED_PAGE_IMAGES

            inputs.forEachIndexed { index, input ->
                if (capabilities.documentHandling == DocumentHandling.NATIVE_PDF) {
                    content += LlmContent.Text("Material $index: ${input.title}")
                    content += LlmContent.Pdf(input.pdf)
                    pdfBytes += input.pdf.size
                    return@forEachIndexed
                }

                val document = openDocument(input.pdf) ?: throw LlmError.UnreadablePdf(input.title)
                val pages = document.pageTexts.toMutableList()
                val recognizedPages = mutableSetOf<Int>()
                for (pageNumber in PdfMaterialText.scannedPages(pages)) {
                    val recognized = document.recognizeText(pageNumber).trim()
                    if (recognized.length >= PdfMaterialText.MINIMUM_TEXT_LENGTH) {
                        pages[pageNumber - 1] = recognized
                        recognizedPages += pageNumber
                    }
                }
                val scanned = PdfMaterialText.scannedPages(pages)

                if (scanned.isNotEmpty() && capabilities.documentHandling == DocumentHandling.PROVIDER_OCR) {
                    content += LlmContent.Text("Material $index: ${input.title}")
                    content += LlmContent.Pdf(input.pdf)
                    pdfBytes += input.pdf.size
                    return@forEachIndexed
                }

                val text = PdfMaterialText.labeledText(index, input.title, pages, recognizedPages)
                textCharacters += text.length
                content += LlmContent.Text(text)

                if (scanned.isEmpty()) return@forEachIndexed
                if (!capabilities.acceptsImages || scanned.size > imageBudget) {
                    throw LlmError.ScannedPdf(input.title, scanned.size)
                }
                for (pageNumber in scanned) {
                    val image = document.pageImage(pageNumber) ?: continue
                    content += LlmContent.Text("Material $index, page $pageNumber (scanned):")
                    content += LlmContent.Image(image)
                }
                imageBudget -= scanned.size
            }

            if (pdfBytes > MAX_TOTAL_BYTES || textCharacters > MAX_TEXT_CHARACTERS) throw LlmError.RequestTooLarge
            content += LlmContent.Text(instructions)
            return content
        }
    }
}
