package de.maxifrz.lernwerk.learn

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class CourseTest {
    private val sample = SampleCourse()

    private fun stateIds(units: List<PathUnit>, index: Int) = units[index].steps.map { it.state }

    @Test fun aUnitHasThreeLessonsPracticeCheckpointAndChest() {
        val unit = sample.course.units[0]
        assertEquals("sample.u01", unit.id)
        assertEquals(listOf("sample.u01.l1", "sample.u01.l2", "sample.u01.l3", "sample.u01.p", "sample.u01.t", "sample.u01.k"), unit.nodes.map { it.id })
        assertEquals(
            listOf(NodeKind.LESSON, NodeKind.LESSON, NodeKind.LESSON, NodeKind.PRACTICE, NodeKind.CHECKPOINT, NodeKind.CHEST),
            unit.nodes.map { it.kind },
        )
        assertEquals(listOf(1, 2, 3, 1, 1, 1), unit.nodes.map { it.index })
        assertEquals(18, sample.course.nodes.size)
        assertEquals(2, sample.course.node("sample.u02.t")?.unitNumber)
        assertEquals(emptyList<String>(), sample.structureProblems())
        assertEquals("x.u12", CourseUnit.standard("x", 12, "T", "", "t", 4).id)
        assertEquals(7, CourseUnit.standard("x", 1, "T", "", "t", 4).nodes.size)
    }

    @Test fun stepsOpenOneAfterTheOtherThroughTheWholeCourse() {
        var done = mutableSetOf<String>()
        var units = CoursePath.units(sample.course, done)
        assertEquals(3, units.size)
        assertEquals(listOf(LessonState.OPEN) + List(5) { LessonState.LOCKED }, stateIds(units, 0))
        assertEquals(LessonState.LOCKED, units[1].steps[0].state)
        assertEquals("sample.u01.l1", CoursePath.current(units)?.id)
        assertEquals(listOf(1, 2), listOf(units[0].sectionNumber, units[2].sectionNumber))

        for (node in sample.course.units[0].nodes) done.add(node.id)
        units = CoursePath.units(sample.course, done)
        assertTrue(units[0].isDone)
        assertEquals(LessonState.OPEN, units[1].steps[0].state) // the next unit opens when the chest is open
        assertEquals("sample.u02.l1", CoursePath.current(units)?.id)

        // Skipping ahead in the saved set does not open a step whose predecessor is not done.
        done = mutableSetOf("sample.u01.l1", "sample.u01.l3")
        units = CoursePath.units(sample.course, done)
        assertEquals(
            listOf(LessonState.DONE, LessonState.OPEN, LessonState.DONE, LessonState.LOCKED, LessonState.LOCKED, LessonState.LOCKED),
            stateIds(units, 0),
        )
        assertEquals(2, units[0].doneCount)
    }

    @Test fun progressCountsEverythingButChests() {
        val done = sample.course.units[0].nodes.map { it.id }.toMutableSet()
        assertEquals(5.0 / 15, CoursePath.fraction(sample.course, done), 1e-4)
        done.remove("sample.u01.k")
        assertEquals(5.0 / 15, CoursePath.fraction(sample.course, done), 1e-4)
        val all = sample.course.nodes.map { it.id }.toSet()
        assertEquals(1.0, CoursePath.fraction(sample.course, all), 0.0)
        assertTrue(CoursePath.isFinished(sample.course, all))
        assertFalse(CoursePath.isFinished(sample.course, done))
        assertNull(CoursePath.current(CoursePath.units(sample.course, all)))
        val empty = Course("e", "", "", CourseKind.MATH, 0, "", emptyList())
        assertEquals(0.0, CoursePath.fraction(empty, emptySet()), 0.0)
    }

    @Test fun chestsPayTenFifteenOrTwenty() {
        assertEquals(listOf(15, 20, 10), sample.course.nodes.filter { it.kind == NodeKind.CHEST }.map { CoursePath.chestGems(it) })
    }

    @Test fun nextNode() {
        val course = sample.course
        assertEquals("sample.u01.l2", CoursePath.next(course.nodes[0], course)?.id)
        assertNull(CoursePath.next(course.nodes.last(), course))
    }

    @Test fun textOnACourseColorIsTheOneThatContrastsMore() {
        fun dark(color: Int) = Course("c", "", "", CourseKind.MATH, color, "", emptyList()).prefersDarkText
        assertTrue(dark(0xFFFFFF))
        assertFalse(dark(0x000000))
        assertTrue(dark(0xB8A04A)) // the yellow of Deutsch als Fremdsprache
        assertTrue(dark(0xD9903A)) // orange
        assertFalse(dark(0x3D6FB6)) // blue
        assertFalse(dark(0x5A5AA8)) // indigo
        assertFalse(dark(0x9E6B8E)) // plum
    }

    @Test fun structureProblemsAreFound() {
        val good = CourseUnit.standard("broken", 1, "T", "", "t")
        val twin = CourseUnit.standard("broken", 1, "", "", "")
        val broken = object : CourseProvider {
            override val course = Course("broken", "B", "", CourseKind.MATH, 0, "x", listOf(CourseSection("s", "S", listOf(good, twin))))
            override fun exercises(node: CourseNode, seed: ULong) = emptyList<LearnExercise>()
        }
        val problems = broken.structureProblems()
        assertTrue(problems.any { it.contains("not unique") })
        assertTrue(problems.any { it.contains("no title or tip") })
        assertTrue(problems.any { it.contains("expected 2") })
    }

    @Test fun courseKindsHaveTheirGermanTitles() {
        assertEquals(listOf("Sprachen", "Schulfächer", "Mathe", "Schach", "Musik"), CourseKind.values().map { it.title })
    }

    @Test fun catalogRegistersProvidersAndFindsThemByCourseAndByNode() {
        CourseCatalog.clearProviders()
        assertEquals(emptyList<CourseProvider>(), CourseCatalog.providers())
        CourseCatalog.registerProvider(sample)
        CourseCatalog.registerProvider(sample) // the same course id replaces
        assertEquals(1, CourseCatalog.providers().size)
        assertSame(sample, CourseCatalog.provider("sample"))
        assertNull(CourseCatalog.provider("other"))
        for (p in CourseCatalog.providers()) assertEquals(p.course.id, CourseCatalog.providerForNode(p.course.nodes[0].id)?.course?.id)
        assertNull(CourseCatalog.providerForNode("sampler.u01.l1"))
        assertEquals(listOf("sample"), CourseCatalog.courses().map { it.id })
        CourseCatalog.clearProviders()
    }
}

class CourseAuditTest {
    private val random = LearnRandom(3uL)
    private val sample = SampleCourse()
    private fun node(kind: NodeKind = NodeKind.LESSON) = CourseNode("t.u01.l1", "t", "t.u01", 1, kind, 1, "x")

    @Test fun aWellFormedExerciseHasNoProblems() {
        val choice = Exercises.choice(id = "c", prompt = "Frage?", correct = "A", wrong = listOf("B", "C"), random = random)!!
        assertEquals(emptyList<String>(), CourseAudit.problemsInExercise(choice))
        val typed = Exercises.typed(id = "t", prompt = "Frage?", answer = "3/4", mode = AnswerMode.NUMBER)!!
        assertEquals(emptyList<String>(), CourseAudit.problemsInExercise(typed))
        val move = Exercises.move(id = "m", prompt = "Zieh.", board = BoardSpec("8/8/8/8/8/8/8/8 w - - 0 1"), accepted = listOf("e2e4", "e7e8q"), solution = "e4")!!
        assertEquals(emptyList<String>(), CourseAudit.problemsInExercise(move))
        val key = Exercises.key(id = "k", prompt = "Tippe C.", midi = listOf(60), solution = "C4")!!
        assertEquals(emptyList<String>(), CourseAudit.problemsInExercise(key))
    }

    @Test fun brokenExercisesAreFound() {
        val broken = LearnExercise(
            id = "b", kind = ExerciseKind.MULTIPLE_CHOICE, prompt = " ", correctAnswers = listOf("A"),
            options = listOf("A", "a", "B", "C", "D"), solution = "",
        )
        val found = CourseAudit.problemsInExercise(broken)
        assertTrue("empty prompt" in found)
        assertTrue("empty solution" in found)
        assertTrue("5 options" in found)
        assertTrue("options that read the same" in found)

        val wrongMove = LearnExercise(id = "m", kind = ExerciseKind.CHESS_MOVE, prompt = "?", correctAnswers = listOf("e2-e4", "z9a1"), solution = "s")
        assertTrue("a chess move without a board" in CourseAudit.problemsInExercise(wrongMove))

        val badKey = LearnExercise(id = "k", kind = ExerciseKind.PIANO_KEY, prompt = "?", correctAnswers = listOf("C4", "200"), solution = "s")
        assertEquals(2, CourseAudit.problemsInExercise(badKey).count { it.contains("not a piano key") })

        val sorted = LearnExercise(
            id = "w", kind = ExerciseKind.WORD_BANK, prompt = "?", correctAnswers = listOf("a", "b"),
            options = listOf("a", "b", "c", "d", "e"), solution = "a b",
        )
        val bank = CourseAudit.problemsInExercise(sorted)
        assertTrue("tiles come in the right order" in bank)
        assertTrue("too many extra tiles" in bank)
    }

    @Test fun lengthsOrderAndIdsOfALesson() {
        val easy = Exercises.choice(id = "easy", prompt = "?", correct = "A", wrong = listOf("B"), random = random)!!
        val hard = Exercises.typed(id = "hard", prompt = "?", answer = "A")!!
        assertTrue(CourseAudit.problemsInExercises(listOf(easy, hard), node()).any { it.contains("2 exercises, expected 8 to 12") })
        val backwards = CourseAudit.problemsInExercises(listOf(hard, easy, easy), node())
        assertTrue(backwards.any { it.contains("easy to hard") })
        assertTrue(backwards.any { it.contains("not unique") })
        val ten = (0 until 10).map { Exercises.typed(id = "t$it", prompt = "?", answer = "A")!! }
        assertEquals(emptyList<String>(), CourseAudit.problemsInExercises(ten, node()))
        assertEquals(emptyList<String>(), CourseAudit.problemsInExercises(ten, node(NodeKind.CHECKPOINT)))
        assertNotEquals(emptyList<String>(), CourseAudit.problemsInExercises(ten.take(9), node(NodeKind.CHECKPOINT))) // a checkpoint has at least ten
    }

    @Test fun aProviderIsRunThroughEveryNode() {
        val lazy = object : CourseProvider {
            override val course = sample.course
            override fun exercises(node: CourseNode, seed: ULong) = emptyList<LearnExercise>()
        }
        val problems = CourseAudit.problems(lazy, listOf(1uL))
        assertTrue(problems.any { it.contains("sample.u01.l1: 0 exercises") })
        assertFalse(problems.any { it.contains(".k:") }) // chests have no exercises
    }

    // Extra cases
    @Test fun aChestWithExercisesAndANonDeterministicProviderAreReported() {
        var counter = 0
        val chatty = object : CourseProvider {
            override val course = sample.course
            override fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> {
                counter += 1
                return listOf(Exercises.typed(id = "${node.id}#$counter", prompt = "?", answer = "x")!!)
            }
        }
        val problems = CourseAudit.problems(chatty, listOf(1uL))
        assertTrue(problems.any { it.contains("sample.u01.k: a chest has exercises.") })
        assertTrue(problems.any { it.contains("the same seed gives other exercises (seed 1)") })
    }

    @Test fun mediaIsChecked() {
        fun base(media: ExerciseMedia) = LearnExercise(id = "m", kind = ExerciseKind.TYPE_ANSWER, prompt = "?", correctAnswers = listOf("a"), solution = "a", media = media)
        assertTrue("speech without text or language" in CourseAudit.problemsInExercise(base(ExerciseMedia.Speech("", "es-ES"))))
        assertTrue("board without a FEN" in CourseAudit.problemsInExercise(base(ExerciseMedia.Board(BoardSpec("nonsense")))))
        assertTrue("tones out of range" in CourseAudit.problemsInExercise(base(ExerciseMedia.Tones(ToneSpec(listOf(10))))))
        assertTrue("staff without notes" in CourseAudit.problemsInExercise(base(ExerciseMedia.Staff(StaffSpec(Clef.TREBLE, emptyList())))))
    }
}
