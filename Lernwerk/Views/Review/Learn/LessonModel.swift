import Foundation

/// The lesson on screen: the session plus what the student has picked, put together or typed for the current
/// exercise. All of it lives in this one object, so turning the device or showing the keyboard keeps every choice.
final class LessonModel: ObservableObject {
    enum PairOutcome: Equatable {
        case match, miss
        case finished(LearnVerdict)
    }

    /// A front and a back that were paired wrongly, shown red until the next tap.
    struct PairMiss: Equatable {
        let key: String
        let back: Int
    }

    @Published private(set) var session: LessonSession
    @Published var typed = ""
    @Published var choice: String?
    /// Word bank: positions in the options, in the order tapped.
    @Published var tiles: [Int] = []
    @Published private(set) var matched: Set<String> = []
    @Published private(set) var matchedBacks: Set<Int> = []
    @Published private(set) var pickedFront: String?
    @Published private(set) var pickedBack: Int?
    @Published private(set) var lastMiss: PairMiss?
    /// Pairs: the cards whose front was paired with a wrong back.
    private var missed: Set<String> = []
    private var reported = false

    init(cards: [CardSnapshot], exercises: [LearnExercise], sessionID: String) {
        session = LessonSession(
            lessonID: LearnPath.lessonID(for: cards.map(\.key)), cardKeys: cards.map(\.key), exercises: exercises,
            sessionID: sessionID
        )
    }

    convenience init(cards: [CardSnapshot], deck: [CardSnapshot], distractors: [String: [String]], seed: UInt64, sessionID: String) {
        let builder = ExerciseBuilder(lesson: cards, deck: deck.isEmpty ? cards : deck, cachedDistractors: distractors)
        self.init(cards: cards, exercises: builder.build(seed: seed), sessionID: sessionID)
    }

    var current: LearnExercise? { session.current }

    var isAnswering: Bool { session.phase == .answering }

    var verdict: LearnVerdict? {
        if case let .feedback(verdict) = session.phase { return verdict }
        return nil
    }

    var canCheck: Bool {
        guard isAnswering, let exercise = current else { return false }
        switch exercise.kind {
        case .multipleChoice: return choice != nil
        case .typeAnswer: return !typed.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .wordBank: return !tiles.isEmpty
        case .matchPairs: return false
        }
    }

    @discardableResult
    func check() -> LearnVerdict? {
        guard canCheck, let exercise = current else { return nil }
        let answer: LearnAnswer
        switch exercise.kind {
        case .multipleChoice: answer = .option(choice ?? "")
        case .typeAnswer: answer = .typed(typed)
        case .wordBank: answer = .words(tiles.filter { exercise.options.indices.contains($0) }.map { exercise.options[$0] })
        case .matchPairs: answer = .pairs(missed: missed)
        }
        return session.submit(answer)
    }

    func overrule() {
        session.overrule()
    }

    func advance() {
        guard verdict != nil else { return }
        session.advance()
        resetDrafts()
    }

    /// The result, handed out once: the first time it is asked for after the lesson finished.
    func takeResult() -> LessonResult? {
        guard !reported, let result = session.result else { return nil }
        reported = true
        return result
    }

    // Word bank

    func addTile(_ index: Int) {
        guard isAnswering, !tiles.contains(index) else { return }
        tiles.append(index)
    }

    func removeTile(_ index: Int) {
        guard isAnswering else { return }
        tiles.removeAll { $0 == index }
    }

    // Pairs

    func pickFront(_ key: String) -> PairOutcome? {
        guard canPair, !matched.contains(key) else { return nil }
        lastMiss = nil
        pickedFront = pickedFront == key ? nil : key
        return pairIfReady()
    }

    func pickBack(_ index: Int) -> PairOutcome? {
        guard canPair, !matchedBacks.contains(index) else { return nil }
        lastMiss = nil
        pickedBack = pickedBack == index ? nil : index
        return pairIfReady()
    }

    private var canPair: Bool {
        isAnswering && current?.kind == .matchPairs
    }

    private func pairIfReady() -> PairOutcome? {
        guard let exercise = current, let key = pickedFront, let index = pickedBack else { return nil }
        pickedFront = nil
        pickedBack = nil
        guard exercise.options.indices.contains(index) else { return nil }
        guard exercise.isMatch(key: key, back: exercise.options[index]) else {
            missed.insert(key)
            lastMiss = PairMiss(key: key, back: index)
            return .miss
        }
        matched.insert(key)
        matchedBacks.insert(index)
        guard matched.count == exercise.pairs.count else { return .match }
        return session.submit(.pairs(missed: missed)).map(PairOutcome.finished) ?? .match
    }

    private func resetDrafts() {
        typed = ""
        choice = nil
        tiles = []
        matched = []
        matchedBacks = []
        pickedFront = nil
        pickedBack = nil
        lastMiss = nil
        missed = []
    }
}
