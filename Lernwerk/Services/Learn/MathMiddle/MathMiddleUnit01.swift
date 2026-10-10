import Foundation

private typealias Q = MathMiddleQ
private typealias T = MathMiddleText

/// Unit 1, Brüche verstehen: Bruchteile und gemischte Zahlen (lesson 1), erweitern und kürzen (2), vergleichen und
/// ordnen (3).
enum MathMiddleUnit01 {
    static let templates: [MathMiddleTemplate] = [
        MathMiddleTemplate("u01.fractionOf", lesson: 1, forms: [.choice, .typed, .pairs], make: fractionOf),
        MathMiddleTemplate("u01.share", lesson: 1, forms: [.choice, .typed, .pairs], make: share),
        MathMiddleTemplate("u01.mixedToImproper", lesson: 1, forms: [.choice, .typed, .pairs], make: mixedToImproper),
        MathMiddleTemplate("u01.improperToMixed", lesson: 1, forms: [.choice, .typed, .pairs], make: improperToMixed),
        MathMiddleTemplate("u01.equivalent", lesson: 2, forms: [.choice, .typed, .pairs], make: equivalent),
        MathMiddleTemplate("u01.reduce", lesson: 2, forms: [.choice, .typed, .pairs], make: reduce),
        MathMiddleTemplate("u01.isReduced", lesson: 2, forms: [.choice], make: isReduced),
        MathMiddleTemplate("u01.compare", lesson: 3, forms: [.choice, .typed, .pairs], make: compare),
        MathMiddleTemplate("u01.order", lesson: 3, forms: [.choice, .typed], make: order),
        MathMiddleTemplate("u01.between", lesson: 3, forms: [.choice], make: between),
    ]

    // Lesson 1

    /// "Berechne 3/8 von 40 €." The unit fraction first, then as many of them as the numerator says.
    private static func fractionOf(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let denominator = gen.pick(level == 1 ? [3, 4, 5, 10] : (level == 2 ? [3, 4, 5, 6, 8, 10, 12] : [6, 7, 8, 9, 11, 12, 15]))
        let numerator = level == 3 ? gen.int(2...(denominator - 1)) : gen.int(1...min(denominator - 1, level == 1 ? 3 : denominator - 1))
        guard T.gcd(numerator, denominator) == 1 else { return nil }
        let step = gen.int(level: level, 2...5, 3...12, 4...15)
        let whole = denominator * step
        let result = numerator * step
        let unit = gen.chance(25) ? "" : gen.pick(["€", "kg", "m", "l", "cm", "min"])
        let suffix = unit.isEmpty ? "" : " " + unit
        let fraction = "\(numerator)/\(denominator)"
        return .number(
            prompt: "Berechne \(fraction) von \(whole)\(suffix).",
            answer: Q(result),
            style: unit.isEmpty ? .plain : .unit(unit),
            hint: "Gib nur die Zahl an.",
            wrong: [Q(step), Q(whole * numerator), Q(whole * denominator), Q(whole - result)],
            pair: "\(fraction) von \(whole)\(suffix)",
            solution: "\(whole) : \(denominator) = \(step) und \(step) · \(numerator) = \(result)",
            explanation: "Teile die Größe durch den Nenner (das ist ein Teil) und multipliziere mit dem Zähler (so viele Teile)."
        )
    }

    /// "Von 12 Kugeln sind 9 rot. Welcher Bruchteil ist das?"
    private static func share(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let total = gen.int(level: level, 4...10, 8...20, 12...36)
        let part = gen.int(1...(total - 1))
        let divisor = T.gcd(part, total)
        guard level == 3 ? divisor > 1 : divisor == 1, part * 2 != total else { return nil }
        let fraction = Q(part, total)
        let question: String
        switch gen.int(0...3) {
        case 0: question = "Eine Urne enthält \(total) Kugeln, \(part) davon sind rot.\nWelcher Bruchteil der Kugeln ist rot?"
        case 1: question = "In einer Klasse mit \(total) Kindern kommen \(part) mit dem Fahrrad.\nWelcher Bruchteil der Klasse ist das?"
        case 2: question = "Ein Kuchen ist in \(total) gleich große Stücke geschnitten, \(part) sind gegessen.\nWelcher Bruchteil ist gegessen?"
        default: question = "Lena hat \(part) von \(total) Aufgaben richtig gelöst.\nWelcher Bruchteil ist richtig?"
        }
        return .number(
            prompt: question + (level == 3 ? "\nGib den Bruch vollständig gekürzt an." : ""),
            answer: fraction,
            style: .fraction,
            hint: "Gib den Bruch an, zum Beispiel 3/8.",
            wrong: [Q(total - part, total), Q(total, part), Q(part, total - part), Q(part, total + part)].filter { !$0.isWhole },
            typedPrompt: question,
            pair: "\(part) von \(total)",
            solution: divisor > 1
                ? "\(part) von \(total) ist \(part)/\(total) = \(T.fraction(fraction))"
                : "\(part) von \(total) ist \(part)/\(total)",
            explanation: "Der Nenner zählt alle gleichen Teile, der Zähler die Teile, um die es geht."
        )
    }

    /// "Schreibe 2 3/5 als unechten Bruch."
    private static func mixedToImproper(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        // A numerator of 1 makes most typical mistakes come out the same, so the numerator is at least 2.
        let denominator = gen.int(level: level, 3...5, 3...9, 5...12)
        let numerator = gen.int(2...(denominator - 1))
        guard T.gcd(numerator, denominator) == 1 else { return nil }
        let whole = gen.int(level: level, 1...3, 2...6, 3...9)
        let top = whole * denominator + numerator
        let mixed = "\(whole) \(numerator)/\(denominator)"
        return .number(
            prompt: "Schreibe \(mixed) als unechten Bruch.",
            answer: Q(top, denominator),
            style: .fraction,
            hint: "",
            wrong: [
                Q(whole * numerator + denominator, denominator),
                Q(top, numerator),
                Q(whole + numerator, denominator),
                Q(whole * denominator - numerator, denominator),
                Q(numerator * denominator + whole, denominator),
            ].filter { !$0.isWhole },
            typedPrompt: "Schreibe \(mixed) als unechten Bruch mit dem Nenner \(denominator).\nWie lautet der Zähler?",
            typedAnswer: Q(top),
            pair: mixed,
            solution: "\(mixed) = (\(whole) · \(denominator) + \(numerator))/\(denominator) = \(top)/\(denominator)",
            explanation: "Ganze mal Nenner plus Zähler ergibt den neuen Zähler; der Nenner bleibt."
        )
    }

    /// "Schreibe 13/5 als gemischte Zahl."
    private static func improperToMixed(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let denominator = gen.int(level: level, 2...5, 3...9, 5...12)
        let numerator = gen.int(1...(denominator - 1))
        guard T.gcd(numerator, denominator) == 1 else { return nil }
        let whole = gen.int(level: level, 1...3, 2...6, 3...9)
        let top = whole * denominator + numerator
        let improper = "\(top)/\(denominator)"
        let correct = Q(top, denominator)
        var extra: [MathMiddleProblem.Wrong] = [
            .init(text: "\(whole + 1) \(numerator)/\(denominator)", value: (Q(whole + 1) + Q(numerator, denominator)).value),
            .init(text: "\(whole) \(numerator)/\(top)", value: (Q(whole) + Q(numerator, top)).value),
        ]
        if whole < denominator {
            extra.append(.init(text: "\(numerator) \(whole)/\(denominator)", value: (Q(numerator) + Q(whole, denominator)).value))
        }
        if whole >= 2 {
            extra.append(.init(text: "\(whole - 1) \(numerator)/\(denominator)", value: (Q(whole - 1) + Q(numerator, denominator)).value))
        }
        let askWhole = gen.chance(50)
        return .number(
            prompt: "Schreibe \(improper) als gemischte Zahl.",
            answer: correct,
            style: .mixed,
            hint: "",
            wrong: [],
            extraWrong: extra,
            typedPrompt: askWhole
                ? "Wie viele ganze Einheiten stecken in \(improper)?"
                : "Schreibe \(improper) als gemischte Zahl.\nWie lautet der Zähler des Bruchteils?",
            typedAnswer: Q(askWhole ? whole : numerator),
            pair: improper,
            solution: "\(top) : \(denominator) = \(whole) Rest \(numerator), also \(whole) \(numerator)/\(denominator)",
            explanation: "Teile den Zähler durch den Nenner: Das Ergebnis sind die Ganzen, der Rest ist der neue Zähler."
        )
    }

    // Lesson 2

    /// "3/4 = ?/20" or "18/24 = 3/?": the same number with the numerator and denominator changed by one factor.
    private static func equivalent(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let baseDenominator = gen.int(level: level, 2...6, 3...9, 4...12)
        let baseNumerator = gen.int(1...(baseDenominator - 1))
        guard T.gcd(baseNumerator, baseDenominator) == 1 else { return nil }
        let factor = gen.int(level: level, 2...5, 2...9, 3...12)
        let reduces = level > 1 && gen.chance(40)
        let (a, b) = reduces ? (baseNumerator * factor, baseDenominator * factor) : (baseNumerator, baseDenominator)
        let (c, d) = reduces ? (baseNumerator, baseDenominator) : (baseNumerator * factor, baseDenominator * factor)
        let blankNumerator = gen.chance(50)
        let equation = blankNumerator ? "\(a)/\(b) = ?/\(d)" : "\(a)/\(b) = \(c)/?"
        let answer = blankNumerator ? c : d
        let shifted: Int
        let unchanged: Int
        let copied: Int
        let crossed: Int
        if blankNumerator {
            shifted = a + (d - b)
            unchanged = a
            copied = d
            crossed = a * d
        } else {
            shifted = b + (c - a)
            unchanged = b
            copied = c
            crossed = b * c
        }
        let verb = reduces ? "gekürzt" : "erweitert"
        return .number(
            prompt: "Welche Zahl gehört auf das Fragezeichen?\n\(equation)",
            answer: Q(answer),
            hint: "Gib nur die fehlende Zahl an.",
            wrong: [Q(shifted), Q(unchanged), Q(copied), Q(crossed)].filter { $0.numerator > 0 },
            typedPrompt: "Welche Zahl gehört auf das Fragezeichen?\n\(equation)",
            pair: equation,
            solution: "Der Bruch wird mit \(factor) \(verb): \(a)/\(b) = \(c)/\(d)",
            explanation: "Zähler und Nenner müssen mit derselben Zahl multipliziert (erweitern) oder durch dieselbe Zahl geteilt (kürzen) werden."
        )
    }

    /// "Kürze vollständig: 18/24". The typical mistakes: stopping early, subtracting, reducing only one part.
    private static func reduce(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let denominator = gen.int(level: level, 3...6, 4...9, 5...12)
        let numerator = gen.int(1...(denominator - 1))
        guard T.gcd(numerator, denominator) == 1 else { return nil }
        let divisor = gen.int(level: level, 2...5, 3...9, 6...12)
        let a = numerator * divisor
        let b = denominator * divisor
        let reduced = Q(numerator, denominator)
        // Divisors that stop short of the greatest one: the typical "not reduced all the way".
        let stops = (2..<divisor).filter { divisor % $0 == 0 }
        var wrong: [MathMiddleProblem.Wrong] = []
        if let stop = stops.isEmpty ? nil : gen.pick(stops) {
            wrong.append(.init(text: "\(a / stop)/\(b / stop)", value: reduced.value))
        }
        if b - divisor > 0, a - divisor > 0 {
            wrong.append(.init(text: "\(a - divisor)/\(b - divisor)", value: Q(a - divisor, b - divisor).value))
        }
        wrong.append(.init(text: "\(numerator)/\(b)", value: Q(numerator, b).value))
        wrong.append(.init(text: "\(a)/\(denominator)", value: Q(a, denominator).value))
        wrong.append(.init(text: "\(denominator)/\(numerator)", value: Q(denominator, numerator).value))
        var problem = MathMiddleProblem.text(
            prompt: "Kürze vollständig:\n\(a)/\(b)",
            correct: "\(numerator)/\(denominator)",
            wrong: [],
            typed: .init(
                prompt: "Du kürzt \(a)/\(b) so weit wie möglich.\nDurch welche Zahl teilst du dafür Zähler und Nenner?\nGib die Zahl an.",
                answer: Rational(divisor)
            ),
            pair: "\(a)/\(b)",
            solution: "ggT(\(a), \(b)) = \(divisor); \(a) : \(divisor) = \(numerator) und \(b) : \(divisor) = \(denominator), also \(numerator)/\(denominator)",
            explanation: "Kürze mit dem größten gemeinsamen Teiler von Zähler und Nenner; dann geht es nicht weiter."
        )
        problem.correctValue = reduced.value
        problem.wrong = wrong
        problem.allowsEquivalentWrong = true
        problem.pairPrompt = "Kürze vollständig und ordne zu."
        return problem
    }

    /// "Welcher Bruch lässt sich nicht mehr kürzen?" One fraction is different from the three others.
    private static func isReduced(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let limit = level == 1 ? 12 : (level == 2 ? 20 : 40)
        let asksReducible = gen.chance(35)
        func fraction(coprime: Bool) -> (Int, Int)? {
            for _ in 0..<40 {
                let b = gen.int(4...limit)
                let a = gen.int(2...(b - 1))
                if (T.gcd(a, b) == 1) == coprime { return (a, b) }
            }
            return nil
        }
        // The odd one out, then three of the other kind.
        guard let odd = fraction(coprime: !asksReducible) else { return nil }
        var others: [(Int, Int)] = []
        var seen: Set<String> = ["\(odd.0)/\(odd.1)"]
        for _ in 0..<30 where others.count < 3 {
            if let candidate = fraction(coprime: asksReducible), seen.insert("\(candidate.0)/\(candidate.1)").inserted { others.append(candidate) }
        }
        guard others.count == 3 else { return nil }
        let oddText = "\(odd.0)/\(odd.1)"
        let divisor = T.gcd(odd.0, odd.1)
        let solution = asksReducible
            ? "ggT(\(odd.0), \(odd.1)) = \(divisor), also \(oddText) = \(T.fraction(Q(odd.0, odd.1)))"
            : "ggT(\(odd.0), \(odd.1)) = 1, also lässt sich \(oddText) nicht weiter kürzen"
        return .text(
            prompt: asksReducible ? "Welcher Bruch lässt sich noch kürzen?" : "Welcher Bruch lässt sich nicht mehr kürzen?",
            correct: oddText,
            wrong: others.map { "\($0.0)/\($0.1)" },
            solution: solution,
            explanation: "Ein Bruch ist vollständig gekürzt, wenn Zähler und Nenner außer der 1 keinen gemeinsamen Teiler haben."
        )
    }

    // Lesson 3

    /// "Welcher Bruch ist größer: 5/8 oder 7/12?"
    private static func compare(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let b: Int
        let d: Int
        let a: Int
        let c: Int
        switch level {
        case 1:
            b = gen.int(4...12)
            d = b
            a = gen.int(1...(b - 1))
            c = gen.int(1...(b - 1))
        case 2:
            b = gen.pick([2, 3, 4, 5, 6])
            d = b * gen.int(2...4)
            a = gen.int(1...(b - 1))
            c = gen.int(1...(d - 1))
        default:
            b = gen.int(3...12)
            d = gen.int(3...12)
            guard b != d, T.gcd(b, d) < min(b, d) else { return nil }
            a = gen.int(1...(b - 1))
            c = gen.int(1...(d - 1))
        }
        let left = Q(a, b)
        let right = Q(c, d)
        guard left != right else { return nil }
        let common = T.lcm(b, d)
        let leftTop = a * (common / b)
        let rightTop = c * (common / d)
        let leftText = "\(a)/\(b)"
        let rightText = "\(c)/\(d)"
        let leftIsLarger = left > right
        let larger = leftIsLarger ? leftText : rightText
        let smaller = leftIsLarger ? rightText : leftText
        var problem = MathMiddleProblem.text(
            prompt: "Welcher Bruch ist größer?\n\(leftText) oder \(rightText)",
            correct: larger,
            wrong: [smaller, "Beide sind gleich groß."],
            typed: .init(
                prompt: "Bringe \(leftText) und \(rightText) auf den Nenner \(common).\nWie lautet der größere der beiden Zähler?",
                answer: Rational(max(leftTop, rightTop))
            ),
            pair: "\(leftText) oder \(rightText)",
            solution: "Nenner \(common): \(leftText) = \(leftTop)/\(common) und \(rightText) = \(rightTop)/\(common), also ist \(larger) größer",
            explanation: "Bring Brüche auf denselben Nenner; dann entscheidet der Zähler, welcher Bruch größer ist."
        )
        problem.pairPrompt = "Ordne jedem Paar den größeren Bruch zu."
        return problem
    }

    /// "Ordne der Größe nach, der kleinste zuerst: 3/4, 1/2, 5/6"
    private static func order(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        var fractions: [(Int, Int)] = []
        switch level {
        case 1:
            // The same numerator: the bigger the denominator, the smaller the fraction.
            let numerator = gen.int(1...3)
            let denominators = gen.shuffled([4, 5, 6, 8, 10]).prefix(3)
            fractions = denominators.map { (numerator, $0) }
        case 2:
            let family = gen.pick([[2, 4, 8], [3, 6, 12], [5, 10, 20], [2, 4, 6], [4, 8, 16]])
            fractions = family.map { (gen.int(1...($0 - 1)), $0) }
        default:
            let family = gen.pick([[3, 4, 6], [4, 5, 10], [6, 8, 12], [3, 5, 15], [4, 6, 12], [2, 3, 5]])
            fractions = family.map { (gen.int(1...($0 - 1)), $0) }
        }
        let values = fractions.map { Q($0.0, $0.1) }
        guard Set(values).count == 3 else { return nil }
        let ascending = fractions.enumerated().sorted { values[$0.offset] < values[$1.offset] }.map { $0.element }
        func join(_ list: [(Int, Int)]) -> String { list.map { "\($0.0)/\($0.1)" }.joined(separator: " < ") }
        let correct = join(ascending)
        // The typical mistakes: judging by the numerator or by the denominator alone, or the order the wrong way round.
        let byNumerator = fractions.sorted { $0.0 < $1.0 || ($0.0 == $1.0 && $0.1 < $1.1) }
        let byDenominator = fractions.sorted { $0.1 < $1.1 || ($0.1 == $1.1 && $0.0 < $1.0) }
        let byDenominatorDown = fractions.sorted { $0.1 > $1.1 || ($0.1 == $1.1 && $0.0 < $1.0) }
        var wrong: [String] = []
        for candidate in [join(byDenominatorDown), join(byNumerator), join(byDenominator), join(ascending.reversed())]
        where candidate != correct && !wrong.contains(candidate) {
            wrong.append(candidate)
        }
        // With equal numerators there are fewer typical mistakes; the other orders of the same fractions fill up.
        if wrong.count < 3 {
            let permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
            for permutation in gen.shuffled(permutations) where wrong.count < 3 {
                let candidate = join(permutation.map { fractions[$0] })
                if candidate != correct, !wrong.contains(candidate) { wrong.append(candidate) }
            }
        }
        let shownParts = gen.shuffled(fractions).map { "\($0.0)/\($0.1)" }
        let shown = shownParts.joined(separator: ", ")
        let common = fractions.map(\.1).reduce(1, T.lcm)
        let expanded = ascending.map { "\($0.0)/\($0.1) = \($0.0 * (common / $0.1))/\(common)" }.joined(separator: ", ")
        let middle = ascending[1]
        return .text(
            prompt: "Ordne der Größe nach, der kleinste zuerst:\n\(shown)",
            correct: correct,
            wrong: wrong,
            typed: .init(
                prompt: "Bringe \(shownParts[0]), \(shownParts[1]) und \(shownParts[2]) auf den Nenner \(common).\nWie lautet der mittlere der drei Zähler?",
                answer: Rational(middle.0 * (common / middle.1))
            ),
            solution: "Nenner \(common): \(expanded). Also \(correct)",
            explanation: "Auf denselben Nenner gebracht, ist der Bruch mit dem größeren Zähler der größere."
        )
    }

    /// "Welcher Bruch liegt zwischen 1/3 und 1/2?" The right one is in the middle; the wrong ones lie just outside.
    private static func between(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let lower: Q
        let upper: Q
        switch level {
        case 1:
            let d = gen.int(8...12)
            let a = gen.int(3...(d - 5))
            lower = Q(a, d)
            upper = Q(a + 2, d)
        case 2:
            let pairs = [(1, 3, 1, 2), (1, 4, 1, 3), (1, 5, 1, 4), (2, 5, 1, 2), (1, 6, 1, 4), (3, 4, 5, 6), (1, 2, 3, 4), (2, 3, 3, 4)]
            let p = gen.pick(pairs)
            lower = Q(p.0, p.1)
            upper = Q(p.2, p.3)
        default:
            let pairs = [(3, 5, 2, 3), (5, 8, 2, 3), (3, 7, 1, 2), (4, 9, 1, 2), (5, 6, 6, 7), (7, 8, 8, 9), (2, 5, 3, 7), (3, 8, 2, 5)]
            let p = gen.pick(pairs)
            lower = Q(p.0, p.1)
            upper = Q(p.2, p.3)
        }
        guard lower < upper else { return nil }
        let middle = (lower + upper) / 2
        let gap = upper - lower
        let wrong = [lower - gap / 2, upper + gap / 2, upper + gap, lower - gap]
        guard middle.ok, wrong.allSatisfy({ $0.ok && $0.value.numerator > 0 }) else { return nil }
        let common = T.lcm(lower.denominator, upper.denominator)
        let step = common * 2
        let solution = "Nenner \(step): \(T.fraction(lower)) = \(lower.numerator * (step / lower.denominator))/\(step) und "
            + "\(T.fraction(upper)) = \(upper.numerator * (step / upper.denominator))/\(step); dazwischen liegt \(T.fraction(middle))"
        return .number(
            prompt: "Welcher Bruch liegt zwischen \(T.fraction(lower)) und \(T.fraction(upper))?",
            answer: middle,
            style: .fraction,
            hint: "",
            wrong: wrong,
            solution: solution,
            explanation: "Bringe beide Brüche auf einen Nenner; ein Bruch dazwischen hat dort einen Zähler zwischen den beiden Zählern."
        )
    }
}
