import XCTest
@testable import Lernwerk

/// Unit 8, Geometrie: every number is read back from the prompt and the formula is applied again with Doubles; the
/// theorem of Pythagoras is checked by squaring, the angle sums by adding, the unit conversions through metres.
final class MathCourseMiddleUnit08Tests: XCTestCase {
    private typealias Kit = MathMiddleTestKit

    private let number = #"(\d+(?:,\d+)?)"#

    private func plain(_ text: String) -> String {
        text.replacingOccurrences(of: "\u{202F}", with: "").replacingOccurrences(of: "\n", with: " ")
    }

    /// The right option, the typed answer, and the wrong options which must differ in value.
    private func check(_ p: MathMiddleProblem, expected: Double) -> String? {
        guard let right = Kit.number(p.correct), Kit.close(right, expected) else { return "correct option \(p.correct) expected \(expected)" }
        guard let typed = Kit.typedAnswer(p), Kit.close(typed, expected) else { return "typed answer \(String(describing: Kit.typedAnswer(p)))" }
        for option in p.options {
            guard let value = Kit.number(option) else { return "wrong option \(option)" }
            if Kit.close(value, expected) { return "wrong option \(option) is right" }
        }
        return nil
    }

    func testRectangle() {
        Kit.check("u08.rectangle") { level, p in
            let text = self.plain(p.prompt)
            let n = self.number
            if let m = Kit.match(#"Ein Rechteck ist "# + n + #" (cm|m) lang und "# + n + #" (?:cm|m) breit\. Berechne den (Umfang|Flächeninhalt)\."#, text) {
                guard level < 3 else { return "forward below level 3" }
                let (a, b) = (Kit.number(m[1])!, Kit.number(m[3])!)
                let expected = m[4] == "Umfang" ? 2 * (a + b) : a * b
                guard p.correct.hasSuffix(m[4] == "Umfang" ? " \(m[2])" : " \(m[2])²") else { return "unit of \(p.correct)" }
                return self.check(p, expected: expected)
            }
            if let m = Kit.match(#"Ein Quadrat hat die Seitenlänge "# + n + #" (cm|m)\. Berechne den (Umfang|Flächeninhalt)\."#, text) {
                guard level == 1 else { return "squares at level 1" }
                let a = Kit.number(m[1])!
                return self.check(p, expected: m[3] == "Umfang" ? 4 * a : a * a)
            }
            if let m = Kit.match(#"Ein Rechteck hat den Umfang "# + n + #" (cm|m) und ist "# + n + #" (?:cm|m) lang\. Wie breit ist es\?"#, text) {
                guard level == 3 else { return "backwards at level 3" }
                let (u, a) = (Kit.number(m[1])!, Kit.number(m[3])!)
                guard let right = Kit.number(p.correct), Kit.close(2 * (a + right), u) else { return "perimeter does not fit back" }
                return self.check(p, expected: right)
            }
            if let m = Kit.match(#"Ein Rechteck hat die Fläche "# + n + #" (cm|m)² und ist "# + n + #" (?:cm|m) lang\. Wie breit ist es\?"#, text) {
                guard level == 3 else { return "backwards at level 3" }
                let (area, a) = (Kit.number(m[1])!, Kit.number(m[3])!)
                guard let right = Kit.number(p.correct), Kit.close(a * right, area) else { return "area does not fit back" }
                return self.check(p, expected: right)
            }
            return "prompt"
        }
    }

    func testArea() {
        Kit.check("u08.area") { level, p in
            let text = self.plain(p.prompt)
            let n = self.number
            if let m = Kit.match(#"Dreieck hat die Grundseite (\d+) (cm|m) und die Höhe (\d+) (?:cm|m)\. Wie groß ist die Fläche\?"#, text) {
                return self.check(p, expected: Double(m[1])! * Double(m[3])! / 2)
            }
            if let m = Kit.match(#"Dreieck hat die Grundseite (\d+) (cm|m) und die Fläche "# + n + #" (?:cm|m)²\. Wie hoch ist das Dreieck\?"#, text) {
                guard level == 3 else { return "backwards at level 3" }
                let (g, area) = (Double(m[1])!, Kit.number(m[3])!)
                guard let right = Kit.number(p.correct), Kit.close(g * right / 2, area) else { return "area does not fit back" }
                return self.check(p, expected: right)
            }
            if let m = Kit.match(#"Parallelogramm hat die Grundseite (\d+) (cm|m), die Höhe (\d+) (?:cm|m) und die schräge Seite (\d+) (?:cm|m)\."#, text) {
                guard Double(m[4])! > Double(m[3])! else { return "slanted side must be longer than the height" }
                return self.check(p, expected: Double(m[1])! * Double(m[3])!)
            }
            if let m = Kit.match(#"Trapez hat die parallelen Seiten (\d+) (cm|m) und (\d+) (?:cm|m) und die Höhe (\d+) (?:cm|m)\."#, text) {
                guard level >= 2 else { return "trapezoid from level 2" }
                return self.check(p, expected: (Double(m[1])! + Double(m[3])!) / 2 * Double(m[4])!)
            }
            return "prompt"
        }
    }

    func testCircle() {
        Kit.check("u08.circle") { level, p in
            let text = self.plain(p.prompt)
            if let m = Kit.match(#"Ein Kreis hat (den Radius|den Durchmesser) (\d+) (cm|m)\. Berechne (die Fläche|den Umfang) in (?:cm|m)²?\. Gib das Ergebnis als Vielfaches von π an\."#, text) {
                let given = Double(m[2])!
                let r = m[1] == "den Radius" ? given : given / 2
                if level == 1, m[1] != "den Radius" { return "level 1 gives the radius" }
                // The factor in front of π, by the formula, as Double.
                let expected = m[4] == "die Fläche" ? r * r : 2 * r
                guard p.correct.hasSuffix("π") else { return "pi" }
                return self.check(p, expected: expected)
            }
            if let m = Kit.match(#"Der Umfang eines Kreises ist (\d+)π (cm|m)\. Wie groß ist der Radius\?"#, text) {
                guard level == 3 else { return "backwards at level 3" }
                guard let right = Kit.number(p.correct), Kit.close(2 * right, Double(m[1])!) else { return "circumference does not fit back" }
                return self.check(p, expected: right)
            }
            if let m = Kit.match(#"Die Fläche eines Kreises ist (\d+)π (cm|m)²\. Wie groß ist der Radius\?"#, text) {
                guard level == 3 else { return "backwards at level 3" }
                guard let right = Kit.number(p.correct), Kit.close(right * right, Double(m[1])!) else { return "area does not fit back" }
                return self.check(p, expected: right)
            }
            return "prompt"
        }
    }

    func testCuboid() {
        Kit.check("u08.cuboid") { level, p in
            let text = self.plain(p.prompt)
            if let m = Kit.match(#"Ein Quader ist (\d+) cm lang, (\d+) cm breit und (\d+) cm hoch\. Berechne (das Volumen|die Oberfläche)\."#, text) {
                let (a, b, c) = (Double(m[1])!, Double(m[2])!, Double(m[3])!)
                let expected = m[4] == "das Volumen" ? a * b * c : 2 * (a * b + a * c + b * c)
                guard p.correct.hasSuffix(m[4] == "das Volumen" ? "cm³" : "cm²") else { return "unit" }
                if level == 1, m[4] != "das Volumen" { return "level 1 volume" }
                return self.check(p, expected: expected)
            }
            if let m = Kit.match(#"Ein Quader mit der Grundfläche (\d+) cm² hat das Volumen (\d+) cm³\. Wie hoch ist er\?"#, text) {
                guard level == 3 else { return "backwards at level 3" }
                guard let right = Kit.number(p.correct), Kit.close(Double(m[1])! * right, Double(m[2])!) else { return "volume does not fit back" }
                return self.check(p, expected: right)
            }
            return "prompt"
        }
    }

    func testSolid() {
        Kit.check("u08.solid") { level, p in
            let text = self.plain(p.prompt)
            if let m = Kit.match(#"Ein Prisma hat die Grundfläche (\d+) cm² und die Höhe (\d+) cm\. Wie groß ist das Volumen\?"#, text) {
                guard level == 1 else { return "prism at level 1" }
                return self.check(p, expected: Double(m[1])! * Double(m[2])!)
            }
            if let m = Kit.match(#"Ein Zylinder hat (den Radius|den Durchmesser) (\d+) cm und die Höhe (\d+) cm\. Berechne das Volumen in cm³\. Gib das Ergebnis als Vielfaches von π an\."#, text) {
                guard level >= 2 else { return "cylinder from level 2" }
                let given = Double(m[2])!
                let r = m[1] == "den Radius" ? given : given / 2
                if level == 2, m[1] != "den Radius" { return "diameter at level 3" }
                return self.check(p, expected: r * r * Double(m[3])!)
            }
            return "prompt"
        }
    }

    /// A unit in metres, so a conversion can be checked by going through the same base unit.
    private func scale(_ unit: String) -> Double? {
        switch unit {
        case "mm²": return 1e-6
        case "cm²": return 1e-4
        case "dm²": return 1e-2
        case "m²": return 1
        case "mm³": return 1e-9
        case "cm³", "ml": return 1e-6
        case "dm³", "l": return 1e-3
        case "m³": return 1
        default: return nil
        }
    }

    func testUnits() {
        Kit.check("u08.units") { level, p in
            let text = self.plain(p.prompt)
            guard let m = Kit.match(#"^Wandle um: (\d+(?:,\d+)?) (\S+) = \? (\S+)$"#, text), let value = Kit.number(m[1]) else { return "prompt" }
            guard let from = self.scale(m[2]), let to = self.scale(m[3]) else { return "units \(m[2]) \(m[3])" }
            // Area and volume units are not mixed.
            guard (m[2].contains("²")) == (m[3].contains("²")) else { return "mixed units" }
            let expected = value * from / to
            guard expected < 1000 else { return "typed answer too big" }
            if level == 1, m[2].contains("³") || m[3].contains("³") || m[2] == "l" || m[3] == "l" { return "level 1 has areas" }
            return self.check(p, expected: expected)
        }
    }

    func testVolumeWord() {
        Kit.check("u08.volumeWord") { level, p in
            let text = self.plain(p.prompt)
            if let m = Kit.match(#"(?:Ein Aquarium|Ein Wassertank|Eine Kiste) ist (\d+) (dm|cm) lang, (\d+) (?:dm|cm) breit und (\d+) (?:dm|cm) hoch\. Wie viele Liter passen hinein\?"#, text) {
                // Through cm³: 1000 cm³ are one liter.
                let factor = m[2] == "dm" ? 10.0 : 1.0
                let cm3 = Double(m[1])! * factor * Double(m[3])! * factor * Double(m[4])! * factor
                if level == 1, m[2] != "dm" { return "level 1 in dm" }
                if level == 2, m[2] != "cm" { return "level 2 in cm" }
                return self.check(p, expected: cm3 / 1000)
            }
            if let m = Kit.match(#"In ein Becken \((\d+) cm lang, (\d+) cm breit\) werden (\d+) l Wasser gefüllt\. Wie hoch steht das Wasser\?"#, text) {
                guard level == 3 else { return "water level at level 3" }
                guard let right = Kit.number(p.correct), Kit.close(Double(m[1])! * Double(m[2])! * right, Double(m[3])! * 1000) else { return "volume does not fit back" }
                return self.check(p, expected: right)
            }
            return "prompt"
        }
    }

    func testAngles() {
        Kit.check("u08.angles") { level, p in
            let text = self.plain(p.prompt)
            let expected: Double
            let kind: Int
            if let m = Kit.match(#"In einem Dreieck sind α = (\d+)° und β = (\d+)°\. Wie groß ist γ\?"#, text) {
                (expected, kind) = (180 - Double(m[1])! - Double(m[2])!, 0)
            } else if let m = Kit.match(#"Einer ist (\d+)° groß\. Wie groß ist der andere\?"#, text), text.hasPrefix("Zwei Winkel liegen nebeneinander auf einer Geraden") {
                (expected, kind) = (180 - Double(m[1])!, 1)
            } else if let m = Kit.match(#"In einem Viereck sind drei Winkel (\d+)°, (\d+)° und (\d+)° groß\. Wie groß ist der vierte Winkel\?"#, text) {
                (expected, kind) = (360 - Double(m[1])! - Double(m[2])! - Double(m[3])!, 2)
            } else if let m = Kit.match(#"gleichschenkliges Dreieck hat (\d+)° an der Basis\. Wie groß ist der Winkel an der Spitze\?"#, text) {
                (expected, kind) = (180 - 2 * Double(m[1])!, 3)
            } else if let m = Kit.match(#"gleichschenkliges Dreieck hat (\d+)° an der Spitze\. Wie groß ist ein Basiswinkel\?"#, text) {
                (expected, kind) = ((180 - Double(m[1])!) / 2, 3)
            } else if let m = Kit.match(#"In einem Dreieck ist α = (\d+)° und β ist (doppelt|dreimal) so groß wie α\. Wie groß ist γ\?"#, text) {
                let a = Double(m[1])!
                (expected, kind) = (180 - a - a * (m[2] == "doppelt" ? 2 : 3), 4)
            } else {
                return "prompt"
            }
            guard expected > 0, expected < 180 else { return "angle \(expected)" }
            if level == 1, kind > 1 { return "level 1 kinds" }
            if level == 3, kind < 2 { return "level 3 kinds" }
            guard p.correct.hasSuffix("°") else { return "unit" }
            return self.check(p, expected: expected)
        }
    }

    func testPythagoras() {
        Kit.check("u08.pythagoras") { level, p in
            let text = self.plain(p.prompt)
            let n = self.number
            if let m = Kit.match(#"die Katheten "# + n + #" cm und "# + n + #" cm lang\. Wie lang ist die Hypotenuse\?"#, text) {
                let (a, b) = (Kit.number(m[1])!, Kit.number(m[2])!)
                guard let c = Kit.number(p.correct), Kit.close(a * a + b * b, c * c), c > max(a, b) else { return "a² + b² is not c²" }
                if level == 1, a > 8 || b > 8 { return "level 1 small triples" }
                return self.check(p, expected: (a * a + b * b).squareRoot())
            }
            if let m = Kit.match(#"die Hypotenuse "# + n + #" cm und eine Kathete "# + n + #" cm lang\. Wie lang ist die andere Kathete\?"#, text) {
                guard level >= 2 else { return "legs from level 2" }
                let (c, a) = (Kit.number(m[1])!, Kit.number(m[2])!)
                guard let b = Kit.number(p.correct), Kit.close(a * a + b * b, c * c), c > a else { return "a² + b² is not c²" }
                return self.check(p, expected: (c * c - a * a).squareRoot())
            }
            return "prompt"
        }
    }

    func testPythagorasWord() {
        Kit.check("u08.pythagorasWord") { level, p in
            let text = self.plain(p.prompt)
            let n = self.number
            if let m = Kit.match(#"Eine "# + n + #" m lange Leiter lehnt an einer Wand\. Ihr Fuß steht "# + n + #" m von der Wand entfernt\. Wie hoch reicht die Leiter\?"#, text) {
                let (c, a) = (Kit.number(m[1])!, Kit.number(m[2])!)
                guard let h = Kit.number(p.correct), Kit.close(a * a + h * h, c * c), c > a else { return "ladder" }
                return self.check(p, expected: (c * c - a * a).squareRoot())
            }
            if let m = Kit.match(#"Ein Rechteck ist "# + n + #" cm lang und "# + n + #" cm breit\. Wie lang ist die Diagonale\?"#, text)
                ?? Kit.match(#"Ein Sportplatz ist "# + n + #" m lang und "# + n + #" m breit\. Anna läuft quer über die Diagonale\. Wie lang ist ihr Weg\?"#, text) {
                let (a, b) = (Kit.number(m[1])!, Kit.number(m[2])!)
                guard let d = Kit.number(p.correct), Kit.close(a * a + b * b, d * d) else { return "diagonal" }
                _ = level
                return self.check(p, expected: (a * a + b * b).squareRoot())
            }
            return "prompt"
        }
    }

    func testRightAngleTest() {
        Kit.check("u08.rightAngleTest") { _, p in
            guard p.prompt == "Welche Seitenlängen gehören zu einem rechtwinkligen Dreieck?" else { return "prompt" }
            func sides(_ text: String) -> [Double]? {
                let found = Kit.matches(#"(\d+) cm"#, text).map { Double($0[1])! }
                return found.count == 3 ? found.sorted() : nil
            }
            guard let right = sides(p.correct), right[0] * right[0] + right[1] * right[1] == right[2] * right[2] else { return "correct option \(p.correct)" }
            guard p.options.count == 3 else { return "three wrong options" }
            for option in p.options {
                guard let s = sides(option) else { return "wrong option \(option)" }
                if s[0] * s[0] + s[1] * s[1] == s[2] * s[2] { return "wrong option \(option) is right-angled" }
                if s[0] + s[1] <= s[2] { return "wrong option \(option) is no triangle" }
            }
            guard let typed = Kit.typedAnswer(p), Kit.close(typed, right[0] * right[0] + right[1] * right[1]) else { return "typed answer" }
            return nil
        }
    }
}
