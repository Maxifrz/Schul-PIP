import XCTest
@testable import Lernwerk

final class NumberCheckTests: XCTestCase {
    private func same(_ a: String, _ b: String) -> Bool { NumberCheck.matches(a, expected: b) }

    func testTheSameNumberInEveryWriting() {
        XCTAssertTrue(same("0,75", "3/4"))
        XCTAssertTrue(same("0.75", "3/4"))
        XCTAssertTrue(same("6/8", "3/4"))
        XCTAssertTrue(same("75 %", "0,75") == false, "a percent sign is dropped, not turned into a fraction")
        XCTAssertTrue(same("75%", "75"))
        XCTAssertTrue(same("90°", "90"))
        XCTAssertTrue(same("1 1/2", "3/2"))
        XCTAssertTrue(same("1,5", "1 1/2"))
        XCTAssertTrue(same("-2", "−2"))
        XCTAssertTrue(same("-3/4", "-0,75"))
        XCTAssertTrue(same("  12 ", "12"))
        XCTAssertTrue(same("+4", "4"))
        XCTAssertTrue(same("0,50", "1/2"))
        XCTAssertTrue(same(",5", "1/2"))
    }

    func testDifferentNumbersAndNonsense() {
        XCTAssertFalse(same("34", "3/4"), "AnswerCheck would accept this; the number check must not")
        XCTAssertFalse(same("12", "1/2"))
        XCTAssertFalse(same("0,7", "3/4"))
        XCTAssertFalse(same("3/4", "4/3"))
        XCTAssertFalse(same("2x", "2"))
        XCTAssertFalse(same("x", "2"))
        XCTAssertFalse(same("", "0"))
        XCTAssertFalse(same("1/0", "0"))
        XCTAssertFalse(same("1,2,3", "1"))
        XCTAssertFalse(same("1 2", "12"))
        XCTAssertFalse(same("1 3/2", "5/2"), "the fraction of a mixed number is proper")
        XCTAssertFalse(same("--2", "2"))
        XCTAssertFalse(same("2.", "2"))
        XCTAssertFalse(same("99999999999999999999", "1"))
        XCTAssertNil(NumberCheck.parse("abc"))
    }

    func testRationalArithmeticAndText() throws {
        let half = try XCTUnwrap(Rational(1, 2))
        let third = try XCTUnwrap(Rational(1, 3))
        XCTAssertEqual(half + third, Rational(5, 6))
        XCTAssertEqual(half - third, Rational(1, 6))
        XCTAssertEqual(half * third, Rational(1, 6))
        XCTAssertEqual(half / third, Rational(3, 2))
        XCTAssertNil(half / Rational(0))
        XCTAssertEqual(Rational(2, -4), Rational(-1, 2))
        XCTAssertNil(Rational(1, 0))
        XCTAssertTrue(third < half)
        XCTAssertEqual(try XCTUnwrap(Rational(3, 4)).germanText, "0,75")
        XCTAssertEqual(try XCTUnwrap(Rational(-3, 8)).germanText, "-0,375")
        XCTAssertEqual(try XCTUnwrap(Rational(1, 20)).germanText, "0,05")
        XCTAssertEqual(third.germanText, "1/3")
        XCTAssertEqual(Rational(7).germanText, "7")
        XCTAssertEqual(try XCTUnwrap(Rational(5, 2)).fractionText, "5/2")
        XCTAssertEqual(NumberCheck.parse("0,125"), Rational(1, 8))
    }

    func testTypedNumbersInAnExercise() throws {
        let exercise = try XCTUnwrap(Exercises.typed(id: "n", prompt: "3/8 + 3/8", answer: "3/4", mode: .number))
        XCTAssertEqual(exercise.missedKeys(for: .typed("0,75")), [])
        XCTAssertEqual(exercise.missedKeys(for: .typed("6/8")), [])
        XCTAssertEqual(exercise.missedKeys(for: .typed("34")), ["n"], "an exercise without cards stands for itself")
        XCTAssertNil(Exercises.typed(id: "bad", prompt: "?", answer: "drei", mode: .number))
    }
}
