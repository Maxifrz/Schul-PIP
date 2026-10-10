import Foundation

/// Checks that a course's sentences only use words it has taught: the words of its units so far, the forms and the
/// right fill words, and what `known:` lines allow. A course that fails teaches a student sentences they cannot read.
enum LanguageCoverage {
    struct Gap: Equatable, CustomStringConvertible {
        let unit: Int
        let sentence: String
        let words: [String]

        var description: String { "unit \(unit): \"\(sentence)\" uses \(words.joined(separator: ", "))" }
    }

    /// The tokens of a text as they are compared: lower case, no accents, no punctuation, no digits-only tokens.
    static func tokens(of text: String) -> [String] {
        text.split(whereSeparator: \.isWhitespace).compactMap { piece in
            let folded = LearnExercise.folded(String(piece))
            return folded.isEmpty || folded.allSatisfy(\.isNumber) ? nil : folded
        }
    }

    static func gaps(in data: LanguageCourseData) -> [Gap] {
        var known = Set<String>()
        var gaps: [Gap] = []
        for (index, unit) in data.units.enumerated() {
            for word in unit.words { known.formUnion(tokens(of: word.target)) }
            for form in unit.forms { known.formUnion(form.answers.flatMap(tokens(of:))) }
            for fill in unit.fills { if let first = fill.options.first { known.formUnion(tokens(of: first)) } }
            for token in unit.known { known.formUnion(tokens(of: token)) }
            for sentence in unit.sentences {
                let missing = tokens(of: sentence.target).filter { !known.contains($0) }
                if !missing.isEmpty { gaps.append(Gap(unit: index + 1, sentence: sentence.target, words: missing)) }
            }
        }
        return gaps
    }
}
