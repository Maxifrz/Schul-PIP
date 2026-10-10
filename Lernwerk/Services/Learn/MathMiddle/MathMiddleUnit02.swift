import Foundation

private typealias Q = MathMiddleQ
private typealias T = MathMiddleText

/// Unit 2, Bruchrechnung: addieren und subtrahieren (lesson 1), multiplizieren und dividieren (2), gemischte Rechnungen
/// und Sachaufgaben (3).
enum MathMiddleUnit02 {
    static let templates: [MathMiddleTemplate] = [
        MathMiddleTemplate("u02.add", lesson: 1, forms: [.choice, .typed, .pairs], make: add),
        MathMiddleTemplate("u02.subtract", lesson: 1, forms: [.choice, .typed, .pairs], make: subtract),
        MathMiddleTemplate("u02.mixedAddSub", lesson: 1, forms: [.choice, .typed, .pairs], make: mixedAddSub),
        MathMiddleTemplate("u02.multiply", lesson: 2, forms: [.choice, .typed, .pairs], make: multiply),
        MathMiddleTemplate("u02.divide", lesson: 2, forms: [.choice, .typed, .pairs], make: divide),
        MathMiddleTemplate("u02.fitsIn", lesson: 2, forms: [.choice, .typed], make: fitsIn),
        MathMiddleTemplate("u02.partOfPart", lesson: 2, forms: [.choice, .typed], make: partOfPart),
        MathMiddleTemplate("u02.order", lesson: 3, forms: [.choice, .typed, .pairs], make: order),
        MathMiddleTemplate("u02.word", lesson: 3, forms: [.choice, .typed], make: word),
        MathMiddleTemplate("u02.mixedMulDiv", lesson: 3, forms: [.choice, .typed, .pairs], make: mixedMulDiv),
    ]

    private static let fractionHint = "Gib das Ergebnis als Bruch an, zum Beispiel 5/6."

    private static func show(_ q: Q) -> String { T.fraction(q) }

    // Lesson 1

    /// "3/7 + 2/7", "1/2 + 1/3": the denominators first, then the numerators.
    private static func add(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let (b, d) = denominators(level, gen)
        let first = gen.properFraction([b])
        let second = gen.properFraction([d])
        let sum = first + second
        guard sum.ok, sum.denominator <= 36 else { return nil }
        let (a, c) = (first.numerator, second.numerator)
        let common = T.lcm(b, d)
        let top = a * (common / b) + c * (common / d)
        var working = b == d
            ? "\(show(first)) + \(show(second)) = \(top)/\(common)"
            : "\(show(first)) + \(show(second)) = \(a * (common / b))/\(common) + \(c * (common / d))/\(common) = \(top)/\(common)"
        if T.gcd(top, common) > 1 { working += " = \(show(sum))" }
        return .number(
            prompt: "Berechne:\n\(show(first)) + \(show(second))",
            answer: sum,
            style: .fraction,
            hint: fractionHint,
            wrong: [
                Q(a + c, b + d),
                Q(a + c, common),
                Q(a + c, b * d),
                first * second,
                Q(a * (common / b) + c, common),
            ],
            pair: "\(show(first)) + \(show(second))",
            solution: working,
            explanation: "Gleiche Nenner: die Zähler addieren. Verschiedene Nenner: erst auf den gemeinsamen Nenner erweitern, dann die Zähler addieren."
        )
    }

    /// Two denominators for a sum or difference: equal or one a multiple of the other (level 1), small and different
    /// (level 2), up to 12 (level 3).
    private static func denominators(_ level: Int, _ gen: MathMiddleGen) -> (Int, Int) {
        switch level {
        case 1:
            if gen.chance(50) { let b = gen.pick([3, 4, 5, 6, 7, 8, 10]); return (b, b) }
            let b = gen.pick([2, 3, 4, 5])
            return (b, b * gen.pick([2, 3]))
        case 2:
            let b = gen.pick([2, 3, 4, 5, 6])
            var d = gen.pick([2, 3, 4, 5, 6])
            if d == b { d = b == 6 ? 4 : b + 1 }
            return (b, d)
        default:
            let b = gen.pick([3, 4, 5, 6, 8, 9, 10, 12])
            var d = gen.pick([3, 4, 5, 6, 8, 9, 10, 12])
            if d == b { d = b == 12 ? 9 : b + 1 }
            return (b, d)
        }
    }

    /// "5/6 − 1/4": the larger fraction first, so the difference is positive.
    private static func subtract(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let (b, d) = denominators(level, gen)
        var first = gen.properFraction([b])
        var second = gen.properFraction([d])
        if first < second { (first, second) = (second, first) }
        let difference = first - second
        guard difference.ok, !difference.isZero, difference.denominator <= 36 else { return nil }
        // After the swap the denominators belong to the other fractions.
        let (fb, sd) = (first.denominator, second.denominator)
        let (a, c) = (first.numerator, second.numerator)
        let common = T.lcm(fb, sd)
        let top = a * (common / fb) - c * (common / sd)
        var working = fb == sd
            ? "\(show(first)) − \(show(second)) = \(top)/\(common)"
            : "\(show(first)) − \(show(second)) = \(a * (common / fb))/\(common) − \(c * (common / sd))/\(common) = \(top)/\(common)"
        if T.gcd(top, common) > 1 { working += " = \(show(difference))" }
        return .number(
            prompt: "Berechne:\n\(show(first)) − \(show(second))",
            answer: difference,
            style: .fraction,
            hint: fractionHint,
            wrong: [
                Q(a - c, fb - sd),
                Q(a - c, common),
                Q(a - c, fb * sd),
                Q(a * (common / fb) - c, common),
                first + second,
            ].filter { $0.ok && !$0.isNegative && !$0.isZero },
            pair: "\(show(first)) − \(show(second))",
            solution: working,
            explanation: "Wie beim Addieren: erst auf den gemeinsamen Nenner erweitern, dann die Zähler subtrahieren. Der Nenner bleibt."
        )
    }

    /// "2 3/4 + 1 1/2": the wholes and the fractions apart, then together. Level 3 subtracts and has to borrow.
    private static func mixedAddSub(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let d1: Int
        let d2: Int
        switch level {
        case 1:
            d1 = gen.pick([3, 4, 5, 6, 8])
            d2 = d1
        case 2:
            d1 = gen.pick([2, 3, 4])
            d2 = d1 * gen.pick([1, 2])
        default:
            d1 = gen.pick([3, 4, 6])
            d2 = gen.pick([3, 4, 6, 8, 12])
        }
        let f1 = gen.properFraction([d1])
        let f2 = gen.properFraction([d2])
        let w1 = gen.int(level: level, 1...4, 2...6, 3...9)
        let w2 = gen.int(level: level, 1...3, 1...5, 1...(w1 - 1 > 0 ? w1 - 1 : 1))
        let first = Q(w1) + f1
        let second = Q(w2) + f2
        let subtracts = level == 3
        let result: Q
        var wrong: [Q] = []
        if subtracts {
            // The borrowing case: the fraction of the first number is smaller than that of the second.
            guard f1 < f2, w1 > w2 else { return nil }
            result = first - second
            // Smaller from larger in the fractions; borrowing a whole without taking it off; the fractions forgotten.
            wrong = [Q(w1 - w2) + (f2 - f1), Q(w1 - w2) + Q(1) + (f1 - f2), Q(w1 - w2)]
        } else {
            if level == 1, (f1 + f2) >= Q(1) { return nil }
            result = first + second
            wrong = [
                Q(w1 + w2) + Q(f1.numerator + f2.numerator, d1 + d2),
                Q(w1 + w2),
                Q(w1 + w2) + Q(f1.numerator + f2.numerator, d1),
            ]
        }
        guard result.ok, result.denominator <= 24 else { return nil }
        let sign = subtracts ? "−" : "+"
        let expression = "\(T.mixed(first)) \(sign) \(T.mixed(second))"
        let working = subtracts
            ? "\(T.mixed(first)) − \(T.mixed(second)) = \(show(first)) − \(show(second)) = \(T.mixed(result))"
            : "\(T.mixed(first)) + \(T.mixed(second)) = \(w1 + w2) + (\(show(f1)) + \(show(f2))) = \(T.mixed(result))"
        return .number(
            prompt: "Berechne:\n\(expression)",
            answer: result,
            style: .mixed,
            hint: "Gib das Ergebnis als gemischte Zahl oder Bruch an, zum Beispiel 2 1/4.",
            wrong: wrong.filter { $0.ok && !$0.isNegative },
            pair: expression,
            solution: working,
            explanation: subtracts
                ? "Reicht der Bruch der ersten Zahl nicht aus, löst du ein Ganzes in Bruchteile auf. Oder du schreibst beide Zahlen als unechte Brüche."
                : "Rechne die Ganzen und die Brüche getrennt. Ist die Summe der Brüche größer als 1, gibt das ein weiteres Ganzes."
        )
    }

    // Lesson 2

    /// "3 · 2/5", "3/4 · 2/9": numerator times numerator, denominator times denominator.
    private static func multiply(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let first: Q
        let second: Q
        switch level {
        case 1:
            if gen.chance(50) {
                first = Q(gen.int(2...6))
                second = gen.properFraction([2, 3, 4, 5, 6, 8])
            } else {
                first = Q(1, gen.int(2...6))
                second = Q(1, gen.int(2...6))
            }
        case 2:
            first = gen.properFraction([3, 4, 5, 6, 8, 9])
            second = gen.properFraction([3, 4, 5, 6, 8, 9])
        default:
            first = gen.properFraction([6, 7, 8, 9, 10, 12])
            second = Q(gen.int(5...11), gen.pick([3, 4, 5, 6, 7, 8, 9]))
        }
        let product = first * second
        guard product.ok, product.numerator <= 60, product.denominator <= 60 else { return nil }
        let (a, b, c, d) = (first.numerator, first.denominator, second.numerator, second.denominator)
        let working = "\(show(first)) · \(show(second)) = \(a * c)/\(b * d)" + (T.gcd(a * c, b * d) > 1 ? " = \(show(product))" : "")
        return .number(
            prompt: "Berechne:\n\(show(first)) · \(show(second))",
            answer: product,
            style: .fraction,
            hint: fractionHint,
            wrong: [Q(a * c, b + d), first / second, first + second, Q(a * c, b)].filter { !$0.isWhole || product.isWhole },
            pair: "\(show(first)) · \(show(second))",
            solution: working,
            explanation: "Zähler mal Zähler und Nenner mal Nenner. Kürzen kannst du schon vor dem Multiplizieren."
        )
    }

    /// "3/4 : 3/8": multiply by the reciprocal of the second number.
    private static func divide(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let first: Q
        let second: Q
        switch level {
        case 1:
            if gen.chance(50) {
                first = gen.properFraction([3, 4, 5, 6, 8])
                second = Q(gen.int(2...5))
            } else {
                first = Q(gen.int(2...5))
                second = Q(1, gen.pick([2, 3, 4, 5]))
            }
        case 2:
            first = gen.properFraction([3, 4, 5, 6, 8, 9, 10])
            second = gen.properFraction([3, 4, 5, 6, 8, 9, 10])
        default:
            first = Q(gen.int(3...11), gen.pick([4, 5, 6, 8, 9, 10, 12]))
            second = gen.properFraction([4, 5, 6, 8, 9, 10, 12])
        }
        let quotient = first / second
        guard quotient.ok, first != second, quotient.numerator <= 24, quotient.denominator <= 24 else { return nil }
        // The reciprocal of the second number as it is written.
        let flipped = second.reciprocal
        let working = "\(show(first)) : \(show(second)) = \(show(first)) · \(show(flipped)) = \(show(quotient))"
        return .number(
            prompt: "Berechne:\n\(show(first)) : \(show(second))",
            answer: quotient,
            style: .fraction,
            hint: fractionHint,
            wrong: [first * second, second / first, (first * second).reciprocal],
            pair: "\(show(first)) : \(show(second))",
            solution: working,
            explanation: "Durch einen Bruch teilst du, indem du mit seinem Kehrwert malnimmst. Nur der zweite Bruch wird umgedreht."
        )
    }

    /// "Wie viele Gläser zu 1/4 l füllst du mit 3 l?" A division of an amount by a fraction, in words.
    private static func fitsIn(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let portion: Q
        let count: Int
        switch level {
        case 1:
            portion = Q(1, gen.pick([2, 3, 4, 5, 8]))
            count = gen.int(2...5) * portion.denominator
        case 2:
            portion = gen.properFraction([3, 4, 5, 6, 8])
            count = gen.int(3...12)
        default:
            portion = gen.properFraction([4, 5, 6, 8, 9, 10, 12])
            count = gen.int(4...15)
        }
        let total = portion * count
        guard total.ok, total.denominator <= 12, total.double <= 40 else { return nil }
        let question: String
        let unit: String
        switch gen.int(0...2) {
        case 0:
            unit = "l"
            question = "Aus \(T.amount(total)) l Saft werden Gläser zu \(show(portion)) l gefüllt.\nWie viele Gläser werden voll?"
        case 1:
            unit = "m"
            question = "Ein Band ist \(T.amount(total)) m lang. Daraus werden Stücke zu \(show(portion)) m geschnitten.\nWie viele Stücke sind das?"
        default:
            unit = "kg"
            question = "Ein Sack enthält \(T.amount(total)) kg Mehl. Jede Tüte fasst \(show(portion)) kg.\nWie viele Tüten werden gefüllt?"
        }
        return .number(
            prompt: question,
            answer: Q(count),
            hint: "Gib nur die Zahl an.",
            wrong: [total * portion, portion / total, total * portion.denominator],
            solution: "\(T.amount(total)) \(unit) : \(show(portion)) \(unit) = \(show(total)) · \(show(portion.reciprocal)) = \(count)",
            explanation: "Gefragt ist, wie oft der Bruchteil in die Gesamtmenge passt. Das ist eine Division durch den Bruch."
        )
    }

    /// "Lena isst 2/3 von 3/4 einer Torte": "von" means times.
    private static func partOfPart(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let first: Q
        let second: Q
        switch level {
        case 1:
            first = Q(1, gen.int(2...5))
            second = Q(1, gen.int(2...5))
        case 2:
            first = gen.properFraction([3, 4, 5, 6])
            second = gen.properFraction([3, 4, 5, 6])
        default:
            first = gen.properFraction([6, 8, 9, 10, 12])
            second = gen.properFraction([4, 5, 6, 8, 9])
        }
        let product = first * second
        guard product.ok, product.denominator <= 60 else { return nil }
        let (a, b, c, d) = (first.numerator, first.denominator, second.numerator, second.denominator)
        let question: String
        switch gen.int(0...2) {
        case 0: question = "Von einer Torte sind noch \(show(first)) übrig. Lena isst \(show(second)) davon.\nWelcher Bruchteil der ganzen Torte ist das?"
        case 1: question = "Ein Tank ist zu \(show(first)) gefüllt. Davon werden \(show(second)) verbraucht.\nWelcher Bruchteil des ganzen Tanks ist das?"
        default: question = "\(show(first)) der Klasse sind Mädchen, \(show(second)) davon spielen Fußball.\nWelcher Bruchteil der Klasse ist das?"
        }
        return .number(
            prompt: question,
            answer: product,
            style: .fraction,
            hint: fractionHint,
            wrong: [first + second, first / second, second / first, Q(a * c, b + d)].filter { $0.ok && !$0.isWhole },
            solution: "\(show(second)) von \(show(first)) = \(show(second)) · \(show(first)) = \(a * c)/\(b * d)" + (T.gcd(a * c, b * d) > 1 ? " = \(show(product))" : ""),
            explanation: "„Davon“ und „von“ bedeuten malnehmen: Ein Bruchteil von einem Bruchteil ist das Produkt der Brüche."
        )
    }

    // Lesson 3

    /// "1/2 + 1/3 · 3/4": multiplication and division before addition and subtraction, brackets first.
    private static func order(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let dens = level == 1 ? [2, 3, 4] : [2, 3, 4, 5, 6]
        let a = gen.properFraction(dens)
        let b = gen.properFraction(dens)
        let c = gen.properFraction(dens)
        let kinds: [Int] = level == 1 ? [0] : (level == 2 ? [0, 1, 2] : [1, 2, 3])
        let kind = gen.pick(kinds)
        let expression: String
        let result: Q
        var wrong: [Q]
        switch kind {
        case 0:
            expression = "\(show(a)) + \(show(b)) · \(show(c))"
            result = a + b * c
            wrong = [(a + b) * c, a + b + c, Q(a.numerator + (b * c).numerator, a.denominator + (b * c).denominator)]
        case 1:
            expression = "(\(show(a)) + \(show(b))) · \(show(c))"
            result = (a + b) * c
            wrong = [a + b * c, a + b + c, a * c + b]
        case 2:
            guard a > b / c else { return nil }
            expression = "\(show(a)) − \(show(b)) : \(show(c))"
            result = a - b / c
            wrong = [(a - b) / c, a - b - c, a - b * c].filter { !$0.isNegative }
        default:
            guard a > b else { return nil }
            expression = "(\(show(a)) − \(show(b))) : \(show(c))"
            result = (a - b) / c
            wrong = [a - b / c, a - b * c, (a - b) * c].filter { !$0.isNegative }
        }
        guard result.ok, !result.isNegative, !result.isZero, result.denominator <= 60, result.numerator <= 60 else { return nil }
        wrong = wrong.filter { $0.ok && !$0.isNegative && $0.denominator <= 200 }
        let rule: String
        switch kind {
        case 0: rule = "Punkt vor Strich: erst \(show(b)) · \(show(c)) = \(show(b * c)), dann \(show(a)) + \(show(b * c)) = \(show(result))"
        case 1: rule = "Klammer zuerst: \(show(a)) + \(show(b)) = \(show(a + b)), dann \(show(a + b)) · \(show(c)) = \(show(result))"
        case 2: rule = "Punkt vor Strich: erst \(show(b)) : \(show(c)) = \(show(b / c)), dann \(show(a)) − \(show(b / c)) = \(show(result))"
        default: rule = "Klammer zuerst: \(show(a)) − \(show(b)) = \(show(a - b)), dann \(show(a - b)) : \(show(c)) = \(show(result))"
        }
        return .number(
            prompt: "Berechne:\n\(expression)",
            answer: result,
            style: .fraction,
            hint: fractionHint,
            wrong: wrong,
            pair: expression,
            solution: rule,
            explanation: "Klammern zuerst, dann Punkt vor Strich. Wer einfach von links nach rechts rechnet, kommt hier zu einem falschen Ergebnis."
        )
    }

    /// Short stories: what is left, and the share of one portion.
    private static func word(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        if gen.chance(55) {
            let dens = level == 1 ? [4, 5, 6, 8, 10] : [3, 4, 5, 6, 8, 10, 12]
            let a = gen.properFraction(dens)
            let b = gen.properFraction(dens)
            let used = a + b
            guard used.ok, used < Q(1), used.denominator <= 60, (Q(1) - used).denominator <= 60 else { return nil }
            let rest = Q(1) - used
            let question: String
            switch gen.int(0...2) {
            case 0: question = "Max liest am Montag \(show(a)) eines Buches und am Dienstag \(show(b)).\nWelcher Bruchteil des Buches ist noch übrig?"
            case 1: question = "Lena gibt \(show(a)) ihres Taschengelds fürs Kino und \(show(b)) für Süßigkeiten aus.\nWelcher Bruchteil bleibt übrig?"
            default: question = "Ein Fass ist voll. Am ersten Tag werden \(show(a)) entnommen, am zweiten \(show(b)).\nWelcher Bruchteil ist noch im Fass?"
            }
            return .number(
                prompt: question,
                answer: rest,
                style: .fraction,
                hint: fractionHint,
                wrong: [used, Q(1) - a, Q(1) - b, Q(1) - Q(a.numerator + b.numerator, a.denominator + b.denominator)],
                solution: "\(show(a)) + \(show(b)) = \(show(used)); 1 − \(show(used)) = \(show(rest))",
                explanation: "Zähle zusammen, was verbraucht ist, und ziehe die Summe vom Ganzen (1) ab."
            )
        }
        let portions = gen.int(2...6)
        let amount = gen.properFraction(level == 1 ? [2, 3, 4] : [3, 4, 5, 6, 8])
        let each = amount / portions
        guard each.ok, each.denominator <= 60 else { return nil }
        let unit = gen.pick(["l", "kg"])
        let thing = unit == "l" ? "Milch" : "Mehl"
        return .number(
            prompt: "Für \(portions) Portionen braucht man \(show(amount)) \(unit) \(thing).\nWie viel \(unit == "l" ? "Milch" : "Mehl") ist das für eine Portion?",
            answer: each,
            style: .fractionUnit(unit),
            hint: "Gib das Ergebnis als Bruch an, ohne Einheit.",
            wrong: [amount * portions, Q(portions) / amount, Q(1, portions), Q(amount.numerator, amount.denominator + portions)],
            solution: "\(show(amount)) : \(portions) = \(show(each)) \(unit)",
            explanation: "Eine Portion ist ein Teil von mehreren gleichen: Teile die Gesamtmenge durch die Zahl der Portionen."
        )
    }

    /// "2 1/2 · 4/5", "1 1/3 : 2/3": mixed numbers become improper fractions first.
    private static func mixedMulDiv(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let dens = level == 1 ? [2, 3, 4] : [2, 3, 4, 5, 6]
        let whole = gen.int(level: level, 1...2, 1...3, 2...4)
        let fraction = gen.properFraction(dens)
        let mixed = Q(whole) + fraction
        let other = gen.properFraction(level == 1 ? [2, 3, 4] : [3, 4, 5, 6, 8])
        let divides = level >= 2 && gen.chance(45)
        let result = divides ? mixed / other : mixed * other
        guard result.ok, result.numerator <= 40, result.denominator <= 40 else { return nil }
        let sign = divides ? ":" : "·"
        let improper = Q(whole * fraction.denominator + fraction.numerator, fraction.denominator)
        // The typical mistakes: the whole times the fraction, whole plus numerator over the denominator, the whole left alone.
        let wholeTimes = Q(whole) * fraction
        let sum = Q(whole + fraction.numerator, fraction.denominator)
        let wrong: [Q]
        if divides {
            wrong = [wholeTimes / other, sum / other, mixed * other, Q(whole) + fraction / other]
        } else {
            wrong = [wholeTimes * other, sum * other, Q(whole) + fraction * other, mixed + other]
        }
        let expression = "\(T.mixed(mixed)) \(sign) \(show(other))"
        let step = divides ? "\(show(improper)) · \(show(other.reciprocal))" : "\(show(improper)) · \(show(other))"
        return .number(
            prompt: "Berechne:\n\(expression)",
            answer: result,
            style: .fraction,
            hint: fractionHint,
            wrong: wrong.filter { $0.ok && $0.denominator <= 200 },
            pair: expression,
            solution: "\(T.mixed(mixed)) \(sign) \(show(other)) = \(show(improper)) \(sign) \(show(other)) = \(step) = \(show(result))",
            explanation: "Wandle die gemischte Zahl zuerst in einen unechten Bruch um; dann multiplizierst du oder teilst wie bei gewöhnlichen Brüchen."
        )
    }
}
