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
        Only use content that is actually in the material; never invent facts, numbers, dates or quotes.
        Write everything in German. Write math with Unicode characters, never LaTeX.

        What makes a good school talk:
        - A red thread: open with a hook (a question, a surprising fact or a problem from the material), give the
          context, build up the core in logical steps, show at least one concrete example, answer the opening question
          in the summary (Fazit), end with the sources.
        - One message per slide. The slide title states that message as a short claim (at most 10 words), not a topic
          label: "Enzyme senken die Aktivierungsenergie" instead of "Enzyme".
        - Slides support the talk, they do not replace it: at most 5 bullets of at most 8 words, no full sentences on
          slides. Everything else goes into the speaker notes.
        - Show instead of list. Pick the slide type that fits the content:
          numbers → BIG_NUMBER (one striking number) or CHART (several numbers from the material);
          dates or eras → TIMELINE; steps, cycles or cause and effect → PROCESS;
          three or four parallel aspects → CARDS; a comparison → TWO_COLUMNS or TABLE;
          a figure, diagram or table page in the material → IMAGE_TEXT or IMAGE_FULL;
          a key question or thesis → STATEMENT; a literal definition or quote → QUOTE.
          Use BULLETS only when nothing else fits, never more than two BULLETS slides in a row.
        - Charts only with numbers that literally appear in the material, with their unit.
        - Speaker notes are what the student says: full spoken sentences that explain the slide and lead over to the
          next one.
    """.trimIndent()

    /** Slide types as the model may choose them; BLANK is for the editor only. */
    private val layoutNames = SlideLayout.entries.filter { it != SlideLayout.BLANK }.joinToString(", ") { "\"${it.name}\"" }

    val layoutGuide = """
        Slide types and the fields they use:
        - TITLE: title, subtitle ("Name · Fach · Datum" if unknown)
        - SECTION: title of a new part, optional subtitle
        - STATEMENT: title is one striking claim or question, optional subtitle
        - BULLETS: title, 2–5 bullets
        - IMAGE_TEXT: title, 2–4 bullets, imageMaterial and imagePage of a material page with a figure
        - IMAGE_FULL: title, subtitle as caption, imageMaterial and imagePage of a material page with a figure
        - TWO_COLUMNS: title, leftTitle, left, rightTitle, right
        - CARDS: title, 3–4 items with title (2–4 words), text (at most 12 words) and icon (one fitting emoji)
        - PROCESS: title, 3–5 items with title (the step) and text (at most 10 words)
        - TIMELINE: title, 3–6 items with title (date or era) and text (at most 10 words)
        - BIG_NUMBER: title, value (the number with unit, e.g. "70 %"), subtitle explaining it
        - CHART: title, chart with kind (BAR for categories, LINE for development over time), labels, values (numbers
          only) and unit, subtitle naming the source
        - TABLE: title, table as rows of cells, first row is the header, at most 5 columns and 7 rows
        - QUOTE: quote taken literally from the material, attribution
    """.trimIndent()

    fun deckInstructions(topic: String, slideCount: Int, minutes: Int): String = """
        Plan a presentation from the material above. First only the outline: the red thread, not the finished slides.
        Topic or focus: ${topic.ifBlank { "the main content of the material" }}
        Number of slides: about $slideCount (title and sources slides included)
        Talk length: $minutes minutes

        Give the whole talk's core message (thesis) and, for every slide, its role in the talk (hook, context, core,
        example, comparison, summary, sources …), its message as one German sentence, the slide type that shows it
        best, what goes on it (facts, numbers with units, dates, the material page of a figure) and the material
        (sourceMaterial, the number of the material) and pages (sourcePages) it is based on.
    """.trimIndent() + "\n\n" + layoutGuide

    fun slidesInstructions(slideCount: Int, minutes: Int): String = """
        Now write the finished slides for this outline, in the same order. Use the planned slide type unless the
        material does not give enough for it. Each title is the slide's message, shortened to at most 10 words.
        Keep texts short, move details into the notes. Each slide's notes should take about
        ${maxOf(15, minutes * 60 / maxOf(1, slideCount))} seconds to say and lead over to the next slide.
        Give every slide its sourceMaterial and sourcePages.
    """.trimIndent()

    val outlineSchema: JsonObject = Json.parseToJsonElement(
        """
        {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "thesis": { "type": "string" },
            "slides": { "type": "array", "items": { "type": "object", "properties": {
              "role": { "type": "string" },
              "message": { "type": "string" },
              "layout": { "type": "string", "enum": [$layoutNames] },
              "content": { "type": "string" },
              "sourceMaterial": { "type": "integer" },
              "sourcePages": { "type": "array", "items": { "type": "integer" } }
            }, "required": ["role", "message", "layout", "content"] } }
          },
          "required": ["title", "thesis", "slides"]
        }
        """,
    ).jsonObject

    /** The fields of one slide's content; shared with the chat and the critic, which cannot place pictures. */
    val slideContentProperties = """
        "layout": { "type": "string", "enum": [$layoutNames] },
        "title": { "type": "string" },
        "subtitle": { "type": "string" },
        "bullets": { "type": "array", "items": { "type": "string" } },
        "leftTitle": { "type": "string" },
        "left": { "type": "array", "items": { "type": "string" } },
        "rightTitle": { "type": "string" },
        "right": { "type": "array", "items": { "type": "string" } },
        "items": { "type": "array", "items": { "type": "object", "properties": {
          "title": { "type": "string" }, "text": { "type": "string" }, "icon": { "type": "string" }
        }, "required": ["title"] } },
        "value": { "type": "string" },
        "chart": { "type": "object", "properties": {
          "kind": { "type": "string", "enum": ["BAR", "LINE"] },
          "labels": { "type": "array", "items": { "type": "string" } },
          "values": { "type": "array", "items": { "type": "number" } },
          "unit": { "type": "string" }
        }, "required": ["kind", "labels", "values"] },
        "table": { "type": "array", "items": { "type": "array", "items": { "type": "string" } } },
        "quote": { "type": "string" },
        "attribution": { "type": "string" },
        "notes": { "type": "string" }
    """

    private val slideProperties = slideContentProperties + """,
        "imageMaterial": { "type": "integer" },
        "imagePage": { "type": "integer" },
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
        appendLine("Redesign this slide: pick the slide type that shows its content best and rewrite the content for it,")
        appendLine("following the rules for good school slides. Keep the message and the speaker notes' meaning.")
        appendLine("Only choose IMAGE_TEXT or IMAGE_FULL if the slide already has a picture, CHART only with numbers that are on the slide.")
        appendLine()
        appendLine(layoutGuide)
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
        if (slide.extractedText.isNotBlank()) appendLine("Text in the slide picture: ${slide.extractedText.trim().take(1500)}")
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

    fun parseSlide(obj: JsonObject): SlideDraft? {
        val layout = obj.string("layout")?.uppercase()?.let { name -> SlideLayout.entries.firstOrNull { it.name == name } }
            ?: SlideLayout.BULLETS
        val chart = (obj["chart"] as? JsonObject)?.let { chart ->
            ChartDraft(
                kind = if (chart.string("kind")?.uppercase() == "LINE") ChartKind.LINE else ChartKind.BAR,
                labels = strings(chart["labels"]),
                values = (chart["values"] as? JsonArray)?.mapNotNull { number(it) } ?: emptyList(),
                unit = chart.string("unit")?.trim() ?: "",
            )
        }
        val draft = SlideDraft(
            layout = layout,
            title = obj.string("title")?.trim() ?: "",
            subtitle = obj.string("subtitle")?.trim() ?: "",
            bullets = strings(obj["bullets"]),
            leftTitle = obj.string("leftTitle") ?: "",
            left = strings(obj["left"]),
            rightTitle = obj.string("rightTitle") ?: "",
            right = strings(obj["right"]),
            quote = obj.string("quote") ?: "",
            attribution = obj.string("attribution") ?: "",
            items = (obj["items"] as? JsonArray)?.mapNotNull { item ->
                val entry = item as? JsonObject ?: return@mapNotNull null
                DraftItem(entry.string("title")?.trim() ?: "", entry.string("text")?.trim() ?: "", entry.string("icon")?.trim() ?: "")
                    .takeIf { it.title.isNotEmpty() || it.text.isNotEmpty() }
            } ?: emptyList(),
            value = obj.string("value")?.trim() ?: "",
            chart = chart,
            table = (obj["table"] as? JsonArray)?.mapNotNull { row -> (row as? JsonArray)?.let { cells(it) }?.takeIf { it.any(String::isNotBlank) } } ?: emptyList(),
            imageMaterial = obj["imageMaterial"].intOrNull(),
            imagePage = obj["imagePage"].intOrNull()?.takeIf { it > 0 },
            notes = obj.string("notes") ?: "",
            sourceMaterial = obj["sourceMaterial"].intOrNull(),
            sourcePages = (obj["sourcePages"] as? JsonArray)?.mapNotNull { it.intOrNull() } ?: emptyList(),
        )
        val hasContent = draft.title.isNotBlank() || draft.bullets.isNotEmpty() || draft.quote.isNotBlank() || draft.left.isNotEmpty() ||
            draft.items.isNotEmpty() || draft.table.isNotEmpty() || draft.chart != null
        return draft.takeIf { hasContent }
    }

    /** Numbers may come as strings, with a German decimal comma or a unit attached. */
    private fun number(element: JsonElement): Double? {
        val primitive = element as? JsonPrimitive ?: return null
        primitive.content.toDoubleOrNull()?.let { return it }
        val cleaned = primitive.content.replace(Regex("[^0-9,.\\-−]"), "").replace("−", "-")
        val normalized = if (cleaned.contains(',')) cleaned.replace(".", "").replace(',', '.') else cleaned
        return normalized.toDoubleOrNull()
    }

    private fun cells(row: JsonArray): List<String> = row.map { (it as? JsonPrimitive)?.content?.trim().orEmpty() }

    /** The outline as the model's own earlier answer, compact, for the second step. */
    fun outlineText(outline: Outline): String = buildString {
        appendLine("Title: ${outline.title}")
        appendLine("Thesis: ${outline.thesis}")
        outline.slides.forEachIndexed { index, slide ->
            appendLine("${index + 1}. [${slide.layout}] (${slide.role}) ${slide.message}")
            if (slide.content.isNotBlank()) appendLine("   ${slide.content.trim()}")
        }
    }

    data class Outline(val title: String, val thesis: String, val slides: List<OutlineSlide>)

    data class OutlineSlide(val role: String, val message: String, val layout: String, val content: String)

    fun parseOutline(text: String): Outline {
        val root = Json.parseToJsonElement(text).jsonObject
        val slides = (root["slides"] as? JsonArray ?: error("missing slides")).mapNotNull { item ->
            val obj = item as? JsonObject ?: return@mapNotNull null
            OutlineSlide(obj.string("role") ?: "", obj.string("message")?.trim() ?: "", obj.string("layout") ?: "", obj.string("content") ?: "")
                .takeIf { it.message.isNotEmpty() || it.content.isNotBlank() }
        }
        return Outline(root.string("title") ?: "", root.string("thesis") ?: "", slides)
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

/** Applies the critic's important findings (high and medium) without asking; minor ones are left to the student. */
fun autoApply(presentation: Presentation, critique: Critique): Presentation {
    val changes = critique.findings.filter { it.severity != Finding.Severity.LOW }.flatMap { it.changes }
    return PresentationEdits.apply(presentation, changes).presentation
}

/** The AI features of the presentation tab; all of them are ordinary LLM requests through the chosen provider. */
class PresentationAssistant(private val client: LlmClient) {
    class Material(val id: String, val title: String, val pdf: ByteArray)

    /** The steps of building a deck, for the progress shown while the student waits. */
    enum class Stage(val label: String) {
        OUTLINE("Die KI plant den roten Faden …"),
        SLIDES("Die KI schreibt die Folien …"),
        REVIEW("Der Kritiker prüft und verbessert …"),
    }

    /**
     * Builds a whole presentation from the chosen materials in three steps: an outline with one message per slide,
     * then the slides for that outline in the same conversation, then (with [review]) the critic's important findings
     * applied automatically. [pageImage] renders a material page and stores it as a media file.
     */
    suspend fun generate(
        materials: List<Material>,
        topic: String,
        slideCount: Int,
        minutes: Int,
        themeId: String,
        openDocument: suspend (ByteArray) -> MaterialDocument?,
        pageImage: suspend (materialIndex: Int, page: Int) -> PlacedImage?,
        review: Boolean = true,
        onStage: (Stage) -> Unit = {},
    ): Presentation {
        val content = PlanGenerator.content(
            materials.map { PlanGenerator.Input(it.title, it.pdf) },
            client.capabilities,
            PresentationPrompt.deckInstructions(topic, slideCount, minutes),
            openDocument,
        )
        onStage(Stage.OUTLINE)
        val outlineRequest = LlmRequest(
            purpose = LlmPurpose.PresentationOutline,
            system = PresentationPrompt.deckSystem,
            messages = listOf(LlmMessage(LlmRole.USER, content)),
            maxTokens = 8000,
            effort = LlmEffort.HIGH,
            jsonSchema = PresentationPrompt.outlineSchema,
        )
        val outline = StructuredOutput.complete(outlineRequest, client, PresentationPrompt::parseOutline) { it.slides.isNotEmpty() }

        onStage(Stage.SLIDES)
        val request = LlmRequest(
            purpose = LlmPurpose.Presentation,
            system = PresentationPrompt.deckSystem,
            messages = listOf(
                LlmMessage(LlmRole.USER, content),
                LlmMessage(LlmRole.ASSISTANT, listOf(LlmContent.Text(PresentationPrompt.outlineText(outline)))),
                LlmMessage(LlmRole.USER, listOf(LlmContent.Text(PresentationPrompt.slidesInstructions(outline.slides.size, minutes)))),
            ),
            maxTokens = 16000,
            effort = LlmEffort.MEDIUM,
            jsonSchema = PresentationPrompt.deckSchema,
        )
        val deck = StructuredOutput.complete(request, client, PresentationPrompt::parseDeck) { it.slides.isNotEmpty() }
        val slides = deck.slides.map { draft ->
            val image = if (draft.layout == SlideLayout.IMAGE_TEXT || draft.layout == SlideLayout.IMAGE_FULL) {
                val index = draft.imageMaterial ?: draft.sourceMaterial ?: 0
                draft.imagePage?.takeIf { index in materials.indices }?.let { pageImage(index, it) }
            } else {
                null
            }
            val materialId = draft.sourceMaterial?.let { materials.getOrNull(it)?.id } ?: materials.singleOrNull()?.id
            Slide(
                elements = SlideLayouts.build(draft, image),
                notes = draft.notes,
                sources = draft.sourcePages.map { SourceRef(materialId, it) },
            )
        }
        var presentation = Presentation(
            title = deck.title.ifBlank { outline.title.ifBlank { topic.ifBlank { "Präsentation" } } },
            themeId = themeId,
            slides = slides,
            materialIds = materials.map { it.id },
            minutes = minutes,
        )
        if (review) {
            onStage(Stage.REVIEW)
            // The critic improves the draft before the student sees it; a failed review keeps the draft.
            presentation = runCatching {
                val critique = PresentationCritic(client).critique(presentation, content.dropLast(1))
                autoApply(presentation, critique)
            }.getOrElse { if (it is kotlinx.coroutines.CancellationException) throw it else presentation }
        }
        return presentation
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
        val image = slide.elements.firstOrNull { it.kind == ElementKind.IMAGE && it.image != null }
            ?.let { PlacedImage(it.image!!, it.width / maxOf(1f, it.height)) }
        return slide.copy(
            elements = SlideLayouts.build(draft, image),
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
