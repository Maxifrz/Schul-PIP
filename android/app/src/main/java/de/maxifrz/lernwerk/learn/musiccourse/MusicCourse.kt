package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.Course
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.CourseProvider
import de.maxifrz.lernwerk.learn.CourseSection
import de.maxifrz.lernwerk.learn.CourseUnit
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.NodeKind

// "Musik": eight units from the staff to keys and the circle of fifths. Every note name, interval and chord is
// computed by the theory code at run time, so the course cannot teach a wrongly spelled note.
// A port of MusicCourse.swift.

const val MUSIC_COURSE_ID = "music"

object MusicUnits {
    val defs: List<MusicUnitDef> by lazy {
        listOf(MusicUnit1.def, MusicUnit2.def, MusicUnit3.def, MusicUnit4.def, MusicUnit5.def, MusicUnit6.def, MusicUnit7.def, MusicUnit8.def)
    }
}

class MusicProvider : CourseProvider {
    override val course: Course = run {
        val units = musicTexts.mapIndexed { index, text ->
            CourseUnit.standard(MUSIC_COURSE_ID, index + 1, text.title, text.summary, text.tip)
        }
        Course(
            id = MUSIC_COURSE_ID, title = "Musik", subtitle = "Noten lesen, hören, verstehen", kind = CourseKind.MUSIC,
            color = 0x9E6B8E, symbol = "music.note",
            sections = listOf(
                CourseSection("music.s1", "Notenlesen", units.subList(0, 2)),
                CourseSection("music.s2", "Rhythmus und Vorzeichen", units.subList(2, 4)),
                CourseSection("music.s3", "Tonleitern und Intervalle", units.subList(4, 6)),
                CourseSection("music.s4", "Dreiklänge und Tonarten", units.subList(6, 8)),
            ),
        )
    }

    override fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> {
        if (node.kind == NodeKind.CHEST || node.unitNumber !in 1..MusicUnits.defs.size) return emptyList()
        val random = LearnRandom(Exercises.seed(node, seed))
        val def = MusicUnits.defs[node.unitNumber - 1]
        val topics = when (node.kind) {
            NodeKind.LESSON -> def.lessons[minOf(maxOf(node.index, 1), def.lessons.size) - 1]
            NodeKind.PRACTICE -> def.practice
            else -> def.checkpoint
        }
        val level = if (node.kind == NodeKind.LESSON) node.index else 4
        val made = mutableListOf<LearnExercise>()
        val used = HashSet<String>()
        for (topic in topics) {
            for (attempt in 0 until 12) {
                val exercise = if (topic == "~") review(node.unitNumber, random) else def.makers[topic]?.invoke(random, level)
                if (exercise != null && used.add(exercise.id)) {
                    made.add(exercise)
                    break
                }
            }
        }
        return Exercises.arrange(made, 15)
    }

    /** A question about an earlier unit. */
    private fun review(before: Int, random: LearnRandom): LearnExercise? {
        if (before <= 1) return null
        val index = random.randomElement((0 until before - 1).toList()) ?: return null
        val def = MusicUnits.defs[index]
        val topic = random.randomElement(def.review) ?: return null
        return def.makers[topic]?.invoke(random, 4)
    }
}

val musicProvider: CourseProvider = MusicProvider()
