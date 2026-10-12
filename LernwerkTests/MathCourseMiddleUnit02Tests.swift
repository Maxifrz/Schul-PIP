import XCTest
@testable import Lernwerk

/// Unit 2, Bruchrechnung: the expression in every prompt is evaluated again with Doubles.
final class MathCourseMiddleUnit02Tests: XCTestCase {
    private typealias Kit = MathMiddleTestKit
    private typealias Reader = MathMiddleTestExpression

    /// The line after "Berechne:" evaluated, or nil.
    private func value(of prompt: String) -> Double? {
        let lines = prompt.components(separatedBy: "\n")
        guard lines.count >= 2, lines[0] == "Berechne:" else { return nil }
        return Reader.evaluate(lines[1])
    }

    private func expression(of prompt: String) -> String {
        prompt.components(separatedBy: "\n").dropFirst().first ?? ""
    }

    /// Checks an arithmetic template: the expression, the typed answer, the right option, the wrong ones, the pair.
    private func checkArithmetic(_ id: String, positive: Bool = true, more: ((Int, MathMiddleProblem, Double) -> String?)? = nil) {
        Kit.check(id) { level, p in
            guard let expected = value(of: p.prompt) else { return "cannot read the expression" }
            if positive, expected <= 0 { return "result not positive" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer \(Kit.typedAnswer(p) ?? .nan) expected \(expected)" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct)" }
            for option in p.options {
                guard let wrong = Kit.number(option) else { return "wrong option \(option)" }
                if Kit.close(wrong, expected) { return "wrong option \(option) is right" }
            }
            guard p.pairFront == expression(of: p.prompt) else { return "pair front \(p.pairFront ?? "")" }
            if let message = more?(level, p, expected) { return message }
            return nil
        }
    }

    func testAdd() {
        checkArithmetic("u02.add") { level, p, expected in
            // Two proper fractions, and the denominators fit the level.
            let fractions = Kit.matches(#"(\d+)/(\d+)"#, self.expression(of: p.prompt)).map { (Int($0[1])!, Int($0[2])!) }
            guard fractions.count == 2, fractions.allSatisfy({ $0.0 < $0.1 && Kit.bruteGCD($0.0, $0.1) == 1 }) else { return "operands" }
            if level == 1, fractions[0].1 != fractions[1].1, fractions[1].1 % fractions[0].1 != 0 { return "level 1 denominators" }
            if expected > 2 { return "sum too big" }
            return nil
        }
    }

    func testSubtract() {
        checkArithmetic("u02.subtract") { _, p, expected in
            guard expected < 1 else { return "difference too big" }
            return nil
        }
    }

    func testMixedAddSub() {
        checkArithmetic("u02.mixedAddSub") { level, p, _ in
            let line = self.expression(of: p.prompt)
            if level == 3, !line.contains("−") { return "level 3 subtracts" }
            if level < 3, !line.contains("+") { return "levels 1 and 2 add" }
            guard let parts = Kit.match(#"^(\d+) (\d+)/(\d+) [+−] (\d+) (\d+)/(\d+)$"#, line) else { return "operands are two mixed numbers" }
            guard Int(parts[2])! < Int(parts[3])!, Int(parts[5])! < Int(parts[6])! else { return "improper fraction part" }
            return nil
        }
    }

    func testMultiply() {
        checkArithmetic("u02.multiply")
    }

    func testDivide() {
        checkArithmetic("u02.divide")
    }

    func testOrderOfOperations() {
        checkArithmetic("u02.order") { _, p, _ in
            // The expression with the wrong order (left to right) differs from the right result.
            let line = self.expression(of: p.prompt)
            guard !line.isEmpty else { return "no expression" }
            return nil
        }
    }

    func testMixedMulDiv() {
        checkArithmetic("u02.mixedMulDiv")
    }

    func testFitsIn() {
        Kit.check("u02.fitsIn") { _, p in
            let patterns = [
                #"Aus (.+?) l Saft werden Gläser zu (\d+/\d+) l"#,
                #"Ein Band ist (.+?) m lang\. Daraus werden Stücke zu (\d+/\d+) m"#,
                #"Ein Sack enthält (.+?) kg Mehl\. Jede Tüte fasst (\d+/\d+) kg"#,
            ]
            guard let m = patterns.compactMap({ Kit.match($0, p.prompt) }).first else { return "prompt" }
            guard let total = Kit.number(m[1]), let portion = Kit.number(m[2]) else { return "numbers" }
            let expected = total / portion
            guard Kit.close(expected, expected.rounded()), Kit.close(expected.rounded() * portion, total) else { return "not a whole number of portions: \(expected)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option" }
            for option in p.options {
                guard let wrong = Kit.number(option) else { return "wrong option" }
                if Kit.close(wrong, expected) { return "wrong option \(option) is right" }
            }
            return nil
        }
    }

    func testPartOfPart() {
        Kit.check("u02.partOfPart") { _, p in
            let first = p.prompt.components(separatedBy: "\n").first ?? ""
            let fractions = Kit.matches(#"(\d+)/(\d+)"#, first).map { Double($0[1])! / Double($0[2])! }
            guard fractions.count == 2 else { return "two fractions" }
            let expected = fractions[0] * fractions[1]
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option" }
            for option in p.options {
                guard let wrong = Kit.number(option) else { return "wrong option" }
                if Kit.close(wrong, expected) { return "wrong option \(option) is right" }
            }
            return nil
        }
    }

    func testWord() {
        Kit.check("u02.word") { _, p in
            let first = p.prompt.components(separatedBy: "\n").first ?? ""
            let expected: Double
            if let m = Kit.match(#"Für (\d+) Portionen braucht man (\d+)/(\d+)"#, first) {
                expected = Double(m[2])! / Double(m[3])! / Double(m[1])!
            } else {
                let fractions = Kit.matches(#"(\d+)/(\d+)"#, first).map { Double($0[1])! / Double($0[2])! }
                guard fractions.count == 2, fractions[0] + fractions[1] < 1 else { return "two fractions" }
                expected = 1 - fractions[0] - fractions[1]
            }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct)" }
            for option in p.options {
                guard let wrong = Kit.number(option) else { return "wrong option" }
                if Kit.close(wrong, expected) { return "wrong option \(option) is right" }
            }
            return nil
        }
    }
}
