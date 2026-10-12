import Foundation

/// Unit 5: trigonometry (radians, exact values, derivative of sin and cos, period and amplitude).
enum MathUpperUnit05 {
    static let templates: [UTemplate] = [
        degreesToRadians, radiansToDegrees, exactValue, quadrantSign, pythagoras, derivative, derivativeAt, solveInQuadrant,
        period, amplitude, zeros, integral,
    ]

    // MARK: Exact values

    enum Magnitude {
        case zero, half, root2over2, root3over2, one, root3, root3over3

        var text: String {
            switch self {
            case .zero: return "0"
            case .half: return "1/2"
            case .root2over2: return "√2/2"
            case .root3over2: return "√3/2"
            case .one: return "1"
            case .root3: return "√3"
            case .root3over3: return "√3/3"
            }
        }

        var rational: UQ? {
            switch self {
            case .zero: return .zero
            case .half: return UQ(1, 2)
            case .one: return .one
            default: return nil
            }
        }
    }

    struct Exact {
        let negative: Bool
        let magnitude: Magnitude

        var text: String { (negative && magnitude != .zero ? "−" : "") + magnitude.text }
        var rational: UQ? {
            guard let q = magnitude.rational else { return nil }
            return negative ? -q : q
        }
    }

    /// The exact value for angles whose reference angle is 0, 30, 45, 60 or 90 degrees; nil where it is undefined.
    static func exact(_ fn: String, _ degrees: Int) -> Exact? {
        let d = ((degrees % 360) + 360) % 360
        let reference: Int
        let quadrant: Int
        if d <= 90 { reference = d; quadrant = 1 }
        else if d <= 180 { reference = 180 - d; quadrant = 2 }
        else if d <= 270 { reference = d - 180; quadrant = 3 }
        else { reference = 360 - d; quadrant = 4 }
        let sinMag: [Int: Magnitude] = [0: .zero, 30: .half, 45: .root2over2, 60: .root3over2, 90: .one]
        let cosMag: [Int: Magnitude] = [0: .one, 30: .root3over2, 45: .root2over2, 60: .half, 90: .zero]
        let tanMag: [Int: Magnitude] = [0: .zero, 30: .root3over3, 45: .one, 60: .root3]
        let sinNegative = quadrant >= 3, cosNegative = quadrant == 2 || quadrant == 3
        switch fn {
        case "sin": return sinMag[reference].map { Exact(negative: sinNegative, magnitude: $0) }
        case "cos": return cosMag[reference].map { Exact(negative: cosNegative, magnitude: $0) }
        default: return tanMag[reference].map { Exact(negative: sinNegative != cosNegative, magnitude: $0) }
        }
    }

    static func angleText(_ degrees: Int, radians: Bool) -> String {
        radians ? UText.piMultiple(UQ(degrees, 180)) : "\(UText.signed(degrees))°"
    }

    /// A question whose right answer is a multiple of pi: typed as the factor, chosen as "π/3".
    static func piProblem(
        key: String, prompt: String, answer: UQ, wrongs: [UQ], solution: String, explanation: String, fact: UFact
    ) -> UProblem? {
        let correct = UText.piMultiple(answer)
        let texts = wrongs.filter { $0 != answer }.map(UText.piMultiple)
        return UProblem(
            key: key, prompt: prompt, hint: "(Antworte mit dem Faktor vor π, zum Beispiel π/2 als 0,5.)", number: answer, correct: correct,
            wrong: UProblem.cleaned(texts, against: correct), solution: solution, explanation: explanation, fact: fact
        )
    }

    // MARK: Templates

    static let degreesToRadians = UTemplate("t.rad", pairs: { _, g in
        var items: [(front: String, back: String)] = []
        var used = Set<Int>()
        for _ in 0..<60 where items.count < 4 {
            let d = g.pick([30, 45, 60, 90, 120, 135, 150, 180, 270, 360])
            if used.insert(d).inserted { items.append(("\(d)°", UText.piMultiple(UQ(d, 180)))) }
        }
        return items.count == 4 ? items : nil
    }) { lv, g in
        let options: [Int] = lv == 1 ? [180, 90, 60, 30, 45, 360, 270] : (lv == 2 ? [120, 135, 150, 210, 225, 240, 300, 315] : [330, 75, 15, 105, 165, 20, 40, 72])
        let d = g.pick(options)
        let answer = UQ(d, 180)
        let wrongs = [UQ(d, 360), UQ(180, d), UQ(d), UQ(d, 90), UQ(d, 270)]
        return piProblem(
            key: "t.rad|\(d)", prompt: "Rechne \(d)° ins Bogenmaß um.", answer: answer, wrongs: wrongs,
            solution: "Bogenmaß = Gradmaß · π/180: \(d)·π/180 = \(UText.piMultiple(answer)).",
            explanation: "180° entsprechen π; also multiplizierst du das Gradmaß mit π/180.", fact: .degreesToPi(degrees: d)
        )
    }

    static let radiansToDegrees = UTemplate("t.deg") { lv, g in
        let d = g.pick(lv == 1 ? [180, 90, 60, 45, 30, 360] : (lv == 2 ? [120, 135, 150, 270, 225, 300] : [210, 240, 330, 315, 75, 15]))
        let q = UQ(d, 180)
        let wrongs = [UQ(d) / UQ(2), UQ(2 * d), UQ(d, 360) * UQ(180), UQ(360 - d)]
        return UProblem.numeric(
            key: "t.deg|\(d)", prompt: "Wie viel Grad sind \(UText.piMultiple(q))?", answer: UQ(d), wrongs: UCalc.differing(wrongs, from: UQ(d)),
            solution: "Gradmaß = Bogenmaß · 180°/π: \(UText.piMultiple(q)) entspricht \(d)°.",
            explanation: "π entspricht 180°; setze für π also 180° ein.", fact: .approx(q.double * 180)
        )
    }

    static let exactValue = UTemplate("t.exact") { lv, g in
        let fn = g.pick(lv == 1 ? ["sin", "cos"] : ["sin", "cos", "tan"])
        let angles: [Int] = lv == 1 ? [0, 30, 45, 60, 90] : (lv == 2 ? [0, 30, 45, 60, 90] : [120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360])
        let degrees = g.pick(angles)
        guard let value = exact(fn, degrees) else { return nil }
        let radians = lv >= 2 && g.chance(0.5)
        let angle = angleText(degrees, radians: radians)
        var candidates: [Exact?] = []
        for other in ["sin", "cos", "tan"] where other != fn { candidates.append(exact(other, degrees)) }
        candidates.append(exact(fn, 90 - degrees))
        candidates.append(exact(fn, 180 - degrees))
        candidates.append(exact(fn == "sin" ? "cos" : "sin", 90 - degrees))
        let wrongTexts = candidates.compactMap { $0 }.map(\.text)
        let sol = "\(fn)(\(angle)) = \(value.text). Merke die Werte für 0°, 30°, 45°, 60°, 90° und beachte das Vorzeichen im Quadranten."
        let expl = "Die Tabelle der Winkel 0°, 30°, 45°, 60°, 90° gilt für sin, cos und tan; andere Winkel führst du mit dem Bezugswinkel und dem Vorzeichen des Quadranten darauf zurück."
        let prompt = "Gib den exakten Wert von \(fn)(\(angle)) an."
        if let q = value.rational {
            let correct = q.fractionDisplay
            return UProblem(
                key: "t.exact|\(fn)|\(degrees)|\(radians)", prompt: prompt, hint: "(Antworte als Zahl.)", number: q, correct: correct,
                wrong: UProblem.cleaned(wrongTexts, against: correct), solution: sol, explanation: expl, fact: .trigValue(fn: fn, degrees: degrees)
            )
        }
        return UProblem.choice(
            key: "t.exact|\(fn)|\(degrees)|\(radians)", prompt: prompt, correct: value.text, wrong: wrongTexts, solution: sol,
            explanation: expl, fact: .trigValue(fn: fn, degrees: degrees)
        )
    }

    static let quadrantSign = UTemplate("t.sign") { lv, g in
        let fn = g.pick(["sin", "cos", "tan"])
        let degrees = g.pick([120, 135, 150, 210, 225, 240, 300, 315, 330, 180, 270, 90])
        guard let value = exact(fn, degrees) else { return nil }
        let correct = value.magnitude == .zero ? "null" : (value.negative ? "negativ" : "positiv")
        let angle = angleText(degrees, radians: g.chance(0.5))
        return UProblem.choice(
            key: "t.sign|\(fn)|\(degrees)", prompt: "Welches Vorzeichen hat \(fn)(\(angle))?", correct: correct,
            wrong: ["positiv", "negativ", "null"].filter { $0 != correct },
            solution: "\(fn)(\(angle)) = \(value.text), also \(correct).",
            explanation: "sin ist im 1. und 2. Quadranten positiv, cos im 1. und 4., tan im 1. und 3.; an den Achsen kann der Wert 0 sein.",
            fact: .trigValue(fn: fn, degrees: degrees)
        )
    }

    static let pythagoras = UTemplate("t.pyth") { lv, g in
        let triples = [(3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25), (20, 21, 29)]
        let (a, b, c) = g.pick(lv == 1 ? Array(triples[0..<2]) : triples)
        let askTan = lv == 3 && g.chance(0.5)
        let s = UQ(a, c)
        let answer = askTan ? UQ(a, b) : UQ(b, c)
        let wrongs = askTan
            ? [UQ(b, a), UQ(a, c), UQ(b, c), UQ(c - a, c)]
            : [UQ(1) - s, s * s, UQ(c, b), UQ(a, b), UQ(1) - s * s]
        return UProblem.numeric(
            key: "t.pyth|\(a)|\(c)|\(askTan)", prompt: "Es gilt sin(x) = \(a)/\(c) mit 0° < x < 90°. Wie groß ist \(askTan ? "tan(x)" : "cos(x)")?",
            answer: answer, wrongs: UCalc.differing(wrongs, from: answer),
            solution: "sin²x + cos²x = 1, also cos²x = 1 − \(a * a)/\(c * c) = \(b * b)/\(c * c) und cos x = \(b)/\(c)" + (askTan ? "; tan x = sin x / cos x = \(a)/\(b)." : "."),
            explanation: "Aus sin²x + cos²x = 1 folgt cos x = √(1 − sin²x); im 1. Quadranten ist cos x positiv.",
            fact: .cosFromSin(sin: s, askTan: askTan)
        )
    }

    static func trigText(_ coefficient: Int, _ fn: String, _ k: UQ) -> String {
        let argument: String
        if k == .one { argument = "x" }
        else if k.isInt { argument = "\(k.n)x" }
        else { argument = "x/\(k.d)" }
        let head = coefficient == 1 ? "" : (coefficient == -1 ? "−" : (coefficient < 0 ? "−\(-coefficient)" : "\(coefficient)"))
        return "\(head)\(fn)(\(argument))"
    }

    static let derivative = UTemplate("t.deriv") { lv, g in
        let fn = g.pick(["sin", "cos"])
        let k = lv == 1 ? 1 : g.int(2...5)
        let a = lv == 1 ? g.int(2...4) : g.nonzero(-4...4)
        let factor = fn == "sin" ? a * k : -a * k
        let derivFn = fn == "sin" ? "cos" : "sin"
        let correct = trigText(factor, derivFn, UQ(k))
        let sign = fn == "sin" ? 1 : -1
        let wrong = [
            trigText(sign * a, derivFn, UQ(k)),
            trigText(factor, fn, UQ(k)),
            trigText(factor, derivFn, UQ(1)),
            trigText(sign * k, derivFn, UQ(k)),
        ]
        return UProblem.choice(
            key: "t.deriv|\(fn)|\(a)|\(k)", prompt: "Bilde die Ableitung von f(x) = \(trigText(a, fn, UQ(k))).", correct: correct, wrong: wrong,
            solution: "(sin x)′ = cos x und (cos x)′ = −sin x; die innere Ableitung \(k) kommt als Faktor dazu. Ergebnis: \(correct).",
            explanation: "Bei sin(kx) und cos(kx) kommt k als Faktor vor die Ableitung; die Ableitung von cos hat ein Minuszeichen.",
            fact: .trigDeriv(fn: fn, a: a, k: k)
        )
    }

    static let derivativeAt = UTemplate("t.derivAt") { lv, g in
        let fn = g.pick(["sin", "cos"])
        let k = lv == 1 ? 1 : g.int(2...4)
        let a = lv == 1 ? g.int(1...3) : g.nonzero(-4...4)
        let phase = g.pick([0, 1, 2, 3, 4])   // k x0 = phase * pi / 2
        let x0 = UQ(phase, 2 * k)
        let f: (Double) -> Double = { fn == "sin" ? Double(a) * sin(Double(k) * $0) : Double(a) * cos(Double(k) * $0) }
        let cosPhase = [1, 0, -1, 0, 1][phase], sinPhase = [0, 1, 0, -1, 0][phase]
        let answer = UQ(fn == "sin" ? a * k * cosPhase : -a * k * sinPhase)
        let atFunction = UQ(fn == "sin" ? a * sinPhase : a * cosPhase)
        let wrongs = [
            UQ(fn == "sin" ? a * cosPhase : -a * sinPhase), atFunction,
            UQ(fn == "sin" ? a * k * sinPhase : a * k * cosPhase), UQ(fn == "sin" ? -a * k * sinPhase : -a * k * cosPhase),
        ]
        let xText = x0.isZero ? "0" : UText.piMultiple(x0)
        return UProblem.numeric(
            key: "t.derivAt|\(fn)|\(a)|\(k)|\(phase)", prompt: "Berechne f′(\(xText)) für f(x) = \(trigText(a, fn, UQ(k))).",
            answer: answer, wrongs: UCalc.differing(wrongs, from: answer),
            solution: "f′(x) = \(trigText(fn == "sin" ? a * k : -a * k, fn == "sin" ? "cos" : "sin", UQ(k))). Bei x = \(xText) ist \(k)·x = \(UText.piMultiple(UQ(phase, 2))); damit f′ = \(answer.text).",
            explanation: "Erst mit Kettenregel ableiten, dann einsetzen; sin und cos haben bei Vielfachen von π/2 die Werte 0, 1 oder −1.",
            fact: .derivOfFunction(f, at: x0.double * Double.pi)
        )
    }

    static let solveInQuadrant = UTemplate("t.solve") { lv, g in
        let table: [(String, UQ, UQ)] = [
            ("sin", .zero, .zero), ("sin", UQ(1, 2), UQ(1, 6)), ("sin", .one, UQ(1, 2)),
            ("cos", .one, .zero), ("cos", UQ(1, 2), UQ(1, 3)), ("cos", .zero, UQ(1, 2)),
        ]
        let (fn, value, x) = g.pick(table)
        let standard = [UQ.zero, UQ(1, 6), UQ(1, 4), UQ(1, 3), UQ(1, 2)]
        let wrongs = standard + [UQ(1, 2) - x, UQ(2, 3)]
        return piProblem(
            key: "t.solve|\(fn)|\(value.fraction)", prompt: "Löse \(fn)(x) = \(value.fraction) für 0 ≤ x ≤ π/2.", answer: x, wrongs: wrongs,
            solution: "\(fn)(\(UText.piMultiple(x))) = \(value.fraction) laut Wertetabelle; im Intervall [0; π/2] gibt es genau eine Lösung: x = \(UText.piMultiple(x)).",
            explanation: "Lies die Wertetabelle von sin und cos rückwärts; im ersten Quadranten ist die Lösung eindeutig.",
            fact: .trigSolve(fn: fn, value: value)
        )
    }

    static func kText(_ k: UQ) -> String {
        if k == .one { return "x" }
        return k.isInt ? "\(k.n)x" : "x/\(k.d)"
    }

    static let period = UTemplate("t.period") { lv, g in
        let fn = g.pick(["sin", "cos"])
        let k = g.pick(lv == 1 ? [UQ(1), UQ(2)] : [UQ(2), UQ(3), UQ(4), UQ(1, 2), UQ(1, 3), UQ(6)])
        let d = lv == 3 ? g.nonzero(-3...3) : 0
        let a = lv == 1 ? 1 : g.nonzero(-3...3)
        let answer = UQ(2) / k
        let wrongs = [UQ(2) * k, UQ(1) / k, k, UQ(2), UQ(1) * k]
        let text = (a == 1 ? "" : (a == -1 ? "−" : "\(UText.signed(a))·")) + "\(fn)(\(kText(k)))" + (d == 0 ? "" : (d < 0 ? " − " : " + ") + "\(abs(d))")
        return piProblem(
            key: "t.period|\(fn)|\(a)|\(k.fraction)|\(d)", prompt: "Welche Periode hat f(x) = \(text)?", answer: answer, wrongs: wrongs,
            solution: "Die Periode von \(fn)(kx) ist 2π/k. Hier k = \(k.fraction): \(UText.piMultiple(answer)). Faktor und Verschiebung ändern die Periode nicht.",
            explanation: "Der Faktor k vor x staucht den Graphen: die Periode ist 2π geteilt durch k.", fact: .period(fn: fn, k: k)
        )
    }

    static let amplitude = UTemplate("t.amp") { lv, g in
        let fn = g.pick(["sin", "cos"])
        let a = g.nonzero(lv == 1 ? 1...4 : -5...5)
        let k = lv == 1 ? 1 : g.int(1...4)
        let d = lv == 1 ? 0 : g.int(-3...4)
        let kinds: [UAmpKind] = lv == 1 ? [.amplitude, .maximum] : (lv == 2 ? [.amplitude, .maximum, .minimum] : [.maximum, .minimum, .midline])
        let kind = g.pick(kinds)
        let amp = abs(a)
        let answer: Int
        let question: String
        let wrongs: [Int]
        switch kind {
        case .amplitude: answer = amp; question = "Wie groß ist die Amplitude von"; wrongs = [a * k, amp + d, d, amp * 2]
        case .maximum: answer = amp + d; question = "Welchen größten Funktionswert hat"; wrongs = [amp, a + d, d - amp, amp * k + d]
        case .minimum: answer = d - amp; question = "Welchen kleinsten Funktionswert hat"; wrongs = [-amp, d + amp, d, a + d]
        case .midline: answer = d; question = "Bei welchem y-Wert liegt die Mittellinie von"; wrongs = [amp, amp + d, d - amp, a]
        }
        let text = (a == 1 ? "" : (a == -1 ? "−" : "\(UText.signed(a))·")) + "\(fn)(\(k == 1 ? "x" : "\(k)x"))" + (d == 0 ? "" : (d < 0 ? " − " : " + ") + "\(abs(d))")
        return UProblem.numeric(
            key: "t.amp|\(fn)|\(a)|\(k)|\(d)|\(kind)", prompt: "\(question) f(x) = \(text)?", answer: UQ(answer),
            wrongs: UCalc.differing(wrongs.map { UQ($0) }, from: UQ(answer)),
            solution: "Bei f(x) = a·\(fn)(kx) + d ist die Amplitude |a| = \(amp), die Mittellinie y = \(d), das Maximum \(amp + d), das Minimum \(d - amp). Gesucht: \(answer).",
            explanation: "Der Faktor a streckt die Schwingung (Amplitude |a|), die Zahl d verschiebt sie nach oben oder unten.",
            fact: .amplitude(a: UQ(a), k: UQ(k), d: UQ(d), what: kind)
        )
    }

    static let zeros = UTemplate("t.zeros") { lv, g in
        let fn = g.pick(["sin", "cos"])
        let k = lv <= 2 ? g.int(1...3) : g.int(2...4)
        let answer = fn == "sin" ? 2 * k + 1 : 2 * k
        let wrongs = [2 * k, 2 * k + 2, k, 4 * k, 2 * k - 1, k + 1]
        return UProblem.numeric(
            key: "t.zeros|\(fn)|\(k)", prompt: "Wie viele Nullstellen hat f(x) = \(fn)(\(k == 1 ? "x" : "\(k)x")) im Intervall [0; 2π]? Die Randpunkte zählen mit.",
            answer: UQ(answer), wrongs: UCalc.differing(wrongs.map { UQ($0) }, from: UQ(answer)),
            solution: fn == "sin"
                ? "sin(kx) = 0 für kx = 0, π, 2π, …; bis 2π sind das \(2 * k + 1) Nullstellen (x = j·π/\(k) für j = 0 bis \(2 * k))."
                : "cos(kx) = 0 für kx = π/2, 3π/2, …; bis 2π sind das \(2 * k) Nullstellen.",
            explanation: "Skizziere die Schwingung: Im Intervall [0; 2π] hat sin(kx) genau k Perioden.",
            fact: .zerosIn(fn: fn, k: k)
        )
    }

    static let integral = UTemplate("t.int") { lv, g in
        let a = g.int(1...4)
        enum Variant: CaseIterable { case sinHalf, cosQuarter, sinFull }
        let variant = g.pick(Variant.allCases)
        let k = g.int(1...3)
        let f: (Double) -> Double
        let from = 0.0
        let to: Double
        let text: String
        let answer: UQ
        let bound: String
        switch variant {
        case .sinHalf:
            f = { Double(a) * sin(Double(k) * $0) }
            to = Double.pi / Double(k)
            answer = UQ(2 * a, k)
            bound = UText.piMultiple(UQ(1, k))
            text = trigText(a, "sin", UQ(k))
        case .cosQuarter:
            f = { Double(a) * cos(Double(k) * $0) }
            to = Double.pi / Double(2 * k)
            answer = UQ(a, k)
            bound = UText.piMultiple(UQ(1, 2 * k))
            text = trigText(a, "cos", UQ(k))
        case .sinFull:
            f = { Double(a) * cos(Double(k) * $0) }
            to = Double.pi
            answer = .zero
            bound = "π"
            text = trigText(a, "cos", UQ(k))
        }
        let wrongs = [UQ(a * k), UQ(2 * a), UQ(a), UQ(a, k * k), UQ(2 * a * k), UQ(a, 2 * k)]
        return UProblem.numeric(
            key: "t.int|\(variant)|\(a)|\(k)", prompt: "Berechne das Integral von \(text) dx von x = 0 bis x = \(bound).",
            answer: answer, wrongs: UCalc.differing(wrongs, from: answer),
            solution: "Stammfunktion von \(text) ist \(variant == .sinHalf ? "−\(a)/\(k)·cos" : "\(a)/\(k)·sin")(\(k == 1 ? "x" : "\(k)x")). Obere Grenze minus untere Grenze ergibt \(answer.text).",
            explanation: "Beim Aufleiten von sin(kx) und cos(kx) teilst du durch k; ∫ sin x dx = −cos x + C und ∫ cos x dx = sin x + C.",
            fact: .integralOfFunction(f, from: from, to: to)
        )
    }
}
