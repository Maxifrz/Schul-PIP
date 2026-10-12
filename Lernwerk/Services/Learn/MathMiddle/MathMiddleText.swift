import Foundation

/// Maths text the way a student reads it in the app: − (U+2212) for minus, · for times, : for divided by, ² ³ for
/// powers, fractions as 3/4, the decimal comma.
enum MathMiddleText {
    static let minus = "\u{2212}"

    /// "−5", "0", "12".
    static func int(_ n: Int) -> String {
        n < 0 ? minus + String(-n) : String(n)
    }

    /// With the sign in front, also for plus: "+5", "−5".
    static func signed(_ n: Int) -> String {
        n < 0 ? minus + String(-n) : "+" + String(n)
    }

    private static func unicodeMinus(_ text: String) -> String {
        text.replacingOccurrences(of: "-", with: minus)
    }

    /// A fraction as "3/4" or "−3/4", a whole number as "2".
    static func fraction(_ q: MathMiddleQ) -> String {
        unicodeMinus(q.value.fractionText)
    }

    /// A number with the decimal comma when its decimal ends ("0,75"), else a fraction ("1/3").
    static func number(_ q: MathMiddleQ) -> String {
        unicodeMinus(q.value.germanText)
    }

    /// A mixed number "2 3/5", "−1 1/2"; a proper fraction or a whole number as is.
    static func mixed(_ q: MathMiddleQ) -> String {
        let value = q.value
        guard !value.isWhole, abs(value.numerator) > value.denominator else { return fraction(q) }
        let whole = abs(value.numerator) / value.denominator
        let rest = abs(value.numerator) % value.denominator
        return (value.numerator < 0 ? minus : "") + "\(whole) \(rest)/\(value.denominator)"
    }

    /// A fraction with the numerator and denominator as given, not reduced.
    static func fraction(_ numerator: Int, _ denominator: Int) -> String {
        int(numerator) + "/" + String(denominator)
    }

    // Powers

    private static let superscripts: [Character: Character] = [
        "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
    ]

    private static let subscripts: [Character: Character] = [
        "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
    ]

    /// An exponent in superscript digits: 2 gives "²", −3 gives "⁻³".
    static func sup(_ n: Int) -> String {
        String(String(n).map { superscripts[$0] ?? $0 })
    }

    /// An index in subscript digits: 1 gives "₁".
    static func sub(_ n: Int) -> String {
        String(String(n).map { subscripts[$0] ?? $0 })
    }

    /// "3⁴", "(−2)³": a negative base gets brackets.
    static func power(_ base: Int, _ exponent: Int) -> String {
        (base < 0 ? "(" + int(base) + ")" : String(base)) + sup(exponent)
    }

    /// A power of a letter or a bracket: "x³", "a⁻²".
    static func power(_ base: String, _ exponent: Int) -> String {
        base + sup(exponent)
    }

    // Terms

    /// One summand of a term: the coefficient and the variable ("3x", "−x", "x", "5"), without a leading plus.
    private static func monomial(_ coefficient: Int, _ variable: String) -> String {
        if variable.isEmpty { return int(coefficient) }
        switch coefficient {
        case 1: return variable
        case -1: return minus + variable
        default: return int(coefficient) + variable
        }
    }

    /// A polynomial from its coefficients, the highest power first: `[2, -3, 1]` with "x" gives "2x² − 3x + 1". Zero
    /// terms are left out; all zero gives "0".
    static func polynomial(_ coefficients: [Int], variable: String = "x") -> String {
        var text = ""
        let top = coefficients.count - 1
        for (index, coefficient) in coefficients.enumerated() where coefficient != 0 {
            let power = top - index
            let name = power == 0 ? "" : (power == 1 ? variable : variable + sup(power))
            let piece = monomial(abs(coefficient), name)
            if text.isEmpty {
                text = (coefficient < 0 ? minus : "") + piece
            } else {
                text += (coefficient < 0 ? " \(minus) " : " + ") + piece
            }
        }
        return text.isEmpty ? "0" : text
    }

    /// "2x − 3", "−x + 4", "5".
    static func linear(_ a: Int, _ b: Int, variable: String = "x") -> String {
        polynomial([a, b], variable: variable)
    }

    /// "y = 2x − 3".
    static func line(_ m: Int, _ b: Int) -> String {
        "y = " + linear(m, b)
    }

    /// A term with a bracket: "3(x − 4)" from the factor and the bracket content.
    static func bracket(_ factor: Int, _ inside: String) -> String {
        (factor == 1 ? "" : (factor == -1 ? minus : int(factor))) + "(" + inside + ")"
    }

    /// The decimal text of a number with exactly `places` digits after the comma: 3.5 with 2 places gives "3,50".
    static func fixed(_ q: MathMiddleQ, places: Int) -> String {
        var scale = 1
        for _ in 0..<places { scale *= 10 }
        let scaled = q.numerator * scale / q.denominator
        let sign = scaled < 0 ? minus : ""
        var digits = String(abs(scaled))
        while digits.count <= places { digits = "0" + digits }
        let cut = digits.index(digits.endIndex, offsetBy: -places)
        return places == 0 ? sign + digits : sign + digits[..<cut] + "," + digits[cut...]
    }

    /// Euros with two decimals: "9,60 €".
    static func euro(_ q: MathMiddleQ) -> String {
        fixed(q, places: 2) + " €"
    }

    /// A price: "92 €" when it is a whole number of euros, else with cents ("37,50 €").
    static func euroAmount(_ q: MathMiddleQ) -> String {
        if q.isWhole { return int(q.numerator) + " €" }
        return 100 % q.denominator == 0 ? euro(q) : number(q) + " €"
    }

    /// Greatest common divisor of two whole numbers.
    static func gcd(_ a: Int, _ b: Int) -> Int {
        var (x, y) = (abs(a), abs(b))
        while y != 0 { (x, y) = (y, x % y) }
        return x
    }

    /// Least common multiple of two positive whole numbers.
    static func lcm(_ a: Int, _ b: Int) -> Int {
        a / gcd(a, b) * b
    }
}
