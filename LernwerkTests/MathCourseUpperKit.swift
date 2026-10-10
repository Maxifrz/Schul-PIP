import XCTest
@testable import Lernwerk

/// Independent checks for the upper-school maths course. The kit re-computes every answer another way: numeric
/// differentiation, Simpson integration, direct enumeration, plain Double arithmetic and plugging solutions back in, so a
/// mistake in a template cannot hide behind the code that produced it.
enum MathUpperKit {
    struct Draw {
        let level: Int
        let seed: UInt64
        let problem: UProblem
    }

    static var provider: any CourseProvider { MathUpperCourse.provider }

    private final class Cache { var draws: [String: [Draw]] = [:] }
    private static let cache = Cache()

    static func draws(_ id: String) -> [Draw] {
        if let cached = cache.draws[id] { return cached }
        guard let template = MathUpperCatalog.template(id) else { preconditionFailure("No template \(id)") }
        var result: [Draw] = []
        for level in 1...3 {
            for seed in 1...300 {
                let s = UInt64(seed) &* 7919 &+ UInt64(level)
                if let problem = template.make(level, UGen(seed: s)) { result.append(Draw(level: level, seed: s, problem: problem)) }
            }
        }
        cache.draws[id] = result
        return result
    }

    static var allIDs: [String] { MathUpperCatalog.units.flatMap { $0.map(\.id) } }

    // MARK: Numeric tools

    static func derivative(_ f: (Double) -> Double, _ x: Double) -> Double {
        let h = 1e-5
        return (f(x + h) - f(x - h)) / (2 * h)
    }

    static func simpson(_ f: (Double) -> Double, _ a: Double, _ b: Double, n: Int = 4000) -> Double {
        let h = (b - a) / Double(n)
        var sum = f(a) + f(b)
        for i in 1..<n { sum += f(a + Double(i) * h) * (i % 2 == 0 ? 2 : 4) }
        return sum * h / 3
    }

    static func close(_ a: Double, _ b: Double, _ tolerance: Double = 1e-4) -> Bool {
        abs(a - b) <= tolerance * (1 + max(abs(a), abs(b)))
    }

    static func minus(_ n: Int) -> String { n < 0 ? "−\(-n)" : "\(n)" }

    /// "3π/4", "π/2", "−π", "0", "4π" as a multiple of pi.
    static func parsePi(_ text: String) -> Double? {
        var t = text
        var sign = 1.0
        if t.hasPrefix("−") { sign = -1; t.removeFirst() }
        if t == "0" { return 0 }
        let parts = t.components(separatedBy: "π")
        guard parts.count == 2 else { return nil }
        let coefficient = parts[0].isEmpty ? 1.0 : Double(parts[0])
        var denominator = 1.0
        if !parts[1].isEmpty {
            guard parts[1].hasPrefix("/"), let d = Double(parts[1].dropFirst()) else { return nil }
            denominator = d
        }
        guard let c = coefficient else { return nil }
        return sign * c / denominator
    }

    static let magnitudes: [String: Double] = [
        "0": 0, "1/2": 0.5, "√2/2": 2.0.squareRoot() / 2, "√3/2": 3.0.squareRoot() / 2, "1": 1, "√3": 3.0.squareRoot(), "√3/3": 3.0.squareRoot() / 3,
    ]

    static func parseExact(_ text: String) -> Double? {
        var t = text
        var sign = 1.0
        if t.hasPrefix("−") { sign = -1; t.removeFirst() }
        return magnitudes[t].map { sign * $0 }
    }

    static func trig(_ fn: String, _ radians: Double) -> Double {
        switch fn {
        case "sin": return sin(radians)
        case "cos": return cos(radians)
        default: return tan(radians)
        }
    }

    /// Reads "P(A) = 0,4" style numbers from a prompt.
    static func promptNumber(_ prompt: String, _ label: String) -> Double? {
        let escaped = NSRegularExpression.escapedPattern(for: label)
        guard let regex = try? NSRegularExpression(pattern: escaped + " = ([0-9]+(?:,[0-9]+)?)"),
              let match = regex.firstMatch(in: prompt, range: NSRange(prompt.startIndex..., in: prompt)),
              let range = Range(match.range(at: 1), in: prompt)
        else { return nil }
        return Double(prompt[range].replacingOccurrences(of: ",", with: "."))
    }

    static func vectorText(_ v: [Int]) -> String { "(" + v.map(minus).joined(separator: " | ") + ")" }

    static func line(_ a: [Int], _ u: [Int], contains p: [Int]) -> Bool {
        var t: Double?
        for i in 0..<3 {
            if u[i] == 0 {
                if p[i] != a[i] { return false }
                continue
            }
            let value = Double(p[i] - a[i]) / Double(u[i])
            if let known = t { if abs(known - value) > 1e-12 { return false } } else { t = value }
        }
        return true
    }

    static func binomialDoubles(_ n: Int) -> [Double] {
        var row = [1.0]
        for _ in 0..<n {
            var next = [1.0]
            for i in 1..<row.count { next.append(row[i - 1] + row[i]) }
            next.append(1.0)
            row = next
        }
        return row
    }

    static func pmf(_ n: Int, _ p: Double) -> [Double] {
        let row = binomialDoubles(n)
        return (0...n).map { row[$0] * pow(p, Double($0)) * pow(1 - p, Double(n - $0)) }
    }

    // MARK: Verification of one draw

    /// Everything wrong with a drawn problem, as readable lines (empty when sound).
    static func problems(_ d: Draw) -> [String] {
        var out: [String] = []
        let p = d.problem
        func fail(_ text: String) { out.append("\(p.key): \(text)") }
        if p.prompt.isEmpty || p.solution.isEmpty || p.explanation.isEmpty || p.correct.isEmpty { fail("empty text") }
        if p.number == nil && p.typedAllowed { fail("typed allowed without a number") }
        if let n = p.number {
            if !n.isNice { fail("answer not nice \(n.fraction)") }
            if abs(n.double) >= 100_000 { fail("answer too large") }
            if let parsed = NumberCheck.parse(n.typed), parsed != Rational(n.n, n.d) { fail("typed text differs from the number") }
            if NumberCheck.parse(n.typed) == nil { fail("typed text does not parse") }
        }
        let folded = ([p.correct] + p.wrong).map(LearnExercise.folded)
        if Set(folded).count != folded.count { fail("options read the same") }
        if p.wrong.contains(p.correct) { fail("a wrong option equals the right one") }
        if p.number == nil && !p.canChoice { fail("a choice problem without two wrong options") }
        if let n = p.number, let right = NumberCheck.parse(p.correct) {
            if right != Rational(n.n, n.d) { fail("correct text is not the number") }
            for w in p.wrong where NumberCheck.parse(w) == right { fail("wrong option \(w) has the right value") }
        }
        let hyphen = try? NSRegularExpression(pattern: "(^|[ (])-[0-9a-zA-Z(]")
        for text in [p.prompt, p.correct, p.solution] + p.wrong {
            if hyphen?.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil { fail("ASCII minus used as a sign in \(text)") }
        }
        out += checkFact(d)
        return out
    }

    static func checkFact(_ d: Draw) -> [String] {
        var out: [String] = []
        let p = d.problem
        func fail(_ text: String) { out.append("\(p.key): \(text)") }
        let number = p.number?.double
        func expectNumber(_ value: Double, _ label: String) {
            guard let number else { fail("\(label): no number"); return }
            if !close(number, value) { fail("\(label): answer \(number) but recomputed \(value)") }
        }
        switch p.fact {
        case let .derivAt(f, x):
            expectNumber(derivative(f.evalDouble, x.double), "f'(a)")
        case let .valueAt(f, x):
            expectNumber(f.evalDouble(x.double), "f(a)")
        case let .slopeX(f, m):
            if let number { if !close(derivative(f.evalDouble, number), m.double) { fail("slope at the answer is not \(m.double)") } }
        case let .tangentT(f, a):
            let m = derivative(f.evalDouble, a.double)
            expectNumber(f.evalDouble(a.double) - m * a.double, "tangent t")
        case let .tangentY(f, a, b):
            let m = derivative(f.evalDouble, a.double)
            expectNumber(f.evalDouble(a.double) + m * (b.double - a.double), "tangent value")
        case let .flatX(f):
            if let number, !close(derivative(f.evalDouble, number), 0, 1e-6) { fail("slope at the answer is not 0") }
        case let .flatY(f):
            let candidates = stride(from: -40.0, through: 40.0, by: 0.5).filter { abs(f.derivative.evalDouble($0)) < 1e-9 }
            if candidates.count != 1 { fail("flat tangent not unique") } else { expectNumber(f.evalDouble(candidates[0]), "flat y") }
        case let .derivPoly(f, correct, wrong):
            for x in [-1.7, -0.4, 0.9, 2.3] {
                if !close(derivative(f.evalDouble, x), correct.evalDouble(x), 1e-3) { fail("the correct option is not the derivative") }
            }
            if f.derivative != correct { fail("exact derivative differs") }
            if correct.text != p.correct { fail("correct text differs from the polynomial") }
            let wrongTexts = Set(wrong.map(\.text))
            for w in p.wrong where !wrongTexts.contains(w) { fail("wrong option \(w) not computed from a mistake") }
            for w in wrong where w == f.derivative { fail("a mistake equals the derivative") }
        case let .derivOfFunction(f, at):
            expectNumber(derivative(f, at), "derivative of function")
        case let .valueOfFunction(f, at):
            expectNumber(f(at), "value of function")
        case let .root(f, largest):
            if let number {
                if f.eval(UQ(Int(number))) != .zero { fail("not a root") }
                let roots = (-40...40).filter { f.eval(UQ($0)) == .zero }
                if p.typedAllowed, let expected = largest ? roots.max() : roots.min(), Double(expected) != number { fail("not the \(largest ? "largest" : "smallest") root") }
                for w in p.wrong { if let q = NumberCheck.parse(w), p.typedAllowed == false, f.eval(UQ(Int(q.doubleValue))) == .zero { fail("wrong option \(w) is a root") } }
            }
        case let .extremumX(f, isMax):
            if let number {
                if !close(f.derivative.evalDouble(number), 0, 1e-9) { fail("f' not 0 at the answer") }
                let second = f.derivative.derivative.evalDouble(number)
                if isMax ? second >= 0 : second <= 0 { fail("wrong sign of f'' for \(isMax ? "max" : "min")") }
            }
        case let .extremumY(f, isMax):
            let xs = (-80...80).map { Double($0) / 2 }.filter { abs(f.derivative.evalDouble($0)) < 1e-9 && (isMax ? f.derivative.derivative.evalDouble($0) < 0 : f.derivative.derivative.evalDouble($0) > 0) }
            if xs.count != 1 { fail("extremum not unique") } else { expectNumber(f.evalDouble(xs[0]), "extremum y") }
        case let .inflectionX(f):
            if let number {
                if !close(f.derivative.derivative.evalDouble(number), 0, 1e-9) { fail("f'' not 0 at the answer") }
                if close(f.derivative.derivative.derivative.evalDouble(number), 0, 1e-9) { fail("f''' is 0") }
            }
        case let .kindAt(f, x, kind):
            let x0 = x.double
            let names: [UExtremum: String] = [.maximum: "Hochpunkt", .minimum: "Tiefpunkt", .saddle: "Sattelpunkt"]
            if names[kind] != p.correct { fail("correct text differs") }
            if Set(p.wrong + [p.correct]) != Set(names.values) { fail("options are not the three kinds") }
            if abs(f.derivative.evalDouble(x0)) > 1e-9 { fail("f' not 0") }
            let second = f.derivative.derivative.evalDouble(x0)
            let before = f.derivative.evalDouble(x0 - 0.1), after = f.derivative.evalDouble(x0 + 0.1)
            switch kind {
            case .maximum: if !(second < 0 && before > 0 && after < 0) { fail("not a maximum") }
            case .minimum: if !(second > 0 && before < 0 && after > 0) { fail("not a minimum") }
            case .saddle: if !(abs(second) < 1e-9 && before * after > 0) { fail("not a saddle point") }
            }
        case let .symmetry(f, kind):
            let texts: [USymmetry: String] = [.yAxis: "achsensymmetrisch zur y-Achse", .origin: "punktsymmetrisch zum Ursprung", .neither: "weder noch"]
            if texts[kind] != p.correct { fail("correct text differs") }
            let xs = [0.7, 1.3, 2.1]
            let even = xs.allSatisfy { close(f.evalDouble(-$0), f.evalDouble($0)) }
            let odd = xs.allSatisfy { close(f.evalDouble(-$0), -f.evalDouble($0)) }
            let actual: USymmetry = even ? .yAxis : (odd ? .origin : .neither)
            if actual != kind { fail("symmetry is \(actual)") }
        case let .monotone(f, lo, hi, askRising, answerBetween):
            let mid = (lo.double + hi.double) / 2
            let risingInside = f.derivative.evalDouble(mid) > 0
            if f.derivative.evalDouble(lo.double) != 0 || f.derivative.evalDouble(hi.double) != 0 { fail("bounds are not stationary points") }
            let outsideRising = f.derivative.evalDouble(hi.double + 1) > 0
            if risingInside == outsideRising { fail("no sign change") }
            if answerBetween != (askRising == risingInside) { fail("answer side is wrong") }
            if p.correct.contains("oder") == answerBetween { fail("correct text does not fit the side") }
            if p.prompt.contains("steigend") != askRising { fail("prompt direction differs") }
            let lowText = minus(Int(lo.double)), highText = minus(Int(hi.double))
            let expected = answerBetween ? "\(lowText) < x < \(highText)" : "x < \(lowText) oder x > \(highText)"
            if expected != p.correct { fail("correct interval text differs") }
        case let .antiderivative(f, correct, wrong):
            if correct.derivative != f { fail("F' is not f") }
            for x in [-1.3, 0.6, 2.2] { if !close(derivative(correct.evalDouble, x), f.evalDouble(x), 1e-3) { fail("numeric F' differs") } }
            if correct.text + " + C" != p.correct { fail("correct text differs") }
            let wrongTexts = Set(wrong.map { $0.text + " + C" })
            for w in p.wrong where !wrongTexts.contains(w) { fail("wrong option \(w) not computed from a mistake") }
            for w in wrong where w.derivative == f { fail("a mistake is an antiderivative") }
            if p.wrong.contains(where: { !$0.hasSuffix("+ C") }) { fail("an option without + C") }
        case let .definite(f, a, b):
            let expected = simpson(f.evalDouble, a.double, b.double)
            if let n = number { if !close(n, expected, 1e-6) { fail("definite integral \(n) vs \(expected)") } }
            else if let q = NumberCheck.parse(p.correct), !close(q.doubleValue, expected, 1e-6) { fail("definite integral text \(p.correct) vs \(expected)") }
        case let .area(f, a, b):
            expectNumber(simpson({ abs(f.evalDouble($0)) }, a.double, b.double, n: 60000), "area")
        case let .mean(f, a, b):
            expectNumber(simpson(f.evalDouble, a.double, b.double) / (b.double - a.double), "mean value")
        case let .upperLimit(f, value):
            if let number { if !close(simpson(f.evalDouble, 0, number), value.double, 1e-6) { fail("integral up to the answer is not \(value.double)") } }
            if let number, number <= 0 { fail("limit not positive") }
        case let .combination(coefficients, parts):
            expectNumber(zip(coefficients, parts).map { $0.double * $1.double }.reduce(0, +), "linear combination")
        case let .integralOfFunction(f, from, to):
            expectNumber(simpson(f, from, to), "integral of function")
        case let .approx(value):
            expectNumber(value, "approx")
        case let .powerEquation(base, k, c, rhs):
            if let number { if !close(pow(base, k.double * number + c.double), rhs, 1e-9) { fail("equation not satisfied by the answer") } }
        case let .expDeriv(a, k, b):
            let g: (Double) -> Double = { Double(a) * exp(Double(k) * $0) + Double(b) * $0 * $0 }
            let formula: (Double) -> Double = { Double(a * k) * exp(Double(k) * $0) + Double(2 * b) * $0 }
            for x in [-0.4, 0.37, 1.1] { if !close(derivative(g, x), formula(x), 1e-3) { fail("formula is not the derivative") } }
            let c = a * k
            let head = c == 1 ? "" : (c == -1 ? "−" : minus(c))
            let exponent = k == 1 ? "x" : (k == -1 ? "(−x)" : "(\(minus(k))x)")
            var expected = head + "e^" + exponent
            if b != 0 { expected += (b < 0 ? " − " : " + ") + (abs(2 * b) == 1 ? "" : "\(abs(2 * b))") + "x" }
            if expected != p.correct { fail("correct text \(p.correct) vs \(expected)") }
        case let .expAnti(a, k):
            let F: (Double) -> Double = { Double(a) / Double(k) * exp(Double(k) * $0) }
            for x in [-0.4, 0.37, 1.1] { if !close(derivative(F, x), Double(a) * exp(Double(k) * x), 1e-3) { fail("not an antiderivative") } }
            func gcd(_ x: Int, _ y: Int) -> Int { y == 0 ? abs(x) : gcd(y, x % y) }
            let g = gcd(a, k)
            var top = a / g, bottom = k / g
            if bottom < 0 { top = -top; bottom = -bottom }
            let exponent = k == 1 ? "x" : (k == -1 ? "(−x)" : "(\(minus(k))x)")
            let expected = (top < 0 ? "−" : "") + (abs(top) == 1 ? "" : "\(abs(top))") + "e^" + exponent + (bottom == 1 ? "" : "/\(bottom)") + " + C"
            if expected != p.correct { fail("correct text \(p.correct) vs \(expected)") }
        case let .lnSolve(a, k):
            let x = log(Double(a)) / Double(k)
            if !close(exp(Double(k) * x), Double(a), 1e-9) { fail("check failed") }
            let expected = k == 1 ? "x = ln(\(a))" : "x = ln(\(a))/\(k)"
            if expected != p.correct { fail("correct text differs") }
            let A = Double(a), K = Double(k)
            let known: [String: Double] = k == 1
                ? ["x = e^\(a)": exp(A), "x = \(a)/e": A / M_E, "x = log₁₀(\(a))": log10(A), "x = \(a) − 1": A - 1]
                : ["x = \(k)·ln(\(a))": K * log(A), "x = ln(\(a)/\(k))": log(A / K), "x = ln(\(a)) − \(k)": log(A) - K, "x = e^(\(a)/\(k))": exp(A / K)]
            for w in p.wrong {
                guard let value = known[w] else { fail("unknown wrong option \(w)"); continue }
                if close(value, x, 1e-9) { fail("wrong option \(w) is right") }
            }
        case let .law(correct, wrong):
            for (a, b) in [(2.3, 1.7), (5.1, 0.6), (9.0, 4.0)] {
                let (l, r) = correct(a, b)
                if !close(l, r, 1e-9) { fail("the law does not hold") }
                for w in wrong { let (wl, wr) = w(a, b); if close(wl, wr, 1e-9) { fail("a wrong law holds at \(a), \(b)") } }
            }
            if p.wrong.count > wrong.count { fail("every wrong option needs a counter-check") }
        case let .trigValue(fn, degrees):
            let value = trig(fn, Double(degrees) * Double.pi / 180)
            if let n = number { if !close(n, value, 1e-9) { fail("\(fn)(\(degrees)°) is \(value), answer \(n)") } }
            else if let sign = ["positiv": 1.0, "negativ": -1.0, "null": 0.0][p.correct] {
                if abs(value) < 1e-9 ? sign != 0 : (value > 0 ? sign != 1 : sign != -1) { fail("sign of \(fn)(\(degrees)°) is wrong") }
            } else if let parsed = parseExact(p.correct) {
                if !close(parsed, value, 1e-9) { fail("exact text \(p.correct) vs \(value)") }
                for w in p.wrong { if let pw = parseExact(w), close(pw, value, 1e-9) { fail("wrong option \(w) has the same value") } }
            } else { fail("cannot read the correct text") }
            if p.number != nil, let right = parseExact(p.correct), !close(right, value, 1e-9) { fail("fraction text differs") }
            if p.number != nil { for w in p.wrong { if let pw = parseExact(w), close(pw, value, 1e-9) { fail("wrong option \(w) has the same value") } } }
        case let .degreesToPi(degrees):
            expectNumber(Double(degrees) / 180, "degrees to pi")
            if let parsed = parsePi(p.correct), !close(parsed, Double(degrees) / 180, 1e-9) { fail("correct text \(p.correct) differs") }
            for w in p.wrong { if let pw = parsePi(w), close(pw, Double(degrees) / 180, 1e-9) { fail("wrong option \(w) equals the answer") } }
        case let .period(fn, k):
            guard let number else { break }
            let f: (Double) -> Double = { trig(fn, k.double * $0) }
            let period = number * Double.pi
            for x in [0.3, 1.1, 2.9] { if !close(f(x + period), f(x), 1e-9) { fail("not a period") } }
            for m in 2...6 { if close(f(0.3 + period / Double(m)), f(0.3), 1e-9) && close(f(1.1 + period / Double(m)), f(1.1), 1e-9) { fail("period \(period) is not the smallest") } }
            if let parsed = parsePi(p.correct), !close(parsed, number, 1e-9) { fail("correct text differs") }
        case let .amplitude(a, k, d, what):
            guard let number else { break }
            let isSin = p.prompt.contains("sin")
            let f: (Double) -> Double = { a.double * (isSin ? sin(k.double * $0) : cos(k.double * $0)) + d.double }
            let samples = (0...20000).map { f(Double($0) / 20000 * 2 * Double.pi) }
            let high = samples.max()!, low = samples.min()!
            switch what {
            case .amplitude: if !close(number, (high - low) / 2, 1e-5) { fail("amplitude") }
            case .maximum: if !close(number, high, 1e-5) { fail("maximum") }
            case .minimum: if !close(number, low, 1e-5) { fail("minimum") }
            case .midline: if !close(number, (high + low) / 2, 1e-5) { fail("midline") }
            }
        case let .zerosIn(fn, k):
            let n = 4000 * k
            var count = 0
            for i in 0...n where abs(trig(fn, Double(k) * Double(i) / Double(n) * 2 * Double.pi)) < 1e-9 { count += 1 }
            expectNumber(Double(count), "zeros")
        case let .trigSolve(fn, value):
            if let number {
                if !close(trig(fn, number * Double.pi), value.double, 1e-9) { fail("answer does not solve the equation") }
                if number < 0 || number > 0.5 + 1e-12 { fail("outside [0; pi/2]") }
                if let parsed = parsePi(p.correct), !close(parsed, number, 1e-9) { fail("text differs") }
            }
        case let .cosFromSin(s, askTan):
            let cosine = (1 - s.double * s.double).squareRoot()
            expectNumber(askTan ? s.double / cosine : cosine, askTan ? "tan" : "cos")
        case let .trigDeriv(fn, a, k):
            let g: (Double) -> Double = { Double(a) * trig(fn, Double(k) * $0) }
            let formula: (Double) -> Double = { fn == "sin" ? Double(a * k) * cos(Double(k) * $0) : -Double(a * k) * sin(Double(k) * $0) }
            for x in [-0.4, 0.37, 1.1] { if !close(derivative(g, x), formula(x), 1e-3) { fail("formula is not the derivative") } }
            let c = fn == "sin" ? a * k : -a * k
            let head = c == 1 ? "" : (c == -1 ? "−" : minus(c))
            let expected = head + (fn == "sin" ? "cos" : "sin") + "(" + (k == 1 ? "x" : "\(k)x") + ")"
            if expected != p.correct { fail("correct text \(p.correct) vs \(expected)") }
        case let .vecNorm(v):
            expectNumber(v.map { Double($0 * $0) }.reduce(0, +).squareRoot(), "norm")
        case let .dot(a, b):
            expectNumber(Double(zip(a, b).map { $0 * $1 }.reduce(0, +)), "dot product")
        case let .orthoParam(a, b, index):
            if zip(a, b).map({ $0 * $1 }).reduce(0, +) != 0 { fail("not orthogonal") }
            if let number, Double(a[index]) != number { fail("answer is not the entry") }
        case let .distance(a, b):
            var squares = 0.0
            for i in 0..<3 { let delta = Double(b[i] - a[i]); squares += delta * delta }
            expectNumber(squares.squareRoot(), "distance")
        case let .vectorComponent(from, to, index):
            expectNumber(Double(to[index] - from[index]), "component")
        case let .lineParam(a, u, q):
            if let number { for i in 0..<3 where Double(a[i]) + number * Double(u[i]) != Double(q[i]) { fail("point is not a + t u") } }
        case let .linePoint(a, u, t, index):
            expectNumber(Double(a[index] + t * u[index]), "line point")
        case let .midpoint(a, b, index):
            expectNumber(Double(a[index] + b[index]) / 2, "midpoint")
        case let .angle(a, b):
            let dot = Double(zip(a, b).map { $0 * $1 }.reduce(0, +))
            let na = a.map { Double($0 * $0) }.reduce(0, +).squareRoot(), nb = b.map { Double($0 * $0) }.reduce(0, +).squareRoot()
            expectNumber(acos(max(-1, min(1, dot / (na * nb)))) * 180 / Double.pi, "angle")
        case let .onLine(a, u, right, wrong):
            if !line(a, u, contains: right) { fail("right point is not on the line") }
            if p.correct != "P" + vectorText(right) { fail("correct text differs") }
            for w in wrong where line(a, u, contains: w) { fail("wrong point is on the line") }
            if !Set(p.wrong).isSubset(of: Set(wrong.map { "P" + vectorText($0) })) { fail("wrong options differ from the facts") }
        case let .orthogonalPair(right, wrong):
            if zip(right.0, right.1).map({ $0 * $1 }).reduce(0, +) != 0 { fail("right pair is not orthogonal") }
            if right.0 == [0, 0, 0] || right.1 == [0, 0, 0] { fail("zero vector") }
            for w in wrong where zip(w.0, w.1).map({ $0 * $1 }).reduce(0, +) == 0 { fail("wrong pair is orthogonal") }
        case let .direction(a, b):
            let d = zip(a, b).map { $1 - $0 }
            if p.correct != vectorText(d) { fail("correct vector differs") }
            for w in p.wrong where w == p.correct { fail("equal option") }
            if a == b { fail("degenerate") }
        case let .laplaceDice(sums):
            var favourable = 0
            for x in 1...6 { for y in 1...6 where sums.contains(x + y) { favourable += 1 } }
            expectNumber(Double(favourable) / 36, "dice probability")
        case let .urn(red, blue, mode):
            let balls = Array(repeating: 1, count: red) + Array(repeating: 0, count: blue)
            var good = 0, all = 0
            switch mode {
            case .oneRed: good = balls.filter { $0 == 1 }.count; all = balls.count
            case .twoRedWith:
                for x in balls { for y in balls { all += 1; if x == 1 && y == 1 { good += 1 } } }
            case .twoRedWithout, .differentWithout:
                for i in balls.indices { for j in balls.indices where i != j {
                    all += 1
                    if mode == .twoRedWithout ? (balls[i] == 1 && balls[j] == 1) : (balls[i] != balls[j]) { good += 1 }
                } }
            }
            expectNumber(Double(good) / Double(all), "urn")
        case let .choose(n, k):
            guard n >= k, k >= 0, n > 0 else { fail("degenerate n, k"); break }
            expectNumber(binomialDoubles(n)[k], "n over k")
        case let .binomial(n, pr, kind):
            let probs = pmf(n, pr.double)
            if !close(probs.reduce(0, +), 1, 1e-12) { fail("pmf does not sum to 1") }
            switch kind {
            case let .equal(k): expectNumber(probs[k], "P(X=k)")
            case let .atMost(k): expectNumber(probs[0...k].reduce(0, +), "P(X<=k)")
            case let .atLeast(k): expectNumber(probs[k...n].reduce(0, +), "P(X>=k)")
            case .atLeastOne: expectNumber(1 - pow(1 - pr.double, Double(n)), "at least one")
            }
        case let .expectation(n, pr):
            expectNumber(Double(n) * pr.double, "E(X)")
        case let .expectationTable(values, probabilities):
            if !close(probabilities.map(\.double).reduce(0, +), 1, 1e-12) { fail("probabilities do not sum to 1") }
            expectNumber(zip(values, probabilities).map { $0.double * $1.double }.reduce(0, +), "E(X) of a table")
        case let .sigma(n, pr):
            expectNumber((Double(n) * pr.double * (1 - pr.double)).squareRoot(), "sigma")
        case let .table(t, ask):
            let n = Double(t.total)
            let a = Double(t.a), b = Double(t.b), c = Double(t.c), dd = Double(t.d)
            if t.a <= 0 || t.b <= 0 || t.c <= 0 || t.d <= 0 { fail("empty cell") }
            let value: Double
            switch ask {
            case .pA: value = (a + b) / n
            case .pB: value = (a + c) / n
            case .pAandB: value = a / n
            case .pAorB: value = (a + b + c) / n
            case .pNotAandB: value = c / n
            case .pNotAandNotB: value = dd / n
            case .pAgivenB: value = a / (a + c)
            case .pBgivenA: value = a / (a + b)
            case .pNotBgivenA: value = b / (a + b)
            }
            expectNumber(value, "table probability")
            if p.prompt.hasPrefix("Für zwei Ereignisse") {
                if let pa = promptNumber(p.prompt, "P(A)"), !close(pa, (a + b) / n, 1e-12) { fail("P(A) in the prompt") }
                if let pb = promptNumber(p.prompt, "P(B)"), !close(pb, (a + c) / n, 1e-12) { fail("P(B) in the prompt") }
                if let pab = promptNumber(p.prompt, "P(A∩B)"), !close(pab, a / n, 1e-12) { fail("P(A∩B) in the prompt") }
            }
            if p.prompt.hasPrefix("Im Baumdiagramm") {
                if let pa = promptNumber(p.prompt, "P(A)"), !close(pa, (a + b) / n, 1e-12) { fail("tree P(A)") }
                if let q = promptNumber(p.prompt, "P(B|A)"), !close(q, a / (a + b), 1e-12) { fail("tree P(B|A)") }
                if let q = promptNumber(p.prompt, "P(B|¬A)"), !close(q, c / (c + dd), 1e-12) { fail("tree P(B|not A)") }
            }
        case let .independence(t):
            let n = t.total
            let left = t.a * n, right = (t.a + t.b) * (t.a + t.c)
            let expected = left == right ? "Ja, denn P(A∩B) = P(A)·P(B)." : (left > right ? "Nein, denn P(A∩B) ist größer als P(A)·P(B)." : "Nein, denn P(A∩B) ist kleiner als P(A)·P(B).")
            if expected != p.correct { fail("independence verdict differs") }
        case .pairs, .concept:
            break
        }
        return out
    }
}
