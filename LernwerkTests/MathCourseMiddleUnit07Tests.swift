import XCTest
@testable import Lernwerk

/// Unit 7, Potenzen und Wurzeln: every expression in a prompt is evaluated by the test's own reader (Double
/// arithmetic, with letters taken as a number), and the roots are checked by raising the answer to the power again.
final class MathCourseMiddleUnit07Tests: XCTestCase {
    private typealias Kit = MathMiddleTestKit
    private typealias Expr = MathMiddleTestExpression

    /// All the letters the course uses as a base stand for the same number, so a law of powers can be checked by value.
    private let letters: [Character: Double] = ["x": 1.3, "a": 1.3, "y": 1.3, "z": 1.3]

    private func eval(_ text: String) -> Double? {
        Expr.evaluate(text.replacingOccurrences(of: "\u{202F}", with: ""), letters)
    }

    /// "Berechne <expression>." gives the expression.
    private func expression(after prefix: String, in prompt: String) -> String? {
        guard prompt.hasPrefix(prefix), prompt.hasSuffix(".") else { return nil }
        return String(prompt.dropFirst(prefix.count).dropLast())
    }

    private func differ(_ p: MathMiddleProblem, from expected: Double, parse: (String) -> Double?) -> String? {
        for option in p.options {
            guard let value = parse(option) else { return "wrong option \(option)" }
            if Kit.close(value, expected) { return "wrong option \(option) is right" }
        }
        return nil
    }

    /// The exponent of a power written with superscripts: "x⁷" gives 7.
    private func exponent(of power: String) -> Int? {
        let digits: [Character: Character] = ["⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9"]
        let text = String(power.compactMap { digits[$0] })
        return text.isEmpty ? (power.contains("⁻") ? nil : 1) : Int(text)
    }

    func testPowerValue() {
        Kit.check("u07.powerValue") { level, p in
            guard let text = self.expression(after: "Berechne ", in: p.prompt), let expected = self.eval(text) else { return "prompt" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct) expected \(expected)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed" }
            guard p.pairFront == text else { return "pair front" }
            if level == 3, !(text.hasPrefix("(")) { return "level 3 is a fraction or decimal in brackets" }
            if level < 3, text.contains("(") { return "no brackets below level 3" }
            return self.differ(p, from: expected, parse: Kit.number)
        }
    }

    func testNegativeBase() {
        Kit.check("u07.negativeBase") { level, p in
            guard let text = self.expression(after: "Berechne ", in: p.prompt), let expected = self.eval(text) else { return "prompt" }
            // The sign by counting minus factors, another way than evaluating.
            if let m = Kit.match(#"^(\(−(\d)\)|−(\d))(⁰|¹|²|³|⁴)$"#, text) {
                let base = Double(m[2].isEmpty ? m[3] : m[2])!
                let n = Double(self.exponent(of: m[4])!)
                let bracketed = !m[2].isEmpty
                let magnitude = pow(base, n)
                let negative = bracketed ? Int(n) % 2 == 1 : true
                guard Kit.close(expected, negative ? -magnitude : magnitude) else { return "sign by counting \(expected)" }
            } else if level != 3 {
                return "form \(text)"
            }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct) expected \(expected)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed" }
            if level == 1, !text.contains("²") { return "level 1 squares" }
            return self.differ(p, from: expected, parse: Kit.number)
        }
    }

    func testSquareRoot() {
        Kit.check("u07.squareRoot") { _, p in
            guard let text = self.expression(after: "Berechne ", in: p.prompt), text.hasPrefix("√"), let radicand = self.eval(String(text.dropFirst())) else { return "prompt" }
            guard let right = Kit.number(p.correct) else { return "correct" }
            // Squared again: the answer is the number the radicand comes from.
            guard Kit.close(right * right, radicand), right > 0 else { return "squared \(right) is not \(radicand)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, right) else { return "typed" }
            guard p.pairFront == text else { return "pair front" }
            return self.differ(p, from: right, parse: Kit.number)
        }
    }

    func testEstimateRoot() {
        Kit.check("u07.estimateRoot") { _, p in
            guard let m = Kit.match(#"liegt √(\d+)\?$"#, p.prompt), let n = Int(m[1]), let c = Kit.match(#"^(\d+) und (\d+)$"#, p.correct) else { return "prompt" }
            let (low, high) = (Int(c[1])!, Int(c[2])!)
            let root = Double(n).squareRoot()
            guard high == low + 1, Double(low) < root, root < Double(high) else { return "bounds \(low) \(high) for \(root)" }
            guard let typed = Kit.typedAnswer(p), Int(typed) == Int(root.rounded()) else { return "nearest whole number \(String(describing: Kit.typedAnswer(p))) for \(root)" }
            for option in p.options {
                guard let w = Kit.match(#"^(\d+) und (\d+)$"#, option) else { return "wrong option \(option)" }
                let (wl, wh) = (Double(w[1])!, Double(w[2])!)
                if wl < root, root < wh { return "wrong option \(option) contains the root" }
            }
            guard p.pairFront == "√\(n)" else { return "pair front" }
            return nil
        }
    }

    private func checkPower(_ p: MathMiddleProblem) -> String? {
        let lines = p.prompt.components(separatedBy: "\n")
        guard lines.count == 2, lines[0] == "Vereinfache zu einer Potenz:", let expected = eval(lines[1]) else { return "prompt" }
        guard let right = eval(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct) expected \(expected)" }
        guard let n = exponent(of: String(p.correct.drop(while: { !"⁰¹²³⁴⁵⁶⁷⁸⁹".contains($0) }))) ?? (p.correct.count <= 2 ? 1 : nil) else { return "exponent of \(p.correct)" }
        guard let typed = Kit.typedAnswer(p), Kit.close(typed, Double(n)) else { return "typed \(String(describing: Kit.typedAnswer(p))) expected \(n)" }
        guard p.pairFront == lines[1] else { return "pair front" }
        return differ(p, from: expected, parse: { self.eval($0) })
    }

    func testSameBase() {
        Kit.check("u07.sameBase") { level, p in
            if let message = self.checkPower(p) { return message }
            let expression = p.prompt.components(separatedBy: "\n")[1]
            if level == 1, expression.contains(":") || expression.contains("(") { return "level 1 multiplies two powers" }
            if level == 3, !(expression.contains("(") || expression.components(separatedBy: " · ").count == 3) { return "level 3 form" }
            return nil
        }
    }

    func testPowerOfPower() {
        Kit.check("u07.powerOfPower") { level, p in
            if let message = self.checkPower(p) { return message }
            let expression = p.prompt.components(separatedBy: "\n")[1]
            guard expression.hasPrefix("(") else { return "bracket first" }
            if level == 1, expression.contains(":") || expression.contains("·") { return "level 1 is a plain power of a power" }
            return nil
        }
    }

    func testSameExponent() {
        Kit.check("u07.sameExponent") { _, p in
            let lines = p.prompt.components(separatedBy: "\n")
            guard lines.count == 2, lines[0] == "Fasse zu einer Potenz zusammen:", let expected = self.eval(lines[1]) else { return "prompt" }
            guard let right = self.eval(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct) expected \(expected)" }
            guard let typedPrompt = p.typed?.prompt, typedPrompt.hasSuffix("Welche Zahl steht in der Basis?"), let typed = Kit.typedAnswer(p) else { return "typed prompt" }
            guard let base = Kit.match(#"^(\d+)[⁰¹²³⁴⁵⁶⁷⁸⁹]+$"#, p.correct), Kit.close(typed, Double(base[1])!) else { return "typed answer" }
            // Both factors have the same exponent.
            let exponents = Kit.matches(#"\d+([⁰¹²³⁴⁵⁶⁷⁸⁹]+)"#, lines[1]).map { $0[1] }
            guard exponents.count == 2, exponents[0] == exponents[1] else { return "same exponent" }
            return self.differ(p, from: expected, parse: { self.eval($0) })
        }
    }

    func testNegativeExponent() {
        Kit.check("u07.negativeExponent") { level, p in
            guard let m = Kit.match(#"^Schreibe (.+) als Bruch oder ganze Zahl\.$"#, p.prompt), let expected = self.eval(m[1]) else { return "prompt" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct) expected \(expected)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed" }
            guard m[1].contains("⁻") else { return "negative exponent" }
            if level < 3, m[1].contains("(") { return "brackets only at level 3" }
            guard p.pairFront == m[1] else { return "pair front" }
            return self.differ(p, from: expected, parse: Kit.number)
        }
    }

    func testScientific() {
        Kit.check("u07.scientific") { level, p in
            guard let m = Kit.match(#"^Schreibe (.+) in der Form a · 10ⁿ mit 1 ≤ a < 10\.$"#, p.prompt) else { return "prompt" }
            let shown = m[1].replacingOccurrences(of: "\u{202F}", with: "")
            guard let target = Kit.number(shown) else { return "number" }
            func parts(_ text: String) -> (mantissa: Double, exponent: Int)? {
                guard let q = Kit.match(#"^(\d+(?:,\d+)?) · 10(⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)$"#, text), let mantissa = Kit.number(q[1]) else { return nil }
                let negative = q[2].hasPrefix("⁻")
                guard let e = self.exponent(of: q[2]) else { return nil }
                return (mantissa, negative ? -e : e)
            }
            guard let right = parts(p.correct), right.mantissa >= 1, right.mantissa < 10 else { return "correct option \(p.correct)" }
            guard Kit.close(right.mantissa * pow(10, Double(right.exponent)), target) else { return "value of \(p.correct) is not \(target)" }
            // Written out by moving the comma: the digits of the mantissa without comma, shifted.
            if level == 3, right.exponent >= 0 { return "level 3 is small numbers" }
            if level < 3, right.exponent < 0 { return "levels 1 and 2 are big numbers" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, Double(right.exponent)) else { return "typed" }
            for option in p.options {
                guard let w = parts(option) else { return "wrong option \(option)" }
                let sameValue = Kit.close(w.mantissa * pow(10, Double(w.exponent)), target)
                let normalised = w.mantissa >= 1 && w.mantissa < 10
                if sameValue && normalised { return "wrong option \(option) is right" }
            }
            return nil
        }
    }

    func testRootOfSum() {
        Kit.check("u07.rootOfSum") { level, p in
            guard let text = self.expression(after: "Berechne ", in: p.prompt), text.hasPrefix("√("), let expected = self.eval(text) else { return "prompt" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected), expected == expected.rounded() else { return "correct option \(p.correct) expected \(expected)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed" }
            // The radicand is a perfect square: the answer squared is the radicand.
            guard let radicand = self.eval(String(text.dropFirst())), Kit.close(expected * expected, radicand) else { return "radicand" }
            if level == 1, text.contains("\u{2212}") { return "level 1 adds" }
            if level == 3, !text.contains("\u{2212}") { return "level 3 subtracts" }
            return self.differ(p, from: expected, parse: Kit.number)
        }
    }

    func testCubeRoot() {
        Kit.check("u07.cubeRoot") { level, p in
            guard let text = self.expression(after: "Berechne ³√", in: p.prompt), let radicand = self.eval(text) else { return "prompt" }
            guard let right = Kit.number(p.correct) else { return "correct" }
            // Cubed again: the answer is the number the radicand comes from.
            guard Kit.close(right * right * right, radicand) else { return "cubed \(right) is not \(radicand)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, right) else { return "typed" }
            if level < 3, radicand < 0 || text.contains("/") || text.contains(",") { return "plain cubes below level 3" }
            guard p.pairFront == "³√" + text else { return "pair front \(p.pairFront ?? "")" }
            return self.differ(p, from: right, parse: Kit.number)
        }
    }
}
