package de.maxifrz.lernwerk.learn

// Which steps of a course are done, open or locked. A port of CoursePath.swift (and `LessonState` of LearnPath.swift).

enum class LessonState { LOCKED, OPEN, DONE }

data class PathStep(val node: CourseNode, val state: LessonState) {
    /** The node's id. */
    val id: String get() = node.id
}

/** A unit with its steps, for the path's banner and nodes. */
data class PathUnit(
    val section: CourseSection,
    /** The section's number in the course, from 1. */
    val sectionNumber: Int,
    val unit: CourseUnit,
    val steps: List<PathStep>,
) {
    /** The unit's id. */
    val id: String get() = unit.id
    val isDone: Boolean get() = steps.all { it.state == LessonState.DONE }
    val doneCount: Int get() = steps.count { it.state == LessonState.DONE }
}

/**
 * Which steps of a course are done, open or locked. The steps open one after the other through the whole course, as
 * on a path: exactly one step is open, the first that is not done. The finished ones come from the progress.
 */
object CoursePath {
    fun units(course: Course, completed: Set<String>): List<PathUnit> {
        // Only the first step that is not done is open; everything after it stays locked, whatever the saved set says.
        var frontierFound = false
        val result = mutableListOf<PathUnit>()
        course.sections.forEachIndexed { sectionIndex, section ->
            for (unit in section.units) {
                val steps = unit.nodes.map { node ->
                    val state = when {
                        node.id in completed -> LessonState.DONE
                        frontierFound -> LessonState.LOCKED
                        else -> { frontierFound = true; LessonState.OPEN }
                    }
                    PathStep(node, state)
                }
                result.add(PathUnit(section, sectionIndex + 1, unit, steps))
            }
        }
        return result
    }

    /** The step to do next, or null when the course is finished. */
    fun current(units: List<PathUnit>): PathStep? {
        for (unit in units) for (step in unit.steps) if (step.state == LessonState.OPEN) return step
        return null
    }

    /** Lessons, practice rounds and checkpoints done, of all of them; chests do not count. */
    fun fraction(course: Course, completed: Set<String>): Double {
        val counted = course.nodes.filter { it.kind != NodeKind.CHEST }
        if (counted.isEmpty()) return 0.0
        return counted.count { it.id in completed }.toDouble() / counted.size
    }

    fun isFinished(course: Course, completed: Set<String>): Boolean = course.nodes.all { it.id in completed }

    /** Gems in a chest: 10, 15 or 20, by the unit's number, so the course pays out the same every time. */
    fun chestGems(node: CourseNode): Int = 10 + (node.unitNumber % 3) * 5

    /** The step after this one, for "next lesson" after a finished round. */
    fun next(node: CourseNode, course: Course): CourseNode? {
        val nodes = course.nodes
        val index = nodes.indexOfFirst { it.id == node.id }
        if (index < 0 || index + 1 >= nodes.size) return null
        return nodes[index + 1]
    }
}
