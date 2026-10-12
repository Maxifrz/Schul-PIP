import XCTest
@testable import Lernwerk

/// Checks the course Deutsch als Fremdsprache (German for English speakers, A1): that it parses and passes the engine's
/// audit, and that its content is right in ways that do not depend on how the text was written (verb tables against
/// endings typed again here, genders and plurals against a noun list, every derived form against the rule its tip
/// teaches, articles and possessives against the nouns they stand before).
final class DafCourseTests: XCTestCase {
    private static let made = LanguageCourseProvider.make(source: GermanForeignCourse.source)
    private var provider: LanguageCourseProvider { Self.made.provider }
    private var data: LanguageCourseData { provider.data }
    private var units: [LanguageUnitData] { data.units }
    private var words: [LanguageWord] { units.flatMap(\.words) }
    private var sentences: [LanguageSentence] { units.flatMap(\.sentences) }
    private var forms: [LanguageForm] { units.flatMap(\.forms) }
    private var fills: [LanguageFill] { units.flatMap(\.fills) }
    private var facts: [LanguageFact] { units.flatMap(\.facts) }

    // MARK: Independent reference data (typed here again, not read from the course)

    private static let persons = ["ich", "du", "er", "wir", "ihr", "sie"]

    private static let irregular: [String: [String]] = [
        "sein": ["bin", "bist", "ist", "sind", "seid", "sind"],
        "haben": ["habe", "hast", "hat", "haben", "habt", "haben"],
        "essen": ["esse", "isst", "isst", "essen", "esst", "essen"],
        "möchten": ["möchte", "möchtest", "möchte", "möchten", "möchtet", "möchten"],
    ]
    private static let regularVerbs = ["heißen", "trinken", "kommen", "wohnen", "lernen", "arbeiten", "machen", "spielen", "gehen"]

    /// The six forms of a verb, from the irregular table or from the regular endings.
    private func conjugation(of verb: String) -> [String]? {
        if let table = Self.irregular[verb] { return table }
        guard Self.regularVerbs.contains(verb), verb.hasSuffix("en") else { return nil }
        let stem = String(verb.dropLast(2))
        let needsE = stem.hasSuffix("t") || stem.hasSuffix("d")
        let sibilant = stem.hasSuffix("s") || stem.hasSuffix("ß") || stem.hasSuffix("z") || stem.hasSuffix("x")
        let du = sibilant ? stem + "t" : stem + (needsE ? "est" : "st")
        let er = stem + (needsE ? "et" : "t")
        return [stem + "e", du, er, verb, er, verb]
    }

    private struct Noun {
        let gender: Character // m, f, n
        let plural: String? // nil: no plural; "-" : plural only
    }

    private static let nouns: [String: Noun] = [
        "Vater": Noun(gender: "m", plural: "Väter"), "Mutter": Noun(gender: "f", plural: "Mütter"),
        "Bruder": Noun(gender: "m", plural: "Brüder"), "Schwester": Noun(gender: "f", plural: "Schwestern"),
        "Familie": Noun(gender: "f", plural: "Familien"), "Eltern": Noun(gender: "f", plural: "-"),
        "Geschwister": Noun(gender: "n", plural: "-"), "Großvater": Noun(gender: "m", plural: "Großväter"),
        "Großmutter": Noun(gender: "f", plural: "Großmütter"), "Buch": Noun(gender: "n", plural: "Bücher"),
        "Tisch": Noun(gender: "m", plural: "Tische"), "Tasche": Noun(gender: "f", plural: "Taschen"),
        "Stuhl": Noun(gender: "m", plural: "Stühle"), "Heft": Noun(gender: "n", plural: "Hefte"),
        "Handy": Noun(gender: "n", plural: "Handys"), "Brot": Noun(gender: "n", plural: "Brote"),
        "Wasser": Noun(gender: "n", plural: nil), "Milch": Noun(gender: "f", plural: nil),
        "Kaffee": Noun(gender: "m", plural: "Kaffees"), "Apfel": Noun(gender: "m", plural: "Äpfel"),
        "Käse": Noun(gender: "m", plural: nil), "Ei": Noun(gender: "n", plural: "Eier"),
        "Montag": Noun(gender: "m", plural: nil), "Dienstag": Noun(gender: "m", plural: nil),
        "Mittwoch": Noun(gender: "m", plural: nil), "Donnerstag": Noun(gender: "m", plural: nil),
        "Freitag": Noun(gender: "m", plural: nil), "Samstag": Noun(gender: "m", plural: nil),
        "Sonntag": Noun(gender: "m", plural: nil), "Uhr": Noun(gender: "f", plural: "Uhren"),
        "Monat": Noun(gender: "m", plural: "Monate"), "Stadt": Noun(gender: "f", plural: "Städte"),
        "Bahnhof": Noun(gender: "m", plural: "Bahnhöfe"), "Schule": Noun(gender: "f", plural: "Schulen"),
        "Supermarkt": Noun(gender: "m", plural: "Supermärkte"), "Kino": Noun(gender: "n", plural: "Kinos"),
        "Park": Noun(gender: "m", plural: "Parks"), "Straße": Noun(gender: "f", plural: "Straßen"),
        "Haus": Noun(gender: "n", plural: "Häuser"),
    ]
    private static let days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
    private static let articleOf: [Character: String] = ["m": "der", "f": "die", "n": "das"]

    /// Plural nouns (lower case) mapped to the plural-only flag; "p" nouns agree like plurals.
    private static var pluralForms: Set<String> {
        Set(nouns.compactMap { $0.value.plural }.filter { $0 != "-" }.map { $0.lowercased() }).union(["eltern", "geschwister"])
    }
    private static var singularGender: [String: Character] {
        var result: [String: Character] = [:]
        for (noun, info) in nouns where info.plural != "-" { result[noun.lowercased()] = info.gender }
        return result
    }

    /// The first English meaning of every word, typed again here.
    private static let gloss: [String: String] = [
        "hallo": "hello", "guten Tag": "good day", "tschüss": "bye", "auf Wiedersehen": "goodbye", "danke": "thank you",
        "ich": "I", "du": "you (informal)", "er": "he", "sie": "she", "wie": "how", "gut": "good", "sein": "to be",
        "heißen": "to be called",
        "null": "zero", "eins": "one", "zwei": "two", "drei": "three", "vier": "four", "fünf": "five", "sechs": "six",
        "sieben": "seven", "acht": "eight", "neun": "nine", "zehn": "ten", "alt": "old", "ja": "yes", "nein": "no",
        "die Familie": "family", "der Vater": "father", "die Mutter": "mother", "der Bruder": "brother",
        "die Schwester": "sister", "die Eltern": "parents", "die Geschwister": "siblings", "der Großvater": "grandfather",
        "die Großmutter": "grandmother", "mein": "my", "dein": "your (informal)", "haben": "to have", "und": "and",
        "der": "the (masculine)", "die": "the (feminine, plural)", "das": "the (neuter)", "ein": "a", "kein": "not a",
        "das Buch": "book", "der Tisch": "table", "die Tasche": "bag", "der Stuhl": "chair", "das Heft": "notebook",
        "das Handy": "mobile phone", "hier": "here",
        "bitte": "please", "möchten": "would like", "essen": "to eat", "trinken": "to drink", "das Brot": "bread",
        "das Wasser": "water", "die Milch": "milk", "der Kaffee": "coffee", "der Apfel": "apple", "der Käse": "cheese",
        "das Ei": "egg", "was": "what",
        "wir": "we", "ihr": "you (plural)", "kommen": "to come", "wohnen": "to live", "lernen": "to learn",
        "arbeiten": "to work", "machen": "to do", "spielen": "to play", "aus": "from", "woher": "where from",
        "wo": "where", "in": "in", "heute": "today",
        "der Montag": "Monday", "der Dienstag": "Tuesday", "der Mittwoch": "Wednesday", "der Donnerstag": "Thursday",
        "der Freitag": "Friday", "der Samstag": "Saturday", "der Sonntag": "Sunday", "die Uhr": "o'clock", "spät": "late",
        "wann": "when", "um": "at (a time)", "der Monat": "month",
        "die Stadt": "city", "der Bahnhof": "train station", "die Schule": "school", "der Supermarkt": "supermarket",
        "das Kino": "cinema", "der Park": "park", "die Straße": "street", "das Haus": "house", "gehen": "to go",
        "nach": "to (a city or country)", "wohin": "where to", "dort": "there",
    ]

    private static let numberWords: [Int: String] = [
        0: "null", 1: "ein", 2: "zwei", 3: "drei", 4: "vier", 5: "fünf", 6: "sechs", 7: "sieben", 8: "acht", 9: "neun",
        10: "zehn", 11: "elf", 12: "zwölf", 13: "dreizehn", 14: "vierzehn", 15: "fünfzehn", 16: "sechzehn",
        17: "siebzehn", 18: "achtzehn", 19: "neunzehn", 20: "zwanzig",
    ]

    // MARK: Helpers

    /// The words of a German text as written (case kept), without the punctuation around them; inner apostrophes stay.
    private func germanTokens(_ text: String) -> [String] {
        let marks = CharacterSet.punctuationCharacters.union(.whitespaces).subtracting(CharacterSet(charactersIn: "'"))
        return text.split(whereSeparator: \.isWhitespace)
            .map { String($0).trimmingCharacters(in: marks) }
            .filter { !$0.isEmpty }
    }

    /// Every German text a student reads: words, sentences, form answers, fills with the right choice put in.
    private var germanTexts: [String] {
        var texts = words.map(\.target) + sentences.map(\.target)
        texts += forms.flatMap(\.answers)
        texts += fills.compactMap { fill in fill.options.first.map { fill.sentence.replacingOccurrences(of: "___", with: $0) } }
        return texts
    }

    private func noun(of subject: String) -> (article: String, noun: String)? {
        let parts = subject.split(separator: " ").map(String.init)
        guard parts.count == 2, ["der", "die", "das", "ein", "kein", "eine"].contains(parts[0]) else { return nil }
        return (parts[0], parts[1])
    }

    private func groupAndSubject(_ form: LanguageForm) -> (String, String)? {
        guard let comma = form.prompt.firstIndex(of: ",") else { return nil }
        return (String(form.prompt[..<comma]), String(form.prompt[form.prompt.index(comma, offsetBy: 2)...]))
    }

    // MARK: Shape

    func testTheCourseParsesAndHasNoContentProblems() {
        XCTAssertEqual(Self.made.errors, [])
    }

    func testTheHeaderAndTheProviderAreWhatTheCatalogExpects() {
        XCTAssertEqual(data.id, "daf")
        XCTAssertEqual(data.title, "Deutsch als Fremdsprache")
        XCTAssertEqual(data.subtitle, "German for English speakers · A1")
        XCTAssertEqual(data.kind, .language)
        XCTAssertEqual(data.color, 0xB8A04A)
        XCTAssertEqual(data.symbol, "textformat")
        XCTAssertEqual(data.speech, "de-DE")
        XCTAssertEqual(data.instruction, .en)
        XCTAssertEqual(data.targetName, "German")
        XCTAssertEqual(data.intoName, "German")
        XCTAssertEqual(data.knownName, "English")
        XCTAssertTrue(data.produces)
        XCTAssertEqual(GermanForeignCourse.provider.course.id, "daf")
        XCTAssertEqual(GermanForeignCourse.provider.course.units.count, 8)
        XCTAssertEqual(GermanForeignCourse.provider.course.units.map(\.title), units.map(\.title))
    }

    func testTheEngineAuditPasses() {
        XCTAssertEqual(CourseAudit.problems(of: GermanForeignCourse.provider, seeds: Array(1...12)), [])
    }

    func testEveryWordOfEverySentenceWasTaughtBefore() {
        XCTAssertEqual(LanguageCoverage.gaps(in: data), [])
    }

    func testTheCourseHasTheAgreedSize() {
        XCTAssertEqual(units.count, 8)
        XCTAssertGreaterThanOrEqual(words.count, 95)
        XCTAssertGreaterThanOrEqual(sentences.count, 60)
        XCTAssertGreaterThanOrEqual(forms.count, 40)
        XCTAssertGreaterThanOrEqual(fills.count, 16)
        XCTAssertGreaterThanOrEqual(facts.count, 12)
        for (index, unit) in units.enumerated() {
            let place = "unit \(index + 1) \(unit.title)"
            XCTAssertTrue((22...30).contains(unit.itemCount), "\(place): \(unit.itemCount) items")
            XCTAssertTrue((10...14).contains(unit.words.count), "\(place): \(unit.words.count) words")
            XCTAssertTrue((6...10).contains(unit.sentences.count), "\(place): \(unit.sentences.count) sentences")
            XCTAssertTrue((3...7).contains(unit.forms.count), "\(place): \(unit.forms.count) forms")
            XCTAssertTrue((2...4).contains(unit.fills.count), "\(place): \(unit.fills.count) fills")
            XCTAssertTrue((1...3).contains(unit.facts.count), "\(place): \(unit.facts.count) facts")
            XCTAssertEqual(LanguageCourseProvider.lessonCount(of: unit), 5, place)
            let tips = unit.tip.components(separatedBy: "\n\n")
            XCTAssertTrue((3...5).contains(tips.count), "\(place): \(tips.count) tip paragraphs")
            for tip in tips {
                XCTAssertGreaterThan(tip.count, 120, "\(place): a tip paragraph that is too short to teach anything")
                XCTAssertLessThan(tip.count, 800, "\(place): a tip paragraph that is too long for a phone")
            }
        }
    }

    func testEveryRuleBasedItemExplainsItself() {
        for form in forms { XCTAssertFalse(form.why.isEmpty, "form without explanation: \(form.prompt)") }
        for fill in fills { XCTAssertFalse(fill.why.isEmpty, "fill without explanation: \(fill.sentence)") }
        for fact in facts { XCTAssertFalse(fact.why.isEmpty, "fact without explanation: \(fact.question)") }
        for item in forms.map(\.why) + fills.map(\.why) + facts.map(\.why) {
            XCTAssertTrue(item.hasSuffix("."), "an explanation is a sentence: \(item)")
        }
    }

    func testTheGlossOfEveryWordIsWhatATeacherExpects() {
        var seen = Set<String>()
        for word in words {
            guard let expected = Self.gloss[word.target] else {
                XCTFail("a word the test does not know: \(word.target)")
                continue
            }
            XCTAssertEqual(word.meanings.first, expected, word.target)
            seen.insert(word.target)
        }
        XCTAssertEqual(seen.count, Self.gloss.count, "the test lists a word the course does not teach")
    }

    // MARK: Verbs

    func testEveryVerbTableHasAllSixPersonsAndTheRightForms() {
        var tables = 0
        for word in words where word.note.hasPrefix("forms: ") {
            let verb = word.target
            let entries = word.note.dropFirst("forms: ".count).components(separatedBy: ", ")
            XCTAssertEqual(entries.count, 6, "\(verb): a full table has six persons")
            guard let expected = conjugation(of: verb) else {
                XCTFail("a verb the test does not know: \(verb)")
                continue
            }
            for (index, entry) in entries.enumerated() where index < 6 {
                XCTAssertEqual(entry, "\(Self.persons[index]) \(expected[index])", "\(verb): \(entry)")
            }
            tables += 1
        }
        XCTAssertEqual(tables, 13, "every verb of the course has a table")
        let verbs = Set(words.filter { $0.note.hasPrefix("forms: ") }.map(\.target))
        XCTAssertEqual(verbs, Set(Self.irregular.keys).union(Self.regularVerbs))
    }

    func testEveryVerbFormIsRightForItsPerson() {
        var checked = 0
        for form in forms {
            let parts = form.prompt.components(separatedBy: ", ")
            guard parts.count == 2, Self.persons.contains(parts[1]) else { continue }
            guard let table = conjugation(of: parts[0]), let index = Self.persons.firstIndex(of: parts[1]) else {
                XCTFail("a form of a verb the test does not know: \(form.prompt)")
                continue
            }
            XCTAssertEqual(form.answers.first, table[index], form.prompt)
            checked += 1
        }
        XCTAssertGreaterThanOrEqual(checked, 17)
    }

    func testTheTipsSayEveryVerbFormTheyDrill() {
        for (index, unit) in units.enumerated() {
            for form in unit.forms {
                let parts = form.prompt.components(separatedBy: ", ")
                guard parts.count == 2, Self.persons.contains(parts[1]), let answer = form.answers.first else { continue }
                // A tip shows the verb as "du isst" or in a list; the form may appear in this unit's tip or in the tip of the
                // unit that taught the verb.
                let tips = units[0...index].map(\.tip).joined(separator: " ")
                XCTAssertTrue(tips.contains(answer), "unit \(index + 1): no tip shows \(answer) (\(form.prompt))")
            }
        }
    }

    func testFillsWithVerbsHaveExactlyTheRightFormForTheirSubject() {
        // Every form of every verb mapped to the persons it can belong to (index in `persons`).
        var byForm: [String: Set<Int>] = [:]
        for verb in Array(Self.irregular.keys) + Self.regularVerbs {
            guard let table = conjugation(of: verb) else { continue }
            for (index, form) in table.enumerated() { byForm[form, default: []].insert(index) }
        }
        byForm["bin", default: []].insert(0)
        let subjects = ["ich": 0, "du": 1, "er": 2, "wir": 3, "ihr": 4]
        var checked = 0
        for fill in fills {
            let tokens = germanTokens(fill.sentence.replacingOccurrences(of: "___", with: "BLANK"))
            guard let blank = tokens.firstIndex(of: "BLANK") else { XCTFail("no blank: \(fill.sentence)"); continue }
            var person: Int?
            if blank > 0, let found = subjects[tokens[blank - 1].lowercased()] { person = found }
            else if blank > 0, tokens[blank - 1] == "Sie", blank == 1 { person = 2 }
            else if blank + 1 < tokens.count, tokens[blank + 1] == "Sie", blank > 0 { person = 5 }
            else if blank + 1 < tokens.count, let found = subjects[tokens[blank + 1].lowercased()] { person = found }
            guard let person, fill.options.allSatisfy({ byForm[$0] != nil }) else { continue }
            XCTAssertTrue(byForm[fill.options[0]]?.contains(person) == true, "\(fill.sentence): \(fill.options[0]) does not fit")
            for wrong in fill.options.dropFirst() {
                XCTAssertFalse(byForm[wrong]?.contains(person) == true, "\(fill.sentence): \(wrong) also fits")
            }
            checked += 1
        }
        XCTAssertGreaterThanOrEqual(checked, 6)
    }

    // MARK: Nouns, genders, plurals

    func testEveryNounCarriesItsArticleAndAPluralNoteThatAgree() {
        var checked = 0
        for word in words {
            let parts = word.target.split(separator: " ").map(String.init)
            guard parts.count == 2, ["der", "die", "das"].contains(parts[0]) else { continue }
            let name = parts[1]
            guard let info = Self.nouns[name] else {
                XCTFail("a noun the test does not know: \(word.target)")
                continue
            }
            XCTAssertEqual(parts[0], info.plural == "-" ? "die" : Self.articleOf[info.gender]!, "\(word.target) has the wrong article")
            switch info.plural {
            case .none:
                let allowed = Self.days.contains(name) ? "all days are masculine" : "no plural"
                XCTAssertEqual(word.note, allowed, word.target)
            case .some("-"):
                XCTAssertEqual(word.note, "plural only", word.target)
            case .some(let plural):
                XCTAssertEqual(word.note, "pl. die \(plural)", word.target)
            }
            checked += 1
        }
        XCTAssertEqual(checked, Self.nouns.count, "number of nouns taught with an article")
    }

    func testEveryNounIsTaughtWithItsArticle() {
        let targets = Set(words.map(\.target))
        for name in Self.nouns.keys {
            XCTAssertFalse(targets.contains(name), "\(name) is taught without its article")
        }
        let taught = Set(words.compactMap { word -> String? in
            let parts = word.target.split(separator: " ").map(String.init)
            return parts.count == 2 && ["der", "die", "das"].contains(parts[0]) ? parts[1] : nil
        })
        XCTAssertEqual(taught, Set(Self.nouns.keys))
    }

    func testPluralFormsFollowTheTable() {
        var checked = 0
        for form in forms {
            guard let (group, subject) = groupAndSubject(form), group == "Plural", let (_, name) = noun(of: subject),
                  let plural = Self.nouns[name]?.plural, plural != "-" else { continue }
            XCTAssertEqual(form.answers.first, "die \(plural)", form.prompt)
            checked += 1
        }
        XCTAssertEqual(checked, 4)
    }

    func testAccusativeFormsChangeOnlyMasculineNouns() {
        var checked = 0
        for form in forms {
            guard let (group, subject) = groupAndSubject(form), group == "accusative", let (article, name) = noun(of: subject),
                  let info = Self.nouns[name] else { continue }
            XCTAssertEqual(info.gender, "m", "\(form.prompt): the drill is about the one gender that changes")
            let changed = ["der": "den", "ein": "einen", "kein": "keinen"][article]
            XCTAssertEqual(form.answers.first, "\(changed ?? "?") \(name)", form.prompt)
            checked += 1
        }
        XCTAssertEqual(checked, 3)
    }

    func testPossessiveAndIndefiniteFormsAgreeWithTheNoun() {
        var checked = 0
        for form in forms {
            guard let (group, subject) = groupAndSubject(form), ["mein", "dein", "ein", "kein"].contains(group),
                  let (_, name) = noun(of: subject), let info = Self.nouns[name] else { continue }
            let plural = subject.hasPrefix("die ") && info.plural == "-"
            let ending = (info.gender == "f" || plural) ? "e" : ""
            XCTAssertEqual(form.answers.first, "\(group)\(ending) \(name)", form.prompt)
            checked += 1
        }
        XCTAssertEqual(checked, 5)
    }

    func testNumbersAreSpelledAsTheRulesSay() {
        var seen = Set<Int>()
        for form in forms {
            guard let (group, subject) = groupAndSubject(form), group == "in words", let value = Int(subject) else { continue }
            XCTAssertEqual(form.answers.first, Self.numberWords[value] == "ein" ? "eins" : Self.numberWords[value], form.prompt)
            // The tip teaches the rule: units + zehn, with sechzehn and siebzehn shortened.
            if (13...19).contains(value), value != 16, value != 17 {
                XCTAssertEqual(form.answers.first, Self.numberWords[value - 10]! + "zehn")
            }
            seen.insert(value)
        }
        XCTAssertEqual(seen, [11, 12, 13, 16, 17, 20])
        let taught = words.filter { $0.target.range(of: " ") == nil }.map(\.target)
        for (value, name) in Self.numberWords where value <= 10 {
            let target = name == "ein" ? "eins" : name
            XCTAssertTrue(taught.contains(target), "the number \(value) is not taught: \(target)")
        }
    }

    func testClockTimesAreComputedFromTheDigits() {
        let hours: [Int: String] = [1: "ein", 2: "zwei", 3: "drei", 4: "vier", 5: "fünf", 6: "sechs", 7: "sieben", 8: "acht",
                                    9: "neun", 10: "zehn", 11: "elf", 12: "zwölf"]
        var checked = 0
        for form in forms {
            guard let (group, subject) = groupAndSubject(form), group == "time" else { continue }
            let parts = subject.split(separator: ":").compactMap { Int($0) }
            XCTAssertEqual(parts.count, 2, form.prompt)
            let hour = parts[0], minute = parts[1]
            let next = hour % 12 + 1
            let expected: String
            switch minute {
            case 0: expected = "Es ist \(hours[hour]!) Uhr."
            case 15: expected = "Es ist Viertel nach \(hours[hour]!)."
            case 30: expected = "Es ist halb \(hours[next]!)."
            case 45: expected = "Es ist Viertel vor \(hours[next]!)."
            default: expected = "?"
            }
            XCTAssertEqual(form.answers.first, expected, form.prompt)
            checked += 1
        }
        XCTAssertEqual(checked, 4)
    }

    func testContractionsAndPrepositionFormsFollowTheCases() {
        var checked = 0
        for form in forms {
            guard let (group, subject) = groupAndSubject(form), let (_, name) = noun(of: subject),
                  let info = Self.nouns[name] else { continue }
            switch group {
            case "Wo? in":
                XCTAssertEqual(form.answers.first, info.gender == "f" ? "in der \(name)" : "im \(name)", form.prompt)
            case "Wohin? in":
                let expected = info.gender == "m" ? "in den \(name)" : info.gender == "n" ? "ins \(name)" : "in die \(name)"
                XCTAssertEqual(form.answers.first, expected, form.prompt)
            case "zu":
                XCTAssertEqual(form.answers.first, info.gender == "f" ? "zur \(name)" : "zum \(name)", form.prompt)
            case "on":
                XCTAssertEqual(form.answers.first, "am \(name)", form.prompt)
                XCTAssertTrue(Self.days.contains(name), form.prompt)
            default:
                continue
            }
            checked += 1
        }
        XCTAssertEqual(checked, 7)
    }

    // MARK: Agreement in every text

    func testArticlesAndPossessivesAgreeWithTheirNounsEverywhere() {
        let gender = Self.singularGender
        let plurals = Self.pluralForms
        func kind(_ token: String) -> Character? {
            let key = token.lowercased()
            if plurals.contains(key) { return "p" }
            return gender[key]
        }
        var checked = 0
        for text in germanTexts {
            let tokens = germanTokens(text)
            for (index, token) in tokens.enumerated().dropLast() {
                guard let next = kind(tokens[index + 1]) else { continue }
                let previous = index > 0 ? tokens[index - 1].lowercased() : ""
                let lower = token.lowercased()
                switch lower {
                case "ein" where tokens[index + 1] == "Uhr":
                    continue // "ein Uhr" is the clock form of eins
                case "ein", "kein", "mein", "dein":
                    XCTAssertTrue(next == "m" || next == "n", "\(text): \(token) before \(tokens[index + 1])")
                case "eine", "keine", "meine", "deine":
                    XCTAssertTrue(next == "f" || next == "p", "\(text): \(token) before \(tokens[index + 1])")
                case "einen", "keinen":
                    XCTAssertEqual(next, "m", "\(text): \(token) before \(tokens[index + 1])")
                case "den":
                    XCTAssertTrue(next == "m", "\(text): den before \(tokens[index + 1])")
                case "der":
                    // masculine, or dative feminine after a preposition
                    XCTAssertTrue(next == "m" || (next == "f" && ["in", "zu"].contains(previous)), "\(text): der before \(tokens[index + 1])")
                case "die":
                    XCTAssertTrue(next == "f" || next == "p", "\(text): die before \(tokens[index + 1])")
                case "das":
                    XCTAssertEqual(next, "n", "\(text): das before \(tokens[index + 1])")
                case "im", "zum":
                    XCTAssertTrue(next == "m" || next == "n", "\(text): \(token) before \(tokens[index + 1])")
                case "ins":
                    XCTAssertEqual(next, "n", "\(text): ins before \(tokens[index + 1])")
                case "zur":
                    XCTAssertEqual(next, "f", "\(text): zur before \(tokens[index + 1])")
                default:
                    continue
                }
                checked += 1
            }
        }
        XCTAssertGreaterThanOrEqual(checked, 80)
    }

    func testEveryNounIsWrittenWithACapitalLetter() {
        let all = Set(Self.nouns.keys.map { $0.lowercased() } + Self.pluralForms)
        for text in germanTexts {
            for token in germanTokens(text) where all.contains(token.lowercased()) {
                XCTAssertTrue(token.first?.isUppercase == true, "\(text): \(token) is a noun and needs a capital")
            }
        }
    }

    // MARK: Sentences and glosses

    func testSentencesAreShortWellFormedAndNeverRepeated() {
        var seen = Set<String>()
        for (index, unit) in units.enumerated() {
            for sentence in unit.sentences {
                let tokens = germanTokens(sentence.target)
                XCTAssertLessThanOrEqual(tokens.count, 8, "unit \(index + 1): too long to type: \(sentence.target)")
                XCTAssertTrue(sentence.target.first?.isUppercase == true, "starts with a capital: \(sentence.target)")
                XCTAssertTrue(".?!".contains(sentence.target.last ?? "x"), "ends with a mark: \(sentence.target)")
                XCTAssertTrue(seen.insert(LearnExercise.folded(sentence.target)).inserted, "repeated: \(sentence.target)")
                XCTAssertFalse(sentence.meanings.isEmpty)
                for meaning in sentence.meanings {
                    let bare = meaning.replacingOccurrences(of: " (formal)", with: "")
                    XCTAssertTrue(".?!".contains(bare.last ?? "x"), "the translation ends with a mark: \(meaning)")
                }
            }
        }
    }

    func testTranslationsHaveNoGermanLeftOver() {
        let german: Set<String> = [
            "ich", "du", "er", "wir", "ihr", "ist", "sind", "bin", "bist", "und", "der", "die", "das", "ein", "eine", "einen",
            "nicht", "kein", "keine", "mein", "meine", "habe", "hat", "hast", "heißt", "heiße", "wie", "wo", "was", "gut",
            "danke", "hallo", "nach", "aus", "im", "ins", "zum", "heute", "dort", "hier",
        ]
        let names: Set<String> = ["müller", "weber", "anna", "max", "peter", "julia", "berlin"]
        for sentence in sentences {
            for meaning in sentence.meanings {
                for token in germanTokens(meaning) {
                    let lower = token.lowercased()
                    XCTAssertFalse(german.contains(lower), "\(meaning): \(token) is German")
                    if !names.contains(lower) {
                        XCTAssertFalse(lower.contains(where: { "äöüß".contains($0) }), "\(meaning): \(token) has a German letter")
                    }
                }
            }
        }
        for word in words {
            for meaning in word.meanings where !meaning.contains("Sie") {
                XCTAssertFalse(meaning.contains(where: { "äöüß".contains($0) }), "\(word.target): \(meaning)")
            }
        }
    }

    func testNoMeaningIsSharedByTwoWords() {
        var owner: [String: String] = [:]
        for word in words {
            for meaning in word.meanings {
                let key = LearnExercise.folded(meaning)
                if let other = owner[key], other != word.target { XCTFail("\"\(meaning)\" means \(other) and \(word.target)") }
                owner[key] = word.target
            }
        }
    }

    func testFillsHaveOneRightChoiceAndRealWrongOnes() {
        for fill in fills {
            XCTAssertEqual(fill.sentence.components(separatedBy: "___").count, 2, "exactly one blank: \(fill.sentence)")
            XCTAssertEqual(Set(fill.options).count, fill.options.count, "a choice twice: \(fill.sentence)")
            XCTAssertTrue((3...4).contains(fill.options.count), "three choices are enough: \(fill.sentence)")
        }
        for fact in facts {
            XCTAssertEqual(Set([fact.answer] + fact.wrong).count, fact.wrong.count + 1, "a choice twice: \(fact.question)")
            XCTAssertTrue(fact.question.hasSuffix("?"), fact.question)
        }
    }

    func testTheCourseIsTaughtInEnglishWithGermanExamples() {
        // The prompts come from the engine; the tips must not slip into German prose.
        let germanProse = ["Dies ist", "Das bedeutet", "Man sagt", "Beachte"]
        for unit in units {
            for phrase in germanProse { XCTAssertFalse(unit.tip.contains(phrase), "\(unit.title): \(phrase)") }
            XCTAssertFalse(unit.title.isEmpty)
            XCTAssertFalse(unit.summary.isEmpty)
        }
        XCTAssertFalse(GermanForeignCourse.source.contains("\u{1F600}"))
    }

    func testTheLessonsOfAUnitCoverItsNewItems() {
        for number in 1...8 {
            let unit = GermanForeignCourse.provider.course.units[number - 1]
            XCTAssertEqual(unit.nodes.filter { $0.kind == .lesson }.count, 5, unit.title)
            for node in unit.nodes where node.kind != .chest {
                let exercises = GermanForeignCourse.provider.exercises(for: node, seed: 7)
                XCTAssertGreaterThanOrEqual(exercises.count, 8, node.id)
                XCTAssertGreaterThanOrEqual(Set(exercises.map(\.kind)).count, 2, node.id)
            }
        }
    }
}
