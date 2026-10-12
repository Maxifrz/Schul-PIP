package de.maxifrz.lernwerk.learn

import de.maxifrz.lernwerk.learn.skills.CompetenceLevel
import de.maxifrz.lernwerk.learn.skills.ExerciseOutcome
import de.maxifrz.lernwerk.review.ReviewGrade
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionTest {
    private fun exercise(kind: ExerciseKind, key: String, back: String = "Berlin") = LearnExercise(
        id = "${kind.raw}:$key", kind = kind, cardKeys = listOf(key), prompt = "Frage $key", correctAnswers = listOf(back),
        options = if (kind == ExerciseKind.MULTIPLE_CHOICE) listOf(back, "Paris", "Rom", "Madrid") else emptyList(), solution = back,
    )

    private fun pairs(keys: List<String>): LearnExercise {
        val list = keys.map { ExercisePair(it, "Frage $it", "Antwort $it") }
        return LearnExercise(
            id = "matchPairs:" + keys.joinToString("+"), kind = ExerciseKind.MATCH_PAIRS, cardKeys = keys, prompt = "Finde die Paare",
            correctAnswers = list.map { it.back }, options = list.map { it.back }, pairs = list, solution = "",
        )
    }

    private fun session(exercises: List<LearnExercise>, cards: List<String> = listOf("a", "b")) = LessonSession("L1", cards, exercises, "s1")
    private val feedbackRight = LessonPhase.Feedback(LearnVerdict.RIGHT)
    private val feedbackWrong = LessonPhase.Feedback(LearnVerdict.WRONG)

    @Test fun allRightFinishesWithFullAccuracy() {
        val lesson = session(listOf(exercise(ExerciseKind.MULTIPLE_CHOICE, "a"), exercise(ExerciseKind.TYPE_ANSWER, "a"), exercise(ExerciseKind.TYPE_ANSWER, "b")))
        assertEquals(0.0, lesson.progress, 0.0)
        assertEquals(LearnVerdict.RIGHT, lesson.submit(LearnAnswer.Option("Berlin")))
        assertEquals(feedbackRight, lesson.phase)
        assertEquals(1.0 / 3, lesson.progress, 1e-4)
        assertNull(lesson.result)
        lesson.advance()
        assertEquals(LearnVerdict.RIGHT, lesson.submit(LearnAnswer.Typed("berlin")))
        lesson.advance()
        assertEquals(LearnVerdict.RIGHT, lesson.submit(LearnAnswer.Typed("Berlin")))
        lesson.advance()
        assertEquals(LessonPhase.Finished, lesson.phase)
        assertNull(lesson.current)
        assertEquals(1.0, lesson.progress, 0.0)
        val result = lesson.result!!
        assertEquals(3, result.exerciseCount)
        assertEquals(3, result.rightFirstTry)
        assertEquals(0, result.rightOnRetry)
        assertEquals(1.0, result.accuracy, 0.0)
        assertEquals(setOf("a", "b"), result.cardsRightFirstTry)
        assertEquals("L1", result.lessonID)
        assertEquals("s1", result.sessionID)
    }

    @Test fun aWrongExerciseComesBackExactlyOnce() {
        val lesson = session(listOf(exercise(ExerciseKind.MULTIPLE_CHOICE, "a"), exercise(ExerciseKind.TYPE_ANSWER, "b")))
        assertEquals(LearnVerdict.WRONG, lesson.submit(LearnAnswer.Option("Paris")))
        assertEquals(0.0, lesson.progress, 0.0)
        lesson.advance()
        assertEquals(3, lesson.queue.size)
        assertFalse(lesson.isRetry)
        lesson.submit(LearnAnswer.Typed("Berlin"))
        lesson.advance()
        assertEquals("multipleChoice:a", lesson.current?.id)
        assertTrue(lesson.isRetry)
        assertEquals(LearnVerdict.WRONG, lesson.submit(LearnAnswer.Option("Rom")))
        assertEquals(1.0, lesson.progress, 0.0)
        lesson.advance()
        assertEquals(3, lesson.queue.size) // a second wrong answer does not queue it again
        assertEquals(LessonPhase.Finished, lesson.phase)
        assertEquals(1, lesson.result?.rightFirstTry)
        assertEquals(0, lesson.result?.rightOnRetry)
        assertEquals(0.5, lesson.result!!.accuracy, 0.0)
        assertEquals(setOf("b"), lesson.result?.cardsRightFirstTry)
    }

    @Test fun aRightRetryCountsAsRetryNotFirstTry() {
        val lesson = session(listOf(exercise(ExerciseKind.TYPE_ANSWER, "a")), listOf("a"))
        lesson.submit(LearnAnswer.Typed("Paris"))
        lesson.advance()
        assertEquals(LearnVerdict.RIGHT, lesson.submit(LearnAnswer.Typed("Berlin")))
        lesson.advance()
        assertEquals(0, lesson.result?.rightFirstTry)
        assertEquals(1, lesson.result?.rightOnRetry)
        assertEquals(emptySet<String>(), lesson.result?.cardsRightFirstTry)
    }

    @Test fun progressNeverGoesBack() {
        val lesson = session(listOf(exercise(ExerciseKind.MULTIPLE_CHOICE, "a"), exercise(ExerciseKind.MULTIPLE_CHOICE, "b"), exercise(ExerciseKind.TYPE_ANSWER, "a")))
        var last = lesson.progress
        val answers = listOf("Paris", "Berlin", "Rom", "Berlin")
        var index = 0
        while (lesson.phase != LessonPhase.Finished) {
            val answer = answers[minOf(index, answers.size - 1)]
            val current = lesson.current!!
            lesson.submit(if (current.kind == ExerciseKind.TYPE_ANSWER) LearnAnswer.Typed(answer) else LearnAnswer.Option(answer))
            assertTrue(lesson.progress >= last)
            last = lesson.progress
            lesson.advance()
            assertTrue(lesson.progress >= last)
            index += 1
        }
        assertEquals(1.0, lesson.progress, 0.0)
    }

    @Test fun overruledTypingCountsAsRight() {
        val lesson = session(listOf(exercise(ExerciseKind.TYPE_ANSWER, "a", "Die Photosynthese wandelt Licht in chemische Energie um")), listOf("a"))
        assertEquals(LearnVerdict.WRONG, lesson.submit(LearnAnswer.Typed("Licht wird zu Zucker")))
        lesson.overrule()
        assertEquals(feedbackRight, lesson.phase)
        lesson.advance()
        assertEquals(1, lesson.queue.size) // an overruled answer does not come back
        assertEquals(1, lesson.result?.rightFirstTry)
        assertEquals(setOf("a"), lesson.result?.cardsRightFirstTry)
    }

    @Test fun onlyTypingCanBeOverruled() {
        val lesson = session(listOf(exercise(ExerciseKind.MULTIPLE_CHOICE, "a")), listOf("a"))
        lesson.submit(LearnAnswer.Option("Paris"))
        lesson.overrule()
        assertEquals(feedbackWrong, lesson.phase)
    }

    @Test fun aSecondTapNeitherAnswersTwiceNorSkips() {
        val lesson = session(listOf(exercise(ExerciseKind.TYPE_ANSWER, "a"), exercise(ExerciseKind.TYPE_ANSWER, "b")))
        assertEquals(LearnVerdict.WRONG, lesson.submit(LearnAnswer.Typed("Paris")))
        assertNull(lesson.submit(LearnAnswer.Typed("Berlin")))
        assertEquals(feedbackWrong, lesson.phase)
        lesson.advance()
        lesson.advance()
        assertEquals("typeAnswer:b", lesson.current?.id)
        assertEquals(3, lesson.queue.size)
    }

    @Test fun pairsMarkOnlyTheMissedCards() {
        val lesson = session(listOf(pairs(listOf("a", "b", "c", "d"))), listOf("a", "b", "c", "d"))
        assertEquals(LearnVerdict.WRONG, lesson.submit(LearnAnswer.Pairs(setOf("c", "x"))))
        lesson.advance()
        lesson.submit(LearnAnswer.Pairs())
        lesson.advance()
        assertEquals(setOf("a", "b", "d"), lesson.result?.cardsRightFirstTry)
    }

    @Test fun aCardWrongInAnyFirstTryIsWrong() {
        val lesson = session(listOf(exercise(ExerciseKind.MULTIPLE_CHOICE, "a"), exercise(ExerciseKind.TYPE_ANSWER, "a")), listOf("a"))
        lesson.submit(LearnAnswer.Option("Berlin"))
        lesson.advance()
        lesson.submit(LearnAnswer.Typed("Rom"))
        lesson.advance()
        lesson.submit(LearnAnswer.Typed("Berlin"))
        lesson.advance()
        assertEquals(emptySet<String>(), lesson.result?.cardsRightFirstTry)
    }

    @Test fun anEmptyLessonIsFinishedAtOnce() {
        val lesson = session(emptyList())
        assertEquals(LessonPhase.Finished, lesson.phase)
        assertEquals(1.0, lesson.progress, 0.0)
        assertEquals(0, lesson.result?.exerciseCount)
        assertEquals(0.0, lesson.result!!.accuracy, 0.0)
    }

    @Test fun aFinishedLessonStaysFinished() {
        val lesson = session(listOf(exercise(ExerciseKind.TYPE_ANSWER, "a")), listOf("a"))
        lesson.submit(LearnAnswer.Typed("Berlin"))
        lesson.advance()
        val result = lesson.result
        assertNotNull(result)
        lesson.advance()
        assertNull(lesson.submit(LearnAnswer.Typed("Paris")))
        lesson.overrule()
        lesson.advance()
        assertEquals(LessonPhase.Finished, lesson.phase)
        assertEquals(1, lesson.position)
        assertEquals(result, lesson.result)
    }

    @Test fun overrulingTwiceCountsOnce() {
        val lesson = session(listOf(exercise(ExerciseKind.TYPE_ANSWER, "a"), exercise(ExerciseKind.TYPE_ANSWER, "b")))
        lesson.submit(LearnAnswer.Typed("Paris"))
        lesson.overrule()
        lesson.overrule()
        lesson.advance()
        lesson.overrule()
        lesson.submit(LearnAnswer.Typed("Rom"))
        lesson.advance()
        lesson.submit(LearnAnswer.Typed("Berlin"))
        lesson.advance()
        assertEquals(1, lesson.result?.rightFirstTry)
        assertEquals(1, lesson.result?.rightOnRetry)
        assertEquals(setOf("a"), lesson.result?.cardsRightFirstTry)
    }

    @Test fun aCardListedTwiceIsGradedOnce() {
        val result = LessonResult(
            lessonID = "L1", sessionID = "s1", exerciseCount = 2, rightFirstTry = 2, rightOnRetry = 0,
            cardKeys = listOf("a", "b", "a"), cardsRightFirstTry = setOf("a", "b"),
        )
        assertEquals(listOf("a", "b"), LessonGrading.gradesToApply(result, setOf("a", "b")).map { it.key })
        val s = LessonSession("L1", listOf("a", "a", "b"), listOf(exercise(ExerciseKind.TYPE_ANSWER, "a")), "s")
        assertEquals(listOf("a", "b"), s.cardKeys)
    }

    @Test fun onlyDueCardsAreGraded() {
        val result = LessonResult(
            lessonID = "L1", sessionID = "s1", exerciseCount = 6, rightFirstTry = 4, rightOnRetry = 1,
            cardKeys = listOf("a", "b", "c", "d"), cardsRightFirstTry = setOf("a", "c"),
        )
        val grades = LessonGrading.gradesToApply(result, setOf("a", "b", "x"))
        assertEquals(listOf("a", "b"), grades.map { it.key })
        assertEquals(listOf(ReviewGrade.GOOD, ReviewGrade.AGAIN), grades.map { it.grade })
        assertEquals(emptyList<CardGrade>(), LessonGrading.gradesToApply(result, emptySet()))
    }

    @Test fun aLessonOfEveryKindRunsToTheEnd() {
        // The Swift test builds a lesson from flashcards (ExerciseBuilder, not ported); here a hand-made lesson of every kind.
        val kinds = listOf(
            exercise(ExerciseKind.MULTIPLE_CHOICE, "a"), pairs(listOf("a", "b", "c", "d")), exercise(ExerciseKind.WORD_BANK, "b"),
            exercise(ExerciseKind.CHESS_MOVE, "c", "e2e4"), exercise(ExerciseKind.PIANO_KEY, "d", "60"), exercise(ExerciseKind.TYPE_ANSWER, "a"),
        )
        val lesson = LessonSession("L", listOf("a", "b", "c", "d"), kinds, "s")
        var steps = 0
        var current = lesson.current
        while (current != null && steps < 100) {
            when (current.kind) {
                ExerciseKind.MULTIPLE_CHOICE, ExerciseKind.PIANO_KEY -> lesson.submit(LearnAnswer.Option(current.correctAnswers[0]))
                ExerciseKind.TYPE_ANSWER -> lesson.submit(LearnAnswer.Typed(current.correctAnswers[0]))
                ExerciseKind.WORD_BANK -> lesson.submit(LearnAnswer.Words(current.correctAnswers))
                ExerciseKind.MATCH_PAIRS -> lesson.submit(LearnAnswer.Pairs())
                ExerciseKind.CHESS_MOVE -> lesson.submit(LearnAnswer.Move(current.correctAnswers[0]))
            }
            lesson.advance()
            steps += 1
            current = lesson.current
        }
        assertEquals(kinds.size, steps)
        assertEquals(1.0, lesson.result!!.accuracy, 0.0)
        assertEquals(setOf("a", "b", "c", "d"), lesson.result?.cardsRightFirstTry)
    }

    // SkillFeedbackTests: the parts that need only the session.
    private fun ex(id: String, skill: String = "c.u1.main", level: CompetenceLevel = CompetenceLevel.RECOGNISE, hints: List<String> = emptyList()) =
        LearnExercise(id = id, kind = ExerciseKind.MULTIPLE_CHOICE, prompt = "?", correctAnswers = listOf("a"), options = listOf("a", "b"), solution = "a", skill = skill, level = level, hints = hints)

    @Test fun hintsComeOneAtATimeAndStopAtTheLast() {
        val s = LessonSession("l", emptyList(), listOf(ex("e1", hints = listOf("eins", "zwei"))), "s")
        assertTrue(s.hasMoreHints)
        assertEquals(listOf("eins"), s.showHint())
        assertEquals(listOf("eins", "zwei"), s.showHint())
        assertEquals(listOf("eins", "zwei"), s.showHint())
        assertFalse(s.hasMoreHints)
        assertEquals(2, s.hintCount)
        assertEquals(listOf("eins", "zwei"), s.shownHints)
    }

    @Test fun anExerciseWithoutHintsShowsNone() {
        val s = LessonSession("l", emptyList(), listOf(ex("e1")), "s")
        assertFalse(s.hasMoreHints)
        assertEquals(emptyList<String>(), s.showHint())
    }

    @Test fun theOutcomeOfAnExerciseIsItsFirstAttemptAndRemembersHelp() {
        val s = LessonSession("l", emptyList(), listOf(ex("e1", hints = listOf("h")), ex("e2"), ex("e3", skill = "")), "s")
        // e1: a hint, then wrong, then right on the retry.
        s.showHint()
        s.submit(LearnAnswer.Option("b"))
        s.advance()
        s.submit(LearnAnswer.Option("a")) // e2: right at once
        s.advance()
        s.submit(LearnAnswer.Option("a")) // e3 belongs to no skill
        s.advance()
        s.submit(LearnAnswer.Option("a")) // the retry of e1
        s.advance()
        val result = s.result!!
        assertEquals(listOf("e1", "e2"), result.outcomes.map { it.exerciseID })
        assertEquals(ExerciseOutcome("e1", "c.u1.main", CompetenceLevel.RECOGNISE, right = false, helped = true), result.outcomes[0])
        assertTrue(result.outcomes[1].right)
        assertFalse(result.outcomes[1].helped)
    }

    @Test fun aRetryAnsweredWithAHintDoesNotChangeTheFirstOutcome() {
        val s = LessonSession("l", emptyList(), listOf(ex("e1", hints = listOf("h"))), "s")
        s.submit(LearnAnswer.Option("b"))
        s.advance()
        s.showHint()
        s.submit(LearnAnswer.Option("a"))
        s.advance()
        assertEquals(listOf(ExerciseOutcome("e1", "c.u1.main", CompetenceLevel.RECOGNISE, right = false, helped = false)), s.result?.outcomes)
    }

    @Test fun overrulingATypedAnswerMakesItsOutcomeRight() {
        val typed = LearnExercise(id = "t", kind = ExerciseKind.TYPE_ANSWER, prompt = "?", correctAnswers = listOf("Haus"), solution = "Haus", skill = "c.u1.main", level = CompetenceLevel.RECALL)
        val s = LessonSession("l", emptyList(), listOf(typed), "s")
        s.submit(LearnAnswer.Typed("Hous"))
        s.overrule()
        s.advance()
        assertTrue(s.result!!.outcomes[0].right)
    }

    @Test fun roundsOfCardsHaveNoOutcomesAndKeepTheirBehaviour() {
        val plain = LearnExercise(id = "p", kind = ExerciseKind.MULTIPLE_CHOICE, cardKeys = listOf("k"), prompt = "?", correctAnswers = listOf("a"), options = listOf("a", "b"), solution = "a")
        val s = LessonSession("l", listOf("k"), listOf(plain), "s")
        s.submit(LearnAnswer.Option("a"))
        s.advance()
        assertEquals(emptyList<ExerciseOutcome>(), s.result?.outcomes)
        assertEquals(setOf("k"), s.result?.cardsRightFirstTry)
    }
}
