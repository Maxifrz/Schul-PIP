package de.maxifrz.lernwerk.tutor

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/** The Socratic hint ladder: the tutor starts with a question and only reveals more on request. */
enum class HintLevel(val number: Int, val title: String, val promptName: String) {
    QUESTION(1, "Frage", "question"),
    HINT(2, "Hinweis", "hint"),
    EXPLANATION(3, "Erklärung", "explanation");

    val next: HintLevel? get() = entries.firstOrNull { it.number == number + 1 }
}

@Serializable
data class Flashcard(val front: String, val back: String) {
    companion object {
        val schema: JsonObject = Json.parseToJsonElement(
            """
            {
              "type": "object",
              "properties": {
                "front": { "type": "string" },
                "back": { "type": "string" }
              },
              "required": ["front", "back"],
              "additionalProperties": false
            }
            """,
        ).jsonObject
    }
}

data class TutorContext(
    val materialTitle: String,
    val pageNumber: Int,
    val selectedText: String,
    val pageText: String,
    val topicTitle: String? = null,
    val topicSummary: String? = null,
    val weakSpots: List<String> = emptyList(),
    /** On-device OCR of the marked region, which also catches the student's handwriting. */
    val recognizedText: String = "",
)

object TutorPrompt {
    const val PAGE_TEXT_LIMIT = 6000

    val system = """
        You are a Socratic tutor inside a study app used by a German upper-secondary student preparing for the Abitur.
        The student marked a region of their study material because they are stuck. You receive an image of the marked region, the text extracted from it, text recognized on the device (including the student's handwriting), the surrounding page, and, when available, the current topic of their study plan and flashcards they struggled with before. Recognized text can contain OCR errors, especially in formulas; when it disagrees with the image, trust the image.

        Every student message starts with a tag like [help level 2: hint]. Follow that level exactly:
        - Level 1 (question): Do not explain and do not solve. Ask exactly one guiding question that points the student at the key idea. At most three sentences.
        - Level 2 (hint): Give one concrete hint that narrows the problem down. Name the relevant rule, formula or concept, but leave the final step to the student. End with a question.
        - Level 3 (explanation): Explain fully and step by step, including the solution if the region contains a task. Finish with one short check question so the student can test themselves.

        When the student answers, first say whether the answer is right, partly right or wrong, with one sentence on why. If it is right, confirm it and go one step deeper. If it is wrong, do not reveal the solution below level 3; ask a question that exposes the misconception instead.

        Pair words with pictures: when a sketch, diagram or concrete example would help, describe a small one the student can draw in the margin. Ground everything in the provided material; if it does not contain enough information, say so instead of guessing.

        Always answer in German and address the student as "du". Keep answers short. Write math with Unicode characters (x², √, ·, ≤, →, ∫), never LaTeX. Use Markdown only for **bold**, *italics* and short lists.
    """.trimIndent()

    fun contextBlock(context: TutorContext, hasImage: Boolean = true): String {
        val parts = mutableListOf<String>()
        parts += "<material title=\"${context.materialTitle}\" page=\"${context.pageNumber}\"/>"

        val selected = context.selectedText.trim()
        val recognized = context.recognizedText.trim()
        parts += when {
            selected.isNotEmpty() -> "<marked_text>\n$selected\n</marked_text>"
            recognized.isNotEmpty() -> "<marked_text>(no text layer - see recognized_text)</marked_text>"
            hasImage -> "<marked_text>(no text layer - read the marked region from the image)</marked_text>"
            else -> "<marked_text>(no text layer and no image available - ask the student to type out the part they are stuck on)</marked_text>"
        }
        if (recognized.isNotEmpty() && recognized != selected) {
            parts += "<recognized_text source=\"on-device OCR\">\n$recognized\n</recognized_text>"
        }

        val page = context.pageText.trim()
        if (page.isNotEmpty()) {
            val clipped = if (page.length > PAGE_TEXT_LIMIT) page.take(PAGE_TEXT_LIMIT) + "\n[...]" else page
            parts += "<page_text>\n$clipped\n</page_text>"
        }

        context.topicTitle?.let { topic ->
            val summary = context.topicSummary?.let { " - $it" } ?: ""
            parts += "<study_topic>$topic$summary</study_topic>"
        }

        if (context.weakSpots.isNotEmpty()) {
            parts += "<weak_spots>\n${context.weakSpots.joinToString("\n") { "- $it" }}\n</weak_spots>"
        }
        return parts.joinToString("\n")
    }

    fun studentTurn(text: String, level: HintLevel): String =
        "[help level ${level.number}: ${level.promptName}]\n$text"

    val flashcardSystem = """
        You turn a tutoring conversation into exactly one flashcard for spaced repetition, written in German.
        Front: a question that tests the core idea the student struggled with. No yes/no questions.
        Back: a concise answer of at most three sentences.
        Write math with Unicode characters, never LaTeX.
    """.trimIndent()

    fun flashcardRequest(context: TutorContext, transcript: String): String = listOf(
        "Material: ${context.materialTitle}, page ${context.pageNumber}",
        "Marked text: ${context.selectedText.ifEmpty { "(image only)" }}",
        "",
        "<conversation>",
        transcript,
        "</conversation>",
    ).joinToString("\n")
}
