package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.CourseAudit
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.CourseNode
import de.maxifrz.lernwerk.learn.ExerciseKind
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.LearnAnswer
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.NoteValue
import de.maxifrz.lernwerk.learn.Pitch
import de.maxifrz.lernwerk.learn.StaffNote
import de.maxifrz.lernwerk.learn.StaffSpec
import de.maxifrz.lernwerk.learn.ToneSpec
import de.maxifrz.lernwerk.learn.missedKeys
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * Port of LernwerkTests/MusicCourseTests.swift: structure, audit, and the facts of the exercises re-computed from
 * tables written down here, independent of the code that generated them.
 */
class MusicCourseTest {
    private val provider = musicProvider
    private val seeds: List<ULong> = (1..20).map { it.toULong() }

    private class Item(val node: CourseNode, val exercise: LearnExercise)

    private val cache = HashMap<String, List<Item>>()

    private fun all(
        unit: Int,
        kinds: Set<NodeKind> = setOf(NodeKind.LESSON, NodeKind.PRACTICE, NodeKind.CHECKPOINT),
        own: Boolean = true,
    ): List<Item> = cache.getOrPut("$unit|${kinds.sorted()}|$own") {
        val prefix = "music.u" + unit.toString().padStart(2, '0') + "."
        val result = mutableListOf<Item>()
        for (node in provider.course.nodes) {
            if (node.unitNumber != unit || node.kind !in kinds) continue
            for (seed in seeds) {
                for (exercise in provider.exercises(node, seed)) if (!own || exercise.id.startsWith(prefix)) result.add(Item(node, exercise))
            }
        }
        result
    }

    private fun staff(e: LearnExercise): StaffSpec? = (e.media as? ExerciseMedia.Staff)?.staff
    private fun tones(e: LearnExercise): ToneSpec? = (e.media as? ExerciseMedia.Tones)?.tones
    private fun typed(e: LearnExercise, text: String): Set<String> = e.missedKeys(LearnAnswer.Typed(text))
    private fun parsePitch(name: String, octave: Int = 4): Pitch {
        val parsed = MusicNames.parse(name)!!
        return Pitch(parsed.letter, octave, parsed.alteration)
    }

    // structure

    @Test fun courseShape() {
        val course = provider.course
        assertEquals("music", course.id)
        assertEquals("Musik", course.title)
        assertEquals("Noten lesen, hören, verstehen", course.subtitle)
        assertEquals(CourseKind.MUSIC, course.kind)
        assertEquals(0x9E6B8E, course.color)
        assertEquals("music.note", course.symbol)
        assertEquals(8, course.units.size)
        assertEquals(8, course.sections.flatMap { it.units }.size)
        for (unit in course.units) {
            assertEquals(6, unit.nodes.size)
            val paragraphs = unit.tip.split("\n\n")
            assertTrue("${unit.id} tip has ${paragraphs.size} paragraphs", paragraphs.size in 2..5)
            assertTrue(unit.summary.isNotEmpty())
        }
        assertEquals(
            listOf(
                "Notenlinien und Violinschlüssel", "Bassschlüssel und Klaviatur", "Notenwerte und Pausen", "Vorzeichen", "Tonleitern",
                "Intervalle", "Dreiklänge", "Tonarten und Quintenzirkel",
            ),
            course.units.map { it.title },
        )
    }

    @Test fun auditIsClean() {
        assertEquals(emptyList<String>(), CourseAudit.problems(provider, seeds))
    }

    private fun hasEmoji(text: String): Boolean = text.codePoints().anyMatch { it in 0x1F300..0x1FAFF }

    @Test fun everyNodeHasTwoKindsAndNoEmojiOrPlaceholder() {
        for (node in provider.course.nodes) {
            if (node.kind == NodeKind.CHEST) continue
            for (seed in seeds) {
                val list = provider.exercises(node, seed)
                assertTrue("${node.id} seed $seed", list.map { it.kind }.toSet().size >= 2)
                for (e in list) {
                    val text = (listOf(e.prompt, e.solution, e.explanation) + e.options + e.correctAnswers).joinToString(" ")
                    assertFalse(text.contains("TODO"))
                    assertFalse(hasEmoji(text))
                }
            }
        }
    }

    @Test fun seedsChangeTheExercises() {
        for (node in provider.course.nodes) {
            if (node.kind == NodeKind.CHEST) continue
            fun ids(s: ULong) = provider.exercises(node, s).map { it.id }
            val a = ids(1uL)
            val b = ids(2uL)
            val c = ids(3uL)
            assertTrue("${node.id} ignores the seed", a != b || a != c)
        }
    }

    @Test fun practiceMixesEarlierUnits() {
        for (unit in 2..8) {
            val ids = all(unit, setOf(NodeKind.PRACTICE), false).map { it.exercise.id }.toSet()
            val prefix = "music.u" + unit.toString().padStart(2, '0') + "."
            assertTrue("practice of unit $unit has no review", ids.any { !it.startsWith(prefix) })
        }
    }

    @Test fun someVarietyPerUnit() {
        for (unit in 1..8) {
            val ids = all(unit).map { it.exercise.id }.toSet()
            assertTrue("unit $unit has only ${ids.size} distinct exercises", ids.size > 60)
        }
    }

    // typed answers and options

    @Test fun typedNoteNamesAcceptBothCases() {
        var checked = 0
        for (unit in 1..8) {
            for ((_, exercise) in all(unit).map { it.node to it.exercise }) {
                if (exercise.kind != ExerciseKind.TYPE_ANSWER || exercise.mode != de.maxifrz.lernwerk.learn.AnswerMode.EXACT) continue
                val answer = exercise.correctAnswers.firstOrNull() ?: continue
                val parsed = MusicNames.parse(answer) ?: continue
                for (text in listOf(answer, answer.lowercase(), " $answer ")) {
                    assertEquals("${exercise.id} rejects $text", 0, typed(exercise, text).size)
                }
                val neighbour = Pitch((parsed.letter + 1) % 7, 4, parsed.alteration).germanName
                assertTrue("${exercise.id} accepts $neighbour", typed(exercise, neighbour).isNotEmpty())
                assertTrue(typed(exercise, answer + "is").isNotEmpty())
                checked++
            }
        }
        assertTrue(checked > 100)
    }

    @Test fun noChoiceOffersAnEnharmonicOfTheAnswer() {
        var checked = 0
        for (unit in 1..8) {
            for (item in all(unit)) {
                val exercise = item.exercise
                if (exercise.kind != ExerciseKind.MULTIPLE_CHOICE) continue
                val answer = exercise.correctAnswers.firstOrNull()
                val right = if (answer == null) null else MusicNames.parse(answer)
                if (right == null) continue
                val rightClass = Pitch(right.letter, 4, right.alteration).pitchClass
                for (option in exercise.options) {
                    if (option == answer) continue
                    val parsed = MusicNames.parse(option) ?: continue
                    assertNotEquals("${exercise.id}: $option sounds like $answer", rightClass, Pitch(parsed.letter, 4, parsed.alteration).pitchClass)
                }
                checked++
            }
        }
        assertTrue(checked > 200)
    }

    @Test fun noSignsBeforeTheyAreTaught() {
        for (unit in 1..3) {
            for (item in all(unit)) {
                val exercise = item.exercise
                for (text in exercise.options + exercise.correctAnswers + exercise.prompt) {
                    val parsed = MusicNames.parse(text)
                    if (parsed != null) assertEquals("${exercise.id}: $text", 0, parsed.alteration)
                }
                val spec = staff(exercise)
                if (spec != null) assertTrue(exercise.id, spec.notes.all { it.pitch.alteration == 0 })
            }
        }
    }

    // units 1 and 2

    private val trebleNames = listOf("E", "F", "G", "A", "H", "C", "D", "E", "F", "G", "A")
    private val bassNames = listOf("G", "A", "H", "C", "D", "E", "F", "G", "A", "H", "C")

    private fun expectedName(note: StaffNote, clef: String): String? {
        val diatonic = note.pitch.octave * 7 + note.pitch.letter
        if (clef == "treble") {
            val step = diatonic - (4 * 7 + 2)
            if (step in 0..10) return trebleNames[step]
            return if (step == -1) "D" else if (step == -2) "C" else null
        }
        if (clef == "bass") {
            val step = diatonic - (2 * 7 + 4)
            if (step in 0..10) return bassNames[step]
            return if (step == -1) "F" else if (step == -2) "E" else null
        }
        return null
    }

    @Test fun staffReadingAnswersMatchTheStaff() {
        var checked = 0
        for (unit in 1..2) {
            for (item in all(unit)) {
                val exercise = item.exercise
                if (!(exercise.id.contains(".read.") || exercise.id.contains(".type.") || exercise.id.contains(".mixed."))) continue
                val spec = staff(exercise)
                assertTrue("${exercise.id} has no staff", spec != null && spec.notes.isNotEmpty())
                assertEquals(exercise.id, expectedName(spec!!.notes[0], spec.clef.raw), exercise.correctAnswers[0])
                checked++
            }
        }
        assertTrue(checked > 500)
    }

    @Test fun placeAndCompareQuestions() {
        val phrases = mapOf(
            "auf der 1. Linie" to 0, "im 1. Zwischenraum" to 1, "auf der 2. Linie" to 2, "im 2. Zwischenraum" to 3, "auf der 3. Linie" to 4,
            "im 3. Zwischenraum" to 5, "auf der 4. Linie" to 6, "im 4. Zwischenraum" to 7, "auf der 5. Linie" to 8, "über der 5. Linie" to 9,
            "auf der 1. Hilfslinie über dem System" to 10,
        )
        for (unit in 1..2) {
            for (item in all(unit)) {
                val exercise = item.exercise
                if (!exercise.id.contains(".place.")) continue
                val names = if (unit == 1) trebleNames else bassNames
                var step: Int? = null
                for ((phrase, value) in phrases) if (exercise.prompt.contains(phrase)) step = maxOf(step ?: -99, value)
                if (step != null) assertEquals(exercise.id, names[step], exercise.correctAnswers[0])
                else if (exercise.prompt.contains("unter der 1. Linie")) assertEquals(if (unit == 1) "D" else "F", exercise.correctAnswers[0])
                else if (exercise.prompt.contains("Hilfslinie unter dem System")) assertEquals(if (unit == 1) "C" else "E", exercise.correctAnswers[0])
                else fail("unknown position in ${exercise.prompt}")
            }
        }
        for (item in all(2)) {
            val exercise = item.exercise
            if (!exercise.id.contains(".compare.")) continue
            val step = exercise.id.split(".").last().toInt()
            assertTrue(exercise.prompt.contains("heißt sie ${trebleNames[step]}"))
            assertEquals(bassNames[step], exercise.correctAnswers[0])
            assertTrue("the wrong clef reading is offered", exercise.options.contains(trebleNames[step]))
        }
    }

    @Test fun keyboardQuestions() {
        val pitchClasses = mapOf("C" to 0, "D" to 2, "E" to 4, "F" to 5, "G" to 7, "A" to 9, "H" to 11)
        var named = 0
        var anyOctave = 0
        var fromStaff = 0
        for (item in all(2)) {
            val exercise = item.exercise
            if (exercise.kind != ExerciseKind.PIANO_KEY) continue
            val keys = exercise.correctAnswers.map { it.toInt() }
            if (exercise.prompt.startsWith("Tippe das ")) {
                assertEquals(exercise.prompt, 1, keys.size)
                val last = exercise.prompt.split(" ").last()
                val letter = last.dropLast(1).uppercase()
                val octave = if (exercise.prompt.contains("eingestrichene")) 4
                else if (exercise.prompt.contains("zweigestrichene")) 5
                else if (exercise.prompt.contains("kleine")) 3 else 2
                assertEquals(exercise.prompt, 12 * (octave + 1) + pitchClasses[letter]!!, keys[0])
                named++
            } else if (exercise.prompt.startsWith("Tippe ein ")) {
                val letter = exercise.prompt.substring("Tippe ein ".length).take(1)
                assertTrue(exercise.prompt, keys.all { it % 12 == pitchClasses[letter] })
                assertEquals(MusicNames.keys(pitchClasses[letter]!!).size, keys.size)
                anyOctave++
            } else {
                val spec = staff(exercise)
                if (spec != null && spec.notes.isNotEmpty()) {
                    assertEquals(listOf(spec.notes[0].pitch.midi), keys)
                    fromStaff++
                }
            }
        }
        assertTrue(named > 20)
        assertTrue(anyOctave > 20)
        assertTrue(fromStaff > 20)
        val middle = all(2).filter { it.exercise.prompt == "Tippe das eingestrichene c." }
        assertTrue(middle.isNotEmpty())
        for (item in middle) assertEquals(listOf("60"), item.exercise.correctAnswers)
    }

    // unit 3

    private val sixteenthsByName = mapOf(
        "Ganze Note" to 16, "Halbe Note" to 8, "Viertelnote" to 4, "Achtelnote" to 2, "Sechzehntelnote" to 1,
        "Ganze Pause" to 16, "Halbe Pause" to 8, "Viertelpause" to 4, "Achtelpause" to 2, "Sechzehntelpause" to 1,
    )
    private val beatTexts = mapOf(16 to "4", 8 to "2", 4 to "1", 2 to "1/2", 1 to "1/4")

    @Test fun noteValueExercises() {
        var names = 0
        var beats = 0
        var bars = 0
        var types = 0
        for (item in all(3)) {
            val exercise = item.exercise
            val spec = staff(exercise)
            val first = spec?.notes?.firstOrNull()
            if ((exercise.id.contains(".name.") || exercise.id.contains(".rest.")) && first != null) {
                assertEquals(exercise.id, sixteenthsByName[exercise.correctAnswers[0]], first.value.sixteenths)
                assertEquals(exercise.id.contains(".rest."), first.isRest)
                names++
            }
            if (exercise.id.contains(".beats.") && first != null) {
                assertEquals(beatTexts[first.value.sixteenths], exercise.correctAnswers[0])
                beats++
            }
            if (exercise.id.contains(".valuetype.") && first != null) {
                assertEquals(sixteenthsByName[exercise.correctAnswers[0]], first.value.sixteenths)
                types++
            }
            if (exercise.id.contains(".fill.") && exercise.kind == ExerciseKind.MULTIPLE_CHOICE && spec != null && spec.time != null) {
                val bar = if (spec.time == "4/4") 16 else 12
                val used = spec.notes.sumOf { it.value.sixteenths }
                assertEquals(exercise.id, bar, used + sixteenthsByName[exercise.correctAnswers[0]]!!)
                bars++
            }
            if (exercise.id.contains(".barbeats.") && spec != null && spec.time != null) {
                val used = spec.notes.sumOf { if (it.value == NoteValue.HALF) 8 else if (it.value == NoteValue.QUARTER) 4 else 2 }
                assertEquals(exercise.id, (used / 4.0), exercise.correctAnswers[0].toDouble(), 0.0)
                assertTrue(listOf("4/4", "3/4").contains(spec.time))
            }
            if (exercise.id.contains(".ratio.") && exercise.kind == ExerciseKind.TYPE_ANSWER) {
                val smalls = listOf("Sechzehntelnoten" to 1, "Achtelnoten" to 2, "Viertelnoten" to 4, "Halbe Noten" to 8)
                val bigs = listOf("Ganze Note" to 16, "Halbe Note" to 8, "Viertelnote" to 4, "Achtelnote" to 2)
                val small = smalls.first { exercise.prompt.contains(it.first) }.second
                val big = bigs.first { exercise.prompt.endsWith("wie eine ${it.first}? Schreibe eine Zahl.") }.second
                assertEquals(exercise.prompt, big / small, exercise.correctAnswers[0].toInt())
            }
        }
        assertTrue(names > 50)
        assertTrue(beats > 20)
        assertTrue(bars > 20)
        assertTrue(types > 20)
    }

    @Test fun numberAnswersAreAcceptedInAnyForm() {
        val fraction = all(3).firstOrNull { it.exercise.id.contains(".beatstype.eighth") }?.exercise
        assertNotNull(fraction)
        for (text in listOf("1/2", "0,5", "0.5")) assertEquals(text, 0, typed(fraction!!, text).size)
        assertTrue(typed(fraction!!, "1").isNotEmpty())
    }

    // unit 4

    @Test fun signExercises() {
        val names4 = mapOf(
            "0.1" to "Cis", "1.1" to "Dis", "3.1" to "Fis", "4.1" to "Gis", "5.1" to "Ais", "6.-1" to "B", "2.-1" to "Es", "5.-1" to "As",
            "1.-1" to "Des", "4.-1" to "Ges",
        )
        var acc = 0
        var steps = 0
        var ears = 0
        var keys = 0
        val pcs = mapOf("Cis" to 1, "Dis" to 3, "Fis" to 6, "Gis" to 8, "Ais" to 10, "Des" to 1, "Es" to 3, "Ges" to 6, "As" to 8, "B" to 10)
        for (item in all(4)) {
            val exercise = item.exercise
            val spec = staff(exercise)
            if ((exercise.id.contains(".acc.") || exercise.id.contains(".acctype.")) && spec?.notes?.firstOrNull() != null) {
                val note = spec.notes[0]
                assertEquals(exercise.id, names4["${note.pitch.letter}.${note.pitch.alteration}"], exercise.correctAnswers[0])
                acc++
            }
            if (exercise.id.contains(".step.") && spec != null && spec.notes.size == 2) {
                val diff = spec.notes[1].pitch.midi - spec.notes[0].pitch.midi
                assertEquals(if (diff == 1) "Halbton" else "Ganzton", exercise.correctAnswers[0])
                steps++
            }
            val t = tones(exercise)
            if (exercise.id.contains(".hear.") && t != null) {
                assertEquals(2, t.midi.size)
                assertFalse(t.together)
                val diff = t.midi[1] - t.midi[0]
                assertTrue(diff == 1 || diff == 2)
                assertEquals(if (diff == 1) "Halbton" else "Ganzton", exercise.correctAnswers[0])
                ears++
            }
            if (exercise.kind == ExerciseKind.PIANO_KEY) {
                val name = exercise.solution
                assertTrue(exercise.id, exercise.correctAnswers.all { it.toInt() % 12 == pcs[name] })
                assertTrue(exercise.correctAnswers.all { listOf(1, 3, 6, 8, 10).contains(it.toInt() % 12) })
                keys++
            }
            if (exercise.id.contains(".raise.")) assertTrue(exercise.correctAnswers[0].endsWith("is"))
            if (exercise.id.contains(".lower.")) {
                val base = exercise.prompt.split(" ")[1]
                assertEquals(mapOf("H" to "B", "E" to "Es", "A" to "As", "D" to "Des", "G" to "Ges")[base], exercise.correctAnswers[0])
            }
        }
        assertTrue(acc > 60)
        assertTrue(steps > 20)
        assertTrue(ears > 20)
        assertTrue(keys > 20)
    }

    // unit 5

    private val scales = mapOf(
        "C-Dur" to listOf("C", "D", "E", "F", "G", "A", "H", "C"), "G-Dur" to listOf("G", "A", "H", "C", "D", "E", "Fis", "G"),
        "F-Dur" to listOf("F", "G", "A", "B", "C", "D", "E", "F"), "D-Dur" to listOf("D", "E", "Fis", "G", "A", "H", "Cis", "D"),
        "B-Dur" to listOf("B", "C", "D", "Es", "F", "G", "A", "B"), "A-Moll" to listOf("A", "H", "C", "D", "E", "F", "G", "A"),
        "E-Moll" to listOf("E", "Fis", "G", "A", "H", "C", "D", "E"), "D-Moll" to listOf("D", "E", "F", "G", "A", "B", "C", "D"),
    )
    private val scaleSigns = mapOf(
        "C-Dur" to "keine Vorzeichen", "G-Dur" to "Fis", "F-Dur" to "B", "D-Dur" to "Fis und Cis", "B-Dur" to "B und Es",
        "A-Moll" to "keine Vorzeichen", "E-Moll" to "Fis", "D-Moll" to "B",
    )

    @Test fun scaleExercises() {
        var staffs = 0
        var missing = 0
        var degrees = 0
        var banks = 0
        for (item in all(5)) {
            val exercise = item.exercise
            val spec = staff(exercise)
            if (exercise.id.contains(".staff.") && spec != null) {
                val answer = exercise.correctAnswers[0]
                val diffs = spec.notes.drop(1).mapIndexed { i, n -> n.pitch.midi - spec.notes[i].pitch.midi }
                assertEquals(exercise.id, if (answer.endsWith("Dur")) listOf(2, 2, 1, 2, 2, 2, 1) else listOf(2, 1, 2, 2, 1, 2, 2), diffs)
                assertEquals(exercise.id, scales[answer], spec.notes.map { it.pitch.germanName })
                staffs++
            }
            if (exercise.id.contains(".missing.")) {
                val name = exercise.prompt.substring(0, exercise.prompt.indexOf(':'))
                val body = exercise.prompt.substring(name.length + 2).split(". Welcher")[0]
                val shown = body.split(" – ")
                val index = shown.indexOf("?")
                assertEquals(exercise.id, scales[name]!![index], exercise.correctAnswers[0])
                shown.forEachIndexed { i, text -> if (i != index) assertEquals(scales[name]!![i], text) }
                missing++
            }
            if (exercise.id.contains(".degree.")) {
                val tail = exercise.prompt.split(" der ").last()
                val name = tail.substring(0, tail.indexOf('-')) + "-" + (if (exercise.prompt.contains("Dur-Tonleiter")) "Dur" else "Moll")
                val number = exercise.prompt.split(". Ton")[0].split(" ").last().toInt()
                assertEquals(exercise.prompt, scales[name]!![number - 1], exercise.correctAnswers[0])
                degrees++
            }
            if (exercise.id.contains(".bank.")) {
                val name = exercise.id.split(".").last()
                assertEquals(scales[name]!!.dropLast(1), exercise.correctAnswers)
                for (extra in exercise.options) {
                    if (!exercise.correctAnswers.contains(extra)) assertFalse("extra tile $extra belongs to $name", scales[name]!!.contains(extra))
                }
                banks++
            }
            if (exercise.id.contains(".acc.")) {
                val name = exercise.id.split(".acc.").last()
                assertEquals(exercise.id, scaleSigns[name], exercise.correctAnswers[0])
            }
        }
        assertTrue(staffs > 30)
        assertTrue(missing > 60)
        assertTrue(degrees > 30)
        assertTrue(banks > 20)
    }

    @Test fun scalePairsAndFirstLessonScope() {
        val lesson1 = provider.course.nodes.first { it.id == "music.u05.l1" }
        for (seed in seeds) {
            for (e in provider.exercises(lesson1, seed)) {
                if (e.id.contains(".missing.") || e.id.contains(".degree.") || e.id.contains(".bank.")) {
                    assertTrue(e.id, e.id.contains("C-Dur") || e.id.contains("G-Dur") || e.id.contains("pattern"))
                }
            }
        }
        for (item in all(5)) {
            if (!item.exercise.id.contains(".pairs.")) continue
            for (pair in item.exercise.pairs) assertEquals(scaleSigns[pair.front], pair.back)
        }
    }

    // unit 6

    private class IntervalFact(val steps: Int, val semis: Int)

    private val intervalFacts = mapOf(
        "reine Prim" to IntervalFact(0, 0), "kleine Sekunde" to IntervalFact(1, 1), "große Sekunde" to IntervalFact(1, 2),
        "kleine Terz" to IntervalFact(2, 3), "große Terz" to IntervalFact(2, 4), "reine Quarte" to IntervalFact(3, 5),
        "reine Quinte" to IntervalFact(4, 7), "kleine Sexte" to IntervalFact(5, 8), "große Sexte" to IntervalFact(5, 9),
        "kleine Septime" to IntervalFact(6, 10), "große Septime" to IntervalFact(6, 11), "reine Oktave" to IntervalFact(7, 12),
    )
    private val sizeSteps = mapOf("Prim" to 0, "Sekunde" to 1, "Terz" to 2, "Quarte" to 3, "Quinte" to 4, "Sexte" to 5, "Septime" to 6, "Oktave" to 7)
    private fun factFor(prompt: String): IntervalFact = intervalFacts.entries.first { prompt.contains(it.key) }.value

    @Test fun intervalExercises() {
        var named = 0
        var numbers = 0
        var built = 0
        var ears = 0
        var semisAsked = 0
        for (item in all(6)) {
            val exercise = item.exercise
            val spec = staff(exercise)
            if ((exercise.id.contains(".name.") || exercise.id.contains(".nametype.")) && spec != null && spec.notes.size == 2) {
                val facts = intervalFacts[exercise.correctAnswers[0]]!!
                val a = spec.notes[0].pitch
                val b = spec.notes[1].pitch
                assertEquals(exercise.id, facts.semis, b.midi - a.midi)
                assertEquals(exercise.id, facts.steps, b.diatonic - a.diatonic)
                named++
            }
            if (exercise.id.contains(".num.") && spec != null && spec.notes.size == 2) {
                assertEquals(exercise.id, sizeSteps[exercise.correctAnswers[0]], spec.notes[1].pitch.diatonic - spec.notes[0].pitch.diatonic)
                numbers++
            }
            if ((exercise.id.contains(".build.") || exercise.id.contains(".buildchoice.")) && spec?.notes?.firstOrNull() != null) {
                val base = spec.notes[0].pitch
                val facts = factFor(exercise.prompt)
                val parsed = MusicNames.parse(exercise.correctAnswers[0])!!
                val answer = Pitch(parsed.letter, 0, parsed.alteration)
                val letterSteps = (parsed.letter - base.letter + 7) % 7
                assertEquals(exercise.id, facts.steps % 7, letterSteps)
                assertEquals(exercise.id, facts.semis % 12, (answer.pitchClass - base.pitchClass + 12) % 12)
                built++
            }
            val t = tones(exercise)
            if (exercise.id.contains(".hear.") && t != null) {
                assertFalse(t.together)
                assertEquals(exercise.id, intervalFacts[exercise.correctAnswers[0]]!!.semis, t.midi[1] - t.midi[0])
                ears++
            }
            if (exercise.id.contains(".semis.") && intervalFacts.keys.any { exercise.prompt.contains(it) }) {
                assertEquals(factFor(exercise.prompt).semis, exercise.correctAnswers[0].toInt())
                semisAsked++
            }
            if (exercise.id.contains(".invert.")) {
                val original = factFor(exercise.prompt)
                val inverse = intervalFacts[exercise.correctAnswers[0]]!!
                assertEquals(12, inverse.semis + original.semis)
                assertEquals(7, inverse.steps + original.steps)
            }
            if (exercise.kind == ExerciseKind.PIANO_KEY) {
                val facts = factFor(exercise.prompt)
                val baseName = exercise.prompt.split(" über ").last().split(" ")[0]
                val base = parsePitch(baseName)
                val expected = (base.pitchClass + facts.semis) % 12
                assertTrue(exercise.id, exercise.correctAnswers.all { it.toInt() % 12 == expected })
            }
        }
        assertTrue(named > 60)
        assertTrue(numbers > 60)
        assertTrue(built > 60)
        assertTrue(ears > 60)
        assertTrue(semisAsked > 20)
    }

    @Test fun earExercisesOnlyUseWhatTheLessonTaught() {
        val allowed = mapOf("music.u06.l2" to listOf(2, 3, 4, 5, 7, 12), "music.u06.l3" to listOf(3, 4, 5, 7, 8, 9, 10, 12))
        for (node in provider.course.nodes) {
            if (node.unitNumber != 6 || node.kind == NodeKind.CHEST) continue
            for (seed in seeds) {
                for (exercise in provider.exercises(node, seed)) {
                    val spec = tones(exercise) ?: continue
                    assertNotEquals("music.u06.l1", node.id)
                    val pool = allowed[node.id]
                    if (pool != null) {
                        assertTrue("${node.id}: ${spec.midi}", pool.contains(spec.midi[1] - spec.midi[0]))
                        for (option in exercise.options) {
                            assertTrue("${node.id}: option $option", pool.contains(intervalFacts[option]!!.semis))
                        }
                    }
                    assertNotEquals("no tritone by ear", 6, spec.midi[1] - spec.midi[0])
                }
            }
        }
        val early = provider.course.nodes.filter { it.unitNumber == 4 && it.index == 1 && it.kind == NodeKind.LESSON }
        for (node in early) assertTrue(provider.exercises(node, 1uL).all { tones(it) == null })
    }

    // unit 7

    private val triads = mapOf(
        "C-Dur" to listOf("C", "E", "G"), "G-Dur" to listOf("G", "H", "D"), "F-Dur" to listOf("F", "A", "C"), "D-Dur" to listOf("D", "Fis", "A"),
        "A-Moll" to listOf("A", "C", "E"), "E-Moll" to listOf("E", "G", "H"), "D-Moll" to listOf("D", "F", "A"), "Es-Dur" to listOf("Es", "G", "B"),
        "B-Dur" to listOf("B", "D", "F"), "As-Dur" to listOf("As", "C", "Es"), "G-Moll" to listOf("G", "B", "D"), "C-Moll" to listOf("C", "Es", "G"),
        "F-Moll" to listOf("F", "As", "C"),
    )

    @Test fun triadExercises() {
        var staffs = 0
        var ears = 0
        var missing = 0
        var banks = 0
        var pairs = 0
        for (item in all(7)) {
            val exercise = item.exercise
            val spec = staff(exercise)
            if (exercise.id.contains(".staff.") && spec != null) {
                assertTrue(spec.chord)
                assertEquals(exercise.id, triads[exercise.correctAnswers[0]], spec.notes.map { it.pitch.germanName })
                staffs++
            }
            if (exercise.id.contains(".kind.") && spec != null) {
                val diffs = spec.notes.drop(1).mapIndexed { i, n -> n.pitch.midi - spec.notes[i].pitch.midi }
                val major = diffs[0] == 4 && diffs[1] == 3
                val minor = diffs[0] == 3 && diffs[1] == 4
                assertEquals(if (major) "Dur" else "Moll", exercise.correctAnswers[0])
                assertTrue(major || minor)
            }
            val t = tones(exercise)
            if (exercise.id.contains(".hear.") && t != null) {
                assertTrue(t.together)
                val diffs = t.midi.drop(1).mapIndexed { i, m -> m - t.midi[i] }
                val major = diffs[0] == 4 && diffs[1] == 3
                assertTrue("${t.midi}", major || (diffs[0] == 3 && diffs[1] == 4))
                assertEquals(if (major) "Dur" else "Moll", exercise.correctAnswers[0])
                assertEquals(listOf("Dur", "Moll"), exercise.options.sorted())
                ears++
            }
            if (exercise.id.contains(".missing.")) {
                val name = exercise.prompt.substring(0, exercise.prompt.indexOf(':'))
                val shown = exercise.prompt.substring(name.length + 2).split(". Welcher")[0].split(" – ")
                assertEquals(triads[name]!![shown.indexOf("?")], exercise.correctAnswers[0])
                missing++
            }
            if (exercise.id.contains(".bank.")) {
                assertEquals(triads[exercise.id.split(".bank.").last()], exercise.correctAnswers)
                banks++
            }
            if (exercise.id.contains(".pairs.")) {
                for (pair in exercise.pairs) assertEquals(triads[pair.front]!!.joinToString(" – "), pair.back)
                pairs++
            }
            if (exercise.id.contains(".part.")) {
                val name = exercise.prompt.split(" des ")[1].split("-Dreiklangs")[0]
                val index = if (exercise.prompt.contains("Terz")) 1 else 2
                assertEquals(triads[name]!![index], exercise.correctAnswers[0])
            }
        }
        assertTrue(staffs > 40)
        assertTrue(ears > 40)
        assertTrue(missing > 40)
        assertTrue(banks > 40)
        assertTrue(pairs > 10)
    }

    @Test fun hearingOnlyAfterBothQualitiesAreTaught() {
        val first = provider.course.nodes.first { it.id == "music.u07.l1" }
        for (seed in seeds) assertTrue(provider.exercises(first, seed).all { tones(it) == null })
    }

    // unit 8

    private val majors = mapOf(
        0 to "C-Dur", 1 to "G-Dur", 2 to "D-Dur", 3 to "A-Dur", 4 to "E-Dur", -1 to "F-Dur", -2 to "B-Dur", -3 to "Es-Dur", -4 to "As-Dur",
    )
    private val relatives = mapOf(
        "C-Dur" to "A-Moll", "G-Dur" to "E-Moll", "D-Dur" to "H-Moll", "A-Dur" to "Fis-Moll", "E-Dur" to "Cis-Moll", "F-Dur" to "D-Moll",
        "B-Dur" to "G-Moll", "Es-Dur" to "C-Moll", "As-Dur" to "F-Moll",
    )

    @Test fun keyExercises() {
        var reads = 0
        var notes = 0
        var relations = 0
        var circles = 0
        val sharpLetters = listOf(3, 0, 4, 1, 5, 2, 6)
        val flatLetters = listOf(6, 2, 5, 1, 4, 0, 3)
        val table = mapOf(
            1 to mapOf("F" to "Fis", "C" to "Cis", "G" to "Gis", "D" to "Dis"),
            -1 to mapOf("H" to "B", "E" to "Es", "A" to "As", "D" to "Des"),
        )
        val signs = mapOf(
            "C-Dur" to "keine Vorzeichen", "G-Dur" to "1 Kreuz", "D-Dur" to "2 Kreuze", "A-Dur" to "3 Kreuze", "E-Dur" to "4 Kreuze",
            "F-Dur" to "1 Be", "B-Dur" to "2 Be", "Es-Dur" to "3 Be", "As-Dur" to "4 Be",
        )
        for (item in all(8)) {
            val exercise = item.exercise
            val spec = staff(exercise)
            if (exercise.id.contains(".read.") && spec != null) {
                assertEquals(exercise.id, majors[spec.keySignature], exercise.correctAnswers[0])
                reads++
            }
            if (exercise.id.contains(".readminor.") && spec != null) {
                assertEquals(exercise.id, relatives[majors[spec.keySignature]], exercise.correctAnswers[0])
            }
            if ((exercise.id.contains(".note.") || exercise.id.contains(".notetype.")) && spec?.notes?.firstOrNull() != null) {
                val note = spec.notes[0]
                val key = spec.keySignature
                val expected = if (key > 0 && sharpLetters.take(key).contains(note.pitch.letter)) 1
                else if (key < 0 && flatLetters.take(-key).contains(note.pitch.letter)) -1 else 0
                assertEquals(expected, note.pitch.alteration)
                val letter = letterNames[note.pitch.letter]
                assertEquals(exercise.id, if (expected == 0) letter else table[expected]!![letter], exercise.correctAnswers[0])
                notes++
            }
            if (exercise.id.contains(".relminor") || exercise.id.contains(".relmajor")) {
                val major = if (exercise.prompt.contains("Paralleltonart von ")) exercise.prompt.split("Paralleltonart von ")[1].dropLast(1)
                else exercise.correctAnswers[0]
                val minor = if (exercise.id.contains(".relmajor")) exercise.prompt.split("gehört ")[1].split(" als")[0] else exercise.correctAnswers[0]
                assertEquals(exercise.id, relatives[major], minor)
                relations++
            }
            if (exercise.id.contains(".keyof")) {
                val count = exercise.id.split(".").last().toIntOrNull()
                if (count != null) assertEquals(exercise.id, majors[count], exercise.correctAnswers[0])
            }
            if (exercise.id.contains(".circle.")) {
                val up = exercise.prompt.contains("über")
                val from = exercise.prompt.split(if (up) "über " else "unter ").last().dropLast(1)
                val start = majors.entries.first { it.value == from }.key
                assertEquals(majors[start + (if (up) 1 else -1)], exercise.correctAnswers[0])
                circles++
            }
            if (exercise.id.contains(".order.") && exercise.kind == ExerciseKind.WORD_BANK) {
                val a = exercise.correctAnswers
                assertTrue(a == listOf("Fis", "Cis", "Gis", "Dis") || a == listOf("B", "Es", "As", "Des"))
            }
            if (exercise.id.contains(".pairs.") && exercise.kind == ExerciseKind.MATCH_PAIRS && exercise.pairs.firstOrNull()?.back?.contains("Moll") != true) {
                for (pair in exercise.pairs) assertEquals(signs[pair.front], pair.back)
            }
        }
        assertTrue(reads > 40)
        assertTrue(notes > 40)
        assertTrue(relations > 40)
        assertTrue(circles > 20)
    }

    // media rules

    @Test fun mediaIsOnlyStaffAndTones() {
        val withStaff = sortedSetOf<Int>()
        val withTones = sortedSetOf<Int>()
        for (unit in 1..8) {
            for (item in all(unit)) {
                val exercise = item.exercise
                when (exercise.media) {
                    null -> {}
                    is ExerciseMedia.Staff -> withStaff.add(unit)
                    is ExerciseMedia.Tones -> withTones.add(unit)
                    else -> fail("${exercise.id} uses media the course must not use")
                }
                assertTrue(
                    listOf(ExerciseKind.MULTIPLE_CHOICE, ExerciseKind.PIANO_KEY, ExerciseKind.TYPE_ANSWER, ExerciseKind.WORD_BANK, ExerciseKind.MATCH_PAIRS)
                        .contains(exercise.kind),
                )
                if (exercise.kind == ExerciseKind.PIANO_KEY) assertTrue(exercise.correctAnswers.isNotEmpty())
            }
        }
        assertEquals(listOf(1, 2, 3, 4, 5, 6, 7, 8), withStaff.toList())
        assertEquals(listOf(4, 6, 7), withTones.toList())
    }
}
