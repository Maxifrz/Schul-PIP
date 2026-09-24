package de.maxifrz.lernwerk.present

import de.maxifrz.lernwerk.llm.LlmClient
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmEffort
import de.maxifrz.lernwerk.llm.LlmMessage
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.LlmRequest
import de.maxifrz.lernwerk.llm.LlmRole
import de.maxifrz.lernwerk.llm.ModelText
import de.maxifrz.lernwerk.llm.StructuredOutput
import de.maxifrz.lernwerk.llm.intOrNull
import de.maxifrz.lernwerk.llm.string
import de.maxifrz.lernwerk.plan.MaterialDocument
import de.maxifrz.lernwerk.plan.PlanGenerator
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject

/** Prompts, schemas and tolerant parsing for everything the AI does with presentations. */
object PresentationPrompt {
    val deckSystem = """
        You help a German upper-secondary student build a school presentation (Referat) from their own material.
        Good school slides: one idea per slide, at most 5 bullets of at most 8 words each, no full sentences on slides,
        the details go into the speaker notes. Start with a title slide, use section slides to structure longer talks,
        end with a summary slide (Fazit) and a sources slide listing the materials and pages used.
        Only use content that is actually in the material; never invent facts, numbers or quotes.
        Write everything in German. Write math with Unicode characters, never LaTeX.
    """.trimIndent()

    fun deckInstructions(topic: String, slideCount: Int, minutes: Int): String = """
        Create a presentation from the material above.
        Topic or focus: ${topic.ifBlank { "the main content of the material" }}
        Number of slides: about $slideCount (title and sources slides included)
        Talk length: $minutes minutes, so each slide's notes should take about ${maxOf(15, minutes * 60 / maxOf(1, slideCount))} seconds to say.

        For every slide choose a layout:
        - TITLE: title and subtitle (e.g. name, subject, date placeholder "Name · Fach")
        - SECTION: a short title for a new part of the talk
        - BULLETS: title and 2–5 bullets
        - IMAGE_TEXT: title, 2–4 bullets and a page of the material that shows a figure, diagram or table worth showing (imageMaterial, imagePage)
        - TWO_COLUMNS: title, leftTitle/left bullets, rightTitle/right bullets, for comparisons
        - QUOTE: a short quote or definition taken literally from the material, with attribution
        Only use IMAGE_TEXT when that page really contains a figure. Give every slide speaker notes in full German sentences
        and the material (sourceMaterial, the number of the material) and pages (sourcePages) it is based on.
    """.trimIndent()

    private val slideProperties = """
        "layout": { "type": "string", "enum": ["TITLE", "SECTION", "BULLETS", "IMAGE_TEXT", "TWO_COLUMNS", "QUOTE"] },
        "title": { "type": "string" },
        "subtitle": { "type": "string" },
        "bullets": { "type": "array", "items": { "type": "string" } },
        "leftTitle": { "type": "string" },
        "left": { "type": "array", "items": { "type": "string" } },
        "rightTitle": { "type": "string" },
        "right": { "type": "array", "items": { "type": "string" } },
        "quote": { "type": "string" },
        "attribution": { "type": "string" },
        "imageMaterial": { "type": "integer" },
        "imagePage": { "type": "integer" },
        "notes": { "type": "string" },
        "sourceMaterial": { "type": "integer" },
        "sourcePages": { "type": "array", "items": { "type": "integer" } }
    """

    val slideSchema: JsonObject = Json.parseToJsonElement(
        """{ "type": "object", "properties": { $slideProperties }, "required": ["layout", "title", "notes"] }""",
    ).jsonObject

    val deckSchema: JsonObject = Json.parseToJsonElement(
        """
        {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "slides": { "type": "array", "items": { "type": "object", "properties": { $slideProperties }, "required": ["layout", "title", "notes"] } }
          },
          "required": ["title", "slides"]
        }
        """,
    ).jsonObject

    // Rewriting the texts of one slide

    enum class Rewrite(val label: String, val instruction: String) {
        SHORTER("Kürzen", "Make every text shorter: fewer bullets and fewer words, keep the key facts."),
        SIMPLER("Vereinfachen", "Use simpler words and shorter sentences a classmate understands at first hearing; explain or replace technical terms."),
        DETAILED("Ausführlicher", "Add the most important missing detail from the material, at most one bullet or a few words per text."),
    }

    val rewriteSystem = """
        You edit the texts of one slide of a German school presentation. Keep the language German, keep the slide's topic,
        keep one line per bullet (lines are separated by \n), never invent facts. Write math with Unicode characters, never LaTeX.
    """.trimIndent()

    val rewriteSchema: JsonObject = Json.parseToJsonElement(
        """
        {
          "type": "object",
          "properties": {
            "texts": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "text": { "type": "string" } }, "required": ["id", "text"] } }
          },
          "required": ["texts"]
        }
        """,
    ).jsonObject

    fun rewriteRequest(slide: Slide, rewrite: Rewrite, notes: String): String = buildString {
        appendLine(rewrite.instruction)
        appendLine("Return every text box with its id, changed or unchanged.")
        appendLine()
        appendLine("<slide>")
        slide.elements.filter { it.kind == ElementKind.TEXT && it.text.isNotBlank() }.forEach {
            appendLine("<text id=\"${it.id}\" role=\"${if (it.fontSize >= 32) "heading" else if (it.bullets) "bullets" else "text"}\">")
            appendLine(it.text)
            appendLine("</text>")
        }
        appendLine("</slide>")
        if (notes.isNotBlank()) {
            appendLine("<speaker_notes>")
            appendLine(notes)
            appendLine("</speaker_notes>")
        }
    }

    // Redesigning one slide

    fun redesignRequest(slide: Slide): String = buildString {
        appendLine("Redesign this slide: pick the layout that fits its content best (TITLE, SECTION, BULLETS, IMAGE_TEXT, TWO_COLUMNS or QUOTE)")
        appendLine("and rewrite the content for it, following the rules for good school slides. Keep the speaker notes' meaning.")
        appendLine("Only choose IMAGE_TEXT if the slide already has a picture.")
        appendLine()
        append(outline(slide, includeNotes = true))
    }

    // Speaker notes

    val notesSystem = """
        You write speaker notes for a German school presentation: what the student says for each slide, in natural spoken
        German, full sentences, addressing the class. Explain what the slide shows instead of reading it out.
        Never invent facts that are not on the slides or in the existing notes.
    """.trimIndent()

    val notesSchema: JsonObject = Json.parseToJsonElement(
        """
        {
          "type": "object",
          "properties": {
            "notes": { "type": "array", "items": { "type": "object", "properties": { "slide": { "type": "integer" }, "notes": { "type": "string" } }, "required": ["slide", "notes"] } }
          },
          "required": ["notes"]
        }
        """,
    ).jsonObject

    fun notesRequest(presentation: Presentation): String = buildString {
        val perSlide = presentation.minutes * 60 / maxOf(1, presentation.slides.size)
        appendLine("Talk length: ${presentation.minutes} minutes for ${presentation.slides.size} slides, so about $perSlide seconds per slide")
        appendLine("(roughly ${perSlide * 2} words). Write notes for every slide, numbered from 1.")
        appendLine()
        presentation.slides.forEachIndexed { index, slide ->
            appendLine("<slide number=\"${index + 1}\">")
            append(outline(slide, includeNotes = true))
            appendLine("</slide>")
        }
    }

    // Feedback

    val feedbackSystem = """
        You give feedback on a German school presentation like a good teacher preparing a student: Socratic, encouraging,
        concrete. Look at structure and red thread, amount of text per slide, whether each slide has one clear message,
        the transition between slides and whether the talk length fits. Do not rewrite the slides for the student.
        Name at most three strengths briefly, then ask at most five questions that make the student find the weak spots
        themselves, each question pointing at a specific slide number. Answer in German, address the student as "du",
        use Markdown only for **bold** and short lists.
    """.trimIndent()

    fun feedbackRequest(presentation: Presentation): String = buildString {
        appendLine("Presentation \"${presentation.title}\", planned talk length ${presentation.minutes} minutes, ${presentation.slides.size} slides.")
        appendLine()
        presentation.slides.forEachIndexed { index, slide ->
            appendLine("<slide number=\"${index + 1}\">")
            append(outline(slide, includeNotes = true))
            appendLine("</slide>")
        }
    }

    /** The texts of a slide in reading order, for prompts. */
    fun outline(slide: Slide, includeNotes: Boolean): String = buildString {
        val texts = slide.elements.filter { it.kind == ElementKind.TEXT && it.text.isNotBlank() }
            .sortedWith(compareBy({ it.y }, { it.x }))
        texts.forEach { appendLine(it.text.trim()) }
        if (slide.elements.any { it.kind == ElementKind.IMAGE }) appendLine("[picture]")
        if (includeNotes && slide.notes.isNotBlank()) appendLine("Notes: ${slide.notes.trim()}")
    }

    // Parsing

    data class DeckDraft(val title: String, val slides: List<SlideDraft>)

    fun parseDeck(text: String): DeckDraft {
        val root = Json.parseToJsonElement(text).jsonObject
        val slides = (root["slides"] as? JsonArray)?.mapNotNull { (it as? JsonObject)?.let(::parseSlide) } ?: error("missing slides")
        return DeckDraft(root.string("title") ?: slides.firstOrNull()?.title ?: "Präsentation", slides)
    }

    fun parseSlideDraft(text: String): SlideDraft = parseSlide(Json.parseToJsonElement(text).jsonObject) ?: error("no slide")

    private fun parseSlide(obj: JsonObject): SlideDraft? {
        val layout = obj.string("layout")?.uppercase()?.let { name -> SlideLayout.entries.firstOrNull { it.name == name } }
            ?: SlideLayout.BULLETS
        val draft = SlideDraft(
            layout = layout,
            title = obj.string("title") ?: "",
            subtitle = obj.string("subtitle") ?: "",
            bullets = strings(obj["bullets"]),
            leftTitle = obj.string("leftTitle") ?: "",
            left = strings(obj["left"]),
            rightTitle = obj.string("rightTitle") ?: "",
            right = strings(obj["right"]),
            quote = obj.string("quote") ?: "",
            attribution = obj.string("attribution") ?: "",
            imageMaterial = obj["imageMaterial"].intOrNull(),
            imagePage = obj["imagePage"].intOrNull()?.takeIf { it > 0 },
            notes = obj.string("notes") ?: "",
            sourceMaterial = obj["sourceMaterial"].intOrNull(),
            sourcePages = (obj["sourcePages"] as? JsonArray)?.mapNotNull { it.intOrNull() } ?: emptyList(),
        )
        val hasContent = draft.title.isNotBlank() || draft.bullets.isNotEmpty() || draft.quote.isNotBlank() || draft.left.isNotEmpty()
        return draft.takeIf { hasContent }
    }

    private fun strings(element: JsonElement?): List<String> =
        (element as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content?.trim() }
            ?.filter { it.isNotEmpty() } ?: emptyList()

    fun parseTexts(text: String): Map<String, String> {
        val root = Json.parseToJsonElement(text).jsonObject
        val texts = root["texts"] as? JsonArray ?: error("missing texts")
        return texts.mapNotNull { item ->
            val obj = item as? JsonObject ?: return@mapNotNull null
            val id = obj.string("id") ?: return@mapNotNull null
            id to (obj.string("text") ?: return@mapNotNull null)
        }.toMap()
    }

    fun parseNotes(text: String): Map<Int, String> {
        val root = Json.parseToJsonElement(text).jsonObject
        val notes = root["notes"] as? JsonArray ?: error("missing notes")
        return notes.mapNotNull { item ->
            val obj = item as? JsonObject ?: return@mapNotNull null
            val slide = obj["slide"].intOrNull() ?: return@mapNotNull null
            slide to (obj.string("notes") ?: return@mapNotNull null)
        }.toMap()
    }
}

/** The AI features of the presentation tab; all of them are ordinary LLM requests through the chosen provider. */
class PresentationAssistant(private val client: LlmClient) {
    class Material(val id: String, val title: String, val pdf: ByteArray)

    /**
     * Builds a whole presentation from the chosen materials. [pageImage] renders a material page and stores it as a
     * media file, returning its name.
     */
    suspend fun generate(
        materials: List<Material>,
        topic: String,
        slideCount: Int,
        minutes: Int,
        themeId: String,
        openDocument: suspend (ByteArray) -> MaterialDocument?,
        pageImage: suspend (materialIndex: Int, page: Int) -> String?,
    ): Presentation {
        val content = PlanGenerator.content(
            materials.map { PlanGenerator.Input(it.title, it.pdf) },
            client.capabilities,
            PresentationPrompt.deckInstructions(topic, slideCount, minutes),
            openDocument,
        )
        val request = LlmRequest(
            purpose = LlmPurpose.Presentation,
            system = PresentationPrompt.deckSystem,
            messages = listOf(LlmMessage(LlmRole.USER, content)),
            maxTokens = 16000,
            effort = LlmEffort.HIGH,
            jsonSchema = PresentationPrompt.deckSchema,
        )
        val deck = StructuredOutput.complete(request, client, PresentationPrompt::parseDeck) { it.slides.isNotEmpty() }
        val slides = deck.slides.map { draft ->
            val image = if (draft.layout == SlideLayout.IMAGE_TEXT) {
                val index = draft.imageMaterial ?: draft.sourceMaterial ?: 0
                draft.imagePage?.takeIf { index in materials.indices }?.let { pageImage(index, it) }
            } else {
                null
            }
            val layout = if (draft.layout == SlideLayout.IMAGE_TEXT && image == null) SlideLayout.BULLETS else draft.layout
            val materialId = draft.sourceMaterial?.let { materials.getOrNull(it)?.id } ?: materials.singleOrNull()?.id
            Slide(
                elements = SlideLayouts.build(draft.copy(layout = layout), image),
                notes = draft.notes,
                sources = draft.sourcePages.map { SourceRef(materialId, it) },
            )
        }
        return Presentation(
            title = deck.title.ifBlank { topic.ifBlank { "Präsentation" } },
            themeId = themeId,
            slides = slides,
            materialIds = materials.map { it.id },
            minutes = minutes,
        )
    }

    /** New texts for the slide's text boxes; ids the model dropped keep their old text. */
    suspend fun rewrite(slide: Slide, rewrite: PresentationPrompt.Rewrite): Slide {
        val request = LlmRequest(
            purpose = LlmPurpose.SlideRewrite,
            system = PresentationPrompt.rewriteSystem,
            messages = listOf(LlmMessage(LlmRole.USER, listOf(LlmContent.Text(PresentationPrompt.rewriteRequest(slide, rewrite, slide.notes))))),
            maxTokens = 4000,
            effort = LlmEffort.LOW,
            jsonSchema = PresentationPrompt.rewriteSchema,
        )
        val ids = slide.elements.map { it.id }.toSet()
        val texts = StructuredOutput.complete(request, client, PresentationPrompt::parseTexts) { result -> result.keys.any { it in ids } }
        return slide.copy(elements = slide.elements.map { element -> texts[element.id]?.let { element.copy(text = it.trim()) } ?: element })
    }

    /** Rebuilds the slide from a fresh layout; an existing picture is kept for image layouts. */
    suspend fun redesign(slide: Slide): Slide {
        val request = LlmRequest(
            purpose = LlmPurpose.SlideRewrite,
            system = PresentationPrompt.deckSystem,
            messages = listOf(LlmMessage(LlmRole.USER, listOf(LlmContent.Text(PresentationPrompt.redesignRequest(slide))))),
            maxTokens = 4000,
            effort = LlmEffort.LOW,
            jsonSchema = PresentationPrompt.slideSchema,
        )
        val draft = StructuredOutput.complete(request, client, PresentationPrompt::parseSlideDraft)
        val image = slide.elements.firstOrNull { it.kind == ElementKind.IMAGE }?.image
        val layout = if (draft.layout == SlideLayout.IMAGE_TEXT && image == null) SlideLayout.BULLETS else draft.layout
        return slide.copy(
            elements = SlideLayouts.build(draft.copy(layout = layout), image),
            notes = draft.notes.ifBlank { slide.notes },
        )
    }

    suspend fun speakerNotes(presentation: Presentation): Presentation {
        val request = LlmRequest(
            purpose = LlmPurpose.SpeakerNotes,
            system = PresentationPrompt.notesSystem,
            messages = listOf(LlmMessage(LlmRole.USER, listOf(LlmContent.Text(PresentationPrompt.notesRequest(presentation))))),
            maxTokens = 12000,
            effort = LlmEffort.LOW,
            jsonSchema = PresentationPrompt.notesSchema,
        )
        val notes = StructuredOutput.complete(request, client, PresentationPrompt::parseNotes) { it.isNotEmpty() }
        return presentation.copy(
            slides = presentation.slides.mapIndexed { index, slide -> notes[index + 1]?.let { slide.copy(notes = it.trim()) } ?: slide },
        )
    }

    suspend fun feedback(presentation: Presentation): String {
        val response = client.complete(
            LlmRequest(
                purpose = LlmPurpose.PresentationFeedback,
                system = PresentationPrompt.feedbackSystem,
                messages = listOf(LlmMessage(LlmRole.USER, listOf(LlmContent.Text(PresentationPrompt.feedbackRequest(presentation))))),
                maxTokens = 6000,
                effort = LlmEffort.MEDIUM,
            ),
        )
        return ModelText.removingReasoning(response.text)
    }
}
