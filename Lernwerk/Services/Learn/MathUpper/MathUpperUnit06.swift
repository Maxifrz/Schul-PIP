import Foundation

/// Unit 6: vectors (length, dot product, orthogonality, lines, point test, distance between two points).
enum MathUpperUnit06 {
    static let templates: [UTemplate] = [
        norm, connecting, distance, midpoint, dot, orthogonalChoice, orthogonalParameter, angle, linePoint, lineParameter, pointOnLine, direction,
    ]

    /// Whole-number vectors with a whole-number length: (a, b, c, length).
    static let triples: [(Int, Int, Int, Int)] = [
        (3, 4, 0, 5), (5, 12, 0, 13), (6, 8, 0, 10), (1, 2, 2, 3), (2, 3, 6, 7), (2, 6, 9, 11), (4, 4, 7, 9), (1, 4, 8, 9),
        (2, 10, 11, 15), (6, 6, 7, 11), (3, 4, 12, 13), (4, 8, 8, 12), (8, 9, 12, 17), (2, 2, 1, 3),
    ]

    static func vector(_ g: UGen, level: Int) -> (v: [Int], length: Int) {
        let pool = level == 1 ? Array(triples[0..<3]) : (level == 2 ? Array(triples[3..<10]) : Array(triples[3...]))
        let t = g.pick(pool)
        let parts = g.shuffled([t.0, t.1, t.2]).map { $0 * g.sign() }
        return (parts, t.3)
    }

    static func dot(_ a: [Int], _ b: [Int]) -> Int { zip(a, b).map(*).reduce(0, +) }
    static func random(_ g: UGen, _ range: ClosedRange<Int>) -> [Int] { (0..<3).map { _ in g.int(range) } }
    static let axes = ["x", "y", "z"]

    static let norm = UTemplate("v.norm", pairs: { _, g in
        var items: [(front: String, back: String)] = []
        var used = Set<Int>()
        for _ in 0..<60 where items.count < 4 {
            let (v, length) = vector(g, level: 2)
            if used.insert(length).inserted { items.append(("|a| mit a = " + UText.vector(v), "\(length)")) }
        }
        return items.count == 4 ? items : nil
    }) { lv, g in
        let (v, length) = vector(g, level: lv)
        let squares = v.map { $0 * $0 }.reduce(0, +)
        let wrongs = UCalc.differing([UQ(squares), UQ(v.map { abs($0) }.reduce(0, +)), UQ(v.map { abs($0) }.max() ?? 0), UQ(squares, 2), UQ(length + 1)], from: UQ(length))
        return UProblem.numeric(
            key: "v.norm|\(v)", prompt: "Berechne den Betrag des Vektors a = \(UText.vector(v)).", answer: UQ(length), wrongs: wrongs,
            solution: "|a| = √(\(v.map { "\(UText.signed($0))²" }.joined(separator: " + "))) = √\(squares) = \(length).",
            explanation: "Der Betrag ist die Wurzel aus der Summe der Koordinatenquadrate; ohne die Wurzel hättest du den quadrierten Betrag.",
            fact: .vecNorm(v)
        )
    }

    static func points(_ g: UGen, level: Int) -> (a: [Int], b: [Int], length: Int) {
        let (v, length) = vector(g, level: level)
        let a = random(g, -3...3)
        return (a, zip(a, v).map(+), length)
    }

    static let connecting = UTemplate("v.vecAB") { lv, g in
        let a = random(g, -4...4), b = random(g, -4...4)
        let i = g.int(0...2)
        let answer = b[i] - a[i]
        let wrongs = UCalc.differing([UQ(a[i] - b[i]), UQ(a[i] + b[i]), UQ(b[i]), UQ(a[i])], from: UQ(answer))
        return UProblem.numeric(
            key: "v.vecAB|\(a)|\(b)|\(i)", prompt: "Gegeben sind \(UText.point("A", a)) und \(UText.point("B", b)). Welche \(axes[i])-Komponente hat der Vektor AB?",
            answer: UQ(answer), wrongs: wrongs, solution: "AB = B − A; \(axes[i])-Komponente: \(UText.signed(b[i])) − \(UCalc3.bracket(a[i])) = \(answer).",
            explanation: "Verbindungsvektor: Spitze minus Fuß, also B − A, nicht A − B.", fact: .vectorComponent(from: a, to: b, index: i)
        )
    }

    static let distance = UTemplate("v.dist") { lv, g in
        let p = points(g, level: lv)
        let diff = zip(p.a, p.b).map { $1 - $0 }
        let squares = diff.map { $0 * $0 }.reduce(0, +)
        let wrongs = UCalc.differing([UQ(squares), UQ(diff.map { abs($0) }.reduce(0, +)), UQ(p.length + 1), UQ(p.length - 1)], from: UQ(p.length))
        return UProblem.numeric(
            key: "v.dist|\(p.a)|\(p.b)", prompt: "Welchen Abstand haben \(UText.point("A", p.a)) und \(UText.point("B", p.b))?", answer: UQ(p.length), wrongs: wrongs,
            solution: "AB = \(UText.vector(diff)); |AB| = √\(squares) = \(p.length).",
            explanation: "Der Abstand zweier Punkte ist der Betrag ihres Verbindungsvektors.", fact: .distance(p.a, p.b)
        )
    }

    static let midpoint = UTemplate("v.mid") { lv, g in
        let a = random(g, -4...4)
        let b = a.map { $0 + 2 * g.int(-3...3) }
        let i = g.int(0...2)
        let answer = (a[i] + b[i]) / 2
        let wrongs = UCalc.differing([UQ(a[i] + b[i]), UQ(b[i] - a[i]), UQ(b[i] - a[i], 2), UQ(b[i])], from: UQ(answer))
        return UProblem.numeric(
            key: "v.mid|\(a)|\(b)|\(i)", prompt: "Welche \(axes[i])-Koordinate hat der Mittelpunkt M der Strecke zwischen \(UText.point("A", a)) und \(UText.point("B", b))?",
            answer: UQ(answer), wrongs: wrongs, solution: "M = (A + B)/2; \(axes[i])-Koordinate: (\(UText.signed(a[i])) + \(b[i] < 0 ? "(\(b[i]))" : "\(b[i])"))/2 = \(answer).",
            explanation: "Den Mittelpunkt erhältst du, indem du die Koordinaten von A und B addierst und halbierst.", fact: .midpoint(a: a, b: b, index: i)
        )
    }

    static let dot = UTemplate("v.dot") { lv, g in
        let range = lv == 1 ? 1...4 : -4...4
        let a = random(g, range), b = random(g, range)
        let value = dot(a, b)
        let wrongs = UCalc.differing([
            UQ(a[0] * b[0] + a[1] * b[1]), UQ(zip(a, b).map { $0 + $1 }.reduce(0, +)), UQ(a.reduce(0, +) * b.reduce(0, +)),
            UQ(value - 2 * a[2] * b[2]), UQ(a[0] * b[1] + a[1] * b[2] + a[2] * b[0]),
        ], from: UQ(value))
        return UProblem.numeric(
            key: "v.dot|\(a)|\(b)", prompt: "Berechne das Skalarprodukt von a = \(UText.vector(a)) und b = \(UText.vector(b)).", answer: UQ(value), wrongs: wrongs,
            solution: "a·b = \(zip(a, b).map { "\(UText.signed($0))·\(UCalc3.bracket($1))" }.joined(separator: " + ")) = \(value).",
            explanation: "Das Skalarprodukt multipliziert gleiche Komponenten und addiert; das Ergebnis ist eine Zahl, kein Vektor.", fact: .dot(a, b)
        )
    }

    /// A vector orthogonal to a: (a2, -a1, 0) in some arrangement.
    static func orthogonalPartner(_ a: [Int], _ g: UGen) -> [Int] {
        let order = g.pick([[0, 1, 2], [1, 2, 0], [2, 0, 1]])
        let i = order[0], j = order[1], k = order[2]
        var b = [0, 0, 0]
        b[i] = a[j]
        b[j] = -a[i]
        b[k] = 0
        return b
    }

    static let orthogonalChoice = UTemplate("v.orthoChoice") { lv, g in
        for _ in 0..<100 {
            let a = random(g, -3...3)
            let b = orthogonalPartner(a, g)
            if b == [0, 0, 0] || a == [0, 0, 0] { continue }
            var wrongPairs: [([Int], [Int])] = []
            for j in 0..<3 {
                for delta in [1, -1, 2] {
                    var c = b
                    c[j] += delta
                    if dot(a, c) != 0, c != [0, 0, 0], abs(c[j]) != abs(b[j]) { wrongPairs.append((a, c)) }
                }
            }
            wrongPairs = Array(g.shuffled(wrongPairs).prefix(3))
            guard wrongPairs.count == 3 else { continue }
            func text(_ pair: ([Int], [Int])) -> String { "a = \(UText.vector(pair.0)), b = \(UText.vector(pair.1))" }
            return UProblem.choice(
                key: "v.orthoChoice|\(a)|\(b)", prompt: "Bei welchem Paar stehen die Vektoren senkrecht aufeinander?", correct: text((a, b)), wrong: wrongPairs.map(text),
                solution: "Senkrecht heißt a·b = 0. Hier: \(zip(a, b).map { "\(UText.signed($0))·\(UCalc3.bracket($1))" }.joined(separator: " + ")) = 0. Bei den anderen Paaren ist das Skalarprodukt nicht 0.",
                explanation: "Zwei Vektoren (ungleich dem Nullvektor) sind genau dann orthogonal, wenn ihr Skalarprodukt 0 ist.",
                fact: .orthogonalPair(right: (a, b), wrong: wrongPairs)
            )
        }
        return nil
    }

    static let orthogonalParameter = UTemplate("v.orthoT") { lv, g in
        for _ in 0..<300 {
            let b = random(g, -4...4)
            let a = random(g, -4...4)
            let i = g.int(0...2)
            guard b[i] != 0 else { continue }
            let others = (0..<3).filter { $0 != i }.map { a[$0] * b[$0] }.reduce(0, +)
            guard others % b[i] == 0 else { continue }
            let t = -others / b[i]
            var shown = a
            shown[i] = t
            let text = (0..<3).map { $0 == i ? "t" : UText.signed(a[$0]) }.joined(separator: " | ")
            let wrongs = UCalc.differing([UQ(others, b[i]), UQ(-others + b[i], b[i]), UQ(-a[(i + 1) % 3] * b[(i + 1) % 3], b[i]), UQ(t + 1)], from: UQ(t))
            return UProblem.numeric(
                key: "v.orthoT|\(a)|\(b)|\(i)", prompt: "Für welches t sind a = (\(text)) und b = \(UText.vector(b)) orthogonal?", answer: UQ(t), wrongs: wrongs,
                solution: "a·b = 0: \(others) + \(UCalc3.bracket(b[i]))·t = 0, also t = \(t).",
                explanation: "Orthogonal bedeutet Skalarprodukt 0; die entstehende Gleichung löst du nach t.", fact: .orthoParam(a: shown, b: b, index: i)
            )
        }
        return nil
    }

    static let angle = UTemplate("v.angle") { lv, g in
        let bases: [([Int], [Int], Int)] = [
            ([1, 0, 0], [0, 1, 0], 90), ([1, 0, 0], [1, 0, 0], 0), ([1, 1, 0], [0, 1, 0], 45), ([1, 1, 0], [1, 0, 1], 60),
            ([1, 1, 0], [-1, 1, 0], 90), ([1, 0, 0], [-1, 0, 0], 180), ([1, 1, 0], [-1, 0, 1], 120),
        ]
        let pool = lv == 1 ? Array(bases[0..<3]) : bases
        let (a0, b0, degrees) = g.pick(pool)
        let order = g.shuffled([0, 1, 2])
        let signs = [g.sign(), g.sign(), g.sign()]
        let ka = g.int(1...3), kb = g.int(1...3)
        let a = (0..<3).map { a0[order[$0]] * signs[$0] * ka }
        let b = (0..<3).map { b0[order[$0]] * signs[$0] * kb }
        let wrongs = UCalc.differing([UQ(180 - degrees), UQ(90 - degrees), UQ(2 * degrees), UQ(degrees / 2), UQ(90), UQ(45)], from: UQ(degrees))
        let n = dot(a, b)
        return UProblem.numeric(
            key: "v.angle|\(a)|\(b)", prompt: "Wie groß ist der Winkel zwischen a = \(UText.vector(a)) und b = \(UText.vector(b)) in Grad?", answer: UQ(degrees), wrongs: wrongs,
            solution: "cos φ = a·b / (|a|·|b|) mit a·b = \(n). Das ergibt \(degrees)°.",
            explanation: "Der Winkel folgt aus cos φ = a·b / (|a|·|b|); ein Skalarprodukt von 0 bedeutet 90°.", fact: .angle(a, b)
        )
    }

    static func lineText(_ a: [Int], _ u: [Int]) -> String { "g: x = \(UText.vector(a)) + t·\(UText.vector(u))" }

    static let linePoint = UTemplate("v.linePoint") { lv, g in
        let a = random(g, -4...4)
        var u = random(g, -3...3)
        if u == [0, 0, 0] { u = [1, 2, -1] }
        let t = lv == 1 ? g.int(1...3) : g.nonzero(-3...3)
        let i = g.int(0...2)
        let answer = a[i] + t * u[i]
        let wrongs = UCalc.differing([UQ(t * u[i]), UQ(a[i] + u[i]), UQ(a[i] - t * u[i]), UQ((a[i] + t) * u[i]), UQ(a[i] * u[i])], from: UQ(answer))
        return UProblem.numeric(
            key: "v.linePoint|\(a)|\(u)|\(t)|\(i)", prompt: "\(lineText(a, u)). Welche \(axes[i])-Koordinate hat der Punkt für t = \(UText.signed(t))?", answer: UQ(answer), wrongs: wrongs,
            solution: "Setze t ein: \(axes[i]) = \(UText.signed(a[i])) + \(UCalc3.bracket(t))·\(UCalc3.bracket(u[i])) = \(answer).",
            explanation: "Der Ortsvektor des Aufpunkts bleibt, dazu kommt t mal der Richtungsvektor.", fact: .linePoint(a: a, u: u, t: t, index: i)
        )
    }

    static let lineParameter = UTemplate("v.lineT") { lv, g in
        let a = random(g, -4...4)
        var u = random(g, -3...3)
        if u[0] == 0 { u[0] = g.nonzero(-3...3) }
        let t = g.nonzero(-3...3)
        let p = (0..<3).map { a[$0] + t * u[$0] }
        let wrongs = UCalc.differing([UQ(-t), UQ(p[0] - a[0]), UQ(p[0], u[0]), UQ(t + 1), UQ(p[0] + a[0], u[0])], from: UQ(t))
        return UProblem.numeric(
            key: "v.lineT|\(a)|\(u)|\(t)", prompt: "\(lineText(a, u)). Der Punkt \(UText.point("P", p)) liegt auf g. Für welches t?", answer: UQ(t), wrongs: wrongs,
            solution: "x-Koordinate: \(p[0]) = \(a[0]) + t·\(UCalc3.bracket(u[0])), also t = \(t). Die anderen Koordinaten passen mit demselben t.",
            explanation: "Ein Punkt liegt auf der Geraden, wenn alle Koordinatengleichungen dasselbe t liefern.", fact: .lineParam(a: a, u: u, p: p)
        )
    }

    static let pointOnLine = UTemplate("v.onLine") { lv, g in
        for _ in 0..<100 {
            let a = random(g, -3...3)
            var u = random(g, -3...3)
            if u.filter({ $0 != 0 }).count < 2 { u = [1, -2, 2] }
            let t = g.nonzero(-3...3)
            let p = (0..<3).map { a[$0] + t * u[$0] }
            var wrongs: [[Int]] = []
            for j in 0..<3 {
                for delta in [1, -1, 2] {
                    var c = p
                    c[j] += delta
                    if abs(c[j]) != abs(p[j]) { wrongs.append(c) }
                }
            }
            wrongs = wrongs.filter { !isOnLine(a, u, $0) }
            let chosen = Array(g.shuffled(wrongs).prefix(3))
            guard chosen.count == 3 else { continue }
            func text(_ q: [Int]) -> String { UText.point("P", q) }
            return UProblem.choice(
                key: "v.onLine|\(a)|\(u)|\(t)", prompt: "\(lineText(a, u)). Welcher Punkt liegt auf g?", correct: text(p), wrong: chosen.map(text),
                solution: "Für t = \(t) ergibt sich \(text(p)). Bei den anderen Punkten liefern die Koordinaten verschiedene t-Werte.",
                explanation: "Punktprobe: Setze den Punkt gleich a + t·u; er liegt nur dann auf der Geraden, wenn für jede Koordinate dasselbe t herauskommt.",
                fact: .onLine(a: a, u: u, right: p, wrong: chosen)
            )
        }
        return nil
    }

    static func isOnLine(_ a: [Int], _ u: [Int], _ p: [Int]) -> Bool {
        var t: UQ?
        for i in 0..<3 {
            if u[i] == 0 { if p[i] != a[i] { return false }; continue }
            let value = UQ(p[i] - a[i], u[i])
            if let known = t { if known != value { return false } } else { t = value }
        }
        return true
    }

    static let direction = UTemplate("v.dir") { lv, g in
        for _ in 0..<100 {
            let a = random(g, -3...3), b = random(g, -3...3)
            let d = zip(a, b).map { $1 - $0 }
            guard a != b, Set(d.map { abs($0) }).count == 3 else { continue }
            let wrong = [zip(a, b).map(+), b, [d[1], d[2], d[0]], [d[2], d[0], d[1]]]
            return UProblem.choice(
                key: "v.dir|\(a)|\(b)", prompt: "Welcher Richtungsvektor gehört zur Geraden durch \(UText.point("A", a)) und \(UText.point("B", b))?",
                correct: UText.vector(d), wrong: wrong.map(UText.vector),
                solution: "Richtungsvektor: AB = B − A = \(UText.vector(d)). Jedes Vielfache davon geht auch.",
                explanation: "Die Richtung der Geraden ist der Verbindungsvektor B − A; die Summe A + B oder der Ortsvektor von B zeigt in eine andere Richtung.",
                fact: .direction(a: a, b: b)
            )
        }
        return nil
    }
}

enum UCalc3 {
    /// A whole number in brackets when it is negative.
    static func bracket(_ n: Int) -> String { n < 0 ? "(\(UText.signed(n)))" : "\(n)" }
}
