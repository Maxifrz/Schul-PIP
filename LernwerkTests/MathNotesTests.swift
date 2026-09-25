import XCTest
@testable import Lernwerk

final class MathNotesTests: XCTestCase {
    func testEqualsSignIsTwoFlatStrokesAboveEachOther() {
        let top = CGRect(x: 100, y: 50, width: 24, height: 3)
        let bottom = CGRect(x: 101, y: 60, width: 22, height: 4)
        XCTAssertTrue(MathNotes.isEqualsSign(top, bottom))
        XCTAssertTrue(MathNotes.isEqualsSign(bottom, top))
        // Side by side, not above each other: a dash and a minus.
        XCTAssertFalse(MathNotes.isEqualsSign(top, CGRect(x: 140, y: 50, width: 22, height: 3)))
        // A tall stroke is a letter, not a bar.
        XCTAssertFalse(MathNotes.isEqualsSign(top, CGRect(x: 100, y: 55, width: 22, height: 20)))
        // Far apart: two lines of writing.
        XCTAssertFalse(MathNotes.isEqualsSign(top, CGRect(x: 100, y: 110, width: 24, height: 3)))
        // One much longer: a fraction bar over a minus.
        XCTAssertFalse(MathNotes.isEqualsSign(CGRect(x: 80, y: 50, width: 80, height: 3), bottom))
        // Touching: one stroke drawn twice.
        XCTAssertFalse(MathNotes.isEqualsSign(top, CGRect(x: 100, y: 51, width: 24, height: 3)))
    }

    func testLineRegionTakesTheStrokesLeftOnTheSameLine() {
        let equals = CGRect(x: 200, y: 105, width: 20, height: 12)
        let boxes = [
            CGRect(x: 170, y: 95, width: 20, height: 28),   // "3"
            CGRect(x: 140, y: 100, width: 20, height: 20),  // "+"
            CGRect(x: 110, y: 96, width: 20, height: 28),   // "2"
            CGRect(x: 110, y: 40, width: 60, height: 28),   // a line above
            CGRect(x: 250, y: 98, width: 20, height: 28),   // right of the equals sign
            CGRect(x: 10, y: 96, width: 20, height: 28),    // far left, an older note
            equals,
        ]
        let region = MathNotes.lineRegion(of: equals, among: boxes)
        XCTAssertEqual(region, CGRect(x: 110, y: 95, width: 80, height: 29))
        XCTAssertNil(MathNotes.lineRegion(of: equals, among: [equals, CGRect(x: 250, y: 98, width: 20, height: 28)]))
    }

    func testResultIsWrittenAfterTheEqualsSignInTheLineSize() {
        let line = CGRect(x: 110, y: 95, width: 80, height: 29)
        XCTAssertEqual(MathNotes.fontSize(for: line), 27.55, accuracy: 0.01)
        XCTAssertEqual(MathNotes.fontSize(for: CGRect(x: 0, y: 0, width: 10, height: 5)), 14)
        XCTAssertEqual(MathNotes.fontSize(for: CGRect(x: 0, y: 0, width: 10, height: 200)), 56)
        let origin = MathNotes.resultOrigin(after: CGRect(x: 200, y: 105, width: 20, height: 12), line: line)
        XCTAssertEqual(origin.x, 228, accuracy: 0.01)
        XCTAssertEqual(origin.y, 111 - 27.55 * 0.75, accuracy: 0.01)
    }

    func testParsingTheModelsAnswer() {
        let json = #"Hier: {"kind": "expression", "lines": ["a = 5", "2 × a + 3 ="], "table": null}"#
        let recognition = MathNotes.parse(json)
        XCTAssertEqual(recognition?.kind, "expression")
        XCTAssertEqual(recognition?.lines, ["a = 5", "2 * a + 3 ="])
        let table = MathNotes.parse(#"{"kind":"table","lines":[],"table":{"headers":["x","y"],"rows":[["1","2,5"],["2","4"]]}}"#)
        XCTAssertEqual(table?.table?.rows.count, 2)
        // Plain lines when the model ignores the format.
        XCTAssertEqual(MathNotes.parse("<think>hm</think>\nx² + 1 =")?.lines, ["x^2 + 1 ="])
        XCTAssertNil(MathNotes.parse("   "))
    }

    func testCleaningSchoolSpellings() {
        XCTAssertEqual(MathNotes.clean("3,5 · 2 − √4"), "3.5 * 2 - sqrt4")
        XCTAssertEqual(MathNotes.clean("$\\pi \\cdot r^2$"), "pi * r^2")
        XCTAssertEqual(MathNotes.clean("12 : 4 ="), "12 / 4 =")
        XCTAssertEqual(MathNotes.clean("b := 2"), "b := 2")
        XCTAssertEqual(MathNotes.clean("f(1, 2)"), "f(1, 2)")
    }

    func testSplittingDefinitionsFromTheQuestion() {
        let split = MathNotes.split(["a = 5", "f(x) = x^2 + 1", "x = 3", "2a + 3", "f(a) + 1 ="])
        XCTAssertEqual(split.definitions, ["a = 5", "f(x) = x^2 + 1"])
        XCTAssertEqual(split.expression, "f(a) + 1")
        XCTAssertEqual(MathNotes.split(["7 * 6 = ?"]).expression, "7 * 6")
        XCTAssertNil(MathNotes.split(["="]).expression)
        XCTAssertNil(MathNotes.split([]).expression)
    }

    func testDefinitions() {
        XCTAssertTrue(MathNotes.isDefinition("a = 5"))
        XCTAssertTrue(MathNotes.isDefinition("Preis := 2.5"))
        XCTAssertTrue(MathNotes.isDefinition("f(x) = 3x + 1"))
        XCTAssertFalse(MathNotes.isDefinition("x = 3"))
        XCTAssertFalse(MathNotes.isDefinition("a = "))
        XCTAssertFalse(MathNotes.isDefinition("2a = 6"))
        XCTAssertFalse(MathNotes.isDefinition("a = 5 ="))
    }

    func testWhatIsWorthShowing() {
        XCTAssertFalse(MathNotes.isWorthShowing(expression: "5", result: "5"))
        XCTAssertFalse(MathNotes.isWorthShowing(expression: "x", result: "x"))
        XCTAssertTrue(MathNotes.isWorthShowing(expression: "2+3", result: "5"))
        XCTAssertEqual(MathNotes.resultText(pretty: "1/2", approx: "0,5"), "1/2")
        XCTAssertEqual(MathNotes.resultText(pretty: "1267650600228229401496703205376", approx: "1,2676506·10³⁰"), "1,2676506·10³⁰")
        XCTAssertEqual(MathNotes.resultText(pretty: nil, approx: "3,14"), "3,14")
    }

    func testTablesBecomeChartData() {
        let table = MathNotes.Recognition.Table(headers: ["x", "f(x)", "Notiz"], rows: [["1", "2,5", "a"], ["2", "4", "b"], ["3", "", "c"]])
        let chart = MathNotes.chartData(table)
        XCTAssertEqual(chart?.columns.map(\.name), ["f(x)"])
        XCTAssertEqual(chart?.columns.first?.values, [2.5, 4, nil])
        XCTAssertEqual(chart?.numericX, true)
        XCTAssertEqual(chart?.xValues, [1, 2, 3])
        let bars = MathNotes.chartData(.init(headers: ["Fach", "Note", "Stunden"], rows: [["Mathe", "2", "4"], ["Deutsch", "1,7", "3"]]))
        XCTAssertEqual(bars?.numericX, false)
        XCTAssertEqual(bars?.labels, ["Mathe", "Deutsch"])
        XCTAssertEqual(bars?.columns.count, 2)
        XCTAssertNil(MathNotes.chartData(.init(headers: ["a"], rows: [["1"]])))
        XCTAssertEqual(MathNotes.number("−2,5"), -2.5)
    }

    func testRecognitionRequestCarriesTheImage() {
        let request = MathNotes.request(imageJPEG: Data([1, 2, 3]), hint: MathNotes.lineHint)
        XCTAssertEqual(request.purpose, .mathRecognition)
        XCTAssertEqual(request.messages.first?.content.first, .image(jpeg: Data([1, 2, 3])))
        XCTAssertTrue(request.system.contains("calculator syntax"))
    }
}
