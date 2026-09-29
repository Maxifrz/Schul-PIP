import Foundation

/// One answer of the computer algebra core (`cas/web/cas.js`), as it comes back from the web view.
struct CASAnswer: Codable, Equatable {
    var ok: Bool
    var input: String?
    var giac: String?
    /// The name a definition gave a value or function, like `a` for "a = 5".
    var assigns: String?
    /// "variable" or "function" for definitions.
    var kind: String?
    var exact: String?
    var approx: String?
    var pretty: String?
    var prettyApprox: String?
    var matrix: [[String]]?
    var error: String?
}

/// Sampled graphs with their special points, from `CAS.plot`.
struct CASPlot: Codable, Equatable {
    struct Curve: Codable, Equatable {
        var index: Int
        var giac: String
        var label: String
        var pretty: String
        var values: [Double?]
    }

    struct Point: Codable, Equatable {
        var curve: Int?
        var curves: [Int]?
        var x: Double
        var y: Double
        /// "max" or "min" for extreme points.
        var kind: String?
    }

    var ok: Bool
    var error: String?
    var xmin: Double?
    var xmax: Double?
    var ymin: Double?
    var ymax: Double?
    var curves: [Curve]?
    var roots: [Point]?
    var extrema: [Point]?
    var intersections: [Point]?
    var intercepts: [Point]?

    /// The x value of sample `index` of a curve.
    func x(at index: Int, count: Int) -> Double {
        let low = xmin ?? 0, high = xmax ?? 1
        return count > 1 ? low + (high - low) * Double(index) / Double(count - 1) : low
    }
}

/// A line of the calculator's history.
struct CalculatorEntry: Codable, Identifiable, Equatable {
    var id = UUID()
    var input: String
    var pretty: String?
    var prettyApprox: String?
    var matrix: [[String]]?
    var exact: String?
    var error: String?
    var assigns: String?
    var date = Date()
}

/// The calculator's history, the definitions made in it and the angle unit; saved between launches.
struct CalculatorHistory: Codable, Equatable {
    var entries: [CalculatorEntry] = []
    /// Name → the input that defined it, in the order they were made, so they can be made again after a restart.
    var definitions: [Definition] = []
    var degrees = false

    struct Definition: Codable, Equatable {
        var name: String
        var input: String
        var pretty: String
    }

    static let limit = 200

    /// The exact value of the newest answer, for "ans".
    var lastExact: String? {
        entries.last { $0.error == nil && $0.exact != nil && $0.assigns == nil }?.exact
            ?? entries.last { $0.error == nil && $0.exact != nil }?.exact
    }

    /// Replaces "ans" with the newest answer in parentheses.
    func resolvingAns(_ input: String) -> String {
        guard let last = lastExact?.replacingOccurrences(of: "list[", with: "[") else { return input }
        return CalculatorHistory.replaceWord("ans", in: input, with: "(\(last))")
    }

    mutating func record(input: String, answer: CASAnswer) {
        var entry = CalculatorEntry(input: input)
        if answer.ok {
            entry.pretty = answer.pretty
            entry.prettyApprox = answer.prettyApprox
            entry.matrix = answer.matrix
            entry.exact = answer.kind == "function" ? nil : answer.exact
            entry.assigns = answer.assigns
            if let name = answer.assigns {
                definitions.removeAll { $0.name == name }
                definitions.append(Definition(name: name, input: input, pretty: answer.pretty ?? input))
            }
        } else {
            entry.error = answer.error ?? "Das konnte nicht berechnet werden."
        }
        entries.append(entry)
        if entries.count > Self.limit { entries.removeFirst(entries.count - Self.limit) }
    }

    mutating func forget(_ name: String) {
        definitions.removeAll { $0.name == name }
    }

    static func replaceWord(_ word: String, in text: String, with replacement: String) -> String {
        var result = ""
        var index = text.startIndex
        func isWordCharacter(_ character: Character?) -> Bool {
            guard let character else { return false }
            return character.isLetter || character.isNumber || character == "_"
        }
        while index < text.endIndex {
            if text[index...].hasPrefix(word) {
                let end = text.index(index, offsetBy: word.count)
                let before = index > text.startIndex ? text[text.index(before: index)] : nil
                let after = end < text.endIndex ? text[end] : nil
                if !isWordCharacter(before), !isWordCharacter(after) {
                    result += replacement
                    index = end
                    continue
                }
            }
            result.append(text[index])
            index = text.index(after: index)
        }
        return result
    }
}

/// What is typed on the calculator's keyboard, with a cursor. Templates mark where the cursor goes with "|".
struct CalculatorInput: Equatable {
    private(set) var text = ""
    /// The cursor, as a character offset.
    private(set) var cursor = 0

    init(text: String = "") {
        self.text = text
        cursor = text.count
    }

    mutating func insert(_ template: String) {
        let parts = template.components(separatedBy: "|")
        let before = parts[0]
        let after = parts.count > 1 ? parts[1...].joined() : ""
        let index = text.index(text.startIndex, offsetBy: cursor)
        text.insert(contentsOf: before + after, at: index)
        cursor += before.count
    }

    mutating func backspace() {
        guard cursor > 0 else { return }
        let index = text.index(text.startIndex, offsetBy: cursor - 1)
        text.remove(at: index)
        cursor -= 1
    }

    mutating func moveLeft() { cursor = max(0, cursor - 1) }

    mutating func moveRight() { cursor = min(text.count, cursor + 1) }

    mutating func clear() {
        text = ""
        cursor = 0
    }

    mutating func set(_ value: String) {
        text = value
        cursor = value.count
    }

    var beforeCursor: String { String(text.prefix(cursor)) }
    var afterCursor: String { String(text.dropFirst(cursor)) }
}

enum CASFormat {
    /// A number the German way: decimal comma, at most four decimals, no trailing zeros.
    static func number(_ value: Double, decimals: Int = 4) -> String {
        guard value.isFinite else { return value > 0 ? "∞" : "-∞" }
        let factor = pow(10, Double(decimals))
        var rounded = (value * factor).rounded() / factor
        if rounded == 0 { rounded = 0 }
        var text = String(format: "%.\(decimals)f", rounded)
        while text.contains("."), text.hasSuffix("0") { text.removeLast() }
        if text.hasSuffix(".") { text.removeLast() }
        return text.replacingOccurrences(of: ".", with: ",")
    }

    /// "P(1,5 | -2)", the way points are written at school.
    static func point(_ name: String, x: Double, y: Double) -> String {
        "\(name)(\(number(x)) | \(number(y)))"
    }

    /// Axis ticks at 1, 2 or 5 times a power of ten, about `count` of them between `low` and `high`.
    static func ticks(from low: Double, to high: Double, count: Int = 8) -> [Double] {
        guard high > low, count > 0 else { return [] }
        let raw = (high - low) / Double(count)
        let magnitude = pow(10, floor(log10(raw)))
        let step = [1.0, 2, 5, 10].map { $0 * magnitude }.first { $0 >= raw } ?? 10 * magnitude
        // Whole multiples of the step, rounded to its decimals, so 0.1 steps give 0.3 and not 0.30000000000000004.
        let decimals = pow(10, max(0, -floor(log10(step))) + 1)
        let first = Int(ceil(low / step - 1e-9))
        let last = Int(floor(high / step + 1e-9))
        guard last >= first, last - first < 100 else { return [] }
        return (first...last).map { index in
            let value = (Double(index) * step * decimals).rounded() / decimals
            return value == 0 ? 0 : value
        }
    }
}
