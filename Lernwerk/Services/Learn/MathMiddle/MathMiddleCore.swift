import Foundation

/// Exact arithmetic without optionals, for the small numbers of the middle-school course. A result is only trusted
/// while `ok` is true: dividing by zero or overflowing clears it, and a problem built from such a value is dropped.
struct MathMiddleQ: Equatable, Hashable, Comparable {
    let value: Rational
    let ok: Bool

    init(_ numerator: Int, _ denominator: Int = 1) {
        if let rational = Rational(numerator, denominator) {
            value = rational
            ok = true
        } else {
            value = Rational(0)
            ok = false
        }
    }

    init(_ rational: Rational?) {
        value = rational ?? Rational(0)
        ok = rational != nil
    }

    var numerator: Int { value.numerator }
    var denominator: Int { value.denominator }
    var isWhole: Bool { value.isWhole }
    var double: Double { value.doubleValue }
    var isZero: Bool { value.numerator == 0 }
    var isNegative: Bool { value.numerator < 0 }
    /// The value as a whole number, nil for a fraction.
    var int: Int? { value.isWhole ? value.numerator : nil }

    var reciprocal: MathMiddleQ { MathMiddleQ(1) / self }
    var negated: MathMiddleQ { MathMiddleQ(-numerator, denominator) }
    var magnitude: MathMiddleQ { isNegative ? negated : self }

    static func + (a: MathMiddleQ, b: MathMiddleQ) -> MathMiddleQ {
        let sum = MathMiddleQ(a.value + b.value)
        return a.ok && b.ok && sum.ok ? sum : MathMiddleQ(1, 0)
    }

    static func - (a: MathMiddleQ, b: MathMiddleQ) -> MathMiddleQ {
        let difference = MathMiddleQ(a.value - b.value)
        return a.ok && b.ok && difference.ok ? difference : MathMiddleQ(1, 0)
    }

    static func * (a: MathMiddleQ, b: MathMiddleQ) -> MathMiddleQ {
        let product = MathMiddleQ(a.value * b.value)
        return a.ok && b.ok && product.ok ? product : MathMiddleQ(1, 0)
    }

    static func / (a: MathMiddleQ, b: MathMiddleQ) -> MathMiddleQ {
        let quotient = MathMiddleQ(a.value / b.value)
        return a.ok && b.ok && quotient.ok ? quotient : MathMiddleQ(1, 0)
    }

    static func < (a: MathMiddleQ, b: MathMiddleQ) -> Bool { a.value < b.value }

    static func + (a: MathMiddleQ, b: Int) -> MathMiddleQ { a + MathMiddleQ(b) }
    static func - (a: MathMiddleQ, b: Int) -> MathMiddleQ { a - MathMiddleQ(b) }
    static func * (a: MathMiddleQ, b: Int) -> MathMiddleQ { a * MathMiddleQ(b) }
    static func / (a: MathMiddleQ, b: Int) -> MathMiddleQ { a / MathMiddleQ(b) }
    static func + (a: Int, b: MathMiddleQ) -> MathMiddleQ { MathMiddleQ(a) + b }
    static func - (a: Int, b: MathMiddleQ) -> MathMiddleQ { MathMiddleQ(a) - b }
    static func * (a: Int, b: MathMiddleQ) -> MathMiddleQ { MathMiddleQ(a) * b }
    static func / (a: Int, b: MathMiddleQ) -> MathMiddleQ { MathMiddleQ(a) / b }

    /// This value to a whole-number power; a negative power takes the reciprocal.
    func power(_ exponent: Int) -> MathMiddleQ {
        var result = MathMiddleQ(1)
        for _ in 0..<abs(exponent) { result = result * self }
        return exponent < 0 ? result.reciprocal : result
    }
}

/// Seeded numbers for the problem templates (SplitMix64 through `LearnRandom`). The same seed draws the same numbers,
/// in this order, on every platform.
final class MathMiddleGen {
    private var random: LearnRandom

    init(seed: UInt64) {
        random = LearnRandom(seed: seed)
    }

    /// A number from the range, every value about equally likely.
    func int(_ range: ClosedRange<Int>) -> Int {
        let span = UInt64(range.upperBound - range.lowerBound + 1)
        return range.lowerBound + Int(random.next() % span)
    }

    /// A number from the range that is not zero.
    func nonZero(_ range: ClosedRange<Int>) -> Int {
        var value = 0
        while value == 0 { value = int(range) }
        return value
    }

    /// A number from the range for the difficulty level 1, 2 or 3.
    func int(level: Int, _ easy: ClosedRange<Int>, _ medium: ClosedRange<Int>, _ hard: ClosedRange<Int>) -> Int {
        int(level <= 1 ? easy : (level == 2 ? medium : hard))
    }

    func pick<T>(_ items: [T]) -> T {
        items[int(0...(items.count - 1))]
    }

    /// True in `percent` of 100 draws.
    func chance(_ percent: Int) -> Bool {
        int(1...100) <= percent
    }

    func sign() -> Int {
        chance(50) ? 1 : -1
    }

    func shuffled<T>(_ items: [T]) -> [T] {
        var result = items
        guard result.count > 1 else { return result }
        for index in stride(from: result.count - 1, to: 0, by: -1) {
            result.swapAt(index, int(0...index))
        }
        return result
    }

    /// The generator itself, for the exercise factory that shuffles the options.
    func withRandom<R>(_ body: (inout LearnRandom) -> R) -> R {
        body(&random)
    }
}

/// One generated problem before it is put to the student: the question, the exact answer and the wrong answers that
/// come from typical mistakes. A template builds it; `MathMiddleBuilder` turns it into a choice, a typed answer or a
/// round of pairs.
struct MathMiddleProblem {
    /// How a number is shown to the student.
    enum Style {
        /// Whole numbers and decimals with a comma; a fraction when the decimal does not end.
        case plain
        /// "3/4", whole numbers as "2".
        case fraction
        /// "2 3/5".
        case mixed
        /// "75 %".
        case percent
        /// "65°".
        case degrees
        /// "12 cm".
        case unit(String)
        /// "3,4π": a multiple of π.
        case pi
        /// "3/4 kg": a fraction with a unit.
        case fractionUnit(String)
        /// "92 €" or "37,50 €".
        case euro

        func text(_ value: MathMiddleQ, bare: Bool = false) -> String {
            switch self {
            case .plain: return MathMiddleText.number(value)
            case .fraction: return MathMiddleText.fraction(value)
            case .mixed: return MathMiddleText.mixed(value)
            case .percent: return MathMiddleText.number(value) + (bare ? "" : " %")
            case .degrees: return MathMiddleText.number(value) + (bare ? "" : "°")
            case let .unit(unit): return MathMiddleText.number(value) + (bare ? "" : " " + unit)
            case .pi: return MathMiddleText.number(value) + (bare ? "" : "π")
            case let .fractionUnit(unit): return MathMiddleText.fraction(value) + (bare ? "" : " " + unit)
            case .euro: return bare ? MathMiddleText.euroAmount(value).replacingOccurrences(of: " €", with: "") : MathMiddleText.euroAmount(value)
            }
        }
    }

    /// A wrong answer: its text and, when it is a number, its value, so it can never equal the right answer.
    struct Wrong {
        let text: String
        let value: Rational?
    }

    /// A typed variant of the problem: what to ask and the exact answer.
    struct Typed {
        var prompt: String
        var answer: Rational
        /// How the answer is written when it is shown; the decimal comma when it ends, else a fraction.
        var text: String?
    }

    /// The question for a choice, and the base of the typed question.
    var prompt: String
    /// The right option, as the student reads it.
    var correct: String
    var correctValue: Rational?
    var wrong: [Wrong]
    var typed: Typed?
    /// A short front for a round of pairs; the back is `correct`.
    var pairFront: String?
    var pairPrompt = "Ordne jeder Aufgabe ihr Ergebnis zu."
    var pairExplanation: String?
    /// The worked result, shown after a wrong answer.
    var solution: String
    /// One or two sentences on the method.
    var explanation: String
    /// For the one template in which a wrong option may be equal in value to the right one: reducing "so weit wie
    /// möglich", where a half-reduced fraction is the typical mistake.
    var allowsEquivalentWrong = false

    /// A problem with a number as the answer. `wrong` are the values of typical mistakes (values equal to the answer
    /// are dropped when the options are built), `extraWrong` mistakes that need their own text. `hint` is added to the
    /// question when it is typed; `typedAnswer` is for a typed question that asks for a part of the answer.
    static func number(
        prompt: String,
        answer: MathMiddleQ,
        style: Style = .plain,
        hint: String,
        wrong: [MathMiddleQ],
        extraWrong: [Wrong] = [],
        typedPrompt: String? = nil,
        typedAnswer: MathMiddleQ? = nil,
        pair: String? = nil,
        solution: String,
        explanation: String
    ) -> MathMiddleProblem? {
        let asked = typedAnswer ?? answer
        guard answer.ok, asked.ok else { return nil }
        return MathMiddleProblem(
            prompt: prompt,
            correct: style.text(answer),
            correctValue: answer.value,
            wrong: wrong.filter(\.ok).map { Wrong(text: style.text($0), value: $0.value) } + extraWrong,
            typed: Typed(prompt: (typedPrompt ?? prompt) + (hint.isEmpty ? "" : "\n" + hint), answer: asked.value, text: typedAnswer == nil ? style.text(asked, bare: true) : MathMiddleText.number(asked)),
            pairFront: pair,
            solution: solution,
            explanation: explanation
        )
    }

    /// A problem whose answer is a text (a term, a statement); `wrong` are the texts of typical mistakes. Give
    /// `typed` when a number can be asked about the same situation.
    static func text(
        prompt: String,
        correct: String,
        wrong: [String],
        typed: Typed? = nil,
        pair: String? = nil,
        solution: String,
        explanation: String
    ) -> MathMiddleProblem {
        MathMiddleProblem(
            prompt: prompt,
            correct: correct,
            correctValue: nil,
            wrong: wrong.map { Wrong(text: $0, value: nil) },
            typed: typed,
            pairFront: pair,
            solution: solution,
            explanation: explanation
        )
    }

    /// What makes the problem this one: asking it twice with the same numbers is a repeat.
    var key: String { prompt + "\u{1F}" + correct }

    /// The wrong options that survive: not equal to the right answer in value or in the characters that count, and no
    /// two alike. The exercise factory compares letters and digits only, so "−3" and "3" are the same option to it;
    /// they are dropped here instead of being dropped silently there.
    var options: [String] {
        var seen: Set<String> = [LearnExercise.folded(correct)]
        var result: [String] = []
        for candidate in wrong {
            if let value = candidate.value, let right = correctValue, value == right, !allowsEquivalentWrong { continue }
            let text = candidate.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty, seen.insert(LearnExercise.folded(text)).inserted else { continue }
            result.append(text)
        }
        return result
    }
}

/// A kind of problem the course can draw again and again with new numbers.
struct MathMiddleTemplate {
    enum Form {
        case choice, typed, pairs
    }

    /// Like "u03.percentValue"; the ids of a unit start with its number.
    let id: String
    /// The lesson of its unit that teaches it first, 1 to 3.
    let lesson: Int
    /// The forms it can be put in. A template that lists a form always has the material for it.
    let forms: Set<Form>
    /// A problem at the difficulty level 1 (easy), 2 (medium) or 3 (hard), or nil when the numbers drawn are no good.
    let make: (_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem?

    init(
        _ id: String,
        lesson: Int,
        forms: Set<Form> = [.choice, .typed],
        make: @escaping (_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem?
    ) {
        self.id = id
        self.lesson = lesson
        self.forms = forms
        // A form the template does not list is not offered, so what a problem carries always matches `forms`.
        self.make = { level, gen in
            guard var problem = make(level, gen) else { return nil }
            // A choice needs two wrong options that survive; a draw with fewer is drawn again.
            if forms.contains(.choice), problem.options.count < 2 { return nil }
            if !forms.contains(.typed) { problem.typed = nil }
            if !forms.contains(.pairs) { problem.pairFront = nil }
            return problem
        }
    }
}

/// Every template of the course, by unit.
enum MathMiddleCatalog {
    static let units: [[MathMiddleTemplate]] = [
        MathMiddleUnit01.templates,
        MathMiddleUnit02.templates,
        MathMiddleUnit03.templates,
        MathMiddleUnit04.templates,
        MathMiddleUnit05.templates,
        MathMiddleUnit06.templates,
        MathMiddleUnit07.templates,
        MathMiddleUnit08.templates,
        MathMiddleUnit09.templates,
    ]
}
