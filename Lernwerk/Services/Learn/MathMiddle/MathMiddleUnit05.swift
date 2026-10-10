import Foundation

private typealias Q = MathMiddleQ
private typealias T = MathMiddleText

/// Unit 5, Dreisatz und Proportionalität: proportionale Zuordnungen und der Dreisatz (lesson 1), antiproportionale
/// Zuordnungen und das Erkennen der Art einer Zuordnung (2), Maßstab und Verhältnisse (3).
enum MathMiddleUnit05 {
    static let templates: [MathMiddleTemplate] = [
        MathMiddleTemplate("u05.proportional", lesson: 1, forms: [.choice, .typed, .pairs], make: proportional),
        MathMiddleTemplate("u05.unitRate", lesson: 1, forms: [.choice, .typed, .pairs], make: unitRate),
        MathMiddleTemplate("u05.factor", lesson: 1, forms: [.choice, .typed, .pairs], make: factor),
        MathMiddleTemplate("u05.antiproportional", lesson: 2, forms: [.choice, .typed, .pairs], make: antiproportional),
        MathMiddleTemplate("u05.tableType", lesson: 2, forms: [.choice], make: tableType),
        MathMiddleTemplate("u05.situation", lesson: 2, forms: [.choice], make: situation),
        MathMiddleTemplate("u05.tableFill", lesson: 2, forms: [.choice, .typed, .pairs], make: tableFill),
        MathMiddleTemplate("u05.scale", lesson: 3, forms: [.choice, .typed, .pairs], make: scale),
        MathMiddleTemplate("u05.ratioSplit", lesson: 3, forms: [.choice, .typed, .pairs], make: ratioSplit),
        MathMiddleTemplate("u05.ratioReduce", lesson: 3, forms: [.choice, .typed, .pairs], make: ratioReduce),
    ]

    private static let valueHint = "Gib nur die Zahl an."

    private static func eur(_ n: Int) -> String { T.euroAmount(Q(n)) }

    // Lesson 1

    /// "5 Hefte kosten 10 €. Wie viel kosten 8 Hefte?" Through the value of one, then multiplied.
    private static func proportional(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        // 0 to 2 are about money, 3 and 4 about counts and distances; the rates stay what they are in real life.
        let story = level == 3 ? gen.pick([0, 2]) : gen.int(0...4)
        let n1: Int
        let n2: Int
        let p1: Int
        switch story {
        case 0, 2:
            if level == 3 {
                n1 = gen.pick([2, 4, 5, 10, 20, 25])
                n2 = gen.int(3...30)
                p1 = gen.int(3...45)
            } else {
                n1 = level == 1 ? gen.int(2...6) : gen.pick([3, 4, 5, 6, 8, 10, 12])
                n2 = level == 1 ? gen.int(2...9) : gen.int(2...15)
                p1 = n1 * (story == 0 ? (level == 1 ? gen.int(2...9) : gen.int(2...12)) : (level == 1 ? gen.int(2...6) : gen.int(2...9)))
            }
        case 1:
            n1 = level == 1 ? gen.int(2...6) : gen.pick([3, 4, 5, 6, 8])
            n2 = gen.int(2...12)
            p1 = n1 * (level == 1 ? gen.int(8...15) : gen.int(8...20))
        case 3:
            n1 = gen.pick([2, 3, 4, 5, 6, 10])
            n2 = gen.int(2...12)
            p1 = n1 * gen.int(3...25)
        default:
            n1 = gen.int(2...4)
            n2 = gen.int(2...8)
            p1 = n1 * gen.pick([30, 40, 50, 60, 80, 90])
        }
        guard n1 != n2 else { return nil }
        let rate = Q(p1, n1)
        let answer = Q(p1 * n2, n1)
        guard answer.ok, [answer, rate].decimals(2).count == 2 else { return nil }
        let prompt: String
        let front: String
        let style: MathMiddleProblem.Style
        let unit: String
        switch story {
        case 0:
            prompt = "\(n1) Hefte kosten \(eur(p1)). Wie viel kosten \(n2) Hefte?"
            front = "\(n1) Hefte = \(eur(p1)); \(n2) Hefte?"
            style = .euro
            unit = "€"
        case 1:
            prompt = "Für \(n1) Stunden Arbeit bekommt Jonas \(eur(p1)). Wie viel bekommt er für \(n2) Stunden?"
            front = "\(n1) h = \(eur(p1)); \(n2) h?"
            style = .euro
            unit = "€"
        case 2:
            prompt = "\(n1) kg Äpfel kosten \(eur(p1)). Wie viel kosten \(n2) kg?"
            front = "\(n1) kg = \(eur(p1)); \(n2) kg?"
            style = .euro
            unit = "€"
        case 3:
            prompt = "Eine Maschine füllt in \(n1) Minuten \(p1) Flaschen. Wie viele Flaschen füllt sie in \(n2) Minuten?"
            front = "\(n1) min = \(p1) Flaschen; \(n2) min?"
            style = .plain
            unit = ""
        default:
            prompt = "Ein Zug fährt gleichmäßig \(p1) km in \(n1) Stunden. Wie weit fährt er in \(n2) Stunden?"
            front = "\(p1) km in \(n1) h; \(n2) h?"
            style = .unit("km")
            unit = "km"
        }
        let suffix = unit.isEmpty ? "" : " " + unit
        // The difference added, the rule turned around, the first value multiplied, only the value of one.
        let wrong = [Q(p1 + n2 - n1), Q(p1 * n1, n2), Q(p1 * n2), rate].decimals(2).positives
        var problem = MathMiddleProblem.number(
            prompt: prompt,
            answer: answer,
            style: style,
            hint: valueHint,
            wrong: wrong,
            pair: front,
            solution: "Für 1: \(p1) : \(n1) = \(T.number(rate))\(suffix); für \(n2): \(T.number(rate)) · \(n2) = \(T.number(answer))\(suffix)",
            explanation: "Beim Dreisatz rechnest du erst auf die Einheit (durch die bekannte Anzahl teilen) und dann auf die gesuchte Anzahl (malnehmen). Doppelt so viel gehört zum Doppelten."
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe den gesuchten Wert zu."
        return problem
    }

    /// "Wie viel kostet 1 kg, wenn 4 kg 10 € kosten?" The value of one.
    private static func unitRate(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { unitRateAttempt(level, gen) }
    }

    private static func unitRateAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let story = gen.int(0...2)
        let n: Int
        let total: Int
        switch (level, story) {
        case (1, 0): n = gen.int(2...6); total = n * gen.int(2...9)
        case (1, 1): n = gen.int(2...6); total = n * gen.int(8...25)
        case (1, _): n = gen.int(2...6); total = n * gen.int(2...9)
        case (2, 0): n = gen.pick([2, 4, 5, 10]); total = gen.int(5...80)
        case (2, 1): n = gen.pick([2, 4, 5]); total = gen.int(16...120)
        case (2, _): n = gen.pick([2, 4, 5, 10]); total = gen.int(5...80)
        case (_, 0): n = gen.pick([4, 5]); total = gen.int(5...45)
        case (_, 1): n = gen.pick([4, 5]); total = gen.int(32...99)
        default: n = gen.pick([4, 5, 20, 25, 50]); total = gen.int(5...99)
        }
        // A cyclist rides between 8 and 35 kilometres in an hour.
        if story == 1, total < 8 * n || total > 35 * n { return nil }
        let rate = Q(total, n)
        guard rate.ok, [rate].decimals(2).count == 1 else { return nil }
        let prompt: String
        let front: String
        let style: MathMiddleProblem.Style
        let unit: String
        switch story {
        case 0:
            prompt = "\(n) kg Kirschen kosten \(eur(total)). Wie viel kostet 1 kg?"
            front = "\(n) kg für \(eur(total))"
            style = .euro
            unit = "€"
        case 1:
            prompt = "Ein Radfahrer fährt \(total) km in \(n) Stunden. Wie viele Kilometer sind das pro Stunde?"
            front = "\(total) km in \(n) h"
            style = .unit("km")
            unit = "km"
        default:
            prompt = "Aus einem Hahn laufen \(total) l in \(n) Minuten. Wie viele Liter sind das pro Minute?"
            front = "\(total) l in \(n) min"
            style = .unit("l")
            unit = "l"
        }
        // The rule turned around, the two numbers multiplied, subtracted, or the total left as it is.
        let wrong = [Q(n, total), Q(total * n), Q(total - n), Q(total)].decimals(2).positives
        var problem = MathMiddleProblem.number(
            prompt: prompt,
            answer: rate,
            style: style,
            hint: valueHint,
            wrong: wrong,
            pair: front,
            solution: "\(total) : \(n) = \(T.number(rate)) \(unit)",
            explanation: "Der Wert von einem Stück ist die Gesamtmenge geteilt durch die Anzahl. Teile immer durch die Zahl, die zu 1 gehört."
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe den Wert für 1 zu."
        return problem
    }

    /// "Zu x = 4 gehört y = 10, die Zuordnung ist proportional. Wie groß ist der Proportionalitätsfaktor?"
    private static func factor(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let x: Int
        let y: Int
        switch level {
        case 1:
            x = gen.int(2...8)
            y = x * gen.int(2...9)
        case 2:
            x = gen.pick([2, 4, 5, 10])
            y = gen.int(3...60)
        default:
            x = gen.pick([4, 5, 20, 25])
            y = gen.int(3...60)
        }
        let k = Q(y, x)
        guard k.ok, k.denominator != 1 || level == 1, [k].decimals(2).count == 1, y != x else { return nil }
        let wrong = [Q(x, y), Q(y - x), Q(x * y), Q(y)].decimals(3).positives
        return .number(
            prompt: "Eine Zuordnung ist proportional. Zu x = \(x) gehört y = \(y).\nWie groß ist der Proportionalitätsfaktor?",
            answer: k,
            hint: "Gib den Faktor als Zahl an.",
            wrong: wrong,
            pair: "x = \(x), y = \(y)",
            solution: "y : x = \(y) : \(x) = \(T.number(k))",
            explanation: "Bei einer proportionalen Zuordnung ist der Quotient y : x immer gleich. Dieser Wert heißt Proportionalitätsfaktor."
        )
    }

    // Lesson 2

    /// "6 Arbeiter brauchen 8 Tage. Wie lange brauchen 4 Arbeiter?" The product stays the same.
    private static func antiproportional(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { antiproportionalAttempt(level, gen) }
    }

    private static func antiproportionalAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let product: Int
        switch level {
        case 1: product = gen.pick([12, 24, 36, 48, 60])
        case 2: product = gen.pick([24, 36, 48, 60, 72, 90, 120])
        default: product = gen.pick([30, 36, 60, 72, 90, 120, 180])
        }
        let divisors = (2...12).filter { product % $0 == 0 }
        guard divisors.count >= 2 else { return nil }
        let n1 = gen.pick(divisors)
        let n2 = gen.pick(divisors)
        guard n1 != n2 else { return nil }
        let t1 = product / n1
        let answer = Q(product, n2)
        guard level == 3 || answer.isWhole, [answer].decimals(1).count == 1, t1 >= 2, answer.double >= 2 else { return nil }
        let story = gen.int(0...3)
        let prompt: String
        let front: String
        let style: MathMiddleProblem.Style
        let unit: String
        switch story {
        case 0:
            prompt = "\(n1) Arbeiter brauchen für ein Dach \(t1) Tage. Wie viele Tage brauchen \(n2) Arbeiter (gleich schnell)?"
            front = "\(n1) Arbeiter: \(t1) Tage; \(n2) Arbeiter?"
            style = .unit("Tage")
            unit = "Tage"
        case 1:
            prompt = "\(n1) gleiche Pumpen füllen ein Becken in \(t1) Stunden. Wie lange brauchen \(n2) Pumpen?"
            front = "\(n1) Pumpen: \(t1) h; \(n2) Pumpen?"
            style = .unit("Stunden")
            unit = "Stunden"
        case 2:
            prompt = "Ein Futtervorrat reicht für \(n1) Pferde \(t1) Tage. Wie lange reicht er für \(n2) Pferde?"
            front = "\(n1) Pferde: \(t1) Tage; \(n2) Pferde?"
            style = .unit("Tage")
            unit = "Tage"
        default:
            prompt = "\(n1) Freunde teilen sich die Kosten für ein Boot, jeder zahlt \(eur(t1)). Wie viel zahlt jeder bei \(n2) Freunden?"
            front = "\(n1) Freunde zahlen je \(eur(t1)); \(n2) Freunde?"
            style = .euro
            unit = "€"
        }
        // The rule for proportional zuordnungen used, the difference subtracted or added, the product left as it is.
        let wrong = [
            Q(t1 * n2, n1), Q(t1 - (n2 - n1)), Q(t1 + (n2 - n1)), Q(product),
        ].decimals(2).positives
        var problem = MathMiddleProblem.number(
            prompt: prompt,
            answer: answer,
            style: style,
            hint: valueHint,
            wrong: wrong,
            pair: front,
            solution: "\(n1) · \(t1) = \(product); \(product) : \(n2) = \(T.number(answer)) \(unit)",
            explanation: "Hier ist das Produkt immer gleich: Doppelt so viele brauchen halb so lange. Rechne erst das Ganze aus (Anzahl mal Wert) und teile dann durch die neue Anzahl."
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe den gesuchten Wert zu."
        return problem
    }

    /// "Welche Zuordnung beschreibt die Tabelle?" proportional, antiproportional or neither.
    private static func tableType(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { tableTypeAttempt(level, gen) }
    }

    private static func tableTypeAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let kind = level == 1 ? gen.pick([0, 0, 1, 2]) : gen.int(0...2)
        let xs: [Int]
        let ys: [Int]
        switch kind {
        case 0:
            xs = gen.shuffled(level == 1 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 8, 10]).prefix(3).sorted()
            let k = gen.int(2...9)
            ys = xs.map { $0 * k }
        case 1:
            let product = gen.pick([12, 24, 36, 60, 120])
            let divisors = (1...12).filter { product % $0 == 0 }
            guard divisors.count >= 3 else { return nil }
            xs = gen.shuffled(divisors).prefix(3).sorted()
            ys = xs.map { product / $0 }
        default:
            xs = gen.shuffled([1, 2, 3, 4, 5, 6, 8, 10]).prefix(3).sorted()
            switch gen.int(0...2) {
            case 0:
                // y = kx + b: grows evenly but does not start at zero.
                let k = gen.int(1...5)
                let b = gen.int(1...9)
                ys = xs.map { $0 * k + b }
            case 1:
                // y = x + b, the plain "plus" rule.
                let b = gen.int(2...9)
                ys = xs.map { $0 + b }
            default:
                // y = x²: grows faster and faster.
                guard level >= 2 else { return nil }
                ys = xs.map { $0 * $0 }
            }
        }
        // Whatever the kind, it must be that one and no other.
        let ratios = Set(zip(xs, ys).map { Q($1, $0) })
        let products = Set(zip(xs, ys).map { $0 * $1 })
        let proportional = ratios.count == 1
        let anti = products.count == 1
        guard !(proportional && anti), proportional == (kind == 0), anti == (kind == 1) else { return nil }
        let names = ["proportional", "antiproportional", "weder noch"]
        let quotients = zip(xs, ys).map { T.number(Q($1, $0)) }.joined(separator: "; ")
        let multiples = zip(xs, ys).map { String($0 * $1) }.joined(separator: "; ")
        let reason: String
        switch kind {
        case 0: reason = "Die Quotienten y : x sind alle gleich (\(quotients)), also proportional."
        case 1: reason = "Die Produkte x · y sind alle gleich (\(multiples)), also antiproportional."
        default: reason = "Weder die Quotienten (\(quotients)) noch die Produkte (\(multiples)) sind gleich."
        }
        return .text(
            prompt: "Welche Zuordnung beschreibt die Tabelle?\nx: \(xs.map(String.init).joined(separator: ", "))\ny: \(ys.map(String.init).joined(separator: ", "))",
            correct: names[kind],
            wrong: names.enumerated().filter { $0.offset != kind }.map(\.element),
            solution: reason,
            explanation: "Proportional: y : x ist immer gleich. Antiproportional: x · y ist immer gleich. Trifft keins von beiden zu, ist es weder noch."
        )
    }

    private static let proportionalSituations = [
        "Anzahl der Brötchen → Gesamtpreis (jedes kostet gleich viel)",
        "Fahrzeit → zurückgelegte Strecke (gleichbleibende Geschwindigkeit)",
        "Seitenlänge eines Quadrats → Umfang des Quadrats",
        "getankte Liter → Preis (fester Preis je Liter)",
        "Anzahl der Kopien → Kosten (fester Preis je Kopie)",
        "Anzahl gleicher Hefte → Gewicht aller Hefte",
    ]

    private static let antiproportionalSituations = [
        "Anzahl der Arbeiter → Zeit für dieselbe Arbeit (alle gleich schnell)",
        "Geschwindigkeit → Fahrzeit für dieselbe Strecke",
        "Anzahl der Personen → Anteil jeder Person an einem festen Betrag",
        "Anzahl der Pumpen → Zeit, um dasselbe Becken zu füllen",
        "Anzahl der Fahrgäste → Fahrpreis je Person bei festen Busmiete",
        "Anzahl der Tage → Tagesration eines festen Vorrats",
    ]

    private static let otherSituations = [
        "Alter eines Kindes → Körpergröße",
        "Seitenlänge eines Quadrats → Flächeninhalt",
        "gefahrene Kilometer → Taxipreis mit Grundgebühr",
        "Uhrzeit → Außentemperatur",
        "Anzahl gelesener Seiten → noch ungelesene Seiten eines Buches",
        "Radius eines Kreises → Flächeninhalt des Kreises",
    ]

    /// "Welche Zuordnung ist proportional?" One of four everyday situations.
    private static func situation(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let target = level == 1 ? gen.pick([0, 2]) : gen.int(0...2)
        let pools = [proportionalSituations, antiproportionalSituations, otherSituations]
        let correct = gen.pick(pools[target])
        // One wrong situation of each of the other two kinds, and a third that is none of these two.
        let first = gen.pick(pools[(target + 1) % 3])
        let second = gen.pick(pools[(target + 2) % 3])
        let rest = (pools[(target + 1) % 3] + pools[(target + 2) % 3]).filter { $0 != first && $0 != second }
        let third = gen.pick(rest)
        let question = ["Welche Zuordnung ist proportional?", "Welche Zuordnung ist antiproportional?", "Welche Zuordnung ist weder proportional noch antiproportional?"][target]
        let reason = [
            "Doppelt so viel gehört zum Doppelten: y : x ist immer gleich.",
            "Doppelt so viel gehört zur Hälfte: x · y ist immer gleich.",
            "Weder der Quotient y : x noch das Produkt x · y bleibt gleich.",
        ][target]
        return .text(
            prompt: question,
            correct: correct,
            wrong: [first, second, third],
            solution: "\(correct): \(reason)",
            explanation: "Prüfe mit einem Beispiel: Wird das Doppelte zum Doppelten (proportional), zur Hälfte (antiproportional), oder keins von beiden?"
        )
    }

    /// "Die Zuordnung ist antiproportional. x: 2, 3, 6  y: 18, 12, ?"
    private static func tableFill(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { tableFillAttempt(level, gen) }
    }

    private static func tableFillAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let anti = level == 1 ? false : gen.chance(55)
        let xs: [Int]
        let ys: [Int]
        let answer: Int
        if anti {
            let product = gen.pick(level == 2 ? [12, 24, 36, 60] : [24, 36, 48, 60, 72, 120])
            let divisors = (1...24).filter { product % $0 == 0 }
            guard divisors.count >= 3 else { return nil }
            let picked = Array(gen.shuffled(divisors).prefix(3)).sorted()
            xs = picked
            ys = picked.map { product / $0 }
            answer = ys[2]
        } else {
            let k = level == 3 ? gen.int(3...12) : gen.int(2...9)
            let picked = level == 1 ? [gen.int(1...3), gen.int(4...6), gen.int(7...10)] : Array(gen.shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]).prefix(3)).sorted()
            xs = picked
            ys = picked.map { $0 * k }
            answer = ys[2]
        }
        guard Set(xs).count == 3, Set(ys).count == 3 else { return nil }
        let ruleName = anti ? "antiproportional" : "proportional"
        // The other kind of rule, the difference carried over, and the neighbour's value.
        let otherRule: Int?
        if anti {
            otherRule = (ys[0] * xs[2]) % xs[0] == 0 ? ys[0] * xs[2] / xs[0] : nil
        } else {
            let product = xs[0] * ys[0]
            otherRule = product % xs[2] == 0 ? product / xs[2] : nil
        }
        var candidates = [ys[1] + (xs[2] - xs[1]), ys[1] - (xs[2] - xs[1]), ys[1]]
        if let otherRule { candidates.append(otherRule) }
        let wrong = candidates.map { Q($0) }.positives
        let product = xs[0] * ys[0]
        let working = anti
            ? "\(xs[0]) · \(ys[0]) = \(product); \(product) : \(xs[2]) = \(answer)"
            : "y : x = \(ys[0]) : \(xs[0]) = \(ys[0] / xs[0]); \(ys[0] / xs[0]) · \(xs[2]) = \(answer)"
        let table = "x: \(xs.map(String.init).joined(separator: ", "))\ny: \(ys[0]), \(ys[1]), ?"
        var problem = MathMiddleProblem.number(
            prompt: "Die Zuordnung ist \(ruleName).\n\(table)\nWelche Zahl fehlt?",
            answer: Q(answer),
            hint: "",
            wrong: wrong,
            typedPrompt: "Die Zuordnung ist \(ruleName).\n\(table)\nWelche Zahl fehlt? Gib die Zahl an.",
            pair: "\(ruleName): \(xs[0]) → \(ys[0]), \(xs[2]) → ?",
            solution: working,
            explanation: anti
                ? "Bei einer antiproportionalen Zuordnung ist das Produkt x · y immer gleich. Berechne es aus einem vollständigen Paar."
                : "Bei einer proportionalen Zuordnung ist der Quotient y : x immer gleich. Berechne ihn aus einem vollständigen Paar."
        )
        problem?.pairPrompt = "Ordne jeder Tabelle die fehlende Zahl zu."
        return problem
    }

    // Lesson 3

    /// "Maßstab 1 : 50 000. 4 cm auf der Karte, wie viel in Wirklichkeit?" and the way back.
    private static func scale(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { scaleAttempt(level, gen) }
    }

    private static func scaleAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let n: Int
        switch level {
        case 1: n = gen.pick([100, 500, 1000])
        case 2: n = gen.pick([10000, 25000, 50000, 100_000])
        default: n = gen.pick([25000, 50000, 100_000, 200_000])
        }
        let scaleText = "1 : " + T.grouped(n)
        if level <= 2 {
            let d = gen.int(2...12)
            let meters = level == 1
            let real = meters ? Q(d * n, 100) : Q(d * n, 100_000)
            guard real.ok, [real].decimals(2).count == 1, real.double < 1000 else { return nil }
            let unit = meters ? "m" : "km"
            let wrong = [real * 10, real / 10, real * 100, real / 100].decimals(2).positives
            return .number(
                prompt: "Maßstab \(scaleText). Eine Strecke ist auf der Karte \(d) cm lang.\nWie lang ist sie in Wirklichkeit in \(unit)?",
                answer: real,
                style: .unit(unit),
                hint: "Gib nur die Zahl an.",
                wrong: wrong,
                pair: "\(scaleText), \(d) cm",
                solution: "\(d) cm · \(T.grouped(n)) = \(T.grouped(d * n)) cm = \(T.number(real)) \(unit)",
                explanation: "Bei 1 : \(T.grouped(n)) ist 1 cm auf der Karte \(T.grouped(n)) cm in Wirklichkeit. Rechne dann um: 100 cm sind 1 m, 100 000 cm sind 1 km."
            )
        }
        // Back from the real distance to the map.
        let km = gen.int(2...30)
        let onMap = Q(km * 100_000, n)
        guard onMap.ok, [onMap].decimals(1).count == 1, onMap.double >= 2, onMap.double < 100 else { return nil }
        let wrong = [onMap * 10, onMap / 10, onMap * 100, onMap / 100].decimals(1).positives
        return .number(
            prompt: "Zwei Orte sind \(km) km voneinander entfernt. Wie viele cm sind das auf einer Karte im Maßstab \(scaleText)?",
            answer: onMap,
            style: .unit("cm"),
            hint: "Gib nur die Zahl an.",
            wrong: wrong,
            pair: "\(km) km bei \(scaleText)",
            solution: "\(km) km = \(T.grouped(km * 100_000)) cm; \(T.grouped(km * 100_000)) : \(T.grouped(n)) = \(T.number(onMap)) cm",
            explanation: "Rechne die wirkliche Länge in cm um und teile durch den Maßstabsfaktor: Bei 1 : \(T.grouped(n)) ist die Karte \(T.grouped(n))-mal kleiner."
        )
    }

    /// "150 € werden im Verhältnis 2 : 3 geteilt. Wie viel bekommt der Zweite?"
    private static func ratioSplit(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let parts: [(Int, Int)]
        let k: Int
        switch level {
        case 1:
            parts = [(1, 2), (1, 3), (2, 3), (1, 4)]
            k = gen.int(2...10)
        case 2:
            parts = [(3, 4), (2, 5), (3, 5), (1, 5), (4, 5), (1, 6)]
            k = gen.int(2...15)
        default:
            parts = [(3, 7), (5, 7), (2, 7), (5, 8), (3, 8), (7, 9), (4, 9)]
            k = gen.int(3...20)
        }
        var (p, q) = gen.pick(parts)
        if gen.chance(50) { (p, q) = (q, p) }
        let total = (p + q) * k
        let askFirst = gen.chance(50)
        let share = (askFirst ? p : q) * k
        let swapped = (askFirst ? q : p) * k
        let story = gen.int(0...2)
        let ordinal = askFirst ? "der Erste" : "der Zweite"
        let prompt: String
        let style: MathMiddleProblem.Style
        let unit: String
        switch story {
        case 0:
            prompt = "Anna und Ben teilen \(total) € im Verhältnis \(p) : \(q). Wie viel bekommt \(askFirst ? "Anna" : "Ben")?"
            style = .euro
            unit = "€"
        case 1:
            prompt = "Eine Mischung aus Saft und Wasser hat das Verhältnis Saft : Wasser = \(p) : \(q) und ist \(total) l groß. Wie viele Liter sind \(askFirst ? "Saft" : "Wasser")?"
            style = .unit("l")
            unit = "l"
        default:
            prompt = "Ein Gewinn von \(total) € wird im Verhältnis \(p) : \(q) auf zwei Spieler verteilt. Wie viel bekommt \(ordinal)?"
            style = .euro
            unit = "€"
        }
        // The other share, one part only, half and half, the total divided by the number of this share.
        var wrong = [swapped, k, total - k]
        if total % 2 == 0 { wrong.append(total / 2) }
        if total % (askFirst ? p : q) == 0 { wrong.append(total / (askFirst ? p : q)) }
        let ordinalPart = askFirst ? p : q
        var problem = MathMiddleProblem.number(
            prompt: prompt,
            answer: Q(share),
            style: style,
            hint: valueHint,
            wrong: whole(wrong),
            pair: "\(total) im Verhältnis \(p) : \(q), \(askFirst ? "1. Teil" : "2. Teil")",
            solution: "\(p) + \(q) = \(p + q) Teile; \(total) : \(p + q) = \(k) je Teil; \(k) · \(ordinalPart) = \(share) \(unit)",
            explanation: "Zähle alle Teile zusammen (\(p) + \(q)), teile das Ganze durch diese Zahl und nimm das Ergebnis mal die Teile des Gesuchten."
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe den gesuchten Anteil zu."
        return problem
    }

    private static func whole(_ values: [Int]) -> [Q] { values.map { Q($0) }.positives }

    /// "Kürze das Verhältnis 12 : 18 vollständig." Level 3 has two units to bring to one first.
    private static func ratioReduce(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { ratioReduceAttempt(level, gen) }
    }

    private static func ratioReduceAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let prompt: String
        let front: String
        let working: String
        let reduced: (Int, Int)
        var wrong: [String] = []
        func ratio(_ x: Int, _ y: Int) -> String { "\(x) : \(y)" }
        if level <= 2 {
            let base = gen.pick([(1, 2), (1, 3), (2, 3), (3, 4), (3, 5), (2, 5), (4, 5), (1, 4), (5, 6)])
            let divisor = level == 1 ? gen.int(2...6) : gen.int(4...15)
            let a = base.0 * divisor
            let b = base.1 * divisor
            reduced = base
            if level == 1 {
                prompt = "Kürze das Verhältnis vollständig:\n\(a) : \(b)"
                front = ratio(a, b)
                working = "ggT(\(a), \(b)) = \(divisor); \(ratio(a, b)) = \(ratio(base.0, base.1))"
            } else {
                switch gen.int(0...2) {
                case 0:
                    prompt = "Ein Rezept braucht \(a * 10) g Mehl und \(b * 10) g Zucker.\nWie lautet das Verhältnis Mehl : Zucker, vollständig gekürzt?"
                    front = "\(a * 10) g : \(b * 10) g"
                    working = "ggT(\(a * 10), \(b * 10)) = \(divisor * 10); also \(ratio(base.0, base.1))"
                case 1:
                    prompt = "In einer Klasse sind \(a) Mädchen und \(b) Jungen.\nWie lautet das Verhältnis Mädchen : Jungen, vollständig gekürzt?"
                    front = "\(a) Mädchen : \(b) Jungen"
                    working = "ggT(\(a), \(b)) = \(divisor); also \(ratio(base.0, base.1))"
                default:
                    prompt = "Ein Rechteck ist \(a) cm lang und \(b) cm breit.\nWie lautet das Verhältnis Länge : Breite, vollständig gekürzt?"
                    front = "\(a) cm : \(b) cm"
                    working = "ggT(\(a), \(b)) = \(divisor); also \(ratio(base.0, base.1))"
                }
            }
            // Stopped halfway, the two sides switched, only one side shortened.
            let stops = (2..<divisor).filter { divisor % $0 == 0 }
            if let stop = stops.last { wrong.append(ratio(base.0 * (divisor / stop), base.1 * (divisor / stop))) }
            wrong += [ratio(base.1, base.0), ratio(a, base.1), ratio(base.0, b)]
        } else {
            // The second quantity in the larger unit: 250 g : 1 kg is 250 : 1000.
            let (small, large, factor) = gen.pick([("g", "kg", 1000), ("cm", "m", 100), ("min", "h", 60)])
            let big = gen.int(1...4)
            let inSmall = big * factor
            let smallValue = gen.int(1...19) * (factor == 60 ? 5 : (factor == 100 ? 5 : 50))
            let divisor = T.gcd(smallValue, inSmall)
            reduced = (smallValue / divisor, inSmall / divisor)
            guard reduced.0 < reduced.1, reduced.1 <= 40, reduced.0 != smallValue else { return nil }
            prompt = "Wie lautet das Verhältnis \(smallValue) \(small) : \(big) \(large), vollständig gekürzt?"
            front = "\(smallValue) \(small) : \(big) \(large)"
            working = "\(big) \(large) = \(inSmall) \(small); \(ratio(smallValue, inSmall)) = \(ratio(reduced.0, reduced.1))"
            // The units ignored, left unreduced, the sides switched.
            let ignored = T.gcd(smallValue, big)
            wrong = [ratio(smallValue / ignored, big / ignored), ratio(smallValue, inSmall), ratio(reduced.1, reduced.0)]
        }
        var problem = MathMiddleProblem.text(
            prompt: prompt,
            correct: ratio(reduced.0, reduced.1),
            wrong: wrong,
            typed: .init(prompt: prompt.replacingOccurrences(of: "\n", with: " ") + "\nWelche Zahl steht rechts?", answer: Rational(reduced.1)),
            pair: front,
            solution: working,
            explanation: "Kürze ein Verhältnis wie einen Bruch: Teile beide Zahlen durch den größten gemeinsamen Teiler. Haben sie verschiedene Einheiten, rechne zuerst um."
        )
        problem.pairPrompt = "Kürze vollständig und ordne zu."
        return problem
    }
}
