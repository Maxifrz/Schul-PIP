package de.maxifrz.lernwerk.learn.math.upper

import de.maxifrz.lernwerk.learn.CourseAudit
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.ExerciseKind
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.NumberCheck
import de.maxifrz.lernwerk.learn.AnswerMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Ports of LernwerkTests/MathCourseUpperBasicsTests.swift and MathCourseUpperTests.swift. The exact parity with the
// Swift output is in UpperFixtureTest.
class UpperCourseTest {
    private val provider = mathUpperProvider

    // Same draws as the Swift kit: 300 seeds per level.
    private val kitSeeds = 300

    // Basics

    @Test fun fractions() {
        assertEquals(UQ(1, 2), UQ(2, 4))
        assertEquals(UQ(-1, 2), UQ(1, -2))
        assertEquals(UQ(5, 6), UQ(1, 2) + UQ(1, 3))
        assertEquals(UQ(1, 2), UQ(3, 4) * UQ(2, 3))
        assertEquals(UQ(2), UQ(1, 2) / UQ(1, 4))
        assertEquals("0,375", UQ(3, 8).text)
        assertEquals("1/3", UQ(1, 3).text)
        assertEquals("-0,5", UQ(-1, 2).typed)
        assertEquals("−0,5", UQ(-1, 2).text)
        assertTrue(UQ(1, 36).isNice)
        assertFalse(UQ(1, 37).isNice)
    }

    @Test fun polynomialPrinting() {
        assertEquals("3x² − 4x + 1", UPoly.ints(listOf(1, -4, 3)).text)
        assertEquals("x³", UPoly.ints(listOf(0, 0, 0, 1)).text)
        assertEquals("−x² + 2", UPoly.ints(listOf(2, 0, -1)).text)
        assertEquals("−5", UPoly.ints(listOf(-5)).text)
        assertEquals("−x", UPoly.ints(listOf(0, -1)).text)
        assertEquals("3x⁶ + x", UPoly.ints(listOf(0, 1, 0, 0, 0, 0, 3)).text)
        assertEquals("0", UPoly.ints(emptyList()).text)
        assertEquals("x⁴/4", UPoly.ints(listOf(0, 0, 0, 1)).integral.text)
        assertEquals("2x³/3", UPoly.ints(listOf(0, 0, 2)).integral.text)
        assertEquals("x²/2 + 3x", UPoly.ints(listOf(3, 1)).integral.text)
    }

    @Test fun polynomialAlgebra() {
        val f = UPoly.fromRoots(UQ(2), listOf(UQ(1), UQ(-3)))
        assertEquals(UPoly.ints(listOf(-6, 4, 2)), f)
        assertEquals(UQ.zero, f.eval(UQ(1)))
        assertEquals(UQ.zero, f.eval(UQ(-3)))
        assertEquals(UPoly.ints(listOf(4, 4)), f.derivative)
        assertEquals(f, f.integral.derivative)
        assertEquals(UPoly.ints(listOf(-1, 0, 1)), UPoly.ints(listOf(1, 1)) * UPoly.ints(listOf(-1, 1)))
        assertEquals(UQ(17), UPoly.ints(listOf(1, 2, 3)).eval(UQ(2)))
    }

    @Test fun binomialCoefficientsAgainstPascal() {
        for (n in 0..12) {
            val row = MathUpperKit.binomialDoubles(n)
            for (k in 0..n) assertEquals("$n over $k", row[k], MathUpperUnit07.binomial(n, k).toDouble(), 0.0)
        }
        assertEquals(10, MathUpperUnit07.binomial(5, 2))
        assertEquals(0, MathUpperUnit07.binomial(3, 4))
    }

    @Test fun exactBinomialProbabilitiesSumToOne() {
        for (n in 1..6) {
            for (p in listOf(UQ(1, 2), UQ(1, 4), UQ(1, 5), UQ(3, 10), UQ(7, 10))) {
                var total = UQ.zero
                for (k in 0..n) total = total + MathUpperUnit07.pmf(n, p, k)
                assertEquals("n=$n p=${p.fraction}", UQ.one, total)
            }
        }
    }

    @Test fun exactTrigTable() {
        for (fn in listOf("sin", "cos", "tan")) {
            for (degrees in -360..720 step 15) {
                val value = MathUpperUnit05.exact(fn, degrees) ?: continue
                val radians = degrees * Math.PI / 180
                val parsed = MathUpperKit.parseExact(value.text)
                assertNotNull("unreadable exact text for $fn $degrees", parsed)
                assertEquals("$fn $degrees", MathUpperKit.trig(fn, radians), parsed!!, 1e-9)
            }
        }
        assertNull(MathUpperUnit05.exact("tan", 90))
    }

    @Test fun answerCheckAcceptsFractionAndDecimal() {
        assertTrue(NumberCheck.matches("0,375", "3/8"))
        assertTrue(NumberCheck.matches("3/8", UQ(3, 8).typed))
        assertTrue(NumberCheck.matches("−2", UQ(-2).typed))
        assertFalse(NumberCheck.matches("38", "3/8"))
    }

    // Course

    @Test fun audit() {
        assertEquals(emptyList<String>(), CourseAudit.problems(provider, (1..20).map { it.toULong() }))
    }

    @Test fun courseShape() {
        val course = provider.course
        assertEquals("matho", course.id)
        assertEquals("Mathe Oberstufe", course.title)
        assertEquals("Analysis, Vektoren, Stochastik", course.subtitle)
        assertEquals(CourseKind.MATH, course.kind)
        assertEquals(0x5A5AA8, course.color)
        assertEquals("function", course.symbol)
        assertEquals(7, course.units.size)
        assertEquals(
            listOf("Ableitung", "Kurvendiskussion", "Integralrechnung", "e-Funktion und Logarithmus", "Trigonometrie", "Vektoren", "Stochastik"),
            course.units.map { it.title },
        )
        for (unit in course.units) {
            assertEquals(
                listOf(NodeKind.LESSON, NodeKind.LESSON, NodeKind.LESSON, NodeKind.PRACTICE, NodeKind.CHECKPOINT, NodeKind.CHEST),
                unit.nodes.map { it.kind },
            )
            val paragraphs = unit.tip.split("\n\n").filter { it.isNotEmpty() }.size
            assertTrue(unit.id, paragraphs > 1)
            assertTrue(unit.id, paragraphs <= 5)
        }
    }

    @Test fun catalogMatchesGroups() {
        assertEquals(7, MathUpperCatalog.units.size)
        assertEquals(7, MathUpperCatalog.lessonGroups.size)
        assertEquals("template ids are unique", MathUpperKit.allIDs.size, MathUpperKit.allIDs.toSet().size)
        for ((index, groups) in MathUpperCatalog.lessonGroups.withIndex()) {
            assertEquals(3, groups.size)
            val unitIDs = MathUpperCatalog.units[index].map { it.id }.toSet()
            assertEquals("unit ${index + 1}: every template is taught in a lesson", unitIDs, groups.flatten().toSet())
            for (id in groups.flatten()) assertNotNull(id, MathUpperCatalog.template(id))
        }
    }

    @Test fun determinismAndVariety() {
        for (node in provider.course.nodes) {
            if (node.kind == NodeKind.CHEST) continue
            assertEquals(node.id, provider.exercises(node, 5uL), provider.exercises(node, 5uL))
            assertTrue(node.id, provider.exercises(node, 5uL).map { it.prompt } != provider.exercises(node, 6uL).map { it.prompt })
        }
    }

    @Test fun nodesMixFormsAndStayHonest() {
        for (node in provider.course.nodes) {
            if (node.kind == NodeKind.CHEST) {
                assertTrue(provider.exercises(node, 1uL).isEmpty())
                continue
            }
            for (seed in 1uL..60uL) {
                val exercises = provider.exercises(node, seed)
                val label = "${node.id} seed $seed"
                assertTrue(label, exercises.map { it.kind }.toSet().size >= 2)
                assertEquals(label, emptyList<String>(), CourseAudit.problemsInExercises(exercises, node))
                for (e in exercises) {
                    if (e.kind == ExerciseKind.TYPE_ANSWER) {
                        assertEquals(e.id, AnswerMode.NUMBER, e.mode)
                        for (answer in e.correctAnswers) {
                            val parsed = NumberCheck.parse(answer)
                            assertNotNull("${e.id} $answer", parsed)
                            if (parsed != null) {
                                assertTrue(e.id, NumberCheck.matches(answer, e.correctAnswers[0]))
                                assertTrue(e.id, Math.abs(parsed.doubleValue) < 100_000)
                            }
                        }
                    }
                    if (e.kind == ExerciseKind.MULTIPLE_CHOICE) {
                        assertEquals(e.id, 1, e.options.count { e.correctAnswers.contains(it) })
                        assertFalse(e.id, e.explanation.isEmpty())
                    }
                    assertFalse(e.id, e.explanation.isEmpty() && e.kind != ExerciseKind.MATCH_PAIRS)
                }
            }
        }
    }

    @Test fun everyUnitHasThreeFormsAcrossItsNodes() {
        for (unit in provider.course.units) {
            val kinds = mutableSetOf<ExerciseKind>()
            for (node in unit.nodes) {
                if (node.kind == NodeKind.CHEST) continue
                for (seed in 1uL..5uL) provider.exercises(node, seed).forEach { kinds.add(it.kind) }
            }
            assertTrue(unit.id, kinds.containsAll(listOf(ExerciseKind.MULTIPLE_CHOICE, ExerciseKind.TYPE_ANSWER, ExerciseKind.MATCH_PAIRS)))
        }
    }

    @Test fun everyTemplateIsReachableAndSound() {
        for (id in MathUpperKit.allIDs) {
            val draws = MathUpperKit.draws(id, kitSeeds)
            assertTrue("$id produces too few problems", draws.size > kitSeeds * 3 * 200 / 900)
            for (level in 1..3) assertTrue("$id level $level", draws.count { it.level == level } > kitSeeds * 40 / 300)
            assertTrue("$id is not varied enough", draws.map { it.problem.key }.toSet().size > 5)
        }
    }

    @Test fun allProblemsAreMathematicallyRight() {
        for (id in MathUpperKit.allIDs) {
            val found = mutableListOf<String>()
            for (draw in MathUpperKit.draws(id, kitSeeds)) found.addAll(MathUpperKit.problems(draw))
            assertEquals(id, emptyList<String>(), found.toSet().sorted().take(8))
        }
    }

    @Test fun unitsAreRepresentedInEveryNodeKind() {
        // Every template of a unit must show up in the unit's practice or checkpoint over many seeds.
        for ((index, unit) in provider.course.units.withIndex()) {
            val seen = mutableSetOf<String>()
            for (seed in 1uL..40uL) {
                for (node in unit.nodes) {
                    if (node.kind != NodeKind.PRACTICE && node.kind != NodeKind.CHECKPOINT) continue
                    provider.exercises(node, seed).forEach { seen.add(it.prompt) }
                }
            }
            assertTrue("unit ${index + 1}", seen.size > 40)
        }
    }
}
