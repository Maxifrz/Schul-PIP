package de.maxifrz.lernwerk.learn

// Checks a course the way the screens will use it: every node, a few seeds, every exercise. It checks the shape, not
// the facts; a teacher checks the facts. A port of CourseAudit.swift.

object CourseAudit {
    val lessonRange = 8..12
    val checkpointRange = 10..15

    private fun isBlank(text: String) = text.trimWs().isEmpty()

    private fun isMove(text: String): Boolean {
        val c = text.codePoints().toArray()
        if (c.size != 4 && c.size != 5) return false
        val files = "abcdefgh"
        val ranks = "12345678"
        fun ch(i: Int) = String(Character.toChars(c[i]))
        if (!(files.contains(ch(0)) && ranks.contains(ch(1)) && files.contains(ch(2)) && ranks.contains(ch(3)))) return false
        return c.size == 4 || "qrbn".contains(ch(4))
    }

    private fun isPianoKey(text: String): Boolean {
        if (!Regex("^[+-]?[0-9]+$").matches(text)) return false
        val value = text.toLongOrNull() ?: return false
        return value in 21..108
    }

    fun problems(provider: CourseProvider, seeds: List<ULong> = listOf(1uL, 2uL, 3uL)): List<String> {
        val problems = provider.structureProblems().toMutableList()
        for (node in provider.course.nodes) {
            if (node.kind == NodeKind.CHEST) {
                if (provider.exercises(node, 1uL).isNotEmpty()) problems.add("${node.id}: a chest has exercises.")
                continue
            }
            for (seed in seeds) {
                val exercises = provider.exercises(node, seed)
                problems.addAll(problemsInExercises(exercises, node).map { "$it (seed $seed)" })
                if (exercises != provider.exercises(node, seed)) {
                    problems.add("${node.id}: the same seed gives other exercises (seed $seed).")
                }
            }
        }
        return problems
    }

    /** Swift: `problems(in: [LearnExercise], node:)`. */
    fun problemsInExercises(exercises: List<LearnExercise>, node: CourseNode): List<String> {
        val problems = mutableListOf<String>()
        val range = if (node.kind == NodeKind.CHECKPOINT) checkpointRange else lessonRange
        if (exercises.size < range.first || exercises.size > range.last) {
            problems.add("${node.id}: ${exercises.size} exercises, expected ${range.first} to ${range.last}.")
        }
        val ids = exercises.map { it.id }
        if (ids.toSet().size != ids.size) problems.add("${node.id}: exercise ids are not unique.")
        val difficulties = exercises.map { it.kind.difficulty }
        if (difficulties != difficulties.sorted()) problems.add("${node.id}: the exercises do not go from easy to hard.")
        for (exercise in exercises) {
            for (p in problemsInExercise(exercise)) problems.add("${node.id} ${exercise.id}: $p")
        }
        return problems
    }

    /** Swift: `problems(in: LearnExercise)`. */
    fun problemsInExercise(exercise: LearnExercise): List<String> {
        val problems = mutableListOf<String>()
        if (exercise.id.isEmpty()) problems.add("empty id")
        if (isBlank(exercise.prompt)) problems.add("empty prompt")
        if (isBlank(exercise.solution)) problems.add("empty solution")
        if (exercise.correctAnswers.isEmpty() || exercise.correctAnswers.any { isBlank(it) }) problems.add("missing right answer")
        val media = exercise.media
        when (media) {
            is ExerciseMedia.Speech -> if (isBlank(media.text) || isBlank(media.language)) problems.add("speech without text or language")
            is ExerciseMedia.Board -> if (!media.board.fen.contains('/')) problems.add("board without a FEN")
            is ExerciseMedia.Staff -> if (media.staff.notes.isEmpty()) problems.add("staff without notes")
            is ExerciseMedia.Tones -> if (media.tones.midi.isEmpty() || media.tones.midi.any { it !in 21..108 }) problems.add("tones out of range")
            null -> {}
        }
        when (exercise.kind) {
            ExerciseKind.MULTIPLE_CHOICE -> {
                val f = exercise.options.map { folded(it) }
                if (exercise.options.size !in 2..4) problems.add("${exercise.options.size} options")
                if (f.toSet().size != f.size) problems.add("options that read the same")
                if (exercise.correctAnswers.size != 1) problems.add("a choice needs exactly one right answer")
                if (exercise.options.count { it in exercise.correctAnswers } != 1) {
                    problems.add("the right answer is not among the options exactly once")
                }
                if (exercise.options.any { isBlank(it) }) problems.add("blank option")
            }
            ExerciseKind.TYPE_ANSWER ->
                if (exercise.mode == AnswerMode.NUMBER && exercise.correctAnswers.any { NumberCheck.parse(it) == null }) {
                    problems.add("a number answer that is not a number")
                }
            ExerciseKind.WORD_BANK -> {
                val tiles = exercise.correctAnswers
                if (tiles.size < 2) problems.add("a word bank with fewer than two words")
                val remaining = exercise.options.toMutableList()
                for (word in tiles) {
                    val index = remaining.indexOf(word)
                    if (index >= 0) remaining.removeAt(index) else problems.add("tile $word is missing")
                }
                if (remaining.size > ExerciseBuilder.extraWords) problems.add("too many extra tiles")
                val head = exercise.options.take(tiles.size)
                if (head.size == tiles.size && head == tiles) problems.add("tiles come in the right order")
            }
            ExerciseKind.MATCH_PAIRS -> {
                if (exercise.pairs.size != ExerciseBuilder.pairCount) problems.add("${exercise.pairs.size} pairs")
                val fronts = exercise.pairs.map { folded(it.front) }
                val backs = exercise.pairs.map { folded(it.back) }
                if (fronts.toSet().size != fronts.size || backs.toSet().size != backs.size) problems.add("pairs that read the same")
                if (exercise.options.map { folded(it) }.toSet() != backs.toSet()) problems.add("pair options differ from the backs")
            }
            ExerciseKind.CHESS_MOVE -> {
                if (media !is ExerciseMedia.Board) {
                    problems.add("a chess move without a board")
                } else {
                    for (move in exercise.correctAnswers) if (!isMove(move)) problems.add("$move is not a move like e2e4")
                }
            }
            ExerciseKind.PIANO_KEY ->
                for (key in exercise.correctAnswers) if (!isPianoKey(key)) problems.add("$key is not a piano key")
        }
        return problems
    }
}
