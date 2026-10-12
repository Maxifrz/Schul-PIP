package de.maxifrz.lernwerk.learn

import de.maxifrz.lernwerk.learn.skills.CompetenceLevel
import de.maxifrz.lernwerk.review.AnswerCheck

// One step of a lesson and what the student gives for it. A port of Exercise.swift.

/** The kinds of exercise in a lesson, from easy to hard. */
enum class ExerciseKind(val raw: String) {
    MULTIPLE_CHOICE("multipleChoice"),
    MATCH_PAIRS("matchPairs"),
    WORD_BANK("wordBank"),
    TYPE_ANSWER("typeAnswer"),

    /** Chess: tap a piece, then its square; the answer is a move like "e2e4". */
    CHESS_MOVE("chessMove"),

    /** A piano keyboard: tap a key; the answer is its MIDI number as text, like "60" for the middle C. */
    PIANO_KEY("pianoKey");

    /** Lessons go from recognising an answer to recalling it. */
    val difficulty: Int
        get() = when (this) {
            MULTIPLE_CHOICE, PIANO_KEY -> 0
            MATCH_PAIRS -> 1
            CHESS_MOVE, WORD_BANK -> 2
            TYPE_ANSWER -> 3
        }
}

/** How a typed answer is compared with the right one. */
enum class AnswerMode(val raw: String) {
    /** `AnswerCheck`: words, typos, endings, umlauts. */
    TEXT("text"),

    /** `NumberCheck`: the same number, whether typed as a fraction, a decimal fraction or a whole number. */
    NUMBER("number"),

    /**
     * The same letters in the same order: forgives capitals, accents and punctuation, nothing else. For answers in a
     * language being learned, where "hermana" is not "hermano" and word order matters.
     */
    EXACT("exact"),
}

data class ExercisePair(val key: String, val front: String, val back: String)

/** One step of a lesson. */
data class LearnExercise(
    /** Unique within its lesson. */
    val id: String,
    val kind: ExerciseKind,
    val cardKeys: List<String> = emptyList(),
    /** The question; for pairs the instruction. */
    val prompt: String,
    /** Multiple choice and typing: the back. Word bank: its words in order. Pairs: the backs in the order of `pairs`. */
    val correctAnswers: List<String>,
    /** Multiple choice: the back and wrong answers. Word bank: the tiles. Pairs: the backs. Typing: none. */
    val options: List<String> = emptyList(),
    /** Pairs only: the cards, in the order their fronts are shown. */
    val pairs: List<ExercisePair> = emptyList(),
    /** What the feedback shows after a wrong answer. */
    val solution: String,
    /** Something to look at or listen to above the question. */
    val media: ExerciseMedia? = null,
    /** Typing only: how the answer is compared. */
    val mode: AnswerMode = AnswerMode.TEXT,
    /** A sentence of why, shown with the verdict. Empty for none. */
    val explanation: String = "",
    /** The skill this exercise shows evidence of, like "es.u03.vocab"; empty for exercises of cards. */
    val skill: String = "",
    /** What kind of knowing it asks for: seeing the answer, producing it, or using it. */
    val level: CompetenceLevel? = null,
    /** Help in steps, from a nudge to nearly the answer. */
    val hints: List<String> = emptyList(),
    /** A tag the course reads to explain a wrong answer (`feedback`); empty for none. */
    val coach: String = "",
) {
    companion object {
        /** Word by word, ignoring case, umlaut spelling and punctuation. */
        fun folded(text: String): String = AnswerCheck.compact(AnswerCheck.normalize(text))

        fun sameWords(given: List<String>, expected: List<String>): Boolean =
            given.size == expected.size && given.indices.all { folded(given[it]) == folded(expected[it]) }
    }
}

/** What the student gives for an exercise. */
sealed class LearnAnswer {
    data class Option(val value: String) : LearnAnswer()
    data class Typed(val value: String) : LearnAnswer()
    data class Words(val value: List<String>) : LearnAnswer()

    /** The cards whose front was paired with a wrong back at least once. */
    data class Pairs(val missed: Set<String> = emptySet()) : LearnAnswer()

    /** A chess move in coordinate notation, "e2e4". */
    data class Move(val value: String) : LearnAnswer()
}

enum class LearnVerdict { RIGHT, WRONG }

fun folded(text: String): String = LearnExercise.folded(text)

fun sameWords(given: List<String>, expected: List<String>): Boolean = LearnExercise.sameWords(given, expected)

/**
 * The cards answered wrong, empty when the answer is right. An exercise without cards (a course's) stands for
 * itself, so a wrong answer is never an empty set.
 */
fun LearnExercise.missedKeys(answer: LearnAnswer): Set<String> {
    val all: Set<String> = (if (cardKeys.isEmpty()) listOf(id) else cardKeys).toSet()
    val none = emptySet<String>()
    return when (kind) {
        ExerciseKind.MULTIPLE_CHOICE, ExerciseKind.PIANO_KEY ->
            if (answer is LearnAnswer.Option) (if (correctAnswers.contains(answer.value)) none else all) else all
        ExerciseKind.CHESS_MOVE ->
            if (answer is LearnAnswer.Move) (if (correctAnswers.contains(answer.value)) none else all) else all
        ExerciseKind.TYPE_ANSWER -> {
            if (answer !is LearnAnswer.Typed) return all
            if (correctAnswers.isEmpty()) return all
            val text = answer.value
            when (mode) {
                AnswerMode.NUMBER -> if (correctAnswers.any { NumberCheck.matches(text, it) }) none else all
                AnswerMode.EXACT -> {
                    val given = folded(text)
                    if (given != "" && correctAnswers.any { folded(it) == given }) none else all
                }
                AnswerMode.TEXT ->
                    if (correctAnswers.any { AnswerCheck.evaluate(text, it) == AnswerCheck.Verdict.CORRECT }) none else all
            }
        }
        ExerciseKind.WORD_BANK ->
            if (answer is LearnAnswer.Words) (if (sameWords(answer.value, correctAnswers)) none else all) else all
        ExerciseKind.MATCH_PAIRS ->
            if (answer is LearnAnswer.Pairs) answer.missed.filter { it in all }.toSet() else all
    }
}

/** Pairs: whether a back belongs to the card with this key. */
fun LearnExercise.isMatch(key: String, back: String): Boolean {
    val pair = pairs.firstOrNull { it.key == key } ?: return false
    return folded(pair.back) == folded(back)
}

/** The constants of Swift's `ExerciseBuilder` that the exercise factory and the audit use. */
object ExerciseBuilder {
    const val maxExercises = 12
    const val minExercises = 8
    const val distractorCount = 3
    const val pairCount = 4
    const val maxPairWords = 6
    val wordBankRange = 3..8
    const val extraWords = 2

    /** Answers with these (or with digits) are formulas, and formulas are typed, not put together from tiles. */
    const val formulaSymbols = "=+−*/^²³√π·×()<>[]{}|∫′⇒→←↔≤≥≈≠∑∞%_\\"
    const val pairsPrompt = "Finde die Paare"

    /** From this many cards on, a lesson always has at least `minExercises`. */
    const val fullLessonCards = 4
}
