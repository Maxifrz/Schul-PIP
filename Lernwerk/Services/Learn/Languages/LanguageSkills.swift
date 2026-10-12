import Foundation

/// A language unit teaches up to four things, and a student can be good at one and weak at another: knowing a word is
/// not using it in a sentence, and neither is making the right form. Each is its own goal, with its own evidence.
extension LanguageCourseProvider {
    func skillFacets(of unit: CourseUnit) -> [SkillFacet] {
        guard data.units.indices.contains(unit.number - 1) else { return [] }
        let content = data.units[unit.number - 1]
        var facets: [SkillFacet] = []
        let hasWords = !content.words.isEmpty
        if hasWords {
            // A school subject's terms have a definition, which nobody types; typing needs a language to write.
            let recall = data.produces || data.kind != .school
            facets.append(SkillFacet(
                key: "vocab", title: "Wortschatz",
                goal: recall ? "Du erkennst die Wörter dieser Einheit und rufst sie ohne Auswahl ab." : "Du erkennst die Begriffe dieser Einheit.",
                levels: recall ? [.recognise, .recall] : [.recognise], after: "vocab"
            ))
        }
        let base = hasWords ? ["vocab"] : []
        if !content.sentences.isEmpty {
            facets.append(SkillFacet(
                key: "sentences", title: "Sätze und Satzbau", goal: "Du verstehst die Sätze und setzt sie selbst richtig zusammen.",
                levels: [.recognise, .apply], requires: base
            ))
        }
        if !content.forms.isEmpty || !content.fills.isEmpty || !content.facts.isEmpty {
            let applies = !content.forms.isEmpty || !content.fills.isEmpty
            facets.append(SkillFacet(
                key: "grammar", title: "Grammatik",
                goal: applies ? "Du bildest die Formen und wendest die Regeln im Satz an." : "Du kennst die Regeln dieser Einheit.",
                levels: applies ? [.recognise, .apply] : [.recognise], requires: base
            ))
        }
        if data.speech != nil, data.produces {
            // Hearing a word and choosing it, and hearing a sentence and typing it.
            let heard = hasWords
            let typed = content.sentences.contains { LanguageCourseProvider.tileCount($0.target) <= 8 }
            let levels: [CompetenceLevel] = (heard ? [.recognise] : []) + (typed ? [.apply] : [])
            if !levels.isEmpty {
                facets.append(SkillFacet(
                    key: "listening", title: "Hören", goal: "Du verstehst gesprochene Wörter und Sätze.", levels: levels, requires: base
                ))
            }
        }
        return facets
    }

    func skillTag(for exercise: LearnExercise, node: CourseNode) -> SkillTag {
        // The id is "<node>#<kind letter><unit>-<index><suffix letter>", or "<node>#p1" for pairs of words.
        guard let hash = exercise.id.lastIndex(of: "#") else { return SkillTag(facet: "vocab", level: .recognise) }
        let tail = exercise.id[exercise.id.index(after: hash)...]
        guard let kind = tail.first, let suffix = tail.last else { return SkillTag(facet: "vocab", level: .recognise) }
        switch (kind, suffix) {
        case ("p", _): return SkillTag(facet: "vocab", level: .recognise)
        case ("w", "c"): return SkillTag(facet: "listening", level: .recognise)
        case ("w", "d"), ("w", "e"): return SkillTag(facet: "vocab", level: .recall)
        case ("w", _): return SkillTag(facet: "vocab", level: .recognise)
        case ("s", "a"): return SkillTag(facet: "sentences", level: .recognise)
        case ("s", "e"): return SkillTag(facet: "listening", level: .apply)
        case ("s", "f"): return SkillTag(facet: "sentences", level: .recall)
        case ("s", _): return SkillTag(facet: "sentences", level: .apply)
        case ("f", "d"), ("g", "d"): return SkillTag(facet: "grammar", level: .apply)
        case ("f", _), ("g", _), ("q", _): return SkillTag(facet: "grammar", level: .recognise)
        default: return SkillTag(facet: "vocab", level: .recognise)
        }
    }

    /// Say what kind of slip a typed answer is: the right word with a wrong ending, the right letters in the wrong
    /// order, a missing accent. Only for answers the exact check rejected.
    func feedback(for exercise: LearnExercise, answer: LearnAnswer) -> String? {
        guard exercise.kind == .typeAnswer, exercise.mode == .exact, case let .typed(text) = answer else { return nil }
        return LanguageAnswerAdvice.advice(given: text, expected: exercise.correctAnswers)
    }

    static func tileCount(_ sentence: String) -> Int {
        sentence.split(whereSeparator: \.isWhitespace).count
    }
}

/// Tells the student what is off about a typed answer in the language being learned, when that can be said for sure.
enum LanguageAnswerAdvice {
    static func advice(given: String, expected: [String]) -> String? {
        let typed = given.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !typed.isEmpty, let target = expected.first else { return nil }
        let folded = LearnExercise.folded(typed)
        if expected.contains(where: { LearnExercise.folded($0) == folded }) { return nil }

        let typedWords = words(of: typed)
        let targetWords = words(of: target)
        // The same words in another order: only the word order is wrong.
        if typedWords.count > 1, typedWords.sorted() == targetWords.sorted() {
            return "Die Wörter stimmen, aber die Reihenfolge nicht."
        }
        // The same number of words and all but one right: say which word, and whether it is only the ending.
        if typedWords.count == targetWords.count {
            let wrong = zip(typedWords, targetWords).enumerated().filter { $0.element.0 != $0.element.1 }
            if wrong.count == 1, let slip = wrong.first {
                let (given, right) = slip.element
                let place = targetWords.count > 1 ? " (Wort \(slip.offset + 1))" : ""
                let shared = commonPrefix(given, right)
                if shared.count >= 3, shared.count >= min(given.count, right.count) - 3 {
                    return "Fast: Der Wortanfang stimmt, die Endung\(place) nicht."
                }
                return "Ein Wort stimmt nicht\(place)."
            }
        }
        if typedWords.count < targetWords.count { return "Es fehlt mindestens ein Wort." }
        if typedWords.count > targetWords.count { return "Es sind zu viele Wörter." }
        return nil
    }

    private static func words(of text: String) -> [String] {
        text.split(whereSeparator: \.isWhitespace).map { LearnExercise.folded(String($0)) }.filter { !$0.isEmpty }
    }

    private static func commonPrefix(_ a: String, _ b: String) -> String {
        var result = ""
        for (x, y) in zip(a, b) {
            guard x == y else { break }
            result.append(x)
        }
        return result
    }
}
