import Foundation

/// Wrong answers the tutor model wrote for cards, by card key, in UserDefaults. A card whose text changes gets a new
/// key and is asked about again; an empty list means the model was asked and nothing it wrote passed the check.
struct DistractorCache {
    static let key = "learn.distractors"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func all() -> [String: [String]] {
        guard let data = defaults.data(forKey: DistractorCache.key),
              let stored = try? JSONDecoder().decode([String: [String]].self, from: data)
        else { return [:] }
        return stored
    }

    func distractors(for cardKey: String) -> [String]? {
        all()[cardKey]
    }

    func store(_ entries: [String: [String]]) {
        guard !entries.isEmpty else { return }
        save(all().merging(entries) { _, new in new })
    }

    /// Forgets the cards that are gone or changed.
    func prune(keeping cardKeys: Set<String>) {
        let current = all()
        let kept = current.filter { cardKeys.contains($0.key) }
        if kept.count != current.count { save(kept) }
    }

    private func save(_ entries: [String: [String]]) {
        if let data = try? JSONEncoder().encode(entries) {
            defaults.set(data, forKey: DistractorCache.key)
        }
    }
}

/// Asks the tutor model for three plausible but wrong answers per card, for cards whose deck has too few of its own.
/// Every answer goes through the same check as the deck's own (`ExerciseBuilder.pickDistractors`), so one the answer
/// check would accept never reaches a lesson. Runs while the path is open, never inside a lesson; without a key or
/// offline it fails quietly and the cards are typed instead.
struct DistractorService {
    static let cardsPerRequest = 8
    /// Longer wrong answers than this are not in the style of a flashcard's back.
    static let maxLength = 240

    let client: any LLMClient
    let cache: DistractorCache

    static let system = """
    You write wrong answer options for multiple-choice questions on a German upper-secondary student's flashcards. \
    For every card write exactly 3 wrong answers in German. Each one must sound plausible to a student who has not \
    learned the topic, have about the same length, style and form as the real answer (a formula stays a formula, a \
    name a name, a short sentence a short sentence) and be clearly wrong: never correct, partly correct, a synonym, \
    a rewording or a more general version of the real answer. The three must differ from each other. Write math with \
    Unicode characters, never LaTeX.
    """

    static let schema = JSONSchema.object("""
    {
      "type": "object",
      "properties": {
        "cards": { "type": "array", "items": { "type": "object", "properties": {
          "id": { "type": "string" },
          "distractors": { "type": "array", "items": { "type": "string" } }
        }, "required": ["id", "distractors"], "additionalProperties": false } }
      },
      "required": ["cards"],
      "additionalProperties": false
    }
    """)

    static func prompt(for cards: [CardSnapshot]) -> String {
        var lines = ["Write 3 wrong answers for each of these flashcards. Answer with the card's id."]
        for (index, card) in cards.enumerated() {
            lines.append("<card id=\"\(index + 1)\">")
            lines.append("<front>\(card.front)</front>")
            lines.append("<back>\(card.back)</back>")
            lines.append("</card>")
        }
        return lines.joined(separator: "\n")
    }

    static func request(for cards: [CardSnapshot]) -> LLMRequest {
        LLMRequest(
            purpose: .distractors,
            system: system,
            messages: [LLMMessage(role: .user, content: [.text(prompt(for: cards))])],
            maxTokens: 1500,
            effort: .low,
            jsonSchema: schema
        )
    }

    /// The wrong answers by the card's position in the request, from 1; ids may come as text or as numbers.
    static func parse(_ text: String) -> [Int: [String]]? {
        guard let data = text.data(using: .utf8),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let items = root["cards"] as? [Any]
        else { return nil }
        var result: [Int: [String]] = [:]
        for case let item as [String: Any] in items {
            let id = (item["id"] as? String).flatMap { Int($0.trimmingCharacters(in: .whitespaces)) } ?? (item["id"] as? Int)
            guard let id, let distractors = item["distractors"] as? [Any] else { continue }
            result[id] = distractors.compactMap { $0 as? String }
        }
        return result
    }

    /// Up to three of the model's answers that are clearly wrong for the card and of a flashcard's length.
    static func validated(_ candidates: [String], for answer: String) -> [String] {
        let short = candidates.filter { $0.count <= maxLength }
        return ExerciseBuilder.pickDistractors(for: answer, from: short)
    }

    /// Asks about the cards and returns what passed, by card key; with `persist` it also goes into the cache. Stops at
    /// the first error, a cancelled task included.
    @discardableResult
    func fetch(for cards: [CardSnapshot], persist: Bool = true) async -> [String: [String]] {
        var fetched: [String: [String]] = [:]
        var start = 0
        while start < cards.count {
            let batch = Array(cards[start..<min(start + DistractorService.cardsPerRequest, cards.count)])
            start += DistractorService.cardsPerRequest
            guard let answers = try? await StructuredOutput.complete(
                request: DistractorService.request(for: batch), client: client, parse: DistractorService.parse
            ) else { break }
            var entries: [String: [String]] = [:]
            for (index, card) in batch.enumerated() {
                guard let written = answers[index + 1] else { continue }
                entries[card.key] = DistractorService.validated(written, for: card.back)
            }
            if persist { cache.store(entries) }
            fetched.merge(entries) { _, new in new }
        }
        return fetched
    }

    // Demo

    /// Wrong answers per card of the request, from a fixed list on the chain rule like the demo's cards. Four each, so
    /// three remain when the check drops one that shares the numbers of a card's answer.
    static func demo(_ request: LLMRequest) -> String {
        let text = request.messages.flatMap(\.content).compactMap { content -> String? in
            if case let .text(text) = content { return text }
            return nil
        }.joined(separator: "\n")
        let count = text.components(separatedBy: "<card id=\"").count - 1
        let items = (0..<max(0, count)).map { index -> [String: Any] in
            let picks = (0..<4).map { demoAnswers[(index * 4 + $0) % demoAnswers.count] }
            return ["id": String(index + 1), "distractors": picks]
        }
        guard let data = try? JSONSerialization.data(withJSONObject: ["cards": items], options: [.sortedKeys]) else {
            return #"{"cards":[]}"#
        }
        return String(decoding: data, as: UTF8.self)
    }

    static let demoAnswers = [
        "Mit der Produktregel: u′ · v + u · v′",
        "Nur die innere Funktion wird abgeleitet.",
        "e^(3x)",
        "1 / (2√(x² + 1))",
        "Zwei Funktionen werden addiert, z. B. sin(x) + x².",
        "cos(4x)",
        "Nur die äußere Funktion wird abgeleitet.",
        "Man leitet beide Funktionen einzeln ab und addiert.",
        "4 · sin(4x)",
    ]
}
