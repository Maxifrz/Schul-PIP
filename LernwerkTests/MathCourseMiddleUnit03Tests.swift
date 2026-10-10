import XCTest
@testable import Lernwerk

/// Unit 3, Dezimalzahlen und Prozent: every answer is recomputed from the numbers in the prompt, and where there is a
/// base value, a rate and a part, the answer is plugged back in.
final class MathCourseMiddleUnit03Tests: XCTestCase {
    private typealias Kit = MathMiddleTestKit

    private func common(_ p: MathMiddleProblem, _ expected: Double) -> String? {
        guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer \(Kit.typedAnswer(p) ?? .nan) expected \(expected)" }
        guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct) expected \(expected)" }
        for option in p.options {
            guard let wrong = Kit.number(option) else { return "wrong option \(option)" }
            if Kit.close(wrong, expected) { return "wrong option \(option) is right" }
        }
        return nil
    }

    func testFractionToPercent() {
        Kit.check("u03.fractionToPercent") { _, p in
            guard let m = Kit.match(#"Wie viel Prozent sind (.+)\?"#, p.prompt), let source = Kit.number(m[1]) else { return "prompt" }
            guard p.pairFront == m[1] else { return "pair front" }
            guard p.correct.hasSuffix(" %") else { return "unit" }
            return self.common(p, source * 100)
        }
    }

    func testPercentToDecimal() {
        Kit.check("u03.percentToDecimal") { _, p in
            guard let m = Kit.match(#"Schreibe (.+?) % als Dezimalzahl"#, p.prompt), let rate = Kit.number(m[1]) else { return "prompt" }
            guard p.pairFront == "\(m[1]) %" else { return "pair front" }
            return self.common(p, rate / 100)
        }
    }

    func testDecimalCalc() {
        Kit.check("u03.decimalCalc") { level, p in
            let lines = p.prompt.components(separatedBy: "\n")
            guard lines.count == 2, lines[0] == "Berechne:", let expected = MathMiddleTestExpression.evaluate(lines[1]) else { return "expression" }
            guard expected > 0 else { return "not positive" }
            guard p.pairFront == lines[1] else { return "pair front" }
            // The result has few places after the comma.
            let scaled = expected * 1000
            guard Kit.close(scaled, scaled.rounded(), tolerance: 1e-7) else { return "too many places: \(expected)" }
            if level == 1, lines[1].contains("·") || lines[1].contains(":") { return "level 1 only adds and subtracts" }
            return self.common(p, expected)
        }
    }

    func testPercentValue() {
        Kit.check("u03.percentValue") { _, p in
            guard let m = Kit.match(#"(\d+(?:,\d+)?) % von (\d+(?:,\d+)?)"#, p.prompt), let rate = Kit.number(m[1]), let base = Kit.number(m[2]) else { return "prompt" }
            return self.common(p, rate * base / 100)
        }
    }

    func testPercentRate() {
        Kit.check("u03.percentRate") { _, p in
            let patterns = [#"Wie viel Prozent sind (\d+) von (\d+)\?"#, #"Von (\d+) Schülern fehlen (\d+)\."#, #"Lena erreicht (\d+) von (\d+) Punkten"#]
            guard let (index, m) = patterns.enumerated().compactMap({ i, pattern in Kit.match(pattern, p.prompt).map { (i, $0) } }).first else { return "prompt" }
            let (part, base) = index == 1 ? (Double(m[2])!, Double(m[1])!) : (Double(m[1])!, Double(m[2])!)
            guard part < base else { return "part is not smaller" }
            return self.common(p, part / base * 100)
        }
    }

    func testBaseValue() {
        Kit.check("u03.baseValue") { _, p in
            let number = #"(\d+(?:,\d+)?)"#
            let rate: Double
            let part: Double
            if let m = Kit.match(number + #" % einer Menge sind "# + number, p.prompt) {
                (rate, part) = (Kit.number(m[1])!, Kit.number(m[2])!)
            } else if let m = Kit.match(#"Bei "# + number + #" % Rabatt spart Tom "# + number, p.prompt) {
                (rate, part) = (Kit.number(m[1])!, Kit.number(m[2])!)
            } else if let m = Kit.match(#"^"# + number + #" \S+ sind "# + number + #" % des Grundwerts"#, p.prompt) {
                (rate, part) = (Kit.number(m[2])!, Kit.number(m[1])!)
            } else {
                return "prompt"
            }
            let expected = part * 100 / rate
            // Plugged back in: the rate of the answer is the part.
            guard Kit.close(expected * rate / 100, part) else { return "does not fit back" }
            return self.common(p, expected)
        }
    }

    func testPriceChange() {
        Kit.check("u03.priceChange") { _, p in
            guard let m = Kit.match(#"kostet (\d+(?:,\d+)?) €\."#, p.prompt), let base = Kit.number(m[1]) else { return "base" }
            let factor: Double
            if let r = Kit.match(#"steigt um (\d+(?:,\d+)?) %"#, p.prompt), let rate = Kit.number(r[1]) {
                factor = 1 + rate / 100
            } else if let r = Kit.match(#"gibt (\d+(?:,\d+)?) % Rabatt"#, p.prompt), let rate = Kit.number(r[1]) {
                factor = 1 - rate / 100
            } else {
                return "rate"
            }
            return self.common(p, base * factor)
        }
    }

    func testPercentChange() {
        Kit.check("u03.percentChange") { _, p in
            guard let m = Kit.match(#"(steigt|sinkt) von (\d+) € auf (\d+) €"#, p.prompt) else { return "prompt" }
            let (old, new) = (Double(m[2])!, Double(m[3])!)
            guard (m[1] == "steigt") == (new > old) else { return "direction" }
            let expected = abs(new - old) / old * 100
            // Plugged back in.
            guard Kit.close(old * (1 + (new > old ? 1 : -1) * expected / 100), new) else { return "does not fit back" }
            return self.common(p, expected)
        }
    }

    func testGrowthFactor() {
        Kit.check("u03.growthFactor") { _, p in
            guard let m = Kit.match(#"Ein Wert (steigt|sinkt) um (\d+(?:,\d+)?) %"#, p.prompt), let rate = Kit.number(m[2]) else { return "prompt" }
            let expected = m[1] == "steigt" ? 1 + rate / 100 : 1 - rate / 100
            // 100 multiplied by the factor is 100 changed by the rate.
            guard Kit.close(100 * expected, m[1] == "steigt" ? 100 + rate : 100 - rate) else { return "factor" }
            return self.common(p, expected)
        }
    }

    func testVat() {
        Kit.check("u03.vat") { level, p in
            let money = #"(\d+(?:,\d+)?)"#
            if let m = Kit.match(#"netto "# + money + #" €\. Dazu kommen (\d+) % Mehrwertsteuer"#, p.prompt), let net = Kit.number(m[1]) {
                guard level < 3 else { return "level 3 goes backwards" }
                return self.common(p, net * (1 + Double(m[2])! / 100))
            }
            if let m = Kit.match(#"brutto "# + money + #" €, darin sind (\d+) % Mehrwertsteuer"#, p.prompt), let gross = Kit.number(m[1]) {
                guard level == 3 else { return "only level 3 goes backwards" }
                let rate = Double(m[2])!
                let expected = gross / (1 + rate / 100)
                guard Kit.close(expected * (1 + rate / 100), gross) else { return "does not fit back" }
                // The classic mistake is never the right answer.
                return self.common(p, expected)
            }
            return "prompt"
        }
    }
}
