import Foundation

/// Checks a typed answer against a flashcard's back without any AI: the words that carry the meaning have to be in
/// the answer, give or take a typo, an ending or a spelling with "ae" for "ä". It is strict about numbers, forgiving
/// about filler words and word order, and it cannot judge a long explanation as a teacher would; the review screen
/// lets the student overrule it.
enum AnswerCheck {
    enum Verdict: Equatable {
        case correct, wrong
    }

    static func evaluate(answer: String, expected: String) -> Verdict {
        let given = normalize(answer)
        guard !compact(given).isEmpty else { return .wrong }
        for alternative in alternatives(of: expected) where matches(given, alternative) {
            return .correct
        }
        return matches(given, expected) ? .correct : .wrong
    }

    /// "Berlin / Bundeshauptstadt", "A; B" or "A oder B" accept either part. A slash inside a fraction does not split.
    static func alternatives(of expected: String) -> [String] {
        var parts = [expected]
        for separator in [" / ", ";", "\n", " oder "] {
            parts = parts.flatMap { $0.components(separatedBy: separator) }
        }
        let trimmed = parts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        return trimmed.count > 1 ? trimmed : []
    }

    /// Lower case without umlauts and ß, "ae/oe/ue" folded to the same letters, decimal comma as a point and the
    /// usual maths symbols as plain characters, so "x²" and "x^2" or "0,5" and "0.5" read the same.
    static func normalize(_ text: String) -> String {
        var result = text.lowercased()
        let symbols = [("ß", "ss"), ("²", "^2"), ("³", "^3"), ("×", "*"), ("·", "*"), ("−", "-"), ("–", "-"), ("√", "sqrt"), ("π", "pi")]
        for (from, to) in symbols {
            result = result.replacingOccurrences(of: from, with: to)
        }
        result = result.replacingOccurrences(of: #"(\d),(\d)"#, with: "$1.$2", options: .regularExpression)
        result = result.folding(options: .diacriticInsensitive, locale: nil)
        for (from, to) in [("ae", "a"), ("oe", "o"), ("ue", "u")] {
            result = result.replacingOccurrences(of: from, with: to)
        }
        return result
    }

    /// Letters and digits only: "2 x" and "2x", "x^2" and "x2" are the same formula.
    static func compact(_ normalized: String) -> String {
        String(normalized.filter { $0.isLetter || $0.isNumber })
    }

    static func tokens(_ normalized: String) -> [String] {
        var result: [String] = []
        var current = ""
        func flush() {
            while current.hasSuffix(".") { current.removeLast() }
            if !current.isEmpty { result.append(current) }
            current = ""
        }
        for character in normalized {
            if character.isLetter || character.isNumber || (character == "." && (current.last?.isNumber ?? false)) {
                current.append(character)
            } else {
                flush()
            }
        }
        flush()
        return result
    }

    private static let stopwords: Set<String> = Set(
        """
        der die das den dem des ein eine einer einem einen eines und oder ist sind war waren wird werden wurde wurden \
        hat haben hatte kann können nicht mit von zu zum zur im in an auf aus bei für nach als auch wenn dann dass da \
        so wie man es sie er wir ihr ihre sein seine seiner durch über unter vor zwischen nur noch sich dies diese \
        dieser dieses was wer wo wann um am vom beim ins sowie also bzw ca etwa
        """.split(separator: " ").map { normalize(String($0)) }
    )

    /// The words that carry the meaning: no filler words, nothing shorter than three letters unless it has a digit.
    static func keyTokens(_ normalized: String) -> [String] {
        var seen: [String] = []
        for token in tokens(normalized) where !stopwords.contains(token) {
            guard token.count >= 3 || token.contains(where: \.isNumber), !seen.contains(token) else { continue }
            seen.append(token)
        }
        return seen
    }

    private static func matches(_ given: String, _ expectedRaw: String) -> Bool {
        let wanted = normalize(expectedRaw)
        let givenCompact = compact(given)
        let wantedCompact = compact(wanted)
        if givenCompact == wantedCompact { return true }
        let keys = keyTokens(wanted)
        if keys.isEmpty {
            return distance(givenCompact, wantedCompact) <= (wantedCompact.count >= 8 ? 1 : 0)
        }
        let answerTokens = tokens(given)
        // Numbers have to be exactly right.
        for key in keys where key.contains(where: \.isNumber) && !answerTokens.contains(key) {
            return false
        }
        let found = keys.filter { key in answerTokens.contains { tokenMatch($0, key) } }.count
        // Up to three key words must all be there; for longer answers three in five are enough.
        let needed = keys.count <= 3 ? keys.count : Int((Double(keys.count) * 0.6).rounded(.up))
        return found >= needed
    }

    /// Equal, one the beginning of the other ("Ableitung" and "Ableitungen"), or a typo away for words of five letters
    /// or more.
    static func tokenMatch(_ a: String, _ b: String) -> Bool {
        if a == b { return true }
        if a.contains(where: \.isNumber) || b.contains(where: \.isNumber) { return false }
        let (shorter, longer) = a.count <= b.count ? (a, b) : (b, a)
        guard shorter.count >= 5 else { return false }
        if longer.hasPrefix(shorter), longer.count - shorter.count <= 4 { return true }
        return distance(a, b) <= (longer.count >= 9 ? 2 : 1)
    }

    /// Levenshtein distance.
    static func distance(_ a: String, _ b: String) -> Int {
        let x = Array(a)
        let y = Array(b)
        if x.isEmpty { return y.count }
        if y.isEmpty { return x.count }
        var previous = Array(0...y.count)
        for i in 1...x.count {
            var row = [i]
            for j in 1...y.count {
                row.append(min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (x[i - 1] == y[j - 1] ? 0 : 1)))
            }
            previous = row
        }
        return previous[y.count]
    }
}
