import XCTest
@testable import Lernwerk

/// Unit 1, Brüche verstehen: every problem is read back from its prompt and recomputed another way.
final class MathCourseMiddleUnit01Tests: XCTestCase {
    private typealias Kit = MathMiddleTestKit

    private func fraction(_ text: String) -> (Int, Int)? {
        guard let m = Kit.match(#"^(\d+)/(\d+)$"#, text.trimmingCharacters(in: .whitespaces)) else { return nil }
        return (Int(m[1])!, Int(m[2])!)
    }

    /// All wrong options are numbers that differ from the expected value.
    private func wrongDiffer(_ p: MathMiddleProblem, from expected: Double) -> String? {
        for option in p.options {
            guard let value = Kit.number(option) else { continue }
            if Kit.close(value, expected) { return "wrong option \(option) equals the answer" }
        }
        return nil
    }

    func testFractionOf() {
        Kit.check("u01.fractionOf") { level, p in
            guard let m = Kit.match(#"Berechne (\d+)/(\d+) von (\d+)"#, p.prompt) else { return "prompt" }
            let (n, d, whole) = (Double(m[1])!, Double(m[2])!, Double(m[3])!)
            let expected = n * whole / d
            guard expected == expected.rounded() else { return "not a whole number" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct)" }
            guard Kit.bruteGCD(Int(n), Int(d)) == 1 else { return "fraction not reduced" }
            guard p.pairFront?.hasPrefix("\(m[1])/\(m[2]) von \(m[3])") == true else { return "pair front" }
            if level == 1, whole > 60 { return "level 1 too big" }
            return wrongDiffer(p, from: expected)
        }
    }

    func testShare() {
        Kit.check("u01.share") { level, p in
            let head = p.prompt.components(separatedBy: "\n").first ?? ""
            let numbers = Kit.integers(in: head)
            guard numbers.count == 2, let total = numbers.max(), let part = numbers.min(), part < total else { return "numbers" }
            let expected = Double(part) / Double(total)
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer" }
            guard let shown = fraction(p.correct), Kit.close(Double(shown.0) / Double(shown.1), expected) else { return "correct option \(p.correct)" }
            guard Kit.bruteGCD(shown.0, shown.1) == 1 else { return "answer not reduced" }
            let divisor = Kit.bruteGCD(part, total)
            if level < 3, divisor != 1 { return "levels 1 and 2 need no reducing" }
            if level == 3, divisor == 1 { return "level 3 reduces" }
            if part * 2 == total { return "one half" }
            guard p.pairFront == "\(part) von \(total)" else { return "pair front" }
            return wrongDiffer(p, from: expected)
        }
    }

    func testMixedToImproper() {
        Kit.check("u01.mixedToImproper") { _, p in
            guard let m = Kit.match(#"Schreibe (\d+) (\d+)/(\d+) als unechten Bruch"#, p.prompt) else { return "prompt" }
            let (whole, n, d) = (Double(m[1])!, Double(m[2])!, Double(m[3])!)
            let value = whole + n / d
            guard let shown = fraction(p.correct), Kit.close(Double(shown.0) / Double(shown.1), value), shown.1 == Int(d), shown.0 > shown.1 else { return "correct option \(p.correct)" }
            guard let typedPrompt = p.typed?.prompt, let t = Kit.match(#"mit dem Nenner (\d+)"#, typedPrompt), Kit.close(Double(t[1])!, d) else { return "typed prompt" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, value * d) else { return "typed answer" }
            guard p.pairFront == "\(m[1]) \(m[2])/\(m[3])" else { return "pair front" }
            return wrongDiffer(p, from: value)
        }
    }

    func testImproperToMixed() {
        Kit.check("u01.improperToMixed") { _, p in
            guard let m = Kit.match(#"Schreibe (\d+)/(\d+) als gemischte Zahl"#, p.prompt) else { return "prompt" }
            let (top, bottom) = (Int(m[1])!, Int(m[2])!)
            let value = Double(top) / Double(bottom)
            guard let parts = Kit.match(#"^(\d+) (\d+)/(\d+)$"#, p.correct) else { return "correct option \(p.correct)" }
            let (whole, rest, denominator) = (Int(parts[1])!, Int(parts[2])!, Int(parts[3])!)
            guard denominator == bottom, rest < denominator, whole >= 1, Kit.close(Double(whole) + Double(rest) / Double(denominator), value) else { return "mixed number wrong" }
            guard let typed = Kit.typedAnswer(p), let typedPrompt = p.typed?.prompt else { return "typed" }
            // The count of wholes by counting down, the rest by subtraction.
            var left = top
            var wholes = 0
            while left >= bottom { left -= bottom; wholes += 1 }
            let expected = typedPrompt.contains("ganze Einheiten") ? Double(wholes) : Double(left)
            guard Kit.close(typed, expected) else { return "typed answer \(typed) expected \(expected)" }
            guard p.pairFront == "\(top)/\(bottom)" else { return "pair front" }
            return wrongDiffer(p, from: value)
        }
    }

    func testEquivalent() {
        Kit.check("u01.equivalent") { _, p in
            guard let m = Kit.match(#"(\d+)/(\d+) = (\d+|\?)/(\d+|\?)"#, p.prompt) else { return "prompt" }
            let (a, b) = (Double(m[1])!, Double(m[2])!)
            let missingNumerator = m[3] == "?"
            let known = Double(missingNumerator ? m[4] : m[3])!
            let expected = missingNumerator ? a * known / b : b * known / a
            guard expected == expected.rounded(), expected > 0 else { return "no whole answer" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option" }
            // Plug the answer in: both fractions are the same number.
            let (c, d) = missingNumerator ? (expected, known) : (known, expected)
            guard Kit.close(a / b, c / d) else { return "fractions differ" }
            for option in p.options {
                guard let value = Kit.number(option) else { return "wrong option text" }
                let (wc, wd) = missingNumerator ? (value, known) : (known, value)
                if Kit.close(a / b, wc / wd) { return "wrong option \(option) is right" }
            }
            guard p.pairFront == "\(m[1])/\(m[2]) = \(m[3])/\(m[4])" else { return "pair front" }
            return nil
        }
    }

    func testReduce() {
        Kit.check("u01.reduce") { level, p in
            guard let m = Kit.match(#"Kürze vollständig:\n(\d+)/(\d+)"#, p.prompt) else { return "prompt" }
            let (a, b) = (Int(m[1])!, Int(m[2])!)
            let g = Kit.bruteGCD(a, b)
            guard g > 1, (level == 1 ? g <= 5 : true) else { return "gcd \(g)" }
            guard let right = fraction(p.correct), right.0 == a / g, right.1 == b / g, Kit.bruteGCD(right.0, right.1) == 1 else { return "correct option \(p.correct)" }
            for option in p.options {
                guard let w = fraction(option) else { return "wrong option \(option)" }
                if w.0 * right.1 == w.1 * right.0, Kit.bruteGCD(w.0, w.1) == 1 { return "wrong option \(option) is the reduced fraction" }
                if w == right { return "wrong option equals the answer" }
            }
            guard p.allowsEquivalentWrong else { return "flag" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, Double(g)), p.typed?.prompt.contains("\(a)/\(b)") == true else { return "typed answer" }
            guard p.pairFront == "\(a)/\(b)" else { return "pair front" }
            return nil
        }
    }

    func testIsReduced() {
        Kit.check("u01.isReduced") { _, p in
            let asksReducible = p.prompt.contains("noch kürzen")
            guard asksReducible || p.prompt.contains("nicht mehr kürzen") else { return "prompt" }
            guard let right = fraction(p.correct) else { return "correct option" }
            let rightReducible = Kit.bruteGCD(right.0, right.1) > 1
            guard rightReducible == asksReducible else { return "the right option is not the odd one" }
            guard p.options.count == 3 else { return "needs three wrong options" }
            for option in p.options {
                guard let w = fraction(option) else { return "wrong option" }
                if (Kit.bruteGCD(w.0, w.1) > 1) == asksReducible { return "wrong option \(option) fits the question" }
                if w.0 >= w.1 { return "improper fraction" }
            }
            return nil
        }
    }

    func testCompare() {
        Kit.check("u01.compare") { _, p in
            guard let m = Kit.match(#"(\d+)/(\d+) oder (\d+)/(\d+)"#, p.prompt) else { return "prompt" }
            let (a, b, c, d) = (Int(m[1])!, Int(m[2])!, Int(m[3])!, Int(m[4])!)
            // Cross products decide, not division.
            let leftLarger = a * d > c * b
            guard a * d != c * b else { return "equal fractions" }
            let larger = leftLarger ? "\(a)/\(b)" : "\(c)/\(d)"
            let smaller = leftLarger ? "\(c)/\(d)" : "\(a)/\(b)"
            guard p.correct == larger, p.options == [smaller, "Beide sind gleich groß."] else { return "options" }
            guard let typedPrompt = p.typed?.prompt, let t = Kit.match(#"auf den Nenner (\d+)"#, typedPrompt) else { return "typed prompt" }
            let common = Int(t[1])!
            guard common == Kit.bruteLCM(b, d) else { return "not the common denominator" }
            let expected = max(a * (common / b), c * (common / d))
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, Double(expected)) else { return "typed answer" }
            guard p.pairFront == "\(a)/\(b) oder \(c)/\(d)" else { return "pair front" }
            return nil
        }
    }

    func testOrder() {
        Kit.check("u01.order") { _, p in
            let listing = p.prompt.components(separatedBy: "\n").last ?? ""
            let given = Kit.matches(#"(\d+)/(\d+)"#, listing).map { (Int($0[1])!, Int($0[2])!) }
            guard given.count == 3 else { return "three fractions" }
            let sorted = given.sorted { $0.0 * $1.1 < $1.0 * $0.1 }
            guard sorted[0].0 * sorted[1].1 != sorted[1].0 * sorted[0].1, sorted[1].0 * sorted[2].1 != sorted[2].0 * sorted[1].1 else { return "equal fractions" }
            func chain(_ text: String) -> [(Int, Int)] { Kit.matches(#"(\d+)/(\d+)"#, text).map { (Int($0[1])!, Int($0[2])!) } }
            let right = chain(p.correct)
            guard right.count == 3, zip(right, sorted).allSatisfy({ $0.0 == $1.0 && $0.1 == $1.1 }) else { return "correct chain \(p.correct)" }
            guard p.correct.components(separatedBy: " < ").count == 3 else { return "chain format" }
            for option in p.options {
                let w = chain(option)
                guard w.count == 3, Set(w.map { "\($0.0)/\($0.1)" }) == Set(given.map { "\($0.0)/\($0.1)" }) else { return "wrong chain is no permutation" }
                let ascending = zip(w, w.dropFirst()).allSatisfy { $0.0 * $1.1 < $1.0 * $0.1 }
                if ascending { return "wrong chain \(option) is ascending" }
            }
            guard let typedPrompt = p.typed?.prompt, let t = Kit.match(#"auf den Nenner (\d+)"#, typedPrompt) else { return "typed prompt" }
            let common = Int(t[1])!
            guard given.allSatisfy({ common % $0.1 == 0 }) else { return "not a common denominator" }
            let middle = sorted[1]
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, Double(middle.0 * (common / middle.1))) else { return "typed answer" }
            return nil
        }
    }

    func testBetween() {
        Kit.check("u01.between") { _, p in
            guard let m = Kit.match(#"zwischen (\d+)/(\d+) und (\d+)/(\d+)"#, p.prompt) else { return "prompt" }
            let lower = Double(m[1])! / Double(m[2])!
            let upper = Double(m[3])! / Double(m[4])!
            guard lower < upper, let right = Kit.number(p.correct), right > lower, right < upper else { return "correct option \(p.correct)" }
            for option in p.options {
                guard let value = Kit.number(option) else { return "wrong option" }
                if value > lower, value < upper { return "wrong option \(option) lies between" }
            }
            return nil
        }
    }
}
