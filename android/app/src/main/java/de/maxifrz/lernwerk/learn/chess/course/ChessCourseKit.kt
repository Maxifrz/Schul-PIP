package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.BoardSpec
import de.maxifrz.lernwerk.learn.ExerciseBuilder
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.PairItem
import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.chess.ChessCoach
import de.maxifrz.lernwerk.learn.chess.ChessColor
import de.maxifrz.lernwerk.learn.chess.ChessGoal
import de.maxifrz.lernwerk.learn.chess.ChessGoals
import de.maxifrz.lernwerk.learn.chess.ChessKit
import de.maxifrz.lernwerk.learn.chess.ChessMove
import de.maxifrz.lernwerk.learn.chess.ChessNotation
import de.maxifrz.lernwerk.learn.chess.ChessPosition
import de.maxifrz.lernwerk.learn.chess.ChessSquare
import de.maxifrz.lernwerk.learn.randomElement
import de.maxifrz.lernwerk.learn.shuffle
import de.maxifrz.lernwerk.learn.shuffled

// The exercise-building half of ChessKit.swift: the random draw of one node, the makers, boards, choices, pairs and
// the "find the move" exercise whose accepted moves the engine computes from a goal.

/**
 * Makes one exercise from the state of the node being built. A maker returns null when the material cannot make a
 * sound exercise; the builder then tries the next entry of the plan.
 */
typealias ChessMaker = (ChessDraw) -> LearnExercise?

/**
 * The random numbers of one node and what it has used so far, so a lesson never shows the same position twice for the
 * same kind of question.
 */
class ChessDraw(seed: ULong) {
    val random = LearnRandom(seed)
    private val used = HashSet<String>()

    /**
     * A random element that was not drawn before under this key. When every element was drawn, any element: the
     * builder then drops the repeated exercise id and asks the next plan entry.
     */
    fun <T> pick(items: List<T>, key: String, id: (T) -> String): T? {
        val fresh = items.filter { !used.contains(key + "|" + id(it)) }
        val item = randomElement(if (fresh.isEmpty()) items else fresh, random) ?: return null
        used.add(key + "|" + id(item))
        return item
    }

    fun pickSample(pool: List<ChessSample>, key: String): ChessSample? = pick(pool, key) { it.id }

    fun pickSquare(key: String): ChessSquare? = pick(ChessSquare.all, key) { it.name }

    /** `Bool.random(using:)`. */
    fun coin(): Boolean = ((random.next() shr 17) and 1uL) == 0uL
}

/** A sentence for a word bank: the words in order and plausible wrong tiles. */
class ChessSentence(val key: String, val words: List<String>, val extra: List<String>)

fun sentence(key: String, words: List<String>, extra: List<String>) = ChessSentence(key, words, extra)

/** A question with a fixed right answer and fixed wrong ones, for rules that no position can show. */
class ChessStatement(val key: String, val prompt: String, val correct: String, val wrong: List<String>, val explanation: String)

fun statement(key: String, prompt: String, correct: String, wrong: List<String>, explanation: String) =
    ChessStatement(key, prompt, correct, wrong, explanation)

// Boards

fun boardSpecOf(position: ChessPosition, marked: List<String> = emptyList()) =
    BoardSpec(position.fen, position.sideToMove == ChessColor.BLACK, marked)

fun boardMedia(position: ChessPosition, marked: List<String> = emptyList()): ExerciseMedia =
    ExerciseMedia.Board(boardSpecOf(position, marked))

/** A board of a FEN with white at the bottom. */
fun fenBoard(fen: String, marked: List<String> = emptyList()): ExerciseMedia =
    ExerciseMedia.Board(BoardSpec(fen, false, marked))

fun emptyBoard(marked: List<String> = emptyList()): ExerciseMedia = fenBoard(ChessKit.EMPTY_FEN, marked)

// Wrong answers

/** Wrong square names a student could pick by mixing up the direction of counting, most likely mistakes first. */
fun squareDistractors(sq: ChessSquare, random: LearnRandom): List<String> {
    val file = sq.file
    val rank = sq.rank
    val ordered = mutableListOf<ChessSquare?>(
        ChessSquare.of(7 - file, rank), ChessSquare.of(file, 7 - rank), ChessSquare.of(rank, file), ChessSquare.of(7 - file, 7 - rank),
    )
    val near = mutableListOf(sq.offset(1, 0), sq.offset(-1, 0), sq.offset(0, 1), sq.offset(0, -1))
    shuffle(near, random)
    ordered.addAll(near)
    val seen = hashSetOf(sq)
    val result = ArrayList<String>()
    for (candidate in ordered) {
        if (candidate != null && seen.add(candidate)) result.add(candidate.name)
    }
    return result
}

/** Wrong whole numbers around the right one: the likely mistakes first, then neighbours. */
fun numberWrongs(correct: Int, likely: List<Int>, random: LearnRandom, minimum: Int = 0): List<String> {
    val seen = hashSetOf(correct)
    val result = ArrayList<Int>()
    fun add(n: Int) {
        if (n >= minimum && seen.add(n)) result.add(n)
    }
    likely.forEach { add(it) }
    val near = mutableListOf(correct + 1, correct - 1, correct + 2, correct - 2, correct + 3, correct - 3, correct + 4)
    shuffle(near, random)
    near.forEach { add(it) }
    return result.map { it.toString() }
}

// Exercises

/** The solution as the feedback shows it: "Sf3 (g1–f3)", up to three accepted moves joined with "oder". */
fun solutionText(moves: List<ChessMove>, position: ChessPosition, withSquares: Boolean, limit: Int = 3): String =
    ChessKit.solution(moves, position, withSquares, limit)

/** A "find the move" exercise whose accepted moves the engine computes from the goal. */
fun moveExercise(
    id: String,
    prompt: String,
    position: ChessPosition,
    goal: ChessGoal,
    marked: List<String> = emptyList(),
    explanation: String,
    withSquares: Boolean = true,
): LearnExercise? {
    val moves = ChessGoals.accepted(goal, position)
    if (moves.isEmpty()) return null
    val answers = ChessGoals.answers(moves) ?: return null
    val exercise = Exercises.move(
        id = id, prompt = prompt, board = boardSpecOf(position, marked), accepted = answers,
        solution = solutionText(moves, position, withSquares), explanation = explanation,
    ) ?: return null
    return exercise.copy(hints = ChessCoach.hints(goal, moves, position), coach = ChessCoach.PREFIX + goal.coachCode)
}

fun choice(
    id: String,
    prompt: String,
    correct: String,
    wrong: List<String>,
    explanation: String = "",
    media: ExerciseMedia? = null,
    draw: ChessDraw,
): LearnExercise? = Exercises.choice(
    id = id, prompt = prompt, correct = correct, wrong = wrong, solution = null, explanation = explanation, media = media,
    random = draw.random,
)

/** Ja or Nein. */
fun yesNo(id: String, prompt: String, answer: Boolean, explanation: String, media: ExerciseMedia? = null, draw: ChessDraw): LearnExercise? =
    choice(
        id = id, prompt = prompt, correct = if (answer) "Ja" else "Nein", wrong = listOf(if (answer) "Nein" else "Ja"),
        explanation = explanation, media = media, draw = draw,
    )

/** A whole number to type. */
fun number(id: String, prompt: String, answer: Int, explanation: String, media: ExerciseMedia? = null): LearnExercise? =
    Exercises.typed(id = id, prompt = prompt, answer = answer.toString(), mode = AnswerMode.NUMBER, explanation = explanation, media = media)

/** A square name to type; capitals and spaces do not matter, a different square does. */
fun typedSquare(id: String, prompt: String, answer: String, explanation: String, media: ExerciseMedia? = null): LearnExercise? =
    Exercises.typed(id = id, prompt = prompt, answer = answer, mode = AnswerMode.EXACT, explanation = explanation, media = media)

fun bank(id: String, sentence: ChessSentence, prompt: String = "Setze den Satz zusammen.", draw: ChessDraw): LearnExercise? =
    Exercises.bank(id = id, prompt = prompt, words = sentence.words, extra = sentence.extra, random = draw.random)

/** A word bank from a pool of sentences. */
fun sentenceMaker(topic: String, sentences: List<ChessSentence>): ChessMaker = { draw ->
    val picked = draw.pick(sentences, topic) { it.key }
    if (picked == null) null else bank("$topic.${picked.key}", picked, draw = draw)
}

/** A choice from a pool of fixed statements. */
fun statementMaker(topic: String, statements: List<ChessStatement>): ChessMaker = { draw ->
    val picked = draw.pick(statements, topic) { it.key }
    if (picked == null) null else choice(
        id = "$topic.${picked.key}", prompt = picked.prompt, correct = picked.correct, wrong = picked.wrong,
        explanation = picked.explanation, draw = draw,
    )
}

class PairCandidate(val key: String, val front: String, val back: String)

/** Four pairs out of the candidates, which may be more than four. */
fun pairs(id: String, prompt: String, from: List<PairCandidate>, draw: ChessDraw): LearnExercise? {
    val items = shuffled(from, draw.random).take(ExerciseBuilder.pairCount).map { PairItem(it.key, it.front, it.back) }
    return Exercises.pairs(id = id, prompt = prompt, items = items, random = draw.random)
}

/** The destinations of a piece, with a promotion counted once. */
fun destinationsOf(focus: ChessSquare, position: ChessPosition): List<ChessSquare> = ChessKit.destinations(focus, position)

internal fun sanOf(move: ChessMove, position: ChessPosition): String? = ChessNotation.san(move, position)
