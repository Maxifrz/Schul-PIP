package de.maxifrz.lernwerk.plan

import de.maxifrz.lernwerk.llm.intOrNull
import de.maxifrz.lernwerk.llm.string
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import java.time.LocalDate

data class TopicDraft(
    val title: String,
    val summary: String = "",
    val prerequisites: List<String> = emptyList(),
    val materialIndex: Int = 0,
    val sourcePages: List<Int> = emptyList(),
    val estimatedMinutes: Int = 30,
) {
    companion object {
        /** Models without schema enforcement drop fields or send numbers as strings; only the title is mandatory. */
        fun fromJson(obj: JsonObject): TopicDraft? {
            val title = obj.string("title") ?: return null
            return TopicDraft(
                title = title,
                summary = obj.string("summary") ?: "",
                prerequisites = (obj["prerequisites"] as? JsonArray)
                    ?.mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content } ?: emptyList(),
                materialIndex = obj["materialIndex"].lenientInt() ?: 0,
                sourcePages = (obj["sourcePages"] as? JsonArray)?.mapNotNull { it.lenientInt() } ?: emptyList(),
                estimatedMinutes = obj["estimatedMinutes"].lenientInt() ?: 30,
            )
        }

        /** Reads `{"topics": [...]}`; throws when the text is not such an object. */
        fun parseResponse(text: String): List<TopicDraft> {
            val root = Json.parseToJsonElement(text).jsonObject
            val topics = root["topics"] as? JsonArray ?: error("missing topics")
            return topics.mapNotNull { (it as? JsonObject)?.let(::fromJson) }
        }

        private fun kotlinx.serialization.json.JsonElement?.lenientInt(): Int? =
            (this as? JsonPrimitive)?.content?.trim()?.let { it.toIntOrNull() ?: this.intOrNull() }
    }
}

data class ScheduledTopic(val draft: TopicDraft, val order: Int, val date: LocalDate)

data class PlanSchedule(val topics: List<ScheduledTopic>, val isOverbooked: Boolean)

/** Orders topics so prerequisites come first and spreads them over days until the exam. */
object PlanScheduler {
    fun order(drafts: List<TopicDraft>): List<TopicDraft> {
        val indexByTitle = mutableMapOf<String, Int>()
        drafts.forEachIndexed { index, draft -> indexByTitle.putIfAbsent(normalize(draft.title), index) }
        val prerequisites = drafts.mapIndexed { index, draft ->
            draft.prerequisites.mapNotNull { indexByTitle[normalize(it)] }.filter { it != index }.toSet()
        }

        val placed = mutableSetOf<Int>()
        val result = mutableListOf<TopicDraft>()
        while (placed.size < drafts.size) {
            val ready = drafts.indices.firstOrNull { it !in placed && placed.containsAll(prerequisites[it]) }
            // A dependency cycle leaves nothing ready; break it by taking the earliest remaining topic.
            val next = ready ?: drafts.indices.firstOrNull { it !in placed } ?: break
            placed += next
            result += drafts[next]
        }
        return result
    }

    fun assignDates(minutes: List<Int>, start: LocalDate, minutesPerDay: Int): List<LocalDate> {
        val capacity = maxOf(1, minutesPerDay)
        var day = start
        var used = 0
        return minutes.map { value ->
            val needed = maxOf(1, value)
            if (used > 0 && used + needed > capacity) {
                day = day.plusDays(1)
                used = 0
            }
            used += needed
            day
        }
    }

    fun schedule(drafts: List<TopicDraft>, start: LocalDate, examDate: LocalDate, minutesPerDay: Int): PlanSchedule {
        val ordered = order(drafts)
        val dates = assignDates(ordered.map { it.estimatedMinutes }, start, minutesPerDay)
        val topics = ordered.zip(dates).mapIndexed { index, (draft, date) -> ScheduledTopic(draft, index, date) }
        return PlanSchedule(topics, isOverbooked(dates, examDate))
    }

    fun isOverbooked(dates: List<LocalDate>, examDate: LocalDate): Boolean {
        val last = dates.lastOrNull() ?: return false
        return !last.isBefore(examDate)
    }

    private fun normalize(title: String) = title.trim().lowercase()
}
