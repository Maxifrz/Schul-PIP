import XCTest
@testable import Lernwerk

/// Unit 5, Dreisatz und Proportionalität: every answer is recomputed from the numbers in the prompt, tables are
/// classified by their quotients and products, and every wrong option must be one of the known typical mistakes.
final class MathCourseMiddleUnit05Tests: XCTestCase {
    private typealias Kit = MathMiddleTestKit

    private func plain(_ text: String) -> String {
        text.replacingOccurrences(of: "\u{202F}", with: "").replacingOccurrences(of: "\n", with: " ")
    }

    /// The right option, the typed answer and the wrong options of a number problem; the wrong ones must come from
    /// the list of mistakes and never equal the answer.
    private func numbers(_ p: MathMiddleProblem, expected: Double, mistakes: [Double]) -> String? {
        guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct) expected \(expected)" }
        guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer" }
        for option in p.options {
            guard let value = Kit.number(option) else { return "wrong option \(option)" }
            if Kit.close(value, expected) { return "wrong option \(option) is right" }
            if !mistakes.contains(where: { Kit.close($0, value) }) { return "wrong option \(option) is no known mistake" }
        }
        return nil
    }

    func testProportional() {
        Kit.check("u05.proportional") { level, p in
            let text = self.plain(p.prompt)
            let number = #"(\d+(?:,\d+)?)"#
            let given: (Double, Double, Double)
            if let m = Kit.match(number + #" Hefte kosten "# + number + #" €\. Wie viel kosten "# + number + #" Hefte"#, text) {
                given = (Kit.number(m[1])!, Kit.number(m[2])!, Kit.number(m[3])!)
            } else if let m = Kit.match(#"Für "# + number + #" Stunden Arbeit bekommt Jonas "# + number + #" €\. Wie viel bekommt er für "# + number + #" Stunden"#, text) {
                given = (Kit.number(m[1])!, Kit.number(m[2])!, Kit.number(m[3])!)
            } else if let m = Kit.match(number + #" kg Äpfel kosten "# + number + #" €\. Wie viel kosten "# + number + #" kg"#, text) {
                given = (Kit.number(m[1])!, Kit.number(m[2])!, Kit.number(m[3])!)
            } else if let m = Kit.match(#"in "# + number + #" Minuten "# + number + #" Flaschen\. Wie viele Flaschen füllt sie in "# + number + #" Minuten"#, text) {
                given = (Kit.number(m[1])!, Kit.number(m[2])!, Kit.number(m[3])!)
            } else if let m = Kit.match(#"fährt gleichmäßig "# + number + #" km in "# + number + #" Stunden\. Wie weit fährt er in "# + number + #" Stunden"#, text) {
                given = (Kit.number(m[2])!, Kit.number(m[1])!, Kit.number(m[3])!)
            } else {
                return "prompt"
            }
            let (n1, p1, n2) = given
            guard n1 != n2 else { return "same number" }
            // The cross product decides: p1 / n1 = answer / n2.
            let expected = p1 * n2 / n1
            guard Kit.close(p1 * n2, expected * n1) else { return "cross product" }
            if level == 3, p.correct.contains(" km") { return "level 3 is about money" }
            if level == 1, n1 > 10 || expected >= 1000 { return "level 1 is small" }
            guard p.pairFront != nil else { return "pair front" }
            return self.numbers(p, expected: expected, mistakes: [p1 + n2 - n1, p1 * n1 / n2, p1 * n2, p1 / n1])
        }
    }

    func testUnitRate() {
        Kit.check("u05.unitRate") { _, p in
            let text = self.plain(p.prompt)
            let number = #"(\d+(?:,\d+)?)"#
            let n: Double
            let total: Double
            if let m = Kit.match(number + #" kg Kirschen kosten "# + number + #" €"#, text) {
                (n, total) = (Kit.number(m[1])!, Kit.number(m[2])!)
            } else if let m = Kit.match(#"fährt "# + number + #" km in "# + number + #" Stunden"#, text) {
                (n, total) = (Kit.number(m[2])!, Kit.number(m[1])!)
            } else if let m = Kit.match(#"laufen "# + number + #" l in "# + number + #" Minuten"#, text) {
                (n, total) = (Kit.number(m[2])!, Kit.number(m[1])!)
            } else {
                return "prompt"
            }
            // Plugged back in: n units of the rate make the total.
            let expected = total / n
            guard Kit.close(expected * n, total) else { return "does not fit back" }
            return self.numbers(p, expected: expected, mistakes: [n / total, total * n, total - n, total])
        }
    }

    func testFactor() {
        Kit.check("u05.factor") { level, p in
            guard let m = Kit.match(#"Zu x = (\d+) gehört y = (\d+)\."#, p.prompt) else { return "prompt" }
            let (x, y) = (Double(m[1])!, Double(m[2])!)
            guard p.pairFront == "x = \(m[1]), y = \(m[2])" else { return "pair front" }
            if level >= 2, y.truncatingRemainder(dividingBy: x) == 0 { return "levels 2 and 3 have a fraction as the factor" }
            return self.numbers(p, expected: y / x, mistakes: [x / y, y - x, x * y, y])
        }
    }

    func testAntiproportional() {
        Kit.check("u05.antiproportional") { level, p in
            let text = self.plain(p.prompt)
            let n1: Double
            let t1: Double
            let n2: Double
            if let m = Kit.match(#"(\d+) Arbeiter brauchen für ein Dach (\d+) Tage\. Wie viele Tage brauchen (\d+) Arbeiter"#, text) {
                (n1, t1, n2) = (Double(m[1])!, Double(m[2])!, Double(m[3])!)
            } else if let m = Kit.match(#"(\d+) gleiche Pumpen füllen ein Becken in (\d+) Stunden\. Wie lange brauchen (\d+) Pumpen"#, text) {
                (n1, t1, n2) = (Double(m[1])!, Double(m[2])!, Double(m[3])!)
            } else if let m = Kit.match(#"reicht für (\d+) Pferde (\d+) Tage\. Wie lange reicht er für (\d+) Pferde"#, text) {
                (n1, t1, n2) = (Double(m[1])!, Double(m[2])!, Double(m[3])!)
            } else if let m = Kit.match(#"(\d+) Freunde teilen sich die Kosten für ein Boot, jeder zahlt (\d+(?:,\d+)?) €\. Wie viel zahlt jeder bei (\d+) Freunden"#, text) {
                (n1, t1, n2) = (Double(m[1])!, Kit.number(m[2])!, Double(m[3])!)
            } else {
                return "prompt"
            }
            guard n1 != n2 else { return "same number" }
            // The product stays the same: plugged back in.
            let expected = n1 * t1 / n2
            guard let right = Kit.number(p.correct), Kit.close(n2 * right, n1 * t1) else { return "product" }
            if level < 3, expected != expected.rounded() { return "levels 1 and 2 have whole answers" }
            return self.numbers(p, expected: expected, mistakes: [t1 * n2 / n1, t1 - (n2 - n1), t1 + (n2 - n1), n1 * t1])
        }
    }

    private func table(_ text: String) -> (xs: [Double], ys: [Double])? {
        guard let m = Kit.match(#"x: ([\d, ]+)\ny: ([\d, ?]+)"#, text) else { return nil }
        let xs = m[1].components(separatedBy: ", ").compactMap { Double($0) }
        let ys = m[2].components(separatedBy: ", ").compactMap { Double($0) }
        return (xs, ys)
    }

    func testTableType() {
        Kit.check("u05.tableType") { _, p in
            guard let (xs, ys) = self.table(p.prompt), xs.count == 3, ys.count == 3 else { return "table" }
            let proportional = (1..<3).allSatisfy { Kit.close(ys[$0] / xs[$0], ys[0] / xs[0]) }
            let anti = (1..<3).allSatisfy { Kit.close(ys[$0] * xs[$0], ys[0] * xs[0]) }
            guard !(proportional && anti) else { return "both" }
            let expected = proportional ? "proportional" : (anti ? "antiproportional" : "weder noch")
            guard p.correct == expected else { return "correct \(p.correct) expected \(expected)" }
            guard Set(p.options + [p.correct]) == ["proportional", "antiproportional", "weder noch"] else { return "options \(p.options)" }
            guard xs == xs.sorted(), Set(xs).count == 3 else { return "x values" }
            return nil
        }
    }

    /// Each situation as a function of x: the kind follows from the numbers, not from a label.
    private static let models: [String: (Double) -> Double] = [
        "Anzahl der Brötchen → Gesamtpreis (jedes kostet gleich viel)": { 0.4 * $0 },
        "Fahrzeit → zurückgelegte Strecke (gleichbleibende Geschwindigkeit)": { 80 * $0 },
        "Seitenlänge eines Quadrats → Umfang des Quadrats": { 4 * $0 },
        "getankte Liter → Preis (fester Preis je Liter)": { 1.8 * $0 },
        "Anzahl der Kopien → Kosten (fester Preis je Kopie)": { 0.1 * $0 },
        "Anzahl gleicher Hefte → Gewicht aller Hefte": { 60 * $0 },
        "Anzahl der Arbeiter → Zeit für dieselbe Arbeit (alle gleich schnell)": { 120 / $0 },
        "Geschwindigkeit → Fahrzeit für dieselbe Strecke": { 240 / $0 },
        "Anzahl der Personen → Anteil jeder Person an einem festen Betrag": { 60 / $0 },
        "Anzahl der Pumpen → Zeit, um dasselbe Becken zu füllen": { 12 / $0 },
        "Anzahl der Fahrgäste → Fahrpreis je Person bei festen Busmiete": { 300 / $0 },
        "Anzahl der Tage → Tagesration eines festen Vorrats": { 90 / $0 },
        "Alter eines Kindes → Körpergröße": { 50 + 6 * $0 },
        "Seitenlänge eines Quadrats → Flächeninhalt": { $0 * $0 },
        "gefahrene Kilometer → Taxipreis mit Grundgebühr": { 4 + 2 * $0 },
        "Uhrzeit → Außentemperatur": { 10 + 8 * sin($0 / 4) },
        "Anzahl gelesener Seiten → noch ungelesene Seiten eines Buches": { 300 - $0 },
        "Radius eines Kreises → Flächeninhalt des Kreises": { Double.pi * $0 * $0 },
    ]

    private func kind(_ situation: String) -> String? {
        guard let f = Self.models[situation] else { return nil }
        let xs: [Double] = [1, 2, 3, 5, 8]
        if xs.allSatisfy({ Kit.close(f($0) / $0, f(1)) }) { return "proportional" }
        if xs.allSatisfy({ Kit.close(f($0) * $0, f(1)) }) { return "antiproportional" }
        return "weder"
    }

    func testSituation() {
        Kit.check("u05.situation") { level, p in
            let wanted: String
            switch p.prompt {
            case "Welche Zuordnung ist proportional?": wanted = "proportional"
            case "Welche Zuordnung ist antiproportional?": wanted = "antiproportional"
            case "Welche Zuordnung ist weder proportional noch antiproportional?": wanted = "weder"
            default: return "prompt"
            }
            if level == 1, wanted == "antiproportional" { return "level 1 has no antiproportional question" }
            guard self.kind(p.correct) == wanted else { return "correct option \(p.correct) is \(self.kind(p.correct) ?? "unknown")" }
            guard p.options.count == 3 else { return "three wrong options" }
            for option in p.options where self.kind(option) == nil || self.kind(option) == wanted { return "wrong option \(option) is \(self.kind(option) ?? "unknown")" }
            // Both other kinds appear among the wrong options.
            guard Set(p.options.compactMap { self.kind($0) }).count == 2 else { return "wrong options of one kind only" }
            return nil
        }
    }

    func testTableFill() {
        Kit.check("u05.tableFill") { level, p in
            guard let m = Kit.match(#"^Die Zuordnung ist (proportional|antiproportional)\."#, p.prompt), let (xs, ys) = self.table(p.prompt), xs.count == 3, ys.count == 2 else { return "prompt" }
            let anti = m[1] == "antiproportional"
            if level == 1, anti { return "level 1 is proportional" }
            // The missing value from the first pair, by the rule of the kind.
            let expected = anti ? xs[0] * ys[0] / xs[2] : ys[0] / xs[0] * xs[2]
            guard expected == expected.rounded(), expected > 0 else { return "not whole" }
            // The second pair obeys the same rule.
            guard anti ? Kit.close(xs[1] * ys[1], xs[0] * ys[0]) : Kit.close(ys[1] / xs[1], ys[0] / xs[0]) else { return "second pair" }
            guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer" }
            for option in p.options {
                guard let value = Kit.number(option) else { return "wrong option" }
                if Kit.close(value, expected) { return "wrong option \(option) is right" }
            }
            return nil
        }
    }

    func testScale() {
        Kit.check("u05.scale") { level, p in
            let text = self.plain(p.prompt)
            if let m = Kit.match(#"Maßstab 1 : (\d+)\. Eine Strecke ist auf der Karte (\d+) cm lang\. Wie lang ist sie in Wirklichkeit in (m|km)\?"#, text) {
                guard level <= 2 else { return "forward only below level 3" }
                let n = Double(m[1])!
                let d = Double(m[2])!
                // Centimetres first, then the unit.
                let realCm = d * n
                let expected = m[3] == "m" ? realCm / 100 : realCm / 100_000
                if level == 1, m[3] != "m" { return "level 1 in metres" }
                if level == 2, m[3] != "km" { return "level 2 in kilometres" }
                return self.numbers(p, expected: expected, mistakes: [expected * 10, expected / 10, expected * 100, expected / 100])
            }
            if let m = Kit.match(#"Zwei Orte sind (\d+) km voneinander entfernt\. Wie viele cm sind das auf einer Karte im Maßstab 1 : (\d+)\?"#, text) {
                guard level == 3 else { return "back only at level 3" }
                let km = Double(m[1])!
                let n = Double(m[2])!
                let expected = km * 100_000 / n
                // Plugged back in: the map length times the factor is the real length.
                guard let right = Kit.number(p.correct), Kit.close(right * n, km * 100_000) else { return "back" }
                return self.numbers(p, expected: expected, mistakes: [expected * 10, expected / 10, expected * 100, expected / 100])
            }
            return "prompt"
        }
    }

    func testRatioSplit() {
        Kit.check("u05.ratioSplit") { level, p in
            let text = self.plain(p.prompt)
            let p1: Double
            let q1: Double
            let total: Double
            let askFirst: Bool
            if let m = Kit.match(#"Anna und Ben teilen (\d+) € im Verhältnis (\d+) : (\d+)\. Wie viel bekommt (Anna|Ben)\?"#, text) {
                (total, p1, q1, askFirst) = (Double(m[1])!, Double(m[2])!, Double(m[3])!, m[4] == "Anna")
            } else if let m = Kit.match(#"Verhältnis Saft : Wasser = (\d+) : (\d+) und ist (\d+) l groß\. Wie viele Liter sind (Saft|Wasser)\?"#, text) {
                (total, p1, q1, askFirst) = (Double(m[3])!, Double(m[1])!, Double(m[2])!, m[4] == "Saft")
            } else if let m = Kit.match(#"Ein Gewinn von (\d+) € wird im Verhältnis (\d+) : (\d+) auf zwei Spieler verteilt\. Wie viel bekommt (der Erste|der Zweite)\?"#, text) {
                (total, p1, q1, askFirst) = (Double(m[1])!, Double(m[2])!, Double(m[3])!, m[4] == "der Erste")
            } else {
                return "prompt"
            }
            let parts = p1 + q1
            guard total.truncatingRemainder(dividingBy: parts) == 0 else { return "parts do not divide the total" }
            let expected = total * (askFirst ? p1 : q1) / parts
            // The two shares add up to the total.
            let other = total * (askFirst ? q1 : p1) / parts
            guard Kit.close(expected + other, total) else { return "shares" }
            guard Kit.bruteGCD(Int(p1), Int(q1)) == 1 else { return "ratio not reduced" }
            let k = total / parts
            let part = askFirst ? p1 : q1
            return self.numbers(p, expected: expected, mistakes: [other, k, total - k, total / 2, total / part])
        }
    }

    func testRatioReduce() {
        Kit.check("u05.ratioReduce") { level, p in
            let text = self.plain(p.prompt)
            let a: Int
            let b: Int
            if let m = Kit.match(#"^Kürze das Verhältnis vollständig: (\d+) : (\d+)$"#, text) {
                guard level == 1 else { return "plain only at level 1" }
                (a, b) = (Int(m[1])!, Int(m[2])!)
            } else if let m = Kit.match(#"Ein Rezept braucht (\d+) g Mehl und (\d+) g Zucker"#, text)
                ?? Kit.match(#"In einer Klasse sind (\d+) Mädchen und (\d+) Jungen"#, text)
                ?? Kit.match(#"Ein Rechteck ist (\d+) cm lang und (\d+) cm breit"#, text) {
                guard level == 2 else { return "stories at level 2" }
                (a, b) = (Int(m[1])!, Int(m[2])!)
            } else if let m = Kit.match(#"Verhältnis (\d+) (g|cm|min) : (\d+) (kg|m|h), vollständig"#, text) {
                guard level == 3 else { return "units at level 3" }
                let factor = ["g": 1000, "cm": 100, "min": 60][m[2]]!
                (a, b) = (Int(m[1])!, Int(m[3])! * factor)
            } else {
                return "prompt"
            }
            let g = Kit.bruteGCD(a, b)
            let expected = "\(a / g) : \(b / g)"
            guard p.correct == expected else { return "correct \(p.correct) expected \(expected)" }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, Double(b / g)) else { return "typed answer" }
            for option in p.options {
                guard let m = Kit.match(#"^(\d+) : (\d+)$"#, option) else { return "wrong option \(option)" }
                let (x, y) = (Int(m[1])!, Int(m[2])!)
                // A wrong option is never the fully reduced ratio of the same numbers.
                if Kit.bruteGCD(x, y) == 1, x * (b / g) == y * (a / g) { return "wrong option \(option) is right" }
                if option == expected { return "wrong option equals the answer" }
            }
            return nil
        }
    }
}
