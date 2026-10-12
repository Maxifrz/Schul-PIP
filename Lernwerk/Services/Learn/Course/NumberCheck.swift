import Foundation

/// A fraction in lowest terms with a positive denominator, so equal numbers are equal values.
struct Rational: Equatable, Hashable, Comparable {
    let numerator: Int
    let denominator: Int

    init?(_ numerator: Int, _ denominator: Int) {
        guard denominator != 0, numerator != Int.min, denominator != Int.min else { return nil }
        let divisor = Rational.gcd(abs(numerator), abs(denominator))
        let sign = denominator < 0 ? -1 : 1
        self.numerator = sign * numerator / divisor
        self.denominator = abs(denominator) / divisor
    }

    init(_ whole: Int) {
        numerator = whole
        denominator = 1
    }

    var isWhole: Bool { denominator == 1 }
    var doubleValue: Double { Double(numerator) / Double(denominator) }

    static func < (a: Rational, b: Rational) -> Bool {
        let left = a.numerator.multipliedReportingOverflow(by: b.denominator)
        let right = b.numerator.multipliedReportingOverflow(by: a.denominator)
        if left.overflow || right.overflow { return a.doubleValue < b.doubleValue }
        return left.partialValue < right.partialValue
    }

    static func + (a: Rational, b: Rational) -> Rational? {
        let x = a.numerator.multipliedReportingOverflow(by: b.denominator)
        let y = b.numerator.multipliedReportingOverflow(by: a.denominator)
        let d = a.denominator.multipliedReportingOverflow(by: b.denominator)
        let n = x.partialValue.addingReportingOverflow(y.partialValue)
        guard !x.overflow, !y.overflow, !d.overflow, !n.overflow else { return nil }
        return Rational(n.partialValue, d.partialValue)
    }

    static func - (a: Rational, b: Rational) -> Rational? {
        guard let negated = Rational(-b.numerator, b.denominator) else { return nil }
        return a + negated
    }

    static func * (a: Rational, b: Rational) -> Rational? {
        let n = a.numerator.multipliedReportingOverflow(by: b.numerator)
        let d = a.denominator.multipliedReportingOverflow(by: b.denominator)
        guard !n.overflow, !d.overflow else { return nil }
        return Rational(n.partialValue, d.partialValue)
    }

    static func / (a: Rational, b: Rational) -> Rational? {
        guard b.numerator != 0 else { return nil }
        return a * Rational(b.denominator, b.numerator)!
    }

    private static func gcd(_ a: Int, _ b: Int) -> Int {
        var (x, y) = (a, b)
        while y != 0 { (x, y) = (y, x % y) }
        return max(x, 1)
    }

    /// "3/4", or "2" for a whole number.
    var fractionText: String {
        isWhole ? "\(numerator)" : "\(numerator)/\(denominator)"
    }

    /// With the decimal comma when the fraction ends after at most six digits, else as a fraction ("1/3").
    var germanText: String {
        if isWhole { return "\(numerator)" }
        var rest = denominator
        var twos = 0
        var fives = 0
        while rest % 2 == 0 { rest /= 2; twos += 1 }
        while rest % 5 == 0 { rest /= 5; fives += 1 }
        let digits = max(twos, fives)
        guard rest == 1, digits <= 6 else { return fractionText }
        var scale = 1
        for _ in 0..<digits { scale *= 10 }
        let scaled = numerator * (scale / denominator)
        let sign = scaled < 0 ? "-" : ""
        var text = String(abs(scaled))
        while text.count <= digits { text = "0" + text }
        let cut = text.index(text.endIndex, offsetBy: -digits)
        return sign + text[..<cut] + "," + text[cut...]
    }
}

/// Compares typed numbers by value: "0,75", "0.75" and "3/4" are the same answer, "34" is not. `AnswerCheck` cannot
/// do this, it reads "3/4" as the letters and digits "34".
enum NumberCheck {
    /// A whole number, a decimal fraction with comma or point, a fraction "a/b" or a mixed number "1 1/2", with a
    /// sign, and a trailing percent or degree sign that is ignored. Nothing else: no letters, no terms.
    static func parse(_ text: String) -> Rational? {
        var cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)
        for minus in ["−", "–", "—", "‐"] {
            cleaned = cleaned.replacingOccurrences(of: minus, with: "-")
        }
        cleaned = cleaned.replacingOccurrences(of: "\u{00A0}", with: " ")
        while let last = cleaned.last, last == "%" || last == "°" || last == " " {
            cleaned.removeLast()
        }
        guard !cleaned.isEmpty else { return nil }

        var negative = false
        if cleaned.hasPrefix("-") {
            negative = true
            cleaned.removeFirst()
        } else if cleaned.hasPrefix("+") {
            cleaned.removeFirst()
        }
        cleaned = cleaned.trimmingCharacters(in: .whitespaces)

        let parts = cleaned.split(separator: " ", omittingEmptySubsequences: true).map(String.init)
        var value: Rational?
        switch parts.count {
        case 1:
            value = parseUnsigned(parts[0])
        case 2:
            // "1 1/2": a whole number and a proper fraction, nothing else.
            if let whole = parseWhole(parts[0]), parts[1].contains("/"), let fraction = parseUnsigned(parts[1]),
               fraction < Rational(1) {
                value = Rational(whole) + fraction
            }
        default:
            value = nil
        }
        guard let result = value else { return nil }
        return negative ? Rational(-result.numerator, result.denominator) : result
    }

    static func matches(_ given: String, expected: String) -> Bool {
        guard let a = parse(given), let b = parse(expected) else { return false }
        return a == b
    }

    private static func parseWhole(_ text: String) -> Int? {
        guard !text.isEmpty, text.count <= 15, text.allSatisfy({ $0.isASCII && $0.isNumber }) else { return nil }
        return Int(text)
    }

    private static func parseUnsigned(_ text: String) -> Rational? {
        if let slash = text.firstIndex(of: "/") {
            let top = String(text[..<slash])
            let bottom = String(text[text.index(after: slash)...])
            guard let n = parseDecimalOrWhole(top), let d = parseDecimalOrWhole(bottom) else { return nil }
            return n / d
        }
        return parseDecimalOrWhole(text)
    }

    private static func parseDecimalOrWhole(_ text: String) -> Rational? {
        let unified = text.replacingOccurrences(of: ",", with: ".")
        let pieces = unified.split(separator: ".", omittingEmptySubsequences: false).map(String.init)
        guard pieces.count <= 2, let integer = pieces.first, !integer.isEmpty || pieces.count == 2 else { return nil }
        guard let whole = integer.isEmpty ? 0 : parseWhole(integer) else { return nil }
        guard pieces.count == 2 else { return Rational(whole) }
        let fraction = pieces[1]
        guard !fraction.isEmpty, fraction.count <= 9, fraction.allSatisfy({ $0.isASCII && $0.isNumber }),
              let digits = Int(fraction)
        else { return nil }
        var scale = 1
        for _ in 0..<fraction.count { scale *= 10 }
        let top = whole.multipliedReportingOverflow(by: scale)
        let total = top.partialValue.addingReportingOverflow(digits)
        guard !top.overflow, !total.overflow else { return nil }
        return Rational(total.partialValue, scale)
    }
}
