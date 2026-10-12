import Foundation

/// Checks a course the way the screens will use it: every node, a few seeds, every exercise. The tests of each
/// course run it, so a course that would show an empty question, a right answer twice among the options or a move
/// in the wrong notation never ships. It checks the shape, not the facts; a teacher checks the facts.
enum CourseAudit {
    static let lessonRange = 8...12
    static let checkpointRange = 10...15

    static func problems(of provider: any CourseProvider, seeds: [UInt64] = [1, 2, 3]) -> [String] {
        var problems = provider.structureProblems()
        for node in provider.course.nodes {
            if node.kind == .chest {
                if !provider.exercises(for: node, seed: 1).isEmpty { problems.append("\(node.id): a chest has exercises.") }
                continue
            }
            for seed in seeds {
                let exercises = provider.exercises(for: node, seed: seed)
                problems += self.problems(in: exercises, node: node).map { "\($0) (seed \(seed))" }
                if exercises != provider.exercises(for: node, seed: seed) {
                    problems.append("\(node.id): the same seed gives other exercises (seed \(seed)).")
                }
            }
        }
        return problems
    }

    static func problems(in exercises: [LearnExercise], node: CourseNode) -> [String] {
        var problems: [String] = []
        let range = node.kind == .checkpoint ? checkpointRange : lessonRange
        if !range.contains(exercises.count) {
            problems.append("\(node.id): \(exercises.count) exercises, expected \(range.lowerBound) to \(range.upperBound).")
        }
        let ids = exercises.map(\.id)
        if Set(ids).count != ids.count { problems.append("\(node.id): exercise ids are not unique.") }
        let difficulties = exercises.map(\.kind.difficulty)
        if difficulties != difficulties.sorted() { problems.append("\(node.id): the exercises do not go from easy to hard.") }
        for exercise in exercises {
            problems += self.problems(in: exercise).map { "\(node.id) \(exercise.id): \($0)" }
        }
        return problems
    }

    static func problems(in exercise: LearnExercise) -> [String] {
        var problems: [String] = []
        func blank(_ text: String) -> Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        if exercise.id.isEmpty { problems.append("empty id") }
        if blank(exercise.prompt) { problems.append("empty prompt") }
        if blank(exercise.solution) { problems.append("empty solution") }
        if exercise.correctAnswers.isEmpty || exercise.correctAnswers.contains(where: blank) { problems.append("missing right answer") }
        if let media = exercise.media {
            switch media {
            case let .speech(text, language):
                if blank(text) || blank(language) { problems.append("speech without text or language") }
            case let .board(board):
                if !board.fen.contains("/") { problems.append("board without a FEN") }
            case let .staff(staff):
                if staff.notes.isEmpty { problems.append("staff without notes") }
            case let .tones(tones):
                if tones.midi.isEmpty || tones.midi.contains(where: { !(21...108).contains($0) }) { problems.append("tones out of range") }
            }
        }
        switch exercise.kind {
        case .multipleChoice:
            let folded = exercise.options.map(LearnExercise.folded)
            if !(2...4).contains(exercise.options.count) { problems.append("\(exercise.options.count) options") }
            if Set(folded).count != folded.count { problems.append("options that read the same") }
            if exercise.correctAnswers.count != 1 { problems.append("a choice needs exactly one right answer") }
            if exercise.options.filter({ exercise.correctAnswers.contains($0) }).count != 1 {
                problems.append("the right answer is not among the options exactly once")
            }
            if exercise.options.contains(where: blank) { problems.append("blank option") }
        case .typeAnswer:
            if exercise.mode == .number, exercise.correctAnswers.contains(where: { NumberCheck.parse($0) == nil }) {
                problems.append("a number answer that is not a number")
            }
        case .wordBank:
            let tiles = exercise.correctAnswers
            if tiles.count < 2 { problems.append("a word bank with fewer than two words") }
            var remaining = exercise.options
            for word in tiles {
                if let index = remaining.firstIndex(of: word) { remaining.remove(at: index) } else { problems.append("tile \(word) is missing") }
            }
            if remaining.count > ExerciseBuilder.extraWords { problems.append("too many extra tiles") }
            if Array(exercise.options.prefix(tiles.count)) == tiles { problems.append("tiles come in the right order") }
        case .matchPairs:
            if exercise.pairs.count != ExerciseBuilder.pairCount { problems.append("\(exercise.pairs.count) pairs") }
            let fronts = exercise.pairs.map { LearnExercise.folded($0.front) }
            let backs = exercise.pairs.map { LearnExercise.folded($0.back) }
            if Set(fronts).count != fronts.count || Set(backs).count != backs.count { problems.append("pairs that read the same") }
            if Set(exercise.options.map(LearnExercise.folded)) != Set(backs) { problems.append("pair options differ from the backs") }
        case .chessMove:
            guard case .board? = exercise.media else { problems.append("a chess move without a board"); break }
            for move in exercise.correctAnswers where !isMove(move) { problems.append("\(move) is not a move like e2e4") }
        case .pianoKey:
            for key in exercise.correctAnswers where Int(key).map({ (21...108).contains($0) }) != true {
                problems.append("\(key) is not a piano key")
            }
        }
        return problems
    }

    private static func isMove(_ text: String) -> Bool {
        let characters = Array(text)
        guard characters.count == 4 || characters.count == 5 else { return false }
        let files = "abcdefgh", ranks = "12345678"
        guard files.contains(characters[0]), ranks.contains(characters[1]), files.contains(characters[2]), ranks.contains(characters[3]) else {
            return false
        }
        return characters.count == 4 || "qrbn".contains(characters[4])
    }
}
