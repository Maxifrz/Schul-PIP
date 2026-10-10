import Foundation

private typealias Q = MathMiddleQ
private typealias T = MathMiddleText

/// Unit 9, Quadratische Gleichungen und Funktionen: Scheitelpunktform, Verschiebung und Funktionswerte (lesson 1),
/// rein quadratische Gleichungen, Faktorform und Nullstellen (2), pq-Formel, Diskriminante und Normalform (3).
///
/// Options of a choice never differ only by a sign ("S(3|2)" and "S(−3|2)"): the exercise factory reads letters and
/// digits only, so such options would count as one. Sign mistakes are asked in words ("3 nach links") or in a typed
/// answer, where the sign counts.
enum MathMiddleUnit09 {
    static let templates: [MathMiddleTemplate] = [
        MathMiddleTemplate("u09.vertexForm", lesson: 1, forms: [.typed, .pairs], make: vertexForm),
        MathMiddleTemplate("u09.shift", lesson: 1, forms: [.choice], make: shift),
        MathMiddleTemplate("u09.functionValue", lesson: 1, forms: [.choice, .typed, .pairs], make: functionValue),
        MathMiddleTemplate("u09.extremum", lesson: 1, forms: [.choice, .typed, .pairs], make: extremum),
        MathMiddleTemplate("u09.pureQuadratic", lesson: 2, forms: [.choice, .typed, .pairs], make: pureQuadratic),
        MathMiddleTemplate("u09.factorForm", lesson: 2, forms: [.typed, .pairs], make: factorForm),
        MathMiddleTemplate("u09.vertexZeros", lesson: 2, forms: [.choice, .typed, .pairs], make: vertexZeros),
        MathMiddleTemplate("u09.pqSolve", lesson: 3, forms: [.choice, .typed, .pairs], make: pqSolve),
        MathMiddleTemplate("u09.discriminant", lesson: 3, forms: [.choice, .typed], make: discriminant),
        MathMiddleTemplate("u09.divideFirst", lesson: 3, forms: [.choice, .typed], make: divideFirst),
        MathMiddleTemplate("u09.vertexFromNormal", lesson: 3, forms: [.choice, .typed, .pairs], make: vertexFromNormal),
    ]

    private static let valueHint = "Gib die Zahl an."

    // Writing

    private static func num(_ q: Q) -> String { T.number(q) }

    private static func coefficientText(_ a: Q) -> String {
        if a == Q(1) { return "" }
        if a == Q(-1) { return T.minus }
        return num(a)
    }

    /// "y = 2(x + 1)² − 5": the vertex form, with the bracket left out when d is 0.
    private static func vertexText(_ a: Q, _ d: Int, _ e: Int) -> String {
        var text = "y = " + coefficientText(a)
        if d == 0 {
            text += "x²"
        } else {
            text += "(x \(d > 0 ? T.minus : "+") \(abs(d)))²"
        }
        if e != 0 { text += (e > 0 ? " + " : " \(T.minus) ") + String(abs(e)) }
        return text
    }

    /// "x² − 5x + 6": the normal form with a, p and q possibly decimals.
    private static func quadratic(_ a: Q, _ p: Q, _ q: Q) -> String {
        var text = coefficientText(a) + "x²"
        if !p.isZero { text += (p.isNegative ? " \(T.minus) " : " + ") + (p.magnitude == Q(1) ? "" : num(p.magnitude)) + "x" }
        if !q.isZero { text += (q.isNegative ? " \(T.minus) " : " + ") + num(q.magnitude) }
        return text
    }

    private static func vertexPoint(_ x: Q, _ y: Q) -> String { "S(\(num(x))|\(num(y)))" }

    /// Two solutions, the larger first: "3 und −1".
    private static func pair(_ x: Q, _ y: Q) -> String {
        x < y ? "\(num(y)) und \(num(x))" : "\(num(x)) und \(num(y))"
    }

    private static func isqrt(_ n: Int) -> Int? {
        guard n >= 0 else { return nil }
        var root = Int(Double(n).squareRoot())
        while root * root > n { root -= 1 }
        while (root + 1) * (root + 1) <= n { root += 1 }
        return root * root == n ? root : nil
    }

    /// The exact square root of a fraction, nil if it is not a fraction of squares.
    private static func rationalRoot(_ q: Q) -> Q? {
        guard q.ok, !q.isNegative, let top = isqrt(q.numerator), let bottom = isqrt(q.denominator) else { return nil }
        return Q(top, bottom)
    }

    // Lesson 1

    /// "Lies den Scheitelpunkt ab: y = (x − 3)² + 2": the sign of d is the opposite of the sign in the bracket.
    private static func vertexForm(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let a: Q
        var d = gen.nonZero(-6...6)
        var e = gen.nonZero(-8...8)
        switch level {
        case 1: a = Q(1)
        case 2:
            a = Q(1)
            if gen.chance(30) { d = 0 } else if gen.chance(30) { e = 0 }
        default:
            a = gen.pick([Q(2), Q(3), Q(-1), Q(-2), Q(1, 2), Q(-1, 2), Q(3)])
        }
        guard d != 0 || e != 0 else { return nil }
        let equation = vertexText(a, d, e)
        let asksX = gen.chance(50)
        let typed = MathMiddleProblem.Typed(
            prompt: (asksX ? "Welche x-Koordinate hat der Scheitelpunkt?" : "Welche y-Koordinate hat der Scheitelpunkt?") + "\n\(equation)",
            answer: Rational(asksX ? d : e)
        )
        var problem = MathMiddleProblem.text(
            prompt: "Lies den Scheitelpunkt ab.\n\(equation)",
            correct: vertexPoint(Q(d), Q(e)),
            wrong: [],
            typed: typed,
            pair: equation,
            solution: "In y = a(x − d)² + e ist S(d|e) der Scheitelpunkt. Hier: \(vertexPoint(Q(d), Q(e)))\(d == 0 ? "" : "; die Klammer (x \(d > 0 ? T.minus : "+") \(abs(d))) gibt d = \(T.int(d))")",
            explanation: "In der Scheitelpunktform y = a(x − d)² + e liest du d mit umgekehrtem Vorzeichen aus der Klammer ab; e steht ohne Änderung hinten. Der Faktor a ändert den Scheitelpunkt nicht."
        )
        problem.pairPrompt = "Lies den Scheitelpunkt ab und ordne zu."
        return problem
    }

    /// "Wo liegt der Scheitelpunkt?" The four ways left or right, above or below, in words.
    private static func shift(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let d = gen.nonZero(level == 1 ? -5...5 : -8...8)
        let e = gen.nonZero(level == 1 ? -5...5 : -9...9)
        let a = level == 1 ? Q(1) : (level == 2 ? gen.pick([Q(2), Q(3), Q(1, 2)]) : gen.pick([Q(-1), Q(-2), Q(2), Q(-3), Q(1, 2)]))
        func words(_ right: Bool, _ up: Bool) -> String {
            "\(abs(d)) nach \(right ? "rechts" : "links") und \(abs(e)) nach \(up ? "oben" : "unten")"
        }
        let correct = words(d > 0, e > 0)
        let wrong = [words(d < 0, e > 0), words(d > 0, e < 0), words(d < 0, e < 0)]
        return .text(
            prompt: "Wo liegt der Scheitelpunkt der Parabel, vom Ursprung aus gesehen?\n\(vertexText(a, d, e))",
            correct: correct,
            wrong: wrong,
            solution: "d = \(T.int(d)) und e = \(T.int(e)), also S(\(T.int(d))|\(T.int(e))): \(correct)",
            explanation: "Die Klammer (x + 3) heißt: Verschiebung um 3 nach links, (x − 3) um 3 nach rechts. Die Zahl hinten verschiebt nach oben (plus) oder unten (minus)."
        )
    }

    /// "f(x) = x² − 4x + 3, berechne f(−2)": the square of a negative number is positive.
    private static func functionValue(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let a: Int
        let b: Int
        let c: Int
        let x: Int
        switch level {
        case 1:
            a = gen.pick([1, 1, 2, 3])
            b = 0
            c = gen.int(-9...9)
            x = gen.int(1...5)
        case 2:
            a = 1
            b = gen.nonZero(-6...6)
            c = gen.nonZero(-9...9)
            x = gen.nonZero(-4...4)
        default:
            a = gen.pick([2, 3, -1, -2, 1])
            b = gen.nonZero(-6...6)
            c = gen.nonZero(-9...9)
            x = gen.nonZero(-4...4)
        }
        let value = a * x * x + b * x + c
        let term = T.polynomial([a, b, c])
        guard abs(value) <= 120 else { return nil }
        // x² read as 2x or as x, a·x squared as a whole, a negative square taken as negative, the factor x forgotten at b.
        let wrong = [2 * a * x + b * x + c, a * x + b * x + c, (a * x) * (a * x) + b * x + c, -a * x * x + b * x + c, a * x * x + b + c, a * x * x - b * x + c]
        var expression = "\(a) · \(T.bracketed(x))²"
        var evaluated = T.int(a * x * x)
        if b != 0 {
            expression += " \(T.plusMinus(b)) · \(T.bracketed(x))"
            evaluated += " \(T.plusMinus(b * x))"
        }
        if c != 0 {
            expression += " \(T.plusMinus(c))"
            evaluated += " \(T.plusMinus(c))"
        }
        return .number(
            prompt: "Gegeben: f(x) = \(term)\nBerechne f(\(T.int(x))).",
            answer: Q(value),
            hint: valueHint,
            wrong: wrong.map { Q($0) },
            pair: "f(x) = \(term), f(\(T.int(x)))",
            solution: "f(\(T.int(x))) = \(expression) = \(evaluated) = \(T.int(value))",
            explanation: "Setze x ein und rechne erst die Potenz, dann Punkt vor Strich. Das Quadrat einer negativen Zahl ist positiv: (−2)² = 4."
        )
    }

    /// "Welchen kleinsten Wert hat y = (x − 3)² + 2?" The vertex is the lowest (a > 0) or the highest (a < 0) point.
    private static func extremum(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let a: Q = level == 1 ? Q(1) : gen.pick([Q(1), Q(2), Q(-1), Q(-2), Q(3), Q(-3)])
        let d = gen.nonZero(-6...6)
        let e = gen.nonZero(-9...9)
        let asksValue = gen.chance(50)
        let lowest = !a.isNegative
        let equation = vertexText(a, d, e)
        let answer = asksValue ? e : d
        let wrong = asksValue ? [d, e + d, e - d, d * e] : [e, d + e, d - e, d * e]
        let prompt: String
        if asksValue {
            prompt = "Welchen \(lowest ? "kleinsten" : "größten") Funktionswert hat die Parabel?\n\(equation)"
        } else {
            prompt = "Für welches x ist der Funktionswert \(lowest ? "am kleinsten" : "am größten")?\n\(equation)"
        }
        var problem = MathMiddleProblem.number(
            prompt: prompt,
            answer: Q(answer),
            hint: valueHint,
            wrong: wrong.map { Q($0) },
            pair: (asksValue ? (lowest ? "kleinster Wert: " : "größter Wert: ") : "Stelle des \(lowest ? "Minimums" : "Maximums"): ") + equation,
            solution: "Der Scheitelpunkt ist S(\(T.int(d))|\(T.int(e))). Die Parabel ist nach \(lowest ? "oben" : "unten") geöffnet, also ist S der \(lowest ? "tiefste" : "höchste") Punkt: " + (asksValue ? "y = \(T.int(e))" : "x = \(T.int(d))"),
            explanation: "Bei a > 0 ist die Parabel nach oben geöffnet, ihr Scheitelpunkt ist der tiefste Punkt. Bei a < 0 ist sie nach unten geöffnet, und der Scheitelpunkt ist der höchste Punkt."
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe die gesuchte Zahl zu."
        return problem
    }

    // Lesson 2

    /// "x² = 49": two solutions, the root and its opposite.
    private static func pureQuadratic(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let r = level == 3 ? gen.int(2...10) : gen.int(2...12)
        let equation: String
        let working: String
        switch level {
        case 1:
            equation = "x² = \(r * r)"
            working = "x² = \(r * r), also x = \(r) oder x = \(T.minus)\(r)"
        case 2:
            if gen.chance(50) {
                equation = "x² \(T.minus) \(r * r) = 0"
                working = "x² = \(r * r), also x = \(r) oder x = \(T.minus)\(r)"
            } else {
                let k = gen.int(1...20)
                equation = "x² + \(k) = \(r * r + k)"
                working = "x² = \(r * r + k) \(T.minus) \(k) = \(r * r), also x = \(r) oder x = \(T.minus)\(r)"
            }
        default:
            let a = gen.int(2...5)
            if gen.chance(50) {
                equation = "\(a)x² = \(a * r * r)"
                working = "x² = \(a * r * r) : \(a) = \(r * r), also x = \(r) oder x = \(T.minus)\(r)"
            } else {
                let b = gen.int(1...12)
                guard a * r * r - b > 0 else { return nil }
                equation = "\(a)x² \(T.minus) \(b) = \(a * r * r - b)"
                working = "\(a)x² = \(a * r * r); x² = \(r * r), also x = \(r) oder x = \(T.minus)\(r)"
            }
        }
        // Only one solution, the root forgotten, the square halved instead of rooted.
        let wrong = ["\(r)", "\(r * r) und \(T.minus)\(r * r)", pair(Q(r, 2), Q(-r, 2))]
        var problem = MathMiddleProblem.text(
            prompt: "Löse die Gleichung.\n\(equation)",
            correct: "\(r) und \(T.minus)\(r)",
            wrong: wrong,
            typed: .init(prompt: "Löse die Gleichung \(equation).\nGib die positive Lösung an.", answer: Rational(r)),
            pair: equation,
            solution: working,
            explanation: "Forme erst nach x² um, dann ziehst du die Wurzel. Es gibt zwei Lösungen: die positive und die negative Wurzel, denn (−7)² ist auch 49."
        )
        problem.pairPrompt = "Löse und ordne die Lösungen zu."
        return problem
    }

    /// "(x − 2)(x + 5) = 0": a product is zero if one factor is zero.
    private static func factorForm(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { factorFormAttempt(level, gen) }
    }

    private static func factorFormAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let first: String
        let second: String
        let r1: Q
        let r2: Q
        switch level {
        case 1:
            let m = gen.int(1...9)
            let n = gen.int(1...9)
            first = "(x \(T.minus) \(m))"
            second = "(x + \(n))"
            (r1, r2) = (Q(m), Q(-n))
        case 2:
            switch gen.int(0...2) {
            case 0:
                let k = gen.int(2...9)
                let subtracts = gen.chance(50)
                first = "x"
                second = "(x \(subtracts ? T.minus : "+") \(k))"
                r1 = Q(0)
                r2 = Q(subtracts ? k : -k)
            case 1:
                let m = gen.int(1...9)
                let n = gen.int(1...9)
                first = "(x + \(m))"
                second = "(x + \(n))"
                (r1, r2) = (Q(-m), Q(-n))
            default:
                let m = gen.int(1...9)
                let n = gen.int(1...9)
                first = "(x \(T.minus) \(m))"
                second = "(x \(T.minus) \(n))"
                (r1, r2) = (Q(m), Q(n))
            }
        default:
            // (ax − b)(cx + d): the roots b/a and −d/c.
            let a = gen.int(2...4)
            let b = a * gen.int(1...4)
            let c = gen.pick([1, 2, 3])
            let d = c * gen.int(1...4) + (gen.chance(40) ? 1 : 0)
            first = "(\(a)x \(T.minus) \(b))"
            second = "(\(c == 1 ? "" : String(c))x + \(d))"
            (r1, r2) = (Q(b, a), Q(-d, c))
        }
        guard r1 != r2, [r1, r2].decimals(2).count == 2 else { return nil }
        let equation = "\(first)\(second) = 0"
        let correct = pair(r1, r2)
        let larger = r1 < r2 ? r2 : r1
        let smaller = r1 < r2 ? r1 : r2
        let asksLarger = gen.chance(50)
        var problem = MathMiddleProblem.text(
            prompt: "Löse die Gleichung.\n\(equation)",
            correct: correct,
            wrong: [],
            typed: .init(
                prompt: "Löse die Gleichung \(equation).\nGib die \(asksLarger ? "größere" : "kleinere") Lösung an.",
                answer: (asksLarger ? larger : smaller).value,
                text: num(asksLarger ? larger : smaller)
            ),
            pair: equation,
            solution: "Ein Faktor muss 0 sein: \(first.replacingOccurrences(of: "(", with: "").replacingOccurrences(of: ")", with: "")) = 0 oder \(second.replacingOccurrences(of: "(", with: "").replacingOccurrences(of: ")", with: "")) = 0, also x = \(num(r1)) oder x = \(num(r2))",
            explanation: "Ein Produkt ist 0, wenn mindestens ein Faktor 0 ist. Setze jeden Faktor einzeln gleich 0. Die Lösung hat das umgekehrte Vorzeichen der Zahl in der Klammer."
        )
        problem.pairPrompt = "Löse und ordne die Lösungen zu."
        return problem
    }

    /// "Nullstellen von y = (x − 1)² − 4": solve (x − 1)² = 4.
    private static func vertexZeros(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { vertexZerosAttempt(level, gen) }
    }

    private static func vertexZerosAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let r = level == 1 ? gen.int(1...4) : gen.int(2...6)
        let d = gen.nonZero(-6...6)
        let a: Q = level == 3 ? gen.pick([Q(2), Q(3), Q(-1), Q(-2)]) : Q(1)
        // y = a(x − d)² + e with e = −a·r²: the zeros are d ± r.
        guard let e = (a * -(r * r)).int else { return nil }
        let upper = Q(d + r)
        let lower = Q(d - r)
        guard upper != lower, abs(e) <= 50 else { return nil }
        let equation = vertexText(a, d, e)
        // The sign of d turned, the shift forgotten, the number under the root left unrooted.
        var wrongSets: [(Q, Q)] = [(Q(-d + r), Q(-d - r)), (Q(r), Q(-r)), (Q(d + r * r), Q(d - r * r))]
        wrongSets = wrongSets.filter { Set([$0.0, $0.1]) != Set([upper, lower]) }
        let wrong = wrongSets.map { pair($0.0, $0.1) }
        let asksLarger = gen.chance(50)
        var problem = MathMiddleProblem.text(
            prompt: "Berechne die Nullstellen.\n\(equation)",
            correct: pair(upper, lower),
            wrong: wrong,
            typed: .init(
                prompt: "Berechne die Nullstellen von \(equation).\nGib die \(asksLarger ? "größere" : "kleinere") Nullstelle an.",
                answer: (asksLarger ? upper : lower).value,
                text: num(asksLarger ? upper : lower)
            ),
            pair: equation,
            solution: "0 = \(equation.dropFirst(4)); (x \(d > 0 ? T.minus : "+") \(abs(d)))² = \(r * r); x \(d > 0 ? T.minus : "+") \(abs(d)) = \(r) oder \(T.minus)\(r); x = \(num(upper)) oder x = \(num(lower))",
            explanation: "Setze y = 0 und bringe die Zahl hinten auf die andere Seite. Teile durch a, ziehe die Wurzel (zwei Vorzeichen!) und verschiebe um d."
        )
        problem.pairPrompt = "Berechne und ordne die Nullstellen zu."
        return problem
    }

    // Lesson 3

    /// "x² − 5x + 6 = 0" by the pq-formula.
    private static func pqSolve(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { pqSolveAttempt(level, gen) }
    }

    private static func pqSolveAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let r1: Q
        let r2: Q
        switch level {
        case 1:
            r1 = Q(gen.int(1...8))
            r2 = Q(gen.int(1...8))
        case 2:
            r1 = Q(gen.nonZero(-8...8))
            r2 = Q(gen.nonZero(-8...8))
        default:
            r1 = Q(gen.nonZero(-9...9), 2)
            r2 = gen.chance(50) ? Q(gen.nonZero(-9...9), 2) : Q(gen.nonZero(-6...6))
        }
        guard r1 != r2 else { return nil }
        let p = (r1 + r2).negated
        let q = r1 * r2
        guard p.ok, q.ok, [p, q].decimals(2).count == 2, !p.isZero else { return nil }
        let half = p / 2
        let discriminant = half * half - q
        guard let root = rationalRoot(discriminant), !root.isZero else { return nil }
        let correct = pair(r1, r2)
        // p not halved, the sign of q turned, the root forgotten.
        var wrongSets: [(Q, Q)] = []
        if let bigRoot = rationalRoot(p * p - q) { wrongSets.append((p.negated + bigRoot, p.negated - bigRoot)) }
        if let plusRoot = rationalRoot(half * half + q) { wrongSets.append((half.negated + plusRoot, half.negated - plusRoot)) }
        wrongSets.append((half.negated + discriminant, half.negated - discriminant))
        let wrong = wrongSets.filter { Set([$0.0, $0.1]) != Set([r1, r2]) }.map { pair($0.0, $0.1) }
        guard Set(wrong).count >= 2 else { return nil }
        let equation = quadratic(Q(1), p, q) + " = 0"
        let larger = r1 < r2 ? r2 : r1
        let smaller = r1 < r2 ? r1 : r2
        let asksLarger = gen.chance(50)
        var problem = MathMiddleProblem.text(
            prompt: "Löse mit der pq-Formel.\n\(equation)",
            correct: correct,
            wrong: wrong,
            typed: .init(
                prompt: "Löse \(equation) mit der pq-Formel.\nGib die \(asksLarger ? "größere" : "kleinere") Lösung an.",
                answer: (asksLarger ? larger : smaller).value,
                text: num(asksLarger ? larger : smaller)
            ),
            pair: equation,
            solution: "p = \(num(p)), q = \(num(q)); x = \(num(half.negated)) ± √(\(num(half * half)) \(q.isNegative ? "+" : T.minus) \(num(q.magnitude))) = \(num(half.negated)) ± √\(num(discriminant)) = \(num(half.negated)) ± \(num(root)); x = \(correct.replacingOccurrences(of: " und ", with: " oder x = "))",
            explanation: "Bei x² + px + q = 0 gilt x = −p/2 ± √((p/2)² − q). Rechne erst p/2, dann den Wert unter der Wurzel, dann die Wurzel; das ± gibt die zwei Lösungen."
        )
        problem.pairPrompt = "Löse und ordne die Lösungen zu."
        return problem
    }

    /// "Wie viele Lösungen hat x² + 4x + 7 = 0?" The sign of D = (p/2)² − q decides.
    private static func discriminant(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { discriminantAttempt(level, gen) }
    }

    private static func discriminantAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let p: Q
        switch level {
        case 1: p = Q(2 * gen.nonZero(-4...4))
        case 2: p = Q(gen.nonZero(-9...9))
        default: p = Q(gen.nonZero(-19...19), 2)
        }
        let half = p / 2
        let square = half * half
        let kind = gen.int(0...2)
        let offset = Q(gen.int(1...6), level == 3 ? 4 : 1)
        let q: Q
        switch kind {
        case 0: q = square + offset
        case 1: q = square
        default: q = square - offset
        }
        guard q.ok, !q.isZero, [p, q].decimals(2).count == 2 else { return nil }
        let d = square - q
        guard d.ok else { return nil }
        let equation = quadratic(Q(1), p, q) + " = 0"
        let options = ["keine Lösung", "genau eine Lösung", "zwei Lösungen"]
        let right = d.isNegative ? 0 : (d.isZero ? 1 : 2)
        let reason = right == 0 ? "D < 0: keine Lösung" : (right == 1 ? "D = 0: genau eine Lösung" : "D > 0: zwei Lösungen")
        let halfShown = half.isNegative ? "(\(num(half)))" : num(half)
        let qShown = q.isNegative ? "(\(num(q)))" : num(q)
        return .text(
            prompt: "Wie viele Lösungen hat die Gleichung?\n\(equation)",
            correct: options[right],
            wrong: options.enumerated().filter { $0.offset != right }.map(\.element),
            typed: .init(prompt: "Berechne die Diskriminante D = (p/2)² − q.\n\(equation)", answer: d.value, text: num(d)),
            solution: "D = \(halfShown)² \(T.minus) \(qShown) = \(num(square)) \(T.minus) \(qShown) = \(num(d)); \(reason)",
            explanation: "Die Diskriminante D = (p/2)² − q steht unter der Wurzel der pq-Formel. Ist D positiv, gibt es zwei Lösungen, bei D = 0 genau eine, bei negativem D keine."
        )
    }

    /// "2x² − 8x + 6 = 0": the pq-formula needs x² alone, so all terms are divided by the factor in front.
    private static func divideFirst(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { divideFirstAttempt(level, gen) }
    }

    private static func divideFirstAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let a = level == 1 ? 2 : gen.int(2...5)
        let r1 = level == 3 ? gen.nonZero(-9...9) : gen.int(1...8)
        let r2 = level == 3 ? gen.nonZero(-9...9) : gen.int(1...8)
        guard r1 != r2 else { return nil }
        let p = -(r1 + r2)
        let q = r1 * r2
        guard p != 0 else { return nil }
        let given = quadratic(Q(a), Q(a * p), Q(a * q)) + " = 0"
        let correct = quadratic(Q(1), Q(p), Q(q)) + " = 0"
        // Only x² divided, x² and x divided, x² and the number divided.
        let wrong = [
            quadratic(Q(1), Q(a * p), Q(a * q)) + " = 0",
            quadratic(Q(1), Q(p), Q(a * q)) + " = 0",
            quadratic(Q(1), Q(a * p), Q(q)) + " = 0",
        ]
        let larger = max(r1, r2)
        let asksSolution = level == 3 && gen.chance(50)
        let askP = gen.chance(50)
        let typed: MathMiddleProblem.Typed = asksSolution
            ? .init(prompt: "Löse \(given).\nGib die größere Lösung an.", answer: Rational(larger))
            : .init(prompt: "Teile \(given) durch \(a).\nWelche Zahl steht dann \(askP ? "vor dem x" : "ohne x")?", answer: Rational(askP ? p : q))
        return .text(
            prompt: "Welche Gleichung entsteht, wenn du durch den Faktor vor x² teilst?\n\(given)",
            correct: correct,
            wrong: wrong,
            typed: typed,
            solution: "Alle Summanden durch \(a) teilen: \(correct)" + (asksSolution ? "; die Lösungen sind \(r1) und \(r2)" : ""),
            explanation: "Die pq-Formel gilt nur für x² + px + q = 0. Steht vor x² eine andere Zahl, teile die ganze Gleichung durch sie, auch den Teil ohne x."
        )
    }

    /// "y = x² − 6x + 11": the vertex from the normal form, d = −p/2 and e = q − (p/2)².
    private static func vertexFromNormal(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { vertexFromNormalAttempt(level, gen) }
    }

    private static func vertexFromNormalAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let p: Q
        let q: Q
        switch level {
        case 1:
            p = Q(2 * gen.nonZero(-5...5))
            q = Q(gen.int(1...15))
        case 2:
            p = Q(2 * gen.nonZero(-6...6))
            q = Q(gen.nonZero(-12...15))
        default:
            p = Q(gen.nonZero(-11...11))
            q = Q(gen.nonZero(-12...15))
        }
        let half = p / 2
        let d = half.negated
        let e = q - half * half
        guard [d, e].decimals(2).count == 2, e != q else { return nil }
        let equation = "y = " + quadratic(Q(1), p, q)
        // The number q left as it is, the square added instead of taken off, p/2 not squared, p not halved.
        let candidates = [vertexPoint(d, q), vertexPoint(d, q + half * half), vertexPoint(d, q - half), vertexPoint(p.negated, e)]
        let correct = vertexPoint(d, e)
        let asksX = gen.chance(50)
        var problem = MathMiddleProblem.text(
            prompt: "Bestimme den Scheitelpunkt.\n\(equation)",
            correct: correct,
            wrong: candidates.filter { $0 != correct },
            typed: .init(
                prompt: "Bestimme den Scheitelpunkt von \(equation).\n" + (asksX ? "Welche x-Koordinate hat er?" : "Welche y-Koordinate hat er?"),
                answer: (asksX ? d : e).value,
                text: num(asksX ? d : e)
            ),
            pair: equation,
            solution: "d = \(T.minus)p/2 = \(T.minus)(\(num(half))) = \(num(d)); e = q \(T.minus) (p/2)² = \(num(q)) \(T.minus) \(num(half * half)) = \(num(e)); \(correct)",
            explanation: "Aus y = x² + px + q folgt die quadratische Ergänzung: x-Koordinate −p/2, y-Koordinate q − (p/2)². Das ist dasselbe wie die Scheitelpunktform."
        )
        problem.pairPrompt = "Bestimme den Scheitelpunkt und ordne zu."
        return problem
    }
}
