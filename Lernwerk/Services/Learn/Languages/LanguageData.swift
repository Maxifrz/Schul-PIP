import Foundation

// The content of a language or school-subject course as plain values. It is written as text (see LanguageDSL) and
// turned into exercises by LanguageCourseProvider, so a course is data a teacher can read, not code.

/// A word or phrase in the language being learned with its meanings in the language the student knows.
struct LanguageWord: Equatable {
    let target: String
    /// The first is shown as the right answer; every one is accepted when typed.
    let meanings: [String]
    /// Gender, case, a hint: "f", "Plural", "mit Dativ". Shown under the word in the unit's list; may be empty.
    let note: String
    let why: String
}

struct LanguageSentence: Equatable {
    let target: String
    let meanings: [String]
    let why: String
}

/// One form to produce: "ser, yo" gives "soy". Forms with the same text before the first comma belong to one group
/// (the verb), and a choice takes its wrong answers from the group.
struct LanguageForm: Equatable {
    let prompt: String
    let answers: [String]
    let why: String

    var group: String {
        prompt.split(separator: ",", maxSplits: 1).first.map { String($0).trimmingCharacters(in: .whitespaces) } ?? prompt
    }
}

/// A sentence with a blank, written "Yo ___ Ana."; `options[0]` is right, the others are the wrong choices.
struct LanguageFill: Equatable {
    let sentence: String
    let options: [String]
    let why: String
}

/// A question with its answer and wrong answers.
struct LanguageFact: Equatable {
    let question: String
    let answer: String
    let wrong: [String]
    let why: String
}

struct LanguageUnitData: Equatable {
    let sectionTitle: String
    let title: String
    let summary: String
    /// Paragraphs separated by a blank line.
    let tip: String
    let words: [LanguageWord]
    let sentences: [LanguageSentence]
    let forms: [LanguageForm]
    let fills: [LanguageFill]
    let facts: [LanguageFact]
    /// Words that sentences may use without a `word:` line: names, inflected forms, function words nobody drills.
    let known: [String]

    var itemCount: Int { words.count + sentences.count + forms.count + fills.count + facts.count }
}

/// The language the prompts are written in.
enum LanguageInstruction: String, Equatable {
    case de, en
}

struct LanguageCourseData: Equatable {
    let id: String
    let title: String
    let subtitle: String
    let kind: CourseKind
    let color: UInt32
    let symbol: String
    /// A BCP 47 tag for the speaker button, like "es-ES"; nil for a language without a voice (Latin) or a subject.
    let speech: String?
    let instruction: LanguageInstruction
    /// "Spanisch": "Wie sagt man „Haus“ auf Spanisch?"
    let targetName: String
    /// "Spanische": "Übersetze ins Spanische:"
    let intoName: String
    /// "Deutsche": "Übersetze ins Deutsche:"
    let knownName: String
    /// False for a course that only reads the language (Latin): the student translates into the known language and
    /// forms are typed, but nothing is asked to be said or written freely in the language being learned.
    let produces: Bool
    let units: [LanguageUnitData]

    /// Mistakes in the content that would make an exercise unfair: a meaning two words share (a typed answer would be
    /// ambiguous), a word twice, a fill without a wrong choice, a fact without wrong answers.
    func problems() -> [String] {
        var problems: [String] = []
        var meaningOwner: [String: String] = [:]
        var targets: Set<String> = []
        for (index, unit) in units.enumerated() {
            let place = "unit \(index + 1)"
            if unit.tip.isEmpty { problems.append("\(place): no tip") }
            if unit.itemCount < 8 { problems.append("\(place): only \(unit.itemCount) items") }
            for word in unit.words {
                if !targets.insert(LearnExercise.folded(word.target)).inserted { problems.append("\(place): \(word.target) twice") }
                for meaning in word.meanings {
                    let folded = LearnExercise.folded(meaning)
                    if let owner = meaningOwner[folded], owner != word.target {
                        problems.append("\(place): \"\(meaning)\" means both \(owner) and \(word.target)")
                    }
                    meaningOwner[folded] = word.target
                }
            }
            var sentenceTargets: Set<String> = []
            for sentence in unit.sentences where !sentenceTargets.insert(LearnExercise.folded(sentence.target)).inserted {
                problems.append("\(place): sentence twice: \(sentence.target)")
            }
            for fill in unit.fills {
                if !fill.sentence.contains("___") { problems.append("\(place): no blank in \(fill.sentence)") }
                if fill.options.count < 2 { problems.append("\(place): no wrong choice for \(fill.sentence)") }
            }
            for fact in unit.facts where fact.wrong.isEmpty { problems.append("\(place): no wrong answer for \(fact.question)") }
        }
        return problems
    }
}

/// The wording of the prompts in one instruction language. `{x}` is replaced by the word or sentence.
struct LanguageTexts: Equatable {
    var meaning: String
    var askTarget: String
    var listen: String
    var listenType: String
    var translateInto: String
    var translateFrom: String
    var form: String
    var fill: String
    var pairs: String

    static func make(for data: LanguageCourseData) -> LanguageTexts {
        if data.kind == .school {
            return LanguageTexts(
                meaning: "Was bedeutet „{x}“?",
                askTarget: "Welcher Begriff ist gemeint?\n{x}",
                listen: "", listenType: "", translateInto: "{x}", translateFrom: "{x}",
                form: "Bilde die Form:\n{x}",
                fill: "Welches Wort fehlt?\n{x}",
                pairs: ExerciseBuilder.pairsPrompt
            )
        }
        switch data.instruction {
        case .de:
            return LanguageTexts(
                meaning: "Was bedeutet „{x}“?",
                askTarget: "Wie sagt man „{x}“ auf \(data.targetName)?",
                listen: "Tippe auf den Lautsprecher. Was hörst du?",
                listenType: "Tippe auf den Lautsprecher und schreib auf, was du hörst.",
                translateInto: "Übersetze ins \(data.intoName):\n{x}",
                translateFrom: "Übersetze ins \(data.knownName):\n{x}",
                form: "Bilde die Form:\n{x}",
                fill: "Welches Wort fehlt?\n{x}",
                pairs: ExerciseBuilder.pairsPrompt
            )
        case .en:
            return LanguageTexts(
                meaning: "What does “{x}” mean?",
                askTarget: "How do you say “{x}” in \(data.targetName)?",
                listen: "Tap the speaker. What do you hear?",
                listenType: "Tap the speaker and type what you hear.",
                translateInto: "Translate into \(data.intoName):\n{x}",
                translateFrom: "Translate into \(data.knownName):\n{x}",
                form: "Write the form:\n{x}",
                fill: "Which word is missing?\n{x}",
                pairs: "Match the pairs"
            )
        }
    }

    func fill(_ template: String, with text: String) -> String {
        template.replacingOccurrences(of: "{x}", with: text)
    }
}
