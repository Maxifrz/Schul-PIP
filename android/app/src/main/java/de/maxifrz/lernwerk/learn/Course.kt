package de.maxifrz.lernwerk.learn

import de.maxifrz.lernwerk.learn.skills.CompetenceLevel
import de.maxifrz.lernwerk.learn.skills.SkillFacet
import de.maxifrz.lernwerk.learn.skills.SkillMap
import de.maxifrz.lernwerk.learn.skills.SkillTag
import de.maxifrz.lernwerk.learn.skills.standardLevel

// Courses: kinds, nodes, units, sections and the provider interface. A port of Course.swift.

/** What a course is about; the Lernpfad groups its course picker by this. */
enum class CourseKind(val raw: String, val title: String) {
    LANGUAGE("language", "Sprachen"),
    SCHOOL("school", "Schulfächer"),
    MATH("math", "Mathe"),
    CHESS("chess", "Schach"),
    MUSIC("music", "Musik"),
}

/** The steps of a unit, in the order of the path. */
enum class NodeKind(val raw: String) {
    /** A new lesson. */
    LESSON("lesson"),

    /** A round over what the unit taught. */
    PRACTICE("practice"),

    /** The unit's test: the longest round, and the one that marks the unit as learned. */
    CHECKPOINT("checkpoint"),

    /** A reward in gems; tapping it opens it. */
    CHEST("chest"),
}

data class CourseNode(
    /** Unique across all courses, like "es.u03.l2". It is also what the progress stores as done. */
    val id: String,
    val courseID: String,
    val unitID: String,
    /** The unit's number in the course, from 1. */
    val unitNumber: Int,
    val kind: NodeKind,
    /** Among the lessons of its unit from 1; always 1 for the other kinds. */
    val index: Int,
    val title: String,
)

data class CourseUnit(
    val id: String,
    /** From 1, across the sections of the course. */
    val number: Int,
    val title: String,
    /** One line under the title: what the unit is about. */
    val summary: String,
    /** The unit's guide: what to know before the first lesson. Short paragraphs separated by blank lines. */
    val tip: String,
    val nodes: List<CourseNode>,
) {
    companion object {
        /** Three lessons, a practice round, the checkpoint and a chest, as on the path. */
        fun standard(courseID: String, number: Int, title: String, summary: String, tip: String, lessons: Int = 3): CourseUnit {
            val unitID = "$courseID.u" + (if (number < 10) "0$number" else "$number")
            fun node(suffix: String, kind: NodeKind, index: Int, nodeTitle: String) =
                CourseNode("$unitID.$suffix", courseID, unitID, number, kind, index, nodeTitle)
            val count = maxOf(1, lessons)
            val nodes = mutableListOf<CourseNode>()
            for (i in 1..count) nodes.add(node("l$i", NodeKind.LESSON, i, "Lektion $i"))
            nodes.add(node("p", NodeKind.PRACTICE, 1, "Üben"))
            nodes.add(node("t", NodeKind.CHECKPOINT, 1, "Einheitentest"))
            nodes.add(node("k", NodeKind.CHEST, 1, "Truhe"))
            return CourseUnit(unitID, number, title, summary, tip, nodes)
        }
    }
}

/** A group of units under one heading, like "A1 · Erste Schritte". */
data class CourseSection(val id: String, val title: String, val units: List<CourseUnit>)

data class Course(
    val id: String,
    val title: String,
    /** Who it is for and where it starts: "Für Deutschsprachige · A1". */
    val subtitle: String,
    val kind: CourseKind,
    /** The course's color as 0xRRGGBB, like the subjects' in `Subjects`. */
    val color: Int,
    /** An icon name for the course (an SF Symbol on iOS); the path shows it on the checkpoints. */
    val symbol: String,
    val sections: List<CourseSection>,
) {
    /** All units of all sections, in order. */
    val units: List<CourseUnit> = sections.flatMap { it.units }

    /** All nodes of all units, in order. */
    val nodes: List<CourseNode> = units.flatMap { it.nodes }

    fun node(id: String): CourseNode? = nodes.firstOrNull { it.id == id }

    /**
     * Whether text on the course's color should be dark: only on light colors. White text on a mid-tone color reads
     * better to the eye than the maths of contrast says, and still has at least 3:1.
     */
    val prefersDarkText: Boolean
        get() {
            fun channel(shift: Int): Double {
                val value = ((color ushr shift) and 0xFF) / 255.0
                return if (value <= 0.03928) value / 12.92 else Math.pow((value + 0.055) / 1.055, 2.4)
            }
            val luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
            // White's contrast is 1.05 / (L + 0.05): 3:1 at L = 0.30.
            return luminance > 0.3
        }
}

/**
 * One course's content: its structure and the exercises of each of its steps. The skill methods have defaults, like
 * Swift's protocol extension: override them where a course knows better.
 */
interface CourseProvider {
    val course: Course

    /**
     * The exercises of a lesson, practice or checkpoint node, 8 to 12 (a checkpoint up to 15), easy to hard. The same
     * seed gives the same exercises; another seed shuffles the same material differently. A chest has none.
     */
    fun exercises(node: CourseNode, seed: ULong): List<LearnExercise>

    /** The goals a unit teaches; the default is one per unit. */
    fun skillFacets(unit: CourseUnit): List<SkillFacet> =
        listOf(
            SkillFacet(
                key = "main", title = unit.title, goal = "Du beherrschst: " + unit.summary,
                levels = listOf(CompetenceLevel.RECOGNISE, CompetenceLevel.RECALL), after = "main",
            ),
        )

    /** Which goal an exercise of a step shows evidence of, and at which level. */
    fun skillTag(exercise: LearnExercise, node: CourseNode): SkillTag = SkillTag("main", exercise.kind.standardLevel)

    /** Why a wrong answer is wrong, when the course can tell from the exercise and the answer; null for none. */
    fun feedback(exercise: LearnExercise, answer: LearnAnswer): String? = null

    /**
     * The exercises of a step with the skill and level each one shows evidence of. A tag that names a facet the unit
     * does not declare is dropped, so evidence never goes to a skill that is not on the map.
     */
    fun lessonExercises(node: CourseNode, seed: ULong): List<LearnExercise> {
        val unit = course.units.firstOrNull { it.id == node.unitID }
        val facets = if (unit != null) skillFacets(unit).map { it.key }.toSet() else emptySet()
        return exercises(node, seed).map { exercise ->
            val tag = skillTag(exercise, node)
            if (tag.facet in facets) exercise.copy(skill = node.unitID + "." + tag.facet, level = tag.level) else exercise
        }
    }

    fun skillMap(): SkillMap = SkillMap.build(this)
}

/** Checks the structure the screens rely on; the tests run it for every course. */
fun CourseProvider.structureProblems(): List<String> {
    val course = this.course
    val problems = mutableListOf<String>()
    val ids = course.nodes.map { it.id }
    if (ids.toSet().size != ids.size) problems.add("Node ids are not unique.")
    if (course.units.isEmpty()) problems.add("No units.")
    course.units.forEachIndexed { index, unit ->
        if (unit.number != index + 1) problems.add("Unit ${unit.id} is number ${unit.number}, expected ${index + 1}.")
    }
    for (unit in course.units) {
        if (unit.title.isEmpty() || unit.tip.isEmpty()) problems.add("Unit ${unit.id} has no title or tip.")
        if (unit.nodes.none { it.kind == NodeKind.CHECKPOINT }) problems.add("Unit ${unit.id} has no checkpoint.")
        for (node in unit.nodes) {
            if (!node.id.startsWith(course.id + ".")) problems.add("Node ${node.id} does not start with the course id.")
        }
    }
    return problems
}
