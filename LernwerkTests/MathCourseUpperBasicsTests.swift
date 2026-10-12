import XCTest
@testable import Lernwerk

final class MathCourseUpperBasicsTests: XCTestCase {
    func testFractions() {
        XCTAssertEqual(UQ(2, 4), UQ(1, 2))
        XCTAssertEqual(UQ(1, -2), UQ(-1, 2))
        XCTAssertEqual(UQ(1, 2) + UQ(1, 3), UQ(5, 6))
        XCTAssertEqual(UQ(3, 4) * UQ(2, 3), UQ(1, 2))
        XCTAssertEqual(UQ(1, 2) / UQ(1, 4), UQ(2))
        XCTAssertEqual(UQ(3, 8).text, "0,375")
        XCTAssertEqual(UQ(1, 3).text, "1/3")
        XCTAssertEqual(UQ(-1, 2).typed, "-0,5")
        XCTAssertEqual(UQ(-1, 2).text, "−0,5")
        XCTAssertTrue(UQ(1, 36).isNice)
        XCTAssertFalse(UQ(1, 37).isNice)
    }

    func testPolynomialPrinting() {
        XCTAssertEqual(UPoly(ints: [1, -4, 3]).text, "3x² − 4x + 1")
        XCTAssertEqual(UPoly(ints: [0, 0, 0, 1]).text, "x³")
        XCTAssertEqual(UPoly(ints: [2, 0, -1]).text, "−x² + 2")
        XCTAssertEqual(UPoly(ints: [-5]).text, "−5")
        XCTAssertEqual(UPoly(ints: [0, -1]).text, "−x")
        XCTAssertEqual(UPoly(ints: [0, 1, 0, 0, 0, 0, 3]).text, "3x⁶ + x")
        XCTAssertEqual(UPoly(ints: []).text, "0")
        XCTAssertEqual(UPoly(ints: [0, 0, 0, 1]).integral.text, "x⁴/4")
        XCTAssertEqual(UPoly(ints: [0, 0, 2]).integral.text, "2x³/3")
        XCTAssertEqual(UPoly(ints: [3, 1]).integral.text, "x²/2 + 3x")
    }

    func testPolynomialAlgebra() {
        let f = UPoly.fromRoots(lead: UQ(2), roots: [UQ(1), UQ(-3)])
        XCTAssertEqual(f, UPoly(ints: [-6, 4, 2]))
        XCTAssertEqual(f.eval(UQ(1)), .zero)
        XCTAssertEqual(f.eval(UQ(-3)), .zero)
        XCTAssertEqual(f.derivative, UPoly(ints: [4, 4]))
        XCTAssertEqual(f.integral.derivative, f)
        XCTAssertEqual(UPoly(ints: [1, 1]) * UPoly(ints: [-1, 1]), UPoly(ints: [-1, 0, 1]))
        XCTAssertEqual(UPoly(ints: [1, 2, 3]).eval(UQ(2)), UQ(17))
    }

    func testBinomialCoefficientsAgainstPascal() {
        for n in 0...12 {
            let row = MathUpperKit.binomialDoubles(n)
            for k in 0...n { XCTAssertEqual(Double(MathUpperUnit07.binomial(n, k)), row[k], "\(n) over \(k)") }
        }
        XCTAssertEqual(MathUpperUnit07.binomial(5, 2), 10)
        XCTAssertEqual(MathUpperUnit07.binomial(3, 4), 0)
    }

    func testExactBinomialProbabilitiesSumToOne() {
        for n in 1...6 {
            for p in [UQ(1, 2), UQ(1, 4), UQ(1, 5), UQ(3, 10), UQ(7, 10)] {
                var total = UQ.zero
                for k in 0...n { total = total + MathUpperUnit07.pmf(n, p, k) }
                XCTAssertEqual(total, .one, "n=\(n) p=\(p.fraction)")
            }
        }
    }

    func testExactTrigTable() {
        for fn in ["sin", "cos", "tan"] {
            for degrees in stride(from: -360, through: 720, by: 15) {
                let value = MathUpperUnit05.exact(fn, degrees)
                let radians = Double(degrees) * Double.pi / 180
                if let value, let parsed = MathUpperKit.parseExact(value.text) {
                    XCTAssertEqual(parsed, MathUpperKit.trig(fn, radians), accuracy: 1e-9, "\(fn) \(degrees)")
                } else if value != nil {
                    XCTFail("unreadable exact text for \(fn) \(degrees)")
                }
            }
        }
        XCTAssertNil(MathUpperUnit05.exact("tan", 90))
    }

    func testAnswerCheckAcceptsFractionAndDecimal() {
        XCTAssertTrue(NumberCheck.matches("0,375", expected: "3/8"))
        XCTAssertTrue(NumberCheck.matches("3/8", expected: UQ(3, 8).typed))
        XCTAssertTrue(NumberCheck.matches("−2", expected: UQ(-2).typed))
        XCTAssertFalse(NumberCheck.matches("38", expected: "3/8"))
    }
}
