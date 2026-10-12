import Foundation

private typealias Q = MathMiddleQ
private typealias T = MathMiddleText

/// Unit 3, Dezimalzahlen und Prozent: Brüche, Dezimalzahlen und Prozent ineinander umrechnen (lesson 1), Prozentwert,
/// Prozentsatz und Grundwert (2), Zu- und Abnahme (3).
enum MathMiddleUnit03 {
    static let templates: [MathMiddleTemplate] = [
        MathMiddleTemplate("u03.fractionToPercent", lesson: 1, forms: [.choice, .typed, .pairs], make: fractionToPercent),
        MathMiddleTemplate("u03.percentToDecimal", lesson: 1, forms: [.choice, .typed, .pairs], make: percentToDecimal),
        MathMiddleTemplate("u03.decimalCalc", lesson: 1, forms: [.choice, .typed, .pairs], make: decimalCalc),
        MathMiddleTemplate("u03.percentValue", lesson: 2, forms: [.choice, .typed, .pairs], make: percentValue),
        MathMiddleTemplate("u03.percentRate", lesson: 2, forms: [.choice, .typed, .pairs], make: percentRate),
        MathMiddleTemplate("u03.baseValue", lesson: 2, forms: [.choice, .typed], make: baseValue),
        MathMiddleTemplate("u03.priceChange", lesson: 3, forms: [.choice, .typed, .pairs], make: priceChange),
        MathMiddleTemplate("u03.percentChange", lesson: 3, forms: [.choice, .typed], make: percentChange),
        MathMiddleTemplate("u03.growthFactor", lesson: 3, forms: [.choice, .typed, .pairs], make: growthFactor),
        MathMiddleTemplate("u03.vat", lesson: 3, forms: [.choice, .typed], make: vat),
    ]

    private static func scale(_ places: Int) -> Int {
        var result = 1
        for _ in 0..<places { result *= 10 }
        return result
    }

    /// Whether the number has at most `places` digits after the decimal comma.
    private static func fits(_ q: Q, places: Int) -> Bool {
        q.ok && scale(places) % q.denominator == 0
    }

    /// The digits after the comma a terminating decimal needs.
    private static func decimalPlaces(_ q: Q) -> Int {
        var places = 0
        while scale(places) % q.denominator != 0, places < 9 { places += 1 }
        return places
    }

    private static func percent(_ q: Q) -> String { T.number(q) + " %" }

    /// Two numbers calculated digit by digit with no carry (adding, digits mod 10) or no borrow (subtracting, the smaller
    /// digit from the larger): the mistake of writing 7 − 2 under the tenth when the tenth of the minuend is smaller.
    private static func digitwise(_ a: Int, _ b: Int, subtract: Bool) -> Int {
        var (x, y, factor, result) = (a, b, 1, 0)
        while x > 0 || y > 0 {
            let (dx, dy) = (x % 10, y % 10)
            result += (subtract ? abs(dx - dy) : (dx + dy) % 10) * factor
            (x, y, factor) = (x / 10, y / 10, factor * 10)
        }
        return result
    }

    /// An amount with its unit; money gets cents.
    private static func amount(_ q: Q, _ unit: String) -> String {
        unit == "€" ? T.euroAmount(q) : T.number(q) + " " + unit
    }

    // Lesson 1

    /// "Wie viel Prozent sind 3/4?" or "... 0,35?"
    private static func fractionToPercent(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let source: Q
        var isFraction = true
        switch level {
        case 1:
            source = gen.properFraction([2, 4, 5, 10])
        case 2:
            if gen.chance(50) {
                source = gen.properFraction([4, 5, 20, 25, 50])
            } else {
                isFraction = false
                source = Q(gen.int(1...19) * 5, 100)
            }
        default:
            if gen.chance(60) {
                source = gen.properFraction([8, 16, 40, 80])
            } else {
                isFraction = false
                source = Q(gen.int(1...79) * 5, 1000)
            }
        }
        let rate = source * 100
        guard rate.ok, fits(rate, places: 2), !rate.isZero else { return nil }
        let text = isFraction ? T.fraction(source) : T.number(source)
        // The mistakes: no times 100, the rest to 100 %, the comma one place off, the digits of the fraction read together.
        var wrong: [Q] = [source, Q(100) - rate, rate / 10]
        if rate < Q(100) { wrong.append(rate * 10) }
        if isFraction, source.numerator * 10 + source.denominator < 100 { wrong.append(Q(source.numerator * 10 + source.denominator)) }
        return .number(
            prompt: "Wie viel Prozent sind \(text)?",
            answer: rate,
            style: .percent,
            hint: "Gib die Prozentzahl ohne %-Zeichen an.",
            wrong: wrong.filter { $0.ok && fits($0, places: 3) },
            pair: text,
            solution: "\(text) · 100 % = \(percent(rate))",
            explanation: "Prozent heißt Hundertstel: Rechne den Anteil mal 100, oder erweitere den Bruch auf den Nenner 100."
        )
    }

    /// "Schreibe 7 % als Dezimalzahl."
    private static func percentToDecimal(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let rate: Q
        switch level {
        case 1: rate = Q(gen.pick([1, 5, 10, 20, 25, 30, 40, 50, 60, 75, 80, 90]))
        case 2: rate = Q(gen.pick([2, 3, 7, 8, 12, 15, 35, 45, 65, 95, 105, 110, 125, 150, 200]))
        default: rate = Q(gen.pick([5, 15, 25, 35, 45, 75, 125, 375]), 10)
        }
        let value = rate / 100
        guard value.ok, fits(value, places: 4) else { return nil }
        return .number(
            prompt: "Schreibe \(percent(rate)) als Dezimalzahl.",
            answer: value,
            hint: "Gib die Dezimalzahl an.",
            wrong: [rate / 10, rate, rate / 1000].filter { $0.ok && fits($0, places: 5) },
            pair: percent(rate),
            solution: "\(percent(rate)) = \(T.number(rate))/100 = \(T.number(value))",
            explanation: "Durch 100 teilen heißt, das Komma um zwei Stellen nach links zu schieben."
        )
    }

    private enum Operation { case add, subtract, multiply, divide }

    /// "2,4 + 1,75", "0,6 · 0,5", "7,5 : 0,25": decimals calculated with the comma in the right place.
    private static func decimalCalc(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let operations: [Operation] = level == 1
            ? [.add, .subtract]
            : (level == 2 ? [.add, .subtract, .multiply, .multiply] : [.multiply, .divide, .divide, .subtract])
        let operation = gen.pick(operations)
        switch operation {
        case .add, .subtract:
            // Level 1 has the same number of places; later ones mix one and two places, so the comma has to be placed.
            let digitsA = gen.int(level == 3 ? 101...999 : 11...99)
            let digitsB = gen.int(11...99)
            let placesA = level == 1 ? 1 : (level == 3 ? 2 : 1)
            let placesB = level == 1 ? 1 : (level == 3 ? 1 : 2)
            var first = Q(digitsA, scale(placesA))
            var second = Q(digitsB, scale(placesB))
            var (firstDigits, secondDigits) = (digitsA, digitsB)
            var (firstPlaces, secondPlaces) = (placesA, placesB)
            if operation == .subtract, first < second {
                swap(&first, &second)
                swap(&firstDigits, &secondDigits)
                swap(&firstPlaces, &secondPlaces)
            } else if operation == .add, gen.chance(50) {
                swap(&first, &second)
                swap(&firstDigits, &secondDigits)
                swap(&firstPlaces, &secondPlaces)
            }
            let result = operation == .add ? first + second : first - second
            guard result.ok, !result.isZero, !result.isNegative else { return nil }
            let places = max(firstPlaces, secondPlaces)
            // Both numbers with the same number of places, as integers.
            let scaledFirst = firstDigits * scale(places - firstPlaces)
            let scaledSecond = secondDigits * scale(places - secondPlaces)
            // The digits written under each other from the right, ignoring where the comma is.
            let misaligned = operation == .add ? Q(firstDigits + secondDigits, scale(places)) : Q(firstDigits - secondDigits, scale(places))
            let slipped = Q(digitwise(scaledFirst, scaledSecond, subtract: operation == .subtract), scale(places))
            let symbol = operation == .add ? "+" : "−"
            let working = "\(T.fixed(first, places: places)) \(symbol) \(T.fixed(second, places: places)) = \(T.fixed(result, places: places)) (Komma unter Komma)"
            return finish(first, second, symbol, result, [slipped, misaligned, result + 1, result - 1, result * 10, result / 10], working)
        case .multiply:
            let first: Q
            let second: Q
            if level == 2 {
                first = gen.chance(50) ? Q(gen.int(2...9), 10) : Q(gen.int(12...49), 10)
                second = first.denominator == 10 && first.numerator > 9 ? Q(gen.int(3...9)) : Q(gen.int(2...9), 10)
            } else {
                first = Q(gen.int(11...49), 100)
                second = Q(gen.int(2...9), 10)
            }
            let result = first * second
            guard result.ok, fits(result, places: 3), result.double < 100 else { return nil }
            let (firstPlaces, secondPlaces) = (decimalPlaces(first), decimalPlaces(second))
            let firstDigits = (first * Q(scale(firstPlaces))).numerator
            let secondDigits = (second * Q(scale(secondPlaces))).numerator
            let working = "\(firstDigits) · \(secondDigits) = \(firstDigits * secondDigits); zusammen \(firstPlaces + secondPlaces) Stellen nach dem Komma: \(T.number(result))"
            return finish(first, second, "·", result, [first + second, result * 10, result / 10, result * 100, result / 100], working)
        case .divide:
            let divisor = gen.pick([Q(5, 10), Q(25, 100), Q(2, 10), Q(12, 10), Q(4, 100), Q(6, 100), Q(15, 10), Q(3, 10), Q(25, 10), Q(15, 100)])
            let quotient = Q(gen.int(2...30), gen.pick([1, 1, 2]))
            let dividend = divisor * quotient
            guard dividend.ok, fits(dividend, places: 3), dividend.double <= 100 else { return nil }
            let shift = decimalPlaces(divisor)
            let working = "\(T.number(dividend)) : \(T.number(divisor)) = \(T.number(dividend * Q(scale(shift)))) : \(T.number(divisor * Q(scale(shift)))) = \(T.number(quotient)) (beide Kommas um \(shift) Stellen verschoben)"
            return finish(dividend, divisor, ":", quotient, [dividend - divisor, quotient * 10, quotient / 10, quotient / 100, quotient * 100], working)
        }
    }

    private static func finish(_ first: Q, _ second: Q, _ symbol: String, _ result: Q, _ wrong: [Q], _ working: String) -> MathMiddleProblem? {
        let expression = "\(T.number(first)) \(symbol) \(T.number(second))"
        return .number(
            prompt: "Berechne:\n\(expression)",
            answer: result,
            hint: "Gib das Ergebnis als Dezimalzahl an.",
            wrong: wrong.filter { $0.ok && !$0.isNegative && fits($0, places: 6) },
            pair: expression,
            solution: working,
            explanation: "Beim Addieren und Subtrahieren steht Komma unter Komma. Beim Multiplizieren zählst du die Nachkommastellen, beim Dividieren verschiebst du beide Kommas gleich weit."
        )
    }

    // Lesson 2

    private static let units = ["€", "kg", "m", "l"]

    /// "Wie viel sind 15 % von 80 €?"
    private static func percentValue(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let rate = Q(level == 1 ? gen.pick([5, 10, 20, 25, 50, 75]) : (level == 2 ? gen.pick([2, 8, 12, 15, 30, 35, 40, 60, 65, 90]) : gen.int(1...99)))
        let base = Q(level == 1 ? gen.pick([20, 40, 60, 80, 100, 120, 200]) : gen.pick([40, 60, 80, 120, 150, 200, 250, 300, 400, 500, 600]))
        let value = base * rate / 100
        guard value.ok, fits(value, places: level == 1 ? 0 : (level == 2 ? 1 : 2)), !value.isZero else { return nil }
        let unit = gen.pick(units)
        let baseText = amount(base, unit)
        let question = gen.chance(50) ? "Wie viel sind \(percent(rate)) von \(baseText)?" : "Berechne \(percent(rate)) von \(baseText)."
        return .number(
            prompt: question,
            answer: value,
            style: unit == "€" ? .euro : .unit(unit),
            hint: "Gib nur die Zahl an.",
            wrong: [rate * base / 10, value / 10, base - value, base / rate].filter { $0.ok && fits($0, places: 3) },
            pair: "\(percent(rate)) von \(baseText)",
            solution: "\(T.number(base)) · \(T.number(rate / 100)) = \(amount(value, unit))",
            explanation: "Der Prozentwert ist der Grundwert mal Prozentsatz: W = G · p/100. 10 % sind ein Zehntel, 1 % ein Hundertstel."
        )
    }

    /// "Wie viel Prozent sind 12 von 80?"
    private static func percentRate(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let base: Int
        let part: Int
        switch level {
        case 1:
            base = gen.pick([20, 40, 50, 80, 100, 200])
            part = base * gen.pick([10, 20, 25, 50, 75]) / 100
        case 2:
            base = gen.pick([40, 50, 60, 80, 120, 150, 200, 250, 400])
            part = gen.int(1...(base - 1))
        default:
            base = gen.pick([40, 80, 120, 160, 200, 400, 800])
            part = gen.int(1...(base - 1))
        }
        let rate = Q(part * 100, base)
        guard rate.ok, fits(rate, places: level == 3 ? 1 : 0), part > 0, part < base else { return nil }
        let question: String
        switch gen.int(0...2) {
        case 0: question = "Wie viel Prozent sind \(part) von \(base)?"
        case 1: question = "Von \(base) Schülern fehlen \(part).\nWie viel Prozent fehlen?"
        default: question = "Lena erreicht \(part) von \(base) Punkten.\nWie viel Prozent sind das?"
        }
        return .number(
            prompt: question,
            answer: rate,
            style: .percent,
            hint: "Gib die Prozentzahl ohne %-Zeichen an.",
            wrong: [Q(part, base), Q(100) - rate, rate * 10, rate / 10].filter { $0.ok && fits($0, places: 4) },
            pair: "\(part) von \(base)",
            solution: "\(part) : \(base) = \(T.number(Q(part, base))) = \(percent(rate))",
            explanation: "Der Prozentsatz ist der Anteil Prozentwert : Grundwert, mal 100: p = W : G · 100."
        )
    }

    /// "15 % sind 12 €. Wie groß ist der Grundwert?"
    private static func baseValue(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let rate = Q(level == 1 ? gen.pick([10, 20, 25, 50]) : (level == 2 ? gen.pick([5, 15, 30, 40, 60, 75]) : gen.pick([8, 12, 35, 45, 65, 16, 24])))
        let base = Q(level == 1 ? gen.pick([40, 60, 80, 100, 200]) : gen.pick([40, 60, 80, 120, 150, 200, 250, 400, 500]))
        let part = base * rate / 100
        guard part.ok, fits(part, places: 2), !part.isZero else { return nil }
        let kind = gen.int(0...2)
        let unit = kind == 1 ? "€" : gen.pick(units)
        let partText = amount(part, unit)
        let question: String
        switch kind {
        case 0: question = "\(percent(rate)) einer Menge sind \(partText).\nWie groß ist die ganze Menge?"
        case 1: question = "Bei \(percent(rate)) Rabatt spart Tom \(partText).\nWie teuer war der Artikel vorher?"
        default: question = "\(partText) sind \(percent(rate)) des Grundwerts.\nWie groß ist der Grundwert?"
        }
        return .number(
            prompt: question,
            answer: base,
            style: unit == "€" ? .euro : .unit(unit),
            hint: "Gib nur die Zahl an.",
            wrong: [part * rate / 100, part + rate, part * rate, part / rate].filter { $0.ok && fits($0, places: 4) },
            solution: "1 % sind \(T.number(part / rate)), also 100 % = \(T.number(part / rate)) · 100 = \(amount(base, unit))",
            explanation: "Rechne erst auf 1 % (Prozentwert : Prozentsatz), dann auf 100 %. Der Grundwert ist das Ganze."
        )
    }

    // Lesson 3

    /// "Das Fahrrad kostet 240 €. Der Preis steigt um 15 %."
    private static func priceChange(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let rate = Q(level == 1 ? gen.pick([10, 20, 25, 50]) : (level == 2 ? gen.pick([5, 15, 30, 40, 12, 8]) : gen.pick([3, 7, 12, 18, 35, 45, 6])))
        let base = Q(level == 1 ? gen.pick([40, 60, 80, 100, 120, 200]) : gen.pick([40, 60, 80, 120, 150, 200, 250, 300, 400, 500]))
        let rises = gen.chance(50)
        let change = base * rate / 100
        let result = rises ? base + change : base - change
        guard result.ok, fits(result, places: 2), fits(change, places: 2) else { return nil }
        let (article, noun, pronoun) = gen.pick([("Das", "Fahrrad", "es"), ("Der", "Rucksack", "er"), ("Der", "Mantel", "er"), ("Der", "Tisch", "er"), ("Das", "Handy", "es")])
        let baseText = T.euroAmount(base)
        let question = rises
            ? "\(article) \(noun) kostet \(baseText). Der Preis steigt um \(percent(rate)).\nWie viel kostet \(pronoun) danach?"
            : "\(article) \(noun) kostet \(baseText). Es gibt \(percent(rate)) Rabatt.\nWie viel kostet \(pronoun) danach?"
        let absolute = rises ? base + rate : base - rate
        let opposite = rises ? base - change : base + change
        let sign = rises ? "+" : "−"
        return .number(
            prompt: question,
            answer: result,
            style: .euro,
            hint: "Gib den Preis in Euro an, ohne €.",
            wrong: [change, absolute, opposite],
            pair: "\(baseText) \(sign) \(percent(rate))",
            solution: "\(percent(rate)) von \(baseText) = \(T.euroAmount(change)); \(baseText) \(sign) \(T.euroAmount(change)) = \(T.euroAmount(result))",
            explanation: rises
                ? "Bei einer Zunahme rechnest du Grundwert plus Prozentwert, oder den Grundwert mal (1 + p/100)."
                : "Bei einer Abnahme rechnest du Grundwert minus Prozentwert, oder den Grundwert mal (1 − p/100)."
        )
    }

    /// "Der Preis steigt von 50 € auf 60 €. Um wie viel Prozent?"
    private static func percentChange(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let rate = Q(level == 1 ? gen.pick([10, 20, 25, 50]) : (level == 2 ? gen.pick([5, 15, 30, 40, 60]) : gen.pick([12, 35, 45, 8, 16, 24, 36])))
        let old = Q(level == 1 ? gen.pick([40, 50, 80, 100, 200]) : gen.pick([50, 60, 80, 100, 120, 150, 200, 250, 400]))
        let rises = gen.chance(55)
        let change = old * rate / 100
        let new = rises ? old + change : old - change
        guard new.ok, new.isWhole, change.isWhole, !rate.isZero else { return nil }
        let thing = gen.pick(["Preis", "Eintritt", "Monatsbeitrag"])
        let verb = rises ? "steigt" : "sinkt"
        let word = rises ? "Zunahme" : "Abnahme"
        // The new value taken as 100 % gives a different percentage.
        let wrongBase = change / new * 100
        return .number(
            prompt: "Der \(thing) \(verb) von \(T.euroAmount(old)) auf \(T.euroAmount(new)).\nUm wie viel Prozent \(verb) er?",
            answer: rate,
            style: .percent,
            hint: "Gib die Prozentzahl ohne %-Zeichen an.",
            wrong: [change, new / old * 100, rate / 10, wrongBase].filter { $0.ok && fits($0, places: 2) },
            solution: "\(word) um \(T.euroAmount(change)); \(T.number(change)) : \(T.number(old)) = \(T.number(change / old)) = \(percent(rate))",
            explanation: "Vergleiche die Änderung mit dem alten Wert, nicht mit dem neuen: p = Änderung : alter Wert · 100."
        )
    }

    /// "Ein Wert steigt um 8 %. Mit welchem Faktor multiplizierst du?"
    private static func growthFactor(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let rate: Q
        switch level {
        case 1: rate = Q(gen.pick([10, 20, 50, 5, 25]))
        case 2: rate = Q(gen.pick([8, 12, 15, 30, 40, 4, 6]))
        default: rate = gen.pick([Q(5, 2), Q(15, 2), Q(1, 2), Q(3), Q(7), Q(18), Q(125, 10), Q(75, 10)])
        }
        let rises = gen.chance(50)
        let factor = rises ? Q(1) + rate / 100 : Q(1) - rate / 100
        guard factor.ok, fits(factor, places: 4), !factor.isNegative, !factor.isZero else { return nil }
        let opposite = rises ? Q(1) - rate / 100 : Q(1) + rate / 100
        let verb = rises ? "steigt" : "sinkt"
        let word = rises ? "Zunahme" : "Abnahme"
        let sign = rises ? "+" : "−"
        var problem = MathMiddleProblem.number(
            prompt: "Ein Wert \(verb) um \(percent(rate)).\nMit welchem Faktor multiplizierst du ihn?",
            answer: factor,
            hint: "Gib den Faktor als Dezimalzahl an.",
            wrong: [rate / 100, opposite, rises ? Q(1) + rate / 10 : Q(1) - rate / 10, rate].filter { $0.ok && !$0.isNegative },
            pair: "\(word) um \(percent(rate))",
            solution: "1 \(sign) \(percent(rate)) = 1 \(sign) \(T.number(rate / 100)) = \(T.number(factor))",
            explanation: "Der neue Wert ist 100 % plus oder minus die Änderung: Der Faktor ist 1 \(sign) p/100."
        )
        problem?.pairPrompt = "Ordne jeder Änderung den Faktor zu."
        return problem
    }

    /// "Netto 200 €, Mehrwertsteuer 19 %": forwards at levels 1 and 2, backwards at level 3.
    private static func vat(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let rate = Q(gen.pick([19, 19, 7]))
        let net = Q(level == 1 ? gen.pick([100, 200, 300, 400, 500]) : (level == 2 ? gen.pick([50, 150, 250, 20, 40, 60, 80, 120]) : gen.pick([100, 200, 300, 400, 500, 600, 800])))
        let factor = Q(1) + rate / 100
        let gross = net * factor
        guard gross.ok, fits(gross, places: 2) else { return nil }
        if level == 3 {
            guard gross.double < 1000 else { return nil }
            return .number(
                prompt: "Ein Gerät kostet brutto \(T.euroAmount(gross)), darin sind \(percent(rate)) Mehrwertsteuer.\nWie hoch ist der Nettopreis?",
                answer: net,
                style: .euro,
                hint: "Gib den Preis in Euro an, ohne €.",
                wrong: [gross * (Q(1) - rate / 100), gross - rate, gross * rate / 100],
                solution: "Brutto sind \(T.number(Q(100) + rate)) % des Nettopreises: \(T.number(gross)) : \(T.number(factor)) = \(T.number(net)) €",
                explanation: "Der Bruttopreis ist 100 % plus Steuersatz. Teile ihn durch den Faktor, zum Beispiel 1,19. Die Steuer vom Bruttopreis abzuziehen ist falsch."
            )
        }
        let tax = net * rate / 100
        return .number(
            prompt: "Ein Gerät kostet netto \(T.euroAmount(net)). Dazu kommen \(percent(rate)) Mehrwertsteuer.\nWie hoch ist der Bruttopreis?",
            answer: gross,
            style: .euro,
            hint: "Gib den Preis in Euro an, ohne €.",
            wrong: [tax, net + rate, net * (Q(1) - rate / 100), net * rate].filter { $0.ok && $0.double < 10000 },
            solution: "Steuer: \(T.euroAmount(tax)); \(T.euroAmount(net)) + \(T.euroAmount(tax)) = \(T.euroAmount(gross))",
            explanation: "Brutto ist Netto plus Mehrwertsteuer, also Netto mal (1 + Steuersatz), zum Beispiel mal 1,19."
        )
    }
}
