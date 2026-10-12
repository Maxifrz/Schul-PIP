package de.maxifrz.lernwerk.learn.skills

import de.maxifrz.lernwerk.learn.CoursePath
import de.maxifrz.lernwerk.learn.CourseProvider
import de.maxifrz.lernwerk.learn.CourseUnit
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnCalendar
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.LessonResult
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.PathStep
import de.maxifrz.lernwerk.learn.PathUnit
import de.maxifrz.lernwerk.learn.dayOf
import de.maxifrz.lernwerk.learn.daysTo
import de.maxifrz.lernwerk.learn.randomDouble

// What the Lernen tab suggests next, and why; practice rounds on chosen goals; skipping a unit by passing its test.
// A port of SkillAdvisor.swift.

enum class RecommendationKind {
    /** Skills reached before are due again. */
    REVIEW,

    /** Skills that are shaky, or that the next step builds on. */
    PRACTICE,

    /** The next step of the path. */
    STEP,

    /** Nothing is left: the course is done and nothing is due. */
    FINISHED,
}

/** What the Lernen tab suggests next, and why. */
data class Recommendation(
    val kind: RecommendationKind,
    val title: String,
    val reason: String,
    val skillIDs: List<String>,
    val step: PathStep?,
)

/**
 * Chooses the next sensible thing from the path and the skills. Nothing here locks a step: the path stays as it is,
 * and the advice says when another round would help more than the next lesson.
 */
object SkillAdvisor {
    const val mostSkillsPerRound = 3

    fun recommend(
        map: SkillMap,
        records: Map<String, SkillRecord>,
        units: List<PathUnit>,
        completed: Set<String>,
        now: Long,
        calendar: LearnCalendar,
    ): Recommendation {
        fun status(skill: Skill) = SkillAssessor.status(records[skill.id], skill, completed, now, calendar)
        val today = dayOf(now, calendar)
        val step = CoursePath.current(units)
        val most = mostSkillsPerRound

        // 1. Reviews that are due, the longest overdue first.
        fun overdue(skill: Skill): Int {
            val due = records[skill.id]?.dueDay
            return if (due != null) daysTo(due, today) else 0
        }
        val due = map.skills.filter { status(it) == SkillStatus.DUE }
            .sortedWith { a, b ->
                val first = overdue(a)
                val second = overdue(b)
                if (first != second) second.compareTo(first) else a.id.compareTo(b.id)
            }
        if (due.isNotEmpty()) {
            val chosen = due.take(most)
            val names = chosen.joinToString(", ") { it.title }
            return Recommendation(
                kind = RecommendationKind.REVIEW,
                title = "Wiederholen: $names",
                reason = if (due.size == 1) "Das hast du schon gekonnt. Jetzt festigst du es."
                else "Das hast du schon gekonnt. Jetzt festigst du es, bevor es verblasst.",
                skillIDs = chosen.map { it.id },
                step = null,
            )
        }

        // 2. What the next step builds on and the student does not yet do well.
        val stepUnit = if (step != null) units.firstOrNull { u -> u.steps.any { it.id == step.id } } else null
        if (step != null && stepUnit != null) {
            val weakPrerequisites = map.skillsInUnit(stepUnit.unit.id)
                .flatMap { skill -> skill.prerequisites.mapNotNull { map.skill(it) } }
                .filter { prerequisite ->
                    val state = status(prerequisite)
                    !state.isReached && state != SkillStatus.NOT_STARTED && isWeak(records[prerequisite.id], prerequisite)
                }
            val seen = HashSet<String>()
            val unique = weakPrerequisites.filter { seen.add(it.id) }
            if (unique.isNotEmpty()) {
                val chosen = unique.take(most)
                return Recommendation(
                    kind = RecommendationKind.PRACTICE,
                    title = "Erst festigen: " + chosen.joinToString(", ") { it.title },
                    reason = "Die nächste Lektion baut darauf auf, und es klappt noch nicht sicher.",
                    skillIDs = chosen.map { it.id },
                    step = step,
                )
            }
        }

        // 3. A skill of a finished unit that went badly.
        val shaky = map.skills.filter { skill ->
            val state = status(skill)
            (state == SkillStatus.WORKED || state == SkillStatus.PRACTICING) &&
                isWeak(records[skill.id], skill) && skill.nodeIDs.all { it in completed }
        }
        if (shaky.isNotEmpty()) {
            val chosen = shaky.take(most)
            return Recommendation(
                kind = RecommendationKind.PRACTICE,
                title = "Üben: " + chosen.joinToString(", ") { it.title },
                reason = "Die Lektionen sind durch, aber die Antworten sind noch nicht sicher.",
                skillIDs = chosen.map { it.id },
                step = step,
            )
        }

        if (step != null) {
            return Recommendation(
                kind = RecommendationKind.STEP,
                title = "Weiter mit " + stepTitle(step, units),
                reason = "Der nächste Schritt auf deinem Pfad.",
                skillIDs = emptyList(),
                step = step,
            )
        }
        return Recommendation(
            kind = RecommendationKind.FINISHED,
            title = "Kurs geschafft",
            reason = "Es ist nichts fällig. Beim nächsten Mal wiederholst du, was fällig wird.",
            skillIDs = emptyList(),
            step = null,
        )
    }

    /** Weak: some answers exist and the recent ones were mostly wrong or helped. */
    fun isWeak(record: SkillRecord?, skill: Skill?): Boolean {
        if (record == null || record.attempts < 3) return false
        val accuracy = record.recentAccuracy ?: return false
        return accuracy < SkillAssessor.weakAccuracy
    }

    fun stepTitle(step: PathStep, units: List<PathUnit>): String {
        val unit = units.firstOrNull { u -> u.steps.any { it.id == step.id } }
        val name = when (step.node.kind) {
            NodeKind.LESSON -> "Lektion ${step.node.index}"
            NodeKind.PRACTICE -> "der Übungsrunde"
            NodeKind.CHECKPOINT -> "dem Einheitentest"
            NodeKind.CHEST -> "der Truhe"
        }
        return if (unit != null) "$name · ${unit.unit.title}" else name
    }
}

/** A round made of the exercises that fit what a skill still needs. */
object SkillPractice {
    const val size = 10
    const val minimum = 6

    private class Weighted(val exercise: LearnExercise, val weight: Double)

    /**
     * Exercises for the target skills. Levels the student answers badly or never met are drawn more often; levels
     * answered well in the recent past less often. Same seed, same round.
     */
    fun exercises(
        provider: CourseProvider,
        map: SkillMap,
        targets: List<String>,
        records: Map<String, SkillRecord>,
        seed: ULong,
    ): List<LearnExercise> {
        val targetSet = targets.toSet()
        val wanted = map.skills.filter { it.id in targetSet }
        if (wanted.isEmpty()) return emptyList()
        val nodeIDs = mutableListOf<String>()
        for (skill in wanted) for (id in skill.nodeIDs) if (id !in nodeIDs) nodeIDs.add(id)
        val pool = mutableListOf<LearnExercise>()
        val rest = mutableListOf<LearnExercise>()
        val seen = HashSet<String>()
        nodeIDs.forEachIndexed { index, id ->
            val node = provider.course.nodes.firstOrNull { it.id == id } ?: return@forEachIndexed
            val batch = provider.lessonExercises(node, seed + index.toULong() * 7919uL)
            for (exercise in batch) {
                if (exercise.skill.isEmpty() || !seen.add(exercise.id)) continue
                if (exercise.skill in targetSet) pool.add(exercise) else rest.add(exercise)
            }
        }
        if (pool.isEmpty()) return emptyList()
        var weighted = pool.map { Weighted(it, weight(it, records, map)) }.toMutableList()
        // A goal with few exercises gets company from the same units, so a round is never a handful of questions.
        if (pool.size < minimum) {
            weighted.addAll(rest.map { Weighted(it, 0.3 * weight(it, records, map)) })
        }
        val random = LearnRandom(seed xor 0xA5A55A5A12345678uL)
        val picked = mutableListOf<LearnExercise>()
        while (picked.size < size && weighted.isNotEmpty()) {
            val total = weighted.sumOf { it.weight }
            var roll = randomDouble(random, 0.0, maxOf(total, 0.0001))
            var choice = weighted.size - 1
            for (index in weighted.indices) {
                roll -= weighted[index].weight
                if (roll < 0) {
                    choice = index
                    break
                }
            }
            picked.add(weighted.removeAt(choice).exercise)
        }
        return Exercises.arrange(picked, size)
    }

    fun weight(exercise: LearnExercise, records: Map<String, SkillRecord>, map: SkillMap?): Double {
        val level = exercise.level ?: return 1.0
        val tally = records[exercise.skill]?.tally(level) ?: Tally()
        val accuracy = tally.recentAccuracy ?: return 2.0
        if (accuracy < SkillAssessor.weakAccuracy) return 3.0
        if (accuracy >= 0.9 && tally.attempts >= 6) return 0.5
        return 1.0
    }
}

/** Skipping a unit by passing its test, for a student who knows it already. */
object TestOut {
    const val passRate = 0.85

    /** The unit that may be tested out: the first one not done, if nothing of it was done yet. */
    fun candidate(units: List<PathUnit>): PathUnit? {
        val unit = units.firstOrNull { !it.isDone } ?: return null
        if (unit.doneCount != 0 || unit.steps.firstOrNull()?.state != de.maxifrz.lernwerk.learn.LessonState.OPEN) return null
        return unit
    }

    fun passed(result: LessonResult): Boolean = result.exerciseCount >= 10 && result.accuracy >= passRate

    /** The steps a pass marks as done: everything but the chest, which the student opens. */
    fun nodesToComplete(unit: CourseUnit): List<String> = unit.nodes.filter { it.kind != NodeKind.CHEST }.map { it.id }
}
