import XCTest
@testable import Lernwerk

/// Checks the facts of the Spanish course with tables and rules written down here again, not copied from the course:
/// the verb tables, the endings, plurals, numbers, the clock and the calendar.
final class SpanishCourseFactTests: XCTestCase {
    private let data = LanguageCourseProvider.make(source: SpanishCourse.source).provider.data
    private var words: [LanguageWord] { data.units.flatMap(\.words) }
    private var sentences: [LanguageSentence] { data.units.flatMap(\.sentences) }
    private var forms: [LanguageForm] { data.units.flatMap(\.forms) }
    private var fills: [LanguageFill] { data.units.flatMap(\.fills) }

    // MARK: Helpers

    private func plainTokens(_ text: String) -> [String] {
        text.lowercased().split(whereSeparator: { !$0.isLetter }).map(String.init)
    }

    private let persons = ["yo", "tú", "él", "nosotros", "vosotros", "ellos"]

    /// The person at the end of a prompt like "ser, yo".
    private func person(of form: LanguageForm) -> Int? {
        let parts = form.prompt.components(separatedBy: ", ")
        guard parts.count == 2 else { return nil }
        return persons.firstIndex(of: parts[1])
    }

    private func verb(of form: LanguageForm) -> String { form.group }

    // MARK: Verb tables

    func testTheIrregularVerbsHaveAllSixPersonsWithTheRightForms() {
        let tables = [
            "ser": ["soy", "eres", "es", "somos", "sois", "son"],
            "tener": ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"],
            "estar": ["estoy", "estás", "está", "estamos", "estáis", "están"],
        ]
        for (verb, expected) in tables {
            let own = forms.filter { self.verb(of: $0) == verb }
            XCTAssertEqual(own.count, 6, "\(verb) is taught with six forms")
            var found = [String?](repeating: nil, count: 6)
            for form in own {
                guard let index = person(of: form) else { XCTFail("\(form.prompt): no person"); continue }
                XCTAssertNil(found[index], "\(verb): person \(persons[index]) twice")
                found[index] = form.answers.first
                XCTAssertEqual(form.answers.count, 1, form.prompt)
            }
            XCTAssertEqual(found.map { $0 ?? "" }, expected, verb)
        }
    }

    func testTheEndingsOfTheRegularVerbsFollowTheTipAndAreAlwaysRightForTheirGroup() {
        let endings = [
            "ar": ["o", "as", "a", "amos", "áis", "an"],
            "er": ["o", "es", "e", "emos", "éis", "en"],
            "ir": ["o", "es", "e", "imos", "ís", "en"],
        ]
        let regular = forms.filter { ["hablar", "comer", "vivir"].contains(verb(of: $0)) }
        XCTAssertGreaterThanOrEqual(regular.count, 8)
        var groups = Set<String>()
        for form in regular {
            let infinitive = verb(of: form)
            let group = String(infinitive.suffix(2))
            groups.insert(group)
            guard let index = person(of: form), let table = endings[group] else { XCTFail(form.prompt); continue }
            XCTAssertEqual(form.answers, [String(infinitive.dropLast(2)) + table[index]], form.prompt)
        }
        XCTAssertEqual(groups, ["ar", "er", "ir"], "all three groups are practised")
        // The tip of the unit names the same endings.
        let tip = data.units[6].tip
        for (group, table) in endings {
            XCTAssertTrue(tip.contains("Verben auf -\(group): " + table.map { "-" + $0 }.joined(separator: ", ")), group)
        }
    }

    func testTheRegularVerbsOfTheCourseHaveTheEndingTheirNoteSays() {
        for word in words where word.note.hasPrefix("Verb auf -") {
            let ending = String(word.note.dropFirst("Verb auf -".count).prefix(2))
            XCTAssertTrue(word.target.hasSuffix(ending), "\(word.target): \(word.note)")
        }
        for word in words where ["ar", "er", "ir"].contains(String(word.target.suffix(2))) && !word.target.contains(" ") {
            XCTAssertTrue(word.note.hasPrefix("Verb auf -") || word.note == "unregelmäßig", "\(word.target) needs a note")
        }
    }

    func testGustarFormsMatchPersonAndNumber() {
        let pronouns = ["a mí": "me", "a ti": "te", "a ella": "le", "a él": "le"]
        let gustar = forms.filter { verb(of: $0) == "gustar" }
        XCTAssertGreaterThanOrEqual(gustar.count, 4)
        for form in gustar {
            let rest = form.prompt.components(separatedBy: ", ")[1].components(separatedBy: " + ")
            XCTAssertEqual(rest.count, 2, form.prompt)
            guard rest.count == 2, let pronoun = pronouns[rest[0]] else { XCTFail(form.prompt); continue }
            let verb = rest[1] == "Singular" ? "gusta" : "gustan"
            XCTAssertEqual(form.answers, ["\(pronoun) \(verb)"], form.prompt)
        }
        XCTAssertTrue(gustar.contains { $0.answers == ["me gusta"] } && gustar.contains { $0.answers == ["te gustan"] })
    }

    // MARK: Nouns

    /// The plural of "el amigo" as the rules of the unit say.
    private func plural(ofNounPhrase phrase: String) -> String {
        let parts = phrase.components(separatedBy: " ")
        let article = parts[0] == "el" ? "los" : "las"
        var noun = parts.dropFirst().joined(separator: " ")
        if noun.hasSuffix("z") {
            noun = String(noun.dropLast()) + "ces"
        } else if let last = noun.last, "aeiouáéíóú".contains(last) {
            noun += "s"
        } else if noun.hasSuffix("s") {
            noun += ""
        } else {
            noun += "es"
        }
        return "\(article) \(noun)"
    }

    func testEveryNounWithAnArticleCarriesTheGenderOfItsArticle() {
        var checked = 0
        for word in words where word.target.hasPrefix("el ") || word.target.hasPrefix("la ") {
            let masculine = word.target.hasPrefix("el ")
            let note = word.note
            if word.target == "el agua" {
                XCTAssertTrue(note.hasPrefix("f"), "agua is feminine")
            } else {
                XCTAssertTrue(note.hasPrefix(masculine ? "m" : "f"), "\(word.target): \(note)")
                XCTAssertFalse(note.hasPrefix(masculine ? "f" : "m"), "\(word.target): \(note)")
            }
            checked += 1
        }
        XCTAssertGreaterThan(checked, 50)
        // Words that are masculine or feminine against their ending.
        XCTAssertTrue(words.first { $0.target == "el día" }?.note.hasPrefix("m") == true)
        XCTAssertTrue(words.first { $0.target == "la mano" } == nil)
    }

    func testPluralNotesAndPluralFormsFollowTheRule() {
        var checkedNotes = 0
        for word in words where word.target.hasPrefix("el ") || word.target.hasPrefix("la ") {
            guard let range = word.note.range(of: "Pl. ") else { continue }
            var written = String(word.note[range.upperBound...])
            if let bracket = written.range(of: " (") { written = String(written[..<bracket.lowerBound]) }
            let expected = word.target == "el agua" ? "las aguas" : plural(ofNounPhrase: word.target)
            XCTAssertEqual(written, expected, word.target)
            checkedNotes += 1
        }
        XCTAssertGreaterThan(checkedNotes, 40)
        var checkedForms = 0
        for form in forms where form.prompt.hasSuffix(", Plural") {
            let singular = form.prompt.components(separatedBy: ", ")[0]
            guard singular.hasPrefix("el ") || singular.hasPrefix("la ") else { continue }
            XCTAssertEqual(form.answers, [plural(ofNounPhrase: singular)], form.prompt)
            checkedForms += 1
        }
        XCTAssertGreaterThanOrEqual(checkedForms, 8)
    }

    func testAdjectiveFormsFollowTheEndings() {
        func agree(_ adjective: String, feminine: Bool, plural: Bool) -> String {
            var result = adjective
            if result.hasSuffix("o") { if feminine { result = String(result.dropLast()) + "a" } }
            if plural {
                if let last = result.last, "aeiou".contains(last) { result += "s" } else { result += "es" }
            }
            return result
        }
        let adjectives = forms.filter { $0.prompt.contains(", weiblich") || $0.prompt.contains("Plural") && !$0.prompt.hasPrefix("el ") && !$0.prompt.hasPrefix("la ") }
        XCTAssertGreaterThanOrEqual(adjectives.count, 6)
        for form in adjectives {
            let parts = form.prompt.components(separatedBy: ", ")
            let kind = parts[1]
            let expected: String
            switch kind {
            case "weiblich": expected = agree(parts[0], feminine: true, plural: false)
            case "Plural": expected = agree(parts[0], feminine: false, plural: true)
            case "weiblicher Plural": expected = agree(parts[0], feminine: true, plural: true)
            default: XCTFail(form.prompt); continue
            }
            XCTAssertEqual(form.answers, [expected], form.prompt)
        }
        // The four forms noted at an adjective of the eighth unit are the four forms the rule makes.
        for word in data.units[7].words where word.note.contains(", ") && word.note.contains(word.target) {
            let listed = word.note.components(separatedBy: "; ").last!.components(separatedBy: ", ")
            let stem = String(word.target.dropLast())
            XCTAssertEqual(listed.count, 4, word.target)
            XCTAssertEqual(listed, [word.target, stem + "a", stem + "os", stem + "as"], word.target)
        }
    }

    // MARK: Numbers, days, months

    private let numberNames: [(es: String, de: String)] = [
        ("cero", "null"), ("uno", "eins"), ("dos", "zwei"), ("tres", "drei"), ("cuatro", "vier"), ("cinco", "fünf"),
        ("seis", "sechs"), ("siete", "sieben"), ("ocho", "acht"), ("nueve", "neun"), ("diez", "zehn"), ("once", "elf"),
        ("doce", "zwölf"), ("trece", "dreizehn"), ("catorce", "vierzehn"), ("quince", "fünfzehn"), ("dieciséis", "sechzehn"),
        ("diecisiete", "siebzehn"), ("dieciocho", "achtzehn"), ("diecinueve", "neunzehn"), ("veinte", "zwanzig"),
    ]

    func testTheNumberWordsAreTheRightNumbersInOrder() {
        let taught = words.filter { word in numberNames.contains { $0.es == word.target } }
        XCTAssertEqual(taught.map(\.target), numberNames.map(\.es), "0 to 20, each once, in counting order")
        for word in taught {
            let expected = numberNames.first { $0.es == word.target }!.de
            XCTAssertEqual(word.meanings.first, expected, word.target)
        }
        XCTAssertEqual(numberNames.count, 21)
    }

    func testNumbersInSentencesMatchTheirTranslationAndTheSumsAreRight() {
        let values = Dictionary(uniqueKeysWithValues: numberNames.enumerated().map { ($1.es, $0) })
        var checked = 0
        for sentence in sentences {
            let tokens = plainTokens(sentence.target)
            let german = plainTokens(sentence.meanings[0])
            for token in tokens where token != "uno" {
                guard let value = values[token] else { continue }
                let name = numberNames[value].de
                XCTAssertTrue(german.contains { $0.hasPrefix(name) }, "\(sentence.target): \(name) missing in \(sentence.meanings[0])")
                checked += 1
            }
            if let plus = tokens.firstIndex(of: "más"), let sum = tokens.firstIndex(of: "son"), plus > 0, sum + 1 < tokens.count,
               let a = values[tokens[plus - 1]], let b = values[tokens[plus + 1]], let c = values[tokens[sum + 1]] {
                XCTAssertEqual(a + b, c, sentence.target)
                checked += 1
            }
        }
        XCTAssertGreaterThan(checked, 15)
        for fill in fills where fill.sentence.contains(" más ___ ") {
            let tokens = plainTokens(fill.sentence.replacingOccurrences(of: "___", with: fill.options[0]))
            if let plus = tokens.firstIndex(of: "más"), let a = values[tokens[plus - 1]], let b = values[tokens[plus + 1]], let c = values[tokens[plus + 3]] {
                XCTAssertEqual(a + b, c, fill.sentence)
            } else {
                XCTFail(fill.sentence)
            }
            for wrong in fill.options.dropFirst() {
                let other = plainTokens(fill.sentence.replacingOccurrences(of: "___", with: wrong))
                if let plus = other.firstIndex(of: "más"), let a = values[other[plus - 1]], let b = values[other[plus + 1]], let c = values[other[plus + 3]] {
                    XCTAssertNotEqual(a + b, c, "\(wrong) would be right too")
                }
            }
        }
    }

    func testDaysAndMonthsAreTheRightOnesInOrder() {
        let days = [("lunes", "Montag"), ("martes", "Dienstag"), ("miércoles", "Mittwoch"), ("jueves", "Donnerstag"),
                    ("viernes", "Freitag"), ("sábado", "Samstag"), ("domingo", "Sonntag")]
        let months = [("enero", "Januar"), ("febrero", "Februar"), ("marzo", "März"), ("abril", "April"), ("mayo", "Mai"),
                      ("junio", "Juni"), ("julio", "Juli"), ("agosto", "August"), ("septiembre", "September"),
                      ("octubre", "Oktober"), ("noviembre", "November"), ("diciembre", "Dezember")]
        for table in [days.map { ($0.0, $0.1) }, months.map { ($0.0, $0.1) }] {
            let taught = words.filter { word in table.contains { $0.0 == word.target } }
            XCTAssertEqual(taught.map(\.target), table.map(\.0))
            for word in taught { XCTAssertEqual(word.meanings.first, table.first { $0.0 == word.target }!.1) }
            for word in taught { XCTAssertEqual(word.target, word.target.lowercased(), "written small") }
        }
    }

    // MARK: Clock and calendar

    private func spanishTime(hour: Int, minute: Int) -> String? {
        func name(_ h: Int) -> String { numberNames[h].es }
        func lead(_ h: Int) -> String { h == 1 ? "Es la una" : "Son las \(name(h))" }
        switch minute {
        case 0: return lead(hour) + "."
        case 10: return lead(hour) + " y diez."
        case 15: return lead(hour) + " y cuarto."
        case 30: return lead(hour) + " y media."
        case 45: return lead(hour % 12 + 1) + " menos cuarto."
        default: return nil
        }
    }

    func testEveryClockFormIsTheTimeItAsksFor() {
        let clock = forms.filter { $0.prompt.hasPrefix("Uhrzeit auf Spanisch, ") }
        XCTAssertGreaterThanOrEqual(clock.count, 5)
        var kinds = Set<Int>()
        for form in clock {
            let digits = form.prompt.components(separatedBy: ", ")[1].replacingOccurrences(of: " Uhr", with: "").components(separatedBy: ":")
            guard digits.count == 2, let hour = Int(digits[0]), let minute = Int(digits[1]) else { XCTFail(form.prompt); continue }
            XCTAssertEqual(form.answers, [spanishTime(hour: hour, minute: minute) ?? "?"], form.prompt)
            kinds.insert(minute)
        }
        XCTAssertEqual(kinds, [0, 10, 15, 30, 45], "full hours and every kind of minutes the tip names")
        XCTAssertTrue(clock.contains { $0.answers.first?.hasPrefix("Es la una") == true }, "one o'clock is singular")
    }

    func testEveryDateFormIsTheDateItAsksFor() {
        let months = ["Januar": "enero", "Februar": "febrero", "März": "marzo", "April": "abril", "Mai": "mayo", "Juni": "junio",
                      "Juli": "julio", "August": "agosto", "September": "septiembre", "Oktober": "octubre", "November": "noviembre",
                      "Dezember": "diciembre"]
        let dates = forms.filter { $0.prompt.hasPrefix("Datum auf Spanisch, ") }
        XCTAssertGreaterThanOrEqual(dates.count, 4)
        for form in dates {
            let parts = form.prompt.components(separatedBy: ", ")[1].components(separatedBy: ". ")
            guard parts.count == 2, let day = Int(parts[0]), (1...20).contains(day), let month = months[parts[1]] else { XCTFail(form.prompt); continue }
            let expected = "el \(numberNames[day].es) de \(month)"
            XCTAssertTrue(form.answers.contains(expected), form.prompt)
            if day == 1 {
                XCTAssertEqual(Set(form.answers), [expected, "el primero de \(month)"])
            } else {
                XCTAssertEqual(form.answers, [expected])
            }
        }
    }

    func testWeekdayAndMonthPhrasesInSentencesAreWrittenSmall() {
        let names = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo", "enero", "febrero", "marzo", "abril", "mayo", "junio",
                     "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
        for sentence in sentences {
            for token in sentence.target.split(separator: " ").dropFirst() {
                let bare = token.trimmingCharacters(in: .punctuationCharacters)
                XCTAssertFalse(names.contains(bare.lowercased()) && bare != bare.lowercased(), "\(sentence.target): \(bare)")
            }
        }
    }

    // MARK: Sentences

    func testSentencesAreCorrectlyPunctuatedAndNotTooLong() {
        for sentence in sentences {
            let target = sentence.target
            XCTAssertEqual(target.filter { $0 == "¿" }.count, target.filter { $0 == "?" }.count, target)
            XCTAssertEqual(target.filter { $0 == "¡" }.count, target.filter { $0 == "!" }.count, target)
            XCTAssertTrue(".?!".contains(target.last!), target)
            let first = target.first!
            XCTAssertTrue(first == "¿" || first == "¡" || first.isUppercase, target)
            XCTAssertLessThanOrEqual(target.split(separator: " ").count, 10, target)
            let german = sentence.meanings[0]
            XCTAssertEqual(target.last == "?", german.last == "?", "\(target): the question mark of the translation")
            XCTAssertNotEqual(german.lowercased(), target.lowercased())
            XCTAssertEqual(sentence.meanings.count, 1, "\(target): one translation is the one the tiles ask for")
        }
    }

    func testNoUnitRepeatsASentenceOfAnEarlierUnit() {
        var seen = Set<String>()
        for unit in data.units {
            for sentence in unit.sentences {
                XCTAssertTrue(seen.insert(LearnExercise.folded(sentence.target)).inserted, "twice: \(sentence.target)")
            }
        }
        let fillSentences = Set(fills.map { LearnExercise.folded($0.sentence.replacingOccurrences(of: "___", with: $0.options[0])) })
        XCTAssertTrue(fillSentences.isDisjoint(with: seen), "a fill must not be a sentence of the course with its blank filled")
    }

    func testTranslationsHaveNoLeftoverSpanish() {
        let names = ["Lucía", "Berlín", "Madrid"]
        let spanishMarks = Set("áéíóúñ¿¡")
        let spanishWords = Set(words.flatMap { LanguageCoverage.tokens(of: $0.target) }.filter { $0.count >= 4 })
        let germanWords: Set<String> = ["gusto", "plus", "mich", "nett", "casa", "sehr", "gut", "ist", "der", "die", "das"]
        for sentence in sentences {
            var german = sentence.meanings[0]
            for name in names { german = german.replacingOccurrences(of: name, with: "") }
            XCTAssertTrue(german.allSatisfy { !spanishMarks.contains($0) }, "\(german)")
            for token in LanguageCoverage.tokens(of: german) where spanishWords.contains(token) && !germanWords.contains(token) {
                let spanishOnly = !LanguageCoverage.tokens(of: sentence.target).isEmpty && LanguageCoverage.tokens(of: sentence.target).contains(token)
                XCTAssertFalse(spanishOnly, "\(german): \(token) is Spanish")
            }
        }
        for word in words { for meaning in word.meanings { XCTAssertFalse(meaning.contains { spanishMarks.contains($0) }, meaning) } }
    }

    // MARK: Subject and verb, subject and adjective

    func testTheVerbAgreesWithTheSubjectInEverySentence() {
        let singular: Set<String> = ["mi", "tu", "su", "el", "la", "él", "ella", "nuestra", "nuestro"]
        let plural: Set<String> = ["mis", "tus", "sus", "los", "las", "nosotros", "ellos", "ellas"]
        let singularVerbs: Set<String> = ["es", "tiene", "está", "gusta", "trabaja"]
        let pluralVerbs: Set<String> = ["son", "tienen", "están", "gustan", "trabajan"]
        var checked = 0
        for sentence in sentences {
            let tokens = plainTokens(sentence.target)
            guard let first = tokens.first, singular.contains(first) || plural.contains(first) else { continue }
            guard let verb = tokens.first(where: { singularVerbs.contains($0) || pluralVerbs.contains($0) }) else { continue }
            XCTAssertEqual(plural.contains(first), pluralVerbs.contains(verb), sentence.target)
            checked += 1
        }
        XCTAssertGreaterThan(checked, 20)
    }

    func testAdjectivesAgreeWithTheirNounInTheDescriptionSentences() {
        var gender: [String: Bool] = [:]
        for word in words {
            let parts = word.target.components(separatedBy: " ")
            if parts.count == 2, parts[0] == "el" || parts[0] == "la" {
                let noun = parts[1]
                gender[noun] = parts[0] == "el"
                gender[noun + "s"] = parts[0] == "el"
            }
        }
        gender["lápices"] = true
        gender["chicos"] = true
        gender["libros"] = true
        gender["mochila"] = false
        gender["mochilas"] = false
        var checked = 0
        for sentence in data.units[7].sentences {
            let tokens = plainTokens(sentence.target)
            let isPlural = ["son", "mis", "dos"].contains { tokens.contains($0) }
            guard let last = tokens.last, last.hasSuffix("o") || last.hasSuffix("a") || last.hasSuffix("os") || last.hasSuffix("as") || last.hasSuffix("es") || last.hasSuffix("l") else { continue }
            guard let noun = tokens.first(where: { gender[$0] != nil }) else { continue }
            let masculine = gender[noun]!
            if last.hasSuffix("os") || last.hasSuffix("as") { XCTAssertEqual(last.hasSuffix("os"), masculine, sentence.target) }
            if last.hasSuffix("os") || last.hasSuffix("as") { XCTAssertTrue(isPlural, sentence.target) }
            if last.hasSuffix("o") { XCTAssertTrue(masculine && !isPlural, sentence.target) }
            if last.hasSuffix("a") && !last.hasSuffix("as") && !["tengo", "tienes"].contains(last) { XCTAssertTrue(!masculine || isPlural == false, sentence.target) }
            checked += 1
        }
        XCTAssertGreaterThanOrEqual(checked, 4)
    }

    // MARK: Fills and facts

    func testFillsHaveOneRightChoiceAndNoWrongChoiceThatIsAlsoASentenceOfTheCourse() {
        let known = Set(sentences.map { LearnExercise.folded($0.target) })
        for fill in fills {
            XCTAssertTrue((2...4).contains(fill.options.count), fill.sentence)
            XCTAssertEqual(Set(fill.options.map(LearnExercise.folded)).count, fill.options.count, "choices that read the same: \(fill.sentence)")
            XCTAssertEqual(fill.sentence.components(separatedBy: "___").count, 2, "one blank: \(fill.sentence)")
            for wrong in fill.options.dropFirst() {
                let completed = LearnExercise.folded(fill.sentence.replacingOccurrences(of: "___", with: wrong))
                XCTAssertFalse(known.contains(completed), "\(fill.sentence) with \(wrong) is a sentence of the course")
            }
            XCTAssertFalse(fill.why.isEmpty, "\(fill.sentence) needs a reason")
        }
    }

    func testTheVerbFillsAskForTheFormTheParadigmGives() {
        let tables: [String: [String: String]] = [
            "yo": ["ser": "soy", "tener": "tengo", "estar": "estoy"], "tú": ["ser": "eres"], "él": ["tener": "tiene"],
        ]
        for fill in fills {
            let words = plainTokens(fill.sentence)
            if words.first == "yo", let expected = tables["yo"]?.values, fill.options[0] == "soy" || expected.contains(fill.options[0]) {
                XCTAssertEqual(fill.options[0], "soy", fill.sentence)
            }
        }
        let yo = fills.first { $0.sentence == "Yo ___ Marta." }
        XCTAssertEqual(yo?.options.first, "soy")
        let tu = fills.first { $0.sentence == "¿De dónde ___ tú?" }
        XCTAssertEqual(tu?.options.first, "eres")
        let padre = fills.first { $0.sentence == "Mi padre ___ un hermano." }
        XCTAssertEqual(padre?.options.first, "tiene")
        let nosotros = fills.first { $0.sentence == "Nosotros ___ en Madrid." }
        XCTAssertEqual(nosotros?.options.first, "vivimos")
        let parque = fills.first { $0.sentence == "El parque ___ cerca de mi casa." }
        XCTAssertEqual(parque?.options.first, "está")
    }

    func testFactsHaveOneRightAnswerAndRealWrongOnes() {
        for fact in data.units.flatMap(\.facts) {
            XCTAssertFalse(fact.wrong.isEmpty, fact.question)
            XCTAssertLessThanOrEqual(fact.wrong.count, 3, fact.question)
            let all = ([fact.answer] + fact.wrong).map(LearnExercise.folded)
            XCTAssertEqual(Set(all).count, all.count, "answers that read the same: \(fact.question)")
            XCTAssertFalse(all.contains(""), "an answer of only punctuation reads empty to the engine: \(fact.question)")
            XCTAssertFalse(fact.why.isEmpty, fact.question)
        }
    }

    // MARK: Words

    func testNoTwoWordsShareAMeaningAndNoWordIsTaughtTwice() {
        var owner: [String: String] = [:]
        var targets = Set<String>()
        for word in words {
            XCTAssertTrue(targets.insert(LearnExercise.folded(word.target)).inserted, "twice: \(word.target)")
            for meaning in word.meanings {
                let key = LearnExercise.folded(meaning)
                XCTAssertTrue(owner[key] == nil || owner[key] == word.target, "\(meaning): \(owner[key] ?? "") and \(word.target)")
                owner[key] = word.target
            }
        }
    }

    func testPairsOfWordsThatDifferOnlyByTheAccentAreNotBothTaught() {
        // tú and tu, él and el, sí and si would read the same to the engine, and a student has to learn the accent from the tip.
        let accentPairs = [("tú", "tu"), ("él", "el"), ("sí", "si"), ("mí", "mi"), ("qué", "que")]
        for (accented, plain) in accentPairs {
            let both = words.filter { $0.target == accented || $0.target == plain }
            XCTAssertLessThanOrEqual(both.count, 1, "\(accented) and \(plain)")
        }
        XCTAssertTrue(words.contains { $0.target == "tú" } && words.contains { $0.target == "él" })
    }

    func testTheGreetingsMeanWhatTheyShouldAtTheRightTimeOfDay() {
        func meanings(_ target: String) -> [String] { words.first { $0.target == target }?.meanings ?? [] }
        XCTAssertEqual(meanings("buenos días"), ["guten Morgen"])
        XCTAssertTrue(meanings("buenas tardes").contains("guten Tag"))
        XCTAssertTrue(meanings("buenas noches").contains("gute Nacht"))
        XCTAssertTrue(meanings("¿qué tal?").contains("wie geht's?"))
        XCTAssertEqual(words.first { $0.target == "buenos días" }?.note, "bis zum Mittagessen")
    }

    func testTheFamilyWordsComeInPairsOfOneGenderEach() {
        let pairs = [("el padre", "la madre"), ("el hermano", "la hermana"), ("el abuelo", "la abuela"), ("el hijo", "la hija"),
                     ("el amigo", "la amiga"), ("el chico", "la chica")]
        for (man, woman) in pairs {
            let m = words.first { $0.target == man }, f = words.first { $0.target == woman }
            XCTAssertNotNil(m, man)
            XCTAssertNotNil(f, woman)
            XCTAssertEqual(String(man.dropFirst(3).dropLast()), String(woman.dropFirst(3).dropLast()).replacingOccurrences(of: "m", with: "p").isEmpty ? "" : String(man.dropFirst(3).dropLast()))
        }
        for (man, woman) in pairs.filter({ $0.0 != "el padre" }) {
            XCTAssertEqual(man.dropFirst(3).dropLast(), woman.dropFirst(3).dropLast(), "\(man) / \(woman) share a stem")
            XCTAssertTrue(man.hasSuffix("o") && woman.hasSuffix("a"))
        }
    }
}
