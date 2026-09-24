package de.maxifrz.lernwerk.data

import de.maxifrz.lernwerk.review.ReviewGrade
import de.maxifrz.lernwerk.review.SchedulingState
import de.maxifrz.lernwerk.review.SpacedRepetition
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

@Serializable
data class StudyMaterial(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val createdAt: Long = System.currentTimeMillis(),
    val lastOpenedPage: Int = 0,
    /** The folder it lives in, null for the top level of the library. */
    val folderId: String? = null,
    /** One of [Subjects.all], or empty. */
    val subject: String = "",
    val isFavorite: Boolean = false,
    val lastOpenedAt: Long? = null,
    /** Set while it is in the trash; the trash empties itself after [Library.TRASH_DAYS]. */
    val deletedAt: Long? = null,
) {
    val isTrashed: Boolean get() = deletedAt != null
}

@Serializable
data class Folder(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val parentId: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)

@Serializable
data class PlanTopic(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val summary: String,
    val materialId: String?,
    val sourcePages: List<Int>,
    val estimatedMinutes: Int,
    val order: Int,
    /** Days since the epoch, so a topic stays on its day across time zones. */
    val scheduledDay: Long,
    val isDone: Boolean = false,
    /** A German YouTube search the model suggested for explainer videos; empty for older plans. */
    val videoQuery: String = "",
    /** Practice exercises generated on request, with worked solutions. */
    val exercises: List<Exercise> = emptyList(),
    /** The Wikipedia introduction to the topic, once looked up. */
    val wiki: WikiSummary? = null,
    /** How many flashcards were made from this topic. */
    val cardCount: Int = 0,
) {
    val scheduledDate: LocalDate get() = LocalDate.ofEpochDay(scheduledDay)

    val pagesLabel: String
        get() {
            val pages = sourcePages.sorted()
            val first = pages.firstOrNull() ?: return ""
            val last = pages.last()
            return if (first == last) "S. $first" else "S. $first–$last"
        }
}

@Serializable
data class Exercise(val question: String, val hint: String = "", val solution: String)

@Serializable
data class WikiSummary(val title: String, val url: String, val text: String)

@Serializable
data class StudyPlan(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val examDay: Long,
    val minutesPerDay: Int,
    val isOverbooked: Boolean,
    val createdAt: Long = System.currentTimeMillis(),
    val topics: List<PlanTopic>,
    /** Minute of the day for the daily reminder, null when it is off. */
    val reminderMinute: Int? = null,
) {
    val examDate: LocalDate get() = LocalDate.ofEpochDay(examDay)
}

@Serializable
data class ReviewCard(
    val id: String = UUID.randomUUID().toString(),
    val front: String,
    val back: String,
    val materialId: String?,
    val page: Int?,
    val createdAt: Long = System.currentTimeMillis(),
    val dueAt: Long = createdAt,
    val scheduling: SchedulingState = SchedulingState.NEW,
) {
    fun applying(grade: ReviewGrade, at: Instant = Instant.now()): ReviewCard {
        val next = SpacedRepetition.next(scheduling, grade)
        return copy(scheduling = next, dueAt = SpacedRepetition.dueDate(next, at).toEpochMilli())
    }
}

@Serializable
enum class InkTool { PEN, HIGHLIGHTER }

/** One stroke on a page; coordinates are fractions of the page width and height. */
@Serializable
data class InkStroke(val tool: InkTool, val points: List<Float>)

@Serializable
data class AppData(
    val materials: List<StudyMaterial> = emptyList(),
    val folders: List<Folder> = emptyList(),
    val plans: List<StudyPlan> = emptyList(),
    val cards: List<ReviewCard> = emptyList(),
)
