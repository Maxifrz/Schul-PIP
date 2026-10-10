import XCTest
@testable import Lernwerk

final class LanguageDSLTests: XCTestCase {
    func testTheSampleParsesWithoutProblems() {
        let made = LanguageCourseProvider.make(source: LanguageSample.source)
        XCTAssertEqual(made.errors, [])
        let data = made.provider.data
        XCTAssertEqual(data.id, "sample")
        XCTAssertEqual(data.kind, .language)
        XCTAssertEqual(data.color, 0xD9903A)
        XCTAssertEqual(data.speech, "es-ES")
        XCTAssertEqual(data.instruction, .de)
        XCTAssertEqual(data.knownName, "Deutsche")
        XCTAssertEqual(data.units.count, 2)
        let first = data.units[0]
        XCTAssertEqual(first.title, "Hallo und Tschüss")
        XCTAssertEqual(first.summary, "Begrüßen und sich vorstellen")
        XCTAssertEqual(first.sectionTitle, "A1 · Erste Schritte")
        XCTAssertEqual(first.words.count, 12)
        XCTAssertEqual(first.sentences.count, 8)
        XCTAssertEqual(first.forms.count, 4)
        XCTAssertEqual(first.fills.count, 3)
        XCTAssertEqual(first.facts.count, 2)
        XCTAssertEqual(first.tip.components(separatedBy: "\n\n").count, 2)
        XCTAssertEqual(first.words[1], LanguageWord(target: "adiós", meanings: ["tschüss", "auf Wiedersehen"], note: "", why: ""))
        XCTAssertEqual(data.units[1].words[0].note, "f")
        XCTAssertEqual(first.forms[0].why, "Mit „yo“ steht „soy“.")
        XCTAssertEqual(first.forms[0].group, "ser")
        XCTAssertEqual(first.fills[0].options, ["soy", "eres", "es"])
        XCTAssertEqual(first.facts[1].answer, "¿")
        XCTAssertEqual(first.facts[1].wrong, ["!", "?"])
        XCTAssertEqual(made.provider.course.sections.count, 1)
        XCTAssertEqual(made.provider.course.units.count, 2)
    }

    func testEveryProblemIsReportedWithItsLine() {
        let source = """
        course: x
        title: X
        subtitle: s
        color: 12
        symbol: globe
        word: hola = hallo
        unit: Eins
        word: hola
        word: = nichts
        fill: Yo soy = a | b
        fill: Yo ___ = nur
        fact: Frage? = nur eine Antwort
        colour: red
        tip:
        no colon here
        unit:
        """
        let errors = LanguageDSL.parse(source).errors
        func has(_ text: String) { XCTAssertTrue(errors.contains(text), "\(text) not in \(errors)") }
        has("line 6: word before the first unit")
        has("line 8: word needs \" = \"")
        has("line 9: word needs \" = \"")
        has("line 10: fill without ___")
        has("line 11: fill needs a right and a wrong choice")
        has("line 12: fact needs an answer and a wrong answer")
        has("line 13: unknown key \"colour\"")
        has("line 14: empty tip")
        has("line 15: no \"key: value\"")
        has("line 16: unit without a title")
        has("color must be six hex digits")
    }

    func testContentProblemsAreFound() {
        let source = """
        course: x
        title: X
        subtitle: s
        color: 336699
        symbol: globe
        unit: Eins | s
        tip: Tipp
        word: el coche = das Auto
        word: el auto = das Auto
        word: el coche = der Wagen
        word: a = b
        word: c = d
        word: e = f
        word: g = h
        sentence: Hola. = Hallo.
        sentence: Hola. = Hallo!
        """
        let problems = LanguageCourseProvider.make(source: source).errors
        XCTAssertTrue(problems.contains { $0.contains("\"das Auto\" means both el coche and el auto") })
        XCTAssertTrue(problems.contains { $0.contains("el coche twice") })
        XCTAssertTrue(problems.contains { $0.contains("sentence twice: Hola.") })
    }

    func testSectionsGroupUnitsInOrderAndSchoolCoursesNeedNoSpeech() {
        let source = """
        course: de
        title: Deutsch
        subtitle: Schulfach
        kind: school
        color: C46A55
        symbol: book.fill
        section: Rechtschreibung
        unit: Das oder dass | s
        tip: Tipp
        fact: A? = a | b
        section: Grammatik
        unit: Fälle | s
        tip: Tipp
        fact: B? = a | b
        unit: Zeiten | s
        tip: Tipp
        fact: C? = a | b
        """
        let data = LanguageDSL.parse(source).data
        XCTAssertEqual(data.kind, .school)
        XCTAssertNil(data.speech)
        let course = LanguageCourseProvider(data: data).course
        XCTAssertEqual(course.sections.map(\.title), ["Rechtschreibung", "Grammatik"])
        XCTAssertEqual(course.sections.map { $0.units.count }, [1, 2])
        XCTAssertEqual(course.units.map(\.number), [1, 2, 3])
    }

    func testEnglishInstructionsForAForeignLanguageCourse() {
        let source = """
        course: daf
        title: Deutsch als Fremdsprache
        subtitle: For English speakers · A1
        color: B8A04A
        symbol: textformat
        speech: de-DE
        instruction: en
        target-name: German
        into-name: German
        unit: Hello | Greetings
        tip: In German, nouns are capitalised.
        word: Hallo = hello
        """
        let data = LanguageDSL.parse(source).data
        XCTAssertEqual(data.instruction, .en)
        XCTAssertEqual(data.knownName, "English")
        let texts = LanguageTexts.make(for: data)
        XCTAssertEqual(texts.fill(texts.askTarget, with: "house"), "How do you say “house” in German?")
        XCTAssertEqual(texts.fill(texts.translateFrom, with: "Haus"), "Translate into English:\nHaus")
        XCTAssertEqual(texts.pairs, "Match the pairs")
        let german = LanguageTexts.make(for: LanguageSample.provider().data)
        XCTAssertEqual(german.fill(german.askTarget, with: "Haus"), "Wie sagt man „Haus“ auf Spanisch?")
        XCTAssertEqual(german.fill(german.translateInto, with: "Haus"), "Übersetze ins Spanische:\nHaus")
    }
}
