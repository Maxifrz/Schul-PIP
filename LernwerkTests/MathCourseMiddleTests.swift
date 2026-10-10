import XCTest
@testable import Lernwerk

/// Independent checks for the middle-school maths course. The kit re-reads the prompts the student sees and
/// recomputes the answers with Double arithmetic, brute force and by plugging solutions back in, so a mistake in a
/// template cannot hide behind the code that made it.
enum MathMiddleTestKit {
    struct Draw {
        let level: Int
        let seed: UInt64
        let problem: MathMiddleProblem
    }

    static let seeds: ClosedRange<UInt64> = 1...300

    static var provider: any CourseProvider { MathMiddleCourse.provider }

    static func template(_ id: String) -> MathMiddleTemplate {
        for unit in MathMiddleCatalog.units {
            if let found = unit.first(where: { $0.id == id }) { return found }
        }
        preconditionFailure("No template \(id)")
    }

    private final class Cache {
        var draws: [String: [Draw]] = [:]
    }

    private static let cache = Cache()

    /// A template drawn at the three levels for every seed; draws that came out nil are left out. Cached.
    static func draws(_ id: String) -> [Draw] {
        if let cached = cache.draws[id] { return cached }
        let template = template(id)
        var result: [Draw] = []
        for level in 1...3 {
            for seed in seeds {
                let gen = MathMiddleGen(seed: seed &* 7919 &+ UInt64(level))
                if let problem = template.make(level, gen) { result.append(Draw(level: level, seed: seed, problem: problem)) }
            }
        }
        cache.draws[id] = result
        return result
    }

    /// Runs a check on every draw of a template. The body returns a message for a wrong problem, nil for a good one.
    static func check(
        _ id: String, minimumDraws: Int = 30, file: StaticString = #filePath, line: UInt = #line,
        _ body: (_ level: Int, _ problem: MathMiddleProblem) -> String?
    ) {
        let all = draws(id)
        XCTAssertGreaterThanOrEqual(all.count, minimumDraws, "\(id) made too few problems", file: file, line: line)
        var messages: [String] = []
        for draw in all {
            if let message = body(draw.level, draw.problem) {
                messages.append("\(id) level \(draw.level) seed \(draw.seed): \(message)\n  \(draw.problem.prompt.replacingOccurrences(of: "\n", with: " | "))")
            }
        }
        if !messages.isEmpty {
            XCTFail("\(messages.count) wrong problems in \(id):\n" + messages.prefix(6).joined(separator: "\n"), file: file, line: line)
        }
    }

    // Text

    private final class Expressions {
        var compiled: [String: NSRegularExpression] = [:]
    }

    private static let expressions = Expressions()

    private static func expression(_ pattern: String) -> NSRegularExpression? {
        if let found = expressions.compiled[pattern] { return found }
        guard let made = try? NSRegularExpression(pattern: pattern) else { return nil }
        expressions.compiled[pattern] = made
        return made
    }

    /// The capture groups of the first match, the whole match first; nil without a match.
    static func match(_ pattern: String, _ text: String) -> [String]? {
        guard let expression = expression(pattern) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        guard let found = expression.firstMatch(in: text, range: range) else { return nil }
        return (0..<found.numberOfRanges).map { index in
            Range(found.range(at: index), in: text).map { String(text[$0]) } ?? ""
        }
    }

    /// The capture groups of every match.
    static func matches(_ pattern: String, _ text: String) -> [[String]] {
        guard let expression = expression(pattern) else { return [] }
        let range = NSRange(text.startIndex..., in: text)
        return expression.matches(in: text, range: range).map { found in
            (0..<found.numberOfRanges).map { index in
                Range(found.range(at: index), in: text).map { String(text[$0]) } ?? ""
            }
        }
    }

    /// "12", "0,75" or "3/4" at the start of the text as a Double; a unit, a percent sign or a degree sign after it
    /// is ignored, a mixed number "2 3/5" is read as 2.6. The minus sign is U+2212 or "-".
    static func number(_ text: String) -> Double? {
        var cleaned = text.replacingOccurrences(of: "\u{2212}", with: "-").replacingOccurrences(of: ",", with: ".")
        cleaned = cleaned.trimmingCharacters(in: .whitespaces)
        if let m = match(#"^(-?)(\d+) (\d+)/(\d+)"#, cleaned) {
            let value = Double(m[2])! + Double(m[3])! / Double(m[4])!
            return m[1].isEmpty ? value : -value
        }
        if let m = match(#"^(-?)(\d+(?:\.\d+)?)/(\d+(?:\.\d+)?)"#, cleaned) {
            let denominator = Double(m[3])!
            guard denominator != 0 else { return nil }
            let value = Double(m[2])! / denominator
            return m[1].isEmpty ? value : -value
        }
        if let m = match(#"^(-?)(\d+(?:\.\d+)?)"#, cleaned) {
            let value = Double(m[2])!
            return m[1].isEmpty ? value : -value
        }
        return nil
    }

    /// Every unsigned number or fraction "a/b" in the text, in order. A mixed number gives its whole part and its
    /// fraction separately.
    static func numbers(in text: String) -> [Double] {
        matches(#"\d+(?:,\d+)?(?:/\d+(?:,\d+)?)?"#, text).compactMap { number($0[0]) }
    }

    /// The whole numbers in the text, in order.
    static func integers(in text: String) -> [Int] {
        matches(#"\d+"#, text).compactMap { Int($0[0]) }
    }

    static func close(_ a: Double, _ b: Double, tolerance: Double = 1e-9) -> Bool {
        abs(a - b) <= tolerance * max(1, abs(a), abs(b))
    }

    /// The greatest common divisor found by trying every divisor, not by Euclid's algorithm.
    static func bruteGCD(_ a: Int, _ b: Int) -> Int {
        guard a > 0, b > 0 else { return max(a, b) }
        for divisor in stride(from: min(a, b), through: 1, by: -1) where a % divisor == 0 && b % divisor == 0 { return divisor }
        return 1
    }

    /// The least common multiple found by counting up.
    static func bruteLCM(_ a: Int, _ b: Int) -> Int {
        var multiple = max(a, b)
        while multiple % a != 0 || multiple % b != 0 { multiple += max(a, b) }
        return multiple
    }

    /// The typed answer of a problem as a Double.
    static func typedAnswer(_ problem: MathMiddleProblem) -> Double? {
        problem.typed.map { $0.answer.doubleValue }
    }

    /// A number the answer check accepts, written the way a student might: the value of the typed answer.
    static func accepts(_ problem: MathMiddleProblem, _ text: String) -> Bool {
        guard let typed = problem.typed else { return false }
        return NumberCheck.matches(text, expected: typed.answer.fractionText)
    }
}

/// A small reader for the expressions in the prompts: numbers (3, 0,75, 3/4, 2 3/4), + − · : and brackets, powers
/// like ² and ⁻³, √, letters as variables, and 3x or 2(x + 1) as products. It computes with Doubles, so it checks the
/// course's exact answers by another route.
struct MathMiddleTestExpression {
    private let chars: [Character]
    private var index = 0
    private let variables: [Character: Double]

    static func evaluate(_ text: String, _ variables: [Character: Double] = [:]) -> Double? {
        var reader = MathMiddleTestExpression(text, variables)
        guard let value = reader.expression() else { return nil }
        reader.skipSpaces()
        return reader.index == reader.chars.count && value.isFinite ? value : nil
    }

    /// Whether both sides of "left = right" have the same value for the variable x.
    static func holds(_ equation: String, x: Double) -> Bool? {
        let sides = equation.components(separatedBy: " = ")
        guard sides.count == 2, let left = evaluate(sides[0], ["x": x]), let right = evaluate(sides[1], ["x": x]) else { return nil }
        return abs(left - right) <= 1e-9 * max(1, abs(left), abs(right))
    }

    private init(_ text: String, _ variables: [Character: Double]) {
        chars = Array(text.replacingOccurrences(of: "\u{2212}", with: "-"))
        self.variables = variables
    }

    private var peek: Character? { index < chars.count ? chars[index] : nil }

    private func peek(_ offset: Int) -> Character? { index + offset < chars.count ? chars[index + offset] : nil }

    private mutating func skipSpaces() {
        while index < chars.count, chars[index] == " " { index += 1 }
    }

    private static let superscripts: [Character: Int] = ["⁰": 0, "¹": 1, "²": 2, "³": 3, "⁴": 4, "⁵": 5, "⁶": 6, "⁷": 7, "⁸": 8, "⁹": 9]

    private mutating func expression() -> Double? {
        skipSpaces()
        var sign = 1.0
        if peek == "-" { index += 1; sign = -1 } else if peek == "+" { index += 1 }
        guard let first = term() else { return nil }
        var value = sign * first
        while true {
            skipSpaces()
            guard let c = peek, c == "+" || c == "-" else { return value }
            index += 1
            guard let rhs = term() else { return nil }
            value = c == "+" ? value + rhs : value - rhs
        }
    }

    private mutating func term() -> Double? {
        skipSpaces()
        guard var value = product() else { return nil }
        while true {
            skipSpaces()
            guard let c = peek, c == "·" || c == ":" else { return value }
            index += 1
            skipSpaces()
            guard let rhs = product() else { return nil }
            if c == ":" {
                guard rhs != 0 else { return nil }
                value /= rhs
            } else {
                value *= rhs
            }
        }
    }

    /// Factors written right next to each other are multiplied: 3x, 2(x + 1), (x − 2)(x + 5).
    private mutating func product() -> Double? {
        guard var value = quotient() else { return nil }
        while let c = peek, c == "(" || c == "√" || c == "π" || (c.isLetter && variables[c] != nil) {
            guard let rhs = quotient() else { return nil }
            value *= rhs
        }
        return value
    }

    private mutating func quotient() -> Double? {
        guard var value = power() else { return nil }
        if peek == "/" {
            index += 1
            guard let rhs = power(), rhs != 0 else { return nil }
            value /= rhs
        }
        return value
    }

    private mutating func power() -> Double? {
        guard var base = atom() else { return nil }
        while let c = peek, c == "⁻" || MathMiddleTestExpression.superscripts[c] != nil {
            var negative = false
            if c == "⁻" { negative = true; index += 1 }
            var exponent = 0
            var digits = 0
            while let d = peek, let value = MathMiddleTestExpression.superscripts[d] { exponent = exponent * 10 + value; digits += 1; index += 1 }
            guard digits > 0 else { return nil }
            base = pow(base, Double(negative ? -exponent : exponent))
        }
        return base
    }

    private mutating func atom() -> Double? {
        guard let c = peek else { return nil }
        if c == "(" {
            index += 1
            guard let value = expression() else { return nil }
            skipSpaces()
            guard peek == ")" else { return nil }
            index += 1
            return value
        }
        if c == "√" {
            index += 1
            guard let value = atom(), value >= 0 else { return nil }
            return value.squareRoot()
        }
        if c == "π" { index += 1; return Double.pi }
        if c.isASCII, c.isNumber { return number() }
        if c.isLetter, let value = variables[c] { index += 1; return value }
        return nil
    }

    private mutating func digits() -> String {
        var text = ""
        while let c = peek, c.isASCII, c.isNumber { text.append(c); index += 1 }
        return text
    }

    private mutating func number() -> Double? {
        var text = digits()
        if peek == ",", let next = peek(1), next.isASCII, next.isNumber {
            index += 1
            text += "." + digits()
        }
        guard let value = Double(text) else { return nil }
        // A mixed number: a whole number, a space, then a fraction.
        if !text.contains("."), peek == " ", let top = peek(1), top.isASCII, top.isNumber {
            let start = index
            index += 1
            let numerator = digits()
            if peek == "/", let next = peek(1), next.isASCII, next.isNumber {
                index += 1
                let denominator = digits()
                if let n = Double(numerator), let d = Double(denominator), d != 0 { return value + n / d }
            }
            index = start
        }
        return value
    }
}

final class MathCourseMiddleTests: XCTestCase {
    private var provider: any CourseProvider { MathMiddleCourse.provider }

    // Structure

    func testTheCourseDescribesItself() {
        let course = provider.course
        XCTAssertEqual(course.id, "mathm")
        XCTAssertEqual(course.title, "Mathe Mittelstufe")
        XCTAssertEqual(course.subtitle, "Klasse 5 bis 10")
        XCTAssertEqual(course.kind, .math)
        XCTAssertEqual(course.color, 0x3D6FB6)
        XCTAssertEqual(course.symbol, "percent")
        XCTAssertEqual(course.units.count, 10)
        XCTAssertEqual(provider.structureProblems(), [])
        XCTAssertEqual(course.units.map(\.title), [
            "Brüche verstehen", "Bruchrechnung", "Dezimalzahlen und Prozent", "Terme und lineare Gleichungen",
            "Dreisatz und Proportionalität", "Lineare Funktionen", "Potenzen und Wurzeln", "Geometrie",
            "Quadratische Gleichungen und Funktionen", "Wahrscheinlichkeit",
        ])
        for unit in course.units {
            XCTAssertEqual(unit.nodes.map(\.kind), [.lesson, .lesson, .lesson, .practice, .checkpoint, .chest], unit.id)
            let paragraphs = unit.tip.components(separatedBy: "\n\n").filter { !$0.isEmpty }
            XCTAssertTrue((2...5).contains(paragraphs.count), "\(unit.id) tip has \(paragraphs.count) paragraphs")
            XCTAssertFalse(unit.summary.isEmpty)
        }
    }

    func testTheCatalogHasTenUnitsWithEnoughTemplates() {
        XCTAssertEqual(MathMiddleCatalog.units.count, 10)
        for (index, templates) in MathMiddleCatalog.units.enumerated() {
            let prefix = String(format: "u%02d.", index + 1)
            XCTAssertGreaterThanOrEqual(templates.count, 5, "unit \(index + 1)")
            XCTAssertTrue(templates.allSatisfy { $0.id.hasPrefix(prefix) }, "unit \(index + 1) template ids")
            XCTAssertEqual(Set(templates.map(\.id)).count, templates.count, "unit \(index + 1) duplicate ids")
            for lesson in 1...3 {
                XCTAssertGreaterThanOrEqual(templates.filter { $0.lesson == lesson }.count, 2, "unit \(index + 1) lesson \(lesson)")
            }
            XCTAssertTrue(templates.contains { $0.forms.contains(.typed) })
            XCTAssertTrue(templates.contains { $0.forms.contains(.pairs) })
        }
    }

    func testTheAuditFindsNothing() {
        XCTAssertEqual(CourseAudit.problems(of: provider, seeds: Array(1...20)), [])
    }

    func testTheSameSeedGivesTheSameExercisesAndAnotherSeedOthers() {
        for node in provider.course.nodes where node.kind != .chest {
            XCTAssertEqual(provider.exercises(for: node, seed: 7), provider.exercises(for: node, seed: 7), node.id)
            XCTAssertNotEqual(provider.exercises(for: node, seed: 7).map(\.prompt), provider.exercises(for: node, seed: 8).map(\.prompt), node.id)
        }
        for node in provider.course.nodes where node.kind == .chest {
            XCTAssertEqual(provider.exercises(for: node, seed: 1), [])
        }
    }

    // Every exercise of every node, many seeds

    func testEveryExerciseOfEverySeedIsSound() {
        var messages: [String] = []
        var typedCount = 0
        var choiceCount = 0
        var pairCount = 0
        for node in provider.course.nodes where node.kind != .chest {
            for seed in UInt64(1)...60 {
                let exercises = provider.exercises(for: node, seed: seed)
                messages += CourseAudit.problems(in: exercises, node: node).map { "\($0) (seed \(seed))" }
                let kinds = Set(exercises.map(\.kind))
                if kinds.count < 2 { messages.append("\(node.id) seed \(seed): fewer than two kinds") }
                if !kinds.contains(.typeAnswer) { messages.append("\(node.id) seed \(seed): nothing to type") }
                let asked = exercises.map { $0.prompt + "|" + $0.options.sorted().joined(separator: ";") }
                if Set(asked).count != asked.count { messages.append("\(node.id) seed \(seed): the same question twice") }
                for exercise in exercises {
                    let label = "\(node.id) seed \(seed) \(exercise.id)"
                    if exercise.explanation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { messages.append("\(label): no explanation") }
                    if exercise.prompt.count > 260 { messages.append("\(label): prompt too long") }
                    switch exercise.kind {
                    case .typeAnswer:
                        typedCount += 1
                        if exercise.mode != .number { messages.append("\(label): typed answer not in number mode") }
                        for answer in exercise.correctAnswers {
                            guard let value = NumberCheck.parse(answer) else { messages.append("\(label): answer \(answer) does not parse"); continue }
                            if abs(value.doubleValue) >= 1000 { messages.append("\(label): typed answer \(answer) is 1000 or more") }
                            // The answer written as a decimal and, for a mixed number, as one is accepted as well.
                            if !NumberCheck.matches(value.germanText, expected: answer) { messages.append("\(label): \(value.germanText) not accepted") }
                            if !NumberCheck.matches(value.fractionText, expected: answer) { messages.append("\(label): \(value.fractionText) not accepted") }
                        }
                    case .multipleChoice:
                        choiceCount += 1
                        if exercise.options.count < 3 { messages.append("\(label): only \(exercise.options.count) options") }
                    case .matchPairs:
                        pairCount += 1
                    default:
                        messages.append("\(label): unexpected kind \(exercise.kind)")
                    }
                }
            }
        }
        XCTAssertEqual(messages.count, 0, messages.prefix(12).joined(separator: "\n"))
        XCTAssertGreaterThan(typedCount, 0)
        XCTAssertGreaterThan(choiceCount, 0)
        XCTAssertGreaterThan(pairCount, 0)
    }

    func testEveryUnitUsesAllThreeFormsAndEveryTemplateIsAskedInItsCheckpoint() {
        for unit in provider.course.units {
            var kinds = Set<ExerciseKind>()
            for node in unit.nodes where node.kind != .chest {
                for seed in UInt64(1)...5 { kinds.formUnion(provider.exercises(for: node, seed: seed).map(\.kind)) }
            }
            XCTAssertEqual(kinds, [.multipleChoice, .matchPairs, .typeAnswer], unit.id)
            guard let checkpoint = unit.nodes.first(where: { $0.kind == .checkpoint }) else { continue }
            let templates = MathMiddleCatalog.units[unit.number - 1]
            for seed in UInt64(1)...30 {
                let asked = Set(provider.exercises(for: checkpoint, seed: seed).map { String($0.id.split(separator: ".").prefix(2).joined(separator: ".")) })
                // At most one template may be missing: a draw of the numbers can fail now and then.
                XCTAssertLessThanOrEqual(templates.filter { !asked.contains($0.id) }.count, 1, "\(checkpoint.id) seed \(seed)")
            }
        }
    }

    func testLessonsTeachTheirOwnThirdAndReviewTheEarlierOnes() {
        for unit in provider.course.units {
            let templates = MathMiddleCatalog.units[unit.number - 1]
            for node in unit.nodes where node.kind == .lesson {
                var own = 0
                var total = 0
                for seed in UInt64(1)...20 {
                    for exercise in provider.exercises(for: node, seed: seed) {
                        let id = exercise.id.split(separator: ".").prefix(2).joined(separator: ".")
                        guard let template = templates.first(where: { $0.id == id }) else { XCTFail("\(exercise.id) is no template of \(unit.id)"); continue }
                        total += 1
                        if template.lesson == node.index { own += 1 }
                        XCTAssertLessThanOrEqual(template.lesson, node.index, "\(node.id) asks \(template.id) before it is taught")
                    }
                }
                XCTAssertGreaterThanOrEqual(Double(own) / Double(total), 0.6, "\(node.id) mostly teaches its own templates")
            }
        }
    }

    func testPracticeMixesEarlierUnits() {
        for unit in provider.course.units where unit.number >= 2 {
            guard let practice = unit.nodes.first(where: { $0.kind == .practice }) else { continue }
            var earlier = 0
            for seed in UInt64(1)...20 {
                for exercise in provider.exercises(for: practice, seed: seed) {
                    let number = Int(exercise.id.dropFirst().prefix(2)) ?? 0
                    XCTAssertLessThanOrEqual(number, unit.number, practice.id)
                    if number < unit.number { earlier += 1 }
                }
            }
            XCTAssertGreaterThan(earlier, 20 * 2, "\(practice.id) reviews earlier units")
        }
    }

    // Every template

    func testEveryTemplateIsSoundAtEveryLevel() {
        let forbidden = ["Optional", "(null)", "1/0", "/0 ", "[", "]"]
        for templates in MathMiddleCatalog.units {
            for template in templates {
                var choiceReady = 0
                var typedDraws = 0
                var typedSmall = 0
                for level in 1...3 {
                    let draws = MathMiddleTestKit.draws(template.id).filter { $0.level == level }
                    XCTAssertGreaterThanOrEqual(draws.count, 30, "\(template.id) level \(level) rarely makes a problem")
                    XCTAssertGreaterThanOrEqual(Set(draws.map(\.problem.key)).count, 5, "\(template.id) level \(level) has too little variety")
                    for draw in draws {
                        let p = draw.problem
                        let label = "\(template.id) L\(level) seed \(draw.seed)"
                        XCTAssertFalse(p.prompt.isEmpty || p.correct.isEmpty || p.solution.isEmpty || p.explanation.isEmpty, label)
                        let everything = ([p.prompt, p.correct, p.solution, p.explanation, p.typed?.prompt ?? "", p.pairFront ?? ""] + p.wrong.map(\.text))
                        for text in everything {
                            for word in forbidden where text.contains(word) { XCTFail("\(label): contains \(word): \(text)") }
                            if MathMiddleTestKit.match(#"\b(nan|inf)\b"#, text) != nil { XCTFail("\(label): not a number in \(text)") }
                            // A minus zero ("−0") is a slip; a negative decimal like −0,5 is fine.
                            if MathMiddleTestKit.match(#"\u20120(?![,.\d])"#, text) != nil { XCTFail("\(label): minus zero in \(text)") }
                            if MathMiddleTestKit.match(#"\d\s*-\s*\d"#, text) != nil || text.contains("*") || text.contains("×") {
                                XCTFail("\(label): ASCII operator in \(text)")
                            }
                            if text.count > 260 { XCTFail("\(label): text too long") }
                        }
                        XCTAssertEqual(p.typed != nil, template.forms.contains(.typed), label)
                        XCTAssertEqual(p.pairFront != nil, template.forms.contains(.pairs), label)
                        // The wrong options: no two alike for the exercise factory, none equal to the right one.
                        let options = p.options
                        let folded = ([p.correct] + options).map(LearnExercise.folded)
                        XCTAssertEqual(Set(folded).count, folded.count, label)
                        // Whatever the student sees as a wrong option is not worth the same as the right one.
                        if let right = MathMiddleTestKit.number(p.correct), p.correctValue != nil, !p.allowsEquivalentWrong {
                            for option in options {
                                if let value = MathMiddleTestKit.number(option), MathMiddleTestKit.close(value, right) {
                                    XCTFail("\(label): the wrong option \(option) is worth the same as \(p.correct)")
                                }
                            }
                        }
                        if options.count >= 2 { choiceReady += 1 }
                        if let typed = p.typed {
                            typedDraws += 1
                            XCTAssertTrue(typed.answer.doubleValue.isFinite, label)
                            if abs(typed.answer.doubleValue) < 1000 { typedSmall += 1 }
                            XCTAssertTrue(NumberCheck.matches(typed.answer.fractionText, expected: typed.answer.fractionText), label)
                        }
                    }
                }
                let total = MathMiddleTestKit.draws(template.id).count
                if template.forms.contains(.choice) {
                    XCTAssertGreaterThanOrEqual(Double(choiceReady) / Double(total), 0.9, "\(template.id) rarely has enough wrong options")
                }
                if template.forms.contains(.typed) {
                    XCTAssertGreaterThanOrEqual(Double(typedSmall) / Double(typedDraws), 0.95, "\(template.id) asks for big typed numbers")
                }
            }
        }
    }
}
