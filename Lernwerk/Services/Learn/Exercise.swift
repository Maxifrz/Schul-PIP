import Foundation

/// The kinds of exercise in a lesson, from easy to hard.
enum ExerciseKind: String, CaseIterable, Codable {
    case multipleChoice, matchPairs, wordBank, typeAnswer

    /// Lessons go from recognising an answer to recalling it.
    var difficulty: Int {
        switch self {
        case .multipleChoice: return 0
        case .matchPairs: return 1
        case .wordBank: return 2
        case .typeAnswer: return 3
        }
    }
}

/// One step of a lesson. `Exercise` is taken by the study plan's Übungsaufgaben.
struct LearnExercise: Identifiable, Equatable {
    struct Pair: Equatable {
        let key: String
        let front: String
        let back: String
    }

    /// Unique within its lesson.
    let id: String
    let kind: ExerciseKind
    let cardKeys: [String]
    /// The question; for pairs the instruction.
    let prompt: String
    /// Multiple choice and typing: the back. Word bank: its words in order. Pairs: the backs in the order of `pairs`.
    let correctAnswers: [String]
    /// Multiple choice: the back and three wrong answers. Word bank: the tiles. Pairs: the backs. Typing: none.
    let options: [String]
    /// Pairs only: the cards, in the order their fronts are shown.
    let pairs: [Pair]
    /// What the feedback shows after a wrong answer.
    let solution: String

    /// The cards answered wrong, empty when the answer is right.
    func missedKeys(for answer: LearnAnswer) -> Set<String> {
        let all = Set(cardKeys)
        switch (kind, answer) {
        case let (.multipleChoice, .option(choice)):
            return choice == correctAnswers.first ? [] : all
        case let (.typeAnswer, .typed(text)):
            guard let expected = correctAnswers.first else { return all }
            return AnswerCheck.evaluate(answer: text, expected: expected) == .correct ? [] : all
        case let (.wordBank, .words(words)):
            return LearnExercise.sameWords(words, correctAnswers) ? [] : all
        case let (.matchPairs, .pairs(missed)):
            return missed.intersection(all)
        default:
            return all
        }
    }

    /// Pairs: whether a back belongs to the card with this key.
    func isMatch(key: String, back: String) -> Bool {
        guard let pair = pairs.first(where: { $0.key == key }) else { return false }
        return LearnExercise.folded(pair.back) == LearnExercise.folded(back)
    }

    /// Word by word, ignoring case, umlaut spelling and punctuation.
    static func sameWords(_ given: [String], _ expected: [String]) -> Bool {
        given.count == expected.count && zip(given, expected).allSatisfy { folded($0) == folded($1) }
    }

    static func folded(_ text: String) -> String {
        AnswerCheck.compact(AnswerCheck.normalize(text))
    }
}

/// What the student gives for an exercise.
enum LearnAnswer: Equatable {
    case option(String)
    case typed(String)
    case words([String])
    /// The cards whose front was paired with a wrong back at least once.
    case pairs(missed: Set<String>)
}

enum LearnVerdict: Equatable {
    case right, wrong
}
