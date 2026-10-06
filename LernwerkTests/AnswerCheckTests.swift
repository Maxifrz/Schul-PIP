import XCTest
@testable import Lernwerk

final class AnswerCheckTests: XCTestCase {
    private func verdict(_ answer: String, _ expected: String) -> AnswerCheck.Verdict {
        AnswerCheck.evaluate(answer: answer, expected: expected)
    }

    func testWordOrderFillerWordsAndSpellingDoNotMatter() {
        let expected = "Äußere Ableitung mal innere Ableitung"
        XCTAssertEqual(verdict("Äußere mal innere Ableitung", expected), .correct)
        XCTAssertEqual(verdict("aeussere mal innere ableitung", expected), .correct)
        XCTAssertEqual(verdict("Quotientenregel", "Die Quotientenregel"), .correct)
        XCTAssertEqual(verdict("kettenregl", "Kettenregel"), .correct)
        XCTAssertEqual(verdict("Ableitungen", "Ableitung"), .correct)
    }

    func testWrongOrMissingAnswers() {
        XCTAssertEqual(verdict("Produktregel", "Quotientenregel"), .wrong)
        XCTAssertEqual(verdict("Hauptstadt", "Berlin"), .wrong)
        XCTAssertEqual(verdict("   ", "Ableitung"), .wrong)
        XCTAssertEqual(verdict("Aeussere Ableitung", "Äußere Ableitung mal innere Ableitung"), .wrong)
        XCTAssertEqual(verdict("Photosynthese", "Die Photosynthese wandelt Licht in chemische Energie um"), .wrong)
    }

    func testLongAnswersNeedMostKeyWords() {
        XCTAssertEqual(verdict("Photosynthese wandelt Licht in chemische Energie", "Die Photosynthese wandelt Licht in chemische Energie um"), .correct)
    }

    func testNumbersAndFormulasMustBeExact() {
        XCTAssertEqual(verdict("0,5", "0.5"), .correct)
        XCTAssertEqual(verdict("x^2", "x²"), .correct)
        XCTAssertEqual(verdict("2x", "2 x"), .correct)
        XCTAssertEqual(verdict("12", "12"), .correct)
        XCTAssertEqual(verdict("3", "4"), .wrong)
        XCTAssertEqual(verdict("y", "x"), .wrong)
        XCTAssertEqual(verdict("Ableitung von x^3 ist 3x^3", "Die Ableitung von x^3 ist 3x^2"), .wrong)
        XCTAssertEqual(verdict("Ableitung von x^3 ist 3x^2", "Die Ableitung von x^3 ist 3x^2"), .correct)
    }

    func testAlternativesAcceptEitherPart() {
        XCTAssertEqual(verdict("Berlin", "Berlin / Bundeshauptstadt"), .correct)
        XCTAssertEqual(verdict("Bundeshauptstadt", "Berlin oder Bundeshauptstadt"), .correct)
        // A slash inside a fraction is not a separator.
        XCTAssertEqual(verdict("a/b", "a/b"), .correct)
        XCTAssertEqual(verdict("a", "a/b"), .wrong)
    }

    func testHelpers() {
        XCTAssertEqual(AnswerCheck.distance("kitten", "sitting"), 3)
        XCTAssertEqual(AnswerCheck.normalize("Äußere"), "aussere")
        XCTAssertEqual(AnswerCheck.tokens("pi = 3.14."), ["pi", "3.14"])
        XCTAssertTrue(AnswerCheck.keyTokens("die ableitung von f").contains("ableitung"))
        XCTAssertFalse(AnswerCheck.keyTokens("die ableitung von f").contains("die"))
    }
}
