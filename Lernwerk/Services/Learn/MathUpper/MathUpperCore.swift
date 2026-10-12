import Foundation

/// An exact fraction with non-optional arithmetic, for the generators of the upper-school maths course.
struct UQ: Hashable, Comparable {
    let n: Int
    let d: Int

    init(_ n: Int, _ d: Int = 1) {
        if d == 0 {
            self.n = 0
            self.d = 1
            return
        }
        var a = abs(n), b = abs(d)
        while b != 0 { (a, b) = (b, a % b) }
        let g = max(a, 1)
        let sign = d < 0 ? -1 : 1
        self.n = sign * n / g
        self.d = abs(d) / g
    }

    static let zero = UQ(0)
    static let one = UQ(1)

    static func < (a: UQ, b: UQ) -> Bool { a.n * b.d < b.n * a.d }
    static func + (a: UQ, b: UQ) -> UQ { UQ(a.n * b.d + b.n * a.d, a.d * b.d) }
    static func - (a: UQ, b: UQ) -> UQ { UQ(a.n * b.d - b.n * a.d, a.d * b.d) }
    static func * (a: UQ, b: UQ) -> UQ { UQ(a.n * b.n, a.d * b.d) }
    static func / (a: UQ, b: UQ) -> UQ { UQ(a.n * b.d, a.d * b.n) }
    static prefix func - (a: UQ) -> UQ { UQ(-a.n, a.d) }

    var isInt: Bool { d == 1 }
    var isZero: Bool { n == 0 }
    var double: Double { Double(n) / Double(d) }
    var magnitude: UQ { UQ(abs(n), d) }

    func power(_ e: Int) -> UQ {
        var result = UQ.one
        for _ in 0..<max(e, 0) { result = result * self }
        return result
    }

    /// True when the decimal expansion ends after at most six digits.
    var terminates: Bool {
        var rest = d
        var twos = 0, fives = 0
        while rest % 2 == 0 { rest /= 2; twos += 1 }
        while rest % 5 == 0 { rest /= 5; fives += 1 }
        return rest == 1 && max(twos, fives) <= 6
    }

    /// A result a student can type without a calculator: a short decimal or a fraction with a small denominator.
    var isNice: Bool {
        if isInt || d <= 36 { return true }
        var rest = d
        while rest % 2 == 0 { rest /= 2 }
        while rest % 5 == 0 { rest /= 5 }
        return rest == 1 && d <= 100_000
    }

    /// "0,375" or "3/8"; whole numbers plain; with the true minus sign for display.
    var text: String { typed.replacingOccurrences(of: "-", with: "−") }

    /// The same with an ASCII hyphen, as it is stored as a typed answer.
    var typed: String { Rational(n, d)?.germanText ?? "\(n)/\(d)" }

    var fraction: String { isInt ? "\(n)" : "\(n)/\(d)" }

    var fractionDisplay: String { fraction.replacingOccurrences(of: "-", with: "−") }
}

enum UText {
    private static let asciiMinus = try? NSRegularExpression(pattern: "(?<![0-9A-Za-z])-(?=[0-9A-Za-z(])")

    /// Replaces a hyphen that is used as a sign by the real minus sign.
    static func signs(_ text: String) -> String {
        guard let asciiMinus else { return text }
        return asciiMinus.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "−")
    }

    /// "", "−" or the number: the coefficient in front of a term.
    static func coefficient(_ n: Int) -> String { n == 1 ? "" : (n == -1 ? "−" : signed(n)) }

    static let sup: [Character: Character] = [
        "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
    ]
    static let sub: [Character: Character] = [
        "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "-": "₋",
    ]

    static func superscript(_ n: Int) -> String { String(String(n).map { sup[$0] ?? $0 }) }
    static func subscripted(_ n: Int) -> String { String(String(n).map { sub[$0] ?? $0 }) }
    static func signed(_ n: Int) -> String { n < 0 ? "−\(-n)" : "\(n)" }

    /// A decimal or fraction in the form a student types it.
    static func number(_ q: UQ) -> String { q.text }

    /// A coefficient times pi: "π/3", "2π/3", "π", "0".
    static func piMultiple(_ q: UQ) -> String {
        if q.isZero { return "0" }
        let sign = q.n < 0 ? "−" : ""
        let top = abs(q.n)
        let head = top == 1 ? "π" : "\(top)π"
        return sign + (q.d == 1 ? head : "\(head)/\(q.d)")
    }

    /// A vector as row "(1 | 2 | 3)".
    static func vector(_ v: [Int]) -> String { "(" + v.map(signed).joined(separator: " | ") + ")" }
    static func point(_ name: String, _ v: [Int]) -> String { name + "(" + v.map(signed).joined(separator: " | ") + ")" }
}

/// A polynomial with exact coefficients, lowest degree first.
struct UPoly: Hashable {
    let c: [UQ]

    init(_ coefficients: [UQ]) {
        var a = coefficients
        while let last = a.last, last.isZero { a.removeLast() }
        c = a
    }

    init(ints: [Int]) { self.init(ints.map { UQ($0) }) }

    /// Coefficients by exponent: [(exponent, coefficient)].
    init(terms: [(Int, UQ)]) {
        let top = terms.map(\.0).max() ?? 0
        var a = [UQ](repeating: .zero, count: top + 1)
        for (e, q) in terms { a[e] = a[e] + q }
        self.init(a)
    }

    var degree: Int { c.count - 1 }
    var isZero: Bool { c.isEmpty }
    func coefficient(_ i: Int) -> UQ { i < c.count && i >= 0 ? c[i] : .zero }

    func eval(_ x: UQ) -> UQ {
        var result = UQ.zero
        for q in c.reversed() { result = result * x + q }
        return result
    }

    func evalDouble(_ x: Double) -> Double {
        var result = 0.0
        for q in c.reversed() { result = result * x + q.double }
        return result
    }

    var derivative: UPoly {
        guard c.count > 1 else { return UPoly([]) }
        return UPoly((1..<c.count).map { c[$0] * UQ($0) })
    }

    var integral: UPoly {
        UPoly([.zero] + c.enumerated().map { $0.element / UQ($0.offset + 1) })
    }

    static func + (a: UPoly, b: UPoly) -> UPoly {
        UPoly((0..<max(a.c.count, b.c.count)).map { a.coefficient($0) + b.coefficient($0) })
    }

    static func * (a: UPoly, b: UPoly) -> UPoly {
        guard !a.isZero, !b.isZero else { return UPoly([]) }
        var out = [UQ](repeating: .zero, count: a.c.count + b.c.count - 1)
        for (i, x) in a.c.enumerated() { for (j, y) in b.c.enumerated() { out[i + j] = out[i + j] + x * y } }
        return UPoly(out)
    }

    func scaled(_ q: UQ) -> UPoly { UPoly(c.map { $0 * q }) }

    /// lead * (x - r1) * (x - r2) ...
    static func fromRoots(lead: UQ, roots: [UQ]) -> UPoly {
        var p = UPoly([lead])
        for r in roots { p = p * UPoly([-r, .one]) }
        return p
    }

    /// "3x² − 4x + 1"; fractions as "x³/3" and "2x³/3".
    var text: String {
        guard !c.isEmpty else { return "0" }
        var out = ""
        for i in stride(from: c.count - 1, through: 0, by: -1) {
            let q = c[i]
            if q.isZero { continue }
            let magnitude = q.magnitude
            var body: String
            if i == 0 {
                body = magnitude.fraction
            } else {
                let coefficient = magnitude.n == 1 ? "" : "\(magnitude.n)"
                body = coefficient + "x" + (i == 1 ? "" : UText.superscript(i)) + (magnitude.isInt ? "" : "/\(magnitude.d)")
            }
            if out.isEmpty {
                out = (q.n < 0 ? "−" : "") + body
            } else {
                out += (q.n < 0 ? " − " : " + ") + body
            }
        }
        return out
    }
}

/// The seeded source of randomness of one node.
final class UGen {
    private var rng: LearnRandom

    init(seed: UInt64) { rng = LearnRandom(seed: seed) }

    func int(_ range: ClosedRange<Int>) -> Int { Int.random(in: range, using: &rng) }

    func nonzero(_ range: ClosedRange<Int>) -> Int {
        for _ in 0..<50 {
            let v = int(range)
            if v != 0 { return v }
        }
        return range.upperBound == 0 ? range.lowerBound : range.upperBound
    }

    func sign() -> Int { int(0...1) == 0 ? -1 : 1 }
    func chance(_ p: Double) -> Bool { Double.random(in: 0..<1, using: &rng) < p }
    func pick<T>(_ items: [T]) -> T { items[Int.random(in: 0..<items.count, using: &rng)] }
    func shuffled<T>(_ items: [T]) -> [T] { items.shuffled(using: &rng) }
    func withRandom<T>(_ body: (inout LearnRandom) -> T) -> T { body(&rng) }

    /// A random polynomial of the given degree with `terms` non-zero terms (the leading one included).
    func poly(degree: Int, terms: Int, coefficients: ClosedRange<Int> = 1...5, negatives: Bool = true) -> UPoly {
        var exponents = Set([degree])
        var candidates = Array(0..<degree)
        candidates = shuffled(candidates)
        for e in candidates where exponents.count < min(terms, degree + 1) { exponents.insert(e) }
        let list = exponents.sorted().map { e -> (Int, UQ) in
            let v = int(coefficients) * (negatives && e != degree ? sign() : 1)
            return (e, UQ(v))
        }
        return UPoly(terms: list)
    }
}

/// What a test needs to re-check an answer by another route. The fields are the raw inputs.
enum UFact {
    case derivAt(UPoly, UQ)
    case valueAt(UPoly, UQ)
    case slopeX(UPoly, UQ)
    case tangentT(UPoly, UQ)
    case tangentY(UPoly, UQ, UQ)
    case flatX(UPoly)
    case flatY(UPoly)
    case derivPoly(f: UPoly, correct: UPoly, wrong: [UPoly])
    case derivOfFunction((Double) -> Double, at: Double)
    case valueOfFunction((Double) -> Double, at: Double)
    case root(UPoly, largest: Bool)
    case extremumX(UPoly, max: Bool)
    case extremumY(UPoly, max: Bool)
    case inflectionX(UPoly)
    case kindAt(UPoly, UQ, UExtremum)
    case symmetry(UPoly, USymmetry)
    case monotone(UPoly, lo: UQ, hi: UQ, askRising: Bool, answerBetween: Bool)
    case antiderivative(f: UPoly, correct: UPoly, wrong: [UPoly])
    case definite(UPoly, UQ, UQ)
    case area(UPoly, UQ, UQ)
    case mean(UPoly, UQ, UQ)
    case upperLimit(UPoly, value: UQ)
    case combination(coefficients: [UQ], parts: [UQ])
    case integralOfFunction((Double) -> Double, from: Double, to: Double)
    case approx(Double)
    case powerEquation(base: Double, k: UQ, c: UQ, rhs: Double)
    case expDeriv(a: Int, k: Int, b: Int)
    case expAnti(a: Int, k: Int)
    case lnSolve(a: Int, k: Int)
    case law(correct: (Double, Double) -> (Double, Double), wrong: [(Double, Double) -> (Double, Double)])
    case trigValue(fn: String, degrees: Int)
    case degreesToPi(degrees: Int)
    case period(fn: String, k: UQ)
    case amplitude(a: UQ, k: UQ, d: UQ, what: UAmpKind)
    case zerosIn(fn: String, k: Int)
    case trigSolve(fn: String, value: UQ)
    case cosFromSin(sin: UQ, askTan: Bool)
    case trigDeriv(fn: String, a: Int, k: Int)
    case vecNorm([Int])
    case dot([Int], [Int])
    case orthoParam(a: [Int], b: [Int], index: Int)
    case distance([Int], [Int])
    case vectorComponent(from: [Int], to: [Int], index: Int)
    case lineParam(a: [Int], u: [Int], p: [Int])
    case linePoint(a: [Int], u: [Int], t: Int, index: Int)
    case midpoint(a: [Int], b: [Int], index: Int)
    case angle([Int], [Int])
    case onLine(a: [Int], u: [Int], right: [Int], wrong: [[Int]])
    case orthogonalPair(right: ([Int], [Int]), wrong: [([Int], [Int])])
    case direction(a: [Int], b: [Int])
    case laplaceDice(sums: [Int])
    case urn(red: Int, blue: Int, mode: UUrn)
    case choose(n: Int, k: Int)
    case binomial(n: Int, p: UQ, kind: UBinom)
    case expectation(n: Int, p: UQ)
    case expectationTable(values: [UQ], probabilities: [UQ])
    case sigma(n: Int, p: UQ)
    case table(UTable, UAsk)
    case independence(UTable)
    case pairs
    case concept
}

enum UUrn { case oneRed, twoRedWith, twoRedWithout, differentWithout }
enum UBinom { case equal(Int), atMost(Int), atLeast(Int), atLeastOne }
enum UExtremum: String { case maximum, minimum, saddle }
enum USymmetry: String { case yAxis, origin, neither }
enum UAmpKind { case amplitude, maximum, minimum, midline }

/// A Vierfeldertafel in counts: a = A and B, b = A and not B, c = not A and B, d = neither.
struct UTable: Hashable {
    let a: Int, b: Int, c: Int, d: Int
    var total: Int { a + b + c + d }
}

enum UAsk { case pA, pB, pAandB, pAorB, pNotAandB, pNotAandNotB, pAgivenB, pBgivenA, pNotBgivenA }

/// One generated question of the course.
struct UProblem {
    var key: String
    var prompt: String
    var hint: String = ""
    var number: UQ?
    var correct: String
    var wrong: [String]
    var solution: String
    var explanation: String
    var fact: UFact
    var typedAllowed: Bool = true

    var canChoice: Bool { wrong.count >= 2 }

    /// Every text of the problem with the real minus sign instead of a hyphen used as a sign.
    mutating func sanitize() {
        prompt = UText.signs(prompt)
        correct = UText.signs(correct)
        wrong = wrong.map(UText.signs)
        solution = UText.signs(solution)
        explanation = UText.signs(explanation)
    }

    /// Wrong answers without anything that reads like the right one or like each other.
    static func cleaned(_ wrong: [String], against correct: String) -> [String] {
        var seen: Set<String> = [LearnExercise.folded(correct)]
        var out: [String] = []
        for w in wrong where !w.isEmpty && seen.insert(LearnExercise.folded(w)).inserted { out.append(w) }
        return out
    }

    /// A question with a number as the answer; `wrongs` are the results of typical mistakes.
    static func numeric(
        key: String, prompt: String, hint: String = "", answer: UQ, wrongs: [UQ], solution: String,
        explanation: String, fact: UFact, typed: Bool = true
    ) -> UProblem? {
        guard answer.isNice, abs(answer.double) < 100_000 else { return nil }
        let correct = answer.text
        var texts: [String] = []
        for w in wrongs where w != answer && w.isNice && abs(w.double) < 1_000_000 { texts.append(w.text) }
        return UProblem(
            key: key, prompt: prompt, hint: hint, number: answer, correct: correct,
            wrong: cleaned(texts, against: correct), solution: solution, explanation: explanation, fact: fact,
            typedAllowed: typed
        )
    }

    /// A question whose options are terms or statements.
    static func choice(
        key: String, prompt: String, correct: String, wrong: [String], solution: String, explanation: String, fact: UFact
    ) -> UProblem? {
        let w = cleaned(wrong, against: correct)
        guard w.count >= 2 else { return nil }
        return UProblem(
            key: key, prompt: prompt, number: nil, correct: correct, wrong: w, solution: solution,
            explanation: explanation, fact: fact, typedAllowed: false
        )
    }
}

/// A template draws one problem of a level from 1 (easy) to 3 (hard); nil means the draw did not work out.
struct UTemplate {
    let id: String
    let make: (Int, UGen) -> UProblem?
    var pairs: ((Int, UGen) -> [(front: String, back: String)]?)?

    init(_ id: String, pairs: ((Int, UGen) -> [(front: String, back: String)]?)? = nil, make: @escaping (Int, UGen) -> UProblem?) {
        self.id = id
        self.make = { level, gen in
            guard var problem = make(level, gen) else { return nil }
            problem.sanitize()
            return problem
        }
        self.pairs = pairs
    }
}
