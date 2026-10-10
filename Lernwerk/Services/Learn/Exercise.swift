import Foundation

/// The kinds of exercise in a lesson, from easy to hard.
enum ExerciseKind: String, CaseIterable, Codable {
    case multipleChoice, matchPairs, wordBank, typeAnswer
    /// Chess: tap a piece, then its square; the answer is a move like "e2e4".
    case chessMove
    /// A piano keyboard: tap a key; the answer is its MIDI number as text, like "60" for the middle C.
    case pianoKey

    /// Lessons go from recognising an answer to recalling it.
    var difficulty: Int {
        switch self {
        case .multipleChoice, .pianoKey: return 0
        case .matchPairs: return 1
        case .chessMove: return 2
        case .wordBank: return 2
        case .typeAnswer: return 3
        }
    }
}

/// How a typed answer is compared with the right one.
enum AnswerMode: String, Codable {
    /// `AnswerCheck`: words, typos, endings, umlauts.
    case text
    /// `NumberCheck`: the same number, whether typed as a fraction, a decimal fraction or a whole number.
    case number
    /// The same letters in the same order: forgives capitals, accents and punctuation, nothing else. For answers in a
    /// language being learned, where "hermana" is not "hermano" and word order matters.
    case exact
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
    /// Something to look at or listen to above the question: a spoken word, a position, a staff, notes to play.
    var media: ExerciseMedia? = nil
    /// Typing only: how the answer is compared.
    var mode: AnswerMode = .text
    /// A sentence of why, shown with the verdict ("Nach „weil“ steht das Verb am Ende."). Empty for none.
    var explanation: String = ""

    /// The cards answered wrong, empty when the answer is right. An exercise without cards (a course's) stands for
    /// itself, so a wrong answer is never an empty set.
    func missedKeys(for answer: LearnAnswer) -> Set<String> {
        let all: Set<String> = cardKeys.isEmpty ? [id] : Set(cardKeys)
        switch (kind, answer) {
        case let (.multipleChoice, .option(choice)), let (.pianoKey, .option(choice)):
            return correctAnswers.contains(choice) ? [] : all
        case let (.chessMove, .move(uci)):
            return correctAnswers.contains(uci) ? [] : all
        case let (.typeAnswer, .typed(text)):
            guard let expected = correctAnswers.first else { return all }
            if mode == .number {
                return correctAnswers.contains { NumberCheck.matches(text, expected: $0) } ? [] : all
            }
            if mode == .exact {
                let given = LearnExercise.folded(text)
                return !given.isEmpty && correctAnswers.contains { LearnExercise.folded($0) == given } ? [] : all
            }
            _ = expected
            return correctAnswers.contains { AnswerCheck.evaluate(answer: text, expected: $0) == .correct } ? [] : all
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
    /// A chess move in coordinate notation, "e2e4".
    case move(String)
}

enum LearnVerdict: Equatable {
    case right, wrong
}
