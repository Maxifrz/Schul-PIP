import Foundation

private typealias Q = MathMiddleQ
private typealias T = MathMiddleText

/// Unit 10, Wahrscheinlichkeit: Laplace-Wahrscheinlichkeit, relative Häufigkeit and what a probability can be (lesson 1),
/// Gegenereignis, two dice, expected counts and the product rule with replacement (2), drawing without replacement, the
/// sum rule over two paths and "mindestens einmal" (3).
///
/// Every answer is a probability in lowest terms; a typed answer accepts a fraction or a decimal by value.
enum MathMiddleUnit10 {
    static let templates: [MathMiddleTemplate] = [
        MathMiddleTemplate("u10.dieEvent", lesson: 1, forms: [.choice, .typed, .pairs], make: dieEvent),
        MathMiddleTemplate("u10.urn", lesson: 1, forms: [.choice, .typed, .pairs], make: urn),
        MathMiddleTemplate("u10.frequency", lesson: 1, forms: [.choice, .typed], make: frequency),
        MathMiddleTemplate("u10.range", lesson: 1, forms: [.choice], make: range),
        MathMiddleTemplate("u10.complement", lesson: 2, forms: [.choice, .typed, .pairs], make: complement),
        MathMiddleTemplate("u10.twoDice", lesson: 2, forms: [.choice, .typed, .pairs], make: twoDice),
        MathMiddleTemplate("u10.expected", lesson: 2, forms: [.choice, .typed], make: expected),
        MathMiddleTemplate("u10.withReplacement", lesson: 2, forms: [.choice, .typed, .pairs], make: withReplacement),
        MathMiddleTemplate("u10.withoutReplacement", lesson: 3, forms: [.choice, .typed, .pairs], make: withoutReplacement),
        MathMiddleTemplate("u10.twoPaths", lesson: 3, forms: [.choice, .typed], make: twoPaths),
        MathMiddleTemplate("u10.atLeastOne", lesson: 3, forms: [.choice, .typed], make: atLeastOne),
    ]

    private static let hint = "Gib das Ergebnis als Bruch oder Dezimalzahl an."

    private static func f(_ q: Q) -> String { T.fraction(q) }

    /// The candidates that can be a probability that is neither impossible nor certain.
    private static func probs(_ candidates: [Q]) -> [Q] {
        candidates.filter { $0.ok && $0 > Q(0) && $0 < Q(1) }
    }

    private static func prob(
        prompt: String, answer: Q, wrong: [Q], pair: String? = nil, solution: String, explanation: String
    ) -> MathMiddleProblem? {
        guard answer.ok, answer > Q(0), answer < Q(1) else { return nil }
        var problem = MathMiddleProblem.number(
            prompt: prompt, answer: answer, style: .fraction, hint: hint, wrong: probs(wrong), pair: pair,
            solution: solution, explanation: explanation
        )
        problem?.pairPrompt = "Berechne die Wahrscheinlichkeit und ordne zu."
        return problem
    }

    private static func isPrime(_ n: Int) -> Bool {
        n >= 2 && !(2..<n).contains(where: { n % $0 == 0 })
    }

    private static let colors = ["rote", "blaue", "grüne", "gelbe"]

    // Lesson 1

    /// One throw of a die: favourable numbers over all numbers.
    private static func dieEvent(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { dieEventAttempt(level, gen) }
    }

    private static func dieEventAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let sides = level == 1 ? 6 : (level == 2 ? gen.pick([6, 8]) : gen.pick([8, 12, 20]))
        let k = gen.int(2...(sides - 2))
        let m = gen.pick([2, 3, 4, 5])
        var events: [(phrase: String, test: (Int) -> Bool)] = [
            ("größer als \(k)", { $0 > k }),
            ("kleiner als \(k)", { $0 < k }),
            ("gerade", { $0 % 2 == 0 }),
            ("ungerade", { $0 % 2 == 1 }),
        ]
        if level >= 2 {
            events.append(("eine Primzahl", { isPrime($0) }))
            events.append(("durch \(m) teilbar", { $0 % m == 0 }))
        }
        let event = gen.pick(events)
        let favourable = (1...sides).filter(event.test)
        let fav = favourable.count
        guard fav >= 1, fav < sides else { return nil }
        let answer = Q(fav, sides)
        let die = sides == 6 ? "Ein Würfel" : "Ein Würfel mit den Zahlen 1 bis \(sides)"
        let listed = fav <= 8 ? favourable.map(String.init).joined(separator: ", ") : "\(fav) Zahlen"
        return prob(
            prompt: "\(die) wird einmal geworfen.\nWie groß ist die Wahrscheinlichkeit, dass die Zahl \(event.phrase) ist?",
            answer: answer,
            wrong: [Q(fav, sides - fav), Q(fav + 1, sides), Q(fav - 1, sides), Q(sides - fav, sides)],
            pair: "Zahl \(event.phrase), 1 bis \(sides)",
            solution: "Günstig: \(listed). Das sind \(fav) von \(sides) Zahlen: P = \(fav)/\(sides) = \(f(answer))",
            explanation: "Bei gleich wahrscheinlichen Ergebnissen gilt P = günstige Ergebnisse : alle Ergebnisse. Zähle die günstigen Zahlen einzeln ab."
        )
    }

    /// Drawing one ball from a bag.
    private static func urn(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { urnAttempt(level, gen) }
    }

    private static func urnAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let kinds = level == 1 ? 2 : (level == 2 ? 3 : gen.pick([3, 4]))
        let counts = (0..<kinds).map { _ in gen.int(level: level, 1...5, 1...6, 2...8) }
        let total = counts.reduce(0, +)
        guard total <= 24 else { return nil }
        let names = Array(colors.prefix(kinds))
        let combined = level == 3 && gen.chance(50)
        let first = gen.int(0...(kinds - 1))
        var second = (first + gen.int(1...(kinds - 1))) % kinds
        if second == first { second = (first + 1) % kinds }
        let chosen = combined ? [first, second].sorted() : [first]
        let fav = chosen.map { counts[$0] }.reduce(0, +)
        guard fav < total else { return nil }
        let contents = T.listed(zip(counts, names).map { "\($0) \($1)" })
        let askedColor = chosen.map { names[$0] }.joined(separator: " oder ")
        let askedNoun = combined ? "eine \(chosen.map { String(names[$0].dropLast()) + "e" }.joined(separator: " oder eine "))" : "eine \(names[first])"
        let wrong = [
            Q(fav, total - fav), Q(total - fav, total), Q(1, kinds), Q(counts[chosen[0]], total),
            Q(counts[first], counts[second]),
        ]
        return prob(
            prompt: "In einem Beutel liegen \(contents) Kugeln. Du ziehst eine Kugel, ohne hinzusehen.\nWie groß ist die Wahrscheinlichkeit für \(askedNoun) Kugel?",
            answer: Q(fav, total),
            wrong: wrong,
            pair: "\(counts.map(String.init).joined(separator: "/")) Kugeln: \(askedColor)",
            solution: "Insgesamt \(total) Kugeln, davon \(fav) günstig: P = \(fav)/\(total) = \(f(Q(fav, total)))",
            explanation: "Die Wahrscheinlichkeit ist die Zahl der günstigen Kugeln geteilt durch die Zahl aller Kugeln im Beutel, nicht geteilt durch die Zahl der übrigen Kugeln."
        )
    }

    /// Relative frequency: hits over trials, as a decimal.
    private static func frequency(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { frequencyAttempt(level, gen) }
    }

    private static func frequencyAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let n = level == 1 ? gen.pick([10, 20, 50, 100]) : (level == 2 ? gen.pick([20, 25, 40, 50, 200]) : gen.pick([8, 16, 40, 125, 250]))
        let k = gen.int(1...(n - 1))
        let value = Q(k, n)
        let contexts = [
            "Eine Reißzwecke wird \(n)-mal geworfen und landet \(k)-mal auf dem Rücken.",
            "Ein Basketballspieler wirft \(n)-mal auf den Korb und trifft \(k)-mal.",
            "Bei \(n) Würfen einer Münze fällt \(k)-mal Kopf.",
            "Von \(n) geprüften Bauteilen sind \(k) defekt.",
        ]
        let wrong = [Q(k, n - k), Q(n - k, n), Q(k, 100), Q(k + 1, n), Q(k - 1, n)].decimals(3).filter { $0 < Q(1) && $0 > Q(0) }
        var problem = MathMiddleProblem.number(
            prompt: "\(gen.pick(contexts))\nWie groß ist die relative Häufigkeit des Ereignisses?",
            answer: value,
            hint: "Gib das Ergebnis als Dezimalzahl oder Bruch an.",
            wrong: wrong,
            solution: "Relative Häufigkeit = Treffer : Versuche = \(k) : \(n) = \(T.number(value))",
            explanation: "Die relative Häufigkeit ist die Zahl der Treffer geteilt durch die Zahl aller Versuche."
        )
        problem?.typed?.text = T.number(value)
        return problem
    }

    /// Which number can not be a probability.
    private static func range(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let invalidPool: [String]
        switch level {
        case 1: invalidPool = ["1,5", "−0,2", "2", "−3", "1,2", "−0,4"]
        case 2: invalidPool = ["7/6", "120 %", "−1/4", "3/2", "5/4", "150 %"]
        default: invalidPool = ["101 %", "1,01", "9/8", "−3/100", "11/10", "−0,01"]
        }
        let valid = gen.shuffled(["0", "1", "0,35", "3/5", "7/8", "25 %", "100 %", "9/10", "1/100", "1/3", "0,5", "2/7"])
        let wrong = Array(valid.prefix(3))
        let correct = gen.pick(invalidPool)
        return .text(
            prompt: "Welche dieser Zahlen kann keine Wahrscheinlichkeit sein?",
            correct: correct,
            wrong: wrong,
            solution: "\(correct) liegt nicht zwischen 0 und 1 (0 % und 100 %).",
            explanation: "Eine Wahrscheinlichkeit liegt immer zwischen 0 und 1, also zwischen 0 % und 100 %. Negative Zahlen und Zahlen über 1 sind nie möglich."
        )
    }

    // Lesson 2

    /// P(not E) = 1 − P(E), as a fraction, as a percentage or for a neither-nor.
    private static func complement(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { complementAttempt(level, gen) }
    }

    private static func complementAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let events = [
            ("Der Bus ist pünktlich", "Der Bus ist nicht pünktlich"),
            ("Das Los gewinnt", "Das Los gewinnt nicht"),
            ("Es regnet morgen", "Es regnet morgen nicht"),
            ("Ein Bauteil ist fehlerfrei", "Ein Bauteil ist fehlerhaft"),
        ]
        let event = gen.pick(events)
        if level == 3, gen.chance(60) {
            let a = Q(1, gen.pick([4, 5, 6]))
            let b = Q(1, gen.pick([3, 4, 10]))
            let answer = 1 - a - b
            return prob(
                prompt: "Auf einem Glücksrad ist die Wahrscheinlichkeit für Rot \(f(a)) und für Blau \(f(b)).\nWie groß ist die Wahrscheinlichkeit, dass weder Rot noch Blau kommt?",
                answer: answer,
                wrong: [1 - a, 1 - b, a + b, a * b],
                pair: "weder Rot (\(f(a))) noch Blau (\(f(b)))",
                solution: "Rot oder Blau: \(f(a)) + \(f(b)) = \(f(a + b)); Gegenereignis: 1 \(T.minus) \(f(a + b)) = \(f(answer))",
                explanation: "Erst die Wahrscheinlichkeit für „Rot oder Blau“ addieren, dann das Gegenereignis mit 1 minus diesem Wert bilden."
            )
        }
        if level >= 2, gen.chance(40) {
            let p = level == 2 ? 5 * gen.int(1...19) : gen.int(1...99)
            guard p != 50 else { return nil }
            var problem = MathMiddleProblem.number(
                prompt: "\(event.0) mit einer Wahrscheinlichkeit von \(p) %.\nWie groß ist die Wahrscheinlichkeit des Gegenereignisses („\(event.1)“) in Prozent?",
                answer: Q(100 - p),
                style: .percent,
                hint: "Gib nur die Prozentzahl an.",
                wrong: [Q(p), Q(100 + p), Q(p, 100)],
                solution: "100 % \(T.minus) \(p) % = \(100 - p) %",
                explanation: "Ein Ereignis und sein Gegenereignis ergeben zusammen 100 %, also P(nicht E) = 100 % − P(E)."
            )
            problem?.pairFront = "Gegenereignis zu \(p) %"
            return problem
        }
        let b = gen.pick(level == 1 ? [5, 8, 10] : [6, 12, 20, 25])
        let a = gen.int(1...(b - 1))
        let value = Q(a, b)
        guard MathMiddleText.gcd(a, b) == 1 || level == 1 else { return nil }
        let answer = 1 - value
        return prob(
            prompt: "\(event.0) mit der Wahrscheinlichkeit \(f(value)).\nWie groß ist die Wahrscheinlichkeit, dass das nicht der Fall ist?",
            answer: answer,
            wrong: [value, Q(b - a, a), Q(b, b - a), value * value],
            pair: "P(E) = \(f(value)), P(nicht E)",
            solution: "P(nicht E) = 1 \(T.minus) \(f(value)) = \(f(answer))",
            explanation: "Das Gegenereignis ergänzt E zu 1: P(nicht E) = 1 − P(E)."
        )
    }

    /// Two dice thrown together: 36 equally likely pairs, counted one by one.
    private static func twoDice(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { twoDiceAttempt(level, gen) }
    }

    private static func twoDiceAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let s = gen.int(3...11)
        var events: [(name: String, test: (Int, Int) -> Bool, isSum: Bool)]
        switch level {
        case 1:
            events = [
                ("Die Augensumme ist \(s)", { $0 + $1 == s }, true),
                ("Beide Würfel zeigen dieselbe Zahl", { $0 == $1 }, false),
            ]
        case 2:
            let t = gen.int(5...9)
            events = [
                ("Die Augensumme ist mindestens \(t)", { $0 + $1 >= t }, false),
                ("Die Augensumme ist höchstens \(t)", { $0 + $1 <= t }, false),
                ("Beide Zahlen sind gerade", { $0 % 2 == 0 && $1 % 2 == 0 }, false),
                ("Mindestens ein Würfel zeigt eine 6", { $0 == 6 || $1 == 6 }, false),
                ("Die Augensumme ist \(s)", { $0 + $1 == s }, true),
            ]
        default:
            events = [
                ("Das Produkt der Zahlen ist \(gen.pick([6, 8, 12, 4, 10]))", { _, _ in false }, false),
                ("Das Produkt der Zahlen ist gerade", { ($0 * $1) % 2 == 0 }, false),
                ("Die Zahlen unterscheiden sich um genau 2", { abs($0 - $1) == 2 }, false),
                ("Die Zahlen sind verschieden", { $0 != $1 }, false),
                ("Die Augensumme ist eine Primzahl", { isPrime($0 + $1) }, false),
            ]
            // The product event needs its number inside the closure.
            let target = Int(events[0].name.split(separator: " ").last.map(String.init) ?? "") ?? 6
            events[0].test = { $0 * $1 == target }
        }
        let event = gen.pick(events)
        var count = 0
        for a in 1...6 { for b in 1...6 where event.test(a, b) { count += 1 } }
        guard count >= 1, count < 36 else { return nil }
        let answer = Q(count, 36)
        var wrong = [Q(count, 12), Q(count, 6), Q(count + 1, 36), Q(count - 1, 36), Q(count, 36 - count)]
        if event.isSum { wrong.insert(Q(1, 11), at: 0) }
        return prob(
            prompt: "Zwei Würfel werden geworfen.\nWie groß ist die Wahrscheinlichkeit? \(event.name).",
            answer: answer,
            wrong: wrong,
            pair: event.name,
            solution: "Von den 36 gleich wahrscheinlichen Paaren sind \(count) günstig: P = \(count)/36 = \(f(answer))",
            explanation: "Zwei Würfel haben 6 · 6 = 36 gleich wahrscheinliche Paare. Die Summen 2 bis 12 sind nicht gleich wahrscheinlich, weil unterschiedlich viele Paare zu ihnen gehören."
        )
    }

    /// Expected number of successes: probability times number of trials.
    private static func expected(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { expectedAttempt(level, gen) }
    }

    private static func expectedAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let p: Q
        let shown: String
        let n: Int
        if level == 3 {
            let percent = gen.pick([5, 10, 12, 15, 20, 35, 40, 45, 60])
            p = Q(percent, 100)
            shown = "\(percent) %"
            n = gen.pick([100, 200, 400, 500])
        } else {
            let den = level == 1 ? gen.pick([2, 4, 5, 10]) : gen.pick([3, 6, 8, 10, 12])
            let num = level == 1 ? 1 : gen.int(1...(den - 1))
            p = Q(num, den)
            shown = f(p)
            n = den * gen.int(level == 1 ? 3...20 : 2...12)
        }
        let answer = p * n
        guard answer.ok, answer.isWhole, answer.numerator >= 1, n >= 8 else { return nil }
        let wrong = [Q(n) - answer, answer * 10, Q(n, p.denominator), Q(n * p.denominator)]
        let contexts = [
            "Ein Glücksrad gewinnt mit der Wahrscheinlichkeit \(shown). Es wird \(n)-mal gedreht.",
            "Ein Spieler trifft mit der Wahrscheinlichkeit \(shown). Er wirft \(n)-mal.",
            "Eine Maschine fertigt mit der Wahrscheinlichkeit \(shown) ein fehlerhaftes Teil. Es werden \(n) Teile gefertigt.",
        ]
        return MathMiddleProblem.number(
            prompt: "\(gen.pick(contexts))\nWie oft ist das Ereignis ungefähr zu erwarten?",
            answer: answer,
            hint: "Gib die Anzahl an.",
            wrong: wrong.decimals(2),
            solution: "Erwartet: \(shown) von \(n) = \(n) · \(shown) = \(T.number(answer))",
            explanation: "Die erwartete Anzahl ist die Wahrscheinlichkeit mal die Zahl der Versuche; tatsächlich weicht das Ergebnis meist etwas davon ab."
        )
    }

    /// Two draws with replacement: the first path rule.
    private static func withReplacement(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { withReplacementAttempt(level, gen) }
    }

    private static func withReplacementAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let n = level == 1 ? gen.pick([4, 5, 6]) : (level == 2 ? gen.pick([5, 6, 8, 10]) : gen.pick([8, 9, 10, 12]))
        let r = gen.int(1...(n - 1))
        let b = n - r
        let p = Q(r, n)
        let q = Q(b, n)
        var kinds = ["rr", "bb", "rb"]
        if level == 3 { kinds.append("same") }
        let kind = gen.pick(kinds)
        let name: String
        let answer: Q
        var wrong: [Q]
        switch kind {
        case "rr":
            name = "beide Kugeln sind rot"
            answer = p * p
            wrong = [p + p, Q(r * (r - 1), n * (n - 1)), p * q, Q(r, 2 * n)]
        case "bb":
            name = "beide Kugeln sind blau"
            answer = q * q
            wrong = [q + q, Q(b * (b - 1), n * (n - 1)), p * q, Q(b, 2 * n)]
        case "rb":
            name = "die erste Kugel ist rot und die zweite blau"
            answer = p * q
            wrong = [p + q, Q(r * b, n * (n - 1)), p * p, q * q]
        default:
            name = "beide Kugeln haben dieselbe Farbe"
            answer = p * p + q * q
            wrong = [p * p, q * q, 2 * p * q, p + q]
        }
        guard r >= 1, b >= 1, r != b || kind == "rb" || kind == "same" || level == 1 else { return nil }
        let steps = kind == "same"
            ? "\(f(p)) · \(f(p)) + \(f(q)) · \(f(q)) = \(f(p * p)) + \(f(q * q)) = \(f(answer))"
            : "\(f(kind == "bb" ? q : p)) · \(f(kind == "rb" ? q : (kind == "bb" ? q : p))) = \(f(answer))"
        return prob(
            prompt: "Im Beutel liegen \(r) rote und \(b) blaue Kugeln. Du ziehst zweimal und legst die Kugel nach jedem Zug zurück.\nWie groß ist die Wahrscheinlichkeit, dass \(name)?",
            answer: answer,
            wrong: wrong,
            pair: "\(r) rot, \(b) blau, mit Zurücklegen: \(name)",
            solution: "Beide Züge haben dieselben Wahrscheinlichkeiten. Pfadregel: \(steps)",
            explanation: "Beim Ziehen mit Zurücklegen ändert sich der Beutel nicht. Entlang eines Pfades multiplizierst du die Wahrscheinlichkeiten der Züge."
        )
    }

    // Lesson 3

    /// Two draws without replacement: the second factor has one ball less.
    private static func withoutReplacement(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { withoutReplacementAttempt(level, gen) }
    }

    private static func withoutReplacementAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let n = level == 1 ? gen.pick([5, 6, 7]) : (level == 2 ? gen.pick([6, 8, 9, 10]) : gen.pick([8, 9, 10, 12]))
        let r = gen.int(2...(n - 2))
        let b = n - r
        var kinds = ["rr", "rb"]
        if level >= 2 { kinds.append("bb") }
        if level == 3 { kinds.append("atLeastRed") }
        let kind = gen.pick(kinds)
        let m = Q(n * (n - 1))
        let name: String
        let answer: Q
        let wrong: [Q]
        let steps: String
        switch kind {
        case "rr":
            name = "beide Kugeln sind rot"
            answer = Q(r * (r - 1)) / m
            wrong = [Q(r * r, n * n), Q(r * r, n * (n - 1)), Q(r * (r - 1), n * n), Q(r, n) + Q(r - 1, n - 1)]
            steps = "\(r)/\(n) · \(r - 1)/\(n - 1) = \(f(answer))"
        case "bb":
            name = "beide Kugeln sind blau"
            answer = Q(b * (b - 1)) / m
            wrong = [Q(b * b, n * n), Q(b * b, n * (n - 1)), Q(b * (b - 1), n * n), Q(b, n) + Q(b - 1, n - 1)]
            steps = "\(b)/\(n) · \(b - 1)/\(n - 1) = \(f(answer))"
        case "rb":
            name = "die erste Kugel ist rot und die zweite blau"
            answer = Q(r * b) / m
            wrong = [Q(r * b, n * n), Q(r * (b - 1), n * (n - 1)), Q(r, n) + Q(b, n - 1), Q(r * b, (n - 1) * (n - 1))]
            steps = "\(r)/\(n) · \(b)/\(n - 1) = \(f(answer))"
        default:
            name = "mindestens eine Kugel ist rot"
            let none = Q(b * (b - 1)) / m
            answer = 1 - none
            wrong = [none, 1 - Q(b * b, n * n), Q(r * (r - 1)) / m, Q(r, n) * 2]
            steps = "keine rote: \(b)/\(n) · \(b - 1)/\(n - 1) = \(f(none)); 1 \(T.minus) \(f(none)) = \(f(answer))"
        }
        guard answer > Q(0), answer < Q(1) else { return nil }
        return prob(
            prompt: "Im Beutel liegen \(r) rote und \(b) blaue Kugeln. Du ziehst zwei Kugeln nacheinander, ohne zurückzulegen.\nWie groß ist die Wahrscheinlichkeit, dass \(name)?",
            answer: answer,
            wrong: wrong,
            pair: "\(r) rot, \(b) blau, ohne Zurücklegen: \(name)",
            solution: "Im zweiten Zug sind nur noch \(n - 1) Kugeln im Beutel: \(steps)",
            explanation: "Ohne Zurücklegen sinkt die Zahl der Kugeln im zweiten Zug um eins, und bei gleicher Farbe auch die Zahl der günstigen Kugeln."
        )
    }

    /// Two different colours: two paths whose probabilities are added.
    private static func twoPaths(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { twoPathsAttempt(level, gen) }
    }

    private static func twoPathsAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let n = level == 1 ? gen.pick([4, 5, 6]) : (level == 2 ? gen.pick([5, 6, 8]) : gen.pick([7, 8, 9, 10]))
        let r = gen.int(1...(n - 1))
        let b = n - r
        let replacing = level == 1 ? true : gen.chance(50)
        let denominator = replacing ? n * n : n * (n - 1)
        let other = replacing ? n * (n - 1) : n * n
        let one = Q(r * b, denominator)
        let answer = 2 * one
        let wrong = [one, Q(2 * r * b, other), Q(r * r + b * b, denominator), Q(r + b, n) * one]
        return prob(
            prompt: "Im Beutel liegen \(r) rote und \(b) blaue Kugeln. Du ziehst zweimal \(replacing ? "und legst die Kugel nach jedem Zug zurück" : "ohne zurückzulegen").\nWie groß ist die Wahrscheinlichkeit für zwei verschiedene Farben?",
            answer: answer,
            wrong: wrong,
            pair: nil,
            solution: "Zwei Pfade: rot-blau und blau-rot, beide mit \(f(one)). Zweite Pfadregel: \(f(one)) + \(f(one)) = \(f(answer))",
            explanation: "Zwei verschiedene Farben können auf zwei Pfaden entstehen (erst rot oder erst blau). Die Wahrscheinlichkeiten der Pfade werden addiert."
        )
    }

    /// "At least once" through the complementary event.
    private static func atLeastOne(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { atLeastOneAttempt(level, gen) }
    }

    private static func atLeastOneAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let kind = gen.int(0...2)
        let p: Q
        let n: Int
        let event: String
        switch kind {
        case 0:
            p = Q(1, 2)
            n = level == 1 ? gen.int(2...3) : gen.int(3...5)
            event = "Du wirfst eine Münze \(n)-mal. Wie groß ist die Wahrscheinlichkeit, dass mindestens einmal Kopf fällt?"
        case 1:
            p = Q(1, 6)
            n = level == 1 ? 2 : gen.int(2...3)
            event = "Du würfelst \(n)-mal. Wie groß ist die Wahrscheinlichkeit, dass mindestens eine Sechs dabei ist?"
        default:
            p = Q(1, gen.pick([3, 4, 5]))
            n = level == 1 ? 2 : gen.int(2...3)
            event = "Ein Glücksrad gewinnt mit der Wahrscheinlichkeit \(f(p)). Du drehst \(n)-mal. Wie groß ist die Wahrscheinlichkeit für mindestens einen Gewinn?"
        }
        let miss = 1 - p
        let none = miss.power(n)
        let answer = 1 - none
        let wrong = [Q(n) * p, none, 1 - p.power(n), p.power(n), 1 - miss * n, p]
        return prob(
            prompt: event,
            answer: answer,
            wrong: wrong,
            pair: nil,
            solution: "Gegenereignis „nie“: \(f(miss))\(T.sup(n)) = \(f(none)); mindestens einmal: 1 \(T.minus) \(f(none)) = \(f(answer))",
            explanation: "Bei „mindestens einmal“ rechnest du über das Gegenereignis „kein einziges Mal“ und ziehst von 1 ab. Die Wahrscheinlichkeiten der einzelnen Versuche darfst du nicht einfach addieren."
        )
    }
}
