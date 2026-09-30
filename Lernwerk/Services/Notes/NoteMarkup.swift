import Foundation

/// What a line of a typed note is: plain text, a heading, or an item of a list.
enum NoteBlock: Equatable {
    case body, heading1, heading2, bullet, numbered
    case check(done: Bool)

    /// The same kind of block, whatever its number or tick.
    func sameKind(as other: NoteBlock) -> Bool {
        switch (self, other) {
        case (.body, .body), (.heading1, .heading1), (.heading2, .heading2), (.bullet, .bullet), (.numbered, .numbered), (.check, .check):
            return true
        default:
            return false
        }
    }

    var isList: Bool {
        switch self {
        case .bullet, .numbered, .check: return true
        default: return false
        }
    }
}

/// Typed notes are plain text with a marker in front of a line: `# ` and `## ` for headings, `- ` for a bullet,
/// `1. ` for a numbered item, `[ ] ` and `[x] ` for a checklist. The markers are what is stored; the page shows
/// them as headings, bullets, numbers and boxes. Keeping it plain text keeps search, undo and older files working.
enum NoteMarkup {
    struct Line: Equatable {
        var block: NoteBlock
        /// The marker as typed, with its space; empty for plain text.
        var prefix: String
        var content: String
        /// The number shown for a numbered item, counted within its run of items.
        var number = 0
    }

    static func parseLine(_ line: String) -> Line {
        if line.hasPrefix("## ") { return Line(block: .heading2, prefix: "## ", content: String(line.dropFirst(3))) }
        if line.hasPrefix("# ") { return Line(block: .heading1, prefix: "# ", content: String(line.dropFirst(2))) }
        if line.hasPrefix("- ") { return Line(block: .bullet, prefix: "- ", content: String(line.dropFirst(2))) }
        if line.hasPrefix("[ ] ") { return Line(block: .check(done: false), prefix: "[ ] ", content: String(line.dropFirst(4))) }
        if line.hasPrefix("[x] ") || line.hasPrefix("[X] ") {
            return Line(block: .check(done: true), prefix: String(line.prefix(4)), content: String(line.dropFirst(4)))
        }
        // Digits, a dot and a space
        var digits = 0
        for character in line {
            if character.isASCII, character.isNumber, digits < 4 { digits += 1 } else { break }
        }
        if digits > 0 {
            let rest = line.dropFirst(digits)
            if rest.hasPrefix(". ") {
                return Line(block: .numbered, prefix: String(line.prefix(digits + 2)), content: String(rest.dropFirst(2)))
            }
        }
        return Line(block: .body, prefix: "", content: line)
    }

    /// Every line of a text, with the numbers of numbered items counted from 1 in each run.
    static func lines(of text: String) -> [Line] {
        var result: [Line] = []
        var counter = 0
        for raw in text.components(separatedBy: "\n") {
            var line = parseLine(raw)
            if line.block == .numbered {
                counter += 1
                line.number = counter
            } else {
                counter = 0
            }
            result.append(line)
        }
        return result
    }

    static func marker(for block: NoteBlock, number: Int = 1) -> String {
        switch block {
        case .body: return ""
        case .heading1: return "# "
        case .heading2: return "## "
        case .bullet: return "- "
        case .numbered: return "\(number). "
        case let .check(done): return done ? "[x] " : "[ ] "
        }
    }

    /// The line with another block in front. Choosing the block it already has takes it away again; a ticked box
    /// is ticked or unticked by choosing the checklist again.
    static func setBlock(_ block: NoteBlock, on line: String) -> String {
        let parsed = parseLine(line)
        if case let .check(done) = parsed.block, case .check = block {
            return marker(for: .check(done: !done)) + parsed.content
        }
        if parsed.block.sameKind(as: block) { return parsed.content }
        return marker(for: block) + parsed.content
    }

    /// What Enter does at the end of a line.
    enum Continuation: Equatable {
        /// A new plain line
        case none
        /// A new line that starts with this marker
        case marker(String)
        /// The line was an empty list item: the marker goes and the list ends
        case endList
    }

    static func continuation(afterLine line: String) -> Continuation {
        let parsed = parseLine(line)
        switch parsed.block {
        case .body, .heading1, .heading2:
            return .none
        case .bullet:
            return parsed.content.isEmpty ? .endList : .marker("- ")
        case .check:
            return parsed.content.isEmpty ? .endList : .marker("[ ] ")
        case .numbered:
            let number = Int(parsed.prefix.dropLast(2)) ?? 1
            return parsed.content.isEmpty ? .endList : .marker("\(number + 1). ")
        }
    }

    /// Numbered items counted 1, 2, 3 again within each run, after lines were added or taken away.
    static func renumbered(_ text: String) -> String {
        var counter = 0
        var changed = false
        var out: [String] = []
        for raw in text.components(separatedBy: "\n") {
            let parsed = parseLine(raw)
            if parsed.block == .numbered {
                counter += 1
                let fixed = "\(counter). " + parsed.content
                if fixed != raw { changed = true }
                out.append(fixed)
            } else {
                counter = 0
                out.append(raw)
            }
        }
        return changed ? out.joined(separator: "\n") : text
    }

    /// The text without its markers, for the search and for sharing as plain text.
    static func plain(_ text: String) -> String {
        lines(of: text).map(\.content).joined(separator: "\n")
    }
}

/// The cells of a table on a page, and what the table commands do to them.
enum NoteTable {
    static let maxColumns = 8
    static let maxRows = 40

    enum Edit: Equatable {
        case addRow, removeRow, addColumn, removeColumn
    }

    static func blank(rows: Int = 3, columns: Int = 3) -> [[String]] {
        Array(repeating: Array(repeating: "", count: columns), count: rows)
    }

    /// The cells after a command; a table keeps at least one row and one column.
    static func applying(_ edit: Edit, to cells: [[String]]) -> [[String]] {
        var cells = cells.isEmpty ? blank(rows: 1, columns: 1) : cells
        let columns = cells.map(\.count).max() ?? 1
        cells = cells.map { $0 + Array(repeating: "", count: columns - $0.count) }
        switch edit {
        case .addRow:
            if cells.count < maxRows { cells.append(Array(repeating: "", count: columns)) }
        case .removeRow:
            if cells.count > 1 { cells.removeLast() }
        case .addColumn:
            if columns < maxColumns { cells = cells.map { $0 + [""] } }
        case .removeColumn:
            if columns > 1 { cells = cells.map { Array($0.dropLast()) } }
        }
        return cells
    }

    /// Tab-separated, one line per row: what a table becomes as plain text.
    static func plain(_ cells: [[String]]) -> String {
        cells.map { $0.joined(separator: "\t") }.joined(separator: "\n")
    }
}
