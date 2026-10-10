import XCTest
@testable import Lernwerk

/// The shape of the Spanish course and what the engine makes of it. The facts of the content are checked in
/// SpanishCourseFactTests, in a way that does not depend on how the course text was written.
final class SpanishCourseTests: XCTestCase {
    private let made = LanguageCourseProvider.make(source: SpanishCourse.source)
    private var data: LanguageCourseData { made.provider.data }

    func testTheCourseParsesWithoutErrors() {
        XCTAssertEqual(made.errors, [])
    }

    func testEverySentenceUsesOnlyTaughtWords() {
        XCTAssertEqual(LanguageCoverage.gaps(in: data).map(\.description), [])
    }

    func testTheCourseAuditIsClean() {
        XCTAssertEqual(CourseAudit.problems(of: SpanishCourse.provider, seeds: Array(1...12)), [])
    }

    func testTheHeaderDescribesTheSpanishCourseForGermanSpeakers() {
        XCTAssertEqual(data.id, "es")
        XCTAssertEqual(data.title, "Spanisch")
        XCTAssertEqual(data.subtitle, "Für Deutschsprachige · A1")
        XCTAssertEqual(data.kind, .language)
        XCTAssertEqual(data.color, 0xD9903A)
        XCTAssertEqual(data.symbol, "text.bubble.fill")
        XCTAssertEqual(data.speech, "es-ES")
        XCTAssertEqual(data.instruction, .de)
        XCTAssertEqual(data.targetName, "Spanisch")
        XCTAssertEqual(data.intoName, "Spanische")
        XCTAssertTrue(data.produces)
        XCTAssertEqual(SpanishCourse.provider.course.id, "es")
    }

    func testTheCourseIsLargeEnoughAndEveryUnitHasTheRightSize() {
        XCTAssertGreaterThanOrEqual(data.units.count, 8)
        XCTAssertGreaterThanOrEqual(data.units.flatMap(\.words).count, 120)
        XCTAssertGreaterThanOrEqual(data.units.flatMap(\.sentences).count, 60)
        XCTAssertGreaterThanOrEqual(data.units.flatMap(\.forms).count, 50)
        XCTAssertGreaterThanOrEqual(data.units.flatMap(\.fills).count, 18)
        XCTAssertGreaterThanOrEqual(data.units.flatMap(\.facts).count, 10)
        for (index, unit) in data.units.enumerated() {
            let place = "unit \(index + 1) \(unit.title)"
            XCTAssertTrue((22...32).contains(unit.itemCount), "\(place): \(unit.itemCount) items")
            XCTAssertTrue((10...15).contains(unit.words.count), "\(place): \(unit.words.count) words")
            XCTAssertTrue((6...10).contains(unit.sentences.count), "\(place): \(unit.sentences.count) sentences")
            XCTAssertTrue((3...8).contains(unit.forms.count), "\(place): \(unit.forms.count) forms")
            XCTAssertTrue((2...4).contains(unit.fills.count), "\(place): \(unit.fills.count) fills")
            XCTAssertTrue((1...3).contains(unit.facts.count), "\(place): \(unit.facts.count) facts")
            let paragraphs = unit.tip.components(separatedBy: "\n\n")
            XCTAssertTrue((3...5).contains(paragraphs.count), "\(place): \(paragraphs.count) tip paragraphs")
            for paragraph in paragraphs { XCTAssertGreaterThan(paragraph.count, 80, "\(place): a tip paragraph is too short") }
            XCTAssertEqual(
                made.provider.course.units[index].nodes.filter { $0.kind == .lesson }.count, 5,
                "\(place): 25 or more items make five lessons"
            )
        }
    }

    func testEveryUnitsTipTeachesWithExamplesFromItsOwnWords() {
        for (index, unit) in data.units.enumerated() {
            let tipTokens = Set(LanguageCoverage.tokens(of: unit.tip))
            let own = unit.words.flatMap { LanguageCoverage.tokens(of: $0.target) }.filter { $0.count >= 4 }
            let mentioned = own.filter { tipTokens.contains($0) }
            XCTAssertGreaterThanOrEqual(mentioned.count, 3, "unit \(index + 1): the tip should use the unit's own words")
        }
        let first = data.units[0].tip
        for mark in ["¿", "¡", "á", "é", "í", "ó", "ú", "ñ"] {
            XCTAssertTrue(first.contains(mark), "the first unit teaches \(mark)")
        }
    }

    func testEveryWordMeetsTheStudentInAtLeastThreeFormsAcrossItsUnit() {
        for (unitIndex, unit) in data.units.enumerated() {
            for (index, word) in unit.words.enumerated() {
                var forms = Set<String>()
                for node in made.provider.course.units[unitIndex].nodes where node.kind != .chest {
                    for seed in UInt64(1)...3 {
                        for exercise in made.provider.exercises(for: node, seed: seed) where exercise.id.contains("#w\(unitIndex)-\(index)") {
                            forms.insert(String(exercise.id.last!))
                        }
                    }
                }
                XCTAssertGreaterThanOrEqual(forms.count, 3, "\(word.target): \(forms.sorted())")
            }
        }
    }

    func testEverySentenceFormFillAndFactAppearsInTheUnitsExercises() {
        for (unitIndex, unit) in data.units.enumerated() {
            var seen = Set<String>()
            for node in made.provider.course.units[unitIndex].nodes where node.kind != .chest {
                for seed in UInt64(1)...4 {
                    for exercise in made.provider.exercises(for: node, seed: seed) { seen.insert(exercise.cardKeys.first ?? "") }
                }
            }
            let expected = unit.words.indices.map { "w\(unitIndex)-\($0)" } + unit.sentences.indices.map { "s\(unitIndex)-\($0)" }
                + unit.forms.indices.map { "f\(unitIndex)-\($0)" } + unit.fills.indices.map { "g\(unitIndex)-\($0)" }
                + unit.facts.indices.map { "q\(unitIndex)-\($0)" }
            for key in expected { XCTAssertTrue(seen.contains(key), "unit \(unitIndex + 1): \(key) never comes up") }
        }
    }

    func testSpeechUsesTheSpanishVoiceOfSpain() {
        let node = made.provider.course.node(withID: "es.u01.p")!
        let list = (1...4).flatMap { made.provider.exercises(for: node, seed: UInt64($0)) }
        let speech = list.compactMap { exercise -> String? in
            if case let .speech(_, language)? = exercise.media { return language } else { return nil }
        }
        XCTAssertFalse(speech.isEmpty)
        XCTAssertTrue(speech.allSatisfy { $0 == "es-ES" })
    }

    func testTypedSpanishIsStrictAboutLettersButForgivesAccentsAndCapitals() throws {
        let node = made.provider.course.node(withID: "es.u02.t")!
        let typed = (1...40).flatMap { made.provider.exercises(for: node, seed: UInt64($0)) }.filter { $0.kind == .typeAnswer && $0.mode == .exact }
        let brother = try XCTUnwrap(typed.first { $0.correctAnswers == ["el hermano"] })
        XCTAssertEqual(brother.missedKeys(for: .typed("El Hermano")), [])
        XCTAssertEqual(brother.missedKeys(for: .typed("el hermana")), [brother.cardKeys[0]])
        let sister = try XCTUnwrap(typed.first { $0.correctAnswers == ["la hermana"] })
        XCTAssertEqual(sister.missedKeys(for: .typed("la hermano")), [sister.cardKeys[0]])
    }

    func testWordBankTilesHaveNoSpanishPunctuationMarks() {
        for unit in 0..<data.units.count {
            let node = made.provider.course.node(withID: String(format: "es.u%02d.p", unit + 1))!
            for exercise in made.provider.exercises(for: node, seed: 3) where exercise.kind == .wordBank {
                for tile in exercise.options {
                    XCTAssertFalse(tile.contains { "¿?¡!.,".contains($0) }, "\(exercise.id): \(tile)")
                }
            }
        }
    }
}
