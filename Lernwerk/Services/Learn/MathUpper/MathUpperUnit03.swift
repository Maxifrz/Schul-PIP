import Foundation

/// Unit 3: integral calculus (antiderivative, definite integral, area between graph and x-axis, mean value).
/// Integrands are built as derivatives of polynomials with whole coefficients, so the results are whole numbers.
enum MathUpperUnit03 {
    static let templates: [UTemplate] = [antiderivative, noConstant, definite, signed, area, rules, mean, upper]

    static func wrapped(_ f: UPoly) -> String {
        let terms = f.c.filter { !$0.isZero }.count
        let negativeSingle = terms == 1 && (f.c.last?.n ?? 0) < 0
        return terms > 1 || negativeSingle ? "(" + f.text + ")" : f.text
    }

    static func bracketed(_ q: UQ) -> String { q.n < 0 ? "(\(q.text))" : q.text }

    static func integralSign(_ a: Int, _ b: Int) -> String { "∫" + UText.subscripted(a) + UText.superscript(b) }

    static func integralText(_ a: Int, _ b: Int, _ f: UPoly) -> String { integralSign(a, b) + " " + wrapped(f) + " dx" }

    /// A polynomial F with whole coefficients and no constant term, and its derivative f.
    static func pair(_ g: UGen, level: Int) -> (F: UPoly, f: UPoly) {
        for _ in 0..<40 {
            let F: UPoly
            switch level {
            case 1: F = g.poly(degree: 2, terms: g.int(1...2), coefficients: 1...3, negatives: false)
            case 2: F = g.poly(degree: g.int(2...3), terms: 2, coefficients: 1...3)
            default: F = g.poly(degree: 3, terms: g.int(2...3), coefficients: 1...3)
            }
            let noConstant = UPoly(F.c.enumerated().map { $0.offset == 0 ? .zero : $0.element })
            let f = noConstant.derivative
            if !f.isZero, f.degree >= 1 { return (noConstant, f) }
        }
        let F = UPoly(ints: [0, 0, 1])
        return (F, F.derivative)
    }

    static let antiderivative = UTemplate("i.anti", pairs: { _, g in
        var items: [(front: String, back: String)] = []
        var fronts = Set<String>(), backs = Set<String>()
        for _ in 0..<80 where items.count < 4 {
            let (F, f) = pair(g, level: 1)
            let front = "∫ " + wrapped(f) + " dx", back = F.text + " + C"
            if fronts.insert(LearnExercise.folded(front)).inserted, backs.insert(LearnExercise.folded(back)).inserted {
                items.append((front, back))
            }
        }
        return items.count == 4 ? items : nil
    }) { lv, g in
        let F: UPoly, f: UPoly
        if lv == 3 {
            f = g.poly(degree: g.int(2...3), terms: g.int(2...3), coefficients: 1...5)
            F = f.integral
        } else {
            (F, f) = pair(g, level: lv)
        }
        let correct = F.text + " + C"
        let forgotDivide = UPoly(terms: f.c.enumerated().filter { !$0.element.isZero }.map { ($0.offset + 1, $0.element) })
        let divideOld = UPoly(terms: f.c.enumerated().filter { !$0.element.isZero }.map { ($0.offset + 1, $0.offset == 0 ? $0.element : $0.element / UQ($0.offset)) })
        let wrongPolys = [forgotDivide, f.derivative, divideOld].filter { $0 != F && !$0.isZero }
        let wrong = wrongPolys.map { $0.text + " + C" }
        return UProblem.choice(
            key: "i.anti|\(f.text)", prompt: "Welche Funktion ist eine Stammfunktion von \(UCalc.fx(f))?", correct: correct, wrong: wrong,
            solution: "Jeden Summanden aufleiten: Exponent um 1 erhöhen, durch den neuen Exponenten teilen. Dazu kommt + C. Ergebnis: F(x) = \(correct).",
            explanation: "Aufleiten ist die Umkehrung des Ableitens: Leite zur Probe F ab, es muss f herauskommen.",
            fact: .antiderivative(f: f, correct: F, wrong: wrongPolys)
        )
    }

    static let noConstant = UTemplate("i.noC") { lv, g in
        let (F, f) = pair(g, level: 1)
        let a = g.int(0...1), b = a + g.int(1...3)
        let value = F.eval(UQ(b)) - F.eval(UQ(a))
        let c = "C"
        func text(_ v: UQ, _ extra: String) -> String { extra.isEmpty ? v.text : "\(v.text) + \(extra)" }
        let correct = value.text
        let wrong = [text(value, c), text(value, "2C"), text(F.eval(UQ(b)), c)]
        return UProblem.choice(
            key: "i.noC|\(f.text)|\(a)|\(b)",
            prompt: "Du berechnest \(integralText(a, b, f)) mit der Stammfunktion F(x) = \(F.text) + C. Was kommt heraus?", correct: correct, wrong: wrong,
            solution: "F(\(b)) − F(\(a)) = (\(F.eval(UQ(b)).text) + C) − (\(F.eval(UQ(a)).text) + C) = \(value.text). Das C hebt sich auf.",
            explanation: "Beim bestimmten Integral wird die Stammfunktion zweimal eingesetzt und subtrahiert; die Konstante C fällt dabei weg.",
            fact: .definite(f, UQ(a), UQ(b))
        )
    }

    static let definite = UTemplate("i.definite") { lv, g in
        let (F, f) = pair(g, level: lv)
        let a = lv == 1 ? g.int(0...1) : g.int(-2...1)
        let b = max(a + g.int(1...(lv == 3 ? 3 : 2)), 0)
        let answer = F.eval(UQ(b)) - F.eval(UQ(a))
        let wrongs = UCalc.differing([
            F.eval(UQ(b)), F.eval(UQ(b)) + F.eval(UQ(a)), f.eval(UQ(b)) - f.eval(UQ(a)), f.eval(UQ(b)) * UQ(b - a),
        ], from: answer)
        return UProblem.numeric(
            key: "i.definite|\(f.text)|\(a)|\(b)", prompt: "Berechne \(integralText(a, b, f)).", answer: answer, wrongs: wrongs,
            solution: "F(x) = \(F.text); F(\(b)) − F(\(a)) = \(F.eval(UQ(b)).text) − \(bracketed(F.eval(UQ(a)))) = \(answer.text).",
            explanation: "Bestimmtes Integral: obere Grenze in F einsetzen minus untere Grenze in F einsetzen; ein C wird nicht gebraucht.",
            fact: .definite(f, UQ(a), UQ(b))
        )
    }

    /// f = lead (x - r1)(x - r2) with a whole-number integral between the roots.
    static func parabola(_ g: UGen, signedLead: Bool) -> (f: UPoly, r1: Int, r2: Int, integral: UQ)? {
        for _ in 0..<200 {
            let r1 = g.int(-3...2), r2 = r1 + g.int(2...6)
            if r2 < 0 { continue }
            let lead = signedLead ? g.nonzero(-3...3) : g.int(1...3)
            let f = UPoly.fromRoots(lead: UQ(lead), roots: [UQ(r1), UQ(r2)])
            let F = f.integral
            let value = F.eval(UQ(r2)) - F.eval(UQ(r1))
            if value.isInt, value.magnitude.n <= 60 { return (f, r1, r2, value) }
        }
        return nil
    }

    static let signed = UTemplate("i.signed") { lv, g in
        guard let p = parabola(g, signedLead: true) else { return nil }
        let F = p.f.integral
        let wrongs = UCalc.differing([
            p.integral.magnitude, F.eval(UQ(p.r2)), F.eval(UQ(p.r2)) - F.eval(.zero), p.f.eval(UQ(p.r2)) - p.f.eval(UQ(p.r1)),
        ], from: p.integral)
        return UProblem.numeric(
            key: "i.signed|\(p.f.text)", prompt: "Berechne \(integralText(p.r1, p.r2, p.f)). Die Grenzen sind die Nullstellen.",
            answer: p.integral, wrongs: wrongs,
            solution: "F(x) = \(F.text); F(\(p.r2)) − F(\(p.r1)) = \(p.integral.text). Das Vorzeichen bleibt stehen: Liegt der Graph unter der x-Achse, ist das Integral negativ.",
            explanation: "Das Integral zählt Flächen unter der x-Achse negativ; erst der Flächeninhalt nimmt den Betrag.",
            fact: .definite(p.f, UQ(p.r1), UQ(p.r2))
        )
    }

    static let area = UTemplate("i.area") { lv, g in
        if lv == 3 {
            for _ in 0..<300 {
                var roots = Set<Int>()
                while roots.count < 3 { roots.insert(g.int(-3...3)) }
                let r = roots.sorted()
                let f = UPoly.fromRoots(lead: UQ(g.pick([1, 1, -1, 2])), roots: r.map { UQ($0) })
                let F = f.integral
                let first = F.eval(UQ(r[1])) - F.eval(UQ(r[0]))
                let second = F.eval(UQ(r[2])) - F.eval(UQ(r[1]))
                let total = first.magnitude + second.magnitude
                guard total.d <= 2, total.n > 0 else { continue }
                let wrongs = UCalc.differing([first + second, (first + second).magnitude, first.magnitude, second.magnitude], from: total)
                return UProblem.numeric(
                    key: "i.area3|\(f.text)", prompt: "Wie groß ist der Flächeninhalt zwischen dem Graphen von \(UCalc.fx(f)) und der x-Achse zwischen der kleinsten und der größten Nullstelle?",
                    answer: total, wrongs: wrongs,
                    solution: "Nullstellen \(r.map(String.init).joined(separator: ", ")). Teilflächen einzeln: |\(first.text)| + |\(second.text)| = \(total.text). Würdest du in einem Stück integrieren, höben sich die Teile teilweise auf.",
                    explanation: "Bei einem Vorzeichenwechsel zwischen den Grenzen rechnest du an jeder Nullstelle getrennt und addierst die Beträge.",
                    fact: .area(f, UQ(r[0]), UQ(r[2]))
                )
            }
            return nil
        }
        guard let p = parabola(g, signedLead: lv == 2) else { return nil }
        let F = p.f.integral
        let answer = p.integral.magnitude
        let wrongs = UCalc.differing([F.eval(UQ(p.r2)).magnitude, (F.eval(UQ(p.r2)) - F.eval(.zero)).magnitude, answer + answer, UQ(p.r2 - p.r1) * p.f.eval(UQ(p.r1 + p.r2, 2)).magnitude], from: answer)
        return UProblem.numeric(
            key: "i.area|\(p.f.text)", prompt: "Wie groß ist der Flächeninhalt zwischen dem Graphen von \(UCalc.fx(p.f)) und der x-Achse?",
            answer: answer, wrongs: wrongs,
            solution: "Nullstellen \(p.r1) und \(p.r2). Integral von \(p.r1) bis \(p.r2): \(p.integral.text); der Flächeninhalt ist der Betrag: \(answer.text).",
            explanation: "Zwischen zwei benachbarten Nullstellen liegt der Graph auf einer Seite; der Flächeninhalt ist der Betrag des Integrals.",
            fact: .area(p.f, UQ(p.r1), UQ(p.r2))
        )
    }

    static let rules = UTemplate("i.rules") { lv, g in
        let a = g.int(0...2), b = a + g.int(1...3), c = b + g.int(1...3)
        let p = g.int(2...9), q = g.int(1...8)
        switch g.int(0...4) {
        case 0:
            let answer = UQ(p + q)
            return UProblem.numeric(
                key: "i.rules|add|\(p)|\(q)|\(a)|\(b)|\(c)",
                prompt: "Es gilt \(integralSign(a, b)) f(x) dx = \(p) und \(integralSign(b, c)) f(x) dx = \(q). Wie groß ist \(integralSign(a, c)) f(x) dx?",
                answer: answer, wrongs: UCalc.differing([UQ(p * q), UQ(p - q), UQ(p)], from: answer),
                solution: "Aneinandergrenzende Intervalle addierst du: \(p) + \(q) = \(p + q).",
                explanation: "Integrale über aneinandergrenzende Intervalle darfst du addieren.", fact: .combination(coefficients: [.one, .one], parts: [UQ(p), UQ(q)])
            )
        case 1:
            let k = g.int(2...5)
            return UProblem.numeric(
                key: "i.rules|factor|\(p)|\(k)|\(a)|\(b)",
                prompt: "Es gilt \(integralSign(a, b)) f(x) dx = \(p). Wie groß ist \(integralSign(a, b)) \(k)·f(x) dx?",
                answer: UQ(k * p), wrongs: UCalc.differing([UQ(k + p), UQ(p), UQ(k * p * (b - a))], from: UQ(k * p)),
                solution: "Ein Faktor kommt vor das Integral: \(k)·\(p) = \(k * p).",
                explanation: "Konstante Faktoren darfst du vor das Integral ziehen.", fact: .combination(coefficients: [UQ(k)], parts: [UQ(p)])
            )
        case 2:
            return UProblem.numeric(
                key: "i.rules|swap|\(p)|\(a)|\(b)",
                prompt: "Es gilt \(integralSign(a, b)) f(x) dx = \(p). Wie groß ist \(integralSign(b, a)) f(x) dx?",
                answer: UQ(-p), wrongs: UCalc.differing([UQ(p), .zero, UQ(2 * p), UQ(p + 1)], from: UQ(-p)),
                solution: "Vertauschst du die Grenzen, wechselt das Vorzeichen: −\(p).",
                explanation: "Vertauschte Grenzen drehen das Vorzeichen des Integrals um.", fact: .combination(coefficients: [UQ(-1)], parts: [UQ(p)])
            )
        case 3:
            let k = g.int(2...4)
            let answer = UQ(p - k * q)
            return UProblem.numeric(
                key: "i.rules|lin|\(p)|\(q)|\(k)|\(a)|\(b)",
                prompt: "Es gilt \(integralSign(a, b)) f(x) dx = \(p) und \(integralSign(a, b)) g(x) dx = \(q). Wie groß ist \(integralSign(a, b)) (f(x) − \(k)·g(x)) dx?",
                answer: answer, wrongs: UCalc.differing([UQ(p - q), UQ(p + k * q), UQ(p - k + q), UQ(p * q)], from: answer),
                solution: "Summen und Faktoren darfst du aufteilen: \(p) − \(k)·\(q) = \(answer.text).",
                explanation: "Das Integral ist linear: Differenzen und konstante Faktoren darfst du einzeln integrieren.",
                fact: .combination(coefficients: [.one, UQ(-k)], parts: [UQ(p), UQ(q)])
            )
        default:
            return UProblem.numeric(
                key: "i.rules|zero|\(a)|\(p)",
                prompt: "Es gilt \(integralSign(a, b)) f(x) dx = \(p). Wie groß ist \(integralSign(a, a)) f(x) dx?",
                answer: .zero, wrongs: UCalc.differing([UQ(p), UQ(-p), UQ(a), UQ(1)], from: .zero),
                solution: "Sind obere und untere Grenze gleich, gibt es keine Breite: 0.",
                explanation: "Ein Integral mit gleichen Grenzen ist immer 0.", fact: .combination(coefficients: [.zero], parts: [UQ(p)])
            )
        }
    }

    static let mean = UTemplate("i.mean") { lv, g in
        for _ in 0..<200 {
            let f = g.poly(degree: lv == 3 ? 3 : 2, terms: lv == 1 ? 2 : 3, coefficients: 1...5, negatives: lv != 1)
            let a = lv == 1 ? 0 : g.int(-1...1), b = a + g.int(1...4)
            let F = f.integral
            let integral = F.eval(UQ(b)) - F.eval(UQ(a))
            let answer = integral / UQ(b - a)
            guard answer.d <= 2, abs(answer.double) < 500 else { continue }
            let midpoint = f.eval(UQ(a + b, 2))
            let wrongs = UCalc.differing([integral, (f.eval(UQ(a)) + f.eval(UQ(b))) / UQ(2), midpoint, integral / UQ(b)], from: answer)
            return UProblem.numeric(
                key: "i.mean|\(f.text)|\(a)|\(b)",
                prompt: "Bestimme den Mittelwert von \(UCalc.fx(f)) auf dem Intervall [\(UText.signed(a)); \(b)].", answer: answer, wrongs: wrongs,
                solution: "Mittelwert = 1/(b − a) · Integral = 1/\(b - a) · \(integral.text) = \(answer.text).",
                explanation: "Der Mittelwert ist das Integral geteilt durch die Länge des Intervalls.", fact: .mean(f, UQ(a), UQ(b))
            )
        }
        return nil
    }

    static let upper = UTemplate("i.upper") { lv, g in
        let b = g.int(1...5)
        let f: UPoly
        let value: Int
        if lv == 3 {
            let m = 3 * g.int(1...3)
            f = UPoly(terms: [(2, UQ(m))])
            value = m * b * b * b / 3
        } else {
            let m = 2 * g.int(1...3)
            f = UPoly(terms: [(1, UQ(m))])
            value = m * b * b / 2
        }
        let answer = UQ(b)
        let m = f.c.last!.n
        let wrongs = UCalc.differing([UQ(value, m), UQ(value, 2), UQ(value - m), UQ(2 * value, m)], from: answer)
        return UProblem.numeric(
            key: "i.upper|\(f.text)|\(b)", prompt: "Für welches b > 0 gilt ∫₀ᵇ \(f.text) dx = \(value)?",
            answer: answer, wrongs: wrongs,
            solution: "Stammfunktion \(f.integral.text); an der Grenze b: \(f.integral.eval(UQ(b)).text) mit b = \(b) gibt \(value). Also b = \(b).",
            explanation: "Rechne das Integral mit der Grenze b aus und löse die entstehende Gleichung nach b.", fact: .upperLimit(f, value: UQ(value))
        )
    }
}
