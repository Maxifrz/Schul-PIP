import Foundation

private typealias Q = MathMiddleQ
private typealias T = MathMiddleText

/// Unit 6, Lineare Funktionen: Gleichung lesen, Funktionswerte und Steigungsdreieck (lesson 1), Nullstelle, Steigung aus
/// zwei Punkten und Gerade durch zwei Punkte (2), Punktprobe, Parallele und Sachaufgaben (3).
enum MathMiddleUnit06 {
    static let templates: [MathMiddleTemplate] = [
        MathMiddleTemplate("u06.readEquation", lesson: 1, forms: [.choice, .typed, .pairs], make: readEquation),
        MathMiddleTemplate("u06.functionValue", lesson: 1, forms: [.choice, .typed, .pairs], make: functionValue),
        MathMiddleTemplate("u06.slopeTriangle", lesson: 1, forms: [.choice, .typed, .pairs], make: slopeTriangle),
        MathMiddleTemplate("u06.zeroPoint", lesson: 2, forms: [.choice, .typed, .pairs], make: zeroPoint),
        MathMiddleTemplate("u06.slopeTwoPoints", lesson: 2, forms: [.choice, .typed, .pairs], make: slopeTwoPoints),
        MathMiddleTemplate("u06.yIntercept", lesson: 2, forms: [.choice, .typed, .pairs], make: yIntercept),
        MathMiddleTemplate("u06.lineThroughTwo", lesson: 2, forms: [.choice, .typed, .pairs], make: lineThroughTwo),
        MathMiddleTemplate("u06.pointTest", lesson: 3, forms: [.choice, .typed], make: pointTest),
        MathMiddleTemplate("u06.parallel", lesson: 3, forms: [.choice, .typed], make: parallel),
        MathMiddleTemplate("u06.application", lesson: 3, forms: [.choice, .typed], make: application),
    ]

    // Writing a line

    /// The x-term of a line: "2x", "x", "−x", "0,5x".
    private static func xTerm(_ m: Q) -> String {
        if m == Q(1) { return "x" }
        if m == Q(-1) { return T.minus + "x" }
        return T.number(m) + "x"
    }

    /// "y = 2x − 3"; swapped puts the number first: "y = 5 − 2x".
    private static func line(_ m: Q, _ b: Q, swapped: Bool = false) -> String {
        if swapped, !b.isZero {
            return "y = " + T.number(b) + (m.isNegative ? " \(T.minus) " : " + ") + xTerm(m.magnitude)
        }
        let tail = b.isZero ? "" : (b.isNegative ? " \(T.minus) " + T.number(b.magnitude) : " + " + T.number(b))
        return "y = " + xTerm(m) + tail
    }

    /// "P(1|2)".
    private static func point(_ name: String, _ x: Q, _ y: Q) -> String {
        "\(name)(\(T.number(x))|\(T.number(y)))"
    }

    /// A slope for the level: whole at 1, whole with either sign at 2, with halves at 3.
    private static func slope(_ level: Int, _ gen: MathMiddleGen) -> Q {
        switch level {
        case 1: return Q(gen.int(1...6))
        case 2: return Q(gen.nonZero(-6...6))
        default: return gen.chance(50) ? Q(gen.nonZero(-9...9), 2) : Q(gen.nonZero(-5...5))
        }
    }

    private static let valueHint = "Gib die Zahl an."

    // Lesson 1

    /// "Welche Steigung hat y = 2x − 3?" and "Wie groß ist der y-Achsenabschnitt?"
    private static func readEquation(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let m = slope(level, gen)
        let b = Q(gen.nonZero(-9...9))
        let swapped = level == 3 && gen.chance(50)
        let equation = line(m, b, swapped: swapped)
        let asksSlope = gen.chance(50)
        // The two numbers swapped, the run mixed up with the rise, the zero point taken for the intercept.
        let zero = (b / m).negated
        let wrong = asksSlope
            ? [b, m.reciprocal, m + b, m * b].decimals(2)
            : [m, zero, b + m, m * b].decimals(2)
        let name = asksSlope ? "Steigung" : "y-Achsenabschnitt"
        let answer = asksSlope ? m : b
        var problem = MathMiddleProblem.number(
            prompt: asksSlope ? "Welche Steigung hat die Gerade?\n\(equation)" : "Wie groß ist der y-Achsenabschnitt der Geraden?\n\(equation)",
            answer: answer,
            hint: valueHint,
            wrong: wrong,
            pair: "\(name) von \(equation)",
            solution: "\(equation) hat die Form y = mx + b: m = \(T.number(m)) ist die Steigung, b = \(T.number(b)) der y-Achsenabschnitt.",
            explanation: "In y = mx + b ist m die Zahl vor dem x (mit ihrem Vorzeichen) und b die Zahl ohne x. Die Reihenfolge der Summanden ändert daran nichts."
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe die gesuchte Zahl zu."
        return problem
    }

    /// "f(x) = 2x − 3, berechne f(4)" and, at level 3, "für welches x ist f(x) = 7".
    private static func functionValue(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { functionValueAttempt(level, gen) }
    }

    private static func functionValueAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let m = level == 1 ? Q(gen.int(2...6)) : Q(gen.nonZero(-6...6))
        let b = Q(gen.nonZero(-9...9))
        let x = level == 1 ? gen.int(1...6) : gen.nonZero(-5...6)
        let y = m * x + b
        let function = "f(x) = " + String(line(m, b).dropFirst(4))
        if level == 3, gen.chance(50) {
            // The other way round: for which x does f take this value?
            guard let mInt = m.int, let bInt = b.int, let yInt = y.int, abs(mInt) >= 2 else { return nil }
            // The sign of b turned, the dividing forgotten, the number taken for the answer, multiplied instead of divided.
            var wrong = [Q(yInt - bInt), Q(yInt), Q(mInt * yInt + bInt)]
            if (yInt + bInt) % mInt == 0 { wrong.append(Q((yInt + bInt) / mInt)) }
            guard wrong.wholes.count >= 3 else { return nil }
            return .number(
                prompt: "Gegeben: \(function)\nFür welches x gilt f(x) = \(T.int(yInt))?",
                answer: Q(x),
                hint: valueHint,
                wrong: wrong.wholes,
                pair: "\(function), f(x) = \(T.int(yInt))",
                solution: "\(T.linear(mInt, bInt)) = \(T.int(yInt)); \(T.int(mInt))x = \(T.int(yInt - bInt)); x = \(T.int(x))",
                explanation: "Setze den Funktionswert für f(x) ein und löse die Gleichung nach x auf."
            )
        }
        guard let mInt = m.int, let bInt = b.int, let yInt = y.int else { return nil }
        // The product read as a sum, the sign of b turned, the bracket forgotten, the x lost.
        var wrong = [mInt + x + bInt, mInt * x - bInt, mInt * (x + bInt)]
        if x < 0 { wrong.append(mInt * abs(x) + bInt) }
        return .number(
            prompt: "Gegeben: \(function)\nBerechne f(\(T.int(x))).",
            answer: Q(yInt),
            hint: valueHint,
            wrong: wrong.map { Q($0) },
            pair: "\(function), f(\(T.int(x)))",
            solution: "f(\(T.int(x))) = \(T.int(mInt)) · \(T.bracketed(x)) \(T.plusMinus(bInt)) = \(T.int(mInt * x)) \(T.plusMinus(bInt)) = \(T.int(yInt))",
            explanation: "Setze die Zahl für x in den Funktionsterm ein und rechne: erst malnehmen, dann addieren."
        )
    }

    /// "4 nach rechts, 6 nach oben: welche Steigung?" Rise over run, never run over rise.
    private static func slopeTriangle(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let dx: Int
        let dy: Int
        switch level {
        case 1:
            dx = gen.int(1...4)
            dy = dx * gen.int(2...4)
        case 2:
            dx = gen.int(2...6)
            dy = gen.chance(50) ? -dx * gen.int(2...3) : gen.int(1...9)
        default:
            dx = gen.int(2...7)
            dy = gen.chance(70) ? -gen.int(1...9) : gen.int(1...9)
        }
        guard dy != 0, abs(dy) != dx else { return nil }
        let m = Q(dy, dx)
        let rising = dy > 0
        let up = abs(dy)
        let story = "Von einem Punkt der Geraden gehst du \(dx) Einheiten nach rechts und \(up) Einheiten nach \(rising ? "oben" : "unten"), und du bist wieder auf der Geraden.\nWelche Steigung hat sie?"
        // Run over rise, the two numbers added or subtracted, the rise alone.
        let wrong = [Q(dx, up) * (rising ? 1 : -1), Q(dx + up), Q(up - dx) * (rising ? 1 : -1), Q(dy)]
        return .number(
            prompt: story,
            answer: m,
            style: .fraction,
            hint: "Gib die Steigung als ganze Zahl oder Bruch an, zum Beispiel 3/2.",
            wrong: wrong,
            pair: "\(dx) nach rechts, \(up) nach \(rising ? "oben" : "unten")",
            solution: "m = Höhe : Breite = \(T.int(dy)) : \(dx) = \(T.fraction(m)). Die Gerade \(rising ? "steigt" : "fällt").",
            explanation: "Steigung ist Höhenunterschied durch Breitenunterschied. Nach oben ist der Höhenunterschied positiv, nach unten negativ."
        )
    }

    // Lesson 2

    /// "Berechne die Nullstelle von y = 2x − 6": set y = 0 and solve.
    private static func zeroPoint(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { zeroPointAttempt(level, gen) }
    }

    private static func zeroPointAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let m: Int
        let b: Int
        switch level {
        case 1:
            m = gen.int(2...6)
            b = -m * gen.int(1...6)
        case 2:
            m = gen.nonZero(-6...6)
            b = -m * gen.nonZero(-6...6)
        default:
            m = gen.nonZero(-8...8)
            b = gen.nonZero(-12...12)
        }
        guard abs(m) >= 2 else { return nil }
        let zero = Q(-b, m)
        guard zero.ok, [zero].decimals(2).count == 1, !zero.isZero else { return nil }
        if level == 3, zero.isWhole { return nil }
        // The sign of b kept, m and b swapped, the intercept itself, the sum.
        let wrong = [Q(b, m), Q(m, b), Q(b), Q(m + b)].decimals(2)
        let equation = T.line(m, b)
        return .number(
            prompt: "Berechne die Nullstelle der Funktion.\n\(equation)",
            answer: zero,
            hint: "Gib x als Zahl an.",
            wrong: wrong,
            pair: equation,
            solution: "0 = \(T.linear(m, b)); \(T.int(m))x = \(T.int(-b)); x = \(T.int(-b)) : \(T.bracketed(m)) = \(T.number(zero))",
            explanation: "An der Nullstelle ist y = 0. Setze 0 für y ein und löse die Gleichung nach x auf."
        )
    }

    /// "P(1|2) und Q(3|8): welche Steigung?" Rise over run again, now from two points.
    private static func slopeTwoPoints(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { slopeTwoPointsAttempt(level, gen) }
    }

    private static func slopeTwoPointsAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let x1: Int
        let x2: Int
        let y1: Int
        let y2: Int
        switch level {
        case 1:
            x1 = gen.int(0...4)
            x2 = x1 + gen.int(1...4)
            y1 = gen.int(0...6)
            y2 = y1 + (x2 - x1) * gen.int(1...4)
        case 2:
            x1 = gen.int(-4...3)
            x2 = x1 + gen.int(1...5)
            y1 = gen.int(-6...6)
            y2 = y1 + (x2 - x1) * gen.nonZero(-4...4)
        default:
            x1 = gen.int(-5...3)
            x2 = x1 + gen.int(2...7)
            y1 = gen.int(-6...6)
            y2 = gen.int(-8...8)
        }
        guard x1 != x2, y1 != y2, abs(y2 - y1) != abs(x2 - x1) else { return nil }
        let dy = y2 - y1
        let dx = x2 - x1
        let m = Q(dy, dx)
        guard [m].decimals(2).count == 1 || level == 3 else { return nil }
        // x over y, the sums, the rise alone, the run alone.
        let wrong = [Q(dx, dy), Q(y2 + y1, x2 + x1), Q(dy), Q(dx)].filter { $0.ok }
        let p = point("P", Q(x1), Q(y1))
        let q = point("Q", Q(x2), Q(y2))
        return .number(
            prompt: "Eine Gerade geht durch \(p) und \(q).\nWie groß ist ihre Steigung?",
            answer: m,
            hint: "Gib die Steigung als ganze Zahl, Dezimalzahl oder Bruch an.",
            wrong: wrong,
            pair: "\(p), \(q)",
            solution: "m = (y₂ − y₁) : (x₂ − x₁) = (\(T.int(y2)) \(T.minus) \(T.bracketed(y1))) : (\(T.int(x2)) \(T.minus) \(T.bracketed(x1))) = \(T.int(dy)) : \(T.int(dx)) = \(T.number(m))",
            explanation: "Die Steigung ist der Höhenunterschied durch den Breitenunterschied: m = (y₂ − y₁) : (x₂ − x₁). Beide Differenzen in derselben Reihenfolge bilden."
        )
    }

    /// "Steigung 2, durch P(3|5): welches b?" Put the point in y = mx + b and solve for b.
    private static func yIntercept(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let m = slope(level, gen)
        let x = level == 3 && m.denominator == 2 ? 2 * gen.nonZero(-4...4) : gen.nonZero(-5...6)
        let b = Q(gen.nonZero(-9...9))
        let y = m * x + b
        guard y.ok, y.isWhole, abs(y.numerator) <= 20 else { return nil }
        let p = point("P", Q(x), y)
        let mx = m * x
        // The point's y taken for b, the product added, the factor x forgotten, x subtracted.
        let wrong = [y, y + mx, y - m, y - Q(x)].decimals(2)
        return .number(
            prompt: "Eine Gerade hat die Steigung \(T.number(m)) und geht durch \(p).\nWie groß ist der y-Achsenabschnitt?",
            answer: b,
            hint: valueHint,
            wrong: wrong,
            pair: "m = \(T.number(m)), \(p)",
            solution: "\(T.int(y.numerator)) = \(T.number(m)) · \(T.bracketed(x)) + b; \(T.int(y.numerator)) = \(T.number(mx)) + b; b = \(T.number(b))",
            explanation: "Setze die Steigung und die Koordinaten des Punktes in y = mx + b ein. Dann bleibt eine Gleichung, in der nur b fehlt."
        )
    }

    /// "Gerade durch P(1|2) und Q(3|8): wie lautet die Gleichung?" The slope first, then b.
    private static func lineThroughTwo(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { lineThroughTwoAttempt(level, gen) }
    }

    private static func lineThroughTwoAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let m = slope(level, gen)
        let b = Q(gen.nonZero(-8...8))
        let x1 = level == 3 && m.denominator == 2 ? 2 * gen.int(-2...2) : gen.int(-2...3)
        let step = level == 3 && m.denominator == 2 ? 2 * gen.int(1...3) : gen.int(1...3)
        let x2 = x1 + step
        let y1 = m * x1 + b
        let y2 = m * x2 + b
        guard y1.ok, y2.ok, y1.isWhole, y2.isWhole, abs(y1.numerator) <= 20, abs(y2.numerator) <= 20, y1 != y2 else { return nil }
        let p = point("P", Q(x1), y1)
        let q = point("Q", Q(x2), y2)
        let correct = line(m, b)
        // b taken from P or Q, b from the wrong sign, the rise taken for the slope.
        var wrongLines = [line(m, y1), line(m, y2), line(m, y1 + m * x1)]
        let dy = y2 - y1
        if step != 1 { wrongLines.append(line(dy, y1 - dy * x1)) }
        var problem = MathMiddleProblem.text(
            prompt: "Eine Gerade geht durch \(p) und \(q).\nWie lautet ihre Gleichung?",
            correct: correct,
            wrong: wrongLines,
            typed: .init(
                prompt: "Eine Gerade geht durch \(p) und \(q).\nWie groß ist ihr y-Achsenabschnitt b?",
                answer: b.value,
                text: T.number(b)
            ),
            pair: "\(p), \(q)",
            solution: "m = (\(T.number(y2)) \(T.minus) \(T.bracketed(y1.numerator))) : (\(x2) \(T.minus) \(T.bracketed(x1))) = \(T.number(m)); \(T.number(y1)) = \(T.number(m)) · \(T.bracketed(x1)) + b gibt b = \(T.number(b)). Also \(correct)",
            explanation: "Erst die Steigung aus beiden Punkten bestimmen, dann einen Punkt in y = mx + b einsetzen und b ausrechnen."
        )
        problem.pairPrompt = "Ordne jedem Punktepaar seine Gerade zu."
        return problem
    }

    // Lesson 3

    /// "Welcher Punkt liegt auf der Geraden?" Plug the coordinates in.
    private static func pointTest(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { pointTestAttempt(level, gen) }
    }

    private static func pointTestAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let m = slope(level, gen)
        let b = Q(gen.nonZero(-9...9))
        let x = level == 3 && m.denominator == 2 ? 2 * gen.nonZero(-3...3) : (level == 1 ? gen.int(1...6) : gen.nonZero(-5...6))
        let y = m * x + b
        guard y.ok, y.isWhole, abs(y.numerator) <= 25 else { return nil }
        let swapped = level == 3 && gen.chance(50)
        let equation = line(m, b, swapped: swapped)
        let xq = Q(x)
        // b with the wrong sign, the x forgotten, the coordinates swapped, the product forgotten.
        var candidates: [(Q, Q)] = [(xq, m * xq - b), (xq, m + b), (y, xq), (xq, xq + b), (xq, y + m)]
        candidates = candidates.filter { $0.0.isWhole && $0.1.isWhole && $0.1 != m * $0.0 + b }
        let wrong = candidates.map { point("P", $0.0, $0.1) }
        let a = y
        return .text(
            prompt: "Welcher Punkt liegt auf der Geraden?\n\(equation)",
            correct: point("P", xq, y),
            wrong: wrong,
            typed: .init(
                prompt: "Der Punkt P(\(T.int(x))|a) liegt auf der Geraden.\n\(equation)\nWie groß ist a?",
                answer: a.value,
                text: T.number(a)
            ),
            solution: "x = \(T.int(x)) einsetzen: y = \(T.number(m)) · \(T.bracketed(x)) \(b.isNegative ? T.minus : "+") \(T.number(b.magnitude)) = \(T.number(y))",
            explanation: "Ein Punkt liegt auf der Geraden, wenn seine Koordinaten die Gleichung erfüllen. Setze x ein und vergleiche das Ergebnis mit dem y-Wert."
        )
    }

    /// "Welche Gerade verläuft parallel zu y = 2x + 3?" Same slope, other b.
    private static func parallel(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { parallelAttempt(level, gen) }
    }

    private static func parallelAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let m = slope(level, gen)
        let b1 = Q(gen.nonZero(-9...9))
        let b2 = Q(gen.nonZero(-9...9))
        guard b1 != b2 else { return nil }
        let given = line(m, b1)
        let correct = line(m, b2)
        // The slope with the other sign, the slope off by one, the two numbers swapped.
        var wrongLines = [m.negated, m + 1, m - 1].filter { !$0.isZero }.map { line($0, b1) }
        if b1 != m { wrongLines.append(line(b1, m)) }
        // Through a point: the intercept of the parallel.
        let x = level == 3 && m.denominator == 2 ? 2 * gen.nonZero(-3...3) : gen.nonZero(-4...5)
        let y = m * x + b2
        guard y.isWhole, abs(y.numerator) <= 25 else { return nil }
        let p = point("P", Q(x), y)
        return .text(
            prompt: "Welche Gerade verläuft parallel zu\n\(given)?",
            correct: correct,
            wrong: wrongLines,
            typed: .init(
                prompt: "Eine Gerade ist parallel zu \(given) und geht durch \(p).\nWie groß ist ihr y-Achsenabschnitt?",
                answer: b2.value,
                text: T.number(b2)
            ),
            solution: "Parallele Geraden haben dieselbe Steigung m = \(T.number(m)); nur b ist anders. Also \(correct)",
            explanation: "Zwei Geraden sind parallel, wenn ihre Steigungen gleich sind. Der y-Achsenabschnitt darf anders sein. Mit einem Punkt findest du dann b."
        )
    }

    /// Short stories with a fixed part and a part that grows or shrinks evenly.
    private static func application(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { applicationAttempt(level, gen) }
    }

    private static func applicationAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        // 0 phone (grows), 1 candle (shrinks), 2 pool (grows).
        let story = level == 1 ? gen.pick([0, 2]) : gen.int(0...2)
        let m: Q
        let b: Q
        let x: Int
        let unit: String
        let function: String
        switch story {
        case 0:
            m = Q(gen.pick([5, 10, 15, 20, 25]), 100)
            b = Q(gen.int(3...9))
            x = gen.pick([20, 40, 60, 80, 100, 120, 150, 200])
            unit = "€"
            function = "Ein Handytarif kostet \(T.euroAmount(b)) Grundgebühr im Monat und \(T.euro(m)) je Gesprächsminute."
        case 1:
            m = Q(-gen.int(2...5))
            b = Q(gen.int(5...12) * 5)
            x = gen.int(2...9)
            unit = "cm"
            function = "Eine Kerze ist \(T.number(b)) cm hoch und brennt \(T.number(m.magnitude)) cm in jeder Stunde ab."
        default:
            m = Q(gen.int(3...15))
            b = Q(gen.int(4...20) * 10)
            x = gen.int(2...12)
            unit = "l"
            function = "In einem Becken sind \(T.number(b)) l Wasser. Es kommen \(T.number(m)) l je Minute dazu."
        }
        let y = b + m * x
        guard y.ok, y.double > 0, [y].decimals(2).count == 1 else { return nil }
        let style: MathMiddleProblem.Style = unit == "€" ? .euro : .unit(unit)
        if level == 3 {
            // Backwards: after how long is the value reached?
            let (verb, valueText): (String, String)
            switch story {
            case 0: (verb, valueText) = ("Die Rechnung beträgt", T.euroAmount(y))
            case 1: (verb, valueText) = ("Die Kerze ist nur noch", T.number(y) + " cm hoch")
            default: (verb, valueText) = ("Im Becken sind jetzt", T.number(y) + " l")
            }
            let question = story == 0 ? "Wie viele Minuten wurde telefoniert?" : (story == 1 ? "Wie lange brennt sie schon?" : "Wie viele Minuten läuft das Wasser schon?")
            // The rate not divided, the fixed part added instead of taken off, the fixed part not taken off.
            let rate = m.magnitude
            let wrong = [(y - b).magnitude, (y + b) / rate, y / rate].decimals(2).positives
            guard wrong.count >= 3 else { return nil }
            return .number(
                prompt: "\(function)\n\(verb) \(valueText). \(question)",
                answer: Q(x),
                style: .unit(story == 1 ? "Stunden" : "Minuten"),
                hint: "Gib nur die Zahl an.",
                wrong: wrong,
                solution: "\(T.number(y)) = \(T.number(b)) \(m.isNegative ? T.minus : "+") \(T.number(rate)) · x; \(T.number(rate)) · x = \(T.number((y - b).magnitude)); x = \(x)",
                explanation: "Der Wert besteht aus dem festen Anfangswert und dem Anteil, der mit x wächst oder schrumpft. Ziehe zuerst den Anfangswert ab, dann teilst du durch die Änderung je Einheit."
            )
        }
        let rate = m.magnitude
        // The fixed part forgotten, rate and fixed part added, the wrong direction, the fixed part multiplied too.
        let wrong = [rate * x, rate + b, b - m * x, b * x]
        let target = story == 1 ? "Wie hoch ist sie nach \(x) Stunden?" : (story == 0 ? "Wie viel kostet es bei \(x) Minuten?" : "Wie viel Wasser ist nach \(x) Minuten im Becken?")
        return .number(
            prompt: "\(function)\n\(target)",
            answer: y,
            style: style,
            hint: "Gib nur die Zahl an.",
            wrong: wrong.decimals(2).positives,
            solution: "y = \(T.number(b)) \(m.isNegative ? T.minus : "+") \(T.number(rate)) · \(x) = \(T.number(y)) \(unit)",
            explanation: "Rechne den veränderlichen Teil (Änderung je Einheit mal Anzahl) aus und addiere ihn zum festen Anfangswert, oder ziehe ihn ab, wenn der Wert sinkt."
        )
    }
}
