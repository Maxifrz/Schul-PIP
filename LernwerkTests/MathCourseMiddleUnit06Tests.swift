import XCTest
@testable import Lernwerk

/// Unit 6, Lineare Funktionen: every line is read back from its text and evaluated with the test's own reader;
/// answers are checked by putting points into the lines and by brute force, wrong options by being no solution.
final class MathCourseMiddleUnit06Tests: XCTestCase {
    private typealias Kit = MathMiddleTestKit
    private typealias Expr = MathMiddleTestExpression

    private let number = #"(−?\d+(?:,\d+)?)"#

    /// The value of the right side of "y = ..." at x.
    private func value(of line: String, at x: Double) -> Double? {
        guard line.hasPrefix("y = ") else { return nil }
        return Expr.evaluate(String(line.dropFirst(4)), ["x": x])
    }

    /// Slope and intercept of a line; nil unless it is a straight line.
    private func parts(_ line: String) -> (m: Double, b: Double)? {
        guard let f0 = value(of: line, at: 0), let f1 = value(of: line, at: 1), let f3 = value(of: line, at: 3), let fm = value(of: line, at: -2) else { return nil }
        let m = f1 - f0
        guard Kit.close(f3, f0 + 3 * m), Kit.close(fm, f0 - 2 * m) else { return nil }
        return (m, f0)
    }

    private func lastLine(_ prompt: String) -> String { prompt.components(separatedBy: "\n").last ?? "" }

    private func points(_ text: String) -> [(name: String, x: Double, y: Double)] {
        Kit.matches(#"([PQ])\("# + number + #"\|"# + number + #"\)"#, text).map { ($0[1], Kit.number($0[2])!, Kit.number($0[3])!) }
    }

    func testReadEquation() {
        Kit.check("u06.readEquation") { level, p in
            let equation = self.lastLine(p.prompt)
            guard let (m, b) = self.parts(equation), b != 0, m != 0 else { return "equation \(equation)" }
            let asksSlope = p.prompt.hasPrefix("Welche Steigung")
            guard asksSlope || p.prompt.hasPrefix("Wie groß ist der y-Achsenabschnitt") else { return "prompt" }
            let expected = asksSlope ? m : b
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct) expected \(expected)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer" }
            let mistakes = asksSlope ? [b, 1 / m, m + b, m * b] : [m, -b / m, b + m, m * b]
            for option in p.options {
                guard let value = Kit.number(option) else { return "wrong option \(option)" }
                if Kit.close(value, expected) { return "wrong option \(option) is right" }
                if !mistakes.contains(where: { Kit.close($0, value) }) { return "wrong option \(option) is no known mistake" }
            }
            let swapped = !equation.hasPrefix("y = ") || Kit.match(#"^y = −?\d+ [+−] "#, equation) != nil && equation.contains("x") && !equation.hasSuffix("x") == false
            _ = swapped
            if level == 1, m < 1 || m != m.rounded() { return "level 1 has whole positive slopes" }
            guard p.pairFront == "\(asksSlope ? "Steigung" : "y-Achsenabschnitt") von \(equation)" else { return "pair front" }
            return nil
        }
    }

    func testFunctionValue() {
        Kit.check("u06.functionValue") { level, p in
            let lines = p.prompt.components(separatedBy: "\n")
            guard lines.count == 2, let m = Kit.match(#"^Gegeben: f\(x\) = (.+)$"#, lines[0]), let (slope, _) = self.parts("y = " + m[1]) else { return "prompt" }
            let rule = "y = " + m[1]
            if let ask = Kit.match(#"^Berechne f\("# + self.number + #"\)\.$"#, lines[1]) {
                let x = Kit.number(ask[1])!
                let expected = self.value(of: rule, at: x)!
                guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option" }
                guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed" }
                for option in p.options {
                    guard let value = Kit.number(option) else { return "wrong option" }
                    if Kit.close(value, expected) { return "wrong option \(option) is right" }
                }
                if level == 1, x <= 0 || slope <= 0 { return "level 1 positive" }
                guard p.pairFront == "f(x) = \(m[1]), f(\(ask[1]))" else { return "pair front" }
                return nil
            }
            if let ask = Kit.match(#"^Für welches x gilt f\(x\) = "# + self.number + #"\?$"#, lines[1]) {
                guard level == 3 else { return "inverse only at level 3" }
                let y = Kit.number(ask[1])!
                guard let right = Kit.number(p.correct), let atRight = self.value(of: rule, at: right), Kit.close(atRight, y) else { return "the solution does not fit" }
                guard let typed = Kit.typedAnswer(p), Kit.close(typed, right) else { return "typed" }
                for option in p.options {
                    guard let value = Kit.number(option) else { return "wrong option" }
                    if let at = self.value(of: rule, at: value), Kit.close(at, y) { return "wrong option \(option) fits" }
                }
                return nil
            }
            return "second line"
        }
    }

    func testSlopeTriangle() {
        Kit.check("u06.slopeTriangle") { level, p in
            guard let m = Kit.match(#"gehst du (\d+) Einheiten nach rechts und (\d+) Einheiten nach (oben|unten)"#, p.prompt) else { return "prompt" }
            let (dx, up) = (Double(m[1])!, Double(m[2])!)
            let dy = m[3] == "oben" ? up : -up
            let expected = dy / dx
            guard abs(expected) != 1 else { return "slope 1" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed" }
            // Rising lines have a positive slope, falling ones a negative one.
            guard (expected > 0) == (m[3] == "oben") else { return "direction" }
            let mistakes = [dx / up * (dy > 0 ? 1 : -1), dx + up, (up - dx) * (dy > 0 ? 1 : -1) , dy]
            for option in p.options {
                guard let value = Kit.number(option) else { return "wrong option" }
                if Kit.close(value, expected) { return "wrong option \(option) is right" }
                if !mistakes.contains(where: { Kit.close($0, value) }) { return "wrong option \(option) is no known mistake" }
            }
            if level == 1, dy <= 0 || dy.truncatingRemainder(dividingBy: dx) != 0 { return "level 1 rises evenly" }
            return nil
        }
    }

    func testZeroPoint() {
        Kit.check("u06.zeroPoint") { level, p in
            let equation = self.lastLine(p.prompt)
            guard p.prompt.hasPrefix("Berechne die Nullstelle"), let (m, b) = self.parts(equation), let zero = Kit.number(p.correct) else { return "prompt" }
            guard let atZero = self.value(of: equation, at: zero), abs(atZero) < 1e-9 else { return "f at the zero is \(String(describing: self.value(of: equation, at: zero)))" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, zero) else { return "typed" }
            for option in p.options {
                guard let value = Kit.number(option), let at = self.value(of: equation, at: value) else { return "wrong option" }
                if abs(at) < 1e-9 { return "wrong option \(option) is a zero" }
                if ![b / m, m / b, b, m + b].contains(where: { Kit.close($0, value) }) { return "wrong option \(option) is no known mistake" }
            }
            if level == 3, zero == zero.rounded() { return "level 3 has fractions" }
            return nil
        }
    }

    func testSlopeTwoPoints() {
        Kit.check("u06.slopeTwoPoints") { _, p in
            let pts = self.points(p.prompt)
            guard pts.count == 2, pts[0].x != pts[1].x else { return "points" }
            let expected = (pts[1].y - pts[0].y) / (pts[1].x - pts[0].x)
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct)" }
            // The line through P with this slope runs through Q.
            guard Kit.close(pts[0].y + right * (pts[1].x - pts[0].x), pts[1].y) else { return "Q is not on the line" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed" }
            let (dx, dy) = (pts[1].x - pts[0].x, pts[1].y - pts[0].y)
            let mistakes = [dx / dy, (pts[1].y + pts[0].y) / (pts[1].x + pts[0].x), dy, dx]
            for option in p.options {
                guard let value = Kit.number(option) else { return "wrong option" }
                if Kit.close(value, expected) { return "wrong option \(option) is right" }
                if !mistakes.contains(where: { Kit.close($0, value) }) { return "wrong option \(option) is no known mistake" }
            }
            guard p.pairFront == "P(\(self.text(pts[0].x))|\(self.text(pts[0].y))), Q(\(self.text(pts[1].x))|\(self.text(pts[1].y)))" else { return "pair front \(p.pairFront ?? "")" }
            return nil
        }
    }

    /// A whole number the way the course writes it.
    private func text(_ value: Double) -> String { MathMiddleText.int(Int(value)) }

    func testYIntercept() {
        Kit.check("u06.yIntercept") { _, p in
            guard let m = Kit.match(#"Steigung "# + self.number + #" und geht durch "# + "P\\(" + self.number + #"\|"# + self.number + #"\)"#, p.prompt) else { return "prompt" }
            let (slope, x, y) = (Kit.number(m[1])!, Kit.number(m[2])!, Kit.number(m[3])!)
            guard let b = Kit.number(p.correct), Kit.close(slope * x + b, y) else { return "the point is not on the line" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, b) else { return "typed" }
            for option in p.options {
                guard let value = Kit.number(option) else { return "wrong option" }
                if Kit.close(slope * x + value, y) { return "wrong option \(option) is right" }
            }
            return nil
        }
    }

    func testLineThroughTwo() {
        Kit.check("u06.lineThroughTwo") { level, p in
            let pts = self.points(p.prompt)
            guard pts.count == 2 else { return "points" }
            func onLine(_ line: String) -> Bool {
                pts.allSatisfy { point in self.value(of: line, at: point.x).map { Kit.close($0, point.y) } == true }
            }
            guard self.parts(p.correct) != nil, onLine(p.correct) else { return "correct line \(p.correct)" }
            for option in p.options {
                guard self.parts(option) != nil else { return "wrong option \(option) is no line" }
                if onLine(option) { return "wrong option \(option) goes through both points" }
            }
            guard let (_, b) = self.parts(p.correct), let typed = Kit.typedAnswer(p), Kit.close(typed, b), p.typed?.prompt.contains("y-Achsenabschnitt") == true else { return "typed" }
            guard p.pairFront == "P(\(self.text(pts[0].x))|\(self.text(pts[0].y))), Q(\(self.text(pts[1].x))|\(self.text(pts[1].y)))" else { return "pair front" }
            if level == 3, p.correct.contains(",") == false, p.correct.contains("x") == false { return "line" }
            return nil
        }
    }

    func testPointTest() {
        Kit.check("u06.pointTest") { _, p in
            let equation = self.lastLine(p.prompt)
            guard p.prompt.hasPrefix("Welcher Punkt liegt auf der Geraden?"), self.parts(equation) != nil else { return "prompt" }
            guard let right = self.points(p.correct).first, let y = self.value(of: equation, at: right.x), Kit.close(y, right.y) else { return "correct point \(p.correct)" }
            guard p.options.count >= 2 else { return "options" }
            for option in p.options {
                guard let point = self.points(option).first else { return "wrong option \(option)" }
                if let y = self.value(of: equation, at: point.x), Kit.close(y, point.y) { return "wrong option \(option) lies on the line" }
            }
            guard let typedPrompt = p.typed?.prompt, let m = Kit.match(#"^Der Punkt P\("# + self.number + #"\|a\) liegt auf der Geraden\.\n(.+)\nWie groß ist a\?$"#, typedPrompt), m[2] == equation else { return "typed prompt" }
            guard let typed = Kit.typedAnswer(p), let expected = self.value(of: equation, at: Kit.number(m[1])!), Kit.close(typed, expected), Kit.close(expected, right.y) else { return "typed answer" }
            return nil
        }
    }

    func testParallel() {
        Kit.check("u06.parallel") { _, p in
            guard p.prompt.hasPrefix("Welche Gerade verläuft parallel zu\n"), let given = Kit.match(#"zu\n(y = .+)\?$"#, p.prompt)?[1], let (m, b) = self.parts(given) else { return "prompt" }
            guard let (rightM, rightB) = self.parts(p.correct), Kit.close(rightM, m), !Kit.close(rightB, b) else { return "correct option \(p.correct)" }
            for option in p.options {
                guard let (wm, _) = self.parts(option) else { return "wrong option \(option)" }
                if Kit.close(wm, m) { return "wrong option \(option) is parallel" }
            }
            // Through a point: b of the parallel.
            guard let typedPrompt = p.typed?.prompt, let q = Kit.match(#"geht durch P\("# + self.number + #"\|"# + self.number + #"\)"#, typedPrompt) else { return "typed prompt" }
            let (x, y) = (Kit.number(q[1])!, Kit.number(q[2])!)
            guard let typed = Kit.typedAnswer(p), Kit.close(m * x + typed, y), Kit.close(typed, rightB) else { return "typed answer" }
            return nil
        }
    }

    func testApplication() {
        Kit.check("u06.application") { level, p in
            let text = p.prompt.replacingOccurrences(of: "\n", with: " ")
            let b: Double
            let m: Double
            let askedX: Int?
            let asksValue: Bool
            if let q = Kit.match(#"kostet "# + self.number + #" € Grundgebühr im Monat und "# + self.number + #" € je Gesprächsminute\. (.+)$"#, text) {
                (b, m) = (Kit.number(q[1])!, Kit.number(q[2])!)
                if let a = Kit.match(#"Wie viel kostet es bei (\d+) Minuten\?"#, q[3]) { askedX = Int(a[1]); asksValue = true } else if Kit.match(#"Die Rechnung beträgt "# + self.number + #" €\. Wie viele Minuten wurde telefoniert\?"#, q[3]) != nil { askedX = nil; asksValue = false } else { return "question \(q[3])" }
            } else if let q = Kit.match(#"Eine Kerze ist "# + self.number + #" cm hoch und brennt "# + self.number + #" cm in jeder Stunde ab\. (.+)$"#, text) {
                (b, m) = (Kit.number(q[1])!, -Kit.number(q[2])!)
                if let a = Kit.match(#"Wie hoch ist sie nach (\d+) Stunden\?"#, q[3]) { askedX = Int(a[1]); asksValue = true } else if Kit.match(#"Die Kerze ist nur noch "# + self.number + #" cm hoch\. Wie lange brennt sie schon\?"#, q[3]) != nil { askedX = nil; asksValue = false } else { return "question \(q[3])" }
            } else if let q = Kit.match(#"In einem Becken sind "# + self.number + #" l Wasser\. Es kommen "# + self.number + #" l je Minute dazu\. (.+)$"#, text) {
                (b, m) = (Kit.number(q[1])!, Kit.number(q[2])!)
                if let a = Kit.match(#"Wie viel Wasser ist nach (\d+) Minuten im Becken\?"#, q[3]) { askedX = Int(a[1]); asksValue = true } else if Kit.match(#"Im Becken sind jetzt "# + self.number + #" l\. Wie viele Minuten läuft das Wasser schon\?"#, q[3]) != nil { askedX = nil; asksValue = false } else { return "question \(q[3])" }
            } else {
                return "prompt"
            }
            guard let right = Kit.number(p.correct), let typed = Kit.typedAnswer(p), Kit.close(typed, right) else { return "answer" }
            if asksValue {
                guard level < 3, let x = askedX else { return "forward below level 3" }
                guard Kit.close(right, b + m * Double(x)), right > 0 else { return "value" }
            } else {
                guard level == 3 else { return "backwards only at level 3" }
                // The given value: try every whole number of units.
                let target = text.contains("Rechnung") ? Kit.number(Kit.match(#"beträgt "# + self.number + #" €"#, text)![1])! : Kit.number(Kit.match(#"(?:noch|jetzt) "# + self.number + #" (?:cm hoch|l)"#, text)![1])!
                let hits = (0...400).filter { Kit.close(b + m * Double($0), target) }
                guard hits.count == 1, Kit.close(Double(hits[0]), right) else { return "brute force \(hits) vs \(right)" }
            }
            for option in p.options {
                guard let value = Kit.number(option) else { return "wrong option" }
                if Kit.close(value, right) { return "wrong option \(option) is right" }
            }
            return nil
        }
    }
}
