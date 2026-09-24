package de.maxifrz.lernwerk.present

import de.maxifrz.lernwerk.llm.LlmClient
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmEffort
import de.maxifrz.lernwerk.llm.LlmMessage
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.LlmRequest
import de.maxifrz.lernwerk.llm.LlmRole
import de.maxifrz.lernwerk.llm.StructuredOutput
import de.maxifrz.lernwerk.llm.intOrNull
import de.maxifrz.lernwerk.llm.string
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/** One change to a presentation, as the chat and the critic propose it. Slides are addressed by id, not number. */
data class SlideChange(
    val action: Action,
    val summary: String = "",
    val slideId: String? = null,
    /** For INSERT: the slide the new one follows; null or unknown means the start. */
    val afterSlideId: String? = null,
    /** For MOVE: the new 1-based position. */
    val position: Int? = null,
    val texts: Map<String, String> = emptyMap(),
    val draft: SlideDraft? = null,
    val notes: String? = null,
    val theme: String? = null,
    val title: String? = null,
) {
    enum class Action(val wire: String) {
        UPDATE_TEXTS("update_texts"),
        REPLACE_SLIDE("replace_slide"),
        INSERT_SLIDE("insert_slide"),
        DELETE_SLIDE("delete_slide"),
        MOVE_SLIDE("move_slide"),
        SET_NOTES("set_notes"),
        SET_THEME("set_theme"),
        RENAME("rename"),
    }
}

data class ChatReply(val message: String, val changes: List<SlideChange>)

data class Finding(
    val severity: Severity,
    val slideId: String?,
    val problem: String,
    val suggestion: String,
    val changes: List<SlideChange>,
) {
    enum class Severity(val label: String) { HIGH("Wichtig"), MEDIUM("Mittel"), LOW("Klein") }
}

data class Critique(val verdict: String, val findings: List<Finding>)

/** Prompts and parsing for the presentation chat and the critic, plus applying their changes. */
object PresentationEdits {
    private val changeProperties = """
        "action": { "type": "string", "enum": ["update_texts", "replace_slide", "insert_slide", "delete_slide", "move_slide", "set_notes", "set_theme", "rename"] },
        "summary": { "type": "string" },
        "slideId": { "type": "string" },
        "afterSlideId": { "type": "string" },
        "position": { "type": "integer" },
        "texts": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "text": { "type": "string" } }, "required": ["id", "text"] } },
        "slide": { "type": "object", "properties": {
          "layout": { "type": "string", "enum": ["TITLE", "SECTION", "BULLETS", "IMAGE_TEXT", "TWO_COLUMNS", "QUOTE"] },
          "title": { "type": "string" }, "subtitle": { "type": "string" },
          "bullets": { "type": "array", "items": { "type": "string" } },
          "leftTitle": { "type": "string" }, "left": { "type": "array", "items": { "type": "string" } },
          "rightTitle": { "type": "string" }, "right": { "type": "array", "items": { "type": "string" } },
          "quote": { "type": "string" }, "attribution": { "type": "string" }, "notes": { "type": "string" }
        } },
        "notes": { "type": "string" },
        "theme": { "type": "string", "enum": ["quill", "nacht", "kreide", "papier"] },
        "title": { "type": "string" }
    """

    private val changeRules = """
        Changes use these actions; slides and text boxes are addressed by the ids shown in the presentation:
        - update_texts: slideId and texts (every changed text box with its id and the complete new text; bullets are lines separated by \n)
        - replace_slide: slideId and slide (a new layout with content; keeps the slide's picture for IMAGE_TEXT)
        - insert_slide: afterSlideId ("" for the very beginning) and slide
        - delete_slide: slideId
        - move_slide: slideId and position (new 1-based position)
        - set_notes: slideId and notes (the complete new speaker notes)
        - set_theme: theme (quill, nacht, kreide or papier)
        - rename: title
        Every change gets a short German summary of what it does. Keep slides short (at most 5 bullets of at most
        8 words), details go into the speaker notes. Write German, math in Unicode, never LaTeX.
    """.trimIndent()

    val chatSystem = """
        You edit a German school presentation together with the student who wrote it. They tell you what to change;
        you carry it out as changes and answer briefly in German (one to three sentences, address them as "du").
        Do exactly what they ask, nothing more. If something is unclear or would make the presentation worse, say so in
        the message and make no change. Only use facts from the presentation or the provided material; if they ask for
        content that is not there, say that you cannot check it.
    """.trimIndent() + "\n\n" + changeRules

    val critiqueSystem = """
        You are a sceptical, demanding critic of a German school presentation, like a strict teacher before a graded
        talk. Look for real weaknesses: claims that are wrong, unsupported or contradict the provided material; missing
        steps in the argument; unclear structure or missing red thread; too much text on a slide; slides without a clear
        message; missing sources; speaker notes that do not fit the slide or the planned talk length; design problems
        such as unreadable colors or overloaded slides. Do not praise. Report at most 10 findings, the most important
        first, each with its severity (high, medium, low), the slide it concerns (slideId, empty for the whole talk),
        the problem, a concrete suggestion, and the changes that implement the suggestion (empty if the student has to
        do it themselves, e.g. rehearse). The verdict is two German sentences on the overall state.
    """.trimIndent() + "\n\n" + changeRules

    val chatSchema: JsonObject = Json.parseToJsonElement(
        """
        {
          "type": "object",
          "properties": {
            "message": { "type": "string" },
            "changes": { "type": "array", "items": { "type": "object", "properties": { $changeProperties }, "required": ["action", "summary"] } }
          },
          "required": ["message", "changes"]
        }
        """,
    ).jsonObject

    val critiqueSchema: JsonObject = Json.parseToJsonElement(
        """
        {
          "type": "object",
          "properties": {
            "verdict": { "type": "string" },
            "findings": { "type": "array", "items": { "type": "object", "properties": {
              "severity": { "type": "string", "enum": ["high", "medium", "low"] },
              "slideId": { "type": "string" },
              "problem": { "type": "string" },
              "suggestion": { "type": "string" },
              "changes": { "type": "array", "items": { "type": "object", "properties": { $changeProperties }, "required": ["action", "summary"] } }
            }, "required": ["severity", "problem", "suggestion"] } }
          },
          "required": ["verdict", "findings"]
        }
        """,
    ).jsonObject

    /** The whole presentation with slide and text box ids, as the model sees it before every answer. */
    fun state(presentation: Presentation): String = buildString {
        appendLine("<presentation title=\"${presentation.title}\" theme=\"${presentation.themeId}\" minutes=\"${presentation.minutes}\" slides=\"${presentation.slides.size}\">")
        presentation.slides.forEachIndexed { index, slide ->
            appendLine("<slide number=\"${index + 1}\" id=\"${slide.id}\">")
            slide.elements.filter { it.kind == ElementKind.TEXT && it.text.isNotBlank() }
                .sortedWith(compareBy({ it.y }, { it.x }))
                .forEach { element ->
                    val role = when {
                        element.fontSize >= 32 -> "heading"
                        element.bullets -> "bullets"
                        else -> "text"
                    }
                    appendLine("<text id=\"${element.id}\" role=\"$role\">")
                    appendLine(element.text.trim())
                    appendLine("</text>")
                }
            val pictures = slide.elements.count { it.kind == ElementKind.IMAGE }
            if (pictures > 0) appendLine("<pictures count=\"$pictures\"/>")
            if (slide.extractedText.isNotBlank()) appendLine("<picture_text>${slide.extractedText.trim().take(1500)}</picture_text>")
            if (slide.notes.isNotBlank()) appendLine("<notes>${slide.notes.trim()}</notes>")
            appendLine("</slide>")
        }
        appendLine("</presentation>")
    }

    // Parsing

    fun parseChat(text: String): ChatReply {
        val root = Json.parseToJsonElement(text).jsonObject
        val message = root.string("message") ?: error("missing message")
        return ChatReply(message.trim(), parseChanges(root["changes"]))
    }

    fun parseCritique(text: String): Critique {
        val root = Json.parseToJsonElement(text).jsonObject
        val findings = (root["findings"] as? JsonArray ?: error("missing findings")).mapNotNull { item ->
            val obj = item as? JsonObject ?: return@mapNotNull null
            val problem = obj.string("problem")?.trim().orEmpty()
            if (problem.isEmpty()) return@mapNotNull null
            Finding(
                severity = when (obj.string("severity")?.lowercase()) {
                    "high", "hoch" -> Finding.Severity.HIGH
                    "low", "niedrig" -> Finding.Severity.LOW
                    else -> Finding.Severity.MEDIUM
                },
                slideId = obj.string("slideId")?.takeIf { it.isNotBlank() },
                problem = problem,
                suggestion = obj.string("suggestion")?.trim().orEmpty(),
                changes = parseChanges(obj["changes"]),
            )
        }
        return Critique(root.string("verdict")?.trim().orEmpty(), findings)
    }

    private fun parseChanges(element: kotlinx.serialization.json.JsonElement?): List<SlideChange> =
        (element as? JsonArray)?.mapNotNull { item ->
            val obj = item as? JsonObject ?: return@mapNotNull null
            val action = obj.string("action")?.lowercase()?.let { wire -> SlideChange.Action.entries.firstOrNull { it.wire == wire } }
                ?: return@mapNotNull null
            SlideChange(
                action = action,
                summary = obj.string("summary")?.trim().orEmpty(),
                slideId = obj.string("slideId")?.takeIf { it.isNotBlank() },
                afterSlideId = obj.string("afterSlideId"),
                position = obj["position"].intOrNull(),
                texts = (obj["texts"] as? JsonArray)?.mapNotNull { text ->
                    val t = text as? JsonObject ?: return@mapNotNull null
                    val id = t.string("id") ?: return@mapNotNull null
                    id to (t.string("text") ?: return@mapNotNull null)
                }?.toMap().orEmpty(),
                draft = (obj["slide"] as? JsonObject)?.let { PresentationPrompt.parseSlideDraft(it.toString()) },
                notes = obj.string("notes"),
                theme = obj.string("theme"),
                title = obj.string("title"),
            )
        }.orEmpty()

    // Applying

    data class Result(val presentation: Presentation, val applied: List<SlideChange>, val skipped: List<SlideChange>)

    /** Applies changes in order; a change whose slide no longer exists is skipped, not guessed. */
    fun apply(presentation: Presentation, changes: List<SlideChange>): Result {
        var slides = presentation.slides.toMutableList()
        var current = presentation
        val applied = mutableListOf<SlideChange>()
        val skipped = mutableListOf<SlideChange>()
        fun index(id: String?) = slides.indexOfFirst { it.id == id }

        for (change in changes) {
            val ok = when (change.action) {
                SlideChange.Action.UPDATE_TEXTS -> {
                    val i = index(change.slideId)
                    val slide = slides.getOrNull(i)
                    if (slide == null || change.texts.keys.none { key -> slide.elements.any { it.id == key } }) {
                        false
                    } else {
                        slides[i] = slide.copy(elements = slide.elements.map { element -> change.texts[element.id]?.let { element.copy(text = it.trim()) } ?: element })
                        true
                    }
                }
                SlideChange.Action.REPLACE_SLIDE -> {
                    val i = index(change.slideId)
                    val draft = change.draft
                    if (i < 0 || draft == null) {
                        false
                    } else {
                        slides[i] = rebuild(slides[i], draft)
                        true
                    }
                }
                SlideChange.Action.INSERT_SLIDE -> {
                    val draft = change.draft
                    if (draft == null) {
                        false
                    } else {
                        val layout = if (draft.layout == SlideLayout.IMAGE_TEXT) SlideLayout.BULLETS else draft.layout
                        val slide = Slide(elements = SlideLayouts.build(draft.copy(layout = layout)), notes = draft.notes)
                        val after = index(change.afterSlideId)
                        slides.add(after + 1, slide)
                        true
                    }
                }
                SlideChange.Action.DELETE_SLIDE -> {
                    val i = index(change.slideId)
                    if (i < 0 || slides.size <= 1) false else {
                        slides.removeAt(i)
                        true
                    }
                }
                SlideChange.Action.MOVE_SLIDE -> {
                    val i = index(change.slideId)
                    val position = change.position
                    if (i < 0 || position == null) false else {
                        val slide = slides.removeAt(i)
                        slides.add((position - 1).coerceIn(0, slides.size), slide)
                        true
                    }
                }
                SlideChange.Action.SET_NOTES -> {
                    val i = index(change.slideId)
                    val notes = change.notes
                    if (i < 0 || notes == null) false else {
                        slides[i] = slides[i].copy(notes = notes.trim())
                        true
                    }
                }
                SlideChange.Action.SET_THEME -> {
                    val theme = SlideTheme.all.firstOrNull { it.id == change.theme?.lowercase() }
                    if (theme == null) false else {
                        current = current.copy(themeId = theme.id)
                        true
                    }
                }
                SlideChange.Action.RENAME -> {
                    val title = change.title?.trim()
                    if (title.isNullOrEmpty()) false else {
                        current = current.copy(title = title)
                        true
                    }
                }
            }
            if (ok) applied += change else skipped += change
        }
        return Result(current.copy(slides = slides.toList()), applied, skipped)
    }

    /** A new layout for an existing slide; its first picture stays for image layouts. */
    fun rebuild(slide: Slide, draft: SlideDraft): Slide {
        val image = slide.elements.firstOrNull { it.kind == ElementKind.IMAGE && it.image != null }
            ?.let { PlacedImage(it.image!!, it.width / maxOf(1f, it.height)) }
        val layout = if (draft.layout == SlideLayout.IMAGE_TEXT && image == null) SlideLayout.BULLETS else draft.layout
        return slide.copy(
            elements = SlideLayouts.build(draft.copy(layout = layout), image),
            notes = draft.notes.ifBlank { slide.notes },
        )
    }
}

/** A conversation about one presentation; earlier turns are kept short so the current state always fits. */
class PresentationChat(private val client: LlmClient) {
    private val history = mutableListOf<LlmMessage>()

    /** [material] is the source material as the plan reader prepares it; it is sent with the first message only. */
    suspend fun send(presentation: Presentation, instruction: String, material: List<LlmContent> = emptyList()): ChatReply {
        val content = mutableListOf<LlmContent>()
        if (history.isEmpty()) content += material
        content += LlmContent.Text(PresentationEdits.state(presentation) + "\nInstruction: " + instruction.trim())
        val messages = history.takeLast(MAX_HISTORY) + LlmMessage(LlmRole.USER, content)
        val request = LlmRequest(
            purpose = LlmPurpose.PresentationChat,
            system = PresentationEdits.chatSystem,
            messages = messages,
            maxTokens = 8000,
            effort = LlmEffort.LOW,
            jsonSchema = PresentationEdits.chatSchema,
        )
        val reply = StructuredOutput.complete(request, client, PresentationEdits::parseChat)
        // Later turns only need what was asked and answered; the state is sent fresh each time.
        history += LlmMessage(LlmRole.USER, if (history.isEmpty()) content.dropLast(1) + LlmContent.Text("Instruction: $instruction") else listOf(LlmContent.Text("Instruction: $instruction")))
        history += LlmMessage(LlmRole.ASSISTANT, listOf(LlmContent.Text(reply.message + reply.changes.joinToString("") { "\n- " + it.summary })))
        return reply
    }

    private companion object {
        const val MAX_HISTORY = 8
    }
}

/** The sceptical reviewer: finds weaknesses and proposes changes the student approves one by one. */
class PresentationCritic(private val client: LlmClient) {
    suspend fun critique(presentation: Presentation, material: List<LlmContent> = emptyList()): Critique {
    val prompt = buildString {
        if (material.isNotEmpty()) appendLine("The material above is what the presentation is based on; check the slides against it.")
        append(PresentationEdits.state(presentation))
        append("\nReview this presentation.")
    }
    val request = LlmRequest(
        purpose = LlmPurpose.PresentationCritique,
        system = PresentationEdits.critiqueSystem,
        messages = listOf(LlmMessage(LlmRole.USER, material + LlmContent.Text(prompt))),
        maxTokens = 12000,
        effort = LlmEffort.HIGH,
        jsonSchema = PresentationEdits.critiqueSchema,
    )
    return StructuredOutput.complete(request, client, PresentationEdits::parseCritique)
    }
}
