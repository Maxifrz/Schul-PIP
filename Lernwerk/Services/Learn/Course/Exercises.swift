import Foundation

/// Builds the exercises of the course engines in one shape: the same ids, the same shuffling, the same checks. An
/// engine decides what to ask; this decides how it is put. A builder returns nil when the material cannot make a
/// sound exercise (too few different wrong answers, a pair that could be taken for another), and the engine leaves
/// that exercise out instead of inventing something.
enum Exercises {
    /// A question with a right answer among two to four options. The wrong ones are cut to three, the options
    /// shuffled; nothing that reads the same as the right answer survives.
    static func choice<R: RandomNumberGenerator>(
        id: String,
        key: String? = nil,
        prompt: String,
        correct: String,
        wrong: [String],
        solution: String? = nil,
        explanation: String = "",
        media: ExerciseMedia? = nil,
        using random: inout R
    ) -> LearnExercise? {
        var seen: Set<String> = [LearnExercise.folded(correct)]
        var options = [correct]
        for candidate in wrong where options.count < 4 {
            let trimmed = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty, seen.insert(LearnExercise.folded(trimmed)).inserted else { continue }
            options.append(trimmed)
        }
        guard options.count >= 2, !LearnExercise.folded(correct).isEmpty else { return nil }
        return LearnExercise(
            id: id, kind: .multipleChoice, cardKeys: key.map { [$0] } ?? [], prompt: prompt, correctAnswers: [correct],
            options: options.shuffled(using: &random), pairs: [], solution: solution ?? correct,
            media: media, explanation: explanation
        )
    }

    /// The answer typed. `alternatives` are accepted too; `solution` is what a wrong answer is shown.
    static func typed(
        id: String,
        key: String? = nil,
        prompt: String,
        answer: String,
        alternatives: [String] = [],
        mode: AnswerMode = .text,
        solution: String? = nil,
        explanation: String = "",
        media: ExerciseMedia? = nil
    ) -> LearnExercise? {
        let all = ([answer] + alternatives).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        guard let first = all.first else { return nil }
        if mode == .number, NumberCheck.parse(first) == nil { return nil }
        return LearnExercise(
            id: id, kind: .typeAnswer, cardKeys: key.map { [$0] } ?? [], prompt: prompt, correctAnswers: all, options: [],
            pairs: [], solution: solution ?? first, media: media, mode: mode, explanation: explanation
        )
    }

    /// A sentence put together from tiles. `words` are the right tiles in order, `extra` up to two that do not
    /// belong; the tiles never come out in the right order by chance.
    static func bank<R: RandomNumberGenerator>(
        id: String,
        key: String? = nil,
        prompt: String,
        words: [String],
        extra: [String] = [],
        solution: String? = nil,
        explanation: String = "",
        media: ExerciseMedia? = nil,
        using random: inout R
    ) -> LearnExercise? {
        let tiles = words.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        guard tiles.count >= 2, tiles.count <= 10 else { return nil }
        var seen = Set(tiles.map(LearnExercise.folded))
        var extras: [String] = []
        for candidate in extra where extras.count < ExerciseBuilder.extraWords {
            let trimmed = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty, seen.insert(LearnExercise.folded(trimmed)).inserted { extras.append(trimmed) }
        }
        var options = (tiles + extras).shuffled(using: &random)
        var attempts = 0
        while Array(options.prefix(tiles.count)) == tiles, Set(options).count > 1, attempts < 3 {
            options.shuffle(using: &random)
            attempts += 1
        }
        return LearnExercise(
            id: id, kind: .wordBank, cardKeys: key.map { [$0] } ?? [], prompt: prompt, correctAnswers: tiles,
            options: options, pairs: [], solution: solution ?? tiles.joined(separator: " "), media: media,
            explanation: explanation
        )
    }

    /// Four items to pair up. nil unless the fronts differ from each other and so do the backs.
    static func pairs<R: RandomNumberGenerator>(
        id: String,
        prompt: String = ExerciseBuilder.pairsPrompt,
        items: [(key: String, front: String, back: String)],
        using random: inout R
    ) -> LearnExercise? {
        guard items.count == ExerciseBuilder.pairCount else { return nil }
        let fronts = Set(items.map { LearnExercise.folded($0.front) })
        let backs = Set(items.map { LearnExercise.folded($0.back) })
        guard fronts.count == items.count, backs.count == items.count, !fronts.contains(""), !backs.contains("") else { return nil }
        let pairs = items.map { LearnExercise.Pair(key: $0.key, front: $0.front, back: $0.back) }.shuffled(using: &random)
        return LearnExercise(
            id: id, kind: .matchPairs, cardKeys: pairs.map(\.key), prompt: prompt, correctAnswers: pairs.map(\.back),
            options: pairs.map(\.back).shuffled(using: &random), pairs: pairs,
            solution: pairs.map { "\($0.front) – \($0.back)" }.joined(separator: "\n")
        )
    }

    /// A chess move to find. `accepted` are all the moves that solve it, in coordinate notation like "e2e4".
    static func move(
        id: String,
        key: String? = nil,
        prompt: String,
        board: BoardSpec,
        accepted: [String],
        solution: String,
        explanation: String = ""
    ) -> LearnExercise? {
        guard !accepted.isEmpty else { return nil }
        return LearnExercise(
            id: id, kind: .chessMove, cardKeys: key.map { [$0] } ?? [], prompt: prompt, correctAnswers: accepted,
            options: [], pairs: [], solution: solution, media: .board(board), explanation: explanation
        )
    }

    /// A key to tap on the piano; `midi` are all the keys that are right (every octave of a note name, say).
    static func key(
        id: String,
        key: String? = nil,
        prompt: String,
        midi: [Int],
        solution: String,
        explanation: String = "",
        media: ExerciseMedia? = nil
    ) -> LearnExercise? {
        guard !midi.isEmpty else { return nil }
        return LearnExercise(
            id: id, kind: .pianoKey, cardKeys: key.map { [$0] } ?? [], prompt: prompt, correctAnswers: midi.map(String.init),
            options: [], pairs: [], solution: solution, media: media, explanation: explanation
        )
    }

    // Lessons

    /// A seed for one run of one node: the same node and seed always give the same value, other nodes differ.
    static func seed(for node: CourseNode, base: UInt64) -> UInt64 {
        var hash = base ^ 0x9E37_79B9_7F4A_7C15
        for byte in node.id.utf8 {
            hash = (hash ^ UInt64(byte)) &* 0x0000_0100_0000_01B3
        }
        return hash
    }

    /// At most `limit` exercises with distinct ids, easy kinds first; exercises of the same kind keep their order.
    static func arrange(_ exercises: [LearnExercise?], limit: Int = ExerciseBuilder.maxExercises) -> [LearnExercise] {
        var seen = Set<String>()
        var unique: [LearnExercise] = []
        for case let exercise? in exercises where seen.insert(exercise.id).inserted {
            unique.append(exercise)
        }
        let ordered = unique.enumerated().sorted { a, b in
            a.element.kind.difficulty != b.element.kind.difficulty
                ? a.element.kind.difficulty < b.element.kind.difficulty : a.offset < b.offset
        }.map(\.element)
        return Array(ordered.prefix(limit))
    }

    /// Words of a sentence as tiles: split at spaces, with the sentence's closing punctuation left on the last tile
    /// ("Ich heiße Ana." gives "Ich", "heiße", "Ana.").
    static func tiles(of sentence: String) -> [String] {
        sentence.split(whereSeparator: \.isWhitespace).map(String.init)
    }
}
