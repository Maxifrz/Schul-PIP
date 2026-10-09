import Foundation

/// Seeded random numbers for the Lernpfad (SplitMix64), so the same seed builds the same lesson.
struct LearnRandom: RandomNumberGenerator {
    private var mix: SplitMix

    init(seed: UInt64) {
        mix = SplitMix(seed: seed)
    }

    mutating func next() -> UInt64 {
        mix.next()
    }
}

/// Builds a lesson's exercises from its cards, easy to hard, and every card ends with typing its answer. Wrong
/// answers come from the student's other cards, or from wrong answers a model wrote for the card and that passed the
/// same check; nothing is made up here. A card without three of them gets no multiple choice.
struct ExerciseBuilder {
    static let maxExercises = 12
    static let minExercises = 8
    static let distractorCount = 3
    static let pairCount = 4
    static let maxPairWords = 6
    static let wordBankRange = 3...8
    static let extraWords = 2
    /// Answers with these (or with digits) are formulas, and formulas are typed, not put together from tiles.
    static let formulaSymbols = CharacterSet(charactersIn: "=+−*/^²³√π·×()<>[]{}|∫′⇒→←↔≤≥≈≠∑∞%_\\")
    static let pairsPrompt = "Finde die Paare"
    /// From this many cards on, a lesson always has at least `minExercises`.
    static let fullLessonCards = 4

    let lesson: [CardSnapshot]
    /// Every card of the student, the lesson's own included or not.
    let deck: [CardSnapshot]
    /// Checked wrong answers from the tutor model, by card key; used only when the deck has too few of its own.
    var cachedDistractors: [String: [String]]

    init(lesson: [CardSnapshot], deck: [CardSnapshot], cachedDistractors: [String: [String]] = [:]) {
        self.lesson = lesson
        self.deck = deck
        self.cachedDistractors = cachedDistractors
    }

    func build(seed: UInt64) -> [LearnExercise] {
        var random = LearnRandom(seed: seed)
        return build(using: &random)
    }

    func build<R: RandomNumberGenerator>(using random: inout R) -> [LearnExercise] {
        let cards = ExerciseBuilder.unique(lesson)
        guard !cards.isEmpty else { return [] }
        var choice: [String: LearnExercise] = [:]
        var bank: [String: LearnExercise] = [:]
        for card in cards {
            choice[card.key] = multipleChoice(for: card, using: &random)
            bank[card.key] = wordBank(for: card, using: &random)
        }
        let pairRounds = matchPairs(cards, using: &random)

        // Every card is typed once at the end; the easier exercises share what is left of the twelve.
        let budget = max(0, ExerciseBuilder.maxExercises - cards.count)
        var extras: [LearnExercise] = []
        var used = Set<String>()
        var covered = Set<String>()
        // One round of pairs covers four cards with one exercise.
        if budget > 0, let first = pairRounds.first {
            extras.append(first)
            used.insert(first.id)
            covered.formUnion(first.cardKeys)
        }
        // Every other card gets one easy exercise: multiple choice, else a word bank.
        for card in cards where !covered.contains(card.key) && extras.count < budget {
            guard let exercise = choice[card.key] ?? bank[card.key] else { continue }
            extras.append(exercise)
            used.insert(exercise.id)
            covered.insert(card.key)
        }
        // The rest of the budget: word banks, more pairs, then multiple choice for the cards the pairs covered.
        let more = cards.compactMap { bank[$0.key] } + Array(pairRounds.dropFirst()) + cards.compactMap { choice[$0.key] }
        for exercise in more where extras.count < budget && !used.contains(exercise.id) {
            extras.append(exercise)
            used.insert(exercise.id)
        }
        // Too short a lesson repeats exercises once, shuffled anew: its easy ones and, from four cards on, typing a
        // card a second time, which always reaches the minimum. Below four cards it stays short rather than repeat
        // the same few questions over and over.
        var again = extras
        if cards.count >= ExerciseBuilder.fullLessonCards { again += cards.map(typeAnswer) }
        for exercise in again where cards.count + extras.count < ExerciseBuilder.minExercises {
            extras.append(repeated(exercise, using: &random))
        }

        let all = extras + cards.map(typeAnswer)
        var ordered: [LearnExercise] = []
        for kind in ExerciseKind.allCases.sorted(by: { $0.difficulty < $1.difficulty }) {
            var group = all.filter { $0.kind == kind }
            group.shuffle(using: &random)
            ordered += group
        }
        return ordered
    }

    // Multiple choice

    private func multipleChoice<R: RandomNumberGenerator>(for card: CardSnapshot, using random: inout R) -> LearnExercise? {
        let candidates = distractorCandidates(for: card, using: &random).lazy
            .filter { !ExerciseBuilder.asksTheSame(card, $0) }
            .map(\.back)
        var picked = ExerciseBuilder.pickDistractors(for: card.back, from: candidates)
        if picked.count < ExerciseBuilder.distractorCount, let cached = cachedDistractors[card.key] {
            picked += ExerciseBuilder.pickDistractors(
                for: card.back, from: cached, count: ExerciseBuilder.distractorCount - picked.count, excluding: picked
            )
        }
        guard picked.count == ExerciseBuilder.distractorCount else { return nil }
        return LearnExercise(
            id: "multipleChoice:\(card.key)", kind: .multipleChoice, cardKeys: [card.key], prompt: card.front,
            correctAnswers: [card.back], options: ([card.back] + picked).shuffled(using: &random), pairs: [],
            solution: card.back
        )
    }

    /// The backs of the unit's other cards first, then of the other units.
    /// The other cards of the unit first, then of the other units. A card that asks the same question is skipped by
    /// the caller, lazily, since its back is a right answer worded differently.
    private func distractorCandidates<R: RandomNumberGenerator>(for card: CardSnapshot, using random: inout R) -> [CardSnapshot] {
        let pool = ExerciseBuilder.unique(lesson + deck).filter { $0.key != card.key }
        var sameUnit = pool.filter { $0.materialID == card.materialID }
        var otherUnits = pool.filter { $0.materialID != card.materialID }
        sameUnit.shuffle(using: &random)
        otherUnits.shuffle(using: &random)
        return sameUnit + otherUnits
    }

    /// Up to `count` clearly wrong answers, in the order given and none twice; stops reading once it has them.
    static func pickDistractors<S: Sequence>(
        for answer: String, from candidates: S, count: Int = distractorCount, excluding taken: [String] = []
    ) -> [String] where S.Element == String {
        var seen = Set(taken.map(LearnExercise.folded))
        var picked: [String] = []
        guard count > 0 else { return picked }
        for candidate in candidates {
            let text = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
            guard isValidDistractor(text, for: answer), seen.insert(LearnExercise.folded(text)).inserted else { continue }
            picked.append(text)
            if picked.count == count { break }
        }
        return picked
    }

    /// A wrong answer has to be wrong for the answer check in both directions: if the check would accept it for the
    /// real answer, or the real answer for it, a student choosing it would not be clearly wrong.
    static func isValidDistractor(_ candidate: String, for answer: String) -> Bool {
        let folded = LearnExercise.folded(candidate)
        guard !folded.isEmpty else { return false }
        if AnswerCheck.normalize(candidate) == AnswerCheck.normalize(answer) || folded == LearnExercise.folded(answer) {
            return false
        }
        if AnswerCheck.evaluate(answer: candidate, expected: answer) == .correct { return false }
        if AnswerCheck.evaluate(answer: answer, expected: candidate) == .correct { return false }
        return true
    }

    /// The same card, or one whose question the answer check would take for this one's in either direction ("Wie
    /// lautet die Kettenregel?" twice, or once more with "für verkettete Funktionen").
    static func asksTheSame(_ card: CardSnapshot, _ other: CardSnapshot) -> Bool {
        if card.key == other.key || LearnExercise.folded(card.front) == LearnExercise.folded(other.front) { return true }
        return AnswerCheck.evaluate(answer: card.front, expected: other.front) == .correct
            || AnswerCheck.evaluate(answer: other.front, expected: card.front) == .correct
    }

    /// The cards for which the deck has fewer than three wrong answers; only these are worth asking a model about.
    static func cardsNeedingDistractors(in deck: [CardSnapshot]) -> [CardSnapshot] {
        let cards = unique(deck)
        return cards.filter { card in
            let candidates = cards.lazy.filter { !asksTheSame(card, $0) }.map(\.back)
            return pickDistractors(for: card.back, from: candidates).count < distractorCount
        }
    }

    // Word bank

    /// The words of a back of three to eight words without digits or formula symbols, else nil.
    static func wordBankWords(_ text: String) -> [String]? {
        guard !text.contains(where: \.isNumber), text.rangeOfCharacter(from: formulaSymbols) == nil else { return nil }
        let raw = text.split(whereSeparator: \.isWhitespace).map(String.init)
        // A minus between spaces is arithmetic.
        if raw.contains("-") { return nil }
        let words = raw.map(trimmedWord).filter { !LearnExercise.folded($0).isEmpty }
        return wordBankRange.contains(words.count) ? words : nil
    }

    private func wordBank<R: RandomNumberGenerator>(for card: CardSnapshot, using random: inout R) -> LearnExercise? {
        guard let words = ExerciseBuilder.wordBankWords(card.back) else { return nil }
        let pool = ExerciseBuilder.unique(lesson + deck)
        var sameUnit = pool.filter { $0.key != card.key && $0.materialID == card.materialID }
        var otherUnits = pool.filter { $0.materialID != card.materialID }
        sameUnit.shuffle(using: &random)
        otherUnits.shuffle(using: &random)
        var seen = Set(words.map(LearnExercise.folded))
        var extras: [String] = []
        // One word from each of up to two other cards.
        for source in sameUnit + otherUnits where extras.count < ExerciseBuilder.extraWords {
            var candidates = ExerciseBuilder.plainWords(source.back)
            candidates.shuffle(using: &random)
            if let word = candidates.first(where: { !seen.contains(LearnExercise.folded($0)) }) {
                seen.insert(LearnExercise.folded(word))
                extras.append(word)
            }
        }
        var options = (words + extras).shuffled(using: &random)
        // Tiles that already lie in the right order give the answer away.
        var attempts = 0
        while Array(options.prefix(words.count)) == words, Set(options).count > 1, attempts < 3 {
            options.shuffle(using: &random)
            attempts += 1
        }
        return LearnExercise(
            id: "wordBank:\(card.key)", kind: .wordBank, cardKeys: [card.key], prompt: card.front,
            correctAnswers: words, options: options, pairs: [], solution: card.back
        )
    }

    /// Words of at least three letters without digits or formula symbols, as extra tiles.
    static func plainWords(_ text: String) -> [String] {
        text.split(whereSeparator: \.isWhitespace)
            .map { trimmedWord(String($0)) }
            .filter { word in
                !word.contains(where: \.isNumber) && word.rangeOfCharacter(from: formulaSymbols) == nil
                    && LearnExercise.folded(word).count >= 3
            }
    }

    private static func trimmedWord(_ word: String) -> String {
        word.trimmingCharacters(in: CharacterSet.punctuationCharacters.union(.symbols).union(.whitespaces))
    }

    static func wordCount(_ text: String) -> Int {
        text.split(whereSeparator: \.isWhitespace).count
    }

    // Pairs

    /// Groups of four cards with short backs; within a group no two fronts or backs could be taken for each other.
    private func matchPairs<R: RandomNumberGenerator>(_ cards: [CardSnapshot], using random: inout R) -> [LearnExercise] {
        var rest = cards.filter { card in
            ExerciseBuilder.wordCount(card.back) <= ExerciseBuilder.maxPairWords
                && !LearnExercise.folded(card.back).isEmpty && !LearnExercise.folded(card.front).isEmpty
        }
        rest.shuffle(using: &random)
        var rounds: [LearnExercise] = []
        while rest.count >= ExerciseBuilder.pairCount {
            var group: [CardSnapshot] = []
            var skipped: [CardSnapshot] = []
            for card in rest {
                let fits = group.count < ExerciseBuilder.pairCount && group.allSatisfy { other in
                    !ExerciseBuilder.asksTheSame(card, other) && ExerciseBuilder.isValidDistractor(card.back, for: other.back)
                }
                if fits { group.append(card) } else { skipped.append(card) }
            }
            guard group.count == ExerciseBuilder.pairCount else { break }
            let pairs = group.map { LearnExercise.Pair(key: $0.key, front: $0.front, back: $0.back) }.shuffled(using: &random)
            rounds.append(LearnExercise(
                id: "matchPairs:" + group.map(\.key).sorted().joined(separator: "+"),
                kind: .matchPairs, cardKeys: group.map(\.key), prompt: ExerciseBuilder.pairsPrompt,
                correctAnswers: pairs.map(\.back), options: pairs.map(\.back).shuffled(using: &random), pairs: pairs,
                solution: pairs.map { "\($0.front) – \($0.back)" }.joined(separator: "\n")
            ))
            rest = skipped
        }
        return rounds
    }

    // Typing

    private func typeAnswer(_ card: CardSnapshot) -> LearnExercise {
        LearnExercise(
            id: "typeAnswer:\(card.key)", kind: .typeAnswer, cardKeys: [card.key], prompt: card.front,
            correctAnswers: [card.back], options: [], pairs: [], solution: card.back
        )
    }

    /// The same exercise again with its options and pairs shuffled anew.
    private func repeated<R: RandomNumberGenerator>(_ exercise: LearnExercise, using random: inout R) -> LearnExercise {
        let pairs = exercise.pairs.shuffled(using: &random)
        return LearnExercise(
            id: exercise.id + "#2", kind: exercise.kind, cardKeys: exercise.cardKeys, prompt: exercise.prompt,
            correctAnswers: exercise.kind == .matchPairs ? pairs.map(\.back) : exercise.correctAnswers,
            options: exercise.options.shuffled(using: &random), pairs: pairs, solution: exercise.solution
        )
    }

    private static func unique(_ cards: [CardSnapshot]) -> [CardSnapshot] {
        var seen = Set<String>()
        return cards.filter { seen.insert($0.key).inserted }
    }
}
