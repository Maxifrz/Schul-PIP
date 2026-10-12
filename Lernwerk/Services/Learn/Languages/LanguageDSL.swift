import Foundation

/// Reads a course written as text. One line, one thing: `key: value`. Blank lines and lines starting with `#` are
/// ignored. A value may end with ` ## why` (one sentence that explains the answer).
///
///     course: es                       the id; node ids start with it
///     title: Spanisch
///     subtitle: Für Deutschsprachige · A1
///     kind: language                   language | school
///     color: D9903A                    0xRRGGBB without the 0x
///     symbol: text.bubble.fill         an SF Symbol
///     speech: es-ES                    optional: BCP 47 tag for the speaker button
///     instruction: de                  de | en: the language of the prompts (default de)
///     target-name: Spanisch            "Wie sagt man „Haus“ auf Spanisch?"
///     into-name: Spanische             "Übersetze ins Spanische:"
///     known-name: Deutsche             "Übersetze ins Deutsche:" (default by instruction)
///     produce: no                      optional: yes (default) or no; no asks nothing to be written in the language
///                                      learned except forms (a course that reads, like Latin)
///
///     section: A1 · Erste Schritte     starts a section; units follow
///     unit: Hallo und Tschüss | Begrüßen und sich vorstellen
///     tip: A paragraph of the unit's guide. More tip lines are more paragraphs.
///     known: Ana, Luis, Madrid         words sentences may use without a word: line (names, inflected forms)
///     word: hola = hallo               target = meaning; other meanings | note
///     word: la casa = das Haus | f
///     sentence: Me llamo Ana. = Ich heiße Ana.
///     form: ser, yo = soy ## A verb form to produce; the text before the comma names the verb
///     fill: Yo ___ Ana. = soy | eres | es      first choice is right, the others are wrong
///     fact: Welcher Fall folgt auf „mit“? = Dativ | Akkusativ | Genitiv ## Mit verlangt den Dativ.
enum LanguageDSL {
    static func parse(_ source: String) -> (data: LanguageCourseData, errors: [String]) {
        var parser = Parser()
        for (offset, raw) in source.components(separatedBy: .newlines).enumerated() {
            parser.read(line: raw, number: offset + 1)
        }
        return parser.finish()
    }

    private struct UnitBuilder {
        var sectionTitle: String
        var title: String
        var summary: String
        var tips: [String] = []
        var words: [LanguageWord] = []
        var sentences: [LanguageSentence] = []
        var forms: [LanguageForm] = []
        var fills: [LanguageFill] = []
        var facts: [LanguageFact] = []
        var known: [String] = []

        func build() -> LanguageUnitData {
            LanguageUnitData(
                sectionTitle: sectionTitle, title: title, summary: summary, tip: tips.joined(separator: "\n\n"),
                words: words, sentences: sentences, forms: forms, fills: fills, facts: facts, known: known
            )
        }
    }

    private struct Parser {
        var fields: [String: String] = [:]
        var section = ""
        var current: UnitBuilder?
        var units: [UnitBuilder] = []
        var errors: [String] = []

        mutating func read(line raw: String, number: Int) {
            let line = raw.trimmingCharacters(in: .whitespaces)
            guard !line.isEmpty, !line.hasPrefix("#") else { return }
            guard let colon = line.firstIndex(of: ":") else {
                errors.append("line \(number): no \"key: value\"")
                return
            }
            let key = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
            let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            switch key {
            case "course", "title", "subtitle", "kind", "color", "symbol", "speech", "instruction", "target-name", "into-name", "known-name", "produce":
                fields[key] = value
            case "section":
                flush()
                section = value
            case "unit":
                flush()
                let parts = value.components(separatedBy: " | ")
                let title = parts[0].trimmingCharacters(in: .whitespaces)
                if title.isEmpty { errors.append("line \(number): unit without a title") }
                current = UnitBuilder(
                    sectionTitle: section, title: title,
                    summary: parts.count > 1 ? parts[1].trimmingCharacters(in: .whitespaces) : ""
                )
            case "tip", "word", "sentence", "form", "fill", "fact", "known":
                guard current != nil else {
                    errors.append("line \(number): \(key) before the first unit")
                    return
                }
                item(key: key, value: value, number: number)
            default:
                errors.append("line \(number): unknown key \"\(key)\"")
            }
        }

        mutating func item(key: String, value: String, number: Int) {
            if key == "tip" {
                if value.isEmpty { errors.append("line \(number): empty tip") } else { current?.tips.append(value) }
                return
            }
            if key == "known" {
                let tokens = list(value, separator: ",")
                if tokens.isEmpty { errors.append("line \(number): empty known") } else { current?.known += tokens }
                return
            }
            let (body, why) = split(value, at: " ## ")
            guard let equals = body.range(of: " = ") else {
                errors.append("line \(number): \(key) needs \" = \"")
                return
            }
            let left = body[..<equals.lowerBound].trimmingCharacters(in: .whitespaces)
            let right = body[equals.upperBound...].trimmingCharacters(in: .whitespaces)
            guard !left.isEmpty, !right.isEmpty else {
                errors.append("line \(number): \(key) with an empty side")
                return
            }
            switch key {
            case "word":
                let (meaningText, note) = split(right, at: " | ")
                let meanings = list(meaningText, separator: ";")
                if meanings.isEmpty { errors.append("line \(number): word without a meaning") }
                current?.words.append(LanguageWord(target: left, meanings: meanings, note: note, why: why))
            case "sentence":
                let meanings = list(right, separator: ";")
                current?.sentences.append(LanguageSentence(target: left, meanings: meanings, why: why))
            case "form":
                let answers = list(right, separator: ";")
                current?.forms.append(LanguageForm(prompt: left, answers: answers, why: why))
            case "fill":
                let options = list(right, separator: "|")
                if !left.contains("___") { errors.append("line \(number): fill without ___") }
                if options.count < 2 { errors.append("line \(number): fill needs a right and a wrong choice") }
                current?.fills.append(LanguageFill(sentence: left, options: options, why: why))
            default:
                let answers = list(right, separator: "|")
                if answers.count < 2 { errors.append("line \(number): fact needs an answer and a wrong answer") }
                let fact = LanguageFact(question: left, answer: answers.first ?? "", wrong: Array(answers.dropFirst()), why: why)
                current?.facts.append(fact)
            }
        }

        mutating func flush() {
            if let unit = current { units.append(unit) }
            current = nil
        }

        func split(_ text: String, at separator: String) -> (String, String) {
            guard let range = text.range(of: separator) else { return (text, "") }
            return (
                String(text[..<range.lowerBound]).trimmingCharacters(in: .whitespaces),
                String(text[range.upperBound...]).trimmingCharacters(in: .whitespaces)
            )
        }

        func list(_ text: String, separator: Character) -> [String] {
            text.split(separator: separator).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        }

        mutating func finish() -> (data: LanguageCourseData, errors: [String]) {
            flush()
            func field(_ key: String) -> String {
                if fields[key] == nil { errors.append("missing \"\(key):\"") }
                return fields[key] ?? ""
            }
            let id = field("course")
            let kindText = fields["kind"] ?? "language"
            let kind: CourseKind = kindText == "school" ? .school : .language
            if !["language", "school"].contains(kindText) { errors.append("kind must be language or school") }
            if let text = fields["produce"], !["yes", "no"].contains(text) { errors.append("produce must be yes or no") }
            let instruction = LanguageInstruction(rawValue: fields["instruction"] ?? "de") ?? .de
            if let text = fields["instruction"], LanguageInstruction(rawValue: text) == nil { errors.append("instruction must be de or en") }
            let colorText = field("color")
            if UInt32(colorText, radix: 16) == nil || colorText.count != 6 { errors.append("color must be six hex digits") }
            if units.isEmpty { errors.append("no units") }
            let data = LanguageCourseData(
                id: id, title: field("title"), subtitle: field("subtitle"), kind: kind,
                color: UInt32(colorText, radix: 16) ?? 0x888888, symbol: field("symbol"),
                speech: fields["speech"].flatMap { $0.isEmpty ? nil : $0 },
                instruction: instruction,
                targetName: fields["target-name"] ?? fields["title"] ?? "",
                intoName: fields["into-name"] ?? fields["title"] ?? "",
                knownName: fields["known-name"] ?? (instruction == .de ? "Deutsche" : "English"),
                produces: fields["produce"] != "no",
                units: units.map { $0.build() }
            )
            return (data, errors)
        }
    }
}
