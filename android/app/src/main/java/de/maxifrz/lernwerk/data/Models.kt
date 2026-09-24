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
data class StudyPlan(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val examDay: Long,
    val minutesPerDay: Int,
    val isOverbooked: Boolean,
    val createdAt: Long = System.currentTimeMillis(),
    val topics: List<PlanTopic>,
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
    val plans: List<StudyPlan> = emptyList(),
    val cards: List<ReviewCard> = emptyList(),
)
