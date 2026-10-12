package de.maxifrz.lernwerk.learn.skills

import de.maxifrz.lernwerk.learn.CourseProvider
import de.maxifrz.lernwerk.learn.ExerciseKind

// Learning goals ("skills"): levels, facets and the skill map of a course. A port of Skill.swift. The defaults every
// course provider gets (facets, tag, feedback, lessonExercises, skillMap) are default methods of `CourseProvider`.

/**
 * What an exercise asks of the student. A skill is only shown to be mastered by the higher levels: seeing the right
 * answer among others is the weakest evidence there is.
 */
enum class CompetenceLevel(val raw: String, val title: String) {
    /** Picking the right answer from a few: a choice, pairs, a key on the piano. */
    RECOGNISE("recognise", "Wiedererkennen"),

    /** Producing the answer from memory: typing it. */
    RECALL("recall", "Abrufen"),

    /** Using the knowledge: putting a sentence together, finding a move on the board, a form in a sentence. */
    APPLY("apply", "Anwenden");

    /** Points for an answer right on the first try without help. */
    val weight: Double get() = if (this == RECOGNISE) 1.0 else 2.0

    /** `a > b` in Swift's Comparable. */
    fun isHigher(than: CompetenceLevel): Boolean = ordinal > than.ordinal

    companion object {
        /** The level an exercise has when the course does not say otherwise. */
        fun standard(kind: ExerciseKind): CompetenceLevel = kind.standardLevel
    }
}

/** The level an exercise of this kind has when the course does not say otherwise. */
val ExerciseKind.standardLevel: CompetenceLevel
    get() = when (this) {
        ExerciseKind.MULTIPLE_CHOICE, ExerciseKind.MATCH_PAIRS, ExerciseKind.PIANO_KEY -> CompetenceLevel.RECOGNISE
        ExerciseKind.TYPE_ANSWER -> CompetenceLevel.RECALL
        ExerciseKind.WORD_BANK, ExerciseKind.CHESS_MOVE -> CompetenceLevel.APPLY
    }

/** One thing a unit teaches, as a course declares it: "Wortschatz", "Anwenden am Brett". */
data class SkillFacet(
    /** Unique within the unit: "vocab", "board". */
    val key: String,
    val title: String,
    /** The goal in a sentence the student reads: "Du erkennst die W\u00F6rter und rufst sie ohne Auswahl ab." */
    val goal: String,
    /**
     * The levels the unit's exercises have for this facet. Mastery needs evidence at every level above recognising
     * that is listed here, so a goal with typing in it is not mastered by choosing alone.
     */
    val levels: List<CompetenceLevel>,
    /** Facets of the same unit that come first. */
    val requires: List<String> = emptyList(),
    /** The facet of the previous unit this one builds on, if that unit has it. */
    val after: String? = null,
)

/** Which facet an exercise belongs to, and at which level it asks. */
data class SkillTag(val facet: String, val level: CompetenceLevel)

/**
 * A learning goal with its prerequisites. Ids are stable: unit id and facet key, so progress survives a new version
 * of the app as long as the course keeps its ids.
 */
data class Skill(
    val id: String,
    val courseID: String,
    val unitID: String,
    val unitNumber: Int,
    val unitTitle: String,
    val facet: String,
    val title: String,
    val goal: String,
    val levels: List<CompetenceLevel>,
    /** Skills that should be reached (at least provisionally) first. Soft: they steer what is suggested, never lock a step. */
    val prerequisites: List<String>,
    /** The lessons, the practice round and the checkpoint of the unit: the steps that show evidence of the skill. */
    val nodeIDs: List<String>,
)

/** The skills of a course and how they depend on each other. */
class SkillMap(val courseID: String, val skills: List<Skill>) {
    fun skill(id: String): Skill? = skills.firstOrNull { it.id == id }

    fun skillsInUnit(unitID: String): List<Skill> = skills.filter { it.unitID == unitID }

    /** Skills that need this one. */
    fun dependents(id: String): List<Skill> = skills.filter { id in it.prerequisites }

    /** Problems of the structure itself: a course with any of them is not shipped. */
    fun problems(): List<String> {
        val problems = mutableListOf<String>()
        val ids = skills.map { it.id }.toSet()
        if (ids.size != skills.size) problems.add("duplicate skill ids")
        for (skill in skills) {
            if (skill.levels.isEmpty()) problems.add("${skill.id}: no levels")
            if (skill.nodeIDs.isEmpty()) problems.add("${skill.id}: no steps")
            for (prerequisite in skill.prerequisites) {
                if (prerequisite !in ids) problems.add("${skill.id}: unknown prerequisite $prerequisite")
            }
            if (skill.id in skill.prerequisites) problems.add("${skill.id}: needs itself")
        }
        // Cycles: a depth-first walk that meets a skill on its own way down.
        val state = HashMap<String, Int>()
        fun visit(id: String): Boolean {
            if (state[id] == 2) return true
            if (state[id] == 1) return false
            state[id] = 1
            for (next in skill(id)?.prerequisites ?: emptyList()) {
                if (next in ids && !visit(next)) return false
            }
            state[id] = 2
            return true
        }
        for (skill in skills) {
            if (!visit(skill.id)) {
                problems.add("${skill.id}: prerequisites form a cycle")
                break
            }
        }
        return problems
    }

    companion object {
        fun build(provider: CourseProvider): SkillMap {
            val course = provider.course
            val skills = mutableListOf<Skill>()
            var previousFacets = HashMap<String, String>()
            for (unit in course.units) {
                val facets = provider.skillFacets(unit)
                val nodes = unit.nodes.filter { it.kind != de.maxifrz.lernwerk.learn.NodeKind.CHEST }.map { it.id }
                val current = HashMap<String, String>()
                for (facet in facets) {
                    val id = unit.id + "." + facet.key
                    current[facet.key] = id
                    val prerequisites = facet.requires.map { unit.id + "." + it }.toMutableList()
                    val earlier = facet.after?.let { previousFacets[it] }
                    if (earlier != null) prerequisites.add(earlier)
                    skills.add(
                        Skill(
                            id = id, courseID = course.id, unitID = unit.id, unitNumber = unit.number, unitTitle = unit.title,
                            facet = facet.key, title = facet.title, goal = facet.goal, levels = facet.levels,
                            prerequisites = prerequisites, nodeIDs = nodes,
                        ),
                    )
                }
                previousFacets = current
            }
            return SkillMap(course.id, skills)
        }
    }
}
