import Foundation

/// Calculating in handwritten notes: finding a written "=", the line it ends, and reading what a vision model
/// recognized there. The calculation itself always runs on the device, in the computer algebra core.
enum MathNotes {
    // Finding the equals sign

    /// Two short, flat strokes above each other, about as long as each other: an equals sign.
    static func isEqualsSign(_ a: CGRect, _ b: CGRect) -> Bool {
        let flatA = a.height <= max(a.width * 0.35, 4)
        let flatB = b.height <= max(b.width * 0.35, 4)
        guard flatA, flatB, a.width >= 6, b.width >= 6 else { return false }
        let ratio = a.width / b.width
        guard ratio >= 0.5, ratio <= 2 else { return false }
        let overlap = min(a.maxX, b.maxX) - max(a.minX, b.minX)
        guard overlap >= min(a.width, b.width) * 0.6 else { return false }
        let gap = abs(a.midY - b.midY)
        let width = (a.width + b.width) / 2
        return gap >= max(3, width * 0.12) && gap <= width * 1.0
    }

    /// The strokes left of the equals sign on its line, as one region; nil when nothing is written there. Strokes
    /// count while the gap to the next one is small, so an older line further left is not taken in.
    static func lineRegion(of equals: CGRect, among boxes: [CGRect]) -> CGRect? {
        let band = max(equals.width * 1.1, 28)
        let candidates = boxes
            .filter { abs($0.midY - equals.midY) <= band && $0.maxX <= equals.minX + 4 && !$0.equalTo(equals) }
            .filter { !(equals.contains($0) || $0.equalTo(equals)) }
            .sorted { $0.maxX > $1.maxX }
        let reach = max(equals.width * 3, 60)
        var region: CGRect?
        var left = equals.minX
        for box in candidates {
            guard left - box.maxX <= reach else { break }
            region = region.map { $0.union(box) } ?? box
            left = min(left, box.minX)
        }
        return region
    }

    /// Where the result is written: right after the equals sign, as high as the line.
    static func resultOrigin(after equals: CGRect, line: CGRect) -> CGPoint {
        let size = fontSize(for: line)
        return CGPoint(x: equals.maxX + max(6, equals.width * 0.4), y: equals.midY - size * 0.75)
    }

    /// A handwriting size that matches the line: about as tall as the written characters.
    static func fontSize(for line: CGRect) -> CGFloat {
        min(max(line.height * 0.95, 14), 56)
    }

    // What the model reads

    struct Recognition: Codable, Equatable {
        /// "expression", "equations", "function" or "table".
        var kind: String?
        var lines: [String]
        var table: Table?

        struct Table: Codable, Equatable {
            var headers: [String]
            var rows: [[String]]
        }
    }

    static let systemPrompt = """
    You read handwritten school maths from a photo of a student's notes and write it down for a computer algebra \
    system. Do not calculate or correct anything; transcribe exactly what is written.

    Write each line of maths as one string in "lines", top to bottom, in calculator syntax: * for multiplication \
    (also where the student left it out, like 2*x), / for fractions and division, ^ for powers, sqrt(...) for roots, \
    pi, e, sin, cos, tan, ln, log. Use a dot as the decimal separator, even when the student wrote a comma. Keep \
    variable names as written (a, b, x, f(x)). Keep "=" where it is written, including an "=" at the very end of the \
    last line. Leave out words, dates, and anything that is not maths.

    Set "kind": "table" when the photo shows a table of values; then put its column headings into table.headers and \
    each row's cells into table.rows. "function" when it is a function like f(x) = ... or y = ...; "equations" for \
    equations to solve; otherwise "expression".

    Answer with only a JSON object: {"kind": "...", "lines": ["..."], "table": {"headers": [], "rows": []}}.
    """

    static func request(imageJPEG: Data, hint: String) -> LLMRequest {
        LLMRequest(
            purpose: .mathRecognition,
            system: systemPrompt,
            messages: [LLMMessage(role: .user, content: [.image(jpeg: imageJPEG), .text(hint)])],
            maxTokens: 800
        )
    }

    static let lineHint = "The last line ends with \"=\": the student wants it calculated. Earlier lines may define values they use."
    static let regionHint = "Transcribe the maths in this part of the page."

    /// Reads the model's answer leniently: a JSON object, or failing that one line of maths per text line.
    static func parse(_ text: String) -> Recognition? {
        if let recognition = StructuredOutput.decode(Recognition.self, from: text) {
            var cleaned = recognition
            cleaned.lines = recognition.lines.map(clean).filter { !$0.isEmpty }
            return cleaned
        }
        let lines = ModelText.removingReasoning(text)
            .components(separatedBy: .newlines)
            .map(clean)
            .filter { !$0.isEmpty && !$0.hasPrefix("{") && !$0.hasPrefix("```") }
        return lines.isEmpty ? nil : Recognition(kind: nil, lines: lines, table: nil)
    }

    /// Handwriting as OCR or a model may spell it, in the calculator's syntax.
    static func clean(_ line: String) -> String {
        var text = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.hasPrefix("$"), text.hasSuffix("$") { text = String(text.dropFirst().dropLast()) }
        let replacements: [(String, String)] = [
            ("×", "*"), ("·", "*"), ("⋅", "*"), ("÷", "/"), (":", "/"), ("−", "-"), ("–", "-"), ("²", "^2"), ("³", "^3"),
            ("√", "sqrt"), ("π", "pi"), ("\\cdot", "*"), ("\\times", "*"), ("\\pi", "pi"), ("\\sqrt", "sqrt"),
        ]
        for (from, to) in replacements { text = text.replacingOccurrences(of: from, with: to) }
        // ":=" stays a definition.
        text = text.replacingOccurrences(of: "/=", with: ":=")
        // A decimal comma between digits becomes a dot; commas between arguments keep a space or a letter nearby.
        text = text.replacingOccurrences(of: #"(\d),(\d)"#, with: "$1.$2", options: .regularExpression)
        return text
    }

    /// The lines before the last that define something, and the expression the last line asks for.
    static func split(_ lines: [String]) -> (definitions: [String], expression: String?) {
        guard let last = lines.last else { return ([], nil) }
        let definitions = lines.dropLast().filter(isDefinition)
        var expression = last.trimmingCharacters(in: .whitespaces)
        while expression.hasSuffix("=") || expression.hasSuffix("?") {
            expression = String(expression.dropLast()).trimmingCharacters(in: .whitespaces)
        }
        return (Array(definitions), expression.isEmpty ? nil : expression)
    }

    /// "a = 5", "f(x) = x^2 + 1", "b := 2": lines that give a name a value.
    static func isDefinition(_ line: String) -> Bool {
        let pattern = #"^\s*[A-Za-z][A-Za-z0-9_]*\s*(\(\s*[A-Za-z]\s*\))?\s*:?=\s*[^=\s][^=]*$"#
        guard line.range(of: pattern, options: .regularExpression) != nil else { return false }
        // "x = 3" is an equation, not a value for later.
        let name = line.trimmingCharacters(in: .whitespaces).prefix { $0.isLetter || $0.isNumber || $0 == "_" }
        return !["x", "y", "z", "t"].contains(String(name)) || line.contains("(")
    }

    /// Whether a result is worth offering: something was calculated, not just a number copied.
    static func isWorthShowing(expression: String, result: String) -> Bool {
        let plain = expression.replacingOccurrences(of: " ", with: "")
        if Double(plain) != nil { return false }
        return !result.isEmpty && result != plain
    }

    /// The text written after the "=": the exact result when it is short, otherwise the rounded one.
    static func resultText(pretty: String?, approx: String?) -> String? {
        guard let pretty, !pretty.isEmpty else { return approx }
        if pretty.count > 14, let approx { return approx }
        return pretty
    }

    // Tables to charts

    struct ChartData: Equatable {
        struct Column: Equatable {
            var name: String
            var values: [Double?]
        }

        var labels: [String]
        var columns: [Column]
        /// The first column holds numbers that grow: a line chart over x; otherwise bars per label.
        var numericX: Bool
        var xValues: [Double]
    }

    /// A number the way it is written at school: "2,5", "-3", "1.000" is not a thousand but one.
    static func number(_ text: String) -> Double? {
        let cleaned = text.trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "−", with: "-")
            .replacingOccurrences(of: ",", with: ".")
            .replacingOccurrences(of: " ", with: "")
        return Double(cleaned)
    }

    /// Columns with numbers become series; the first column labels them.
    static func chartData(_ table: Recognition.Table) -> ChartData? {
        let width = max(table.headers.count, table.rows.map(\.count).max() ?? 0)
        guard width >= 2, !table.rows.isEmpty else { return nil }
        func cell(_ row: [String], _ index: Int) -> String { index < row.count ? row[index] : "" }
        let labels = table.rows.map { cell($0, 0) }
        var columns: [ChartData.Column] = []
        for index in 1..<width {
            let values = table.rows.map { number(cell($0, index)) }
            guard values.contains(where: { $0 != nil }) else { continue }
            let name = index < table.headers.count && !table.headers[index].isEmpty ? table.headers[index] : "Reihe \(index)"
            columns.append(ChartData.Column(name: name, values: values))
        }
        guard !columns.isEmpty else { return nil }
        let xs = labels.map(number)
        let numericX = xs.allSatisfy { $0 != nil } && zip(xs, xs.dropFirst()).allSatisfy { ($0 ?? 0) < ($1 ?? 0) }
        return ChartData(labels: labels, columns: columns, numericX: numericX, xValues: numericX ? xs.compactMap { $0 } : [])
    }
}
