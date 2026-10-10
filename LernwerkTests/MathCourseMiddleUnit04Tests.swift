import XCTest
@testable import Lernwerk

/// Unit 4, Terme und lineare Gleichungen: terms are compared by evaluating them at several points, equations by
/// putting the solution back in, the stories by trying every whole number.
final class MathCourseMiddleUnit04Tests: XCTestCase {
    private typealias Kit = MathMiddleTestKit
    private typealias Expr = MathMiddleTestExpression

    private static let samples: [Double] = [-4, -3, -1, 0, 1, 2, 3, 5, 7]

    /// The text of the last line of a prompt: the expression or the equation.
    private func lastLine(_ prompt: String) -> String {
        prompt.components(separatedBy: "\n").last ?? ""
    }

    /// Whether two terms have the same value at every sample point.
    private func equivalent(_ a: String, _ b: String) -> Bool? {
        for x in Self.samples {
            guard let left = Expr.evaluate(a, ["x": x]), let right = Expr.evaluate(b, ["x": x]) else { return nil }
            if !Kit.close(left, right) { return false }
        }
        return true
    }

    /// The constant and the coefficient of a term that is linear in x, found by evaluating at 0 and 1.
    private func linearParts(_ term: String) -> (coefficient: Double, constant: Double)? {
        guard let atZero = Expr.evaluate(term, ["x": 0]), let atOne = Expr.evaluate(term, ["x": 1]) else { return nil }
        return (atOne - atZero, atZero)
    }

    func testEvalTerm() {
        Kit.check("u04.evalTerm") { level, p in
            guard let m = Kit.match(#"^Berechne den Wert von (.+) für x = (−?\d+)\.$"#, p.prompt), let x = Kit.number(m[2]) else { return "prompt" }
            guard let expected = Expr.evaluate(m[1], ["x": x]) else { return "term \(m[1])" }
            if level == 3, !m[1].contains("²") { return "level 3 has a square" }
            if level == 1, x <= 0 { return "level 1 has positive x" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct) expected \(expected)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer" }
            for option in p.options {
                guard let value = Kit.number(option) else { return "wrong option \(option)" }
                if Kit.close(value, expected) { return "wrong option \(option) is right" }
            }
            guard p.pairFront == "\(m[1]) für x = \(m[2])" else { return "pair front" }
            // The worked result ends in the answer.
            guard let last = Kit.matches(#"= (−?\d+)$"#, p.solution).last.flatMap({ Kit.number($0[1]) }), Kit.close(last, expected) else { return "solution \(p.solution)" }
            return nil
        }
    }

    func testSimplify() {
        Kit.check("u04.simplify") { level, p in
            let expression = self.lastLine(p.prompt)
            guard p.prompt.hasPrefix("Fasse zusammen:\n"), let parts = self.linearParts(p.correct) else { return "prompt" }
            guard self.equivalent(expression, p.correct) == true else { return "correct option \(p.correct) differs from the term" }
            // Neither x-terms nor numbers are lost.
            guard parts.coefficient != 0, parts.constant != 0 else { return "degenerate result" }
            guard let typed = Kit.typedAnswer(p), let typedPrompt = p.typed?.prompt else { return "typed" }
            let asksCoefficient = typedPrompt.contains("vor dem x")
            guard Kit.close(typed, asksCoefficient ? parts.coefficient : parts.constant) else { return "typed answer \(typed)" }
            if asksCoefficient, abs(parts.coefficient) == 1 { return "asks for an invisible 1" }
            for option in p.options where self.equivalent(expression, option) != false { return "wrong option \(option) is equivalent" }
            guard p.pairFront == expression else { return "pair front" }
            // Level 1 has no minus; levels 2 and 3 have.
            if level == 1, expression.contains("\u{2212}") { return "level 1 without minus" }
            if level >= 2, !expression.contains("\u{2212}") { return "levels 2 and 3 subtract" }
            return nil
        }
    }

    func testExpand() {
        Kit.check("u04.expand") { level, p in
            let expression = self.lastLine(p.prompt)
            guard p.prompt.hasPrefix("Löse die Klammer auf:\n"), let parts = self.linearParts(p.correct) else { return "prompt" }
            guard self.equivalent(expression, p.correct) == true else { return "correct option \(p.correct) differs from \(expression)" }
            guard !p.correct.contains("("), expression.contains("(") else { return "bracket" }
            guard let typed = Kit.typedAnswer(p), let typedPrompt = p.typed?.prompt else { return "typed" }
            let asksCoefficient = typedPrompt.contains("vor dem x")
            guard Kit.close(typed, asksCoefficient ? parts.coefficient : parts.constant) else { return "typed answer" }
            for option in p.options where self.equivalent(expression, option) != false { return "wrong option \(option) is equivalent" }
            let hard = Kit.match(#"^\d+ \u2212 \d+\(x \+ \d+\)$"#, expression) != nil || Kit.match(#"^\d+\(\d+x \u2212 \d+\)$"#, expression) != nil
            if level == 3, !hard { return "level 3 form \(expression)" }
            if level < 3, hard { return "hard form below level 3" }
            guard p.pairFront == expression else { return "pair front" }
            return nil
        }
    }

    /// "Löse die Gleichung. Welchen Wert hat x?" plus the equation; the solution fits, the wrong options do not.
    private func solveCheck(_ p: MathMiddleProblem) -> (equation: String, x: Double)? {
        let equation = lastLine(p.prompt)
        guard p.prompt.hasPrefix("Löse die Gleichung. Welchen Wert hat x?\n"), let x = Kit.number(p.correct) else { return nil }
        return (equation, x)
    }

    private func checkEquation(_ p: MathMiddleProblem) -> String? {
        guard let (equation, x) = solveCheck(p) else { return "prompt" }
        guard Expr.holds(equation, x: x) == true else { return "the solution \(p.correct) does not fit \(equation)" }
        // A linear equation with one solution: the sides differ at two other points.
        guard Expr.holds(equation, x: x + 1) == false, Expr.holds(equation, x: x - 2) == false else { return "not a single solution" }
        guard let typed = Kit.typedAnswer(p), Kit.close(typed, x) else { return "typed answer" }
        for option in p.options {
            guard let value = Kit.number(option) else { return "wrong option \(option)" }
            if Expr.holds(equation, x: value) != false { return "wrong option \(option) solves the equation" }
        }
        guard p.pairFront == equation else { return "pair front" }
        guard p.solution.contains("stimmt") || p.solution.contains("="), p.solution.contains(MathMiddleText.int(Int(x))) else { return "solution" }
        return nil
    }

    func testOneStep() {
        Kit.check("u04.oneStep") { level, p in
            if let message = self.checkEquation(p) { return message }
            let equation = self.lastLine(p.prompt)
            func whole(_ text: String) -> Int { Int(text.replacingOccurrences(of: "\u{2212}", with: "-"))! }
            // Each of the four forms solved by trying every whole number.
            let solutions: [Int]
            if let m = Kit.match(#"^x \+ (\d+) = (\u2212?\d+)$"#, equation) {
                solutions = (-300...300).filter { $0 + whole(m[1]) == whole(m[2]) }
            } else if let m = Kit.match(#"^x \u2212 (\d+) = (\u2212?\d+)$"#, equation) {
                solutions = (-300...300).filter { $0 - whole(m[1]) == whole(m[2]) }
            } else if let m = Kit.match(#"^(\u2212?\d+)x = (\u2212?\d+)$"#, equation) {
                solutions = (-300...300).filter { whole(m[1]) * $0 == whole(m[2]) }
            } else if let m = Kit.match(#"^x : (\d+) = (\u2212?\d+)$"#, equation) {
                solutions = (-300...300).filter { $0 % whole(m[1]) == 0 && $0 / whole(m[1]) == whole(m[2]) }
            } else {
                return "form \(equation)"
            }
            guard solutions.count == 1, let right = Kit.number(p.correct), Int(right) == solutions[0] else { return "brute force \(solutions)" }
            if level == 1, !(equation.hasPrefix("x + ") || equation.hasPrefix("x \u{2212} ")) { return "level 1 adds and subtracts" }
            if level == 1, right < 1 { return "level 1 has positive solutions" }
            return nil
        }
    }

    func testTwoStep() {
        Kit.check("u04.twoStep") { level, p in
            if let message = self.checkEquation(p) { return message }
            let equation = self.lastLine(p.prompt)
            guard let m = Kit.match(#"^(−?\d*)x (\+|−) (\d+) = (−?\d+)$"#, equation) else { return "form \(equation)" }
            let a = m[1].isEmpty ? 1 : (m[1] == "\u{2212}" ? -1 : Int(m[1].replacingOccurrences(of: "\u{2212}", with: "-"))!)
            guard abs(a) >= 2 else { return "factor \(a)" }
            if level == 1, a < 0 { return "level 1 positive" }
            // Brute force over the whole numbers, no algebra.
            let b = Int(m[3])! * (m[2] == "+" ? 1 : -1)
            let c = Int(m[4].replacingOccurrences(of: "\u{2212}", with: "-"))!
            let solutions = (-60...60).filter { a * $0 + b == c }
            guard solutions.count == 1, let right = Kit.number(p.correct), Int(right) == solutions[0] else { return "brute force \(solutions)" }
            return nil
        }
    }

    func testBrackets() {
        Kit.check("u04.brackets") { level, p in
            if let message = self.checkEquation(p) { return message }
            let equation = self.lastLine(p.prompt)
            guard let m = Kit.match(#"^(\d)\(x (\+|−) (\d)\)(?: (\+|−) (\d+))? = (−?\d+)$"#, equation) else { return "form \(equation)" }
            let a = Int(m[1])!
            let shift = Int(m[3])! * (m[2] == "+" ? 1 : -1)
            let d = m[4].isEmpty ? 0 : Int(m[5])! * (m[4] == "+" ? 1 : -1)
            let e = Int(m[6].replacingOccurrences(of: "\u{2212}", with: "-"))!
            let solutions = (-60...60).filter { a * ($0 + shift) + d == e }
            guard solutions.count == 1, let right = Kit.number(p.correct), Int(right) == solutions[0] else { return "brute force" }
            if level < 3, d != 0 { return "outside number only at level 3" }
            if level == 3, d == 0 { return "level 3 has a number outside" }
            if level == 1, shift < 0 { return "level 1 adds inside" }
            return nil
        }
    }

    func testBothSides() {
        Kit.check("u04.bothSides") { level, p in
            if let message = self.checkEquation(p) { return message }
            let equation = self.lastLine(p.prompt)
            let sides = equation.components(separatedBy: " = ")
            guard sides.count == 2, sides.allSatisfy({ $0.contains("x") }) else { return "x on both sides" }
            if level == 3, !sides[0].contains("(") { return "level 3 has a bracket" }
            if level < 3, equation.contains("(") { return "brackets only at level 3" }
            // Different slopes: exactly one solution, and two sample points give two different differences.
            let diff0 = Expr.evaluate(sides[0], ["x": 0])! - Expr.evaluate(sides[1], ["x": 0])!
            let diff1 = Expr.evaluate(sides[0], ["x": 1])! - Expr.evaluate(sides[1], ["x": 1])!
            guard diff0 != diff1 else { return "parallel sides" }
            // The solution by the intercept formula, another way than the generator's.
            guard Kit.close(-diff0 / (diff1 - diff0), Kit.number(p.correct)!) else { return "intercept formula" }
            return nil
        }
    }

    func testPlugIn() {
        Kit.check("u04.plugIn") { level, p in
            let equation = self.lastLine(p.prompt)
            guard p.prompt.hasPrefix("Welche Zahl ist die Lösung der Gleichung? Setze zur Probe ein.\n"), let x = Kit.number(p.correct) else { return "prompt" }
            let sides = equation.components(separatedBy: " = ")
            guard sides.count == 2, Expr.holds(equation, x: x) == true else { return "the solution does not fit" }
            for option in p.options {
                guard let value = Kit.number(option) else { return "wrong option \(option)" }
                if Expr.holds(equation, x: value) != false { return "wrong option \(option) fits" }
            }
            guard let typedPrompt = p.typed?.prompt, let m = Kit.match(#"Die Lösung der Gleichung (.+) ist x = (−?\d+)\.\nWelchen Wert haben beide Seiten"#, typedPrompt) else { return "typed prompt" }
            guard m[1] == equation, Kit.number(m[2]) == x else { return "typed equation" }
            let both = Expr.evaluate(sides[0], ["x": x])!
            guard Kit.close(both, Expr.evaluate(sides[1], ["x": x])!), let typed = Kit.typedAnswer(p), Kit.close(typed, both) else { return "typed answer" }
            if level == 3, !sides[0].contains("(") { return "level 3 has a bracket" }
            return nil
        }
    }

    func testWord() {
        Kit.check("u04.word") { level, p in
            guard let right = Kit.number(p.correct) else { return "correct" }
            let prompt = p.prompt.replacingOccurrences(of: "\n", with: " ")
            var truth: [Int] = []
            if let m = Kit.match(#"^Ich denke mir eine Zahl\. (Ich verdopple sie|Ich multipliziere sie mit (\d+)) und (addiere|subtrahiere) (\d+)\. Das Ergebnis ist (\d+)\."#, prompt) {
                guard level == 1 else { return "puzzle only at level 1" }
                let factor = m[1] == "Ich verdopple sie" ? 2 : Int(m[2])!
                let b = Int(m[4])! * (m[3] == "addiere" ? 1 : -1)
                let result = Int(m[5])!
                truth = (0...300).filter { factor * $0 + b == result }
            } else if let m = Kit.match(#"(\d+) € (?:Grundgebühr|Pauschale|für die Anfahrt) und (\d+) € je .+?(\d+) €"#, prompt) {
                guard level == 2 else { return "tariff only at level 2" }
                let (b, a, c) = (Int(m[1])!, Int(m[2])!, Int(m[3])!)
                truth = (0...300).filter { b + a * $0 == c }
            } else if let m = Kit.match(#"hat (\d+) € und spart (\d+) € pro Woche\. \w+ hat (\d+) € und spart (\d+) € pro Woche"#, prompt) {
                guard level == 3 else { return "equal amounts only at level 3" }
                let (p1, r1, p2, r2) = (Int(m[1])!, Int(m[2])!, Int(m[3])!, Int(m[4])!)
                truth = (0...300).filter { p1 + r1 * $0 == p2 + r2 * $0 }
                guard r1 - r2 >= 2 else { return "rates too close" }
            } else {
                return "prompt"
            }
            guard truth.count == 1, Int(right) == truth[0] else { return "brute force \(truth) vs \(p.correct)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, right) else { return "typed" }
            for option in p.options {
                guard let value = Kit.number(option) else { return "wrong option" }
                if Kit.close(value, right) { return "wrong option \(option) is right" }
            }
            if right < 2 { return "answer too small for a plural" }
            return nil
        }
    }
}
