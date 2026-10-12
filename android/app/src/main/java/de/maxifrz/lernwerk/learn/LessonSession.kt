package de.maxifrz.lernwerk.learn

import de.maxifrz.lernwerk.learn.skills.ExerciseOutcome
import de.maxifrz.lernwerk.review.ReviewGrade

// A lesson in progress: answer, see the verdict, go on. Every exercise answered wrong comes back once at the end; the
// first attempt of each exercise is what counts for the cards and the skills. A port of LessonSession.swift.

/** How a lesson went, for the XP, the streak and the cards' schedule. */
data class LessonResult(
    val lessonID: String,
    /** One per run of a lesson, so the same run is never counted twice. */
    val sessionID: String,
    val exerciseCount: Int,
    val rightFirstTry: Int,
    val rightOnRetry: Int,
    /** The lesson's cards in order. */
    val cardKeys: List<String> = emptyList(),
    /** The cards answered right on the first try in every exercise they were part of. */
    val cardsRightFirstTry: Set<String> = emptySet(),
    /** The first attempt of every exercise that shows evidence of a skill (see `LearnExercise.skill`). */
    val outcomes: List<ExerciseOutcome> = emptyList(),
) {
    /** rightFirstTry / exerciseCount, 0 for an empty lesson. */
    val accuracy: Double get() = if (exerciseCount == 0) 0.0 else rightFirstTry.toDouble() / exerciseCount
}

sealed class LessonPhase {
    object Answering : LessonPhase() { override fun toString() = "Answering" }
    data class Feedback(val verdict: LearnVerdict) : LessonPhase()
    object Finished : LessonPhase() { override fun toString() = "Finished" }
}

class LessonSession(val lessonID: String, cardKeys: List<String>, exercises: List<LearnExercise>, val sessionID: String) {
    val cardKeys: List<String> = cardKeys.distinct()

    /** The exercises as built, without the ones that come back. */
    val exerciseCount: Int = exercises.size
    val queue: MutableList<LearnExercise> = exercises.toMutableList()
    var position: Int = 0
        private set
    var phase: LessonPhase = if (exercises.isEmpty()) LessonPhase.Finished else LessonPhase.Answering
        private set

    private val attempted = HashSet<String>()

    /** The cards each exercise got wrong on its first attempt, by exercise id. */
    private val firstMissed = LinkedHashMap<String, Set<String>>()

    /** Whether the second attempt was right, by exercise id. */
    private val retryRight = LinkedHashMap<String, Boolean>()
    private val requeued = HashSet<String>()

    /** Whether a hint was shown before the first attempt, by exercise id. */
    private val firstHelped = HashMap<String, Boolean>()

    /** How many hints were shown for each exercise, by exercise id. */
    private val hintsShown = HashMap<String, Int>()

    val current: LearnExercise?
        get() = if (phase == LessonPhase.Finished || position >= queue.size) null else queue[position]

    /** The current exercise came back after a wrong answer. */
    val isRetry: Boolean get() = current != null && position >= exerciseCount

    /** Exercises answered right, or answered wrong a second time, of all; it never goes back. */
    val progress: Double
        get() {
            if (exerciseCount <= 0) return 1.0
            var settled = retryRight.size
            for (missed in firstMissed.values) if (missed.isEmpty()) settled += 1
            return minOf(1.0, settled.toDouble() / exerciseCount)
        }

    /** Hints shown so far for the current exercise. */
    val hintCount: Int get() = current?.let { hintsShown[it.id] ?: 0 } ?: 0

    /** The hints of the current exercise shown so far, in order. */
    val shownHints: List<String> get() = current?.hints?.take(hintCount) ?: emptyList()

    /** Whether the current exercise has a hint left to show. */
    val hasMoreHints: Boolean
        get() {
            val exercise = current
            if (phase != LessonPhase.Answering || exercise == null) return false
            return hintCount < exercise.hints.size
        }

    /**
     * Shows the next hint of the current exercise and returns all that are shown, in order. A hint on a retry shows
     * the same hints again and changes nothing about the first attempt.
     */
    fun showHint(): List<String> {
        val exercise = current
        if (phase != LessonPhase.Answering || exercise == null) return emptyList()
        val count = minOf(exercise.hints.size, hintCount + 1)
        hintsShown[exercise.id] = count
        return exercise.hints.take(count)
    }

    /** Checks the answer and shows the verdict; null when no exercise waits for an answer (a second tap on "Pruefen"). */
    fun submit(answer: LearnAnswer): LearnVerdict? {
        val exercise = current
        if (phase != LessonPhase.Answering || exercise == null) return null
        val missed = exercise.missedKeys(answer)
        val verdict = if (missed.isEmpty()) LearnVerdict.RIGHT else LearnVerdict.WRONG
        if (attempted.add(exercise.id)) {
            firstMissed[exercise.id] = missed
            firstHelped[exercise.id] = hintCount > 0
        } else {
            retryRight[exercise.id] = verdict == LearnVerdict.RIGHT
        }
        phase = LessonPhase.Feedback(verdict)
        return verdict
    }

    /** "War doch richtig": a typed answer the check did not accept counts as right. */
    fun overrule() {
        val exercise = current
        val p = phase
        if (p !is LessonPhase.Feedback || p.verdict != LearnVerdict.WRONG || exercise == null || exercise.kind != ExerciseKind.TYPE_ANSWER) return
        if (retryRight.containsKey(exercise.id)) retryRight[exercise.id] = true else firstMissed[exercise.id] = emptySet()
        phase = LessonPhase.Feedback(LearnVerdict.RIGHT)
    }

    /** "Weiter": a first wrong answer puts the exercise at the end of the queue, once. */
    fun advance() {
        val exercise = current
        val p = phase
        if (p !is LessonPhase.Feedback || exercise == null) return
        if (p.verdict == LearnVerdict.WRONG && !retryRight.containsKey(exercise.id) && requeued.add(exercise.id)) {
            queue.add(exercise)
        }
        position += 1
        phase = if (position < queue.size) LessonPhase.Answering else LessonPhase.Finished
    }

    /** Only once the lesson is finished. */
    val result: LessonResult?
        get() {
            if (phase != LessonPhase.Finished) return null
            val exercised = queue.flatMap { it.cardKeys }.toSet()
            val wrongCards = firstMissed.values.flatten().toSet()
            val rightFirstTry = firstMissed.values.count { it.isEmpty() }
            val rightOnRetry = retryRight.values.count { it }
            val cardsRight = cardKeys.filter { it in exercised && it !in wrongCards }.toSet()
            return LessonResult(
                lessonID = lessonID, sessionID = sessionID, exerciseCount = exerciseCount, rightFirstTry = rightFirstTry,
                rightOnRetry = rightOnRetry, cardKeys = cardKeys, cardsRightFirstTry = cardsRight, outcomes = outcomes(),
            )
        }

    /** What the first attempts showed, in the order of the exercises, for the exercises that belong to a skill. */
    fun outcomes(): List<ExerciseOutcome> {
        val seen = HashSet<String>()
        val list = mutableListOf<ExerciseOutcome>()
        for (exercise in queue) {
            if (!seen.add(exercise.id)) continue
            val missed = firstMissed[exercise.id]
            val level = exercise.level
            if (exercise.skill.isEmpty() || level == null || missed == null) continue
            list.add(
                ExerciseOutcome(
                    exerciseID = exercise.id, skill = exercise.skill, level = level, right = missed.isEmpty(),
                    helped = firstHelped[exercise.id] ?: false,
                ),
            )
        }
        return list
    }
}

data class CardGrade(val key: String, val grade: ReviewGrade)

object LessonGrading {
    /**
     * Only the cards that were due when the lesson started get a grade: right on every first try is "good", anything
     * else "again". Practising cards that are not due leaves their SM-2 intervals alone. Each card at most once.
     */
    fun gradesToApply(result: LessonResult, dueKeys: Set<String>): List<CardGrade> {
        val seen = HashSet<String>()
        val out = mutableListOf<CardGrade>()
        for (key in result.cardKeys) {
            if (key !in dueKeys || !seen.add(key)) continue
            out.add(CardGrade(key, if (key in result.cardsRightFirstTry) ReviewGrade.GOOD else ReviewGrade.AGAIN))
        }
        return out
    }
}
