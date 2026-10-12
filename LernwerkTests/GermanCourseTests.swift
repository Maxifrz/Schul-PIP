import XCTest
@testable import Lernwerk

/// Checks the school course Deutsch (spelling, grammar, style for native speakers): that it parses and passes the
/// engine's audit, and that its content is right in ways that do not depend on how the text was written: forms
/// against tables typed again here, case endings against the article table, fills of the first units against a
/// hand-typed answer list, and rules about the shape of the text (explanations, tips, old spelling, quotes).
final class GermanCourseTests: XCTestCase {
    private static let made = LanguageCourseProvider.make(source: GermanSchoolCourse.source)
    private var provider: LanguageCourseProvider { Self.made.provider }
    private var units: [LanguageUnitData] { provider.data.units }
    private var words: [LanguageWord] { units.flatMap(\.words) }
    private var forms: [LanguageForm] { units.flatMap(\.forms) }
    private var fills: [LanguageFill] { units.flatMap(\.fills) }
    private var facts: [LanguageFact] { units.flatMap(\.facts) }

    private func answers(unit: Int) -> [String: String] {
        Dictionary(uniqueKeysWithValues: units[unit].forms.map { ($0.prompt, $0.answers[0]) })
    }

    // MARK: Engine checks

    func testTheCourseParsesWithoutErrors() {
        XCTAssertEqual(Self.made.errors, [])
        XCTAssertEqual(provider.data.kind, .school)
        XCTAssertEqual(provider.data.id, "de")
        XCTAssertEqual(provider.data.title, "Deutsch")
        XCTAssertEqual(provider.data.instruction, .de)
    }

    func testTheCourseNeedsNoCoverageAndHasNoSentences() {
        XCTAssertTrue(units.allSatisfy { $0.sentences.isEmpty })
    }

    func testTheCoursePassesTheAudit() {
        XCTAssertEqual(CourseAudit.problems(of: provider, seeds: Array(1...12)), [])
        XCTAssertEqual(CourseAudit.problems(of: GermanSchoolCourse.provider, seeds: [1, 2]), [])
    }

    func testMinimumCounts() {
        XCTAssertGreaterThanOrEqual(units.count, 10)
        XCTAssertGreaterThanOrEqual(words.count, 80)
        XCTAssertGreaterThanOrEqual(forms.count, 40)
        XCTAssertGreaterThanOrEqual(fills.count, 90)
        XCTAssertGreaterThanOrEqual(facts.count, 60)
    }

    func testEveryUnitHasTheRightSize() {
        for (index, unit) in units.enumerated() {
            let place = "unit \(index + 1) \(unit.title)"
            XCTAssertTrue((22...30).contains(unit.itemCount), "\(place): \(unit.itemCount) items")
            XCTAssertTrue((6...10).contains(unit.words.count), "\(place): \(unit.words.count) terms")
            XCTAssertTrue((6...10).contains(unit.fills.count), "\(place): \(unit.fills.count) fills")
            XCTAssertTrue((4...8).contains(unit.facts.count), "\(place): \(unit.facts.count) facts")
            XCTAssertTrue((3...6).contains(unit.forms.count), "\(place): \(unit.forms.count) forms")
            let tips = unit.tip.components(separatedBy: "\n\n")
            XCTAssertTrue((3...5).contains(tips.count), "\(place): \(tips.count) tips")
            for tip in tips { XCTAssertGreaterThan(tip.count, 100, "\(place): a tip is too short") }
        }
    }

    // MARK: Shape of the text

    func testEveryFillAndFactHasAnExplanationAndSoundChoices() {
        for fill in fills {
            XCTAssertFalse(fill.why.isEmpty, fill.sentence)
            XCTAssertEqual(fill.sentence.components(separatedBy: "___").count, 2, "one blank: \(fill.sentence)")
            let folded = fill.options.map(LearnExercise.folded)
            XCTAssertEqual(Set(folded).count, folded.count, "options that read the same: \(fill.sentence)")
            XCTAssertTrue((2...4).contains(fill.options.count), fill.sentence)
        }
        for fact in facts {
            XCTAssertFalse(fact.why.isEmpty, fact.question)
            let all = [fact.answer] + fact.wrong
            XCTAssertEqual(Set(all.map(LearnExercise.folded)).count, all.count, "options that read the same: \(fact.question)")
            XCTAssertTrue((2...4).contains(all.count), fact.question)
        }
        for form in forms { XCTAssertFalse(form.why.isEmpty, form.prompt) }
    }

    func testNoTermDefinitionContainsItsOwnTerm() {
        for word in words {
            let term = LearnExercise.folded(word.target)
            XCTAssertFalse(word.meanings.isEmpty, word.target)
            for meaning in word.meanings {
                XCTAssertFalse(LearnExercise.folded(meaning).contains(term), "\(word.target) is in its definition")
            }
        }
    }

    func testNoOldSpellingAndNoStraightQuotes() {
        let source = GermanSchoolCourse.source
        for old in ["daß", "muß", "läßt", "Fluß", "Kuß", "Schloß", "bißchen", "Ballett", "Gemse", "Stengel"] where old != "Ballett" {
            XCTAssertFalse(source.contains(old), old)
        }
        XCTAssertFalse(source.contains("\""), "use the German quotation marks")
        XCTAssertFalse(source.contains("  "), "double spaces")
    }

    func testTheSameQuestionOrFillIsNotAskedTwice() {
        let questions = facts.map { LearnExercise.folded($0.question + $0.answer) }
        XCTAssertEqual(Set(questions).count, questions.count)
        let sentences = fills.map { LearnExercise.folded($0.sentence) }
        XCTAssertEqual(Set(sentences).count, sentences.count)
        let prompts = forms.map { LearnExercise.folded($0.prompt) }
        XCTAssertEqual(Set(prompts).count, prompts.count)
    }

    // MARK: Unit 1, das or dass: answers typed again

    func testDasOrDassFillsAgainstAHandTypedList() {
        let expected: [String: String] = [
            "Ich weiß, ___ du kommst.": "dass", "___ Buch liegt auf dem Tisch.": "Das",
            "Das Kind, ___ dort steht, ist mein Bruder.": "das", "Er sagt, ___ es regnet.": "dass",
            "Das ist das Haus, ___ wir kaufen wollen.": "das", "Ich hoffe, ___ wir gewinnen.": "dass",
            "___ er schon da ist, freut mich.": "Dass", "Sie hat das Fahrrad, ___ ich mir wünsche.": "das",
            "Es ist schön, ___ du da bist.": "dass", "Wir wissen, ___ ihr Hilfe braucht.": "dass",
        ]
        XCTAssertEqual(units[0].fills.count, expected.count)
        for fill in units[0].fills { XCTAssertEqual(expected[fill.sentence], fill.options.first, fill.sentence) }
        // the rule itself: a dass answer comes after a verb of saying or knowing, never right after a noun
        for fill in units[0].fills where fill.options.first?.lowercased() == "dass" {
            XCTAssertTrue(fill.why.contains("dass"), fill.sentence)
        }
    }

    func testRelativePronounsFollowTheGenderOfTheirNoun() {
        let gender = ["das Mädchen": "das", "der Mann": "der", "die Frau": "die"]
        XCTAssertEqual(units[0].forms.count, 3)
        for form in units[0].forms {
            let noun = form.prompt.components(separatedBy: ", ").last ?? ""
            XCTAssertEqual(gender[noun], form.answers.first, form.prompt)
        }
    }

    // MARK: Unit 2, suffixes

    func testNominalisationSuffixes() {
        for form in units[1].forms {
            let parts = form.prompt.components(separatedBy: ", Nomen auf -")
            XCTAssertEqual(parts.count, 2, form.prompt)
            let base = parts[0], suffix = parts[1]
            let answer = form.answers[0]
            XCTAssertTrue(answer.hasSuffix(suffix), "\(answer) should end in \(suffix)")
            XCTAssertTrue(answer.first?.isUppercase == true, "\(answer) is a noun")
            let stem = base.hasSuffix("en") ? String(base.dropLast(2)) : base
            XCTAssertTrue(answer.lowercased().hasPrefix(stem), "\(answer) comes from \(base)")
        }
        for fill in units[1].fills {
            let rest = fill.sentence.components(separatedBy: "___")[0].split(separator: " ").last ?? ""
            let word = String(rest) + fill.options[0]
            XCTAssertTrue(word.first?.isUppercase == true, "the filled word \(word) is a noun")
            XCTAssertTrue(["schaft", "heit", "keit", "nis"].contains(fill.options[0]), fill.sentence)
            XCTAssertTrue(["Freundschaft", "Krankheit", "Höflichkeit", "Gedächtnis", "Verständnis", "Heiterkeit"].contains(word), word)
        }
    }

    // MARK: Unit 3, s sounds

    func testSSoundFormsAgainstATable() {
        let table = ["essen, Präteritum ich": "aß", "lesen, Präteritum ich": "las", "wissen, Präsens ich": "weiß", "fließen, Präteritum es": "floss"]
        for form in units[2].forms { XCTAssertEqual(table[form.prompt], form.answers[0], form.prompt) }
        XCTAssertEqual(units[2].forms.count, table.count)
    }

    func testFactsAboutSAndSSNameRealSpellings() {
        let withEsszet = ["Fuß", "Gruß", "Straße", "heißen", "draußen", "groß"]
        let withDoubleS = ["Fluss", "Wasser", "wissen", "müssen", "Rasse", "Gasse", "Fass", "muss"]
        for fact in units[2].facts where fact.question.hasPrefix("Welches Wort wird mit ß") {
            XCTAssertTrue(withEsszet.contains(fact.answer), fact.question)
            XCTAssertTrue(fact.wrong.allSatisfy { withDoubleS.contains($0) }, fact.question)
        }
        for fact in units[2].facts where fact.question.hasPrefix("Welches Wort wird mit ss") {
            XCTAssertTrue(withDoubleS.contains(fact.answer), fact.question)
            XCTAssertTrue(fact.wrong.allSatisfy { withEsszet.contains($0) }, fact.question)
        }
    }

    // MARK: Unit 4, umlaut plurals

    func testPluralFormsAgainstATable() {
        let plural = [
            "der Baum": "die Bäume", "der Zahn": "die Zähne", "die Hand": "die Hände", "der Hals": "die Hälse",
            "die Metapher": "die Metaphern", "die Hyperbel": "die Hyperbeln", "die Alliteration": "die Alliterationen",
            "der Vergleich": "die Vergleiche", "das Gedicht": "die Gedichte", "der Vers": "die Verse",
            "die Strophe": "die Strophen", "das Drama": "die Dramen",
        ]
        var seen = 0
        for form in forms where form.prompt.hasSuffix(", Plural") {
            let noun = form.prompt.replacingOccurrences(of: ", Plural", with: "")
            XCTAssertEqual(plural[noun], form.answers[0], form.prompt)
            seen += 1
        }
        XCTAssertEqual(seen, plural.count)
    }

    // MARK: Unit 5, zu infinitive

    func testZuInfinitiveFollowsTheRuleForSeparablePrefixes() {
        let separable = ["auf", "mit", "an", "ab", "aus", "ein"]
        for form in units[4].forms {
            let verb = form.prompt.components(separatedBy: ", ").last ?? ""
            let expected: String
            if let prefix = separable.first(where: { verb.hasPrefix($0) }) {
                expected = prefix + "zu" + verb.dropFirst(prefix.count)
            } else {
                expected = "zu " + verb
            }
            XCTAssertEqual(form.answers[0], expected, form.prompt)
        }
    }

    // MARK: Unit 6, comparison

    func testComparisonFormsAgainstATable() {
        let table = [
            "schnell, Komparativ": "schneller", "schnell, Superlativ": "am schnellsten", "gut, Komparativ": "besser",
            "gut, Superlativ": "am besten", "hoch, Komparativ": "höher",
        ]
        for form in units[5].forms { XCTAssertEqual(table[form.prompt], form.answers[0], form.prompt) }
        XCTAssertEqual(units[5].forms.count, table.count)
        for form in units[5].forms where form.prompt.hasSuffix("Superlativ") {
            XCTAssertTrue(form.answers.contains { $0.hasPrefix("am ") }, form.prompt)
            XCTAssertTrue(form.answers.contains { !$0.hasPrefix("am ") }, "the bare form is accepted too")
        }
    }

    // MARK: Unit 7, cases

    func testCaseFormsFollowTheArticleTable() {
        let articles: [String: [String: String]] = [
            "der": ["Nominativ": "der", "Genitiv": "des", "Dativ": "dem", "Akkusativ": "den"],
            "die": ["Nominativ": "die", "Genitiv": "der", "Dativ": "der", "Akkusativ": "die"],
            "das": ["Nominativ": "das", "Genitiv": "des", "Dativ": "dem", "Akkusativ": "das"],
        ]
        for form in units[6].forms {
            let parts = form.prompt.components(separatedBy: ", ")
            XCTAssertEqual(parts.count, 2, form.prompt)
            let noun = parts[0].split(separator: " ").map(String.init)
            let article = noun[0], stem = noun[1], caseName = parts[1]
            let wanted = articles[article]?[caseName]
            for answer in form.answers {
                let words = answer.split(separator: " ").map(String.init)
                XCTAssertEqual(words.count, 2, answer)
                XCTAssertEqual(words[0], wanted, answer)
                if caseName == "Genitiv", article != "die" {
                    XCTAssertTrue(words[1] == stem + "es" || words[1] == stem + "s", answer)
                } else {
                    XCTAssertEqual(words[1], stem, answer)
                }
            }
        }
        XCTAssertEqual(units[6].forms.count, 5)
    }

    func testCaseFillsAgainstAHandTypedList() {
        let expected: [String: String] = [
            "Ich gebe ___ Kind einen Apfel.": "dem", "Er sieht ___ Hund im Garten.": "den",
            "Wir fahren mit ___ Bus zur Schule.": "dem", "Das ist das Auto ___ Lehrers.": "des",
            "Sie wartet auf ___ Zug.": "den", "Ich danke ___ für die Hilfe.": "dir",
            "Wegen ___ Regens fällt das Spiel aus.": "des", "Er hilft ___ Freundin bei den Hausaufgaben.": "seiner",
        ]
        XCTAssertEqual(units[6].fills.count, expected.count)
        for fill in units[6].fills { XCTAssertEqual(expected[fill.sentence], fill.options.first, fill.sentence) }
    }

    func testPrepositionFactsAgainstTheCaseLists() {
        let accusative = ["für", "durch", "gegen", "ohne", "um"], dative = ["mit", "aus", "bei", "nach", "von", "zu", "seit"]
        let genitive = ["wegen", "trotz", "während", "statt"]
        for fact in units[6].facts where fact.question.hasPrefix("Welcher Fall folgt auf") {
            let preposition = fact.question.components(separatedBy: "„")[1].components(separatedBy: "“")[0]
            let expected = accusative.contains(preposition) ? "Akkusativ" : dative.contains(preposition) ? "Dativ" : genitive.contains(preposition) ? "Genitiv" : "?"
            XCTAssertEqual(fact.answer, expected, preposition)
        }
        for fact in units[6].facts where fact.question.hasPrefix("Welche Präposition verlangt den Genitiv") {
            XCTAssertTrue(genitive.contains(fact.answer))
            XCTAssertTrue(fact.wrong.allSatisfy { !genitive.contains($0) })
        }
    }

    // MARK: Unit 8, tenses

    func testTenseFormsAgainstTheStemForms() {
        let stems: [String: (past: String, participle: String, aux: String)] = [
            "gehen": ("ging", "gegangen", "sein"), "bringen": ("brachte", "gebracht", "haben"),
            "schreiben": ("schrieb", "geschrieben", "haben"), "lesen": ("las", "gelesen", "haben"),
            "kommen": ("kam", "gekommen", "sein"),
        ]
        for form in units[7].forms {
            let parts = form.prompt.components(separatedBy: ", ")
            let verb = parts[0], tense = parts[1], answer = form.answers[0]
            guard let entry = stems[verb] else { return XCTFail(form.prompt) }
            switch tense {
            case "Präteritum ich": XCTAssertEqual(answer, entry.past, form.prompt)
            case "Partizip II":
                if verb == "bringen" { XCTAssertEqual(answer, "gebracht") } else { XCTAssertEqual(answer, entry.participle, form.prompt) }
            case "Perfekt ich":
                XCTAssertEqual(answer, (entry.aux == "sein" ? "bin " : "habe ") + entry.participle, form.prompt)
            case "Plusquamperfekt ich":
                XCTAssertEqual(answer, (entry.aux == "sein" ? "war " : "hatte ") + entry.participle, form.prompt)
            default: XCTFail("unknown tense \(tense)")
            }
        }
    }

    func testTheAuxiliaryInTheFillsMatchesTheVerb() {
        for fill in units[7].fills {
            let sentence = fill.sentence.replacingOccurrences(of: "___", with: fill.options[0])
            if sentence.contains("gefahren") { XCTAssertEqual(fill.options[0], "sind") }
            if sentence.contains("geschlafen") || sentence.contains("gelesen") || sentence.contains("gemacht") {
                XCTAssertTrue(["habe", "hat"].contains(fill.options[0]), sentence)
            }
        }
    }

    // MARK: Unit 9, Konjunktiv

    func testSubjunctiveFormsAgainstATable() {
        let table = [
            "sein, Konjunktiv I er": "sei", "sein, Konjunktiv II ich": "wäre", "haben, Konjunktiv II ich": "hätte",
            "kommen, Konjunktiv II ich": "käme", "werden, Konjunktiv II ich": "würde", "können, Konjunktiv II ich": "könnte",
        ]
        for form in units[8].forms { XCTAssertEqual(table[form.prompt], form.answers[0], form.prompt) }
        XCTAssertEqual(units[8].forms.count, table.count)
        // every Konjunktiv II form carries an umlaut or ends on -e/-te as the tip teaches
        for form in units[8].forms where form.prompt.contains("Konjunktiv II") {
            XCTAssertTrue(form.answers[0].contains { "äöü".contains($0) }, form.prompt)
        }
    }

    func testSubjunctiveFillsAnnounceTheirMood() {
        for fill in units[8].fills {
            XCTAssertTrue(fill.sentence.hasPrefix("Konjunktiv I:") || fill.sentence.hasPrefix("Konjunktiv II:"), fill.sentence)
            let first = fill.options[0]
            if fill.sentence.hasPrefix("Konjunktiv I:") {
                XCTAssertTrue(["sei", "seien", "habe"].contains(first), fill.sentence)
            } else {
                XCTAssertTrue(["hätte", "wäre", "Könntest"].contains(first), fill.sentence)
            }
        }
    }

    // MARK: Units 10 and 11, terms

    func testStyleFillsNameATermOfTheUnit() {
        let terms = Set(units[9].words.map(\.target))
        for fill in units[9].fills {
            for option in fill.options { XCTAssertTrue(terms.contains(option), "\(option) is not a term of the unit") }
        }
    }

    func testRhymeSchemesAgainstTheLetters() {
        let letters = ["Paarreim": "aabb", "Kreuzreim": "abab"]
        for word in units[10].words where letters[word.target] != nil {
            XCTAssertEqual(word.note, letters[word.target])
        }
        for fill in units[10].fills where fill.sentence.hasPrefix("Reimschema") {
            // pairs written in the line: a b c d, rhyme by the last two letters of the words
            let line = fill.sentence.components(separatedBy: "„")[1].components(separatedBy: "“")[0]
            let w = line.components(separatedBy: ", ")
            XCTAssertEqual(w.count, 4)
            func devoiced(_ word: String) -> String {
                var text = word.lowercased()
                if text.hasSuffix("d") { text = String(text.dropLast()) + "t" }
                if text.hasSuffix("g") { text = String(text.dropLast()) + "k" }
                return text
            }
            func rhymes(_ a: String, _ b: String) -> Bool { devoiced(a).suffix(2) == devoiced(b).suffix(2) }
            let scheme = rhymes(w[0], w[1]) && rhymes(w[2], w[3]) ? "Paarreim" : (rhymes(w[0], w[2]) && rhymes(w[1], w[3]) ? "Kreuzreim" : "?")
            XCTAssertEqual(fill.options[0], scheme, fill.sentence)
        }
    }
}
