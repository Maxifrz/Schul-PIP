import XCTest
@testable import Lernwerk

/// Unit 9, Quadratische Gleichungen und Funktionen: every equation in a prompt is read by the test's own expression
/// reader. The coefficients are found from three function values, the roots and the vertex from them with Double
/// arithmetic, and the solutions are plugged back into the equation.
final class MathCourseMiddleUnit09Tests: XCTestCase {
    private typealias Kit = MathMiddleTestKit
    private typealias Expr = MathMiddleTestExpression

    private func value(_ text: String, _ x: Double) -> Double? {
        Expr.evaluate(text, ["x": x])
    }

    /// a, b, c of the quadratic function given by the expression, from f(−1), f(0) and f(1).
    private func coefficients(_ expression: String) -> (a: Double, b: Double, c: Double)? {
        guard let left = value(expression, -1), let middle = value(expression, 0), let right = value(expression, 1) else { return nil }
        return ((left + right) / 2 - middle, (right - left) / 2, middle)
    }

    /// The expression of "left = right" as left − right.
    private func difference(_ equation: String) -> String? {
        let sides = equation.components(separatedBy: " = ")
        guard sides.count == 2 else { return nil }
        return "(\(sides[0])) − (\(sides[1]))"
    }

    private func roots(of equation: String) -> [Double]? {
        guard let expression = difference(equation), let k = coefficients(expression), abs(k.a) > 1e-9 else { return nil }
        let d = k.b * k.b - 4 * k.a * k.c
        if d < -1e-9 { return [] }
        if abs(d) <= 1e-9 { return [-k.b / (2 * k.a)] }
        return [(-k.b + d.squareRoot()) / (2 * k.a), (-k.b - d.squareRoot()) / (2 * k.a)].sorted()
    }

    /// "3 und −1" or "5" as numbers, sorted.
    private func solutionSet(_ text: String) -> [Double]? {
        let parts = text.components(separatedBy: " und ").map { Kit.number($0) }
        guard !parts.contains(where: { $0 == nil }) else { return nil }
        return parts.compactMap { $0 }.sorted()
    }

    private func same(_ a: [Double], _ b: [Double]) -> Bool {
        a.count == b.count && zip(a, b).allSatisfy { Kit.close($0, $1) }
    }

    /// After the first line of the prompt.
    private func body(_ p: MathMiddleProblem) -> String {
        p.prompt.components(separatedBy: "\n").dropFirst().joined(separator: "\n")
    }

    private func vertex(of equation: String) -> (x: Double, y: Double)? {
        guard equation.hasPrefix("y = "), let k = coefficients(String(equation.dropFirst(4))), abs(k.a) > 1e-9 else { return nil }
        let x = -k.b / (2 * k.a)
        guard let y = value(String(equation.dropFirst(4)), x) else { return nil }
        return (x, y)
    }

    private func typedMatches(_ p: MathMiddleProblem, _ expected: Double) -> String? {
        guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer \(String(describing: Kit.typedAnswer(p))) expected \(expected)" }
        return nil
    }

    /// The correct option and the typed answer are the roots of the equation; no wrong option is the same set.
    private func checkSolutions(_ p: MathMiddleProblem, equation: String, typedIsLarger: Bool?) -> String? {
        guard let truth = roots(of: equation), truth.count == 2 else { return "roots of \(equation)" }
        guard let given = solutionSet(p.correct), same(given, truth) else { return "correct option \(p.correct) roots \(truth)" }
        // The solutions plugged back in.
        for x in given {
            guard let expression = self.difference(equation), let residual = value(expression, x), abs(residual) < 1e-9 else { return "\(x) does not solve \(equation)" }
        }
        for option in p.options {
            guard let set = solutionSet(option) else { return "wrong option \(option)" }
            if same(set, truth) { return "wrong option \(option) is right" }
        }
        if let larger = typedIsLarger { return typedMatches(p, larger ? truth[1] : truth[0]) }
        return nil
    }

    func testVertexForm() {
        Kit.check("u09.vertexForm") { _, p in
            guard let m = Kit.match(#"^Lies den Scheitelpunkt ab\.\n(y = .+)$"#, p.prompt), let v = self.vertex(of: m[1]) else { return "prompt" }
            guard let s = Kit.match(#"^S\((.+)\|(.+)\)$"#, p.correct), Kit.close(Kit.number(s[1])!, v.x), Kit.close(Kit.number(s[2])!, v.y) else { return "correct \(p.correct) vertex \(v)" }
            guard p.pairFront == m[1] else { return "pair front" }
            let asksX = p.typed?.prompt.contains("x-Koordinate") == true
            return self.typedMatches(p, asksX ? v.x : v.y)
        }
    }

    func testShift() {
        Kit.check("u09.shift") { _, p in
            guard let v = self.vertex(of: self.body(p)) else { return "prompt" }
            guard let m = Kit.match(#"^(\d+) nach (rechts|links) und (\d+) nach (oben|unten)$"#, p.correct) else { return "correct text" }
            let x = (m[2] == "rechts" ? 1.0 : -1.0) * Double(m[1])!
            let y = (m[4] == "oben" ? 1.0 : -1.0) * Double(m[3])!
            guard Kit.close(x, v.x), Kit.close(y, v.y) else { return "\(p.correct) vertex \(v)" }
            return p.options.contains(p.correct) ? "right option among the wrong" : nil
        }
    }

    func testFunctionValue() {
        Kit.check("u09.functionValue") { _, p in
            guard let m = Kit.match(#"^Gegeben: f\(x\) = (.+)\nBerechne f\((.+)\)\.$"#, p.prompt), let x = Kit.number(m[2]), let y = self.value(m[1], x) else { return "prompt" }
            guard let right = Kit.number(p.correct), Kit.close(right, y) else { return "correct \(p.correct) expected \(y)" }
            for option in p.options {
                guard let v = Kit.number(option) else { return "wrong option \(option)" }
                if Kit.close(v, y) { return "wrong option \(option) is right" }
            }
            return self.typedMatches(p, y)
        }
    }

    func testExtremum() {
        Kit.check("u09.extremum") { _, p in
            let equation = self.body(p)
            guard let v = self.vertex(of: equation), let k = self.coefficients(String(equation.dropFirst(4))) else { return "prompt" }
            let lowest = k.a > 0
            if p.prompt.hasPrefix("Welchen") {
                guard p.prompt.contains(lowest ? "kleinsten" : "größten") else { return "wrong extreme" }
                guard let right = Kit.number(p.correct), Kit.close(right, v.y) else { return "correct \(p.correct) vertex \(v)" }
                // The value really is the extreme: compare with nearby points.
                for dx in [-1.0, -0.5, 0.5, 1.0] {
                    guard let near = self.value(String(equation.dropFirst(4)), v.x + dx) else { return "evaluation" }
                    if lowest ? near < v.y - 1e-9 : near > v.y + 1e-9 { return "not the extreme" }
                }
                return self.typedMatches(p, v.y)
            }
            guard p.prompt.contains(lowest ? "am kleinsten" : "am größten") else { return "wrong extreme" }
            guard let right = Kit.number(p.correct), Kit.close(right, v.x) else { return "correct \(p.correct) vertex \(v)" }
            return self.typedMatches(p, v.x)
        }
    }

    func testPureQuadratic() {
        Kit.check("u09.pureQuadratic") { _, p in
            let equation = self.body(p)
            if let message = self.checkSolutions(p, equation: equation, typedIsLarger: nil) { return message }
            guard let truth = self.roots(of: equation) else { return "roots" }
            return self.typedMatches(p, truth[1])
        }
    }

    func testFactorForm() {
        Kit.check("u09.factorForm") { _, p in
            let equation = self.body(p)
            guard equation.hasSuffix(" = 0") else { return "prompt" }
            return self.checkSolutions(p, equation: equation, typedIsLarger: p.typed?.prompt.contains("größere") == true)
        }
    }

    func testVertexZeros() {
        Kit.check("u09.vertexZeros") { level, p in
            let equation = self.body(p)
            guard equation.hasPrefix("y = ") else { return "prompt" }
            let asEquation = String(equation.dropFirst(4)) + " = 0"
            if level == 1, p.typed == nil { return "typed" }
            return self.checkSolutions(p, equation: asEquation, typedIsLarger: p.typed?.prompt.contains("größere") == true)
        }
    }

    func testPqSolve() {
        Kit.check("u09.pqSolve") { _, p in
            let equation = self.body(p)
            guard equation.hasSuffix(" = 0"), let k = self.coefficients(String(equation.dropLast(4))), Kit.close(k.a, 1) else { return "normal form" }
            guard p.pairFront == equation else { return "pair front" }
            return self.checkSolutions(p, equation: equation, typedIsLarger: p.typed?.prompt.contains("größere") == true)
        }
    }

    func testDiscriminant() {
        Kit.check("u09.discriminant") { _, p in
            let equation = self.body(p)
            guard let k = self.coefficients(String(equation.dropLast(4))), Kit.close(k.a, 1) else { return "normal form" }
            // D = (p/2)² − q, once by that formula and once as the discriminant b² − 4ac divided by 4.
            let d = (k.b / 2) * (k.b / 2) - k.c
            guard Kit.close(d, (k.b * k.b - 4 * k.a * k.c) / 4) else { return "discriminant formulas" }
            let expected = d < -1e-9 ? "keine Lösung" : (abs(d) <= 1e-9 ? "genau eine Lösung" : "zwei Lösungen")
            guard p.correct == expected else { return "correct \(p.correct) expected \(expected)" }
            guard let truth = self.roots(of: equation), truth.count == (d < -1e-9 ? 0 : (abs(d) <= 1e-9 ? 1 : 2)) else { return "root count" }
            guard let typed = p.typed, let typedEquation = Kit.match(#"\n(.+ = 0)$"#, typed.prompt), typedEquation[1] == equation else { return "typed prompt" }
            return self.typedMatches(p, d)
        }
    }

    func testDivideFirst() {
        Kit.check("u09.divideFirst") { _, p in
            let given = self.body(p)
            guard let kGiven = self.coefficients(String(given.dropLast(4))), kGiven.a > 1 else { return "prompt" }
            guard self.correctDivides(p, given: given, a: kGiven.a) else { return "correct \(p.correct)" }
            for option in p.options {
                if let truth = self.roots(of: option), let original = self.roots(of: given), self.same(truth, original) { return "wrong option \(option) keeps the roots" }
            }
            guard let typed = p.typed else { return "typed" }
            if typed.prompt.hasPrefix("Löse") {
                guard let original = self.roots(of: given) else { return "roots" }
                return self.typedMatches(p, original[original.count - 1])
            }
            guard let correct = self.coefficients(String(p.correct.dropLast(4))) else { return "correct coefficients" }
            return self.typedMatches(p, typed.prompt.contains("vor dem x") ? correct.b : correct.c)
        }
    }

    /// The correct equation is the given one with every coefficient divided by a, so x² stands alone.
    private func correctDivides(_ p: MathMiddleProblem, given: String, a: Double) -> Bool {
        guard let k = coefficients(String(given.dropLast(4))), let c = coefficients(String(p.correct.dropLast(4))), p.correct.hasSuffix(" = 0") else { return false }
        return Kit.close(c.a, 1) && Kit.close(c.b, k.b / a) && Kit.close(c.c, k.c / a)
    }

    func testVertexFromNormal() {
        Kit.check("u09.vertexFromNormal") { _, p in
            let equation = self.body(p)
            guard let v = self.vertex(of: equation) else { return "prompt" }
            guard let s = Kit.match(#"^S\((.+)\|(.+)\)$"#, p.correct), Kit.close(Kit.number(s[1])!, v.x), Kit.close(Kit.number(s[2])!, v.y) else { return "correct \(p.correct) vertex \(v)" }
            for option in p.options {
                guard let w = Kit.match(#"^S\((.+)\|(.+)\)$"#, option) else { return "wrong option \(option)" }
                if Kit.close(Kit.number(w[1])!, v.x) && Kit.close(Kit.number(w[2])!, v.y) { return "wrong option \(option) is right" }
            }
            return self.typedMatches(p, p.typed?.prompt.contains("x-Koordinate") == true ? v.x : v.y)
        }
    }
}
