import Foundation

/// Shared drawing helpers for the unit templates.
extension MathMiddleGen {
    /// A fraction between 0 and 1 in lowest terms, with a denominator from the list (each at least 2).
    func properFraction(_ denominators: [Int]) -> MathMiddleQ {
        for _ in 0..<60 {
            let denominator = pick(denominators)
            let numerator = int(1...(denominator - 1))
            if MathMiddleText.gcd(numerator, denominator) == 1 { return MathMiddleQ(numerator, denominator) }
        }
        return MathMiddleQ(1, denominators[0])
    }

    /// A whole number from the range that has no common factor with `other`.
    func coprime(to other: Int, in range: ClosedRange<Int>) -> Int? {
        for _ in 0..<60 {
            let value = int(range)
            if MathMiddleText.gcd(value, other) == 1 { return value }
        }
        return nil
    }
}

extension MathMiddleText {
    /// A quantity the way it is written in a text: with the decimal comma when that ends, else as a mixed number.
    static func amount(_ q: MathMiddleQ) -> String {
        let decimal = number(q)
        return decimal.contains("/") ? mixed(q) : decimal
    }

    /// A list the German way: "a", "a und b", "a, b und c".
    static func listed(_ items: [String]) -> String {
        guard let last = items.last else { return "" }
        guard items.count > 1 else { return last }
        return items.dropLast().joined(separator: ", ") + " und " + last
    }
}

extension MathMiddleGen {
    /// The first result of up to `tries` attempts that is not nil. A template draws its numbers inside the attempt, so
    /// a draw whose typical mistakes come out ugly (fractions in a list of whole numbers) is simply drawn again.
    func attempt<Result>(tries: Int = 40, _ body: () -> Result?) -> Result? {
        for _ in 0..<tries {
            if let result = body() { return result }
        }
        return nil
    }
}

extension Array where Element == MathMiddleQ {
    /// The values that are whole numbers; a list of wrong options for a whole-number answer keeps no ugly fractions.
    var wholes: [MathMiddleQ] { filter { $0.ok && $0.isWhole } }

    /// The values above zero.
    var positives: [MathMiddleQ] { filter { $0.ok && !$0.isNegative && !$0.isZero } }

    /// The values that end after at most `places` digits after the comma.
    func decimals(_ places: Int) -> [MathMiddleQ] {
        var scale = 1
        for _ in 0..<places { scale *= 10 }
        return filter { $0.ok && scale % $0.denominator == 0 }
    }
}

extension MathMiddleText {
    /// A number in a calculation: a negative one gets brackets, "(−3)".
    static func bracketed(_ n: Int) -> String {
        n < 0 ? "(" + int(n) + ")" : String(n)
    }

    /// A whole number with a thin space between the thousands, as it is written in Germany: 50 000.
    static func grouped(_ n: Int) -> String {
        let digits = String(abs(n))
        var result = n < 0 ? minus : ""
        for (index, character) in digits.enumerated() {
            if index > 0, (digits.count - index) % 3 == 0 { result += "\u{202F}" }
            result.append(character)
        }
        return result
    }

    /// A sum or difference with the sign in front of the second summand: "x + 3", "x − 3".
    static func plusMinus(_ n: Int) -> String {
        n < 0 ? "\(minus) \(-n)" : "+ \(n)"
    }
}
