package de.maxifrz.lernwerk.learn

// Builds the exercises of the course engines in one shape: the same ids, the same shuffling, the same checks. A
// builder returns null when the material cannot make a sound exercise, and the engine leaves that exercise out.
// A port of Exercises.swift. Swift passes the generator as `using random: inout R`; here it is the last argument.

data class PairItem(val key: String, val front: String, val back: String)

object Exercises {
    private fun keysOf(key: String?): List<String> = if (key == null) emptyList() else listOf(key)

    /**
     * A question with a right answer among two to four options. The wrong ones are cut to three, the options
     * shuffled; nothing that reads the same as the right answer survives.
     */
    fun choice(
        id: String,
        key: String? = null,
        prompt: String,
        correct: String,
        wrong: List<String>,
        solution: String? = null,
        explanation: String = "",
        media: ExerciseMedia? = null,
        random: RandomNumberGenerator,
    ): LearnExercise? {
        val seen = hashSetOf(folded(correct))
        val options = mutableListOf(correct)
        for (candidate in wrong) {
            if (options.size >= 4) break
            val trimmed = candidate.trimWs()
            if (trimmed.isEmpty()) continue
            if (!seen.add(folded(trimmed))) continue
            options.add(trimmed)
        }
        if (options.size < 2 || folded(correct).isEmpty()) return null
        return LearnExercise(
            id = id, kind = ExerciseKind.MULTIPLE_CHOICE, cardKeys = keysOf(key), prompt = prompt,
            correctAnswers = listOf(correct), options = shuffled(options, random), pairs = emptyList(),
            solution = solution ?: correct, media = media, explanation = explanation,
        )
    }

    /** The answer typed. `alternatives` are accepted too; `solution` is what a wrong answer is shown. */
    fun typed(
        id: String,
        key: String? = null,
        prompt: String,
        answer: String,
        alternatives: List<String> = emptyList(),
        mode: AnswerMode = AnswerMode.TEXT,
        solution: String? = null,
        explanation: String = "",
        media: ExerciseMedia? = null,
    ): LearnExercise? {
        val all = (listOf(answer) + alternatives).map { it.trimWs() }.filter { it.isNotEmpty() }
        val first = all.firstOrNull() ?: return null
        if (mode == AnswerMode.NUMBER && NumberCheck.parse(first) == null) return null
        return LearnExercise(
            id = id, kind = ExerciseKind.TYPE_ANSWER, cardKeys = keysOf(key), prompt = prompt, correctAnswers = all,
            options = emptyList(), pairs = emptyList(), solution = solution ?: first, media = media, mode = mode,
            explanation = explanation,
        )
    }

    /**
     * A sentence put together from tiles. `words` are the right tiles in order, `extra` up to two that do not
     * belong; the tiles never come out in the right order by chance.
     */
    fun bank(
        id: String,
        key: String? = null,
        prompt: String,
        words: List<String>,
        extra: List<String> = emptyList(),
        solution: String? = null,
        explanation: String = "",
        media: ExerciseMedia? = null,
        random: RandomNumberGenerator,
    ): LearnExercise? {
        val tiles = words.map { it.trimWs() }.filter { it.isNotEmpty() }
        if (tiles.size < 2 || tiles.size > 10) return null
        val seen = tiles.map { folded(it) }.toHashSet()
        val extras = mutableListOf<String>()
        for (candidate in extra) {
            if (extras.size >= ExerciseBuilder.extraWords) break
            val trimmed = candidate.trimWs()
            if (trimmed.isEmpty()) continue
            if (!seen.add(folded(trimmed))) continue
            extras.add(trimmed)
        }
        val options = shuffled(tiles + extras, random).toMutableList()
        var attempts = 0
        while (options.take(tiles.size) == tiles && options.toSet().size > 1 && attempts < 3) {
            shuffle(options, random)
            attempts += 1
        }
        return LearnExercise(
            id = id, kind = ExerciseKind.WORD_BANK, cardKeys = keysOf(key), prompt = prompt, correctAnswers = tiles,
            options = options, pairs = emptyList(), solution = solution ?: tiles.joinToString(" "), media = media,
            explanation = explanation,
        )
    }

    /** Four items to pair up. null unless the fronts differ from each other and so do the backs. */
    fun pairs(
        id: String,
        prompt: String = ExerciseBuilder.pairsPrompt,
        items: List<PairItem>,
        random: RandomNumberGenerator,
    ): LearnExercise? {
        if (items.size != ExerciseBuilder.pairCount) return null
        val fronts = items.map { folded(it.front) }.toSet()
        val backs = items.map { folded(it.back) }.toSet()
        if (fronts.size != items.size || backs.size != items.size || "" in fronts || "" in backs) return null
        val pairs = shuffled(items.map { ExercisePair(it.key, it.front, it.back) }, random)
        return LearnExercise(
            id = id, kind = ExerciseKind.MATCH_PAIRS, cardKeys = pairs.map { it.key }, prompt = prompt,
            correctAnswers = pairs.map { it.back }, options = shuffled(pairs.map { it.back }, random), pairs = pairs,
            solution = pairs.joinToString("\n") { "${it.front} – ${it.back}" },
        )
    }

    /** A chess move to find. `accepted` are all the moves that solve it, in coordinate notation like "e2e4". */
    fun move(
        id: String,
        key: String? = null,
        prompt: String,
        board: BoardSpec,
        accepted: List<String>,
        solution: String,
        explanation: String = "",
    ): LearnExercise? {
        if (accepted.isEmpty()) return null
        return LearnExercise(
            id = id, kind = ExerciseKind.CHESS_MOVE, cardKeys = keysOf(key), prompt = prompt, correctAnswers = accepted,
            options = emptyList(), pairs = emptyList(), solution = solution, media = ExerciseMedia.Board(board),
            explanation = explanation,
        )
    }

    /** A key to tap on the piano; `midi` are all the keys that are right (every octave of a note name, say). */
    fun key(
        id: String,
        key: String? = null,
        prompt: String,
        midi: List<Int>,
        solution: String,
        explanation: String = "",
        media: ExerciseMedia? = null,
    ): LearnExercise? {
        if (midi.isEmpty()) return null
        return LearnExercise(
            id = id, kind = ExerciseKind.PIANO_KEY, cardKeys = keysOf(key), prompt = prompt,
            correctAnswers = midi.map { it.toString() }, options = emptyList(), pairs = emptyList(), solution = solution,
            media = media, explanation = explanation,
        )
    }

    // Lessons

    /** A seed for one run of one node: the same node and seed always give the same value, other nodes differ. */
    fun seed(node: CourseNode, base: ULong): ULong = seed(node.id, base)

    fun seed(nodeID: String, base: ULong): ULong {
        var hash = base xor 0x9E3779B97F4A7C15uL
        for (byte in nodeID.toByteArray(Charsets.UTF_8)) {
            hash = (hash xor (byte.toInt() and 0xFF).toULong()) * 0x100000001B3uL
        }
        return hash
    }

    /** At most `limit` exercises with distinct ids, easy kinds first; exercises of the same kind keep their order. */
    fun arrange(exercises: List<LearnExercise?>, limit: Int = ExerciseBuilder.maxExercises): List<LearnExercise> {
        val seen = HashSet<String>()
        val unique = mutableListOf<LearnExercise>()
        for (exercise in exercises) {
            if (exercise == null || !seen.add(exercise.id)) continue
            unique.add(exercise)
        }
        // sortedBy is stable.
        return unique.sortedBy { it.kind.difficulty }.take(maxOf(0, limit))
    }

    /** Words of a sentence as tiles: split at whitespace, with the closing punctuation left on the last tile. */
    fun tiles(sentence: String): List<String> {
        val out = mutableListOf<String>()
        val current = StringBuilder()
        for (c in sentence) {
            if (c.isWhitespace()) {
                if (current.isNotEmpty()) { out.add(current.toString()); current.setLength(0) }
            } else current.append(c)
        }
        if (current.isNotEmpty()) out.add(current.toString())
        return out
    }
}
