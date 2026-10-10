import Foundation

/// Unit 1: derivative (power, sum and factor rule, f'(a), slope of the tangent, tangent line as a number).
enum MathUpperUnit01 {
    static let templates: [UTemplate] = [power, value, linear, slope, whereSlope, tangentT, tangentY, horizontal, negativeExponent]

    static let power = UTemplate("d1.power", pairs: { _, g in
        var items: [(front: String, back: String)] = []
        var fronts = Set<String>(), backs = Set<String>()
        for _ in 0..<60 where items.count < 4 {
            let n = g.int(2...5), a = g.int(1...6)
            let f = UPoly(terms: [(n, UQ(a))])
            let front = UCalc.fx(f), back = "f′(x) = " + f.derivative.text
            if fronts.insert(LearnExercise.folded(front)).inserted, backs.insert(LearnExercise.folded(back)).inserted {
                items.append((front, back))
            }
        }
        return items.count == 4 ? items : nil
    }) { lv, g in
        let f: UPoly
        switch lv {
        case 1: f = UPoly(terms: [(g.int(2...5), UQ(g.int(2...6)))])
        case 2: f = g.poly(degree: g.int(2...4), terms: 2, coefficients: 1...6)
        default: f = g.poly(degree: g.int(3...4), terms: g.int(3...4), coefficients: 1...6)
        }
        let d = f.derivative
        var wrong = [UCalc.mistaken(f, .noMultiply), UCalc.mistaken(f, .noLower), UCalc.mistaken(f, .keepConstant), UCalc.mistaken(f, .integrate)]
        if f.c.filter({ !$0.isZero }).count == 1, let top = f.c.indices.last {
            wrong.append(UPoly(terms: [(top - 1, UQ(top))]))
        }
        return UProblem.choice(
            key: "d1.power|\(f.text)", prompt: "Bilde die Ableitung von \(UCalc.fx(f)).", correct: d.text,
            wrong: wrong.filter { $0 != d }.map(\.text),
            solution: "Summand für Summand: Exponent als Faktor nach vorn, Exponent um 1 senken, Konstanten fallen weg. Ergebnis: f′(x) = \(d.text).",
            explanation: "Potenzregel: (a·xⁿ)′ = a·n·xⁿ⁻¹; eine Konstante hat die Ableitung 0.",
            fact: .derivPoly(f: f, correct: d, wrong: wrong.filter { $0 != d })
        )
    }

    static let value = UTemplate("d1.value") { lv, g in
        let f = UCalc.poly(g, level: lv)
        let a = lv == 1 ? g.int(1...3) : g.int(-3...3)
        let x = UQ(a)
        let answer = f.derivative.eval(x)
        let wrongs = UCalc.differing([
            f.eval(x), UCalc.mistaken(f, .noMultiply).eval(x), UCalc.mistaken(f, .noLower).eval(x),
            UCalc.mistaken(f, .keepConstant).eval(x), f.derivative.eval(UQ(a + 1)),
        ], from: answer)
        return UProblem.numeric(
            key: "d1.value|\(f.text)|\(a)", prompt: "Berechne f′(\(UText.signed(a))) für \(UCalc.fx(f)).", answer: answer, wrongs: wrongs,
            solution: "f′(x) = \(f.derivative.text); f′(\(UText.signed(a))) = \(answer.text).",
            explanation: "Erst ableiten, dann die Stelle einsetzen; setzt du in f ein, bekommst du den Funktionswert, nicht die Steigung.",
            fact: .derivAt(f, x)
        )
    }

    static let linear = UTemplate("d1.linear") { lv, g in
        let m = g.nonzero(-6...6), t = g.nonzero(-9...9)
        let kind = lv == 1 ? 0 : g.int(0...2)
        let f: UPoly
        let answer: UQ
        switch kind {
        case 0: f = UPoly(ints: [t, m]); answer = UQ(m)
        case 1: f = UPoly(ints: [t]); answer = .zero
        default: f = UPoly(ints: [0, 1]); answer = .one
        }
        let candidates: [UQ]
        switch kind {
        case 0: candidates = [UQ(t), UQ(m * t), UQ(m + t), .zero]
        case 1: candidates = [UQ(t), .one, UQ(t + 1), UQ(2)]
        default: candidates = [.zero, UQ(2), .one + .one + .one]
        }
        let wrongs = UCalc.differing(candidates, from: answer)
        return UProblem.numeric(
            key: "d1.linear|\(f.text)", prompt: "Welche Steigung hat der Graph von \(UCalc.fx(f)) an jeder Stelle?", answer: answer, wrongs: wrongs,
            solution: "f′(x) = \(f.derivative.text.isEmpty ? "0" : f.derivative.text), also überall \(answer.text).",
            explanation: "Eine Gerade hat überall dieselbe Steigung; eine Konstante hat die Steigung 0.",
            fact: .derivAt(f, .zero)
        )
    }

    static let slope = UTemplate("d1.slope") { lv, g in
        let f = UCalc.poly(g, level: lv)
        let a = lv == 1 ? g.int(1...3) : g.nonzero(-3...3)
        let x = UQ(a), y = f.eval(x)
        let answer = f.derivative.eval(x)
        let wrongs = UCalc.differing([y, y / x, UCalc.mistaken(f, .noMultiply).eval(x), UCalc.mistaken(f, .noLower).eval(x), f.derivative.eval(.zero)], from: answer)
        return UProblem.numeric(
            key: "d1.slope|\(f.text)|\(a)",
            prompt: "Der Graph von \(UCalc.fx(f)) geht durch P(\(UText.signed(a)) | \(y.text)). Wie groß ist die Steigung der Tangente in P?",
            answer: answer, wrongs: wrongs,
            solution: "Die Tangentensteigung ist f′(\(UText.signed(a))): f′(x) = \(f.derivative.text), also \(answer.text).",
            explanation: "Die Steigung der Tangente in einem Punkt ist die Ableitung an dieser Stelle, nicht der y-Wert des Punktes.",
            fact: .derivAt(f, x)
        )
    }

    static let whereSlope = UTemplate("d1.where") { lv, g in
        let a = lv == 3 ? g.nonzero(-3...3) : g.int(1...3)
        let x0 = g.int(-3...3)
        let b = g.int(-5...5), c = g.int(-6...6)
        let f = UPoly(ints: [c, b, a])
        let m = 2 * a * x0 + b
        let answer = UQ(x0)
        let wrongs = UCalc.differing([UQ(m - b, a), UQ(m, 2 * a), UQ(m + b, 2 * a), UQ(m - b), UQ(b, 2 * a)], from: answer)
        return UProblem.numeric(
            key: "d1.where|\(f.text)|\(m)", prompt: "An welcher Stelle hat der Graph von \(UCalc.fx(f)) die Steigung \(UText.signed(m))?",
            answer: answer, wrongs: wrongs,
            solution: "f′(x) = \(f.derivative.text) = \(UText.signed(m)) ergibt x = \(x0).",
            explanation: "Setze die Ableitung gleich der gesuchten Steigung und löse nach x auf.",
            fact: .slopeX(f, UQ(m))
        )
    }

    static let tangentT = UTemplate("d1.tangentT") { lv, g in
        let f = UCalc.poly(g, level: lv)
        let a = g.int(lv == 1 ? 1...2 : -2...3)
        let x = UQ(a)
        let m = f.derivative.eval(x), y = f.eval(x)
        let t = y - m * x
        let wrongs = UCalc.differing([y, y + m * x, m * x, m, UCalc.mistaken(f, .noMultiply).eval(x)], from: t)
        return UProblem.numeric(
            key: "d1.tangentT|\(f.text)|\(a)",
            prompt: "Die Tangente an \(UCalc.fx(f)) bei x = \(UText.signed(a)) hat die Gleichung y = m·x + t. Wie groß ist t?",
            answer: t, wrongs: wrongs,
            solution: "m = f′(\(UText.signed(a))) = \(m.text), Punkt (\(UText.signed(a)) | \(y.text)). Aus \(y.text) = \(m.text)·\(UText.signed(a)) + t folgt t = \(t.text).",
            explanation: "Setze Steigung und Punkt in y = m·x + t ein und löse nach t auf.",
            fact: .tangentT(f, x)
        )
    }

    static let tangentY = UTemplate("d1.tangentY") { lv, g in
        let f = UCalc.poly(g, level: lv)
        let a = g.int(1...2)
        var b = g.int(-3...3)
        if b == a { b += 1 }
        let x = UQ(a), xb = UQ(b)
        let m = f.derivative.eval(x), y = f.eval(x)
        let answer = y + m * (xb - x)
        let wrongs = UCalc.differing([f.eval(xb), y + m * xb, m * (xb - x), y + m, y * m], from: answer)
        return UProblem.numeric(
            key: "d1.tangentY|\(f.text)|\(a)|\(b)",
            prompt: "Die Tangente an \(UCalc.fx(f)) bei x = \(a) wird nach x = \(UText.signed(b)) verlängert. Welchen y-Wert hat sie dort?",
            answer: answer, wrongs: wrongs,
            solution: "Tangente: y = \(y.text) + \(m.text)·(x − \(a)). Bei x = \(UText.signed(b)): y = \(answer.text).",
            explanation: "Die Tangente ist y = f(a) + f′(a)·(x − a); der Funktionswert f(b) gehört zur Kurve, nicht zur Tangente.",
            fact: .tangentY(f, x, xb)
        )
    }

    static let horizontal = UTemplate("d1.flat") { lv, g in
        let a = lv == 3 ? g.nonzero(-3...3) : g.int(1...3)
        let h = g.int(-4...4), k = g.int(-5...5)
        let f = UPoly(ints: [a * h * h + k, -2 * a * h, a])
        let askY = lv >= 2
        let answer = UQ(askY ? k : h)
        let wrongs: [UQ] = askY
            ? [UQ(a * h * h + k), UQ(h), UQ(a * k), UQ(-2 * a * h)]
            : [UQ(2 * h), UQ(k), UQ(a * h * h + k), UQ(-2 * a * h)]
        return UProblem.numeric(
            key: "d1.flat|\(f.text)|\(askY)",
            prompt: askY ? "Der Graph von \(UCalc.fx(f)) hat eine waagerechte Tangente. Welchen y-Wert hat der Berührpunkt?"
                : "An welcher Stelle hat der Graph von \(UCalc.fx(f)) eine waagerechte Tangente?",
            answer: answer, wrongs: UCalc.differing(wrongs, from: answer),
            solution: "f′(x) = \(f.derivative.text) = 0 ergibt x = \(h); f(\(h)) = \(k).",
            explanation: "Eine waagerechte Tangente hat die Steigung 0, also f′(x) = 0.",
            fact: askY ? .flatY(f) : .flatX(f)
        )
    }

    static let negativeExponent = UTemplate("d1.negexp") { lv, g in
        let useRoot = lv >= 2 && g.chance(0.4)
        if useRoot {
            let c = g.int(1...6) * 2
            let r = g.int(1...5)
            let x = r * r
            let answer = UQ(c, 2 * r)
            let name = c == 1 ? "√x" : "\(c)√x"
            let wrongs = UCalc.differing([UQ(c, r), UQ(c * r, 2), UQ(1, 2 * r), UQ(c, 2 * x)], from: answer)
            return UProblem.numeric(
                key: "d1.negexp|root|\(c)|\(x)", prompt: "Berechne f′(\(x)) für f(x) = \(name).", answer: answer, wrongs: wrongs,
                solution: "√x = x^(1/2), also f′(x) = \(c)·1/2·x^(−1/2) = \(c)/(2√x). Bei x = \(x): \(answer.text).",
                explanation: "Wurzeln schreibst du als Potenz: √x = x^(1/2); dann gilt die Potenzregel.",
                fact: .derivOfFunction({ Double(c) * $0.squareRoot() }, at: Double(x))
            )
        }
        let n = lv == 1 ? g.int(1...2) : g.int(2...3)
        let c = g.int(1...5)
        let a = lv == 1 ? 1 : g.int(1...2)
        let answer = UQ(-n * c) / UQ(a).power(n + 1)
        let wrongs = UCalc.differing([
            UQ(n * c) / UQ(a).power(n), UQ(c) / UQ(a).power(n + 1), UQ(-(n - 1) * c) / UQ(a).power(n), UQ(-n * c) / UQ(a).power(n),
        ], from: answer)
        let name = (c == 1 ? "1" : "\(c)") + "/x" + (n == 1 ? "" : UText.superscript(n))
        return UProblem.numeric(
            key: "d1.negexp|\(c)|\(n)|\(a)", prompt: "Berechne f′(\(a)) für f(x) = \(name).", answer: answer, wrongs: wrongs,
            solution: "f(x) = \(c)·x^(−\(n)), also f′(x) = −\(n * c)·x^(−\(n + 1)) = −\(n * c)/x^\(n + 1). Bei x = \(a): \(answer.text).",
            explanation: "Schreibe 1/xⁿ als x⁻ⁿ; die Potenzregel gilt auch für negative Exponenten.",
            fact: .derivOfFunction({ Double(c) / pow($0, Double(n)) }, at: Double(a))
        )
    }
}
