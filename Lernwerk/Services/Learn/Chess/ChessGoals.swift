import Foundation

enum ChessCastleSide: Equatable, Hashable {
    case kingside, queenside

    var germanName: String { self == .kingside ? "kurze" : "lange" }
    var notation: String { self == .kingside ? "O-O" : "O-O-O" }
}

/// A description of the legal moves an exercise asks for. All fields that are set must hold at once.
struct ChessMoveFilter: Hashable {
    var from: ChessSquare?
    var to: ChessSquare?
    /// The kind of the piece that moves.
    var kind: ChessPieceKind?
    var capture: Bool?
    var promotion: Bool?
    /// The piece a promoting pawn becomes.
    var promotionTo: ChessPieceKind?
    var enPassant: Bool?
    var castling: ChessCastleSide?
    var check: Bool?
    var mate: Bool?

    init(from: ChessSquare? = nil, to: ChessSquare? = nil, kind: ChessPieceKind? = nil, capture: Bool? = nil,
         promotion: Bool? = nil, promotionTo: ChessPieceKind? = nil, enPassant: Bool? = nil,
         castling: ChessCastleSide? = nil, check: Bool? = nil, mate: Bool? = nil) {
        self.from = from
        self.to = to
        self.kind = kind
        self.capture = capture
        self.promotion = promotion
        self.promotionTo = promotionTo
        self.enPassant = enPassant
        self.castling = castling
        self.check = check
        self.mate = mate
    }

    func matches(_ move: ChessMove, in position: ChessPosition) -> Bool {
        if let from, move.from != from { return false }
        if let to, move.to != to { return false }
        if let kind, position[move.from]?.kind != kind { return false }
        if let capture, position.isCapture(move) != capture { return false }
        if let promotion, (move.promotion != nil) != promotion { return false }
        if let promotionTo, move.promotion != promotionTo { return false }
        if let enPassant, position.isEnPassant(move) != enPassant { return false }
        if let castling {
            guard position.isCastling(move), (move.to.file == 6) == (castling == .kingside) else { return false }
        }
        if check != nil || mate != nil {
            let after = position.applying(move)
            if let check, after.isCheck != check { return false }
            if let mate, after.isCheckmate != mate { return false }
        }
        return true
    }
}

/// What the student has to find. The engine turns a goal and a position into the accepted moves, so a course never
/// states an answer by hand.
enum ChessGoal: Hashable {
    /// Every legal move that fits the filter.
    case moves(ChessMoveFilter)
    /// Every legal move that checkmates.
    case mateInOne
    /// Moves out of check by the king, by capturing the checking piece, or by putting a piece in between.
    case escape(ChessEscape)
    /// The captures that win the most by the exchange helper.
    case bestCapture
    /// The moves with the best result of the material search to this depth (half moves).
    case bestMove(depth: Int)
}

enum ChessEscape: Equatable, Hashable {
    case any, kingMoves, captureChecker, interpose
}

enum ChessGoals {
    /// The legal moves that reach the goal, in the generator's order.
    static func accepted(_ goal: ChessGoal, in position: ChessPosition) -> [ChessMove] {
        ChessGoalCache.shared.moves(for: goal, in: position) { compute(goal, in: position) }
    }

    private static func compute(_ goal: ChessGoal, in position: ChessPosition) -> [ChessMove] {
        let legal = position.legalMoves()
        switch goal {
        case let .moves(filter):
            return legal.filter { filter.matches($0, in: position) }
        case .mateInOne:
            return legal.filter { position.applying($0).isCheckmate }
        case let .escape(kind):
            guard position.isCheck, let king = position.kingSquare(of: position.sideToMove) else { return [] }
            let checkers = Set(position.attackers(of: king, by: position.sideToMove.opposite))
            switch kind {
            case .any:
                return legal
            case .kingMoves:
                return legal.filter { $0.from == king }
            case .captureChecker:
                return legal.filter { checkers.contains($0.to) && position.isCapture($0) }
            case .interpose:
                return legal.filter { $0.from != king && !(checkers.contains($0.to) && position.isCapture($0)) }
            }
        case .bestCapture:
            return ChessExchange.bestCaptures(in: position).moves
        case let .bestMove(depth):
            return ChessSearch.bestMoves(in: position, depth: depth).moves
        }
    }

    /// The answers the app can receive for these moves: coordinate notation, and for a queen promotion also the four
    /// characters a tap on the piece and its target square gives. nil if some accepted move is an under-promotion
    /// without the queen promotion of the same squares beside it, which the app could not tell apart.
    static func answers(for moves: [ChessMove]) -> [String]? {
        var result: [String] = []
        for move in moves {
            if move.promotion == nil {
                result.append(move.uci)
                continue
            }
            let queenAccepted = moves.contains { $0.from == move.from && $0.to == move.to && $0.promotion == .queen }
            guard queenAccepted else { return nil }
            result.append(move.uci)
            if move.promotion == .queen { result.append(move.from.name + move.to.name) }
        }
        var seen = Set<String>()
        return result.filter { seen.insert($0).inserted }
    }

    /// The accepted moves in notation for the feedback: "Dh5#", at most `limit` of them, joined with "oder".
    static func solutionText(_ moves: [ChessMove], in position: ChessPosition, limit: Int = 3) -> String {
        let texts = moves.compactMap { ChessNotation.san($0, in: position) }
        var shown = Array(texts.prefix(limit))
        if texts.count > limit { shown.append("…") }
        return shown.joined(separator: " oder ")
    }
}

/// Remembers the accepted moves of a goal in a position, so a search runs once per position however often a lesson
/// is built. The answer depends on nothing but the key.
final class ChessGoalCache: @unchecked Sendable {
    static let shared = ChessGoalCache()

    private struct Key: Hashable {
        let fen: String
        let goal: ChessGoal
    }

    private let lock = NSLock()
    private var stored: [Key: [ChessMove]] = [:]

    func moves(for goal: ChessGoal, in position: ChessPosition, compute: () -> [ChessMove]) -> [ChessMove] {
        let key = Key(fen: position.fen, goal: goal)
        lock.lock()
        let known = stored[key]
        lock.unlock()
        if let known { return known }
        let result = compute()
        lock.lock()
        stored[key] = result
        lock.unlock()
        return result
    }
}
