import XCTest
@testable import Lernwerk

/// Unit 10, Wahrscheinlichkeit: every prompt is read back and the probability is found again by listing all outcomes
/// (balls as indices, pairs of dice, every success/failure sequence), with Doubles.
final class MathCourseMiddleUnit10Tests: XCTestCase {
    private typealias Kit = MathMiddleTestKit

    private func plain(_ text: String) -> String {
        text.replacingOccurrences(of: "\n", with: " ")
    }

    /// The right option and the typed answer equal `expected`; the wrong options are other numbers, and a probability
    /// strictly between 0 and 1 unless `percent`. The typed answer accepts an unreduced fraction and a decimal.
    private func check(_ p: MathMiddleProblem, expected: Double, percent: Bool = false) -> String? {
        guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct) expected \(expected)" }
        guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer \(String(describing: Kit.typedAnswer(p)))" }
        for option in p.options {
            guard let value = Kit.number(option) else { return "wrong option \(option)" }
            if Kit.close(value, expected) { return "wrong option \(option) is right" }
            if !percent, value <= 0 || value >= 1 { return "wrong option \(option) is not a probability" }
        }
        guard let answer = p.typed?.answer else { return "no typed answer" }
        if !percent {
            guard let hint = p.typed?.prompt, hint.contains("Bruch oder Dezimalzahl") || hint.contains("Dezimalzahl oder Bruch") else { return "the typed prompt names the forms" }
            let unreduced = "\(answer.numerator * 3)/\(answer.denominator * 3)"
            if !Kit.accepts(p, unreduced) { return "unreduced \(unreduced) not accepted" }
            var rest = answer.denominator
            for prime in [2, 5] { while rest % prime == 0 { rest /= prime } }
            if rest == 1 {
                let decimal = String(format: "%.9g", expected).replacingOccurrences(of: ".", with: ",")
                if !Kit.accepts(p, decimal) { return "decimal \(decimal) not accepted" }
            }
            if !Kit.accepts(p, p.correct) { return "\(p.correct) not accepted" }
            if Kit.accepts(p, "\(answer.numerator + 1)/\(answer.denominator)") { return "a wrong fraction is accepted" }
        }
        return nil
    }

    func testDieEvent() {
        Kit.check("u10.dieEvent") { level, p in
            let text = self.plain(p.prompt)
            guard let m = Kit.match(#"dass die Zahl (.+) ist\?$"#, text) else { return "prompt" }
            let sides = Kit.match(#"Zahlen 1 bis (\d+)"#, text).flatMap { Int($0[1]) } ?? 6
            if level == 1, sides != 6 { return "level 1 is the ordinary die" }
            var count = 0
            for face in 1...sides {
                let phrase = m[1]
                var hit = false
                if let g = Kit.match(#"^größer als (\d+)$"#, phrase) { hit = face > Int(g[1])! }
                else if let g = Kit.match(#"^kleiner als (\d+)$"#, phrase) { hit = face < Int(g[1])! }
                else if phrase == "gerade" { hit = face % 2 == 0 }
                else if phrase == "ungerade" { hit = face % 2 == 1 }
                else if phrase == "eine Primzahl" { hit = face > 1 && (2..<face).allSatisfy { face % $0 != 0 } }
                else if let g = Kit.match(#"^durch (\d+) teilbar$"#, phrase) { hit = face % Int(g[1])! == 0 }
                else { return "event \(phrase)" }
                if hit { count += 1 }
            }
            return self.check(p, expected: Double(count) / Double(sides))
        }
    }

    func testUrn() {
        Kit.check("u10.urn") { level, p in
            let text = self.plain(p.prompt)
            let contents = Kit.matches(#"(\d+) (rote|blaue|grüne|gelbe)"#, text.components(separatedBy: " Du ziehst").first ?? "")
            guard contents.count >= 2, let ask = Kit.match(#"für eine (\w+)(?: oder eine (\w+))? Kugel\?"#, text) else { return "prompt" }
            if level == 1, contents.count != 2 { return "two colours at level 1" }
            var balls: [String] = []
            for entry in contents { balls += Array(repeating: entry[2], count: Int(entry[1])!) }
            let asked = [ask[1], ask[2]].filter { !$0.isEmpty }
            guard asked.allSatisfy({ name in contents.contains { $0[2] == name } }) else { return "asked colour is not in the bag" }
            let hits = balls.filter { asked.contains($0) }.count
            guard hits > 0, hits < balls.count else { return "impossible or certain" }
            return self.check(p, expected: Double(hits) / Double(balls.count))
        }
    }

    func testFrequency() {
        Kit.check("u10.frequency") { _, p in
            let first = self.plain(p.prompt).components(separatedBy: " Wie groß").first ?? ""
            let numbers = Kit.integers(in: first)
            guard numbers.count == 2, numbers[1] < numbers[0] else { return "prompt" }
            return self.check(p, expected: Double(numbers[1]) / Double(numbers[0]))
        }
    }

    func testRange() {
        Kit.check("u10.range") { _, p in
            func isProbability(_ text: String) -> Bool {
                guard let value = Kit.number(text) else { return false }
                let scaled = text.contains("%") ? value / 100 : value
                let negative = text.hasPrefix("\u{2212}") || text.hasPrefix("-")
                return !negative && scaled >= 0 && scaled <= 1
            }
            if isProbability(p.correct) { return "the right option \(p.correct) is a probability" }
            for option in p.options where !isProbability(option) { return "wrong option \(option) is no probability" }
            return p.options.count >= 3 ? nil : "only \(p.options.count) probabilities"
        }
    }

    func testComplement() {
        Kit.check("u10.complement") { level, p in
            let text = self.plain(p.prompt)
            if text.contains("weder Rot noch Blau") {
                guard level == 3, let m = Kit.match(#"Rot (\d+)/(\d+) und für Blau (\d+)/(\d+)\."#, text) else { return "prompt" }
                let a = Double(m[1])! / Double(m[2])!
                let b = Double(m[3])! / Double(m[4])!
                guard a + b < 1 else { return "the two colours leave nothing" }
                return self.check(p, expected: 1 - a - b)
            }
            if let m = Kit.match(#"von (\d+) %\."#, text) {
                guard level >= 2 else { return "percent from level 2" }
                guard p.correct.hasSuffix(" %") else { return "percent sign" }
                return self.check(p, expected: 100 - Double(m[1])!, percent: true)
            }
            if let m = Kit.match(#"mit der Wahrscheinlichkeit (\d+)/(\d+)\."#, text) {
                let value = Double(m[1])! / Double(m[2])!
                guard value > 0, value < 1 else { return "not a proper probability" }
                return self.check(p, expected: 1 - value)
            }
            return "prompt"
        }
    }

    func testTwoDice() {
        Kit.check("u10.twoDice") { level, p in
            let text = self.plain(p.prompt)
            guard let m = Kit.match(#"Wahrscheinlichkeit\? (.+)\.$"#, text) else { return "prompt" }
            let event = m[1]
            var count = 0
            for a in 1...6 {
                for b in 1...6 {
                    var hit = false
                    if let g = Kit.match(#"^Die Augensumme ist (\d+)$"#, event) { hit = a + b == Int(g[1])! }
                    else if let g = Kit.match(#"^Die Augensumme ist mindestens (\d+)$"#, event) { hit = a + b >= Int(g[1])! }
                    else if let g = Kit.match(#"^Die Augensumme ist höchstens (\d+)$"#, event) { hit = a + b <= Int(g[1])! }
                    else if let g = Kit.match(#"^Das Produkt der Zahlen ist (\d+)$"#, event) { hit = a * b == Int(g[1])! }
                    else if event == "Beide Würfel zeigen dieselbe Zahl" { hit = a == b }
                    else if event == "Beide Zahlen sind gerade" { hit = a % 2 == 0 && b % 2 == 0 }
                    else if event == "Mindestens ein Würfel zeigt eine 6" { hit = a == 6 || b == 6 }
                    else if event == "Das Produkt der Zahlen ist gerade" { hit = (a * b) % 2 == 0 }
                    else if event == "Die Zahlen unterscheiden sich um genau 2" { hit = abs(a - b) == 2 }
                    else if event == "Die Zahlen sind verschieden" { hit = a != b }
                    else if event == "Die Augensumme ist eine Primzahl" { hit = [2, 3, 5, 7, 11].contains(a + b) }
                    else { return "event \(event)" }
                    if hit { count += 1 }
                }
            }
            if level == 1, !(event.hasPrefix("Die Augensumme ist ") || event.hasPrefix("Beide Würfel")) { return "level 1 events" }
            return self.check(p, expected: Double(count) / 36)
        }
    }

    func testExpected() {
        Kit.check("u10.expected") { _, p in
            let text = self.plain(p.prompt)
            guard let shown = Kit.match(#"Wahrscheinlichkeit (\d+/\d+|\d+ %)[ .]"#, text),
                  let trials = Kit.match(#"(?:(\d+)-mal|werden (\d+) Teile)"#, text) else { return "prompt" }
            let probability = shown[1].hasSuffix("%") ? Kit.number(shown[1])! / 100 : Kit.number(shown[1])!
            let n = Double(trials[1].isEmpty ? trials[2] : trials[1])!
            let expected = probability * n
            guard Kit.close(expected, expected.rounded()), expected >= 1 else { return "expected count is not a whole number" }
            return self.check(p, expected: expected, percent: true)
        }
    }

    /// The balls of the bag in the prompt: "R rote und B blaue Kugeln".
    private func bag(_ text: String) -> [String]? {
        guard let m = Kit.match(#"(\d+) rote und (\d+) blaue Kugeln"#, text) else { return nil }
        return Array(repeating: "r", count: Int(m[1])!) + Array(repeating: "b", count: Int(m[2])!)
    }

    /// The share of the ordered draws of two balls, each ball one index, for which the test holds.
    private func share(_ balls: [String], replacing: Bool, _ test: (String, String) -> Bool) -> Double {
        var total = 0
        var hits = 0
        for i in balls.indices {
            for j in balls.indices where replacing || i != j {
                total += 1
                if test(balls[i], balls[j]) { hits += 1 }
            }
        }
        return Double(hits) / Double(total)
    }

    func testWithReplacement() {
        Kit.check("u10.withReplacement") { level, p in
            let text = self.plain(p.prompt)
            guard let balls = self.bag(text), text.contains("legst die Kugel nach jedem Zug zurück"),
                  let m = Kit.match(#"dass (.+)\?$"#, text) else { return "prompt" }
            let test: (String, String) -> Bool
            switch m[1] {
            case "beide Kugeln sind rot": test = { $0 == "r" && $1 == "r" }
            case "beide Kugeln sind blau": test = { $0 == "b" && $1 == "b" }
            case "die erste Kugel ist rot und die zweite blau": test = { $0 == "r" && $1 == "b" }
            case "beide Kugeln haben dieselbe Farbe":
                guard level == 3 else { return "same colour at level 3" }
                test = { $0 == $1 }
            default: return "event \(m[1])"
            }
            return self.check(p, expected: self.share(balls, replacing: true, test))
        }
    }

    func testWithoutReplacement() {
        Kit.check("u10.withoutReplacement") { level, p in
            let text = self.plain(p.prompt)
            guard let balls = self.bag(text), text.contains("ohne zurückzulegen"),
                  let m = Kit.match(#"dass (.+)\?$"#, text) else { return "prompt" }
            let test: (String, String) -> Bool
            switch m[1] {
            case "beide Kugeln sind rot": test = { $0 == "r" && $1 == "r" }
            case "beide Kugeln sind blau": test = { $0 == "b" && $1 == "b" }
            case "die erste Kugel ist rot und die zweite blau": test = { $0 == "r" && $1 == "b" }
            case "mindestens eine Kugel ist rot":
                guard level == 3 else { return "at least one at level 3" }
                test = { $0 == "r" || $1 == "r" }
            default: return "event \(m[1])"
            }
            return self.check(p, expected: self.share(balls, replacing: false, test))
        }
    }

    func testTwoPaths() {
        Kit.check("u10.twoPaths") { _, p in
            let text = self.plain(p.prompt)
            guard let balls = self.bag(text), text.contains("zwei verschiedene Farben") else { return "prompt" }
            let replacing = text.contains("legst die Kugel nach jedem Zug zurück")
            guard replacing || text.contains("ohne zurückzulegen") else { return "kind of draw" }
            return self.check(p, expected: self.share(balls, replacing: replacing) { $0 != $1 })
        }
    }

    func testAtLeastOne() {
        Kit.check("u10.atLeastOne") { level, p in
            let text = self.plain(p.prompt)
            let success: Double
            let trials: Int
            if let m = Kit.match(#"Du wirfst eine Münze (\d+)-mal"#, text) {
                (success, trials) = (0.5, Int(m[1])!)
            } else if let m = Kit.match(#"Du würfelst (\d+)-mal"#, text) {
                (success, trials) = (1.0 / 6, Int(m[1])!)
            } else if let m = Kit.match(#"Wahrscheinlichkeit 1/(\d+)\. Du drehst (\d+)-mal"#, text) {
                (success, trials) = (1 / Double(m[1])!, Int(m[2])!)
            } else {
                return "prompt"
            }
            if level == 1, trials > 3 { return "few trials at level 1" }
            // Every sequence of hits and misses, the probabilities multiplied along it.
            var total = 0.0
            for mask in 0..<(1 << trials) where mask != 0 {
                var chance = 1.0
                for bit in 0..<trials { chance *= (mask >> bit) & 1 == 1 ? success : 1 - success }
                total += chance
            }
            return self.check(p, expected: total)
        }
    }

    func testTheTypedFormsAreAccepted() {
        let p = Rational(3, 4)
        XCTAssertNotNil(p)
        for text in ["3/4", "0,75", "6/8", "0.75"] {
            XCTAssertTrue(NumberCheck.matches(text, expected: "3/4"), text)
        }
        XCTAssertFalse(NumberCheck.matches("3/5", expected: "3/4"))
    }
}
