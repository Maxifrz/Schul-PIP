import Foundation

/// Unit 2: curve sketching (roots, extrema, inflection points, monotonicity, kind of extremum, symmetry).
/// Functions are built backwards from chosen roots and extrema, so every answer is a whole number or a half.
enum MathUpperUnit02 {
    static let templates: [UTemplate] = [yIntercept, root, rootTest, symmetry, extremumX, extremumY, kind, inflection, monotone, slopeMeaning]

    struct Cubic {
        let f: UPoly
        let x1: Int
        let x2: Int
        let k: Int
        /// The x-value of the maximum and of the minimum.
        var maxX: Int { k > 0 ? x1 : x2 }
        var minX: Int { k > 0 ? x2 : x1 }
    }

    /// f' = k (x - x1)(x - x2) with x1 < x2; k = ±3 or ±6, so f has whole-number coefficients.
    static func cubic(_ g: UGen, simple: Bool = false) -> Cubic {
        for _ in 0..<300 {
            let k = g.pick(simple ? [6, 3] : [3, 6, -3, -6])
            let x1 = g.int(-3...2)
            let x2 = x1 + g.int(1...4)
            if abs(k) == 3 && (x1 + x2) % 2 != 0 { continue }
            let derivative = UPoly.fromRoots(lead: UQ(k), roots: [UQ(x1), UQ(x2)])
            let f = derivative.integral + UPoly([UQ(g.int(-6...6))])
            if f.c.allSatisfy(\.isInt) { return Cubic(f: f, x1: x1, x2: x2, k: k) }
        }
        let f = UPoly(ints: [0, 0, -3, 2])
        return Cubic(f: f, x1: 0, x2: 1, k: 6)
    }

    static let yIntercept = UTemplate("k.yaxis") { lv, g in
        let f = lv == 1 ? g.poly(degree: 2, terms: 3, coefficients: 1...6) : g.poly(degree: 3, terms: 4, coefficients: 1...7)
        let c = f.coefficient(0), b = f.coefficient(1)
        guard !c.isZero else { return nil }
        return UProblem.numeric(
            key: "k.yaxis|\(f.text)", prompt: "Bei welchem y-Wert schneidet der Graph von \(UCalc.fx(f)) die y-Achse?",
            answer: c, wrongs: UCalc.differing([b, f.eval(.one), f.eval(UQ(-1)), f.derivative.eval(.zero)], from: c),
            solution: "Der Schnittpunkt mit der y-Achse liegt bei x = 0: f(0) = \(c.text).",
            explanation: "Auf der y-Achse ist x = 0; nur das absolute Glied bleibt übrig.", fact: .valueAt(f, .zero)
        )
    }

    static let root = UTemplate("k.root") { lv, g in
        var roots: [Int]
        var lead = 1
        switch lv {
        case 1:
            let r1 = g.int(-5...3)
            roots = [r1, r1 + g.int(1...5)]
        case 2:
            let r1 = g.int(-5...3)
            roots = [r1, r1 + g.int(1...5)]
            lead = g.pick([2, 3, -1, -2])
        default:
            var set = Set([0])
            while set.count < 3 { set.insert(g.int(-4...4)) }
            roots = set.sorted()
            lead = g.pick([1, 1, 2, -1])
        }
        let f = UPoly.fromRoots(lead: UQ(lead), roots: roots.map { UQ($0) })
        let largest = g.chance(0.5)
        let answer = UQ(largest ? roots.last! : roots.first!)
        let sum = UQ(roots.reduce(0, +)), product = UQ(roots.reduce(1, *))
        let others = roots.filter { UQ($0) != answer }.map { UQ($0) }
        let wrongs = UCalc.differing(others + [sum, product, f.coefficient(0)], from: answer)
        let how = lv == 3 ? "Klammere x aus und löse den Rest. " : "Löse f(x) = 0. "
        return UProblem.numeric(
            key: "k.root|\(f.text)|\(largest)",
            prompt: "Bestimme die \(largest ? "größte" : "kleinste") Nullstelle von \(UCalc.fx(f)).", answer: answer, wrongs: wrongs,
            solution: "\(how)Die Nullstellen sind \(roots.map(String.init).joined(separator: ", ")); die \(largest ? "größte" : "kleinste") ist \(answer.text).",
            explanation: "Eine Nullstelle ist ein x mit f(x) = 0; bei einem Produkt reicht es, wenn ein Faktor null ist.",
            fact: .root(f, largest: largest)
        )
    }

    static let rootTest = UTemplate("k.rootTest") { lv, g in
        let r1 = g.int(-5...3)
        let roots = lv == 1 ? [r1, r1 + g.int(1...4)] : [r1, r1 + g.int(1...4), g.int(-5...5)]
        let f = UPoly.fromRoots(lead: .one, roots: roots.map { UQ($0) })
        let r = UQ(roots[0])
        let candidates = [-r, r + .one, r - .one, UQ(roots[0] + roots[1]), f.coefficient(0), r * UQ(2)]
        let wrongs = candidates.filter { f.eval($0) != .zero }
        return UProblem.numeric(
            key: "k.rootTest|\(f.text)", prompt: "Welche Zahl ist eine Nullstelle von \(UCalc.fx(f))?", answer: r, wrongs: wrongs,
            solution: "Setze ein: f(\(r.text)) = 0. Bei den anderen Zahlen kommt nicht 0 heraus.",
            explanation: "Eine Zahl ist genau dann Nullstelle, wenn beim Einsetzen 0 herauskommt.", fact: .root(f, largest: false), typed: false
        )
    }

    static let symmetry = UTemplate("k.sym") { lv, g in
        let want = g.pick([USymmetry.yAxis, .origin, .neither])
        var exponents: [Int]
        switch want {
        case .yAxis:
            exponents = lv == 1 ? [2, 0] : [4, 2, 0]
            if lv == 3 { exponents = [4, 2] }
        case .origin:
            exponents = lv == 1 ? [3, 1] : [5, 3, 1]
            if lv == 3 { exponents = [3, 1] }
        case .neither:
            exponents = lv == 1 ? [2, 1] : [3, 2, 0]
            if lv == 3 { exponents = [4, 1] }
        }
        let f = UPoly(terms: exponents.map { ($0, UQ(g.nonzero(-5...5))) })
        let correct: String
        switch want {
        case .yAxis: correct = "achsensymmetrisch zur y-Achse"
        case .origin: correct = "punktsymmetrisch zum Ursprung"
        case .neither: correct = "weder noch"
        }
        let all = ["achsensymmetrisch zur y-Achse", "punktsymmetrisch zum Ursprung", "weder noch"]
        return UProblem.choice(
            key: "k.sym|\(f.text)", prompt: "Wie verhält sich der Graph von \(UCalc.fx(f))?", correct: correct, wrong: all.filter { $0 != correct },
            solution: "Prüfe f(−x): Nur gerade Exponenten (auch das absolute Glied) geben f(−x) = f(x); nur ungerade Exponenten geben f(−x) = −f(x). Hier: \(correct).",
            explanation: "Gerade Exponenten ergeben die Symmetrie zur y-Achse, ungerade die zum Ursprung; bei einer Mischung gibt es keine.",
            fact: .symmetry(f, want)
        )
    }

    static let extremumX = UTemplate("k.extX") { lv, g in
        if lv == 1 {
            let a = g.pick([1, 2, -1, -2]), h = g.int(-4...4), top = g.int(-5...5)
            let f = UPoly(ints: [a * h * h + top, -2 * a * h, a])
            let isMax = a < 0
            let answer = UQ(h)
            let wrongs = UCalc.differing([UQ(2 * h), UQ(top), f.coefficient(0), f.coefficient(1)], from: answer)
            return UProblem.numeric(
                key: "k.extX|\(f.text)", prompt: "Bei welchem x liegt der \(isMax ? "Hochpunkt" : "Tiefpunkt") von \(UCalc.fx(f))?",
                answer: answer, wrongs: wrongs,
                solution: "f′(x) = \(f.derivative.text) = 0 ergibt x = \(h). f″ = \(2 * a) \(isMax ? "< 0: Hochpunkt" : "> 0: Tiefpunkt").",
                explanation: "Notwendig ist f′(x) = 0; das Vorzeichen von f″ zeigt, ob es ein Hoch- oder Tiefpunkt ist.",
                fact: .extremumX(f, max: isMax)
            )
        }
        let c = cubic(g)
        let isMax = g.chance(0.5)
        let answer = UQ(isMax ? c.maxX : c.minX)
        let other = UQ(isMax ? c.minX : c.maxX)
        let wrongs = UCalc.differing([other, UQ(c.x1 + c.x2, 2), c.f.eval(answer), c.f.coefficient(0)], from: answer)
        return UProblem.numeric(
            key: "k.extX|\(c.f.text)|\(isMax)", prompt: "Bei welchem x liegt der \(isMax ? "Hochpunkt" : "Tiefpunkt") von \(UCalc.fx(c.f))?",
            answer: answer, wrongs: wrongs,
            solution: "f′(x) = \(c.f.derivative.text) = 0 ergibt x = \(c.x1) oder x = \(c.x2). Mit f″(x) = \(c.f.derivative.derivative.text) prüfst du: Der \(isMax ? "Hochpunkt" : "Tiefpunkt") liegt bei x = \(answer.text).",
            explanation: "Bei f″(x) < 0 liegt ein Hochpunkt vor, bei f″(x) > 0 ein Tiefpunkt.", fact: .extremumX(c.f, max: isMax)
        )
    }

    static let extremumY = UTemplate("k.extY") { lv, g in
        let c = cubic(g, simple: lv == 1)
        let isMax = g.chance(0.5)
        let x = UQ(isMax ? c.maxX : c.minX)
        let answer = c.f.eval(x)
        let otherValue = c.f.eval(UQ(isMax ? c.minX : c.maxX))
        let wrongs = UCalc.differing([x, otherValue, c.f.coefficient(0), c.f.derivative.eval(x), c.f.eval(UQ(c.x1 + c.x2, 2))], from: answer)
        return UProblem.numeric(
            key: "k.extY|\(c.f.text)|\(isMax)", prompt: "Welchen y-Wert hat der \(isMax ? "Hochpunkt" : "Tiefpunkt") von \(UCalc.fx(c.f))?",
            answer: answer, wrongs: wrongs,
            solution: "Die Extremstelle ist x = \(x.text) (aus f′(x) = 0 und dem Vorzeichen von f″). Einsetzen in f: f(\(x.text)) = \(answer.text).",
            explanation: "Die Extremstelle setzt du in f ein, nicht in f′: f′ ist dort null.", fact: .extremumY(c.f, max: isMax)
        )
    }

    static let kind = UTemplate("k.kind") { lv, g in
        let names: [UExtremum: String] = [.maximum: "Hochpunkt", .minimum: "Tiefpunkt", .saddle: "Sattelpunkt"]
        let f: UPoly
        let x: Int
        let want: UExtremum
        if lv == 3 && g.chance(0.5) {
            let s = g.int(-2...3)
            f = UPoly.fromRoots(lead: .one, roots: [UQ(s), UQ(s), UQ(s)]) + UPoly([UQ(g.int(-4...4))])
            x = s
            want = .saddle
        } else {
            let c = cubic(g)
            let atMax = g.chance(0.5)
            f = c.f
            x = atMax ? c.maxX : c.minX
            want = atMax ? .maximum : .minimum
        }
        let second = f.derivative.derivative.eval(UQ(x))
        let sol: String
        switch want {
        case .saddle:
            sol = "f′(x) = \(f.derivative.text) hat bei x = \(x) eine doppelte Nullstelle, f′ wechselt dort das Vorzeichen nicht (f″(\(x)) = 0). Es ist ein Sattelpunkt."
        case .maximum:
            sol = "f′(\(x)) = 0 und f″(\(x)) = \(second.text) < 0: Hochpunkt."
        default:
            sol = "f′(\(x)) = 0 und f″(\(x)) = \(second.text) > 0: Tiefpunkt."
        }
        return UProblem.choice(
            key: "k.kind|\(f.text)|\(x)", prompt: "Der Graph von \(UCalc.fx(f)) hat bei x = \(UText.signed(x)) eine waagerechte Tangente. Welcher Punkt liegt dort vor?",
            correct: names[want]!, wrong: names.filter { $0.key != want }.map(\.value).sorted(), solution: sol,
            explanation: "f″ < 0 gibt einen Hochpunkt, f″ > 0 einen Tiefpunkt; bei f″ = 0 und ohne Vorzeichenwechsel von f′ ist es ein Sattelpunkt.",
            fact: .kindAt(f, UQ(x), want)
        )
    }

    static let inflection = UTemplate("k.inflect") { lv, g in
        let c = cubic(g, simple: lv == 1)
        let answer = UQ(c.x1 + c.x2, 2)
        let a = c.f.coefficient(3), b = c.f.coefficient(2)
        let wrongs = UCalc.differing([UQ(c.x1), UQ(c.x2), c.f.eval(answer), -b / a, -b / (a * UQ(6))], from: answer)
        return UProblem.numeric(
            key: "k.inflect|\(c.f.text)", prompt: "An welcher Stelle hat der Graph von \(UCalc.fx(c.f)) seinen Wendepunkt?",
            answer: answer, wrongs: wrongs,
            solution: "f″(x) = \(c.f.derivative.derivative.text) = 0 ergibt x = \(answer.text); f‴ ≠ 0, also liegt dort ein Wendepunkt.",
            explanation: "Eine Wendestelle erfüllt f″(x) = 0 und f‴(x) ≠ 0.", fact: .inflectionX(c.f)
        )
    }

    static let monotone = UTemplate("k.mono") { lv, g in
        let c = cubic(g)
        let betweenRising = c.k < 0
        let askRising = g.chance(0.5)
        let between = "\(UText.signed(c.x1)) < x < \(UText.signed(c.x2))"
        let outside = "x < \(UText.signed(c.x1)) oder x > \(UText.signed(c.x2))"
        let betweenIsAnswer = askRising == betweenRising
        let correct = betweenIsAnswer ? between : outside
        let wrong = [betweenIsAnswer ? outside : between, "x < \(UText.signed(c.x2))", "x > \(UText.signed(c.x1))", "x < \(UText.signed(c.x1))"]
        return UProblem.choice(
            key: "k.mono|\(c.f.text)|\(askRising)",
            prompt: "In welchem Bereich ist \(UCalc.fx(c.f)) streng monoton \(askRising ? "steigend" : "fallend")?", correct: correct,
            wrong: wrong.filter { $0 != correct },
            solution: "f′(x) = \(c.f.derivative.text) hat die Nullstellen \(c.x1) und \(c.x2). Zwischen ihnen ist f′ \(c.k > 0 ? "negativ" : "positiv"), außerhalb \(c.k > 0 ? "positiv" : "negativ"). Gesucht: \(correct).",
            explanation: "Wo f′ > 0 ist, steigt der Graph, wo f′ < 0 ist, fällt er.", fact: .monotone(c.f, lo: UQ(c.x1), hi: UQ(c.x2), askRising: askRising, answerBetween: betweenIsAnswer)
        )
    }

    static let slopeMeaning = UTemplate("k.slope") { lv, g in
        let a = g.int(1...5)
        let sign = g.int(-1...1)
        let value = sign * g.int(1...4)
        let shown = UText.signed(value)
        let fall = "Der Graph fällt an der Stelle x = \(a)."
        let rise = "Der Graph steigt an der Stelle x = \(a)."
        let flat = "Der Graph hat an der Stelle x = \(a) eine waagerechte Tangente."
        let zero = "Der Graph hat bei x = \(a) eine Nullstelle."
        let valueWrong = "Der Funktionswert ist f(\(a)) = \(shown)."
        let correct: String
        var wrong: [String]
        if sign < 0 { correct = fall; wrong = [rise, zero, valueWrong] }
        else if sign > 0 { correct = rise; wrong = [fall, zero, valueWrong] }
        else { correct = flat; wrong = [rise, fall, zero] }
        let statement = sign == 0 ? "f′(\(a)) = 0" : "f′(\(a)) = \(shown)"
        return UProblem.choice(
            key: "k.slope|\(a)|\(sign)|\(value)", prompt: "Für eine Funktion f gilt \(statement). Was folgt daraus?", correct: correct, wrong: wrong,
            solution: "f′ gibt die Steigung an: \(statement) bedeutet: \(correct)",
            explanation: "Das Vorzeichen von f′ sagt, ob der Graph steigt (+) oder fällt (−); f′ = 0 heißt waagerechte Tangente.", fact: .concept
        )
    }
}
