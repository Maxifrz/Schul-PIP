import Foundation

/// Unit 7: stochastics (Laplace, binomial coefficient, binomial distribution, expectation, conditional probability).
enum MathUpperUnit07 {
    static let templates: [UTemplate] = [dice, urn, choose, binomialEqual, binomialCumulative, expectation, table, conditional, independence, bayes]

    static let germanTwoDecimals = "(Antworte als Bruch oder Dezimalzahl.)"

    /// A probability question: typed as a fraction or decimal, chosen from the same forms.
    static func probability(
        key: String, prompt: String, answer: UQ, wrongs: [UQ], solution: String, explanation: String, fact: UFact
    ) -> UProblem? {
        UProblem.numeric(
            key: key, prompt: prompt, hint: germanTwoDecimals, answer: answer, wrongs: wrongs.filter { $0 >= .zero && $0 <= .one }, solution: solution + " Ergebnis: \(answer.fraction)\(answer.isInt || answer.fraction == answer.typed ? "" : " = \(answer.text)").",
            explanation: explanation, fact: fact
        )
    }

    static func binomial(_ n: Int, _ k: Int) -> Int {
        guard k >= 0, k <= n else { return 0 }
        var result = 1
        for i in 1...max(k, 1) where k > 0 { result = result * (n - k + i) / i }
        return result
    }

    static func pmf(_ n: Int, _ p: UQ, _ k: Int) -> UQ { UQ(binomial(n, k)) * p.power(k) * (UQ.one - p).power(n - k) }

    // MARK: Laplace

    static let dice = UTemplate("s.dice") { lv, g in
        enum Kind { case single(Int), atLeast(Int), atMost(Int), even, doubleOrSum(Int) }
        let kind: Kind
        switch lv {
        case 1: kind = .single(g.pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))
        case 2: kind = g.pick([.atLeast(g.int(9...11)), .atMost(g.int(3...5)), .single(7)])
        default: kind = g.pick([.even, .doubleOrSum(g.int(2...3)), .atLeast(g.int(7...8))])
        }
        let sums: [Int]
        let text: String
        switch kind {
        case let .single(s): sums = [s]; text = "die Augensumme \(s) ist"
        case let .atLeast(s): sums = Array(s...12); text = "die Augensumme mindestens \(s) ist"
        case let .atMost(s): sums = Array(2...s); text = "die Augensumme höchstens \(s) ist"
        case .even: sums = [2, 4, 6, 8, 10, 12]; text = "die Augensumme gerade ist"
        case let .doubleOrSum(s): sums = [s, 14 - s]; text = "die Augensumme \(s) oder \(14 - s) ist"
        }
        var count = 0
        for x in 1...6 { for y in 1...6 where sums.contains(x + y) { count += 1 } }
        let answer = UQ(count, 36)
        let wrongs = [UQ(sums.count, 11), UQ(count, 12), UQ(count + 1, 36), UQ(count - 1, 36), UQ(sums.count, 36), UQ(count, 6)]
        return probability(
            key: "s.dice|\(sums)", prompt: "Zwei faire Würfel werden geworfen. Wie groß ist die Wahrscheinlichkeit, dass \(text)?", answer: answer, wrongs: wrongs,
            solution: "Laplace: günstige Fälle durch mögliche Fälle. Es gibt 6·6 = 36 gleich wahrscheinliche Paare, davon \(count) günstige: \(count)/36.",
            explanation: "Die Augensummen sind nicht gleich wahrscheinlich; zähle die Würfelpaare, nicht die Summen.", fact: .laplaceDice(sums: sums)
        )
    }

    static let urn = UTemplate("s.urn") { lv, g in
        let red = g.int(2...6), blue = g.int(2...6)
        let n = red + blue
        let mode: UUrn = lv == 1 ? .oneRed : (lv == 2 ? .twoRedWith : g.pick([.twoRedWithout, .differentWithout]))
        let answer: UQ
        let wrongs: [UQ]
        let prompt: String
        let solution: String
        let r = UQ(red, n)
        switch mode {
        case .oneRed:
            answer = r
            wrongs = [UQ(red, blue), UQ(blue, n), UQ(1, n), UQ(red, 2 * n)]
            prompt = "In einer Urne liegen \(red) rote und \(blue) blaue Kugeln. Wie groß ist die Wahrscheinlichkeit, eine rote Kugel zu ziehen?"
            solution = "\(red) günstige von \(n) möglichen Kugeln."
        case .twoRedWith:
            answer = r * r
            wrongs = [r + r, UQ(red, n) * UQ(red - 1, n - 1), UQ(2 * red, n), UQ(red * red, n)]
            prompt = "In einer Urne liegen \(red) rote und \(blue) blaue Kugeln. Du ziehst zwei Kugeln mit Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zweimal rot?"
            solution = "Mit Zurücklegen bleibt die Urne gleich: \(red)/\(n) · \(red)/\(n)."
        case .twoRedWithout:
            answer = r * UQ(red - 1, n - 1)
            wrongs = [r * r, UQ(red - 1, n - 1), r + UQ(red - 1, n - 1), UQ(red * (red - 1), n * n)]
            prompt = "In einer Urne liegen \(red) rote und \(blue) blaue Kugeln. Du ziehst zwei Kugeln ohne Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zweimal rot?"
            solution = "Beim zweiten Zug sind nur noch \(red - 1) rote unter \(n - 1) Kugeln: \(red)/\(n) · \(red - 1)/\(n - 1)."
        case .differentWithout:
            answer = UQ(2 * red * blue, n * (n - 1))
            wrongs = [r * UQ(blue, n - 1), UQ(red * blue, n * n), UQ(2 * red * blue, n * n), UQ(blue, n - 1)]
            prompt = "In einer Urne liegen \(red) rote und \(blue) blaue Kugeln. Du ziehst zwei Kugeln ohne Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zwei verschiedene Farben?"
            solution = "Rot dann blau oder blau dann rot: 2 · \(red)/\(n) · \(blue)/\(n - 1)."
        }
        return probability(
            key: "s.urn|\(red)|\(blue)|\(mode)", prompt: prompt, answer: answer, wrongs: wrongs, solution: solution,
            explanation: "Ohne Zurücklegen ändern sich Zähler und Nenner nach dem ersten Zug; mit Zurücklegen nicht.", fact: .urn(red: red, blue: blue, mode: mode)
        )
    }

    static let choose = UTemplate("s.choose", pairs: { _, g in
        var items: [(front: String, back: String)] = []
        var fronts = Set<String>(), backs = Set<Int>()
        for _ in 0..<80 where items.count < 4 {
            let n = g.int(4...9), k = g.int(1...(n - 1))
            let value = binomial(n, k)
            if fronts.insert("\(min(k, n - k))|\(n)").inserted, backs.insert(value).inserted { items.append(("\(n) über \(k)", "\(value)")) }
        }
        return items.count == 4 ? items : nil
    }) { lv, g in
        let n = g.int(lv == 1 ? 3...6 : (lv == 2 ? 5...9 : 8...12))
        let k = lv == 1 ? g.int(1...2) : g.int(0...n)
        let value = binomial(n, k)
        var falling = 1
        for i in 0..<k { falling *= n - i }
        let wrongs = UCalc.differing([UQ(n * k), UQ(binomial(n, k + 1)), UQ(binomial(n + 1, k)), UQ(falling), UQ(binomial(n, k - 1)), UQ(n - k)], from: UQ(value))
        return UProblem.numeric(
            key: "s.choose|\(n)|\(k)", prompt: "Berechne \(n) über \(k).", answer: UQ(value), wrongs: wrongs,
            solution: "\(n) über \(k) = \(n)!/(\(k)!·\(n - k)!) = \(value). Probe mit der Symmetrie: \(n) über \(n - k) ist ebenfalls \(value).",
            explanation: "n über k zählt, auf wie viele Arten man k aus n auswählt, ohne auf die Reihenfolge zu achten: Es gilt (n über k) = (n über n−k).",
            fact: .choose(n: n, k: k)
        )
    }

    // MARK: Binomial distribution

    static func parameters(_ g: UGen, level: Int) -> (n: Int, p: UQ) {
        switch level {
        case 1: return (g.int(3...4), UQ(1, 2))
        case 2: return (g.int(3...5), g.pick([UQ(1, 2), UQ(1, 10), UQ(1, 5), UQ(1, 4)]))
        default: return (g.int(4...6), g.pick([UQ(3, 10), UQ(1, 5), UQ(1, 4), UQ(7, 10), UQ(3, 4), UQ(2, 5)]))
        }
    }

    static func percentText(_ p: UQ) -> String { p.text }

    static let binomialEqual = UTemplate("s.pmf") { lv, g in
        let (n, p) = parameters(g, level: lv)
        let k = lv == 1 ? g.pick([0, n]) : g.int(0...n)
        let q = UQ.one - p
        let answer = pmf(n, p, k)
        let wrongs = [
            p.power(k) * q.power(n - k), p.power(k), UQ(binomial(n, k)) * p.power(k), UQ(binomial(n, k)) * q.power(k) * p.power(n - k),
            UQ(binomial(n, k)) * p.power(k) * q.power(n - k + 1), UQ(binomial(n, k), 2) * p.power(k),
        ]
        return probability(
            key: "s.pmf|\(n)|\(p.fraction)|\(k)", prompt: "X ist binomialverteilt mit n = \(n) und p = \(p.text). Berechne P(X = \(k)).", answer: answer, wrongs: wrongs,
            solution: "P(X = \(k)) = (\(n) über \(k)) · \(p.fraction)^\(k) · \(q.fraction)^\(n - k) = \(binomial(n, k)) · \(p.power(k).fraction) · \(q.power(n - k).fraction).",
            explanation: "Bernoulli-Formel: P(X = k) = (n über k) · pᵏ · (1−p)ⁿ⁻ᵏ; der Binomialkoeffizient zählt die Anordnungen der Treffer.",
            fact: .binomial(n: n, p: p, kind: .equal(k))
        )
    }

    static let binomialCumulative = UTemplate("s.cum") { lv, g in
        let (n, p) = parameters(g, level: max(lv, 2))
        let q = UQ.one - p
        let k = g.int(1...(n - 1))
        let variants = lv == 1 ? 1 : 3
        let variant = g.int(0...variants)
        let answer: UQ
        let text: String
        let wrongs: [UQ]
        let kind: UBinom
        func sum(_ range: ClosedRange<Int>) -> UQ { range.reduce(UQ.zero) { $0 + pmf(n, p, $1) } }
        switch variant {
        case 0:
            answer = sum(0...k); text = "P(X ≤ \(k))"; kind = .atMost(k)
            wrongs = [pmf(n, p, k), sum(0...(k - 1)), UQ.one - sum(0...k), sum(0...(k + 1))]
        case 1:
            answer = UQ.one - q.power(n); text = "die Wahrscheinlichkeit für mindestens einen Treffer"; kind = .atLeastOne
            wrongs = [p.power(n), q.power(n), UQ(n) * p, UQ.one - p.power(n)]
        case 2:
            answer = sum(k...n); text = "P(X ≥ \(k))"; kind = .atLeast(k)
            wrongs = [UQ.one - sum(0...k), sum(0...k), pmf(n, p, k), sum((k + 1)...n)]
        default:
            answer = sum(0...(k - 1)); text = "P(X < \(k))"; kind = .atMost(k - 1)
            wrongs = [sum(0...k), pmf(n, p, k), UQ.one - sum(0...(k - 1)), pmf(n, p, k - 1)]
        }
        let sol: String
        switch variant {
        case 1: sol = "Gegenereignis: 1 − P(kein Treffer) = 1 − \(q.fraction)^\(n)."
        case 2: sol = "P(X ≥ \(k)) = 1 − P(X ≤ \(k - 1)) oder die Summe von P(X = \(k)) bis P(X = \(n))."
        case 3: sol = "P(X < \(k)) = P(X ≤ \(k - 1)): addiere P(X = 0) bis P(X = \(k - 1))."
        default: sol = "Addiere P(X = 0) bis P(X = \(k))."
        }
        return probability(
            key: "s.cum|\(n)|\(p.fraction)|\(k)|\(variant)",
            prompt: variant == 1 ? "Bei einem Zufallsversuch mit p = \(p.text) wird \(n)-mal unabhängig wiederholt. Wie groß ist \(text)?" : "X ist binomialverteilt mit n = \(n) und p = \(p.text). Berechne \(text).",
            answer: answer, wrongs: wrongs, solution: sol,
            explanation: "Bei „höchstens“ addierst du die Einzelwahrscheinlichkeiten; bei „mindestens“ ist oft das Gegenereignis kürzer.",
            fact: .binomial(n: n, p: p, kind: kind)
        )
    }

    static let expectation = UTemplate("s.expect") { lv, g in
        if lv == 1 {
            let p = g.pick([UQ(1, 2), UQ(1, 4), UQ(1, 5), UQ(1, 10), UQ(3, 10)])
            let n = p.d * g.int(1...6)
            let answer = UQ(n) * p
            return UProblem.numeric(
                key: "s.expect|np|\(n)|\(p.fraction)", prompt: "X ist binomialverteilt mit n = \(n) und p = \(p.text). Wie groß ist der Erwartungswert E(X)?", answer: answer,
                wrongs: UCalc.differing([UQ(n) / p, UQ(n) + p, UQ(n) * (UQ.one - p), p], from: answer),
                solution: "E(X) = n·p = \(n)·\(p.fraction) = \(answer.fraction).", explanation: "Bei einer Binomialverteilung ist der Erwartungswert n·p.",
                fact: .expectation(n: n, p: p)
            )
        }
        if lv == 2 {
            let values = [g.int(-3...0), g.int(1...4), g.int(5...10)]
            let tenths = [g.int(1...5), g.int(1...4)]
            let last = 10 - tenths[0] - tenths[1]
            guard last >= 1 else { return nil }
            let probabilities = [UQ(tenths[0], 10), UQ(tenths[1], 10), UQ(last, 10)]
            let answer = zip(values, probabilities).reduce(UQ.zero) { $0 + UQ($1.0) * $1.1 }
            let table = zip(values, probabilities).map { "P(X = \(UText.signed($0))) = \($1.text)" }.joined(separator: "; ")
            let wrongs = [UQ(values.reduce(0, +), 3), UQ(values.max() ?? 0), UQ(values[0]) * probabilities[0] + UQ(values[1]) * probabilities[1]]
            return UProblem.numeric(
                key: "s.expect|table|\(values)|\(tenths)", prompt: "Eine Zufallsgröße X hat die Verteilung \(table). Berechne E(X).", answer: answer,
                wrongs: UCalc.differing(wrongs, from: answer),
                solution: "E(X) = Σ x · P(X = x) = \(zip(values, probabilities).map { "\(UCalc3.bracket($0))·\($1.text)" }.joined(separator: " + ")) = \(answer.text).",
                explanation: "Der Erwartungswert ist die mit den Wahrscheinlichkeiten gewichtete Summe aller Werte.",
                fact: .expectationTable(values: values.map { UQ($0) }, probabilities: probabilities)
            )
        }
        for _ in 0..<200 {
            let p = g.pick([UQ(1, 2), UQ(1, 5), UQ(1, 4), UQ(3, 10), UQ(1, 10), UQ(3, 4), UQ(4, 5)])
            let n = g.int(4...200)
            let variance = UQ(n) * p * (UQ.one - p)
            guard let root = squareRoot(variance) else { continue }
            return UProblem.numeric(
                key: "s.expect|sigma|\(n)|\(p.fraction)", prompt: "X ist binomialverteilt mit n = \(n) und p = \(p.text). Berechne die Standardabweichung σ.", answer: root,
                wrongs: UCalc.differing([variance, UQ(n) * p, UQ(n) * (UQ.one - p), root * UQ(2)], from: root),
                solution: "σ = √(n·p·(1−p)) = √(\(variance.fraction)) = \(root.fraction).", explanation: "Die Standardabweichung der Binomialverteilung ist √(n·p·(1−p)); ohne die Wurzel hättest du die Varianz.",
                fact: .sigma(n: n, p: p)
            )
        }
        return nil
    }

    static func squareRoot(_ q: UQ) -> UQ? {
        func isqrt(_ n: Int) -> Int? {
            guard n >= 0 else { return nil }
            let r = Int(Double(n).squareRoot().rounded())
            return r * r == n ? r : nil
        }
        guard let top = isqrt(q.n), let bottom = isqrt(q.d) else { return nil }
        return UQ(top, bottom)
    }

    // MARK: Conditional probability

    static func randomTable(_ g: UGen) -> UTable? {
        let total = g.pick([100, 100, 200, 1000])
        for _ in 0..<100 {
            let step = total / 20
            let cells = (0..<3).map { _ in g.int(1...6) * step }
            let rest = total - cells.reduce(0, +)
            if rest >= step { return UTable(a: cells[0], b: cells[1], c: cells[2], d: rest) }
        }
        return nil
    }

    static func value(_ t: UTable, _ ask: UAsk) -> UQ {
        let n = t.total
        switch ask {
        case .pA: return UQ(t.a + t.b, n)
        case .pB: return UQ(t.a + t.c, n)
        case .pAandB: return UQ(t.a, n)
        case .pAorB: return UQ(t.a + t.b + t.c, n)
        case .pNotAandB: return UQ(t.c, n)
        case .pNotAandNotB: return UQ(t.d, n)
        case .pAgivenB: return UQ(t.a, t.a + t.c)
        case .pBgivenA: return UQ(t.a, t.a + t.b)
        case .pNotBgivenA: return UQ(t.b, t.a + t.b)
        }
    }

    static func given(_ t: UTable) -> String {
        "P(A) = \(value(t, .pA).text), P(B) = \(value(t, .pB).text), P(A∩B) = \(value(t, .pAandB).text)"
    }

    static let table = UTemplate("s.table") { lv, g in
        guard let t = randomTable(g) else { return nil }
        let ask = g.pick([UAsk.pAorB, .pNotAandB, .pNotAandNotB])
        let answer = value(t, ask)
        let name: String
        let wrong: [UQ]
        let how: String
        switch ask {
        case .pAorB:
            name = "P(A∪B)"; wrong = [value(t, .pA) + value(t, .pB), value(t, .pAandB), value(t, .pA) * value(t, .pB), UQ.one - value(t, .pAandB)]
            how = "P(A∪B) = P(A) + P(B) − P(A∩B)."
        case .pNotAandB:
            name = "P(¬A∩B)"; wrong = [UQ.one - value(t, .pA), value(t, .pB), value(t, .pAandB), value(t, .pB) + value(t, .pAandB)]
            how = "P(¬A∩B) = P(B) − P(A∩B)."
        default:
            name = "P(¬A∩¬B)"; wrong = [UQ.one - value(t, .pA) - value(t, .pB), value(t, .pAorB), (UQ.one - value(t, .pA)) * (UQ.one - value(t, .pB)), UQ.one - value(t, .pAandB)]
            how = "P(¬A∩¬B) = 1 − P(A∪B)."
        }
        return probability(
            key: "s.table|\(t.a)|\(t.b)|\(t.c)|\(ask)", prompt: "Für zwei Ereignisse gilt \(given(t)). Wie groß ist \(name)?", answer: answer, wrongs: wrong,
            solution: "\(how) Mit der Vierfeldertafel: \(answer.text).", explanation: "Eine Vierfeldertafel ordnet alle vier Zellen A∩B, A∩¬B, ¬A∩B, ¬A∩¬B; Zeilen- und Spaltensummen liefern die fehlenden Werte.",
            fact: .table(t, ask)
        )
    }

    static let conditional = UTemplate("s.cond") { lv, g in
        for _ in 0..<100 {
            guard let t = randomTable(g) else { continue }
            let ask = g.pick(lv == 3 ? [UAsk.pAgivenB, .pBgivenA, .pNotBgivenA] : [UAsk.pAgivenB, .pBgivenA])
            let answer = value(t, ask)
            guard answer.isNice, !(ask == .pAgivenB && answer == value(t, .pBgivenA)) else { continue }
            let name: String
            let wrong: [UQ]
            let how: String
            switch ask {
            case .pAgivenB:
                name = "P(A|B)"; how = "P(A|B) = P(A∩B) / P(B) = \(value(t, .pAandB).text) / \(value(t, .pB).text)."
                wrong = [value(t, .pAandB), value(t, .pBgivenA), value(t, .pA), value(t, .pA) * value(t, .pB)]
            case .pBgivenA:
                name = "P(B|A)"; how = "P(B|A) = P(A∩B) / P(A) = \(value(t, .pAandB).text) / \(value(t, .pA).text)."
                wrong = [value(t, .pAandB), value(t, .pAgivenB), value(t, .pB), value(t, .pA) * value(t, .pB)]
            default:
                name = "P(¬B|A)"; how = "P(¬B|A) = 1 − P(B|A) = 1 − \(value(t, .pBgivenA).text)."
                wrong = [value(t, .pBgivenA), value(t, .pAandB), value(t, .pA) - value(t, .pAandB), UQ.one - value(t, .pAgivenB)]
            }
            return probability(
                key: "s.cond|\(t.a)|\(t.b)|\(t.c)|\(ask)", prompt: "Für zwei Ereignisse gilt \(given(t)). Wie groß ist \(name)?", answer: answer, wrongs: wrong,
                solution: how, explanation: "Die bedingte Wahrscheinlichkeit teilt P(A∩B) durch die Wahrscheinlichkeit der Bedingung; P(A∩B) und P(A|B) sind verschiedene Größen.",
                fact: .table(t, ask)
            )
        }
        return nil
    }

    static let independent = "Ja, denn P(A∩B) = P(A)·P(B)."
    static let greater = "Nein, denn P(A∩B) ist größer als P(A)·P(B)."
    static let smaller = "Nein, denn P(A∩B) ist kleiner als P(A)·P(B)."

    /// A table in which A and B are independent: percentages of A and B whose product is a whole percentage.
    static func independentTable(_ g: UGen) -> UTable? {
        let shares = [20, 25, 40, 50, 60, 80]
        for _ in 0..<100 {
            let pa = g.pick(shares), pb = g.pick(shares)
            guard (pa * pb) % 100 == 0 else { continue }
            let both = pa * pb / 100
            let t = UTable(a: both, b: pa - both, c: pb - both, d: 100 - pa - pb + both)
            if t.a > 0, t.b > 0, t.c > 0, t.d > 0 { return t }
        }
        return nil
    }

    static let independence = UTemplate("s.indep") { lv, g in
        let t: UTable
        if g.chance(0.4), let made = independentTable(g) { t = made }
        else if let made = randomTable(g) { t = made }
        else { return nil }
        let pA = value(t, .pA), pB = value(t, .pB), both = value(t, .pAandB)
        let product = pA * pB
        let correct = both == product ? independent : (both > product ? greater : smaller)
        return UProblem.choice(
            key: "s.indep|\(t.a)|\(t.b)|\(t.c)", prompt: "Für zwei Ereignisse gilt \(given(t)). Sind A und B stochastisch unabhängig?", correct: correct,
            wrong: [independent, greater, smaller].filter { $0 != correct },
            solution: "P(A)·P(B) = \(pA.text)·\(pB.text) = \(product.text) und P(A∩B) = \(both.text). \(correct)",
            explanation: "A und B sind genau dann unabhängig, wenn P(A∩B) = P(A)·P(B) gilt.", fact: .independence(t)
        )
    }

    static let bayes = UTemplate("s.bayes") { lv, g in
        for _ in 0..<300 {
            let pA = g.pick([UQ(1, 10), UQ(1, 5), UQ(1, 4), UQ(2, 5), UQ(1, 2)])
            let pBA = g.pick([UQ(1, 2), UQ(4, 5), UQ(9, 10), UQ(3, 4)])
            let pBn = g.pick([UQ(1, 10), UQ(1, 5), UQ(1, 20), UQ(3, 10)])
            let total = 1000
            let counts = [pA * pBA, pA * (UQ.one - pBA), (UQ.one - pA) * pBn, (UQ.one - pA) * (UQ.one - pBn)].map { $0 * UQ(total) }
            guard counts.allSatisfy({ $0.isInt }) else { continue }
            let t = UTable(a: counts[0].n, b: counts[1].n, c: counts[2].n, d: counts[3].n)
            let askPosterior = lv == 3
            let answer = value(t, askPosterior ? .pAgivenB : .pB)
            guard answer.isNice else { continue }
            let wrongs: [UQ] = askPosterior
                ? [pBA, pA * pBA, pA, value(t, .pB), pBA / value(t, .pB)]
                : [pA * pBA, pBA + pBn, pBn, (pBA + pBn) / UQ(2)]
            return probability(
                key: "s.bayes|\(pA.fraction)|\(pBA.fraction)|\(pBn.fraction)|\(askPosterior)",
                prompt: "Im Baumdiagramm gilt P(A) = \(pA.text), P(B|A) = \(pBA.text) und P(B|¬A) = \(pBn.text). \(askPosterior ? "Wie groß ist P(A|B)?" : "Wie groß ist P(B)?")",
                answer: answer, wrongs: wrongs,
                solution: askPosterior
                    ? "Auf 1000 Fälle: \(t.a) mit A und B, \(t.c) mit ¬A und B. P(A|B) = \(t.a)/\(t.a + t.c)."
                    : "Totale Wahrscheinlichkeit: P(B) = P(A)·P(B|A) + P(¬A)·P(B|¬A) = \(t.a + t.c)/1000.",
                explanation: askPosterior ? "Die gesuchte Wahrscheinlichkeit P(A|B) ist der Anteil von A unter allen Fällen, in denen B eintritt, nicht P(B|A)."
                    : "Alle Pfade, die zu B führen, addierst du; jeder Pfad ist das Produkt seiner Wahrscheinlichkeiten.",
                fact: .table(t, askPosterior ? .pAgivenB : .pB)
            )
        }
        return nil
    }
}
