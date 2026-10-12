import XCTest
@testable import Lernwerk

/// Checks the Latin course: that it parses and passes the engine's audit, and that its content is right in ways that do
/// not depend on how the text was written (paradigms recomputed from endings typed here, genders from a list).
final class LatinCourseTests: XCTestCase {
    private static let made = LanguageCourseProvider.make(source: LatinCourse.source)
    private var data: LanguageCourseData { Self.made.provider.data }
    private var units: [LanguageUnitData] { data.units }
    private var words: [LanguageWord] { units.flatMap(\.words) }
    private var sentences: [LanguageSentence] { units.flatMap(\.sentences) }
    private var forms: [LanguageForm] { units.flatMap(\.forms) }

    // MARK: Reference data typed again here

    /// Endings by declension, case name and number.
    private static let aEndings: [String: [String: String]] = [
        "Nominativ Singular": ["": "a"], "Nominativ Plural": ["": "ae"],
        "Genitiv Singular": ["": "ae"], "Genitiv Plural": ["": "arum"],
        "Dativ Singular": ["": "ae"], "Dativ Plural": ["": "is"],
        "Akkusativ Singular": ["": "am"], "Akkusativ Plural": ["": "as"],
        "Ablativ Singular": ["": "a"], "Ablativ Plural": ["": "is"],
    ]
    private static let oEndings: [String: String] = [
        "Genitiv Singular": "i", "Genitiv Plural": "orum", "Dativ Singular": "o", "Dativ Plural": "is",
        "Akkusativ Singular": "um", "Akkusativ Plural": "os", "Ablativ Singular": "o", "Ablativ Plural": "is",
        "Nominativ Plural": "i",
    ]
    private static let nStem: [String: String] = [  // lemma -> stem, declension (a, om, on)
        "puella": "puell", "femina": "femin", "agricola": "agricol", "nauta": "naut", "rosa": "ros", "via": "vi",
        "villa": "vill", "domina": "domin",
    ]
    private static let oMasc: [String: String] = ["servus": "serv", "hortus": "hort", "dominus": "domin", "amicus": "amic"]
    private static let oNeut: [String: String] = ["templum": "templ"]
    private static let gender: [String: String] = [
        "puella": "f", "femina": "f", "amica": "f", "dea": "f", "agricola": "m", "nauta": "m", "rosa": "f", "aqua": "f",
        "villa": "f", "via": "f", "silva": "f", "terra": "f", "amicus": "m", "servus": "m", "dominus": "m", "filius": "m",
        "equus": "m", "hortus": "m", "templum": "n", "oppidum": "n", "bellum": "n", "donum": "n", "schola": "f", "porta": "f",
        "insula": "f", "murus": "m", "discipulus": "m", "domina": "f", "fabula": "f", "pecunia": "f", "gloria": "f",
        "gladius": "m", "vita": "f",
    ]
    private static let verbStem: [String: String] = ["amare": "am", "habere": "hab", "audire": "aud", "monere": "mon", "venire": "ven"]
    private static let personEnd = ["1. Person Singular": 0, "2. Person Singular": 1, "1. Person Plural": 3, "2. Person Plural": 4]
    private static let conj: [String: [String]] = [
        "amare": ["o", "as", "at", "amus", "atis", "ant"],
        "habere": ["eo", "es", "et", "emus", "etis", "ent"],
        "audire": ["io", "is", "it", "imus", "itis", "iunt"],
    ]
    private static let esse = ["sum", "es", "est", "sumus", "estis", "sunt"]

    private func latinTokens(_ text: String) -> [String] {
        text.lowercased().split(whereSeparator: { !$0.isLetter }).map(String.init)
    }

    private func split(_ prompt: String) -> (String, String)? {
        guard let r = prompt.range(of: ", ") else { return nil }
        return (String(prompt[..<r.lowerBound]), String(prompt[r.upperBound...]))
    }

    // MARK: Shape

    func testParsesWithoutProblems() {
        XCTAssertEqual(Self.made.errors, [])
    }

    func testHeader() {
        XCTAssertEqual(data.id, "la")
        XCTAssertEqual(data.title, "Latein")
        XCTAssertEqual(data.kind, .language)
        XCTAssertEqual(data.color, 0x9A7B5B)
        XCTAssertNil(data.speech)
        XCTAssertFalse(data.produces)
        XCTAssertEqual(data.instruction, .de)
    }

    func testCoverageAndAudit() {
        XCTAssertEqual(LanguageCoverage.gaps(in: data).map(\.description), [])
        XCTAssertEqual(CourseAudit.problems(of: Self.made.provider, seeds: Array(1...12)), [])
        XCTAssertEqual(LatinCourse.provider.course.id, "la")
    }

    func testSizes() {
        XCTAssertEqual(units.count, 8)
        XCTAssertGreaterThanOrEqual(words.count, 85)
        XCTAssertGreaterThanOrEqual(sentences.count, 60)
        XCTAssertGreaterThanOrEqual(forms.count, 40)
        for (i, unit) in units.enumerated() {
            XCTAssertTrue((22...30).contains(unit.itemCount), "unit \(i + 1) has \(unit.itemCount) items")
            XCTAssertTrue((3...5).contains(unit.tip.components(separatedBy: "\n\n").count), "unit \(i + 1) tips")
            XCTAssertTrue(unit.sentences.allSatisfy { $0.target.split(separator: " ").count <= 10 })
        }
    }

    // MARK: Content facts

    func testNounGendersMatchTheNote() {
        for word in words where Self.gender[word.target] != nil {
            let g = Self.gender[word.target]!
            XCTAssertTrue(word.note.hasSuffix(" \(g)."), "\(word.target): \(word.note)")
            let expectedEnding = word.target.hasSuffix("a") ? "-ae" : (word.target.hasSuffix("um") ? "-i" : (word.target.hasSuffix("us") ? "-i" : "?"))
            XCTAssertTrue(word.note.hasPrefix(expectedEnding), "\(word.target): \(word.note)")
        }
        let nounWords = words.filter { $0.note.hasSuffix(" f.") || $0.note.hasSuffix(" m.") || $0.note.hasSuffix(" n.") }
        for noun in nounWords { XCTAssertNotNil(Self.gender[noun.target], "\(noun.target) missing in reference list") }
    }

    func testDeclensionFormsFollowTheEndings() {
        var checked = 0
        for form in forms {
            guard let (lemma, info) = split(form.prompt), let answer = form.answers.first else { continue }
            if let stem = Self.nStem[lemma], let end = Self.aEndings[info]?[""] {
                XCTAssertEqual(answer, stem + end, form.prompt); checked += 1
            } else if let stem = Self.oMasc[lemma] ?? Self.oNeut[lemma], let end = Self.oEndings[info] {
                var ending = end
                if Self.oNeut[lemma] != nil {
                    if info == "Nominativ Plural" || info == "Akkusativ Plural" { ending = "a" }
                    if info == "Akkusativ Singular" { ending = "um" }
                }
                XCTAssertEqual(answer, stem + ending, form.prompt); checked += 1
            }
        }
        XCTAssertGreaterThanOrEqual(checked, 18)
    }

    func testVerbFormsFollowTheTables() {
        var checked = 0
        for form in forms {
            guard let (verb, info) = split(form.prompt), let answer = form.answers.first else { continue }
            if verb == "esse", let i = Self.personEnd[info] {
                XCTAssertEqual(answer, Self.esse[i]); checked += 1
            } else if verb == "amare", let i = Self.personEnd[info] {
                XCTAssertEqual(answer, ["amo", "amas", "amat", "amamus", "amatis", "amant"][i], form.prompt); checked += 1
            } else if let ends = Self.conj[verb], let stem = Self.verbStem[verb], let i = Self.personEnd[info] {
                XCTAssertEqual(answer, stem + ends[i], form.prompt); checked += 1
            }
        }
        XCTAssertGreaterThanOrEqual(checked, 14)
    }

    func testImperatives() {
        let expected: [String: String] = [
            "amare, Imperativ Singular": "ama", "amare, Imperativ Plural": "amate", "audire, Imperativ Plural": "audite",
            "venire, Imperativ Plural": "venite",
        ]
        for (prompt, answer) in expected {
            XCTAssertEqual(forms.first { $0.prompt == prompt }?.answers.first, answer, prompt)
        }
        // Every imperative form in the course: plural ends in -te, singular does not.
        for form in forms where form.prompt.contains("Imperativ Plural") { XCTAssertTrue(form.answers[0].hasSuffix("te")) }
        for form in forms where form.prompt.contains("Imperativ Singular") { XCTAssertFalse(form.answers[0].hasSuffix("te")) }
    }

    func testEveryVerbWordHasThirdPersonPairWithRightEndings() {
        for word in words where word.note.contains("konjugation") && word.target.contains(", ") {
            let parts = word.target.components(separatedBy: ", ")
            XCTAssertEqual(parts.count, 2, word.target)
            XCTAssertTrue(parts[0].hasSuffix("t"), word.target)
            XCTAssertTrue(parts[1].hasSuffix("nt"), word.target)
            XCTAssertEqual(String(parts[1].dropLast(2)).replacingOccurrences(of: "iu", with: "i"), String(parts[0].dropLast(1)), word.target)
        }
    }

    func testNoSentenceRepeatsAndTranslationsHaveNoLatinLeftovers() {
        var seen = Set<String>()
        let names: Set<String> = ["marcus", "iulia"]
        let latinWords = Set(sentences.flatMap { latinTokens($0.target) }).subtracting(names).filter { $0.count >= 4 }
        for sentence in sentences {
            XCTAssertTrue(seen.insert(sentence.target.lowercased()).inserted, sentence.target)
            for meaning in sentence.meanings {
                for token in latinTokens(meaning) where latinWords.contains(token) {
                    XCTFail("\(sentence.target) -> \(meaning) contains \(token)")
                }
                XCTAssertTrue(meaning.hasSuffix(".") || meaning.hasSuffix("!") || meaning.hasSuffix("?"), meaning)
            }
            XCTAssertEqual(sentence.target.last, sentence.meanings[0].last, sentence.target)
        }
    }

    func testFillsAndFormsAreConsistent() {
        for unit in units {
            for fill in unit.fills {
                XCTAssertEqual(Set(fill.options).count, fill.options.count, fill.sentence)
                XCTAssertFalse(fill.why.isEmpty, fill.sentence)
            }
            let answers = unit.forms.map { $0.answers[0] }
            XCTAssertEqual(Set(unit.forms.map(\.prompt)).count, unit.forms.count)
            XCTAssertEqual(Set(answers).count, answers.count, "a unit repeats a form answer")
        }
    }

    func testNoLongVowelMarksAndNoSpecialCharactersInLatin() {
        let macrons = CharacterSet(charactersIn: "āēīōūĀĒĪŌŪ")
        for word in words {
            XCTAssertNil(word.target.rangeOfCharacter(from: macrons))
            XCTAssertTrue(word.target.allSatisfy { $0.isASCII }, word.target)
        }
        for sentence in sentences { XCTAssertTrue(sentence.target.allSatisfy { $0.isASCII }, sentence.target) }
        for form in forms { XCTAssertTrue(form.answers.allSatisfy { $0.allSatisfy(\.isLowercase) }) }
    }

    func testGermanMeaningsOfKeyWords() {
        let gloss: [String: String] = [
            "puella": "mädchen", "agricola": "bauer", "nauta": "seemann", "servus": "sklave", "dominus": "herr", "templum": "tempel",
            "cum": "mit", "sine": "ohne", "ad": "zu", "per": "durch", "et": "und", "non": "nicht", "sed": "aber", "ubi": "wo",
            "cur": "warum", "quid": "was", "ego": "ich", "tu": "du", "nos": "wir", "vos": "ihr", "magnus, -a, -um": "groß",
            "parvus, -a, -um": "klein", "bonus, -a, -um": "gut", "malus, -a, -um": "schlecht", "longus, -a, -um": "lang",
            "amat, amant": "lieben", "portat, portant": "tragen", "dat, dant": "geben", "audit, audiunt": "hören",
            "dormit, dormiunt": "schlafen", "venit, veniunt": "kommen", "videt, vident": "sehen", "est, sunt": "sein",
            "habet, habent": "haben", "tacet, tacent": "schweigen", "hodie": "heute", "semper": "immer", "etiam": "auch",
        ]
        for (latin, stem) in gloss {
            let word = words.first { $0.target == latin }
            XCTAssertNotNil(word, latin)
            XCTAssertTrue(word?.meanings[0].lowercased().contains(stem) ?? false, latin)
        }
    }
}
