package de.maxifrz.lernwerk.learn

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private val cal = calendar("Europe/Berlin")
private const val START = 1_800_000_000_000L

private fun typing(key: String, back: String) =
    LearnExercise(id = "typeAnswer:$key", kind = ExerciseKind.TYPE_ANSWER, cardKeys = listOf(key), prompt = "Frage $key", correctAnswers = listOf(back), solution = back)

class LessonModelTest {
    @Test fun theResultIsHandedOutOnce() {
        val model = LessonModel("cards", listOf(typing("a", "Berlin")), "run", cardKeys = listOf("a"))
        assertNull(model.takeResult())
        assertFalse(model.canCheck)
        model.typed = "  "
        assertFalse(model.canCheck)
        model.typed = "Berlin"
        assertEquals(LearnVerdict.RIGHT, model.check())
        assertNull(model.check()) // a second tap on Pruefen does nothing
        model.advance()
        model.advance()
        assertEquals("", model.typed)
        val result = model.takeResult()
        assertEquals("run", result?.sessionID)
        assertEquals("cards", result?.lessonID)
        assertEquals(1, result?.rightFirstTry)
        assertNull(model.takeResult())
    }

    @Test fun anEmptyLessonIsHandedOutOnceAndCountsNothing() {
        val model = LessonModel("empty", emptyList(), "empty")
        val result = model.takeResult()
        assertEquals(0, result?.exerciseCount)
        assertNull(model.takeResult())
        val progress = LearnProgress()
        assertNull(progress.record(result!!, START, cal))
    }

    @Test fun pairsCountAMissAndFinishOnTheLastMatch() {
        val keys = listOf("a", "b", "c", "d")
        val pairs = keys.map { ExercisePair(it, "Frage $it", "Antwort $it") }
        val exercise = LearnExercise(
            id = "matchPairs:a+b+c+d", kind = ExerciseKind.MATCH_PAIRS, cardKeys = keys, prompt = "Finde die Paare",
            correctAnswers = pairs.map { it.back }, options = pairs.map { it.back }.reversed(), pairs = pairs, solution = "",
        )
        val model = LessonModel("p", listOf(exercise), "pairs", cardKeys = keys)
        assertFalse(model.canCheck)
        // options: d, c, b, a
        assertNull(model.pickFront("a"))
        assertEquals(PairOutcome.Miss, model.pickBack(0))
        assertEquals(PairMiss("a", 0), model.lastMiss)
        assertNull(model.pickBack(3))
        assertEquals(PairOutcome.Match, model.pickFront("a"))
        assertNull(model.pickFront("a")) // a matched card cannot be picked again
        assertNull(model.pickBack(3))
        assertNull(model.pickFront("b"))
        assertEquals(PairOutcome.Match, model.pickBack(2))
        assertNull(model.pickFront("c"))
        assertEquals(PairOutcome.Match, model.pickBack(1))
        assertNull(model.pickBack(0))
        assertEquals(PairOutcome.Finished(LearnVerdict.WRONG), model.pickFront("d"))
        assertEquals(LearnVerdict.WRONG, model.verdict)
        assertNull(model.pickFront("d"))
        model.advance()
        // The round comes back once; without a miss it is right.
        assertEquals(0, model.matched.size)
        listOf("d", "c", "b", "a").forEachIndexed { index, key ->
            model.pickFront(key)
            model.pickBack(index)
        }
        assertEquals(LearnVerdict.RIGHT, model.verdict)
        model.advance()
        val result = model.takeResult()
        assertEquals(setOf("b", "c", "d"), result?.cardsRightFirstTry)
        assertEquals(1, result?.rightOnRetry)
    }

    @Test fun wordBankTilesGoInAndOut() {
        val exercise = LearnExercise(
            id = "wordBank:a", kind = ExerciseKind.WORD_BANK, cardKeys = listOf("a"), prompt = "?",
            correctAnswers = listOf("Der", "Zellkern", "steuert"), options = listOf("steuert", "Zellwand", "Der", "Zellkern"),
            solution = "Der Zellkern steuert",
        )
        val model = LessonModel("b", listOf(exercise), "bank", cardKeys = listOf("a"))
        assertFalse(model.canCheck)
        model.addTile(2)
        model.addTile(1)
        model.addTile(2)
        assertEquals(listOf(2, 1), model.tiles)
        model.removeTile(1)
        model.addTile(3)
        model.addTile(0)
        assertEquals(LearnVerdict.RIGHT, model.check())
        model.addTile(1)
        assertEquals(listOf(2, 3, 0), model.tiles) // tiles are locked while the verdict shows
    }

    // Extra cases
    @Test fun chessSquaresPickPutDownMoveStartOver() {
        val move = Exercises.move(id = "m", prompt = "?", board = BoardSpec("8/8/8/8/8/8/8/8 w - - 0 1"), accepted = listOf("e2e4"), solution = "e4")!!
        val model = LessonModel("c", listOf(move), "s")
        assertFalse(model.canCheck)
        model.tapSquare("e2")
        assertEquals("e2", model.moveFrom)
        model.tapSquare("e2")
        assertNull(model.moveFrom)
        model.tapSquare("e2")
        model.tapSquare("e4")
        assertTrue(model.canCheck)
        model.tapSquare("d2")
        assertEquals(listOf<String?>("d2", null), listOf(model.moveFrom, model.moveTo))
        model.tapSquare("e2")
        model.moveFrom = "e2"
        model.moveTo = "e4"
        assertEquals(LearnVerdict.RIGHT, model.check())
    }

    @Test fun theCoachExplainsAWrongAnswerAndIsQuietAfterARightOne() {
        val calls = mutableListOf<String>()
        val model = LessonModel(
            "c", listOf(typing("a", "Berlin"), typing("b", "Rom")), "s",
            coach = { e, a -> calls.add(e.id); if (a is LearnAnswer.Typed) "nicht ${a.value}" else null },
        )
        model.typed = "Paris"
        assertEquals(LearnVerdict.WRONG, model.check())
        assertEquals("nicht Paris", model.coachNote)
        model.advance()
        assertEquals("", model.coachNote)
        model.typed = "Rom"
        assertEquals(LearnVerdict.RIGHT, model.check())
        assertEquals("", model.coachNote)
        assertEquals(listOf("typeAnswer:a"), calls)
    }

    @Test fun hintsArePassedThrough() {
        val e = LearnExercise(id = "h", kind = ExerciseKind.TYPE_ANSWER, prompt = "?", correctAnswers = listOf("a"), solution = "a", hints = listOf("x", "y"))
        val model = LessonModel("h", listOf(e), "s")
        assertEquals(2, model.hintTotal)
        assertTrue(model.hasMoreHints)
        model.showHint()
        assertEquals(listOf("x"), model.hintsShown)
    }
}

// A provider with real exercises on the sample course's structure.
private class ExerciseSample : SampleCourse() {
    override fun exercises(node: CourseNode, seed: ULong): List<LearnExercise> {
        if (node.kind == NodeKind.CHEST) return emptyList()
        val rng = LearnRandom(Exercises.seed(node, seed))
        val list = mutableListOf<LearnExercise?>()
        for (i in 0 until 10) {
            list.add(Exercises.choice(id = "${node.id}#c$i", prompt = "Q$i?", correct = "A", wrong = listOf("B", "C", "D"), random = rng))
        }
        list.add(Exercises.typed(id = "${node.id}#t", prompt = "Tippe A", answer = "A"))
        return Exercises.arrange(list)
    }
}

private class Setup {
    val provider: CourseProvider = ExerciseSample()
    val storage = MemoryStore()
    val progress = LearnProgressStore(storage)
    val quests = QuestStore(storage)
    val skills = SkillStore(storage)
    var now = at(cal, 2026, 10, 9, 10)
    var seed = 100uL
    val controller = LearnController(
        LearnControllerDeps(
            progress, quests, skills, clock = { now }, calendar = { cal }, newSeed = { seed++ },
            provider = { id -> if (id == "sample") provider else null },
        ),
    )
}

private fun playAll(model: LessonModel, wrong: Boolean = false) {
    while (true) {
        val e = model.current ?: break
        if (e.kind == ExerciseKind.TYPE_ANSWER) model.typed = if (wrong) "falsch" else e.correctAnswers[0]
        else model.choice = if (wrong) (e.options.firstOrNull { it !in e.correctAnswers } ?: "x") else e.correctAnswers[0]
        model.check()
        model.advance()
    }
}

class LearnControllerTest {
    @Test fun aStepBecomesARoundFinishingItRecordsProgressSkillsAndQuests() {
        val s = Setup()
        val units = CoursePath.units(s.provider.course, s.progress.progress.completedLessons)
        val first = CoursePath.current(units)!!
        val started = s.controller.startStep(first, "sample")
        assertTrue(started is StartResult.Run)
        val run = (started as StartResult.Run).run
        assertTrue(run.completes)
        assertTrue(first.id in s.skills.records.getValue(SkillMaps.map(s.provider).skills[0].id).started)
        val model = s.controller.newModel(run, "run-1")
        playAll(model)
        val result = model.takeResult()!!
        assertEquals(11, result.rightFirstTry)
        assertEquals(11, result.outcomes.size)
        val rewards = s.controller.finish(result, run)
        assertTrue(rewards.gems > 0)
        assertTrue(rewards.streakExtended)
        assertTrue(s.progress.progress.isCompleted(first.id))
        assertTrue(s.progress.progress.xpInCourse("sample") > 0)
        assertEquals(11, s.skills.records.getValue(SkillMaps.map(s.provider).skills[0].id).attempts)
        assertEquals(3, s.quests.board.daily.size)
        assertTrue(s.quests.board.daily.any { it.progress > 0 })
        // The same run counts once.
        assertEquals(LessonRewards(), s.controller.finish(result, run))
        // The next step is open now.
        val next = CoursePath.current(CoursePath.units(s.provider.course, s.progress.progress.completedLessons))!!
        assertEquals("sample.u01.l2", next.id)
    }

    @Test fun aLockedStepAndAnUnknownCourseStartNothingAChestOpensOnce() {
        val s = Setup()
        val units = CoursePath.units(s.provider.course, emptySet())
        assertEquals(StartResult.None(null), s.controller.startStep(units[0].steps[1], "sample"))
        assertEquals(StartResult.None(null), s.controller.startStep(units[0].steps[0], "nope"))
        val chest = PathStep(s.provider.course.nodes[5], LessonState.OPEN)
        assertEquals(StartResult.Chest(15, "Du hast 15 Gems gefunden."), s.controller.startStep(chest, "sample"))
        assertEquals(15, s.progress.progress.gems)
        assertEquals(StartResult.None(null), s.controller.startStep(chest, "sample"))
    }

    @Test fun aPracticeRoundEarnsXpAndMarksNoStepAsDone() {
        val s = Setup()
        val target = SkillMaps.map(s.provider).skills[0].id
        val started = s.controller.startPractice(listOf(target), "sample")
        assertTrue(started is StartResult.Run)
        val run = (started as StartResult.Run).run
        assertFalse(run.completes)
        assertEquals("practice.sample", run.lessonID)
        assertNull(run.node)
        val model = s.controller.newModel(run, "p1")
        playAll(model)
        s.controller.finish(model.takeResult()!!, run)
        assertTrue(s.progress.progress.totalXP > 0)
        assertEquals(0, s.progress.progress.completedLessons.size)
        assertEquals(StartResult.None("Dazu gibt es gerade nichts zu üben."), s.controller.startPractice(listOf("nowhere"), "sample"))
    }

    @Test fun passingTheTestOfTheFirstUnitSkipsItFailingItDoesNot() {
        val s = Setup()
        val unit = s.provider.course.units[0]
        assertTrue(s.controller.canTestOut(unit, "sample"))
        assertFalse(s.controller.canTestOut(s.provider.course.units[1], "sample"))
        val run = s.controller.startTestOut(unit, "sample")!!
        assertEquals(NodeKind.CHECKPOINT, run.kind)
        assertFalse(run.completes)
        val model = s.controller.newModel(run, "t1")
        playAll(model)
        val rewards = s.controller.finish(model.takeResult()!!, run)
        assertEquals(listOf("Einheit übersprungen: Einheit 1. Als Fähigkeit zählt nur, was der Test gezeigt hat."), rewards.notes)
        for (id in listOf("l1", "l2", "l3", "p", "t")) assertTrue(s.progress.progress.isCompleted("sample.u01.$id"))
        assertFalse(s.progress.progress.isCompleted("sample.u01.k"))
        assertFalse(s.controller.canTestOut(unit, "sample")) // started: no longer untouched

        // A failed test on the next unit says what is needed.
        s.progress.complete(listOf("sample.u01.k"))
        val unit2 = s.provider.course.units[1]
        val run2 = s.controller.startTestOut(unit2, "sample")!!
        val model2 = s.controller.newModel(run2, "t2")
        playAll(model2, wrong = true)
        val failed = s.controller.finish(model2.takeResult()!!, run2)
        assertEquals(listOf("Für das Überspringen brauchst du 85 % richtig, ohne Hilfe. Lern die Einheit jetzt Schritt für Schritt."), failed.notes)
        assertFalse(s.progress.progress.isCompleted("sample.u02.l1"))
    }

    @Test fun skillRowsTellStatusReasonsAndWhatAGoalWaitsFor() {
        val s = Setup()
        val rows = s.controller.skillRows(s.provider)
        assertEquals(3, rows.size)
        assertEquals(de.maxifrz.lernwerk.learn.skills.SkillStatus.NOT_STARTED, rows[0].status)
        assertEquals(emptyList<String>(), rows[0].waitingFor)
        assertEquals(listOf("Einheit 1 (Einheit 1)"), rows[1].waitingFor)
        assertTrue("Es fehlen noch richtige Antworten ohne Hilfe." in rows[0].reasons)
    }

    @Test fun anEmptyRoundDoesNotTouchProgress() {
        val s = Setup()
        val model = LessonModel("x", emptyList(), "e")
        val rewards = s.controller.finish(model.takeResult()!!, LessonRun("sample", NodeKind.LESSON, "x", emptyList(), null, true, null, null))
        assertEquals(0, rewards.gems)
        assertEquals(0, s.progress.progress.totalXP)
        assertNotNull(s.controller)
    }
}
