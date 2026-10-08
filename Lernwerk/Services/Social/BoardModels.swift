import Foundation

/// The kinds of building block on a Tafelbild. The first eight fit every subject; the others belong to a subject's way of
/// writing a lesson result down.
enum BlockKind: String, CaseIterable, Identifiable {
    case definition, explanation, formula, example, rule, sketch, question, text
    case observation, interpretation, equation, result
    case event, causes, course, consequences
    case structure, process, function, significance

    var id: String { rawValue }

    var title: String {
        switch self {
        case .definition: return "Definition"
        case .explanation: return "Erklärung"
        case .formula: return "Formel"
        case .example: return "Beispiel"
        case .rule: return "Merksatz"
        case .sketch: return "Skizze"
        case .question: return "Frage"
        case .text: return "Text"
        case .observation: return "Beobachtung"
        case .interpretation: return "Deutung"
        case .equation: return "Reaktionsgleichung"
        case .result: return "Ergebnis"
        case .event: return "Ereignis"
        case .causes: return "Ursachen"
        case .course: return "Verlauf"
        case .consequences: return "Folgen"
        case .structure: return "Struktur"
        case .process: return "Prozess"
        case .function: return "Funktion"
        case .significance: return "Bedeutung"
        }
    }

    /// What the title field asks for.
    var titleHint: String {
        switch self {
        case .definition: return "Begriff, z. B. Bestimmtes Integral"
        case .formula, .equation: return "Wofür? z. B. Hauptsatz"
        case .question: return "Die Frage"
        case .sketch: return "Was zeigt die Skizze?"
        default: return "Überschrift (kann leer bleiben)"
        }
    }

    /// Formulas are typed with symbols the keyboard hides; the editor offers them in a row.
    var wantsSymbols: Bool {
        self == .formula || self == .equation || self == .example
    }

    static func from(_ raw: String) -> BlockKind {
        BlockKind(rawValue: raw) ?? .text
    }
}

enum BoardTemplate: String, CaseIterable, Identifiable {
    case general, math, chemistry, history, biology

    var id: String { rawValue }

    var title: String {
        switch self {
        case .general: return "Allgemein"
        case .math: return "Mathematik"
        case .chemistry: return "Chemie"
        case .history: return "Geschichte"
        case .biology: return "Biologie"
        }
    }

    /// The order of the sections on the finished board, and the buttons offered for a new contribution.
    var kinds: [BlockKind] {
        switch self {
        case .general: return [.definition, .explanation, .formula, .example, .rule, .sketch, .question, .text]
        case .math: return [.definition, .formula, .explanation, .example, .rule, .sketch, .question]
        case .chemistry: return [.observation, .interpretation, .equation, .result, .definition, .example, .question]
        case .history: return [.event, .causes, .course, .consequences, .definition, .question]
        case .biology: return [.structure, .process, .function, .significance, .definition, .sketch, .question]
        }
    }

    /// A template for a subject name from the timetable ("Mathe LK" leads to math), general when none fits.
    static func suggested(forName name: String) -> BoardTemplate {
        let lower = name.lowercased()
        if lower.contains("mathe") { return .math }
        if lower.contains("chemie") { return .chemistry }
        if lower.contains("geschichte") { return .history }
        if lower.contains("bio") { return .biology }
        return .general
    }
}

struct Board: Codable, Identifiable, Equatable, Hashable {
    let id: UUID
    let groupId: UUID
    let title: String
    let topic: String
    let template: String
    let lessonDate: String
    let status: String
    let createdBy: UUID
    let finalizedAt: String?
    let createdAt: String

    var isFinal: Bool { status == "final" }
    var isLocked: Bool { status == "locked" }
    var isOpen: Bool { status == "open" }
    var kind: BoardTemplate { BoardTemplate(rawValue: template) ?? .general }

    /// "08.10.2026" for the ISO date the server sends.
    var dateLabel: String {
        let parts = lessonDate.split(separator: "-")
        guard parts.count == 3 else { return lessonDate }
        return "\(parts[2]).\(parts[1]).\(parts[0])"
    }
}

struct BoardBlock: Codable, Identifiable, Equatable, Hashable {
    let id: UUID
    let boardId: UUID
    let kind: String
    let title: String
    let body: String
    let attachmentPath: String?
    let status: String
    let position: Double
    let author: UUID
    let replacesBlock: UUID?
    let rev: Int
    let createdAt: String
    let updatedAt: String
    let profiles: SocialAuthor?

    var blockKind: BlockKind { BlockKind.from(kind) }
    var authorName: String { profiles?.displayName ?? "Unbekannt" }
    var isProposed: Bool { status == "proposed" }
    var isAccepted: Bool { status == "accepted" }
    var isRejected: Bool { status == "rejected" }
}

struct BoardVersion: Codable, Identifiable, Equatable, Hashable {
    let id: UUID
    let boardId: UUID
    let label: String
    let createdAt: String
    let profiles: SocialAuthor?
}

struct BoardPoll: Codable, Identifiable, Equatable, Hashable {
    struct Option: Codable, Equatable, Hashable {
        let blockId: UUID
    }

    let id: UUID
    let boardId: UUID
    let question: String
    let status: String
    let winner: UUID?
    let createdAt: String
    let pollOptions: [Option]?

    var isOpen: Bool { status == "open" }
    var optionIDs: [UUID] { (pollOptions ?? []).map(\.blockId) }
}

struct PollCount: Codable, Equatable {
    let pollId: UUID
    let blockId: UUID
    let votes: Int
}

struct PollVote: Codable, Equatable {
    let pollId: UUID
    let blockId: UUID
}

/// What the class sees about one lesson result, worked out from the blocks: no server, no clock.
enum BoardLogic {
    struct Section: Equatable {
        let kind: BlockKind
        let blocks: [BoardBlock]
    }

    struct Stats: Equatable {
        var contributions = 0
        var accepted = 0
        var open = 0
        var rejected = 0
        var people = 0
    }

    /// The accepted blocks in the order of the template's sections; blocks of a kind the template does not list come last.
    static func sections(template: BoardTemplate, blocks: [BoardBlock]) -> [Section] {
        let accepted = blocks.filter(\.isAccepted)
        var order = template.kinds
        for block in accepted where !order.contains(block.blockKind) { order.append(block.blockKind) }
        return order.compactMap { kind in
            let inKind = accepted.filter { $0.blockKind == kind }.sorted { ($0.position, $0.createdAt) < ($1.position, $1.createdAt) }
            return inKind.isEmpty ? nil : Section(kind: kind, blocks: inKind)
        }
    }

    static func stats(_ blocks: [BoardBlock]) -> Stats {
        Stats(
            contributions: blocks.count,
            accepted: blocks.filter(\.isAccepted).count,
            open: blocks.filter(\.isProposed).count,
            rejected: blocks.filter(\.isRejected).count,
            people: Set(blocks.map(\.author)).count
        )
    }

    /// Votes per option, and each option's share of all votes as a whole percent (0 while nobody has voted).
    static func shares(poll: BoardPoll, counts: [PollCount]) -> (votes: [UUID: Int], percent: [UUID: Int], total: Int) {
        var votes: [UUID: Int] = [:]
        for id in poll.optionIDs { votes[id] = 0 }
        for count in counts where count.pollId == poll.id { votes[count.blockId] = count.votes }
        let total = votes.values.reduce(0, +)
        var percent: [UUID: Int] = [:]
        for (id, value) in votes { percent[id] = total == 0 ? 0 : Int((Double(value) / Double(total) * 100).rounded()) }
        return (votes, percent, total)
    }

    // MARK: Turning the result into study material

    /// The finished result as plain text, one section after the other.
    static func text(board: Board, groupName: String, blocks: [BoardBlock]) -> String {
        var lines: [String] = [board.title.uppercased(), "\(groupName) · \(board.dateLabel)"]
        if !board.topic.isEmpty { lines.append(board.topic) }
        for section in sections(template: board.kind, blocks: blocks) {
            lines.append("")
            lines.append(section.kind.title.uppercased())
            for block in section.blocks {
                if !block.title.isEmpty { lines.append(block.title) }
                if !block.body.isEmpty { lines.append(block.body) }
                if block.attachmentPath != nil { lines.append("(Bild im Tafelbild)") }
            }
        }
        let summary = stats(blocks)
        lines.append("")
        lines.append("Erarbeitet von \(groupName): \(summary.accepted) Beiträge übernommen, \(summary.people) Beteiligte")
        return lines.joined(separator: "\n")
    }

    /// Flashcards from the accepted blocks that state something to remember: the title (or the kind) is the question, the
    /// text the answer.
    static func flashcards(board: Board, blocks: [BoardBlock]) -> [(front: String, back: String)] {
        let askable: Set<BlockKind> = [
            .definition, .rule, .formula, .equation, .explanation, .interpretation, .result, .causes, .consequences, .function, .significance,
        ]
        var cards: [(front: String, back: String)] = []
        for section in sections(template: board.kind, blocks: blocks) where askable.contains(section.kind) {
            for block in section.blocks {
                let answer = block.body.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !answer.isEmpty else { continue }
                let subject = block.title.trimmingCharacters(in: .whitespacesAndNewlines)
                let front = subject.isEmpty ? "\(section.kind.title) zu „\(board.title)“" : "\(section.kind.title): \(subject)"
                cards.append((front, answer))
            }
        }
        return cards
    }

    /// The prompt for the quality check: the AI reads the result and says what is missing or contradicts itself; it
    /// writes nothing into the board.
    static func reviewPrompt(board: Board, groupName: String, blocks: [BoardBlock]) -> String {
        """
        Das ist das Stundenergebnis, das eine Klasse gemeinsam erarbeitet hat (Kurs: \(groupName), Thema: \(board.title)).

        \(text(board: board, groupName: groupName, blocks: blocks))

        Prüfe das Ergebnis und antworte auf Deutsch in höchstens sechs kurzen Stichpunkten:
        - Was ist fachlich falsch oder missverständlich?
        - Wo widersprechen sich zwei Beiträge?
        - Was fehlt noch (zum Beispiel ein Anwendungsbeispiel oder eine Abgrenzung)?
        Schreib das Ergebnis nicht um und erfinde keine Beiträge. Wenn alles stimmt, sag das in einem Satz.
        """
    }

    static let reviewSystem = """
    You review a lesson result that a German upper-secondary class wrote together. You are a careful subject teacher: \
    you point out mistakes, contradictions and gaps, you never rewrite the result and never add content of your own. \
    Write in German, address the class as "ihr" and write math with Unicode characters, never LaTeX.
    """
}
