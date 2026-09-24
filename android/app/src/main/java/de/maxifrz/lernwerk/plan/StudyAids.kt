package de.maxifrz.lernwerk.plan

import de.maxifrz.lernwerk.data.Exercise
import de.maxifrz.lernwerk.data.PlanTopic
import de.maxifrz.lernwerk.data.StudyPlan
import de.maxifrz.lernwerk.llm.LlmClient
import de.maxifrz.lernwerk.llm.LlmContent
import de.maxifrz.lernwerk.llm.LlmEffort
import de.maxifrz.lernwerk.llm.LlmMessage
import de.maxifrz.lernwerk.llm.LlmPurpose
import de.maxifrz.lernwerk.llm.LlmRequest
import de.maxifrz.lernwerk.llm.LlmRole
import de.maxifrz.lernwerk.llm.StructuredOutput
import de.maxifrz.lernwerk.llm.string
import de.maxifrz.lernwerk.research.Research
import de.maxifrz.lernwerk.tutor.Flashcard
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/** Exercises and flashcards for one topic of a study plan, from the pages it covers. */
class TopicAssistant(private val client: LlmClient) {
    suspend fun exercises(topic: PlanTopic, pages: String): List<Exercise> {
        val request = LlmRequest(
            purpose = LlmPurpose.StudyAid,
            system = StudyAids.SYSTEM,
            messages = listOf(LlmMessage(LlmRole.USER, listOf(LlmContent.Text(StudyAids.exercisesPrompt(topic, pages))))),
            maxTokens = 6000,
            effort = LlmEffort.MEDIUM,
            jsonSchema = StudyAids.exercisesSchema,
        )
        return StructuredOutput.complete(request, client, StudyAids::parseExercises) { it.isNotEmpty() }
    }

    suspend fun flashcards(topic: PlanTopic, pages: String): List<Flashcard> {
        val request = LlmRequest(
            purpose = LlmPurpose.StudyAid,
            system = StudyAids.SYSTEM,
            messages = listOf(LlmMessage(LlmRole.USER, listOf(LlmContent.Text(StudyAids.flashcardsPrompt(topic, pages))))),
            maxTokens = 4000,
            effort = LlmEffort.LOW,
            jsonSchema = StudyAids.flashcardsSchema,
        )
        return StructuredOutput.complete(request, client, StudyAids::parseFlashcards) { it.isNotEmpty() }
    }
}

object StudyAids {
    const val SYSTEM =
        "You help a German upper-secondary student practise one topic of their study plan. Write in German, address the " +
            "student as \"du\" and write math with Unicode characters, never LaTeX. Stay with what the pages of their " +
            "material cover; if there are no pages, stay with what the topic's title and goal describe at school level."

    /** The most text of a topic's pages that goes into one request. */
    const val MAX_PAGE_CHARACTERS = 24_000

    fun exercisesPrompt(topic: PlanTopic, pages: String): String = buildString {
        appendLine(topicBlock(topic, pages))
        appendLine()
        appendLine("Write 4 exercises (Übungsaufgaben) for this topic, from easy to hard: one to recall the basics, two to")
        appendLine("apply them to new examples and one transfer task. Each has a question, a hint that helps without giving")
        append("the answer away, and a complete worked solution with the steps.")
    }

    fun flashcardsPrompt(topic: PlanTopic, pages: String): String = buildString {
        appendLine(topicBlock(topic, pages))
        appendLine()
        appendLine("Write 6 to 10 flashcards for the most important facts, terms, rules and steps of this topic. The front")
        append("is a precise question, the back a short answer of at most two sentences.")
    }

    private fun topicBlock(topic: PlanTopic, pages: String): String = buildString {
        appendLine("Topic: ${topic.title}")
        appendLine("Goal: ${topic.summary}")
        if (pages.isNotBlank()) {
            appendLine("<pages ${topic.pagesLabel}>")
            appendLine(pages.take(MAX_PAGE_CHARACTERS))
            append("</pages>")
        }
    }

    /** The pages a topic covers, labeled, from the page texts of its material. */
    fun pagesText(topic: PlanTopic, pageTexts: List<String>?): String {
        if (pageTexts == null) return ""
        return topic.sourcePages.sorted().distinct()
            .mapNotNull { page -> pageTexts.getOrNull(page - 1)?.trim()?.takeIf { it.isNotEmpty() }?.let { "--- Page $page ---\n$it" } }
            .joinToString("\n")
    }

    val exercisesSchema: JsonObject = Json.parseToJsonElement(
        """
        {
          "type": "object",
          "properties": {
            "exercises": { "type": "array", "items": { "type": "object", "properties": {
              "question": { "type": "string" }, "hint": { "type": "string" }, "solution": { "type": "string" }
            }, "required": ["question", "hint", "solution"], "additionalProperties": false } }
          },
          "required": ["exercises"],
          "additionalProperties": false
        }
        """,
    ).jsonObject

    val flashcardsSchema: JsonObject = Json.parseToJsonElement(
        """
        {
          "type": "object",
          "properties": {
            "cards": { "type": "array", "items": { "type": "object", "properties": {
              "front": { "type": "string" }, "back": { "type": "string" }
            }, "required": ["front", "back"], "additionalProperties": false } }
          },
          "required": ["cards"],
          "additionalProperties": false
        }
        """,
    ).jsonObject

    fun parseExercises(text: String): List<Exercise> {
        val items = Json.parseToJsonElement(text).jsonObject["exercises"] as? JsonArray ?: error("missing exercises")
        return items.mapNotNull { item ->
            val obj = item as? JsonObject ?: return@mapNotNull null
            val question = obj.string("question")?.trim().orEmpty()
            val solution = obj.string("solution")?.trim().orEmpty()
            if (question.isEmpty() || solution.isEmpty()) null else Exercise(question, obj.string("hint")?.trim().orEmpty(), solution)
        }
    }

    fun parseFlashcards(text: String): List<Flashcard> {
        val items = Json.parseToJsonElement(text).jsonObject["cards"] as? JsonArray ?: error("missing cards")
        return items.mapNotNull { item ->
            val obj = item as? JsonObject ?: return@mapNotNull null
            val front = obj.string("front")?.trim().orEmpty()
            val back = obj.string("back")?.trim().orEmpty()
            if (front.isEmpty() || back.isEmpty()) null else Flashcard(front, back)
        }
    }

    /** What to search on YouTube: the model's suggestion or the topic's title. */
    fun videoQuery(topic: PlanTopic): String = topic.videoQuery.ifBlank { "${topic.title} einfach erklärt" }

    fun videoUrl(topic: PlanTopic): String = Research.youtubeSearchUrl(videoQuery(topic))
}

/** The plan as an iCalendar file: one all-day event per topic and one for the exam. */
object PlanCalendar {
    private val day = DateTimeFormatter.BASIC_ISO_DATE
    private val stamp = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC)

    fun ics(plan: StudyPlan, now: Instant = Instant.now()): String {
        val lines = mutableListOf(
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Schul-PIP//Lernplan//DE",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "X-WR-CALNAME:${escape("Lernplan: ${plan.title}")}",
        )
        plan.topics.sortedWith(compareBy({ it.scheduledDay }, { it.order })).forEach { topic ->
            val description = listOfNotNull(
                topic.summary.takeIf { it.isNotBlank() },
                "${topic.estimatedMinutes} Minuten" + if (topic.pagesLabel.isNotEmpty()) " · ${topic.pagesLabel}" else "",
                "Videos: ${StudyAids.videoUrl(topic)}",
            ).joinToString("\n")
            lines += event("${topic.id}@schul-pip", topic.scheduledDate, "Lernen: ${topic.title}", description, now)
        }
        lines += event("${plan.id}-exam@schul-pip", plan.examDate, "Prüfung: ${plan.title}", "Viel Erfolg!", now)
        lines += "END:VCALENDAR"
        return lines.flatMap(::fold).joinToString("\r\n", postfix = "\r\n")
    }

    private fun event(uid: String, date: LocalDate, summary: String, description: String, now: Instant) = listOf(
        "BEGIN:VEVENT",
        "UID:$uid",
        "DTSTAMP:${stamp.format(now)}",
        "DTSTART;VALUE=DATE:${date.format(day)}",
        "DTEND;VALUE=DATE:${date.plusDays(1).format(day)}",
        "SUMMARY:${escape(summary)}",
        "DESCRIPTION:${escape(description)}",
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
    )

    /** Text values escape backslashes, semicolons, commas and line breaks (RFC 5545, 3.3.11). */
    fun escape(text: String): String =
        text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n")

    /** Lines longer than 75 octets continue on the next line after a space, without splitting a character. */
    fun fold(line: String): List<String> {
        if (line.toByteArray(Charsets.UTF_8).size <= 75) return listOf(line)
        val parts = mutableListOf<String>()
        var current = StringBuilder()
        var size = 0
        var limit = 75
        var index = 0
        while (index < line.length) {
            val codePoint = line.codePointAt(index)
            val chars = Character.charCount(codePoint)
            val bytes = String(Character.toChars(codePoint)).toByteArray(Charsets.UTF_8).size
            if (size + bytes > limit) {
                parts += current.toString()
                current = StringBuilder(" ")
                size = 1
                limit = 75
            }
            current.appendCodePoint(codePoint)
            size += bytes
            index += chars
        }
        parts += current.toString()
        return parts
    }
}

/** What the daily reminder of a plan says. */
object PlanReminder {
    /** Open topics planned for today or missed before. */
    fun due(plan: StudyPlan, today: LocalDate): List<PlanTopic> =
        plan.topics.filter { !it.isDone && it.scheduledDay <= today.toEpochDay() }.sortedWith(compareBy({ it.scheduledDay }, { it.order }))

    /** Title and text of the notification, or null when nothing is open (or the exam is over). */
    fun message(plan: StudyPlan, today: LocalDate): Pair<String, String>? {
        if (today.isAfter(plan.examDate)) return null
        val due = due(plan, today)
        if (due.isEmpty()) return null
        val minutes = due.sumOf { it.estimatedMinutes }
        val titles = due.take(3).joinToString(", ") { it.title } + if (due.size > 3) " und ${due.size - 3} weitere" else ""
        val exam = if (today == plan.examDate) "Heute ist die Prüfung – viel Erfolg! " else ""
        return "Lernplan: ${plan.title}" to "$exam$titles · etwa $minutes Minuten"
    }
}
