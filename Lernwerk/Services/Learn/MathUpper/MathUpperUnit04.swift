import Foundation

/// Unit 4: exponential function and logarithm (derivative, antiderivative, logarithm laws, equations).
enum MathUpperUnit04 {
    static let templates: [UTemplate] = [derivative, antiderivative, valueAtZero, inverse, lnDerivative, logValue, lawChoice, lawCalculation, solveEquation, lnSolve]

    /// "3e^(2x)", "e^x", "−e^(−x)", "2e^(3x)/5".
    static func expText(_ coefficient: UQ, _ k: Int) -> String {
        let exponent = k == 1 ? "x" : (k == -1 ? "(−x)" : "(\(UText.signed(k))x)")
        let magnitude = coefficient.magnitude
        let head = magnitude.n == 1 ? "" : "\(magnitude.n)"
        let tail = magnitude.d == 1 ? "" : "/\(magnitude.d)"
        return (coefficient.n < 0 ? "−" : "") + head + "e^" + exponent + tail
    }

    static func exponentName(_ k: Int) -> String { k == 1 ? "x" : (k == -1 ? "−x" : "\(UText.signed(k))x") }

    static func function(_ a: Int, _ k: Int, _ b: Int) -> String {
        var text = expText(UQ(a), k)
        if b != 0 { text += (b < 0 ? " − " : " + ") + (abs(b) == 1 ? "" : "\(abs(b))") + "x²" }
        return text
    }

    static let derivative = UTemplate("e.deriv", pairs: { _, g in
        var items: [(front: String, back: String)] = []
        var ks = Set<Int>()
        for _ in 0..<60 where items.count < 4 {
            let k = g.int(2...6), a = g.int(1...4)
            if ks.insert(k).inserted {
                items.append(("f(x) = " + expText(UQ(a), k), "f′(x) = " + expText(UQ(a * k), k)))
            }
        }
        return items.count == 4 ? items : nil
    }) { lv, g in
        let k = lv == 1 ? g.pick([1, 2, 3, 4, 5]) : g.nonzero(-4...5)
        let a = lv == 1 ? 1 : g.nonzero(-4...4)
        let b = lv == 3 ? g.nonzero(-3...4) : 0
        let secondPart: (UQ) -> String = { c in
            b == 0 ? "" : (c.n < 0 ? " − " : " + ") + (c.magnitude.n == 1 ? "" : "\(c.magnitude.n)") + "x"
        }
        let secondCorrect = secondPart(UQ(2 * b)), secondWrong = secondPart(UQ(b))
        let correct = expText(UQ(a * k), k) + secondCorrect
        let noChain = expText(UQ(a), k) + secondCorrect
        let integrated = expText(UQ(a, k), k) + secondCorrect
        let power = (a * k == 1 ? "" : (a * k == -1 ? "−" : UText.signed(a * k))) + "x·e^(\(exponentName(k)) − 1)" + secondCorrect
        var wrong = [noChain, integrated, power]
        if b != 0 { wrong.append(correct.replacingOccurrences(of: secondCorrect, with: secondWrong)) }
        if a != 1 { wrong.append(expText(UQ(k), k) + secondCorrect) }
        return UProblem.choice(
            key: "e.deriv|\(a)|\(k)|\(b)", prompt: "Bilde die Ableitung von f(x) = \(function(a, k, b)).", correct: correct, wrong: wrong,
            solution: "Kettenregel: (e^(kx))′ = k·e^(kx). Hier k = \(k): \(correct).",
            explanation: "Beim Ableiten von e^(kx) kommt die innere Ableitung k als Faktor dazu; der Exponent bleibt unverändert.",
            fact: .expDeriv(a: a, k: k, b: b)
        )
    }

    static let antiderivative = UTemplate("e.anti") { lv, g in
        let k = lv == 1 ? g.pick([1, 2, 3, 4]) : g.nonzero(-4...5)
        let a = lv == 1 ? 1 : g.nonzero(-4...4)
        let correct = expText(UQ(a, k), k) + " + C"
        let wrong = [
            expText(UQ(a * k), k) + " + C", expText(UQ(a), k) + " + C",
            "\(UText.coefficient(a))e^(\(exponentName(k)) + 1)/(\(exponentName(k)) + 1) + C",
        ]
        return UProblem.choice(
            key: "e.anti|\(a)|\(k)", prompt: "Welche Funktion ist eine Stammfunktion von f(x) = \(expText(UQ(a), k))?", correct: correct, wrong: wrong,
            solution: "∫ e^(kx) dx = (1/k)·e^(kx) + C, hier mit k = \(k) und dem Faktor \(a): \(correct).",
            explanation: "Beim Aufleiten von e^(kx) musst du durch k teilen; zur Probe leitest du das Ergebnis ab.",
            fact: .expAnti(a: a, k: k)
        )
    }

    static let valueAtZero = UTemplate("e.zero") { lv, g in
        let a = g.nonzero(-4...4), k = g.nonzero(lv == 1 ? 1...4 : -4...4), b = g.nonzero(-5...5), c = g.int(-5...5)
        let askDerivative = g.chance(0.6)
        let f: (Double) -> Double = { Double(a) * exp(Double(k) * $0) + Double(b) * $0 + Double(c) }
        let name = expText(UQ(a), k) + (b < 0 ? " − " : " + ") + (abs(b) == 1 ? "" : "\(abs(b))") + "x" + (c == 0 ? "" : (c < 0 ? " − " : " + ") + "\(abs(c))")
        let answer = UQ(askDerivative ? a * k + b : a + c)
        let wrongs = askDerivative
            ? [UQ(a + c), UQ(a * k), UQ(a + b), UQ(k + b), UQ(a)]
            : [UQ(a * k + b), UQ(a + b + c), UQ(c), UQ(a * k + c), UQ(a)]
        return UProblem.numeric(
            key: "e.zero|\(name)|\(askDerivative)", prompt: "Berechne \(askDerivative ? "f′(0)" : "f(0)") für f(x) = \(name).",
            answer: answer, wrongs: UCalc.differing(wrongs, from: answer),
            solution: askDerivative
                ? "f′(x) = \(UQ(a * k).text)·e^(\(exponentName(k))) + \(b); wegen e⁰ = 1 ist f′(0) = \(a * k) + \(b) = \(answer.text)."
                : "Wegen e⁰ = 1 ist f(0) = \(a) + 0 + \(c) = \(answer.text).",
            explanation: "Setzt du x = 0 ein, wird jeder Exponent 0, und e⁰ = 1.",
            fact: askDerivative ? .derivOfFunction(f, at: 0) : .valueOfFunction(f, at: 0)
        )
    }

    static let inverse = UTemplate("e.inverse") { lv, g in
        let n = g.nonzero(-5...6), m = g.int(2...9)
        let items: [(String, Int, String, Double, [UQ])] = [
            ("ln(e\(UText.superscript(n)))", n, "ln und e heben sich auf: ln(e^n) = n.", Double(n), [.one, .zero, UQ(n * n), UQ(n + 1)]),
            ("e^(ln \(m))", m, "e^(ln m) = m, denn e und ln sind Umkehrfunktionen.", Double(m), [.one, .zero, UQ(m * m), UQ(m + 1)]),
            ("ln(1)", 0, "e⁰ = 1, also ln(1) = 0.", 0, [.one, UQ(-1), UQ(2)]),
            ("ln(e)", 1, "e¹ = e, also ln(e) = 1.", 1, [.zero, UQ(2), UQ(-1)]),
        ]
        let pick = lv == 1 ? g.pick([items[2], items[3], items[1]]) : g.pick(items)
        let answer = UQ(pick.1)
        let wrongs = UCalc.differing(pick.4, from: answer)
        return UProblem.numeric(
            key: "e.inverse|\(pick.0)", prompt: "Berechne \(pick.0).", answer: answer, wrongs: wrongs, solution: pick.2 + " Ergebnis: \(answer.text).",
            explanation: "Exponentialfunktion und natürlicher Logarithmus sind Umkehrfunktionen voneinander.", fact: .approx(pick.3)
        )
    }

    static let lnDerivative = UTemplate("e.lnDeriv") { lv, g in
        let c = g.nonzero(lv == 1 ? 1...5 : -5...6), p = g.pick([1, 2, 4, 5])
        let b = lv == 3 ? g.nonzero(-3...3) : 0
        let answer = UQ(c, p) + UQ(2 * b * p)
        let wrongs = [UQ(c * p), UQ(1, p), UQ(c, p * p), UQ(c), UQ(c, p) + UQ(b * p)]
        let tail = b == 0 ? "" : (b < 0 ? " − " : " + ") + (abs(b) == 1 ? "" : "\(abs(b))") + "x²"
        let head = c == 1 ? "ln(x)" : (c == -1 ? "−ln(x)" : "\(UText.signed(c))·ln(x)")
        let f: (Double) -> Double = { Double(c) * log($0) + Double(b) * $0 * $0 }
        return UProblem.numeric(
            key: "e.lnDeriv|\(c)|\(p)|\(b)", prompt: "Berechne f′(\(p)) für f(x) = \(head)\(tail).", answer: answer, wrongs: UCalc.differing(wrongs, from: answer),
            solution: "(ln x)′ = 1/x, also f′(x) = \(c)/x\(b == 0 ? "" : " + \(2 * b)x"). Bei x = \(p): \(answer.text).",
            explanation: "Die Ableitung von ln(x) ist 1/x; ein Faktor davor bleibt erhalten.", fact: .derivOfFunction(f, at: Double(p))
        )
    }

    static func logName(_ base: Int, _ argument: String) -> String { "log\(UText.subscripted(base))(\(argument))" }

    static let logValue = UTemplate("e.log") { lv, g in
        let base = g.pick(lv == 1 ? [2, 3, 10] : [2, 3, 5, 10])
        let n = g.int(lv == 1 ? 1...4 : 2...5)
        var argument = 1
        for _ in 0..<n { argument *= base }
        if argument > 100_000 { return nil }
        let answer = UQ(n)
        let wrongs = UCalc.differing([UQ(argument / base), UQ(argument), UQ(argument, base), UQ(n + 1), UQ(n - 1)], from: answer)
        return UProblem.numeric(
            key: "e.log|\(base)|\(n)", prompt: "Berechne \(logName(base, "\(argument)")).", answer: answer, wrongs: wrongs,
            solution: "\(base)^\(n) = \(argument), also \(logName(base, "\(argument)")) = \(n).",
            explanation: "log_b(x) ist der Exponent, mit dem du b potenzieren musst, um x zu erhalten.", fact: .approx(log(Double(argument)) / log(Double(base)))
        )
    }

    static let lawChoice = UTemplate("e.lawChoice") { lv, g in
        let which = g.int(0...2)
        let base = g.pick([0, 2, 3, 5, 10])
        let name = base == 0 ? "ln" : "log\(UText.subscripted(base))"
        let L: (Double) -> Double = { base == 0 ? log($0) : log($0) / log(Double(base)) }
        let correct: String
        let wrong: [String]
        let c: (Double, Double) -> (Double, Double)
        let w: [(Double, Double) -> (Double, Double)]
        let rule: String
        let subject: String
        switch which {
        case 0:
            subject = "\(name)(a·b)"
            correct = "Summe: \(name)(a) + \(name)(b)"
            wrong = ["Produkt: \(name)(a) · \(name)(b)", "Logarithmus der Summe: \(name)(a + b)", "Summe: \(name)(a) + b"]
            c = { a, b in (L(a * b), L(a) + L(b)) }
            w = [{ a, b in (L(a * b), L(a) * L(b)) }, { a, b in (L(a * b), L(a + b)) }, { a, b in (L(a * b), L(a) + b) }]
            rule = "Ein Produkt im Logarithmus wird zur Summe der Logarithmen."
        case 1:
            subject = "\(name)(a/b)"
            correct = "Differenz: \(name)(a) − \(name)(b)"
            wrong = ["Quotient: \(name)(a) / \(name)(b)", "Logarithmus der Differenz: \(name)(a − b)", "Summe: \(name)(a) + \(name)(b)"]
            c = { a, b in (L(a / b), L(a) - L(b)) }
            w = [{ a, b in (L(a / b), L(a) / L(b)) }, { a, b in (L(a / b), L(a - b)) }, { a, b in (L(a / b), L(a) + L(b)) }]
            rule = "Ein Quotient im Logarithmus wird zur Differenz der Logarithmen."
        default:
            subject = "\(name)(aⁿ)"
            correct = "Faktor vor dem Logarithmus: n·\(name)(a)"
            wrong = ["Potenz des Logarithmus: (\(name) a)ⁿ", "Summe: \(name)(a) + n", "Faktor im Argument: \(name)(n·a)"]
            c = { a, _ in (L(pow(a, 3)), 3 * L(a)) }
            w = [{ a, _ in (L(pow(a, 3)), pow(L(a), 3)) }, { a, _ in (L(pow(a, 3)), L(a) + 3) }, { a, _ in (L(pow(a, 3)), L(3 * a)) }]
            rule = "Ein Exponent im Argument wird zum Faktor vor dem Logarithmus."
        }
        return UProblem.choice(
            key: "e.lawChoice|\(which)|\(base)", prompt: "Wie lässt sich \(subject) umformen? Es gilt a, b > 0 und n ≥ 1.", correct: correct, wrong: wrong,
            solution: "\(rule) Richtig ist: \(correct)", explanation: "Die Logarithmusgesetze verwandeln Rechenarten eine Stufe niedriger: Produkt zu Summe, Quotient zu Differenz, Potenz zu Produkt.",
            fact: .law(correct: c, wrong: w)
        )
    }

    static let lawCalculation = UTemplate("e.laws") { lv, g in
        let base = g.pick([2, 3, 5])
        let m = g.int(1...4), n = g.int(1...3)
        func power(_ e: Int) -> Int { (0..<e).reduce(1) { x, _ in x * base } }
        let variant = lv == 2 ? g.int(0...1) : g.int(0...3)
        let text: String
        let answer: Int
        let wrongs: [Int]
        let how: String
        switch variant {
        case 0:
            text = "\(logName(base, "\(power(m))")) + \(logName(base, "\(power(n))"))"
            answer = m + n
            wrongs = [m * n, m - n, power(m) + power(n)]
            how = "\(m) + \(n) = \(m + n); oder zusammen: \(logName(base, "\(power(m + n))"))."
        case 1:
            text = "\(logName(base, "\(power(m + n))")) − \(logName(base, "\(power(n))"))"
            answer = m
            wrongs = [m + 2 * n, m * n, power(m)]
            how = "\(m + n) − \(n) = \(m)."
        case 2:
            text = "\(n + 1)·\(logName(base, "\(power(m))"))"
            answer = (n + 1) * m
            wrongs = [m + n + 1, power(m * (n + 1)), m]
            how = "\(n + 1)·\(m) = \((n + 1) * m)."
        default:
            text = logName(base, "\(power(m))·\(power(n))")
            answer = m + n
            wrongs = [m * n, power(m + n), power(m) * power(n)]
            how = "Produkt im Argument: \(m) + \(n) = \(m + n)."
        }
        let value = Double(answer)
        return UProblem.numeric(
            key: "e.laws|\(text)", prompt: "Berechne \(text).", answer: UQ(answer), wrongs: UCalc.differing(wrongs.map { UQ($0) }, from: UQ(answer)),
            solution: how, explanation: "Wende die Logarithmusgesetze an oder berechne jeden Logarithmus einzeln als Exponent.", fact: .approx(value)
        )
    }

    static let solveEquation = UTemplate("e.solve") { lv, g in
        let bases: [(String, Double)] = lv == 1 ? [("2", 2), ("3", 3), ("10", 10)] : [("e", M_E), ("2", 2), ("3", 3), ("5", 5), ("10", 10)]
        let (name, base) = g.pick(bases)
        let k = lv == 1 ? 1 : g.int(1...3)
        let c = lv == 1 ? 0 : g.int(-2...2)
        let x0 = g.int(0...4)
        let m = k * x0 + c
        if name != "e" && m < 0 { return nil }
        if name != "e", m > 6 { return nil }
        let rhs: String
        if name == "e" { rhs = m == 0 ? "1" : "e\(UText.superscript(m))" } else { rhs = "\(Int(pow(base, Double(m))))" }
        let exponent = (k == 1 ? "x" : "\(k)x") + (c == 0 ? "" : (c < 0 ? " − " : " + ") + "\(abs(c))")
        let answer = UQ(x0)
        let wrongs = [UQ(m, k), UQ(m + c, k), UQ(m - c), UQ(m), UQ(x0 + 1)]
        return UProblem.numeric(
            key: "e.solve|\(name)|\(k)|\(c)|\(x0)", prompt: "Löse \(name)^(\(exponent)) = \(rhs).", answer: answer, wrongs: UCalc.differing(wrongs, from: answer),
            solution: "Beide Seiten sind Potenzen von \(name): \(exponent) = \(m). Daraus x = \(x0).",
            explanation: "Schreibe beide Seiten als Potenz derselben Basis und vergleiche die Exponenten.",
            fact: .powerEquation(base: base, k: UQ(k), c: UQ(c), rhs: pow(base, Double(m)))
        )
    }

    static let lnSolve = UTemplate("e.lnSolve") { lv, g in
        let a = g.pick([2, 3, 5, 6, 7, 10, 12, 20])
        let k = lv == 1 ? 1 : g.int(2...5)
        let correct = k == 1 ? "x = ln(\(a))" : "x = ln(\(a))/\(k)"
        let wrong: [String] = k == 1
            ? ["x = e^\(a)", "x = \(a)/e", "x = log₁₀(\(a))", "x = \(a) − 1"]
            : ["x = \(k)·ln(\(a))", "x = ln(\(a)/\(k))", "x = ln(\(a)) − \(k)", "x = e^(\(a)/\(k))"]
        let equation = k == 1 ? "e^x = \(a)" : "e^(\(k)x) = \(a)"
        return UProblem.choice(
            key: "e.lnSolve|\(a)|\(k)", prompt: "Welche Lösung hat \(equation)?", correct: correct, wrong: wrong,
            solution: "Logarithmieren mit ln: \(k == 1 ? "x" : "\(k)x") = ln(\(a))\(k == 1 ? "" : ", dann durch \(k) teilen"). Ergebnis: \(correct).",
            explanation: "ln ist die Umkehrfunktion von e^x; bei e^(kx) = a wird zuerst ln(a) gebildet und dann durch k geteilt.",
            fact: .lnSolve(a: a, k: k)
        )
    }
}
