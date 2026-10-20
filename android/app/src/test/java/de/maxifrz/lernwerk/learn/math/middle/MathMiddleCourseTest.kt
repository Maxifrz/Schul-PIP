package de.maxifrz.lernwerk.learn.math.middle

import de.maxifrz.lernwerk.learn.CourseAudit
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.ExerciseKind
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.NumberCheck
import de.maxifrz.lernwerk.learn.structureProblems
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.close
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.draws
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.match
import de.maxifrz.lernwerk.learn.math.middle.MathMiddleKit.number
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Port of LernwerkTests/MathCourseMiddleTests.swift: structure, determinism, audit, and the soundness of every
 * template at every level. The exactness against the Swift output is in MathMiddleFixtureTest.
 */
class MathMiddleCourseTest {
    private val provider = mathMiddleProvider

    private fun chars(s: String): Int = s.codePointCount(0, s.length)
    private fun idHead(id: String): String = id.split(".").take(2).joinToString(".")

    // Structure

    @Test fun theCourseDescribesItself() {
        val course = provider.course
        assertEquals("mathm", course.id)
        assertEquals("Mathe Mittelstufe", course.title)
        assertEquals("Klasse 5 bis 10", course.subtitle)
        assertEquals(CourseKind.MATH, course.kind)
        assertEquals(0x3D6FB6, course.color)
        assertEquals("percent", course.symbol)
        assertEquals(10, course.units.size)
        assertEquals(emptyList<String>(), provider.structureProblems())
        assertEquals(
            listOf(
                "Brüche verstehen", "Bruchrechnung", "Dezimalzahlen und Prozent", "Terme und lineare Gleichungen",
                "Dreisatz und Proportionalität", "Lineare Funktionen", "Potenzen und Wurzeln", "Geometrie",
                "Quadratische Gleichungen und Funktionen", "Wahrscheinlichkeit",
            ),
            course.units.map { it.title },
        )
        for (unit in course.units) {
            assertEquals(
                unit.id,
                listOf(NodeKind.LESSON, NodeKind.LESSON, NodeKind.LESSON, NodeKind.PRACTICE, NodeKind.CHECKPOINT, NodeKind.CHEST),
                unit.nodes.map { it.kind },
            )
            val paragraphs = unit.tip.split("\n\n").filter { it.isNotEmpty() }
            assertTrue("${unit.id} tip has ${paragraphs.size} paragraphs", paragraphs.size in 2..5)
            assertTrue(unit.summary.isNotEmpty())
        }
    }

    @Test fun theSkillMapIsTheDefaultOneSkillPerUnit() {
        val map = provider.skillMap()
        assertEquals(10, map.skills.size)
        assertEquals(emptyList<String>(), map.problems())
        for (skill in map.skills) assertEquals("main", skill.facet)
    }

    @Test fun theCatalogHasTenUnitsWithEnoughTemplates() {
        val units = MathMiddleCatalog.units
        assertEquals(10, units.size)
        units.forEachIndexed { index, templates ->
            val prefix = "u" + (index + 1).toString().padStart(2, '0') + "."
            assertTrue("unit ${index + 1}", templates.size >= 5)
            assertTrue("unit ${index + 1} template ids", templates.all { it.id.startsWith(prefix) })
            assertEquals("unit ${index + 1} duplicate ids", templates.size, templates.map { it.id }.toSet().size)
            for (lesson in 1..3) assertTrue("unit ${index + 1} lesson $lesson", templates.count { it.lesson == lesson } >= 2)
            assertTrue(templates.any { it.forms.contains(MathMiddleForm.TYPED) })
            assertTrue(templates.any { it.forms.contains(MathMiddleForm.PAIRS) })
        }
    }

    @Test fun theAuditFindsNothing() {
        assertEquals(emptyList<String>(), CourseAudit.problems(provider, (1..20).map { it.toULong() }))
    }

    @Test fun theSameSeedGivesTheSameExercisesAndAnotherSeedOthers() {
        for (node in provider.course.nodes) {
            if (node.kind == NodeKind.CHEST) {
                assertEquals(emptyList<LearnExercise>(), provider.exercises(node, 1uL))
                continue
            }
            assertEquals(node.id, provider.exercises(node, 7uL), provider.exercises(node, 7uL))
            assertNotEquals(node.id, provider.exercises(node, 7uL).map { it.prompt }, provider.exercises(node, 8uL).map { it.prompt })
        }
    }

    @Test fun lessonExercisesTagsEveryExerciseWithTheUnitSkill() {
        for (node in provider.course.nodes) {
            if (node.kind == NodeKind.CHEST) continue
            for (e in provider.lessonExercises(node, 3uL)) {
                assertEquals(node.unitID + ".main", e.skill)
                assertNotNull(e.level)
            }
        }
    }

    // Every exercise of every node, many seeds

    @Test fun everyExerciseOfEverySeedIsSound() {
        val messages = mutableListOf<String>()
        var typedCount = 0
        var choiceCount = 0
        var pairCount = 0
        for (node in provider.course.nodes) {
            if (node.kind == NodeKind.CHEST) continue
            for (s in 1..30) {
                val seed = s.toULong()
                val exercises = provider.exercises(node, seed)
                messages.addAll(CourseAudit.problemsInExercises(exercises, node).map { "$it (seed $s)" })
                val kinds = exercises.map { it.kind }.toSet()
                if (kinds.size < 2) messages.add("${node.id} seed $s: fewer than two kinds")
                if (ExerciseKind.TYPE_ANSWER !in kinds) messages.add("${node.id} seed $s: nothing to type")
                val asked = exercises.map { it.prompt + "|" + it.options.sorted().joinToString(";") }
                if (asked.toSet().size != asked.size) messages.add("${node.id} seed $s: the same question twice")
                for (exercise in exercises) {
                    val label = "${node.id} seed $s ${exercise.id}"
                    if (exercise.explanation.trim().isEmpty()) messages.add("$label: no explanation")
                    if (chars(exercise.prompt) > 260) messages.add("$label: prompt too long")
                    when (exercise.kind) {
                        ExerciseKind.TYPE_ANSWER -> {
                            typedCount += 1
                            if (exercise.mode != AnswerMode.NUMBER) messages.add("$label: typed answer not in number mode")
                            for (answer in exercise.correctAnswers) {
                                val value = NumberCheck.parse(answer)
                                if (value == null) {
                                    messages.add("$label: answer $answer does not parse")
                                    continue
                                }
                                if (Math.abs(value.doubleValue) >= 1000) messages.add("$label: typed answer $answer is 1000 or more")
                                // The answer written as a decimal and, for a mixed number, as one is accepted as well.
                                if (!NumberCheck.matches(value.germanText, answer)) messages.add("$label: ${value.germanText} not accepted")
                                if (!NumberCheck.matches(value.fractionText, answer)) messages.add("$label: ${value.fractionText} not accepted")
                            }
                        }
                        ExerciseKind.MULTIPLE_CHOICE -> {
                            choiceCount += 1
                            if (exercise.options.size < 3) messages.add("$label: only ${exercise.options.size} options")
                        }
                        ExerciseKind.MATCH_PAIRS -> pairCount += 1
                        else -> messages.add("$label: unexpected kind ${exercise.kind}")
                    }
                }
            }
        }
        assertEquals(messages.take(12).joinToString("\n"), 0, messages.size)
        assertTrue(typedCount > 0)
        assertTrue(choiceCount > 0)
        assertTrue(pairCount > 0)
    }

    @Test fun everyUnitUsesAllThreeFormsAndEveryTemplateIsAskedInItsCheckpoint() {
        for (unit in provider.course.units) {
            val kinds = mutableSetOf<ExerciseKind>()
            for (node in unit.nodes) {
                if (node.kind == NodeKind.CHEST) continue
                for (s in 1..5) provider.exercises(node, s.toULong()).forEach { kinds.add(it.kind) }
            }
            assertEquals(unit.id, setOf(ExerciseKind.MULTIPLE_CHOICE, ExerciseKind.MATCH_PAIRS, ExerciseKind.TYPE_ANSWER), kinds)
            val checkpoint = unit.nodes.firstOrNull { it.kind == NodeKind.CHECKPOINT } ?: continue
            val templates = MathMiddleCatalog.units[unit.number - 1]
            for (s in 1..30) {
                val asked = provider.exercises(checkpoint, s.toULong()).map { idHead(it.id) }.toSet()
                // At most one template may be missing: a draw of the numbers can fail now and then.
                assertTrue("${checkpoint.id} seed $s", templates.count { it.id !in asked } <= 1)
            }
        }
    }

    @Test fun lessonsTeachTheirOwnThirdAndReviewTheEarlierOnes() {
        for (unit in provider.course.units) {
            val templates = MathMiddleCatalog.units[unit.number - 1]
            for (node in unit.nodes) {
                if (node.kind != NodeKind.LESSON) continue
                var own = 0
                var total = 0
                for (s in 1..20) {
                    for (exercise in provider.exercises(node, s.toULong())) {
                        val id = idHead(exercise.id)
                        val template = templates.firstOrNull { it.id == id }
                        if (template == null) {
                            org.junit.Assert.fail("${exercise.id} is no template of ${unit.id}")
                            continue
                        }
                        total += 1
                        if (template.lesson == node.index) own += 1
                        assertTrue("${node.id} asks ${template.id} before it is taught", template.lesson <= node.index)
                    }
                }
                assertTrue("${node.id} mostly teaches its own templates", own.toDouble() / total.toDouble() >= 0.6)
            }
        }
    }

    @Test fun practiceMixesEarlierUnits() {
        for (unit in provider.course.units) {
            if (unit.number < 2) continue
            val practice = unit.nodes.firstOrNull { it.kind == NodeKind.PRACTICE } ?: continue
            var earlier = 0
            for (s in 1..20) {
                for (exercise in provider.exercises(practice, s.toULong())) {
                    val number = exercise.id.drop(1).take(2).toIntOrNull() ?: 0
                    assertTrue(practice.id, number <= unit.number)
                    if (number < unit.number) earlier += 1
                }
            }
            assertTrue("${practice.id} reviews earlier units", earlier > 20 * 2)
        }
    }

    // Every template

    @Test fun everyTemplateIsSoundAtEveryLevel() {
        val forbidden = listOf("Optional", "(null)", "1/0", "/0 ", "[", "]")
        val failures = mutableListOf<String>()
        fun fail(message: String) { failures.add(message) }
        for (templates in MathMiddleCatalog.units) {
            for (t in templates) {
                var choiceReady = 0
                var typedDraws = 0
                var typedSmall = 0
                val all = draws(t.id)
                for (level in 1..3) {
                    val atLevel = all.filter { it.level == level }
                    if (atLevel.size < 30) fail("${t.id} level $level rarely makes a problem")
                    if (atLevel.map { it.problem.key }.toSet().size < 5) fail("${t.id} level $level has too little variety")
                    for (draw in atLevel) {
                        val p = draw.problem
                        val label = "${t.id} L$level seed ${draw.seed}"
                        if (p.prompt.isEmpty() || p.correct.isEmpty() || p.solution.isEmpty() || p.explanation.isEmpty()) fail(label)
                        val everything = listOf(p.prompt, p.correct, p.solution, p.explanation, p.typed?.prompt ?: "", p.pairFront ?: "") + p.wrong.map { it.text }
                        for (text in everything) {
                            for (word in forbidden) if (text.contains(word)) fail("$label: contains $word: $text")
                            if (match("\\b(nan|inf)\\b", text) != null) fail("$label: not a number in $text")
                            // A minus zero is a slip; a negative decimal like -0,5 is fine. (Swift's pattern names the
                            // figure dash U+2012; the real minus sign U+2212 is checked as well.)
                            if (match("‒0(?![,.\\d])", text) != null) fail("$label: minus zero in $text")
                            if (match("−0(?![,.\\d])", text) != null) fail("$label: minus zero in $text")
                            if (match("\\d\\s*-\\s*\\d", text) != null || text.contains("*") || text.contains("×")) fail("$label: ASCII operator in $text")
                            if (chars(text) > 260) fail("$label: text too long")
                        }
                        if ((p.typed != null) != t.forms.contains(MathMiddleForm.TYPED)) fail("$label: typed form")
                        if ((p.pairFront != null) != t.forms.contains(MathMiddleForm.PAIRS)) fail("$label: pair form")
                        // The wrong options: no two alike for the exercise factory, none equal to the right one.
                        val options = p.options
                        val foldedAll = (listOf(p.correct) + options).map { LearnExercise.folded(it) }
                        if (foldedAll.toSet().size != foldedAll.size) fail("$label: options alike")
                        // Whatever the student sees as a wrong option is not worth the same as the right one.
                        val right = number(p.correct)
                        if (right != null && p.correctValue != null && !p.allowsEquivalentWrong) {
                            for (option in options) {
                                val value = number(option)
                                if (value != null && close(value, right)) fail("$label: the wrong option $option is worth the same as ${p.correct}")
                            }
                        }
                        if (options.size >= 2) choiceReady += 1
                        val typed = p.typed
                        if (typed != null) {
                            typedDraws += 1
                            if (!typed.answer.doubleValue.isFinite()) fail(label)
                            if (Math.abs(typed.answer.doubleValue) < 1000) typedSmall += 1
                            if (!NumberCheck.matches(typed.answer.fractionText, typed.answer.fractionText)) fail(label)
                        }
                    }
                }
                if (t.forms.contains(MathMiddleForm.CHOICE) && choiceReady.toDouble() / all.size.toDouble() < 0.9) fail("${t.id} rarely has enough wrong options")
                if (t.forms.contains(MathMiddleForm.TYPED) && typedSmall.toDouble() / typedDraws.toDouble() < 0.95) fail("${t.id} asks for big typed numbers")
            }
        }
        assertEquals(failures.take(12).joinToString("\n"), 0, failures.size)
    }

    @Test fun theTestExpressionReaderReadsTheNotationOfThePrompts() {
        assertEquals(4.25, MathMiddleExpr.evaluate("2 3/4 + 1 1/2")!!, 1e-9)
        assertEquals(6.0, MathMiddleExpr.evaluate("3(x − 4)", mapOf('x' to 6.0))!!, 0.0)
        assertEquals(-2.0, MathMiddleExpr.evaluate("(−2)³ : 4")!!, 0.0)
        assertEquals(0.125, MathMiddleExpr.evaluate("2⁻³")!!, 1e-9)
        assertEquals(5.0, MathMiddleExpr.evaluate("√(9 + 16)")!!, 0.0)
        assertNull(MathMiddleExpr.evaluate("1/0"))
        assertEquals(true, MathMiddleExpr.holds("2x + 1 = 7", 3.0))
        assertEquals(false, MathMiddleExpr.holds("2x + 1 = 7", 4.0))
        assertEquals(-0.75, number("−3/4")!!, 1e-9)
        assertEquals(2.6, number("2 3/5 kg")!!, 1e-9)
        assertEquals(0.75, number("0,75 %")!!, 1e-9)
    }
}
