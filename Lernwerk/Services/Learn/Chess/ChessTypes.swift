import Foundation

// The building blocks of the chess rules engine: colors, pieces, squares, moves. Foundation only.

enum ChessColor: Equatable, Hashable, CaseIterable {
    case white, black

    var opposite: ChessColor { self == .white ? .black : .white }
    /// "Weiß" or "Schwarz".
    var germanName: String { self == .white ? "Weiß" : "Schwarz" }
    /// The lower-case adjective stem: "weiß" or "schwarz".
    var adjectiveStem: String { self == .white ? "weiß" : "schwarz" }
    /// Pawns move up the board (towards rank 8) for White and down for Black.
    var pawnDirection: Int { self == .white ? 1 : -1 }
    /// The rank (0 based) a side's pieces start on.
    var homeRank: Int { self == .white ? 0 : 7 }
    /// The rank (0 based) a side's pawns start on.
    var pawnStartRank: Int { self == .white ? 1 : 6 }
    /// The rank (0 based) on which a pawn of this side promotes.
    var promotionRank: Int { self == .white ? 7 : 0 }
}

/// The grammatical case a German piece phrase is put in.
enum ChessCase {
    case nominative, accusative, dative
}

enum ChessPieceKind: Int, Equatable, Hashable, CaseIterable, Comparable {
    case pawn = 1, knight, bishop, rook, queen, king

    static func < (a: ChessPieceKind, b: ChessPieceKind) -> Bool { a.rawValue < b.rawValue }

    /// The usual exchange values 1, 3, 3, 5, 9. The king has none: it cannot be captured, only mated.
    var value: Int {
        switch self {
        case .pawn: return 1
        case .knight, .bishop: return 3
        case .rook: return 5
        case .queen: return 9
        case .king: return 0
        }
    }

    /// The letter of German notation: K König, D Dame, T Turm, L Läufer, S Springer; none for a pawn.
    var letter: String {
        switch self {
        case .pawn: return ""
        case .knight: return "S"
        case .bishop: return "L"
        case .rook: return "T"
        case .queen: return "D"
        case .king: return "K"
        }
    }

    /// The lower-case letter FEN uses for a black piece (and the one coordinate notation uses for a promotion).
    var fenLetter: Character {
        switch self {
        case .pawn: return "p"
        case .knight: return "n"
        case .bishop: return "b"
        case .rook: return "r"
        case .queen: return "q"
        case .king: return "k"
        }
    }

    init?(fenLetter: Character) {
        guard let kind = ChessPieceKind.allCases.first(where: { $0.fenLetter == Character(fenLetter.lowercased()) }) else { return nil }
        self = kind
    }

    /// "Bauer", "Springer", "Läufer", "Turm", "Dame", "König".
    var germanName: String {
        switch self {
        case .pawn: return "Bauer"
        case .knight: return "Springer"
        case .bishop: return "Läufer"
        case .rook: return "Turm"
        case .queen: return "Dame"
        case .king: return "König"
        }
    }

    /// The plural: "Bauern", "Springer", "Läufer", "Türme", "Damen", "Könige".
    var germanPlural: String {
        switch self {
        case .pawn: return "Bauern"
        case .knight: return "Springer"
        case .bishop: return "Läufer"
        case .rook: return "Türme"
        case .queen: return "Damen"
        case .king: return "Könige"
        }
    }

    var isFeminine: Bool { self == .queen }

    /// The noun in a case; the pawn is a weak noun ("den Bauern").
    func noun(_ grammaticalCase: ChessCase) -> String {
        if self == .pawn, grammaticalCase != .nominative { return "Bauern" }
        return germanName
    }

    /// Definite article: "der Turm", "die Dame", "den Turm", "dem Turm", "der Dame".
    func article(_ grammaticalCase: ChessCase) -> String {
        switch (grammaticalCase, isFeminine) {
        case (.nominative, false): return "der"
        case (.nominative, true), (.accusative, true): return "die"
        case (.accusative, false): return "den"
        case (.dative, false): return "dem"
        case (.dative, true): return "der"
        }
    }

    /// Bishop, rook and queen move any number of squares along a line; knight, king and pawn do not.
    var slides: Bool { self == .bishop || self == .rook || self == .queen }
}

struct ChessPiece: Equatable, Hashable {
    let color: ChessColor
    let kind: ChessPieceKind

    init(_ color: ChessColor, _ kind: ChessPieceKind) {
        self.color = color
        self.kind = kind
    }

    /// FEN letter: upper case for White.
    var fenCharacter: Character {
        let letter = kind.fenLetter
        return color == .white ? Character(letter.uppercased()) : letter
    }

    init?(fenCharacter: Character) {
        guard let kind = ChessPieceKind(fenLetter: fenCharacter) else { return nil }
        self.init(fenCharacter.isUppercase ? .white : .black, kind)
    }

    /// "der weiße Springer", "die schwarze Dame", "den weißen Bauern", "dem schwarzen Turm".
    func phrase(_ grammaticalCase: ChessCase = .nominative) -> String {
        let feminine = kind.isFeminine
        let ending: String
        switch (grammaticalCase, feminine) {
        case (.nominative, false): ending = "e"
        case (.nominative, true), (.accusative, true): ending = "e"
        case (.accusative, false), (.dative, false): ending = "en"
        case (.dative, true): ending = "en"
        }
        return "\(kind.article(grammaticalCase)) \(color.adjectiveStem)\(ending) \(kind.noun(grammaticalCase))"
    }

    /// The plain name without a color: "Springer".
    var germanName: String { kind.germanName }
}

struct ChessSquare: Equatable, Hashable, Comparable {
    /// 0 is a1, 1 is b1, 8 is a2, 63 is h8.
    let index: Int

    init(index: Int) {
        precondition((0..<64).contains(index), "A square index is 0 to 63.")
        self.index = index
    }

    init?(file: Int, rank: Int) {
        guard (0..<8).contains(file), (0..<8).contains(rank) else { return nil }
        index = rank * 8 + file
    }

    /// "e4"; nil for anything else.
    init?(_ name: String) {
        let characters = Array(name.lowercased())
        guard characters.count == 2, let file = ChessSquare.fileLetters.firstIndex(of: characters[0]),
              let rank = ChessSquare.rankDigits.firstIndex(of: characters[1]) else { return nil }
        index = rank * 8 + file
    }

    static let fileLetters: [Character] = ["a", "b", "c", "d", "e", "f", "g", "h"]
    static let rankDigits: [Character] = ["1", "2", "3", "4", "5", "6", "7", "8"]
    static let all: [ChessSquare] = (0..<64).map { ChessSquare(index: $0) }

    static func < (a: ChessSquare, b: ChessSquare) -> Bool { a.index < b.index }

    /// 0 for the a-file to 7 for the h-file.
    var file: Int { index & 7 }
    /// 0 for rank 1 to 7 for rank 8.
    var rank: Int { index >> 3 }
    var fileLetter: String { String(ChessSquare.fileLetters[file]) }
    var rankDigit: String { String(ChessSquare.rankDigits[rank]) }
    var name: String { fileLetter + rankDigit }

    /// a1 is a dark square, and the colors alternate from there.
    var isDark: Bool { (file + rank) % 2 == 0 }
    var isLight: Bool { !isDark }

    /// The square a step away, nil off the board.
    func offset(file df: Int, rank dr: Int) -> ChessSquare? {
        ChessSquare(file: file + df, rank: rank + dr)
    }
}

struct ChessMove: Equatable, Hashable {
    let from: ChessSquare
    let to: ChessSquare
    /// The piece a pawn becomes on the last rank (queen, rook, bishop or knight).
    let promotion: ChessPieceKind?

    init(from: ChessSquare, to: ChessSquare, promotion: ChessPieceKind? = nil) {
        self.from = from
        self.to = to
        self.promotion = promotion
    }

    /// Coordinate notation: "e2e4", "e7e8q"; castling is the king's move, "e1g1".
    init?(uci: String) {
        let characters = Array(uci.lowercased())
        guard characters.count == 4 || characters.count == 5,
              let from = ChessSquare(String(characters[0...1])), let to = ChessSquare(String(characters[2...3])) else { return nil }
        var promotion: ChessPieceKind?
        if characters.count == 5 {
            guard let kind = ChessPieceKind(fenLetter: characters[4]), [.queen, .rook, .bishop, .knight].contains(kind) else { return nil }
            promotion = kind
        }
        self.init(from: from, to: to, promotion: promotion)
    }

    var uci: String { from.name + to.name + (promotion.map { String($0.fenLetter) } ?? "") }
}

struct ChessCastlingRights: OptionSet, Hashable {
    let rawValue: UInt8

    init(rawValue: UInt8) {
        self.rawValue = rawValue
    }

    static let whiteKingside = ChessCastlingRights(rawValue: 1)
    static let whiteQueenside = ChessCastlingRights(rawValue: 2)
    static let blackKingside = ChessCastlingRights(rawValue: 4)
    static let blackQueenside = ChessCastlingRights(rawValue: 8)
    static let all: ChessCastlingRights = [.whiteKingside, .whiteQueenside, .blackKingside, .blackQueenside]

    static func kingside(_ color: ChessColor) -> ChessCastlingRights { color == .white ? .whiteKingside : .blackKingside }
    static func queenside(_ color: ChessColor) -> ChessCastlingRights { color == .white ? .whiteQueenside : .blackQueenside }

    /// The FEN field: "KQkq", "Kq", or "-".
    var fen: String {
        var text = ""
        if contains(.whiteKingside) { text += "K" }
        if contains(.whiteQueenside) { text += "Q" }
        if contains(.blackKingside) { text += "k" }
        if contains(.blackQueenside) { text += "q" }
        return text.isEmpty ? "-" : text
    }

    init?(fen: String) {
        if fen == "-" {
            self = []
            return
        }
        var rights: ChessCastlingRights = []
        for character in fen {
            switch character {
            case "K": rights.insert(.whiteKingside)
            case "Q": rights.insert(.whiteQueenside)
            case "k": rights.insert(.blackKingside)
            case "q": rights.insert(.blackQueenside)
            default: return nil
            }
        }
        guard !fen.isEmpty, Set(fen).count == fen.count else { return nil }
        self = rights
    }
}

/// Precomputed lines for the move generator: rays along the eight directions and the jumps of knight and king.
enum ChessTables {
    /// The first four are the rook's directions (up, down, right, left), the last four the bishop's.
    static let directions: [(file: Int, rank: Int)] = [(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, 1), (1, -1), (-1, -1)]

    /// `rays[square][direction]`: the squares from the one next to `square` to the edge.
    static let rays: [[[Int]]] = (0..<64).map { index in
        directions.map { direction in
            var line: [Int] = []
            var file = (index & 7) + direction.file
            var rank = (index >> 3) + direction.rank
            while (0..<8).contains(file), (0..<8).contains(rank) {
                line.append(rank * 8 + file)
                file += direction.file
                rank += direction.rank
            }
            return line
        }
    }

    static let knightJumps: [[Int]] = (0..<64).map { index in
        let steps = [(1, 2), (2, 1), (2, -1), (1, -2), (-1, -2), (-2, -1), (-2, 1), (-1, 2)]
        return steps.compactMap { ChessSquare(file: (index & 7) + $0.0, rank: (index >> 3) + $0.1)?.index }
    }

    static let kingSteps: [[Int]] = (0..<64).map { index in
        directions.compactMap { ChessSquare(file: (index & 7) + $0.file, rank: (index >> 3) + $0.rank)?.index }
    }
}
