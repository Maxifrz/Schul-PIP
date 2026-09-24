package de.maxifrz.lernwerk.review

import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.ZoneId
import kotlin.math.roundToInt

enum class ReviewGrade(val quality: Int, val label: String) {
    AGAIN(0, "Nochmal"),
    HARD(3, "Schwer"),
    GOOD(4, "Gut"),
    EASY(5, "Leicht"),
}

@Serializable
data class SchedulingState(
    val intervalDays: Int = 0,
    val easeFactor: Double = INITIAL_EASE,
    val repetitions: Int = 0,
    val lapses: Int = 0,
) {
    companion object {
        const val INITIAL_EASE = 2.5
        const val MINIMUM_EASE = 1.3
        val NEW = SchedulingState()
    }
}

/** SM-2 scheduling; a failed card comes back after a short relearning delay instead of the next day. */
object SpacedRepetition {
    const val RELEARN_DELAY_SECONDS = 10L * 60

    fun next(state: SchedulingState, grade: ReviewGrade): SchedulingState {
        val quality = grade.quality.toDouble()
        val easeChange = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
        val ease = maxOf(SchedulingState.MINIMUM_EASE, state.easeFactor + easeChange)

        if (grade == ReviewGrade.AGAIN) {
            return state.copy(easeFactor = ease, repetitions = 0, intervalDays = 0, lapses = state.lapses + 1)
        }

        val repetitions = state.repetitions + 1
        val interval = when (repetitions) {
            1 -> 1
            2 -> 6
            else -> maxOf(1, (state.intervalDays * ease).roundToInt())
        }
        return state.copy(easeFactor = ease, repetitions = repetitions, intervalDays = interval)
    }

    fun dueDate(state: SchedulingState, reviewedAt: Instant, zone: ZoneId = ZoneId.systemDefault()): Instant {
        if (state.intervalDays <= 0) return reviewedAt.plusSeconds(RELEARN_DELAY_SECONDS)
        return reviewedAt.atZone(zone).toLocalDate().plusDays(state.intervalDays.toLong()).atStartOfDay(zone).toInstant()
    }
}
