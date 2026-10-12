import Foundation

/// Typical mistakes when differentiating or integrating a polynomial term by term; the wrong options of the
/// calculus questions are computed from these.
enum UMistake {
    /// The exponent is lowered but the factor is forgotten: 4x³ becomes 4x².
    case noMultiply
    /// The factor is taken but the exponent stays: 4x³ becomes 12x³.
    case noLower
    /// A constant stays instead of vanishing.
    case keepConstant
    /// The antiderivative is formed instead.
    case integrate
}

enum UCalc {
    static func mistaken(_ f: UPoly, _ mistake: UMistake) -> UPoly {
        var terms: [(Int, UQ)] = []
        for (k, q) in f.c.enumerated() where !q.isZero {
            switch mistake {
            case .noMultiply:
                if k >= 1 { terms.append((k - 1, q)) }
            case .noLower:
                if k >= 1 { terms.append((k, q * UQ(k))) }
            case .keepConstant:
                if k == 0 { terms.append((0, q)) } else { terms.append((k - 1, q * UQ(k))) }
            case .integrate:
                terms.append((k + 1, q / UQ(k + 1)))
            }
        }
        return UPoly(terms: terms)
    }

    static func fx(_ f: UPoly, name: String = "f") -> String { "\(name)(x) = " + f.text }

    /// A polynomial that grows in size with the level.
    static func poly(_ g: UGen, level: Int) -> UPoly {
        for _ in 0..<30 {
            let p: UPoly
            switch level {
            case 1: p = g.poly(degree: 2, terms: g.int(1...2), coefficients: 1...4)
            case 2: p = g.poly(degree: g.int(2...3), terms: g.int(2...3), coefficients: 1...5)
            default: p = g.poly(degree: g.int(3...4), terms: g.int(3...4), coefficients: 1...5)
            }
            if p.derivative.degree >= 1 { return p }
        }
        return UPoly(ints: [1, 2, 3])
    }

    /// Rounds a list of wrong numbers: only those that differ from the answer.
    static func differing(_ list: [UQ], from answer: UQ) -> [UQ] {
        var seen: Set<UQ> = [answer]
        return list.filter { seen.insert($0).inserted }
    }
}
