import XCTest
@testable import Lernwerk

final class CalculatorTests: XCTestCase {
    func testAnswerDecodesFromTheCoreJSON() throws {
        let json = #"{"ok":true,"input":"löse(x^2=2)","giac":"solve(x^2=2)","assigns":null,"kind":null,"exact":"list[-sqrt(2),sqrt(2)]","approx":"list[-1.41421356237,1.41421356237]","pretty":"L = {-√2; √2}","prettyApprox":"L ≈ {-1,414213562; 1,414213562}","matrix":null}"#
        let answer = try JSONDecoder().decode(CASAnswer.self, from: Data(json.utf8))
        XCTAssertTrue(answer.ok)
        XCTAssertEqual(answer.pretty, "L = {-√2; √2}")
        XCTAssertNil(answer.matrix)
        let failed = try JSONDecoder().decode(CASAnswer.self, from: Data(#"{"ok":false,"error":"Syntaxfehler"}"#.utf8))
        XCTAssertFalse(failed.ok)
        XCTAssertEqual(failed.error, "Syntaxfehler")
    }

    func testPlotDecodesNullValuesAndPoints() throws {
        let json = #"{"ok":true,"xmin":-2,"xmax":2,"ymin":-5,"ymax":5,"curves":[{"index":0,"giac":"1/x","label":"f1(x)","pretty":"1/x","values":[-0.5,null,0.5]}],"roots":[],"extrema":[{"curve":0,"x":1,"y":-2,"kind":"min"}],"intersections":[{"curves":[0,1],"x":2,"y":4}],"intercepts":[]}"#
        let plot = try JSONDecoder().decode(CASPlot.self, from: Data(json.utf8))
        XCTAssertEqual(plot.curves?.first?.values, [-0.5, nil, 0.5])
        XCTAssertEqual(plot.extrema?.first?.kind, "min")
        XCTAssertEqual(plot.intersections?.first?.curves, [0, 1])
        XCTAssertEqual(plot.x(at: 1, count: 3), 0)
        XCTAssertEqual(plot.x(at: 2, count: 3), 2)
    }

    func testHistoryRecordsAnswersDefinitionsAndErrors() {
        var history = CalculatorHistory()
        history.record(input: "a = 5", answer: CASAnswer(ok: true, assigns: "a", kind: "variable", exact: "5", pretty: "a = 5"))
        history.record(input: "f(x) = x^2", answer: CASAnswer(ok: true, assigns: "f", kind: "function", exact: "f(x)=x^2", pretty: "f(x) = x²"))
        history.record(input: "1+", answer: CASAnswer(ok: false, error: "Syntaxfehler"))
        history.record(input: "a = 7", answer: CASAnswer(ok: true, assigns: "a", kind: "variable", exact: "7", pretty: "a = 7"))
        XCTAssertEqual(history.entries.count, 4)
        XCTAssertEqual(history.entries[2].error, "Syntaxfehler")
        XCTAssertNil(history.entries[1].exact)
        // A new value replaces the old definition and moves to the end.
        XCTAssertEqual(history.definitions.map(\.name), ["f", "a"])
        XCTAssertEqual(history.definitions.last?.input, "a = 7")
        history.forget("f")
        XCTAssertEqual(history.definitions.map(\.name), ["a"])
    }

    func testAnsIsTheNewestAnswer() {
        var history = CalculatorHistory()
        XCTAssertEqual(history.resolvingAns("ans*2"), "ans*2")
        history.record(input: "löse(x^2=4)", answer: CASAnswer(ok: true, exact: "list[-2,2]", pretty: "L = {-2; 2}"))
        history.record(input: "3+4", answer: CASAnswer(ok: true, exact: "7", pretty: "7"))
        history.record(input: "b = 2", answer: CASAnswer(ok: true, assigns: "b", kind: "variable", exact: "2", pretty: "b = 2"))
        XCTAssertEqual(history.resolvingAns("ans*2 + answer + ans"), "(7)*2 + answer + (7)")
        XCTAssertEqual(CalculatorHistory.replaceWord("ans", in: "plans(ans)", with: "1"), "plans(1)")
    }

    func testHistoryKeepsTheNewest200() {
        var history = CalculatorHistory()
        for index in 0..<205 {
            history.record(input: "\(index)", answer: CASAnswer(ok: true, exact: "\(index)", pretty: "\(index)"))
        }
        XCTAssertEqual(history.entries.count, 200)
        XCTAssertEqual(history.entries.first?.input, "5")
    }

    func testHistoryRoundTripsThroughJSON() throws {
        var history = CalculatorHistory()
        history.degrees = true
        history.record(input: "inverse([[1,2],[3,4]])", answer: CASAnswer(ok: true, exact: "[[-2,1],[3/2,-1/2]]", pretty: "[[-2; 1]; [3/2; -1/2]]", matrix: [["-2", "1"], ["3/2", "-1/2"]]))
        let data = try JSONEncoder().encode(history)
        XCTAssertEqual(try JSONDecoder().decode(CalculatorHistory.self, from: data), history)
    }

    func testInputInsertsTemplatesAtTheCursor() {
        var input = CalculatorInput()
        input.insert("löse(|, x)")
        XCTAssertEqual(input.text, "löse(, x)")
        XCTAssertEqual(input.beforeCursor, "löse(")
        input.insert("x^2")
        input.insert("=4")
        XCTAssertEqual(input.text, "löse(x^2=4, x)")
        input.moveLeft()
        input.backspace()
        XCTAssertEqual(input.text, "löse(x^24, x)")
        input.moveRight()
        input.moveRight()
        input.moveRight()
        input.moveRight()
        input.moveRight()
        input.moveRight()
        XCTAssertEqual(input.cursor, input.text.count)
        input.clear()
        XCTAssertEqual(input.text, "")
        input.backspace()
        XCTAssertEqual(input.cursor, 0)
        input.set("√2")
        XCTAssertEqual(input.cursor, 2)
    }

    func testNumbersAndPointsTheGermanWay() {
        XCTAssertEqual(CASFormat.number(1.73205), "1,7321")
        XCTAssertEqual(CASFormat.number(2), "2")
        XCTAssertEqual(CASFormat.number(-0.00001), "0")
        XCTAssertEqual(CASFormat.number(-2.5), "-2,5")
        XCTAssertEqual(CASFormat.point("H", x: -1, y: 2), "H(-1 | 2)")
    }

    func testTicksAreRoundNumbers() {
        XCTAssertEqual(CASFormat.ticks(from: -3, to: 3, count: 6), [-3, -2, -1, 0, 1, 2, 3])
        XCTAssertEqual(CASFormat.ticks(from: 0, to: 100, count: 5), [0, 20, 40, 60, 80, 100])
        XCTAssertEqual(CASFormat.ticks(from: -0.3, to: 0.3, count: 6), [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3].map { ($0 * 10).rounded() / 10 })
        XCTAssertTrue(CASFormat.ticks(from: 1, to: 1).isEmpty)
    }
}
