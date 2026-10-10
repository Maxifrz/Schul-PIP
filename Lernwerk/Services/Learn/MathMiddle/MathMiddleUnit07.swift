import Foundation

private typealias Q = MathMiddleQ
private typealias T = MathMiddleText

/// Unit 7, Potenzen und Wurzeln: Potenzen und Quadratwurzeln (lesson 1), die Potenzgesetze (2), negative Exponenten,
/// Zehnerpotenzen und Wurzelregeln (3).
enum MathMiddleUnit07 {
    static let templates: [MathMiddleTemplate] = [
        MathMiddleTemplate("u07.powerValue", lesson: 1, forms: [.choice, .typed, .pairs], make: powerValue),
        MathMiddleTemplate("u07.negativeBase", lesson: 1, forms: [.choice, .typed, .pairs], make: negativeBase),
        MathMiddleTemplate("u07.squareRoot", lesson: 1, forms: [.choice, .typed, .pairs], make: squareRoot),
        MathMiddleTemplate("u07.estimateRoot", lesson: 1, forms: [.choice, .typed, .pairs], make: estimateRoot),
        MathMiddleTemplate("u07.sameBase", lesson: 2, forms: [.choice, .typed, .pairs], make: sameBase),
        MathMiddleTemplate("u07.powerOfPower", lesson: 2, forms: [.choice, .typed, .pairs], make: powerOfPower),
        MathMiddleTemplate("u07.sameExponent", lesson: 2, forms: [.choice, .typed, .pairs], make: sameExponent),
        MathMiddleTemplate("u07.negativeExponent", lesson: 3, forms: [.choice, .typed, .pairs], make: negativeExponent),
        MathMiddleTemplate("u07.scientific", lesson: 3, forms: [.choice, .typed, .pairs], make: scientific),
        MathMiddleTemplate("u07.rootOfSum", lesson: 3, forms: [.choice, .typed, .pairs], make: rootOfSum),
        MathMiddleTemplate("u07.cubeRoot", lesson: 3, forms: [.choice, .typed, .pairs], make: cubeRoot),
    ]

    private static let valueHint = "Gib die Zahl an."
    private static let exactHint = "Gib das Ergebnis als ganze Zahl, Dezimalzahl oder Bruch an."

    private static func ipow(_ base: Int, _ exponent: Int) -> Int {
        var result = 1
        for _ in 0..<max(0, exponent) { result *= base }
        return result
    }

    private static func letter(_ gen: MathMiddleGen) -> String { gen.pick(["x", "a", "y", "z"]) }

    // Lesson 1

    /// "Berechne 3⁴": the base is taken as a factor as often as the exponent says.
    private static func powerValue(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        if level == 3 {
            return gen.chance(55) ? fractionPower(gen) : decimalPower(gen)
        }
        let base: Int
        let exponent: Int
        if level == 1 {
            base = gen.pick([2, 3, 4, 5, 10])
            exponent = base == 10 ? gen.int(2...4) : gen.int(2...(base <= 3 ? 4 : 3))
        } else {
            base = gen.int(2...9)
            exponent = base == 2 ? gen.int(5...9) : (base == 3 ? gen.int(4...6) : 3)
        }
        let value = ipow(base, exponent)
        guard value < 1000 else { return nil }
        // Base times exponent, exponent to the power of the base, one factor too few or too many.
        let wrong = [base * exponent, ipow(exponent, base), ipow(base, exponent - 1), ipow(base, exponent + 1)].filter { $0 < 100_000 }
        let text = T.power(base, exponent)
        let factors = Array(repeating: String(base), count: exponent).joined(separator: " · ")
        return .number(
            prompt: "Berechne \(text).",
            answer: Q(value),
            hint: valueHint,
            wrong: wrong.map { Q($0) },
            pair: text,
            solution: "\(text) = \(factors) = \(value)",
            explanation: "Die Hochzahl sagt, wie oft die Basis als Faktor vorkommt: \(base)\(T.sup(exponent)) heißt \(exponent) Faktoren \(base), nicht \(base) · \(exponent)."
        )
    }

    private static func fractionPower(_ gen: MathMiddleGen) -> MathMiddleProblem? {
        let b = gen.int(2...5)
        let a = gen.int(1...(b - 1))
        let n = gen.int(2...4)
        guard T.gcd(a, b) == 1, ipow(b, n) <= 1000 else { return nil }
        let base = Q(a, b)
        let value = base.power(n)
        let text = "(\(a)/\(b))\(T.sup(n))"
        // Only the numerator or only the denominator raised, base times exponent, one factor too few.
        let wrong = [Q(ipow(a, n), b), Q(a, ipow(b, n)), Q(a * n, b), base.power(n - 1)]
        return .number(
            prompt: "Berechne \(text).",
            answer: value,
            style: .fraction,
            hint: "Gib das Ergebnis als Bruch an.",
            wrong: wrong,
            pair: text,
            solution: "\(text) = \(a)\(T.sup(n))/\(b)\(T.sup(n)) = \(ipow(a, n))/\(ipow(b, n))",
            explanation: "Bei einem Bruch in der Klammer wird Zähler und Nenner mit der Hochzahl genommen."
        )
    }

    private static func decimalPower(_ gen: MathMiddleGen) -> MathMiddleProblem? {
        let digit = gen.int(1...9)
        let n = gen.int(2...3)
        let base = Q(digit, 10)
        let value = base.power(n)
        guard [value].decimals(6).count == 1 else { return nil }
        let text = "(\(T.number(base)))\(T.sup(n))"
        // The comma one place off, base times exponent, one factor too few.
        let wrong = [value * 10, value / 10, base * n, base.power(n - 1)].decimals(6)
        return .number(
            prompt: "Berechne \(text).",
            answer: value,
            hint: "Gib das Ergebnis als Dezimalzahl an.",
            wrong: wrong,
            pair: text,
            solution: "\(T.number(base)) · \(T.number(base))" + (n == 3 ? " · \(T.number(base))" : "") + " = \(T.number(value))",
            explanation: "Rechne die Faktoren mit Komma aus und zähle die Nachkommastellen: Jeder Faktor bringt eine Stelle."
        )
    }

    /// "−3² oder (−3)²?" Brackets decide what is squared.
    private static func negativeBase(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        if level == 3 {
            let a = gen.int(2...4)
            let b = gen.int(2...4)
            let value = -a * a + ipow(b, 3)
            guard value != 0 else { return nil }
            let text = "\(T.minus)\(a)² \(T.minus) (\(T.minus)\(b))³"
            // The first minus dropped, the cube's sign dropped, both dropped, products instead of powers.
            let wrong = [a * a + ipow(b, 3), -a * a - ipow(b, 3), a * a - ipow(b, 3), -a * 2 + b * 3]
            return .number(
                prompt: "Berechne \(text).",
                answer: Q(value),
                hint: valueHint,
                wrong: wrong.map { Q($0) },
                pair: text,
                solution: "\(T.minus)\(a)² = \(T.minus)\(a * a); (\(T.minus)\(b))³ = \(T.minus)\(ipow(b, 3)); \(T.int(-a * a)) \(T.minus) (\(T.minus)\(ipow(b, 3))) = \(T.int(value))",
                explanation: "Ohne Klammer wird nur die Zahl potenziert, das Minus bleibt davor. Mit Klammer gehört das Minus zur Basis: ungerade Hochzahl gibt Minus, gerade gibt Plus."
            )
        }
        let a = level == 1 ? gen.int(2...6) : gen.int(2...5)
        let n = level == 1 ? 2 : gen.int(2...4)
        let bracket = gen.chance(50)
        let value = bracket ? (n % 2 == 0 ? ipow(a, n) : -ipow(a, n)) : -ipow(a, n)
        let text = bracket ? "(\(T.minus)\(a))\(T.sup(n))" : "\(T.minus)\(a)\(T.sup(n))"
        let sign = value < 0 ? -1 : 1
        // Base times exponent, in either sign, one factor too many or too few.
        let wrong = [a * n, -a * n, sign * ipow(a, n + 1), sign * ipow(a, n - 1)]
        let working = bracket
            ? "(\(T.minus)\(a))\(T.sup(n)) = " + Array(repeating: "(\(T.minus)\(a))", count: n).joined(separator: " · ") + " = \(T.int(value))"
            : "\(T.minus)\(a)\(T.sup(n)) = \(T.minus)(\(Array(repeating: String(a), count: n).joined(separator: " · "))) = \(T.int(value))"
        return .number(
            prompt: "Berechne \(text).",
            answer: Q(value),
            hint: valueHint,
            wrong: wrong.map { Q($0) },
            pair: text,
            solution: working,
            explanation: bracket
                ? "Mit Klammer gehört das Minus zur Basis: Bei gerader Hochzahl ist das Ergebnis positiv, bei ungerader negativ."
                : "Ohne Klammer wird nur die Zahl potenziert, das Minus bleibt davor: \(T.minus)\(a)\(T.sup(n)) ist das Negative von \(a)\(T.sup(n))."
        )
    }

    /// "Berechne √144", "√0,49", "√(9/16)".
    private static func squareRoot(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let kind: Int
        switch level {
        case 1: kind = 0
        case 2: kind = gen.chance(60) ? 0 : 1
        default: kind = gen.int(1...2)
        }
        switch kind {
        case 0:
            let r = level == 1 ? gen.int(2...15) : gen.int(11...25)
            let n = r * r
            var wrong = [r + 1, r - 1, 2 * r]
            if n % 2 == 0 { wrong.append(n / 2) }
            return .number(
                prompt: "Berechne √\(n).",
                answer: Q(r),
                hint: valueHint,
                wrong: wrong.map { Q($0) },
                pair: "√\(n)",
                solution: "\(r)² = \(n), also √\(n) = \(r)",
                explanation: "Die Wurzel fragt nach der nichtnegativen Zahl, die quadriert den Wert unter der Wurzel ergibt. Lerne die Quadratzahlen bis 15² auswendig."
            )
        case 1:
            let r = gen.pick([2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15])
            let places = level == 3 && gen.chance(40) ? 4 : 2
            let radicand = Q(r * r, places == 2 ? 100 : 10000)
            let root = Q(r, places == 2 ? 10 : 100)
            // The comma set in the wrong place, the digits of the root alone, half of the radicand.
            let wrong = [root / 10, root * 10, radicand / 2, Q(r)].decimals(5)
            return .number(
                prompt: "Berechne √\(T.number(radicand)).",
                answer: root,
                hint: "Gib das Ergebnis als Dezimalzahl an.",
                wrong: wrong,
                pair: "√\(T.number(radicand))",
                solution: "\(T.number(root))² = \(T.number(radicand)), also √\(T.number(radicand)) = \(T.number(root))",
                explanation: "Bei Dezimalzahlen zählst du die Nachkommastellen: Das Quadrat hat doppelt so viele Stellen wie die Wurzel."
            )
        default:
            let q = gen.int(2...12)
            let p = gen.int(1...(q - 1))
            guard T.gcd(p, q) == 1 else { return nil }
            let radicand = Q(p * p, q * q)
            let root = Q(p, q)
            // The root of the numerator alone, of the denominator alone, half of the radicand.
            let wrong = [Q(p, q * q), Q(p * p, q), Q(p * p, 2 * q * q), Q(p, 2 * q)]
            return .number(
                prompt: "Berechne √(\(p * p)/\(q * q)).",
                answer: root,
                style: .fraction,
                hint: "Gib das Ergebnis als Bruch an.",
                wrong: wrong,
                pair: "√(\(p * p)/\(q * q))",
                solution: "√\(p * p) = \(p) und √\(q * q) = \(q), also √(\(p * p)/\(q * q)) = \(p)/\(q)",
                explanation: "Bei einem Bruch ziehst du die Wurzel aus Zähler und Nenner einzeln."
            )
        }
    }

    /// "Zwischen welchen ganzen Zahlen liegt √50?" The nearest squares decide.
    private static func estimateRoot(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let n: Int
        switch level {
        case 1: n = gen.int(2...80)
        case 2: n = gen.int(10...150)
        default: n = gen.int(30...400)
        }
        var low = 1
        while (low + 1) * (low + 1) <= n { low += 1 }
        guard low * low != n, low >= 1 else { return nil }
        // The square root of n is at least low and below low + 1; the nearest whole number by comparing n with low² + low.
        let nearest = n <= low * low + low ? low : low + 1
        let correct = "\(low) und \(low + 1)"
        // The neighbouring pairs, and half of the number taken for the root.
        let wrong = ["\(low - 1) und \(low)", "\(low + 1) und \(low + 2)", "\(low - 2) und \(low - 1)", "\(n / 2) und \(n / 2 + 1)"]
            .filter { $0 != correct && !$0.hasPrefix("0 ") && !$0.hasPrefix("-") }
        return .text(
            prompt: "Zwischen welchen zwei aufeinanderfolgenden ganzen Zahlen liegt √\(n)?",
            correct: correct,
            wrong: wrong,
            typed: .init(prompt: "Welche ganze Zahl ist √\(n) am nächsten?", answer: Rational(nearest)),
            pair: "√\(n)",
            solution: "\(low)² = \(low * low) und \(low + 1)² = \((low + 1) * (low + 1)); \(n) liegt dazwischen, also liegt √\(n) zwischen \(low) und \(low + 1)",
            explanation: "Suche die Quadratzahlen links und rechts vom Wert unter der Wurzel. Ihre Wurzeln sind die beiden ganzen Zahlen."
        )
    }

    // Lesson 2

    /// One power as it is written: "2³", "x⁴", and just "x" for the exponent 1.
    private static func powerText(_ base: String, _ exponent: Int) -> String {
        exponent == 1 ? base : T.power(base, exponent)
    }

    /// The wrong results of a law of powers: each wrong exponent written out, leaving out any that is not a sensible
    /// exponent (zero, negative, huge) or that equals the right one.
    private static func wrongPowers(_ base: String, _ exponents: [Int], right: Int) -> [String] {
        exponents.filter { $0 >= 1 && $0 <= 40 && $0 != right }.map { powerText(base, $0) }
    }

    /// "2³ · 2⁴" and "5⁹ : 5⁶": same base, exponents added or subtracted.
    private static func sameBase(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let useLetter = level >= 2 && gen.chance(55)
        let base = useLetter ? letter(gen) : String(gen.pick(level == 1 ? [2, 3, 5, 10] : [2, 3, 4, 5, 6, 7, 10]))
        let numeric = Int(base)
        func power(_ e: Int) -> String { powerText(base, e) }
        let expression: String
        let exponent: Int
        var wrong: [String]
        let working: String
        let multiplies = level == 1 || (level == 2 && gen.chance(55))
        if multiplies {
            let e1 = gen.int(2...7)
            let e2 = gen.int(2...7)
            expression = "\(power(e1)) · \(power(e2))"
            exponent = e1 + e2
            // The exponents multiplied, subtracted, one too many; the bases multiplied.
            wrong = wrongPowers(base, [e1 * e2, abs(e1 - e2), e1 + e2 + 1], right: exponent)
            if let numeric { wrong.append(T.power(numeric * numeric, e1 + e2)) }
            working = "\(expression) = \(power(exponent)), denn \(e1) + \(e2) = \(exponent)"
        } else if level == 2 {
            let e2 = gen.int(2...5)
            let e1 = e2 + gen.int(2...6)
            expression = "\(power(e1)) : \(power(e2))"
            exponent = e1 - e2
            // The exponents added or multiplied, one too many; the bases divided to 1.
            wrong = wrongPowers(base, [e1 + e2, e1 * e2, e1 + e2 - 1] + (e1 % e2 == 0 ? [e1 / e2] : []), right: exponent)
            if numeric != nil { wrong.append(T.power(1, exponent)) }
            working = "\(expression) = \(power(exponent)), denn \(e1) \(T.minus) \(e2) = \(exponent)"
        } else if gen.chance(50) {
            let e1 = gen.int(2...4)
            let e2 = gen.int(2...4)
            let e3 = gen.int(1...4)
            expression = "\(power(e1)) · \(power(e2)) · \(power(e3))"
            exponent = e1 + e2 + e3
            // All exponents multiplied, the order of operations ignored.
            wrong = wrongPowers(base, [e1 * e2 * e3, e1 + e2 * e3, e1 * e2 + e3, exponent + 1], right: exponent)
            working = "\(expression) = \(power(exponent)), denn \(e1) + \(e2) + \(e3) = \(exponent)"
        } else {
            let e1 = gen.int(3...6)
            let e2 = gen.int(2...4)
            let e3 = gen.int(2...4)
            guard e1 + e2 > e3 else { return nil }
            expression = "(\(power(e1)) · \(power(e2))) : \(power(e3))"
            exponent = e1 + e2 - e3
            // Multiplied instead of added, everything added, subtracted twice.
            wrong = wrongPowers(base, [e1 * e2 - e3, e1 + e2 + e3, e1 - e2 - e3, e1 + e2 * e3], right: exponent)
            working = "\(power(e1)) · \(power(e2)) = \(power(e1 + e2)); \(power(e1 + e2)) : \(power(e3)) = \(power(exponent))"
        }
        guard exponent >= 1 else { return nil }
        var problem = MathMiddleProblem.text(
            prompt: "Vereinfache zu einer Potenz:\n\(expression)",
            correct: power(exponent),
            wrong: wrong,
            typed: .init(prompt: "Vereinfache \(expression) zu einer Potenz.\nWelche Zahl steht im Exponenten?", answer: Rational(exponent)),
            pair: expression,
            solution: working,
            explanation: "Gleiche Basis: Beim Malnehmen addierst du die Exponenten, beim Teilen subtrahierst du sie. Die Basis bleibt."
        )
        problem.pairPrompt = "Vereinfache und ordne zu."
        return problem
    }

    /// "(2³)²" and "(x⁴)³ : x⁵": a power of a power multiplies the exponents.
    private static func powerOfPower(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let useLetter = level >= 2 || gen.chance(50)
        let base = useLetter ? letter(gen) : String(gen.pick([2, 3, 5, 10]))
        func power(_ e: Int) -> String { powerText(base, e) }
        let expression: String
        let exponent: Int
        let wrongExponents: [Int]
        let working: String
        switch level {
        case 1:
            let e1 = gen.int(2...5)
            let e2 = gen.int(2...4)
            expression = "(\(power(e1)))\(T.sup(e2))"
            exponent = e1 * e2
            // The exponents added, or one raised to the other.
            wrongExponents = [e1 + e2, ipow(e1, e2), ipow(e2, e1)]
            working = "\(expression) = \(power(exponent)), denn \(e1) · \(e2) = \(exponent)"
        case 2:
            let e1 = gen.int(2...5)
            let e2 = gen.int(2...4)
            let e3 = gen.int(2...6)
            guard e1 * e2 > e3 else { return nil }
            expression = "(\(power(e1)))\(T.sup(e2)) : \(power(e3))"
            exponent = e1 * e2 - e3
            // Added in the bracket, everything multiplied, the quotient taken at the end.
            wrongExponents = [e1 + e2 - e3, e1 * e2 * e3, e1 * e2 + e3, e1 * (e2 - e3)]
            working = "(\(power(e1)))\(T.sup(e2)) = \(power(e1 * e2)); \(power(e1 * e2)) : \(power(e3)) = \(power(exponent))"
        default:
            let e1 = gen.int(2...4)
            let e2 = gen.int(2...4)
            let e3 = gen.int(1...5)
            expression = "(\(power(e1)))\(T.sup(e2)) · \(power(e3))"
            exponent = e1 * e2 + e3
            // The last factor put into the bracket, everything added, everything multiplied.
            wrongExponents = [e1 * (e2 + e3), e1 + e2 + e3, e1 * e2 * e3, e1 + e2 * e3]
            working = "(\(power(e1)))\(T.sup(e2)) = \(power(e1 * e2)); \(power(e1 * e2)) · \(power(e3)) = \(power(exponent))"
        }
        guard exponent >= 2, exponent <= 40 else { return nil }
        var problem = MathMiddleProblem.text(
            prompt: "Vereinfache zu einer Potenz:\n\(expression)",
            correct: power(exponent),
            wrong: wrongPowers(base, wrongExponents, right: exponent),
            typed: .init(prompt: "Vereinfache \(expression) zu einer Potenz.\nWelche Zahl steht im Exponenten?", answer: Rational(exponent)),
            pair: expression,
            solution: working,
            explanation: "Eine Potenz von einer Potenz: Die Exponenten werden multipliziert. Gleiche Basen beim Malnehmen: addieren, beim Teilen: subtrahieren."
        )
        problem.pairPrompt = "Vereinfache und ordne zu."
        return problem
    }

    /// "2³ · 5³ = ?³": the same exponent lets you put the bases together.
    private static func sameExponent(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { sameExponentAttempt(level, gen) }
    }

    private static func sameExponentAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let multiplies = level == 1 || (level == 2 && gen.chance(50)) || (level == 3 && gen.chance(30))
        let n = level == 1 ? 2 : gen.int(2...4)
        let a: Int
        let b: Int
        if multiplies {
            a = level == 1 ? gen.int(2...5) : gen.int(2...9)
            b = level == 1 ? gen.int(2...5) : gen.int(2...9)
        } else {
            b = level == 2 ? gen.int(2...6) : gen.int(3...9)
            a = b * (level == 2 ? gen.int(2...5) : gen.int(2...8))
        }
        guard a != b || !multiplies else { return nil }
        let result = multiplies ? a * b : a / b
        guard result <= 100, result >= 2 else { return nil }
        let expression = multiplies ? "\(T.power(a, n)) · \(T.power(b, n))" : "\(T.power(a, n)) : \(T.power(b, n))"
        let correct = T.power(result, n)
        let wrong = multiplies
            ? [T.power(a + b, n), T.power(a * b, 2 * n), T.power(a * b, n + 1), T.power(a * b, n - 1)]
            : [T.power(a - b, n), T.power(a / b, 1), T.power(a / b, 2 * n)]
        var problem = MathMiddleProblem.text(
            prompt: "Fasse zu einer Potenz zusammen:\n\(expression)",
            correct: correct,
            wrong: wrong.filter { $0 != correct && !$0.hasSuffix("⁰") },
            typed: .init(prompt: "Fasse \(expression) zu einer Potenz zusammen.\nWelche Zahl steht in der Basis?", answer: Rational(result)),
            pair: expression,
            solution: multiplies
                ? "\(expression) = (\(a) · \(b))\(T.sup(n)) = \(correct)"
                : "\(expression) = (\(a) : \(b))\(T.sup(n)) = \(correct)",
            explanation: "Haben zwei Potenzen denselben Exponenten, darfst du die Basen malnehmen oder teilen und den Exponenten behalten."
        )
        problem.pairPrompt = "Fasse zusammen und ordne zu."
        return problem
    }

    // Lesson 3

    /// "2⁻³ als Bruch": a negative exponent takes the reciprocal.
    private static func negativeExponent(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { negativeExponentAttempt(level, gen) }
    }

    private static func negativeExponentAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let text: String
        let value: Q
        let wrong: [Q]
        let working: String
        switch level {
        case 1:
            let base = gen.pick([2, 3, 10, 5])
            let n = base == 10 ? gen.int(1...3) : gen.int(1...3)
            value = Q(1, ipow(base, n))
            text = T.power(base, -n)
            wrong = [Q(ipow(base, n)), Q(-base * n), Q(1, base * n), Q(1, ipow(base, max(1, n - 1)))]
            working = "\(text) = 1/\(base)\(T.sup(n)) = 1/\(ipow(base, n))"
        case 2:
            let base = gen.int(2...6)
            let n = gen.int(2...3)
            value = Q(1, ipow(base, n))
            text = T.power(base, -n)
            wrong = [Q(ipow(base, n)), Q(1, base * n), Q(-base * n), Q(1, ipow(base, n - 1)), Q(1, ipow(base, n + 1))]
            working = "\(text) = 1/\(base)\(T.sup(n)) = 1/\(ipow(base, n))"
        default:
            if gen.chance(50) {
                // A fraction as base: the reciprocal of the fraction.
                let b = gen.int(2...4)
                let a = gen.int(1...(b + 1))
                guard a != b, T.gcd(a, b) == 1 else { return nil }
                let n = gen.int(2...3)
                text = "(\(a)/\(b))\(T.sup(-n))"
                value = Q(b, a).power(n)
                wrong = [Q(a, b).power(n), Q(-a * n, b), Q(b, a * n), Q(b * n, a)]
                working = "(\(a)/\(b))\(T.sup(-n)) = (\(b)/\(a))\(T.sup(n)) = \(T.fraction(value))"
            } else {
                let base = gen.int(2...4)
                let n = gen.pick([3, 5])
                text = "(\(T.minus)\(base))\(T.sup(-n))"
                value = Q(1, -ipow(base, n))
                wrong = [Q(ipow(base, n)), Q(-base * n), Q(1, base * n), Q(1, ipow(base, n - 1))]
                working = "(\(T.minus)\(base))\(T.sup(-n)) = 1/(\(T.minus)\(base))\(T.sup(n)) = \(T.fraction(value))"
            }
        }
        guard value.ok, abs(value.double) < 1000, wrong.filter({ $0.ok && $0 != value }).count >= 2 else { return nil }
        return .number(
            prompt: "Schreibe \(text) als Bruch oder ganze Zahl.",
            answer: value,
            style: .fraction,
            hint: "Gib das Ergebnis als Bruch oder ganze Zahl an, zum Beispiel 1/8.",
            wrong: wrong,
            pair: text,
            solution: working,
            explanation: "Ein negativer Exponent bedeutet den Kehrwert: a\(T.sup(-2)) = 1/a². Das Vorzeichen des Exponenten ändert nicht das Vorzeichen der Zahl."
        )
    }

    /// "Schreibe 45 000 in der Form a · 10ⁿ mit 1 ≤ a < 10." Big and small numbers.
    private static func scientific(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { scientificAttempt(level, gen) }
    }

    private static func scientificAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        // The digits of the mantissa as 1 to 99: 7 stands for 7, 45 for 4,5.
        let digits = gen.chance(40) ? gen.int(1...9) : gen.int(11...99)
        guard digits % 10 != 0 else { return nil }
        let hasDecimal = digits >= 10
        let mantissa = hasDecimal ? Q(digits, 10) : Q(digits)
        let exponent: Int
        switch level {
        case 1: exponent = gen.int(2...5)
        case 2: exponent = gen.int(4...9)
        default: exponent = -gen.int(2...7)
        }
        let value = mantissa * Q(10).power(exponent)
        guard value.ok else { return nil }
        let shown: String
        if exponent >= 0 {
            guard let whole = value.int else { return nil }
            shown = T.grouped(whole)
        } else {
            let places = -exponent + (hasDecimal ? 1 : 0)
            shown = T.fixed(value, places: places)
        }
        func form(_ m: Q, _ e: Int) -> String { "\(T.number(m)) · 10\(T.sup(e))" }
        let correct = form(mantissa, exponent)
        // Not normalised (the mantissa too big or too small), the exponent off by one, the wrong direction.
        let wrong = [
            form(mantissa * 10, exponent - 1), form(mantissa / 10, exponent + 1), form(mantissa, exponent - 1),
            form(mantissa, exponent + 1), form(mantissa * 100, exponent - 2),
        ]
        var problem = MathMiddleProblem.text(
            prompt: "Schreibe \(shown) in der Form a · 10ⁿ mit 1 ≤ a < 10.",
            correct: correct,
            wrong: wrong,
            typed: .init(prompt: "Schreibe \(shown) in der Form a · 10ⁿ mit 1 ≤ a < 10.\nWelche Zahl steht im Exponenten?", answer: Rational(exponent)),
            pair: shown,
            solution: exponent >= 0
                ? "Das Komma wandert um \(exponent) Stellen nach rechts: \(correct)"
                : "Das Komma wandert um \(-exponent) Stellen nach links, der Exponent ist negativ: \(correct)",
            explanation: "Vor dem Komma soll genau eine Ziffer ungleich 0 stehen. Der Exponent zählt, um wie viele Stellen das Komma dafür wandert: nach links positiv, nach rechts negativ."
        )
        problem.pairPrompt = "Schreibe mit Zehnerpotenz und ordne zu."
        return problem
    }

    /// "Berechne √(9 + 16)": the root of a sum is not the sum of the roots.
    private static func rootOfSum(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let triples = [(3, 4, 5), (6, 8, 10), (5, 12, 13), (9, 12, 15), (8, 15, 17), (12, 16, 20), (7, 24, 25), (15, 20, 25), (20, 21, 29)]
        let (first, second, c) = gen.pick(level == 1 ? Array(triples.prefix(3)) : (level == 2 ? Array(triples.prefix(6)) : triples))
        // The two legs in either order.
        let (a, b) = gen.chance(50) ? (first, second) : (second, first)
        let subtracts = level == 3 || (level == 2 && gen.chance(40))
        let text: String
        let value: Int
        let wrong: [Int]
        let working: String
        if subtracts {
            let (x, y) = gen.chance(50) ? (a, b) : (b, a)
            text = "√(\(c * c) \(T.minus) \(x * x))"
            value = y
            // The roots subtracted, the radicands subtracted without a root, half of that.
            wrong = [c - x, c * c - x * x, (c * c - x * x) / 2, c + x]
            working = "\(c * c) \(T.minus) \(x * x) = \(y * y), also √\(y * y) = \(y)"
        } else {
            text = "√(\(a * a) + \(b * b))"
            value = c
            // The roots added, the radicands added without a root, half of that.
            wrong = [a + b, a * a + b * b, (a * a + b * b) / 2, c + 1]
            working = "\(a * a) + \(b * b) = \(c * c), also √\(c * c) = \(c)"
        }
        return .number(
            prompt: "Berechne \(text).",
            answer: Q(value),
            hint: valueHint,
            wrong: wrong.map { Q($0) },
            pair: text,
            solution: working,
            explanation: "Rechne zuerst unter der Wurzel. Die Wurzel einer Summe ist nicht die Summe der Wurzeln: √(9 + 16) = 5, aber √9 + √16 = 7."
        )
    }

    /// "Berechne ³√125": the number that cubed gives the radicand.
    private static func cubeRoot(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let r: Int
        switch level {
        case 1: r = gen.int(2...6)
        case 2: r = gen.int(3...10)
        default: r = gen.int(2...9)
        }
        if level == 3 {
            switch gen.int(0...2) {
            case 0:
                // A negative radicand: the root is negative too.
                let n = ipow(r, 3)
                return cubeProblem(radicand: "\(T.minus)\(n)", root: Q(-r), working: "(\(T.minus)\(r))³ = \(T.minus)\(n), also ³√(\(T.minus)\(n)) = \(T.minus)\(r)", wrong: [Q(r), Q(-r * r), Q(-3 * r), Q(r * r)], style: .plain, hint: valueHint)
            case 1:
                let radicand = Q(ipow(r, 3), 1000)
                let root = Q(r, 10)
                guard r % 10 != 0 else { return nil }
                return cubeProblem(radicand: T.number(radicand), root: root, working: "\(T.number(root))³ = \(T.number(radicand)), also ³√\(T.number(radicand)) = \(T.number(root))", wrong: [root / 10, root * 10, root * 3, Q(r)], style: .plain, hint: "Gib das Ergebnis als Dezimalzahl an.")
            default:
                let q = gen.int(2...5)
                let p = gen.int(1...(q - 1))
                guard T.gcd(p, q) == 1 else { return nil }
                return cubeProblem(radicand: "(\(ipow(p, 3))/\(ipow(q, 3)))", root: Q(p, q), working: "³√\(ipow(p, 3)) = \(p) und ³√\(ipow(q, 3)) = \(q), also \(p)/\(q)", wrong: [Q(p, ipow(q, 3)), Q(ipow(p, 3), q), Q(p * 3, q), Q(p, q * 3)], style: .fraction, hint: "Gib das Ergebnis als Bruch an.")
            }
        }
        let n = ipow(r, 3)
        // The square instead of the root, three times the root, the root off by one, the number divided by 3.
        var wrong = [r * r, 3 * r, r + 1, r - 1]
        if n % 3 == 0 { wrong.append(n / 3) }
        return cubeProblem(radicand: String(n), root: Q(r), working: "\(r)³ = \(n), also ³√\(n) = \(r)", wrong: wrong.map { Q($0) }, style: .plain, hint: valueHint)
    }

    private static func cubeProblem(radicand: String, root: Q, working: String, wrong: [Q], style: MathMiddleProblem.Style, hint: String) -> MathMiddleProblem? {
        let text = "³√" + (radicand.hasPrefix(T.minus) ? "(\(radicand))" : radicand)
        var problem = MathMiddleProblem.number(
            prompt: "Berechne \(text).",
            answer: root,
            style: style,
            hint: hint,
            wrong: wrong.filter { $0.ok && !$0.isZero },
            pair: text,
            solution: working,
            explanation: "Die dritte Wurzel fragt nach der Zahl, die hoch 3 den Wert unter der Wurzel ergibt. Aus einer negativen Zahl darf man sie ziehen."
        )
        problem?.pairPrompt = "Berechne und ordne zu."
        return problem
    }
}
