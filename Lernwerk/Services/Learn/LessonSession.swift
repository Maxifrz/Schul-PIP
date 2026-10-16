import Foundation

/// How a lesson went, for the XP, the streak and the cards' schedule.
struct LessonResult: Equatable {
    let lessonID: String
    /// One per run of a lesson, so the same run is never counted twice.
    let sessionID: String
    let exerciseCount: Int
    let rightFirstTry: Int
    let rightOnRetry: Int
    /// The lesson's cards in order.
    let cardKeys: [String]
    /// The cards answered right on the first try in every exercise they were part of.
    let cardsRightFirstTry: Set<String>
    /// The first attempt of every exercise that shows evidence of a skill (see `LearnExercise.skill`).
    var outcomes: [ExerciseOutcome] = []

    var accuracy: Double {
        exerciseCount == 0 ? 0 : Double(rightFirstTry) / Double(exerciseCount)
    }
}

/// A lesson in progress: answer, see the verdict, go on. Every exercise answered wrong comes back once at the end; the
/// first attempt of each exercise is what counts for the cards.
struct LessonSession {
    enum Phase: Equatable {
        case answering
        case feedback(LearnVerdict)
        case finished
    }

    let lessonID: String
    let sessionID: String
    let cardKeys: [String]
    /// The exercises as built, without the ones that come back.
    let exerciseCount: Int
    private(set) var queue: [LearnExercise]
    private(set) var position = 0
    private(set) var phase: Phase

    private var attempted = Set<String>()
    /// The cards each exercise got wrong on its first attempt, by exercise id.
    private var firstMissed: [String: Set<String>] = [:]
    /// Whether the second attempt was right, by exercise id.
    private var retryRight: [String: Bool] = [:]
    private var requeued = Set<String>()
    /// How many times each exercise was checked, tries on the spot included.
    private var attempts: [String: Int] = [:]
    /// Whether a hint was shown before the first attempt, by exercise id.
    private var firstHelped: [String: Bool] = [:]
    /// How many hints were shown for each exercise, by exercise id.
    private var hintsShown: [String: Int] = [:]

    init(lessonID: String, cardKeys: [String], exercises: [LearnExercise], sessionID: String) {
        self.lessonID = lessonID
        self.sessionID = sessionID
        var seen = Set<String>()
        self.cardKeys = cardKeys.filter { seen.insert($0).inserted }
        queue = exercises
        exerciseCount = exercises.count
        phase = exercises.isEmpty ? .finished : .answering
    }

    var current: LearnExercise? {
        phase == .finished || position >= queue.count ? nil : queue[position]
    }

    /// The current exercise came back after a wrong answer.
    var isRetry: Bool {
        current != nil && position >= exerciseCount
    }

    /// Exercises answered right, or answered wrong a second time, of all; it never goes back.
    var progress: Double {
        guard exerciseCount > 0 else { return 1 }
        let settled = firstMissed.filter { $0.value.isEmpty }.count + retryRight.count
        return min(1, Double(settled) / Double(exerciseCount))
    }

    /// Hints shown so far for the current exercise.
    var hintCount: Int {
        current.flatMap { hintsShown[$0.id] } ?? 0
    }

    /// The hints of the current exercise shown so far, in order.
    var shownHints: [String] {
        guard let exercise = current else { return [] }
        return Array(exercise.hints.prefix(hintCount))
    }

    /// Whether the current exercise has a hint left to show.
    var hasMoreHints: Bool {
        guard phase == .answering, let exercise = current else { return false }
        return hintCount < exercise.hints.count
    }

    /// Shows the next hint of the current exercise and returns all that are shown, in order. A hint on a retry shows
    /// the same hints again and changes nothing about the first attempt.
    @discardableResult
    mutating func showHint() -> [String] {
        guard phase == .answering, let exercise = current else { return [] }
        let count = min(exercise.hints.count, hintCount + 1)
        hintsShown[exercise.id] = count
        return Array(exercise.hints.prefix(count))
    }

    /// Checks the answer and shows the verdict; nil when no exercise waits for an answer (a second tap on "Prüfen").
    @discardableResult
    mutating func submit(_ answer: LearnAnswer) -> LearnVerdict? {
        guard phase == .answering, let exercise = current else { return nil }
        let missed = exercise.missedKeys(for: answer)
        let verdict: LearnVerdict = missed.isEmpty ? .right : .wrong
        attempts[exercise.id, default: 0] += 1
        if attempted.insert(exercise.id).inserted {
            firstMissed[exercise.id] = missed
            firstHelped[exercise.id] = hintCount > 0
        } else if verdict == .right || isRetry {
            // A wrong try on the spot in the first round settles nothing: the exercise still comes back at the end.
            retryRight[exercise.id] = verdict == .right
        }
        phase = .feedback(verdict)
        return verdict
    }

    /// "Nochmal versuchen": the same exercise again right after a wrong answer, as often as the student likes. Only the
    /// first attempt counts for the skills; a right try here counts as a right retry and spares the exercise its
    /// second round at the end.
    mutating func tryAgain() {
        guard phase == .feedback(.wrong), current != nil else { return }
        phase = .answering
    }

    /// "War doch richtig": a typed answer the check did not accept counts as right.
    mutating func overrule() {
        guard phase == .feedback(.wrong), let exercise = current, exercise.kind == .typeAnswer else { return }
        if attempts[exercise.id, default: 0] > 1 {
            retryRight[exercise.id] = true
        } else {
            firstMissed[exercise.id] = []
        }
        phase = .feedback(.right)
    }

    /// "Weiter": an exercise not yet answered right again goes to the end of the queue, once.
    mutating func advance() {
        guard case let .feedback(verdict) = phase, let exercise = current else { return }
        if verdict == .wrong, retryRight[exercise.id] == nil, requeued.insert(exercise.id).inserted {
            queue.append(exercise)
        }
        position += 1
        phase = position < queue.count ? .answering : .finished
    }

    /// Only once the lesson is finished.
    var result: LessonResult? {
        guard phase == .finished else { return nil }
        let exercised = Set(queue.flatMap(\.cardKeys))
        let wrongCards = firstMissed.values.reduce(into: Set<String>()) { $0.formUnion($1) }
        return LessonResult(
            lessonID: lessonID,
            sessionID: sessionID,
            exerciseCount: exerciseCount,
            rightFirstTry: firstMissed.values.filter(\.isEmpty).count,
            rightOnRetry: retryRight.values.filter { $0 }.count,
            cardKeys: cardKeys,
            cardsRightFirstTry: Set(cardKeys).intersection(exercised).subtracting(wrongCards),
            outcomes: outcomes()
        )
    }
}

extension LessonSession {
    /// What the first attempts showed, in the order of the exercises, for the exercises that belong to a skill.
    func outcomes() -> [ExerciseOutcome] {
        var seen = Set<String>()
        var list: [ExerciseOutcome] = []
        for exercise in queue where seen.insert(exercise.id).inserted {
            guard !exercise.skill.isEmpty, let level = exercise.level, let missed = firstMissed[exercise.id] else { continue }
            list.append(ExerciseOutcome(
                exerciseID: exercise.id, skill: exercise.skill, level: level, right: missed.isEmpty,
                helped: firstHelped[exercise.id] ?? false
            ))
        }
        return list
    }
}

enum LessonGrading {
    /// Only the cards that were due when the lesson started get a grade: right on every first try is "good",
    /// anything else "again". Practising cards that are not due leaves their SM-2 intervals alone.
    /// Each card at most once, even if a result lists it twice.
    static func gradesToApply(_ result: LessonResult, dueKeys: Set<String>) -> [(key: String, grade: ReviewGrade)] {
        var seen = Set<String>()
        return result.cardKeys.filter { dueKeys.contains($0) && seen.insert($0).inserted }.map { key in
            (key: key, grade: result.cardsRightFirstTry.contains(key) ? ReviewGrade.good : ReviewGrade.again)
        }
    }
}
