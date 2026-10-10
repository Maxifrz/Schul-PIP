import Foundation

private typealias Q = MathMiddleQ
private typealias T = MathMiddleText

/// Unit 4, Terme und lineare Gleichungen: Terme berechnen, zusammenfassen und Klammern auflösen (lesson 1), Gleichungen
/// mit einer Unbekannten lösen (2), x auf beiden Seiten, Probe und Textaufgaben (3).
enum MathMiddleUnit04 {
    static let templates: [MathMiddleTemplate] = [
        MathMiddleTemplate("u04.evalTerm", lesson: 1, forms: [.choice, .typed, .pairs], make: evalTerm),
        MathMiddleTemplate("u04.simplify", lesson: 1, forms: [.choice, .typed, .pairs], make: simplify),
        MathMiddleTemplate("u04.expand", lesson: 1, forms: [.choice, .typed, .pairs], make: expand),
        MathMiddleTemplate("u04.oneStep", lesson: 2, forms: [.choice, .typed, .pairs], make: oneStep),
        MathMiddleTemplate("u04.twoStep", lesson: 2, forms: [.choice, .typed, .pairs], make: twoStep),
        MathMiddleTemplate("u04.brackets", lesson: 2, forms: [.choice, .typed, .pairs], make: brackets),
        MathMiddleTemplate("u04.bothSides", lesson: 3, forms: [.choice, .typed, .pairs], make: bothSides),
        MathMiddleTemplate("u04.plugIn", lesson: 3, forms: [.choice, .typed], make: plugIn),
        MathMiddleTemplate("u04.word", lesson: 3, forms: [.choice, .typed], make: word),
    ]

    private static let valueHint = "Gib nur die Zahl an."

    private static func whole(_ values: [Int]) -> [Q] { values.map { Q($0) } }

    // Lesson 1

    /// "Berechne den Wert von 3x + 5 für x = 4." Level 3 has a square, so the sign of a negative x matters.
    private static func evalTerm(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let term: String
        let x: Int
        let value: Int
        let working: String
        var wrong: [Int] = []
        if level <= 2 {
            let a = level == 1 ? gen.int(2...9) : gen.nonZero(-9...9)
            x = level == 1 ? gen.int(1...6) : gen.nonZero(-5...5)
            var b = level == 1 ? gen.int(1...9) : gen.nonZero(-9...9)
            if level == 1, gen.chance(40), a * x > b { b = -b }
            term = T.linear(a, b)
            value = a * x + b
            working = "\(T.int(a)) · \(T.bracketed(x)) \(T.plusMinus(b)) = \(T.int(a * x)) \(T.plusMinus(b)) = \(T.int(value))"
            // "ax" read as a + x, the sign of b turned, the bracket forgotten, the digits written side by side.
            wrong = [a + x + b, a * x - b, a * (x + b)]
            if a > 0, x > 0, let digits = Int("\(a)\(x)") { wrong.append(digits + b) }
            if x < 0 { wrong.append(a * abs(x) + b) }
        } else {
            let a = gen.pick([1, 2, 3])
            let b = gen.nonZero(-5...5)
            let c = gen.nonZero(-6...6)
            x = gen.pick([-4, -3, -2, -1, 2, 3, 4])
            term = T.polynomial([a, b, c])
            value = a * x * x + b * x + c
            working = "\(a) · \(T.bracketed(x))² \(T.plusMinus(b)) · \(T.bracketed(x)) \(T.plusMinus(c)) = \(a * x * x) \(T.plusMinus(b * x)) \(T.plusMinus(c)) = \(T.int(value))"
            // x² read as 2x, a·x squared as a whole, a negative square taken as negative, the factor x forgotten at b.
            wrong = [2 * a * x + b * x + c, (a * x) * (a * x) + b * x + c, -a * x * x + b * x + c, a * x * x + b + c]
        }
        let xText = T.int(x)
        return .number(
            prompt: "Berechne den Wert von \(term) für x = \(xText).",
            answer: Q(value),
            hint: valueHint,
            wrong: whole(wrong),
            pair: "\(term) für x = \(xText)",
            solution: working,
            explanation: "Setze die Zahl für x ein und rechne Schritt für Schritt: erst Potenzen, dann Punkt vor Strich. Eine negative Zahl kommt in Klammern."
        )
    }

    /// One term of a sum written out: "3x", "x", "5", with its sign in front unless it is the first.
    private static func render(_ terms: [(coefficient: Int, hasX: Bool)]) -> String {
        var text = ""
        for (index, term) in terms.enumerated() {
            let magnitude = abs(term.coefficient)
            let piece = term.hasX ? (magnitude == 1 ? "x" : "\(magnitude)x") : "\(magnitude)"
            if index == 0 {
                text = (term.coefficient < 0 ? T.minus : "") + piece
            } else {
                text += (term.coefficient < 0 ? " \(T.minus) " : " + ") + piece
            }
        }
        return text
    }

    /// "Fasse zusammen: 3x + 5 − x + 2": like terms together, x with x and numbers with numbers.
    private static func simplify(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let xs: [Int]
        let ks: [Int]
        switch level {
        case 1:
            xs = [gen.int(1...6), gen.int(1...6)]
            ks = gen.chance(50) ? [gen.int(1...9), gen.int(1...9)] : [gen.int(1...9)]
        case 2:
            xs = [gen.int(3...9), -gen.int(1...6)]
            ks = [gen.int(1...9), -gen.int(1...9)]
        default:
            xs = [gen.nonZero(-7...7), gen.nonZero(-7...7), gen.nonZero(-7...7)]
            ks = [gen.nonZero(-9...9), gen.nonZero(-9...9)]
        }
        let sumX = xs.reduce(0, +)
        let sumK = ks.reduce(0, +)
        guard sumX != 0, sumK != 0, abs(sumX) <= 14, abs(sumK) <= 18 else { return nil }
        // Levels 2 and 3 subtract: at least one summand is negative.
        guard level == 1 || (xs + ks).contains(where: { $0 < 0 }) else { return nil }
        let terms = gen.shuffled(xs.map { (coefficient: $0, hasX: true) } + ks.map { (coefficient: $0, hasX: false) })
        let expression = render(terms)
        let correct = T.linear(sumX, sumK)
        // Unlike terms put together, x·x written as x², a term left out, a sign turned.
        let negativeX = xs.first { $0 < 0 }
        let negativeK = ks.first { $0 < 0 }
        let wrong = [
            T.linear(sumX + sumK, 0),
            T.polynomial([sumX, 0, sumK]),
            negativeX.map { T.linear(sumX - 2 * $0, sumK) } ?? T.linear(sumX - xs[0], sumK),
            negativeK.map { T.linear(sumX, sumK - 2 * $0) } ?? T.linear(sumX, sumK - ks[ks.count - 1]),
        ]
        let asksCoefficient = abs(sumX) != 1 && gen.chance(50)
        let typed = MathMiddleProblem.Typed(
            prompt: "Fasse zusammen: \(expression)\n" + (asksCoefficient ? "Welche Zahl steht danach vor dem x?" : "Welche Zahl steht danach ohne x?"),
            answer: Rational(asksCoefficient ? sumX : sumK)
        )
        var problem = MathMiddleProblem.text(
            prompt: "Fasse zusammen:\n\(expression)",
            correct: correct,
            wrong: wrong,
            typed: typed,
            pair: expression,
            solution: "x-Terme: \(T.int(sumX))x, Zahlen: \(T.int(sumK)); zusammen \(correct)",
            explanation: "Nur gleichartige Summanden darfst du zusammenfassen: x mit x und Zahlen mit Zahlen. Das Vorzeichen gehört zum Summanden dahinter."
        )
        problem.pairPrompt = "Fasse zusammen und ordne zu."
        return problem
    }

    /// "Löse die Klammer auf: 3(x − 4)": every summand inside is multiplied by the factor in front.
    private static func expand(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let expression: String
        let coefficient: Int
        let constant: Int
        var wrong: [String]
        let working: String
        switch level {
        case 1:
            let a = gen.int(2...9)
            let b = gen.int(1...9)
            expression = "\(a)(x + \(b))"
            (coefficient, constant) = (a, a * b)
            wrong = [T.linear(a, b), T.linear(1, a * b), T.linear(a, a + b)]
            working = "\(a) · x + \(a) · \(b) = \(T.linear(coefficient, constant))"
        case 2:
            let a = gen.int(2...9)
            let b = gen.int(1...9)
            expression = "\(a)(x \(T.minus) \(b))"
            (coefficient, constant) = (a, -a * b)
            wrong = [T.linear(a, -b), T.linear(1, a - b), T.linear(1, -a * b), T.linear(a, a * b)]
            working = "\(a) · x \(T.minus) \(a) · \(b) = \(T.linear(coefficient, constant))"
        default:
            if gen.chance(50) {
                // c − a(x + b): the minus in front turns both signs inside.
                let a = gen.int(2...5)
                let b = gen.int(1...6)
                let c = gen.int(1...9)
                // A number of 0 outside x would make "the number without x" a trick question.
                guard c != a * b else { return nil }
                expression = "\(c) \(T.minus) \(a)(x + \(b))"
                (coefficient, constant) = (-a, c - a * b)
                wrong = [T.linear(-a, c - b), T.linear(-a, c + a * b), T.linear(c - a, (c - a) * b)]
                working = "\(c) \(T.minus) \(a)x \(T.minus) \(a * b) = \(T.linear(coefficient, constant))"
            } else {
                // a(bx − c): both summands inside are multiplied.
                let a = gen.int(2...5)
                let b = gen.int(2...5)
                let c = gen.int(1...6)
                expression = "\(a)(\(b)x \(T.minus) \(c))"
                (coefficient, constant) = (a * b, -a * c)
                wrong = [T.linear(a * b, -c), T.linear(b, -a * c), T.linear(a + b, -c * a), T.linear(a * b, a * c)]
                working = "\(a) · \(b)x \(T.minus) \(a) · \(c) = \(T.linear(coefficient, constant))"
            }
        }
        let asksCoefficient = gen.chance(50)
        var problem = MathMiddleProblem.text(
            prompt: "Löse die Klammer auf:\n\(expression)",
            correct: T.linear(coefficient, constant),
            wrong: wrong,
            typed: .init(
                prompt: "Löse die Klammer auf: \(expression)\n" + (asksCoefficient ? "Welche Zahl steht danach vor dem x?" : "Welche Zahl steht danach ohne x?"),
                answer: Rational(asksCoefficient ? coefficient : constant)
            ),
            pair: expression,
            solution: working,
            explanation: "Multipliziere jeden Summanden in der Klammer mit dem Faktor davor. Steht ein Minus vor der Klammer, drehen sich die Vorzeichen um."
        )
        problem.pairPrompt = "Löse die Klammer auf und ordne zu."
        return problem
    }

    // Lesson 2

    /// "x + 7 = 15", "3x = 21", "x : 4 = 5": one step undoes the operation.
    private static func oneStep(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let kind = level == 1 ? gen.int(0...1) : gen.int(0...3)
        let equation: String
        let x: Int
        let wrong: [Int]
        let step: String
        let probe: String
        switch kind {
        case 0:
            let b = gen.int(level == 3 ? 4...15 : 2...12)
            x = level == 3 ? gen.int(-12 ... -1) : gen.int(1...15)
            let c = x + b
            equation = "x + \(b) = \(T.int(c))"
            wrong = [c + b, b - c, c * b, c]
            step = "x = \(T.int(c)) \(T.minus) \(b) = \(T.int(x))"
            probe = "\(T.bracketed(x)) + \(b) = \(T.int(c))"
        case 1:
            let b = gen.int(level == 3 ? 4...15 : 2...12)
            x = level == 3 ? gen.int(-12 ... -1) : gen.int(2...20)
            let c = x - b
            equation = "x \(T.minus) \(b) = \(T.int(c))"
            wrong = [c - b, b - c, c * b, c]
            step = "x = \(T.int(c)) + \(b) = \(T.int(x))"
            probe = "\(T.bracketed(x)) \(T.minus) \(b) = \(T.int(c))"
        case 2:
            let a = level == 3 ? -gen.int(2...9) : gen.int(2...9)
            x = level == 3 ? gen.nonZero(-9...9) : gen.int(2...12)
            let c = a * x
            equation = "\(T.int(a))x = \(T.int(c))"
            wrong = [c - a, c * a, c + a, a - c]
            step = "x = \(T.int(c)) : \(T.bracketed(a)) = \(T.int(x))"
            probe = "\(T.int(a)) · \(T.bracketed(x)) = \(T.int(c))"
        default:
            let a = gen.int(2...9)
            let c = level == 3 ? gen.nonZero(-9...9) : gen.int(2...9)
            x = c * a
            equation = "x : \(a) = \(T.int(c))"
            wrong = c % a == 0 ? [c - a, c + a, a - c, c / a] : [c - a, c + a, a - c]
            step = "x = \(T.int(c)) · \(a) = \(T.int(x))"
            probe = "\(T.bracketed(x)) : \(a) = \(T.int(c))"
        }
        return .number(
            prompt: "Löse die Gleichung. Welchen Wert hat x?\n\(equation)",
            answer: Q(x),
            hint: "Gib die Zahl an.",
            wrong: whole(wrong),
            pair: equation,
            solution: "\(step). Probe: \(probe) stimmt.",
            explanation: "Mache die Rechnung auf beiden Seiten rückgängig: Plus mit Minus, Mal mit Geteilt."
        )
    }

    /// "3x + 5 = 20": undo the addition first, then the multiplication.
    private static func twoStep(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let a: Int
        let b: Int
        let x: Int
        switch level {
        case 1:
            a = gen.int(2...5)
            x = gen.int(1...9)
            b = gen.int(1...9)
        case 2:
            a = gen.int(2...9)
            x = gen.int(2...12)
            b = gen.nonZero(-12...12)
        default:
            a = gen.nonZero(-9...9)
            x = gen.nonZero(-9...9)
            b = gen.nonZero(-12...12)
        }
        guard abs(a) >= 2 else { return nil }
        let c = a * x + b
        let equation = "\(T.linear(a, b)) = \(T.int(c))"
        // Dividing forgotten, multiplied instead of divided, the sign of b turned, only c divided.
        var wrong = [c - b, (c - b) * a, c + b]
        if (c + b) % a == 0 { wrong.append((c + b) / a) }
        if c % a == 0 { wrong.append(c / a - b) }
        let step = "\(T.int(a))x = \(T.int(c)) \(b < 0 ? "+" : T.minus) \(abs(b)) = \(T.int(c - b)); x = \(T.int(c - b)) : \(T.bracketed(a)) = \(T.int(x))"
        return .number(
            prompt: "Löse die Gleichung. Welchen Wert hat x?\n\(equation)",
            answer: Q(x),
            hint: "Gib die Zahl an.",
            wrong: whole(wrong),
            pair: equation,
            solution: step + ". Probe: \(T.int(a)) · \(T.bracketed(x)) \(T.plusMinus(b)) = \(T.int(c)) stimmt.",
            explanation: "Mache die Rechenschritte in umgekehrter Reihenfolge rückgängig: erst die Zahl ohne x auf die andere Seite, dann durch die Zahl vor x teilen."
        )
    }

    /// "2(x + 3) = 14": a bracket times a factor equals a number; level 3 has a number added outside.
    private static func brackets(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let a = gen.int(2...5)
        let b = gen.int(1...6)
        let minus = level >= 2 && gen.chance(50)
        let x = level == 1 ? gen.int(1...8) : gen.int(-3...10)
        // What the bracket adds to x: +b for (x + b), −b for (x − b).
        let shift = minus ? -b : b
        let d = level == 3 ? gen.nonZero(-9...9) : 0
        let e = a * (x + shift) + d
        let inside = minus ? "x \(T.minus) \(b)" : "x + \(b)"
        let left = d == 0 ? "\(a)(\(inside))" : "\(a)(\(inside)) \(T.plusMinus(d))"
        let equation = "\(left) = \(T.int(e))"
        // After the number outside the bracket is taken off, a times the bracket is left.
        let product = e - d
        let quotient = product / a
        // The shift forgotten, the shift added instead of taken off, the factor ignored, b not multiplied by the factor.
        var wrong = [quotient, quotient + shift, product - shift]
        if (product - shift) % a == 0 { wrong.append((product - shift) / a) }
        let firstStep = d == 0 ? "" : "\(T.int(e)) \(d < 0 ? "+" : T.minus) \(abs(d)) = \(T.int(product)); "
        return .number(
            prompt: "Löse die Gleichung. Welchen Wert hat x?\n\(equation)",
            answer: Q(x),
            hint: "Gib die Zahl an.",
            wrong: whole(wrong),
            pair: equation,
            solution: "\(firstStep)\(T.int(product)) : \(a) = \(T.int(quotient)), also x \(minus ? "\(T.minus) \(b)" : "+ \(b)") = \(T.int(quotient)) und x = \(T.int(x)). Probe: \(probeBrackets(a, inside, d, x, e))",
            explanation: "Rechne zuerst das Äußere rückgängig: die Zahl neben der Klammer, dann den Faktor vor der Klammer. Danach bleibt eine einfache Gleichung."
        )
    }

    private static func probeBrackets(_ a: Int, _ inside: String, _ d: Int, _ x: Int, _ result: Int) -> String {
        let value = inside.replacingOccurrences(of: "x", with: T.bracketed(x))
        let tail = d == 0 ? "" : " \(T.plusMinus(d))"
        return "\(a)(\(value))\(tail) = \(T.int(result)) stimmt."
    }

    // Lesson 3

    /// "5x − 3 = 2x + 9": collect the x on one side first.
    private static func bothSides(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { bothSidesAttempt(level, gen) }
    }

    private static func bothSidesAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let a: Int
        let c: Int
        let x: Int
        switch level {
        case 1:
            c = gen.int(1...4)
            a = c + gen.int(1...5)
            x = gen.int(1...9)
        case 2:
            c = gen.nonZero(-5...6)
            a = gen.nonZero(-5...9)
            x = gen.nonZero(-8...9)
        default:
            c = gen.nonZero(-4...6)
            a = gen.int(2...6)
            x = gen.nonZero(-8...9)
        }
        guard a != c else { return nil }
        // a x + p = c x + q, where level 3 writes the left side as a(x + e) with p = a e.
        let slope = a - c
        let equation: String
        let p: Int
        let q: Int
        if level == 3 {
            let e = gen.nonZero(-9...9)
            p = a * e
            q = a * (x + e) - c * x
            equation = "\(a)(x \(T.plusMinus(e))) = \(T.linear(c, q))"
        } else {
            p = gen.nonZero(-9...9)
            q = slope * x + p
            equation = "\(T.linear(a, p)) = \(T.linear(c, q))"
        }
        let moved = q - p
        // Forgotten to divide, the sign of the number turned, the x-terms added instead of taken off.
        var wrong = [moved, q + p]
        if (q + p) % slope == 0 { wrong.append((q + p) / slope) }
        if a + c != 0, moved % (a + c) == 0 { wrong.append(moved / (a + c)) }
        wrong = wrong.filter { $0 != x }
        guard Set(wrong).count >= 3 else { return nil }
        let opening = level == 3 ? "Klammer auflösen: \(T.linear(a, p)) = \(T.linear(c, q)); " : ""
        return .number(
            prompt: "Löse die Gleichung. Welchen Wert hat x?\n\(equation)",
            answer: Q(x),
            hint: "Gib die Zahl an.",
            wrong: whole(wrong),
            pair: equation,
            solution: "\(opening)\(T.int(slope))x = \(T.int(moved)); x = \(T.int(moved)) : \(T.bracketed(slope)) = \(T.int(x))",
            explanation: "Bringe alle x auf eine Seite und alle Zahlen auf die andere, jeweils mit der Gegenoperation. Dann teilst du durch die Zahl vor x."
        )
    }

    /// "Welche Zahl ist die Lösung?" by trying the numbers; typed: the value both sides take when the solution is put in.
    private static func plugIn(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let a: Int
        let c: Int
        let b: Int
        let x: Int
        switch level {
        case 1:
            c = gen.int(1...4)
            a = c + gen.int(1...4)
            x = gen.int(1...9)
            b = gen.int(1...9)
        case 2:
            c = gen.nonZero(-4...5)
            a = gen.nonZero(-4...8)
            x = gen.nonZero(-6...9)
            b = gen.nonZero(-9...9)
        default:
            c = gen.nonZero(-4...5)
            a = gen.int(2...6)
            x = gen.nonZero(-6...9)
            b = gen.nonZero(-6...6)
        }
        guard a != c else { return nil }
        let left: String
        let right: String
        let value: Int
        if level == 3 {
            // a(x + b) = c x + d
            let d = a * (x + b) - c * x
            left = "\(a)(x \(T.plusMinus(b)))"
            right = T.linear(c, d)
            value = a * (x + b)
        } else {
            let d = (a - c) * x + b
            left = T.linear(a, b)
            right = T.linear(c, d)
            value = a * x + b
        }
        let equation = "\(left) = \(right)"
        // Numbers next to the solution: the usual slips of one or two.
        let wrong = [x + 1, x - 1, x + 2, x - 2]
        let both = "\(T.int(value))"
        return MathMiddleProblem.number(
            prompt: "Welche Zahl ist die Lösung der Gleichung? Setze zur Probe ein.\n\(equation)",
            answer: Q(x),
            hint: "",
            wrong: whole(wrong),
            typedPrompt: "Die Lösung der Gleichung \(equation) ist x = \(T.int(x)).\nWelchen Wert haben beide Seiten, wenn du \(T.int(x)) einsetzt?",
            typedAnswer: Q(value),
            solution: "Probe mit x = \(T.int(x)): links \(both) und rechts \(both). Beide Seiten sind gleich, also stimmt die Lösung.",
            explanation: "Eine Zahl ist die Lösung, wenn beide Seiten der Gleichung nach dem Einsetzen denselben Wert haben."
        )
    }

    /// Short stories that lead to one equation.
    private static func word(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { wordAttempt(level, gen) }
    }

    private static func wordAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        switch level {
        case 1:
            let a = gen.int(2...9)
            let x = gen.int(2...12)
            let b = gen.int(1...12)
            let adds = gen.chance(50)
            let c = adds ? a * x + b : a * x - b
            guard c > 0 else { return nil }
            let factor = a == 2 ? "Ich verdopple sie" : "Ich multipliziere sie mit \(a)"
            let signed = adds ? b : -b
            // Dividing forgotten, the sign of the number turned, the number ignored, the sign turned and then divided.
            var options = [c - signed, c + signed]
            if c % a == 0 { options.append(c / a) }
            if (c + signed) % a == 0 { options.append((c + signed) / a) }
            return .number(
                prompt: "Ich denke mir eine Zahl. \(factor) und \(adds ? "addiere" : "subtrahiere") \(b). Das Ergebnis ist \(c).\nWelche Zahl habe ich mir gedacht?",
                answer: Q(x),
                hint: "Gib die Zahl an.",
                wrong: whole(options.filter { $0 != x }),
                solution: "\(T.linear(a, signed)) = \(c); \(a)x = \(c - signed); x = \(x)",
                explanation: "Schreibe die Geschichte als Gleichung (die gedachte Zahl ist x) und löse sie wie gewohnt."
            )
        case 2:
            let a = gen.int(2...5)
            let x = gen.int(3...15)
            let b = gen.int(3...12)
            let c = a * x + b
            let (story, unit) = gen.pick([
                ("Ein Taxi berechnet \(b) € Grundgebühr und \(a) € je Kilometer. Die Fahrt kostet \(c) €.\nWie viele Kilometer ist sie lang?", "km"),
                ("Ein Fahrradverleih nimmt \(b) € Pauschale und \(a) € je Stunde. Tim zahlt \(c) €.\nWie viele Stunden hat er das Rad geliehen?", "Stunden"),
                ("Ein Handwerker berechnet \(b) € für die Anfahrt und \(a) € je Arbeitsstunde. Die Rechnung beträgt \(c) €.\nWie viele Stunden hat er gearbeitet?", "Stunden"),
            ])
            var options = [c - b, c / a, x + b, (c - b) * a]
            if c % a != 0 { options.remove(at: 1) }
            return .number(
                prompt: story,
                answer: Q(x),
                style: .unit(unit),
                hint: "Gib nur die Zahl an.",
                wrong: whole(options.filter { $0 != x }),
                solution: "\(T.linear(a, b)) = \(c) mit x als Anzahl der \(unit); \(a)x = \(c - b); x = \(x)",
                explanation: "Die Grundgebühr wird nur einmal bezahlt. Ziehe sie zuerst vom Gesamtpreis ab und teile dann durch den Preis je Einheit."
            )
        default:
            let r2 = gen.int(2...6)
            let difference = gen.int(2...5)
            let r1 = r2 + difference
            let x = gen.int(3...12)
            let p1 = gen.int(2...12) * 5
            let p2 = p1 + difference * x
            let names = gen.pick([("Tom", "Lena"), ("Mia", "Jan"), ("Ali", "Eva")])
            let gap = p2 - p1
            var options = [gap, gap / r1, gap / r2, gap / (r1 + r2), (p1 + p2) / difference]
            options = options.enumerated().filter { index, value in
                switch index {
                case 1: return gap % r1 == 0
                case 2: return gap % r2 == 0
                case 3: return gap % (r1 + r2) == 0
                case 4: return (p1 + p2) % difference == 0
                default: return true
                }
            }.map(\.element).filter { $0 != x }
            guard Set(options).count >= 3 else { return nil }
            return .number(
                prompt: "\(names.0) hat \(p1) € und spart \(r1) € pro Woche. \(names.1) hat \(p2) € und spart \(r2) € pro Woche.\nNach wie vielen Wochen haben beide gleich viel?",
                answer: Q(x),
                style: .unit("Wochen"),
                hint: "Gib nur die Zahl an.",
                wrong: whole(options),
                solution: "\(p1) + \(r1)x = \(p2) + \(r2)x; \(difference)x = \(gap); x = \(x)",
                explanation: "Beide Beträge nach x Wochen setzt du gleich. Dann sammelst du die x auf einer Seite und löst die Gleichung."
            )
        }
    }
}
