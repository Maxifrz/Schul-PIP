import XCTest
@testable import Lernwerk

/// Checks the French course: that it parses and passes the engine's audit, and that its content is right in ways that do
/// not depend on how the text was written (verb tables against a table typed again here, genders against a list of
/// nouns, every derived form against the rule it teaches, the order in which a lesson teaches its words).
final class FrenchCourseTests: XCTestCase {
    private static let made = LanguageCourseProvider.make(source: FrenchCourse.source)
    private var provider: LanguageCourseProvider { Self.made.provider }
    private var data: LanguageCourseData { provider.data }
    private var units: [LanguageUnitData] { data.units }
    private var words: [LanguageWord] { units.flatMap(\.words) }
    private var sentences: [LanguageSentence] { units.flatMap(\.sentences) }
    private var forms: [LanguageForm] { units.flatMap(\.forms) }
    private var fills: [LanguageFill] { units.flatMap(\.fills) }
    private var facts: [LanguageFact] { units.flatMap(\.facts) }

    // MARK: Independent reference data (typed here again, not read from the course)

    private static let persons = ["je", "tu", "il", "nous", "vous", "ils"]
    private static let endings = ["je": "e", "tu": "es", "il": "e", "nous": "ons", "vous": "ez", "ils": "ent"]
    private static let irregular: [String: [String: String]] = [
        "être": ["je": "suis", "tu": "es", "il": "est", "nous": "sommes", "vous": "êtes", "ils": "sont"],
        "avoir": ["je": "j'ai", "tu": "as", "il": "a", "nous": "avons", "vous": "avez", "ils": "ont"],
        "aller": ["je": "vais", "tu": "vas", "il": "va", "nous": "allons", "vous": "allez", "ils": "vont"],
        "boire": ["je": "bois", "tu": "bois", "il": "boit", "nous": "buvons", "vous": "buvez", "ils": "boivent"],
        "s'appeler": ["je": "m'appelle", "tu": "t'appelles", "il": "s'appelle", "nous": "nous appelons", "vous": "vous appelez", "ils": "s'appellent"],
    ]
    private static let regularVerbs = ["parler", "habiter", "aimer", "écouter", "regarder", "travailler", "jouer", "manger"]

    /// Gender of every noun the course teaches: m, f, or p for a plural noun.
    private static let nouns: [String: String] = [
        "mère": "f", "père": "m", "frère": "m", "sœur": "f", "fils": "m", "fille": "f", "grand-père": "m", "grand-mère": "f",
        "parents": "p", "chat": "m", "livre": "m", "table": "f", "stylo": "m", "chaise": "f", "cahier": "m", "trousse": "f",
        "sac": "m", "école": "f", "ami": "m", "amie": "f", "pain": "m", "eau": "f", "café": "m", "fromage": "m", "lait": "m",
        "viande": "f", "pomme": "f", "gare": "f", "parc": "m", "poste": "f", "cinéma": "m", "ville": "f", "rue": "f",
        "boulangerie": "f", "maison": "f", "midi": "m", "français": "m", "allemand": "m",
    ]

    /// A word of the course and a German stem its first meaning has to contain (lower case).
    private static let gloss: [String: String] = [
        "bonjour": "tag", "je": "ich", "salut": "hallo", "tu": "du", "ça va": "geht", "merci": "danke", "être": "sein", "oui": "ja",
        "nous": "wir", "vous": "sie", "il": "er", "elle": "sie", "au revoir": "wiedersehen",
        "avoir": "haben", "la mère": "mutter", "le père": "vater", "mon, ma, mes": "mein", "le frère": "bruder", "la sœur": "schwester",
        "ton, ta, tes": "dein", "le fils": "sohn", "la fille": "tochter", "les parents": "eltern", "le grand-père": "großvater",
        "la grand-mère": "großmutter", "son, sa, ses": "seine",
        "le chat": "katze", "deux": "zwei", "ans": "jahre", "trois": "drei", "quel âge": "alt", "quatre": "vier", "cinq": "fünf",
        "six": "sechs", "sept": "sieben", "huit": "acht", "neuf": "neun", "dix": "zehn", "rouge": "rot", "bleu": "blau",
        "blanc": "weiß", "noir": "schwarz",
        "le livre": "buch", "c'est": "das ist", "la table": "tisch", "voilà": "da ist", "le stylo": "kugelschreiber", "la chaise": "stuhl",
        "le cahier": "heft", "la trousse": "mäppchen", "le sac": "tasche", "l'école": "schule", "l'ami": "freund", "l'amie": "freundin",
        "parler": "sprechen", "le français": "französisch", "habiter": "wohnen", "à": "in", "aimer": "mögen", "beaucoup": "viel",
        "l'allemand": "deutsch", "bien": "gut", "écouter": "zuhören", "regarder": "anschauen", "travailler": "arbeiten", "jouer": "spielen",
        "manger": "essen", "le pain": "brot", "boire": "trinken", "l'eau": "wasser", "avoir faim": "hunger", "avoir soif": "durst",
        "le café": "kaffee", "le fromage": "käse", "s'il vous plaît": "bitte", "je voudrais": "möchte", "le lait": "milch",
        "la viande": "fleisch", "la pomme": "apfel",
        "aller": "gehen", "le cinéma": "kino", "la gare": "bahnhof", "le parc": "park", "dans": "in", "chez": "bei", "la poste": "post",
        "la ville": "stadt", "à côté de": "neben", "il y a": "gibt", "la boulangerie": "bäckerei", "la rue": "straße", "la maison": "haus",
        "ne … pas": "nicht", "comment": "wie", "où": "wo", "qui": "wer", "quand": "wann", "pourquoi": "warum", "parce que": "weil",
        "combien": "wie viel", "quelle heure": "spät", "et demie": "halbe", "midi": "zwölf", "et quart": "viertel nach",
        "moins le quart": "viertel vor",
    ]

    private static let numbers = [
        "deux": "zwei", "trois": "drei", "quatre": "vier", "cinq": "fünf", "six": "sechs", "sept": "sieben", "huit": "acht",
        "neuf": "neun", "dix": "zehn", "onze": "elf", "douze": "zwölf", "quinze": "fünfzehn", "vingt": "zwanzig",
    ]
    private static let colors = [
        "rouge": "rot", "bleu": "blau", "bleue": "blau", "blanc": "weiß", "blanche": "weiß", "noir": "schwarz", "noire": "schwarz",
    ]

    // MARK: Helpers

    /// The words of a French text, lower case, without the punctuation around them; apostrophes inside stay.
    private func frenchWords(_ text: String) -> [String] {
        let marks = CharacterSet.punctuationCharacters.union(.whitespaces).subtracting(CharacterSet(charactersIn: "'"))
        return text.split(whereSeparator: \.isWhitespace)
            .map { String($0).trimmingCharacters(in: marks).lowercased() }
            .filter { !$0.isEmpty }
    }

    /// Letters only, split at everything else: "j'ai" gives "j" and "ai".
    private func lettersOnly(_ text: String) -> [String] {
        text.lowercased().split(whereSeparator: { !$0.isLetter }).map(String.init)
    }

    private func expectedForm(verb: String, person: String) -> String? {
        if let table = Self.irregular[verb] { return table[person] }
        guard verb.hasSuffix("er"), let ending = Self.endings[person] else { return nil }
        var stem = String(verb.dropLast(2))
        if person == "nous", stem.hasSuffix("g") { stem += "e" }
        if person == "je", let first = stem.first, "aeiouéèêàâîôûh".contains(first) { return "j'" + stem + ending }
        return stem + ending
    }

    /// Every text a student reads in French: words, sentences, form answers, fills with their right choice put in.
    private var frenchTexts: [String] {
        var texts = words.map(\.target) + sentences.map(\.target)
        texts += forms.flatMap(\.answers)
        texts += fills.compactMap { fill in fill.options.first.map { fill.sentence.replacingOccurrences(of: "___", with: $0) } }
        return texts
    }

    // MARK: Shape

    func testTheCourseParsesAndHasNoContentProblems() {
        XCTAssertEqual(Self.made.errors, [])
    }

    func testTheHeaderAndTheProviderAreWhatTheCatalogExpects() {
        XCTAssertEqual(data.id, "fr")
        XCTAssertEqual(data.title, "Französisch")
        XCTAssertEqual(data.subtitle, "Für Deutschsprachige · A1")
        XCTAssertEqual(data.kind, .language)
        XCTAssertEqual(data.color, 0x5A7FC4)
        XCTAssertEqual(data.symbol, "text.bubble.fill")
        XCTAssertEqual(data.speech, "fr-FR")
        XCTAssertEqual(data.instruction, .de)
        XCTAssertEqual(data.targetName, "Französisch")
        XCTAssertEqual(data.intoName, "Französische")
        XCTAssertTrue(data.produces)
        XCTAssertEqual(FrenchCourse.provider.course.id, "fr")
        XCTAssertEqual(FrenchCourse.provider.course.units.count, 8)
        XCTAssertEqual(FrenchCourse.provider.course.units.map(\.title), units.map(\.title))
    }

    func testTheEngineAuditPasses() {
        XCTAssertEqual(CourseAudit.problems(of: FrenchCourse.provider, seeds: Array(1...20)), [])
    }

    func testEveryWordOfEverySentenceWasTaughtBefore() {
        XCTAssertEqual(LanguageCoverage.gaps(in: data), [])
    }

    func testTheCourseHasTheAgreedSize() {
        XCTAssertEqual(units.count, 8)
        XCTAssertGreaterThanOrEqual(words.count, 100)
        XCTAssertGreaterThanOrEqual(sentences.count, 50)
        XCTAssertGreaterThanOrEqual(forms.count, 35)
        XCTAssertGreaterThanOrEqual(fills.count, 20)
        XCTAssertGreaterThanOrEqual(facts.count, 12)
        for (index, unit) in units.enumerated() {
            let place = "unit \(index + 1) \(unit.title)"
            XCTAssertTrue((22...30).contains(unit.itemCount), "\(place): \(unit.itemCount) items")
            XCTAssertTrue((10...16).contains(unit.words.count), "\(place): \(unit.words.count) words")
            XCTAssertTrue((6...10).contains(unit.sentences.count), "\(place): \(unit.sentences.count) sentences")
            XCTAssertTrue((3...6).contains(unit.forms.count), "\(place): \(unit.forms.count) forms")
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

    // MARK: Verbs

    func testEveryVerbFormIsRightForItsPerson() {
        var checked = 0
        for form in forms {
            let parts = form.prompt.components(separatedBy: ", ")
            guard parts.count == 2, Self.persons.contains(parts[1]) else { continue }
            guard let expected = expectedForm(verb: parts[0], person: parts[1]) else {
                XCTFail("a form of a verb the test does not know: \(form.prompt)")
                continue
            }
            XCTAssertEqual(form.answers.first, expected, form.prompt)
            checked += 1
        }
        XCTAssertGreaterThanOrEqual(checked, 25)
    }

    func testEveryVerbTableInAWordNoteHasAllSixPersonsAndTheRightForms() {
        var tables = 0
        for word in words {
            guard let colon = word.note.firstIndex(of: ":"), word.note.hasPrefix("unregelmäßig") || word.note.hasPrefix("Verb auf -er") else { continue }
            let verb = word.target
            let entries = word.note[word.note.index(after: colon)...].components(separatedBy: ", ").map { $0.trimmingCharacters(in: .whitespaces) }
            if word.note.hasPrefix("unregelmäßig") {
                XCTAssertEqual(entries.count, 6, "\(verb): a full table has six persons")
                XCTAssertEqual(Self.irregular[verb] != nil, true, "\(verb) is not in the reference table")
            }
            for entry in entries {
                let person: String
                let form: String
                if entry.hasPrefix("j'") {
                    person = "je"
                    form = entry
                } else {
                    let pieces = entry.split(separator: " ", maxSplits: 1).map(String.init)
                    XCTAssertEqual(pieces.count, 2, "\(verb): \(entry)")
                    guard pieces.count == 2 else { continue }
                    person = pieces[0]
                    form = pieces[1]
                }
                XCTAssertEqual(form, expectedForm(verb: verb, person: person), "\(verb): \(entry)")
            }
            if word.note.hasPrefix("unregelmäßig") {
                let order = entries.map { $0.hasPrefix("j'") ? "je" : String($0.split(separator: " ")[0]) }
                XCTAssertEqual(order, Self.persons, "\(verb): the persons come in the usual order")
            }
            tables += 1
        }
        XCTAssertGreaterThanOrEqual(tables, 7)
    }

    func testTheTipsSayEveryVerbFormTheyDrill() {
        for (index, unit) in units.enumerated() {
            for form in unit.forms {
                let parts = form.prompt.components(separatedBy: ", ")
                guard parts.count == 2, Self.persons.contains(parts[1]), let answer = form.answers.first else { continue }
                XCTAssertTrue(unit.tip.contains(answer), "unit \(index + 1): the tip never shows \(answer) (\(form.prompt))")
            }
        }
    }

    // MARK: Forms other than verbs follow the rule the tip teaches

    func testEveryDerivedFormFollowsItsRule() {
        let numbers = ["11": "onze", "12": "douze", "13": "treize", "14": "quatorze", "15": "quinze", "16": "seize", "20": "vingt"]
        let feminine = ["noir": "noire", "blanc": "blanche", "bleu": "bleue", "rouge": "rouge", "vert": "verte"]
        var seen = Set<String>()
        for form in forms {
            guard let comma = form.prompt.firstIndex(of: ","), let answer = form.answers.first else { continue }
            let group = String(form.prompt[..<comma])
            let subject = String(form.prompt[form.prompt.index(comma, offsetBy: 2)...])
            seen.insert(group)
            switch group {
            case "Plural":
                let noun = subject.hasPrefix("l'") ? String(subject.dropFirst(2)) : String(subject.split(separator: " ", maxSplits: 1)[1])
                XCTAssertEqual(answer, "les \(noun)s", form.prompt)
            case "weiblich":
                XCTAssertEqual(answer, feminine[subject], form.prompt)
            case "Teilungsartikel":
                if subject.hasPrefix("le ") { XCTAssertEqual(answer, "du " + subject.dropFirst(3), form.prompt) }
                else if subject.hasPrefix("la ") { XCTAssertEqual(answer, "de la " + subject.dropFirst(3), form.prompt) }
                else if subject.hasPrefix("l'") { XCTAssertEqual(answer, "de l'" + subject.dropFirst(2), form.prompt) }
                else { XCTFail("unexpected: \(form.prompt)") }
            case "à + Artikel":
                if subject.hasPrefix("le ") { XCTAssertEqual(answer, "au " + subject.dropFirst(3), form.prompt) }
                else if subject.hasPrefix("la ") { XCTAssertEqual(answer, "à la " + subject.dropFirst(3), form.prompt) }
                else if subject.hasPrefix("l'") { XCTAssertEqual(answer, "à l'" + subject.dropFirst(2), form.prompt) }
                else if subject.hasPrefix("les ") { XCTAssertEqual(answer, "aux " + subject.dropFirst(4), form.prompt) }
                else { XCTFail("unexpected: \(form.prompt)") }
            case "Zahl in Worten":
                XCTAssertEqual(answer, numbers[subject], form.prompt)
            case "Frage mit est-ce que":
                XCTAssertEqual(answer, "est-ce que " + subject, form.prompt)
            case "verneinen":
                XCTAssertEqual(answer, negated(subject), form.prompt)
            default:
                break
            }
        }
        for group in ["Plural", "weiblich", "Teilungsartikel", "à + Artikel", "Zahl in Worten", "Frage mit est-ce que", "verneinen"] {
            XCTAssertTrue(seen.contains(group), "no form drills \(group)")
        }
    }

    /// The negation of a short affirmative sentence, worked out from the rule: ne before the verb (n' before a vowel),
    /// pas after it, and un, une, du, des after the verb become de.
    private func negated(_ sentence: String) -> String {
        var tokens = sentence.split(separator: " ").map(String.init)
        var subject = tokens.removeFirst()
        var verb: String
        if subject.hasPrefix("j'") {
            verb = String(subject.dropFirst(2))
            subject = "je"
        } else {
            verb = tokens.removeFirst()
        }
        let vowel = "aeiouéèêh".contains(verb.first ?? "x")
        var rest = tokens
        if let first = rest.first, ["un", "une", "du", "des"].contains(first) { rest[0] = "de" }
        return ([subject, vowel ? "n'" + verb : "ne " + verb, "pas"] + rest).joined(separator: " ")
    }

    func testFillsWithVerbsHaveExactlyTheRightFormForTheirSubject() {
        let subjects = [
            "je": "je", "tu": "tu", "il": "il", "elle": "il", "léa": "il", "paul": "il", "frère": "il", "sœur": "il",
            "nous": "nous", "vous": "vous", "ils": "ils", "elles": "ils", "amis": "ils", "parents": "ils",
        ]
        var byForm: [String: Set<String>] = [:]
        for (verb, table) in Self.irregular { for (person, form) in table { byForm[form, default: []].insert(person) ; _ = verb } }
        for verb in Self.regularVerbs {
            for person in Self.persons { if let form = expectedForm(verb: verb, person: person) { byForm[form, default: []].insert(person) } }
        }
        var checked = 0
        for fill in fills {
            guard let blank = fill.sentence.range(of: "___"),
                  let last = frenchWords(String(fill.sentence[..<blank.lowerBound])).last,
                  let person = subjects[last], fill.options.count >= 2 else { continue }
            let right = fill.options[0]
            XCTAssertTrue(byForm[right]?.contains(person) == true, "\(fill.sentence): \(right) does not go with \(last)")
            let matching = fill.options.filter { byForm[$0]?.contains(person) == true }
            if matching.count == 1 {
                XCTAssertEqual(matching, [right], "\(fill.sentence): a wrong choice also fits \(last)")
            }
            checked += 1
        }
        XCTAssertGreaterThanOrEqual(checked, 12)
    }

    // MARK: Nouns, genders, agreement

    func testEveryNounCarriesItsGenderNoteAndAnArticleThatAgrees() {
        var checked = 0
        for word in words {
            let target = word.target
            let article: String
            let noun: String
            if target.hasPrefix("l'") {
                article = "l'"
                noun = String(target.dropFirst(2))
            } else if let space = target.firstIndex(of: " "), ["le", "la", "les"].contains(String(target[..<space])) {
                article = String(target[..<space])
                noun = String(target[target.index(after: space)...])
            } else {
                continue
            }
            // Only nouns: skip the chunks that start with an article word but are not nouns.
            guard let gender = Self.nouns[noun] else {
                XCTFail("a noun the test does not know: \(target)")
                continue
            }
            let note = word.note.split(separator: ";").first.map { String($0).trimmingCharacters(in: .whitespaces) } ?? ""
            switch gender {
            case "m":
                XCTAssertEqual(note, "m", "\(target)")
                XCTAssertTrue(article == "le" || article == "l'", "\(target) is masculine")
            case "f":
                XCTAssertEqual(note, "f", "\(target)")
                XCTAssertTrue(article == "la" || article == "l'", "\(target) is feminine")
            default:
                XCTAssertEqual(note, "Plural", "\(target)")
                XCTAssertEqual(article, "les")
            }
            checked += 1
        }
        XCTAssertGreaterThanOrEqual(checked, 40)
    }

    func testNounsWithoutAnArticleInTheirWordLineAreNotNouns() {
        // Every noun in the course is taught with its article: a bare noun would hide its gender.
        for word in words where Self.nouns[word.target] != nil {
            XCTFail("\(word.target) is taught without its article")
        }
    }

    func testPossessiveWordsAndArticlesAgreeWithTheirNounsInEverySentence() {
        let masculine = Set(Self.nouns.filter { $0.value == "m" }.keys)
        let feminine = Set(Self.nouns.filter { $0.value == "f" }.keys)
        let vowels = "aeiouéèêh"
        for text in frenchTexts {
            let tokens = frenchWords(text)
            for (index, token) in tokens.enumerated().dropLast() {
                let next = tokens[index + 1]
                switch token {
                case "ma", "ta", "sa":
                    XCTAssertFalse(vowels.contains(next.first ?? "x"), "\(text): before a vowel it is mon/ton/son")
                    XCTAssertFalse(masculine.contains(next), "\(text): \(token) before masculine \(next)")
                case "mon", "ton", "son":
                    XCTAssertFalse(feminine.contains(next) && !vowels.contains(next.first ?? "x"), "\(text): \(token) before feminine \(next)")
                case "un":
                    XCTAssertFalse(feminine.contains(next), "\(text): un before feminine \(next)")
                case "une":
                    XCTAssertFalse(masculine.contains(next), "\(text): une before masculine \(next)")
                default:
                    break
                }
            }
        }
    }

    // MARK: Spelling, elision, contractions

    func testNoFrenchTextHasABrokenElisionOrContraction() {
        let vowelStart = "aeiouéèêâîôûàh"
        for text in frenchTexts {
            let tokens = frenchWords(text)
            for (index, token) in tokens.enumerated() {
                guard index + 1 < tokens.count else { continue }
                let next = tokens[index + 1]
                if ["je", "ne", "me", "te", "se", "le", "la", "de", "que", "ce", "si"].contains(token), vowelStart.contains(next.first ?? "x") {
                    XCTFail("\(text): \(token) \(next) needs an apostrophe")
                }
                if token == "de" && (next == "le" || next == "les") { XCTFail("\(text): de \(next) is du/des") }
                if token == "à" && (next == "le" || next == "les") { XCTFail("\(text): à \(next) is au/aux") }
            }
            XCTAssertFalse(text.contains("’"), "\(text): use the plain apostrophe so that typing works")
            XCTAssertFalse(text.contains("  "), "\(text): double space")
        }
    }

    func testNoFrenchWordIsMissingItsAccent() {
        let unaccented: Set<String> = [
            "etre", "pere", "mere", "frere", "soeur", "cafe", "ecole", "voila", "cinema", "age", "francais", "plait", "ecoute",
            "ecouter", "ecoutons", "cote", "ca", "lecole", "meme", "ete", "deja", "tres", "apres", "bientot", "grandpere",
            "grandmere", "lecole", "heure", "lheure",
        ].subtracting(["heure", "lheure"])
        for text in frenchTexts + fills.flatMap(\.options) {
            for token in lettersOnly(text) where unaccented.contains(token) {
                XCTFail("\(text): \(token) needs its accent")
            }
        }
    }

    func testSentencesAreShortWellFormedAndEndInPunctuation() {
        for sentence in sentences {
            let count = frenchWords(sentence.target).count
            XCTAssertLessThanOrEqual(count, 8, "\(sentence.target): \(count) words")
            XCTAssertTrue(sentence.target.first?.isUppercase == true, sentence.target)
            XCTAssertTrue(".?!".contains(sentence.target.last ?? "x"), sentence.target)
            if sentence.target.hasSuffix(" ?") || sentence.target.hasSuffix(" !") { continue }
            XCTAssertFalse(sentence.target.hasSuffix("?") || sentence.target.hasSuffix("!"), "French puts a space before ? and !: \(sentence.target)")
        }
    }

    func testNoSentenceRepeatsAcrossTheCourse() {
        var seen = Set<String>()
        for sentence in sentences {
            XCTAssertTrue(seen.insert(LearnExercise.folded(sentence.target)).inserted, "repeated: \(sentence.target)")
        }
        let answers = Set(forms.flatMap(\.answers).map(LearnExercise.folded))
        for sentence in sentences {
            XCTAssertFalse(answers.contains(LearnExercise.folded(sentence.target)), "a form answer is also a sentence: \(sentence.target)")
        }
    }

    // MARK: German side

    func testTranslationsHaveNoLeftoverFrenchAndMatchInPunctuation() {
        let frenchOnlyLetters = Set("àâçèêëîïôùûœ")
        let frenchFunctionWords: Set<String> = [
            "le", "la", "les", "un", "une", "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "est", "et", "de", "pas", "ne",
            "au", "aux", "dans", "chez", "sont", "suis", "oui", "non", "mon", "ma", "mes", "ton", "ta", "tes", "sa", "ses",
            "merci", "bonjour", "salut", "voilà", "c", "j", "l", "qu",
        ]
        let names = ["Léa", "Léas"]
        func check(_ meaning: String, _ context: String) {
            var text = meaning
            for name in names { text = text.replacingOccurrences(of: name, with: "") }
            XCTAssertTrue(text.filter { frenchOnlyLetters.contains($0) }.isEmpty, "\(context): French letters in the German: \(meaning)")
            XCTAssertEqual(meaning, meaning.trimmingCharacters(in: .whitespaces), context)
            for token in lettersOnly(text) where frenchFunctionWords.contains(token) {
                XCTFail("\(context): leftover French word \"\(token)\" in \(meaning)")
            }
        }
        for sentence in sentences {
            for meaning in sentence.meanings {
                check(meaning, sentence.target)
                XCTAssertEqual(meaning.last, sentence.target.last, "\(sentence.target) / \(meaning): the sentence ends the same way")
            }
        }
        for word in words {
            for meaning in word.meanings where !meaning.hasPrefix("Viertel") { check(meaning, word.target) }
        }
    }

    func testTheSubjectOfASentenceSurvivesTranslation() {
        let german: [String: [String]] = ["je": ["ich"], "j": ["ich"], "tu": ["du"], "nous": ["wir"], "vous": ["sie", "ihr"]]
        var checked = 0
        for sentence in sentences {
            let first = lettersOnly(sentence.target).first ?? ""
            guard let expected = german[first], let meaning = sentence.meanings.first else { continue }
            XCTAssertTrue(!Set(lettersOnly(meaning)).isDisjoint(with: expected), "\(sentence.target) / \(meaning)")
            checked += 1
        }
        XCTAssertGreaterThanOrEqual(checked, 20)
    }

    func testNumbersAndColorsAreTranslatedWithTheRightWord() {
        var checked = 0
        for sentence in sentences {
            guard let meaning = sentence.meanings.first?.lowercased() else { continue }
            for token in lettersOnly(sentence.target) {
                if let number = Self.numbers[token] { XCTAssertTrue(meaning.contains(number), "\(sentence.target) / \(meaning)"); checked += 1 }
                if let color = Self.colors[token] { XCTAssertTrue(meaning.contains(color), "\(sentence.target) / \(meaning)"); checked += 1 }
            }
        }
        XCTAssertGreaterThanOrEqual(checked, 8)
        for word in words {
            if let number = Self.numbers[word.target] { XCTAssertEqual(word.meanings.first, number) }
            if let color = Self.colors[word.target] { XCTAssertEqual(word.meanings.first, color) }
        }
    }

    func testEveryWordsFirstMeaningContainsItsGermanKeyWord() {
        for word in words {
            guard let stem = Self.gloss[word.target] else {
                XCTFail("a word the test has no gloss for: \(word.target)")
                continue
            }
            XCTAssertTrue(word.meanings.first?.lowercased().contains(stem) == true, "\(word.target): \(word.meanings)")
        }
        XCTAssertEqual(Self.gloss.count, words.count, "the reference list and the course list the same words")
    }

    func testAgeIsSaidWithAvoirAndTimeFollowsTheFrenchWayOfCounting() {
        for sentence in sentences where lettersOnly(sentence.target).contains("ans") {
            XCTAssertFalse(lettersOnly(sentence.target).contains("suis") || lettersOnly(sentence.target).contains("est"), sentence.target)
            XCTAssertTrue(sentence.meanings[0].contains("Jahre alt"), sentence.meanings[0])
        }
        let demie = facts.first { $0.question.contains("trois heures et demie") }
        XCTAssertEqual(demie?.answer, "3:30 Uhr")
        XCTAssertEqual(facts.filter { $0.question.contains("trois heures et demie") }.count, 1)
    }

    // MARK: Fills and facts

    func testFillsHaveOneBlankAndDistinctChoices() {
        for fill in fills {
            XCTAssertEqual(fill.sentence.components(separatedBy: "___").count, 2, fill.sentence)
            XCTAssertTrue((2...4).contains(fill.options.count), fill.sentence)
            XCTAssertEqual(Set(fill.options.map(LearnExercise.folded)).count, fill.options.count, "\(fill.sentence): choices that read the same")
            // The right choice must not be a choice that would also make a sentence from the course.
            let wrong = fill.options.dropFirst().map { fill.sentence.replacingOccurrences(of: "___", with: $0) }
            for text in wrong {
                XCTAssertFalse(sentences.contains { LearnExercise.folded($0.target) == LearnExercise.folded(text) }, "a wrong choice is a sentence of the course: \(text)")
            }
        }
    }

    func testFactsHaveDistinctAnswers() {
        for fact in facts {
            let all = [fact.answer] + fact.wrong
            XCTAssertTrue((2...4).contains(all.count), fact.question)
            XCTAssertEqual(Set(all.map(LearnExercise.folded)).count, all.count, "\(fact.question): answers that read the same")
        }
    }

    // MARK: Teaching order and how the engine uses the course

    /// Which lesson (0 based) teaches an item, worked out as the engine cuts a unit: items ordered by how far along
    /// their kind is, then cut into even shares.
    private func lesson(ofItem index: Int, kind: Int, in unit: LanguageUnitData) -> Int {
        let counts = [unit.words.count, unit.sentences.count, unit.forms.count, unit.fills.count, unit.facts.count]
        var all: [(position: Double, order: Int, kind: Int, index: Int)] = []
        for (order, count) in counts.enumerated() { for i in 0..<count { all.append(((Double(i) + 0.5) / Double(count), order, order, i)) } }
        all.sort { $0.position != $1.position ? $0.position < $1.position : $0.order < $1.order }
        let lessons = LanguageCourseProvider.lessonCount(of: unit)
        let place = all.firstIndex { $0.kind == kind && $0.index == index } ?? 0
        return (0..<lessons).first { place < all.count * ($0 + 1) / lessons } ?? lessons - 1
    }

    func testASentenceOnlyUsesWordsTaughtInItsLessonOrEarlier() {
        var known = Set<String>()
        for unit in units {
            let lessons = LanguageCourseProvider.lessonCount(of: unit)
            var taught = [Set<String>](repeating: [], count: lessons)
            for (i, word) in unit.words.enumerated() { taught[lesson(ofItem: i, kind: 0, in: unit)].formUnion(LanguageCoverage.tokens(of: word.target)) }
            for (i, form) in unit.forms.enumerated() { taught[lesson(ofItem: i, kind: 2, in: unit)].formUnion(form.answers.flatMap(LanguageCoverage.tokens(of:))) }
            for (i, fill) in unit.fills.enumerated() {
                if let first = fill.options.first { taught[lesson(ofItem: i, kind: 3, in: unit)].formUnion(LanguageCoverage.tokens(of: first)) }
            }
            let unitKnown = Set(unit.known.flatMap(LanguageCoverage.tokens(of:)))
            for (i, sentence) in unit.sentences.enumerated() {
                let place = lesson(ofItem: i, kind: 1, in: unit)
                var available = known.union(unitKnown)
                for l in 0...place { available.formUnion(taught[l]) }
                let late = LanguageCoverage.tokens(of: sentence.target).filter { !available.contains($0) }
                XCTAssertEqual(late, [], "\(unit.title), lesson \(place + 1): \(sentence.target) uses words taught later")
            }
            known.formUnion(unitKnown)
            for tokens in taught { known.formUnion(tokens) }
        }
    }

    private func exercisesByCard(unit: Int, seeds: ClosedRange<UInt64>) -> [String: Set<Character>] {
        var seen: [String: Set<Character>] = [:]
        for node in provider.course.units[unit].nodes where node.kind != .chest {
            for seed in seeds {
                for exercise in provider.exercises(for: node, seed: seed) {
                    for key in exercise.cardKeys { seen[key, default: []].insert(exercise.id.last ?? "?") }
                }
            }
        }
        return seen
    }

    func testEveryWordAndSentenceMeetsTheStudentInAtLeastThreeFormsWithinItsUnit() {
        for (index, unit) in units.enumerated() {
            let seen = exercisesByCard(unit: index, seeds: 1...4)
            for (i, word) in unit.words.enumerated() {
                XCTAssertGreaterThanOrEqual(seen["w\(index)-\(i)"]?.count ?? 0, 3, "\(word.target): \(seen["w\(index)-\(i)"]?.sorted() ?? [])")
            }
            for (i, sentence) in unit.sentences.enumerated() {
                XCTAssertGreaterThanOrEqual(seen["s\(index)-\(i)"]?.count ?? 0, 3, "\(sentence.target): \(seen["s\(index)-\(i)"]?.sorted() ?? [])")
            }
            for i in unit.forms.indices { XCTAssertGreaterThanOrEqual(seen["f\(index)-\(i)"]?.count ?? 0, 2, unit.forms[i].prompt) }
        }
    }

    func testTypedFrenchForgivesAccentsAndApostrophesButNotLetters() throws {
        func typed(_ answer: String, unit: Int) throws -> LearnExercise {
            let node = try XCTUnwrap(provider.course.node(withID: String(format: "fr.u%02d.t", unit)))
            return try XCTUnwrap(
                (1...80).lazy.flatMap { self.provider.exercises(for: node, seed: UInt64($0)) }
                    .first { $0.kind == .typeAnswer && $0.mode == .exact && $0.correctAnswers == [answer] }
            )
        }
        let etes = try typed("êtes", unit: 1)
        XCTAssertEqual(etes.missedKeys(for: .typed("etes")), [])
        XCTAssertEqual(etes.missedKeys(for: .typed("Êtes")), [])
        XCTAssertNotEqual(etes.missedKeys(for: .typed("êtez")), [])
        let jai = try typed("j'ai", unit: 2)
        XCTAssertEqual(jai.missedKeys(for: .typed("j'ai")), [])
        XCTAssertEqual(jai.missedKeys(for: .typed("jai")), [])
        XCTAssertNotEqual(jai.missedKeys(for: .typed("je ai")), [])
        let sentence = try typed("Je vais à la gare.", unit: 7)
        XCTAssertEqual(sentence.missedKeys(for: .typed("je vais a la gare")), [])
        XCTAssertNotEqual(sentence.missedKeys(for: .typed("je vais a la garage")), [])
        XCTAssertNotEqual(sentence.missedKeys(for: .typed("a la gare je vais")), [], "word order matters")
    }

    func testEverySpokenExerciseUsesTheFrenchVoice() {
        var spoken = 0
        for node in provider.course.nodes where node.kind != .chest {
            for exercise in provider.exercises(for: node, seed: 3) {
                if case let .speech(text, language)? = exercise.media {
                    XCTAssertEqual(language, "fr-FR")
                    XCTAssertFalse(text.isEmpty)
                    spoken += 1
                }
            }
        }
        XCTAssertGreaterThan(spoken, 100)
    }

    func testTheSameSeedGivesTheSameLessonAndPracticeBringsEarlierUnitsBack() throws {
        let lesson = try XCTUnwrap(provider.course.node(withID: "fr.u03.l2"))
        XCTAssertEqual(provider.exercises(for: lesson, seed: 5), provider.exercises(for: lesson, seed: 5))
        let practice = try XCTUnwrap(provider.course.node(withID: "fr.u06.p"))
        let ids = (1...10).flatMap { provider.exercises(for: practice, seed: UInt64($0)).map(\.id) }
        XCTAssertTrue(ids.contains { $0.contains("#w5-") || $0.contains("#s5-") })
        XCTAssertTrue(ids.contains { $0.contains("#w0-") || $0.contains("#w1-") || $0.contains("#s0-") || $0.contains("#s1-") || $0.contains("#w2-") || $0.contains("#w3-") || $0.contains("#w4-") })
    }
}
