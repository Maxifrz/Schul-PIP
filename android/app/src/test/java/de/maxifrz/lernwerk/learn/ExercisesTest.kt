package de.maxifrz.lernwerk.learn

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ExercisesTest {
    private fun missed(e: LearnExercise, a: LearnAnswer) = e.missedKeys(a).sorted()
    private val random = LearnRandom(7uL)

    @Test fun choiceKeepsTheRightAnswerOnceAndDropsLookalikes() {
        val exercise = Exercises.choice(
            id = "c", prompt = "Hauptstadt?", correct = "Berlin",
            wrong = listOf("berlin", "Paris", "Paris", "Rom", "Wien", "Madrid", " "), random = random,
        )!!
        assertEquals(4, exercise.options.size)
        assertEquals(1, exercise.options.count { it == "Berlin" })
        assertEquals(4, exercise.options.toSet().size)
        assertEquals(listOf("Berlin"), exercise.correctAnswers)
        assertEquals(emptyList<String>(), missed(exercise, LearnAnswer.Option("Berlin")))
        assertEquals(listOf("c"), missed(exercise, LearnAnswer.Option("Paris")))
        assertNull(Exercises.choice(id = "x", prompt = "?", correct = "A", wrong = listOf("a", " "), random = random))
        val tf = Exercises.choice(id = "tf", prompt = "Stimmt das?", correct = "Richtig", wrong = listOf("Falsch"), random = random)!!
        assertEquals(2, tf.options.size)
    }

    @Test fun typedKeepsAlternatives() {
        val exercise = Exercises.typed(id = "t", key = "k1", prompt = "adiós", answer = "tschüss", alternatives = listOf("auf Wiedersehen"))!!
        assertEquals(emptyList<String>(), missed(exercise, LearnAnswer.Typed("Tschuess")))
        assertEquals(emptyList<String>(), missed(exercise, LearnAnswer.Typed("auf wiedersehen")))
        assertEquals(listOf("k1"), missed(exercise, LearnAnswer.Typed("hallo")))
        assertNull(Exercises.typed(id = "e", prompt = "?", answer = "  "))
    }

    @Test fun exactAnswersForgiveOnlyCapitalsAccentsAndPunctuation() {
        val exercise = Exercises.typed(id = "x", key = "k", prompt = "?", answer = "¿Cómo te llamas?", mode = AnswerMode.EXACT)!!
        assertEquals(emptyList<String>(), missed(exercise, LearnAnswer.Typed("como te llamas")))
        assertEquals(emptyList<String>(), missed(exercise, LearnAnswer.Typed("CÓMO TE LLAMAS?")))
        assertEquals(listOf("k"), missed(exercise, LearnAnswer.Typed("te llamas cómo")))
        assertEquals(listOf("k"), missed(exercise, LearnAnswer.Typed("como te llamar")))
        assertEquals(listOf("k"), missed(exercise, LearnAnswer.Typed("  ")))
        assertEquals(listOf("k"), missed(exercise, LearnAnswer.Typed("¿?")))
    }

    @Test fun bankTilesNeverComeInTheRightOrder() {
        for (seed in 1uL..30uL) {
            val rng = LearnRandom(seed)
            val exercise = Exercises.bank(
                id = "b", prompt = "?", words = listOf("Me", "llamo", "Ana."), extra = listOf("casa", "perro", "gato"), random = rng,
            )!!
            assertNotEquals(listOf("Me", "llamo", "Ana."), exercise.options.take(3))
            assertEquals(5, exercise.options.size) // two extra tiles at most
            assertEquals(emptyList<String>(), missed(exercise, LearnAnswer.Words(listOf("me", "Llamo", "Ana")))) // case and the full stop do not matter
        }
        assertNull(Exercises.bank(id = "one", prompt = "?", words = listOf("Hola"), random = random))
        assertEquals(listOf("Ich", "heiße", "Ana."), Exercises.tiles("Ich heiße Ana."))
    }

    @Test fun pairsNeedFourDistinctItems() {
        val items = listOf(PairItem("a", "uno", "eins"), PairItem("b", "dos", "zwei"), PairItem("c", "tres", "drei"), PairItem("d", "cuatro", "vier"))
        val exercise = Exercises.pairs(id = "p", items = items, random = random)!!
        assertEquals(listOf("a", "b", "c", "d"), exercise.cardKeys.sorted())
        assertEquals(listOf("b"), missed(exercise, LearnAnswer.Pairs(setOf("b"))))
        assertEquals(emptyList<String>(), missed(exercise, LearnAnswer.Pairs()))
        assertEquals(ExerciseBuilder.pairsPrompt, exercise.prompt)
        assertNull(Exercises.pairs(id = "x", items = items.take(3), random = random))
        val twins = items.toMutableList()
        twins[1] = PairItem("b", "dos", "Eins")
        assertNull(Exercises.pairs(id = "y", items = twins, random = random))
        assertTrue(exercise.isMatch("a", "Eins"))
        assertFalse(exercise.isMatch("a", "zwei"))
        assertFalse(exercise.isMatch("zz", "eins"))
    }

    @Test fun chessAndPianoAnswers() {
        val board = BoardSpec("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1")
        val move = Exercises.move(id = "m", prompt = "Matt in 1", board = board, accepted = listOf("a1a8"), solution = "Ta8#")!!
        assertEquals(emptyList<String>(), missed(move, LearnAnswer.Move("a1a8")))
        assertEquals(listOf("m"), missed(move, LearnAnswer.Move("a1a7")))
        assertEquals(listOf("m"), missed(move, LearnAnswer.Option("a1a8")))
        assertEquals(ExerciseMedia.Board(board), move.media)
        assertNull(Exercises.move(id = "n", prompt = "?", board = board, accepted = emptyList(), solution = ""))
        val key = Exercises.key(id = "k", prompt = "Tippe das C", midi = listOf(60, 72), solution = "C")!!
        assertEquals(emptyList<String>(), missed(key, LearnAnswer.Option("72")))
        assertEquals(listOf("k"), missed(key, LearnAnswer.Option("61")))
        assertNull(Exercises.key(id = "k", prompt = "", midi = emptyList(), solution = ""))
    }

    @Test fun arrangeSortsEasyFirstDropsDuplicatesAndCuts() {
        val rng = LearnRandom(7uL)
        val easy = Exercises.choice(id = "easy", prompt = "?", correct = "A", wrong = listOf("B"), random = rng)!!
        val hard = Exercises.typed(id = "hard", prompt = "?", answer = "A")!!
        assertEquals(listOf("easy", "hard"), Exercises.arrange(listOf(hard, null, easy, easy)).map { it.id })
        val many = (0 until 20).map { Exercises.typed(id = "t$it", prompt = "?", answer = "A") }
        assertEquals(ExerciseBuilder.maxExercises, Exercises.arrange(many).size)
        assertEquals((0 until 12).map { "t$it" }, Exercises.arrange(many).map { it.id })
    }

    @Test fun seedsDifferByNodeAndRepeatForTheSame() {
        val unit = CourseUnit.standard("x", 1, "T", "", "t")
        val a = Exercises.seed(unit.nodes[0], 5uL)
        assertEquals(a, Exercises.seed(unit.nodes[0], 5uL))
        assertNotEquals(a, Exercises.seed(unit.nodes[1], 5uL))
        assertNotEquals(a, Exercises.seed(unit.nodes[0], 6uL))
    }

    @Test fun noCardsStillMeansWrongWhenWrong() {
        val rng = LearnRandom(7uL)
        val exercise = Exercises.choice(id = "solo", prompt = "?", correct = "A", wrong = listOf("B", "C"), random = rng)!!
        val session = LessonSession("x.u01.l1", emptyList(), listOf(exercise), "s")
        assertEquals(LearnVerdict.WRONG, session.submit(LearnAnswer.Option("B")))
        session.advance()
        assertEquals(2, session.queue.size) // the wrong exercise comes back once
        assertEquals(LearnVerdict.RIGHT, session.submit(LearnAnswer.Option("A")))
        session.advance()
        assertEquals(0, session.result?.rightFirstTry)
        assertEquals(1, session.result?.rightOnRetry)
    }

    // Extra cases
    @Test fun kindsGoFromEasyToHardAndHelpersFold() {
        assertEquals(
            listOf(0, 0, 1, 2, 2, 3),
            listOf(ExerciseKind.MULTIPLE_CHOICE, ExerciseKind.PIANO_KEY, ExerciseKind.MATCH_PAIRS, ExerciseKind.CHESS_MOVE, ExerciseKind.WORD_BANK, ExerciseKind.TYPE_ANSWER).map { it.difficulty },
        )
        assertEquals(folded("groesse"), folded("Größe!"))
        assertTrue(sameWords(listOf("Der", "Hund."), listOf("der", "hund")))
        assertFalse(sameWords(listOf("Der"), listOf("der", "hund")))
    }

    @Test fun aWrongKindOfAnswerIsAlwaysWrong() {
        val e = LearnExercise(id = "q", kind = ExerciseKind.TYPE_ANSWER, prompt = "?", correctAnswers = listOf("a"), solution = "a")
        assertEquals(listOf("q"), missed(e, LearnAnswer.Option("a")))
        val none = LearnExercise(id = "z", kind = ExerciseKind.TYPE_ANSWER, prompt = "?", correctAnswers = emptyList(), solution = "a")
        assertEquals(listOf("z"), missed(none, LearnAnswer.Typed("a")))
    }

    @Test fun aPairsAnswerOnlyReportsCardsOfTheExercise() {
        val e = LearnExercise(id = "pp", kind = ExerciseKind.MATCH_PAIRS, cardKeys = listOf("a", "b"), prompt = "?", correctAnswers = emptyList(), solution = "")
        assertEquals(listOf("b"), missed(e, LearnAnswer.Pairs(setOf("b", "x"))))
        assertNotNull(e)
    }
}
