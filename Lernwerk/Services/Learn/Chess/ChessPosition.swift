import Foundation

/// A complete chess position as FEN holds it: the board, the side to move, the castling rights, the en passant
/// square and the two move counters. A value type; every move makes a new position.
struct ChessPosition: Equatable, Hashable {
    static let startFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    static let empty = ChessPosition(fen: "8/8/8/8/8/8/8/8 w - - 0 1")!

    /// 64 squares from a1, one piece code each: 0 empty, 1 to 6 White's pawn to king, 9 to 14 Black's.
    private(set) var board: [UInt8]
    var sideToMove: ChessColor
    var castling: ChessCastlingRights
    /// The square behind a pawn that has just advanced two squares, as FEN prints it.
    var enPassant: ChessSquare?
    /// Half moves since the last capture or pawn move; a draw can be claimed at 100.
    var halfmoveClock: Int
    var fullmoveNumber: Int

    // MARK: Codes

    @inline(__always) static func code(_ color: ChessColor, _ kind: ChessPieceKind) -> UInt8 {
        UInt8(kind.rawValue) + (color == .black ? 8 : 0)
    }

    @inline(__always) static func kindCode(_ code: UInt8) -> Int { Int(code & 7) }
    @inline(__always) static func colorBit(_ color: ChessColor) -> UInt8 { color == .black ? 8 : 0 }

    static func piece(fromCode code: UInt8) -> ChessPiece? {
        guard code != 0, let kind = ChessPieceKind(rawValue: Int(code & 7)) else { return nil }
        return ChessPiece(code & 8 == 0 ? .white : .black, kind)
    }

    // MARK: Reading the board

    subscript(square: ChessSquare) -> ChessPiece? {
        ChessPosition.piece(fromCode: board[square.index])
    }

    func piece(at square: ChessSquare) -> ChessPiece? { self[square] }

    /// Every piece with its square, from a1 up.
    var pieces: [(square: ChessSquare, piece: ChessPiece)] {
        (0..<64).compactMap { index in
            ChessPosition.piece(fromCode: board[index]).map { (ChessSquare(index: index), $0) }
        }
    }

    func squares(of piece: ChessPiece) -> [ChessSquare] {
        let wanted = ChessPosition.code(piece.color, piece.kind)
        return (0..<64).filter { board[$0] == wanted }.map { ChessSquare(index: $0) }
    }

    func squares(of color: ChessColor) -> [ChessSquare] {
        let bit = ChessPosition.colorBit(color)
        return (0..<64).filter { board[$0] != 0 && board[$0] & 8 == bit }.map { ChessSquare(index: $0) }
    }

    func kingSquare(of color: ChessColor) -> ChessSquare? {
        let wanted = ChessPosition.code(color, .king)
        return board.firstIndex(of: wanted).map { ChessSquare(index: $0) }
    }

    /// The total value of a side's pieces with 1, 3, 3, 5, 9 and nothing for the king.
    func material(of color: ChessColor) -> Int {
        let bit = ChessPosition.colorBit(color)
        var total = 0
        for code in board where code != 0 && code & 8 == bit {
            total += ChessPieceKind(rawValue: Int(code & 7))?.value ?? 0
        }
        return total
    }

    /// Material of the side to move minus the other side's.
    var materialBalanceForSideToMove: Int {
        material(of: sideToMove) - material(of: sideToMove.opposite)
    }

    func count(of piece: ChessPiece) -> Int {
        let wanted = ChessPosition.code(piece.color, piece.kind)
        return board.reduce(0) { $0 + ($1 == wanted ? 1 : 0) }
    }

    // MARK: FEN

    /// Parses a FEN with six fields, or with the first four (the counters then start at 0 and 1). nil if anything is
    /// malformed: not eight ranks of eight squares, an unknown letter, a wrong side, castling or en passant field.
    init?(fen: String) {
        let fields = fen.split(separator: " ", omittingEmptySubsequences: true).map(String.init)
        guard fields.count == 4 || fields.count == 6 else { return nil }
        let ranks = fields[0].split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        guard ranks.count == 8 else { return nil }
        var board = [UInt8](repeating: 0, count: 64)
        for (rowIndex, row) in ranks.enumerated() {
            let rank = 7 - rowIndex
            var file = 0
            for character in row {
                if let digit = character.wholeNumberValue, (1...8).contains(digit) {
                    file += digit
                } else if let piece = ChessPiece(fenCharacter: character), file < 8 {
                    board[rank * 8 + file] = ChessPosition.code(piece.color, piece.kind)
                    file += 1
                } else {
                    return nil
                }
                if file > 8 { return nil }
            }
            if file != 8 { return nil }
        }
        let side: ChessColor
        switch fields[1] {
        case "w": side = .white
        case "b": side = .black
        default: return nil
        }
        guard let rights = ChessCastlingRights(fen: fields[2]) else { return nil }
        var passant: ChessSquare?
        if fields[3] != "-" {
            guard let square = ChessSquare(fields[3]), fields[3] == square.name, square.rank == 2 || square.rank == 5 else { return nil }
            passant = square
        }
        var halfmove = 0
        var fullmove = 1
        if fields.count == 6 {
            guard let half = Int(fields[4]), half >= 0, let full = Int(fields[5]), full >= 1 else { return nil }
            halfmove = half
            fullmove = full
        }
        self.board = board
        sideToMove = side
        castling = rights
        enPassant = passant
        halfmoveClock = halfmove
        fullmoveNumber = fullmove
    }

    static var start: ChessPosition { ChessPosition(fen: startFEN)! }

    /// The six FEN fields.
    var fen: String {
        var rows: [String] = []
        for rank in stride(from: 7, through: 0, by: -1) {
            var row = ""
            var gap = 0
            for file in 0..<8 {
                if let piece = ChessPosition.piece(fromCode: board[rank * 8 + file]) {
                    if gap > 0 { row += String(gap); gap = 0 }
                    row.append(piece.fenCharacter)
                } else {
                    gap += 1
                }
            }
            if gap > 0 { row += String(gap) }
            rows.append(row)
        }
        let side = sideToMove == .white ? "w" : "b"
        return "\(rows.joined(separator: "/")) \(side) \(castling.fen) \(enPassant?.name ?? "-") \(halfmoveClock) \(fullmoveNumber)"
    }

    /// The board as eight text lines, rank 8 first; for tests and debugging.
    var diagram: String {
        (0..<8).map { row in
            let rank = 7 - row
            return (0..<8).map { file -> String in
                ChessPosition.piece(fromCode: board[rank * 8 + file]).map { String($0.fenCharacter) } ?? "."
            }.joined()
        }.joined(separator: "\n")
    }

    // MARK: Changing the board

    /// The position with a piece put on a square or taken off it; the counters and rights stay as they are.
    func setting(_ piece: ChessPiece?, at square: ChessSquare) -> ChessPosition {
        var copy = self
        copy.board[square.index] = piece.map { ChessPosition.code($0.color, $0.kind) } ?? 0
        return copy
    }

    func with(sideToMove side: ChessColor) -> ChessPosition {
        var copy = self
        copy.sideToMove = side
        return copy
    }

    // MARK: Attacks

    /// Whether a piece of `color` attacks the square (a pawn attacks diagonally forward; a pinned piece still attacks).
    func isAttacked(_ square: ChessSquare, by color: ChessColor) -> Bool {
        ChessPosition.isAttacked(board: board, square: square.index, by: color)
    }

    static func isAttacked(board: [UInt8], square: Int, by color: ChessColor) -> Bool {
        let bit = colorBit(color)
        let file = square & 7
        let rank = square >> 3
        // Pawns: a white pawn attacks the squares one rank above it, so it stands one rank below the target.
        if color == .white {
            if rank > 0 {
                if file > 0, board[square - 9] == 1 { return true }
                if file < 7, board[square - 7] == 1 { return true }
            }
        } else if rank < 7 {
            if file > 0, board[square + 7] == 9 { return true }
            if file < 7, board[square + 9] == 9 { return true }
        }
        let knight = 2 + bit
        for target in ChessTables.knightJumps[square] where board[target] == knight { return true }
        let king = 6 + bit
        for target in ChessTables.kingSteps[square] where board[target] == king { return true }
        let rays = ChessTables.rays[square]
        for direction in 0..<8 {
            for target in rays[direction] {
                let code = board[target]
                if code == 0 { continue }
                if code & 8 == bit {
                    let kind = code & 7
                    if kind == 5 || (direction < 4 ? kind == 4 : kind == 3) { return true }
                }
                break
            }
        }
        return false
    }

    /// The squares of every piece of `color` that attacks the square, from a1 up.
    func attackers(of square: ChessSquare, by color: ChessColor) -> [ChessSquare] {
        let target = square.index
        let bit = ChessPosition.colorBit(color)
        var result: [Int] = []
        let file = target & 7
        let rank = target >> 3
        if color == .white {
            if rank > 0 {
                if file > 0, board[target - 9] == 1 { result.append(target - 9) }
                if file < 7, board[target - 7] == 1 { result.append(target - 7) }
            }
        } else if rank < 7 {
            if file > 0, board[target + 7] == 9 { result.append(target + 7) }
            if file < 7, board[target + 9] == 9 { result.append(target + 9) }
        }
        for from in ChessTables.knightJumps[target] where board[from] == 2 + bit { result.append(from) }
        for from in ChessTables.kingSteps[target] where board[from] == 6 + bit { result.append(from) }
        for direction in 0..<8 {
            for from in ChessTables.rays[target][direction] {
                let code = board[from]
                if code == 0 { continue }
                if code & 8 == bit {
                    let kind = code & 7
                    if kind == 5 || (direction < 4 ? kind == 4 : kind == 3) { result.append(from) }
                }
                break
            }
        }
        return result.sorted().map { ChessSquare(index: $0) }
    }

    /// Whether the side to move is in check.
    var isCheck: Bool {
        guard let king = kingSquare(of: sideToMove) else { return false }
        return isAttacked(king, by: sideToMove.opposite)
    }

    /// Whether `color`'s king is attacked, whoever is to move.
    func isInCheck(_ color: ChessColor) -> Bool {
        guard let king = kingSquare(of: color) else { return false }
        return isAttacked(king, by: color.opposite)
    }

    // MARK: Making a move

    /// The position after a move. The move has to be legal in this position; nothing is checked here. A pawn that
    /// reaches the last rank without a piece named becomes a queen.
    func applying(_ move: ChessMove) -> ChessPosition {
        var next = self
        let from = move.from.index
        let to = move.to.index
        let moving = board[from]
        let target = board[to]
        let kind = ChessPosition.kindCode(moving)
        let color: ChessColor = moving & 8 == 0 ? .white : .black
        var isCapture = target != 0
        next.board[from] = 0
        if kind == ChessPieceKind.pawn.rawValue {
            if move.to == enPassant, target == 0, move.from.file != move.to.file {
                next.board[move.from.rank * 8 + move.to.file] = 0
                isCapture = true
            }
            if move.to.rank == color.promotionRank {
                next.board[to] = ChessPosition.code(color, move.promotion ?? .queen)
            } else {
                next.board[to] = moving
            }
        } else {
            next.board[to] = moving
            if kind == ChessPieceKind.king.rawValue, abs(move.to.file - move.from.file) == 2 {
                let rank = move.from.rank
                if move.to.file == 6 {
                    next.board[rank * 8 + 7] = 0
                    next.board[rank * 8 + 5] = ChessPosition.code(color, .rook)
                } else {
                    next.board[rank * 8] = 0
                    next.board[rank * 8 + 3] = ChessPosition.code(color, .rook)
                }
            }
        }
        // Castling rights go when the king or a rook leaves its square, or a rook is captured on its square.
        for square in [from, to] {
            switch square {
            case 4: next.castling.subtract([.whiteKingside, .whiteQueenside])
            case 0: next.castling.subtract(.whiteQueenside)
            case 7: next.castling.subtract(.whiteKingside)
            case 60: next.castling.subtract([.blackKingside, .blackQueenside])
            case 56: next.castling.subtract(.blackQueenside)
            case 63: next.castling.subtract(.blackKingside)
            default: break
            }
        }
        if kind == ChessPieceKind.pawn.rawValue, abs(move.to.rank - move.from.rank) == 2 {
            next.enPassant = ChessSquare(index: (from + to) / 2)
        } else {
            next.enPassant = nil
        }
        next.halfmoveClock = (kind == ChessPieceKind.pawn.rawValue || isCapture) ? 0 : halfmoveClock + 1
        if color == .black { next.fullmoveNumber += 1 }
        next.sideToMove = color.opposite
        return next
    }

    /// The position after a legal move in coordinate notation like "e2e4" or "e7e8q"; nil when it is not legal.
    func playing(_ uci: String) -> ChessPosition? {
        guard let move = ChessMove(uci: uci), legalMoves().contains(move) else { return nil }
        return applying(move)
    }

    /// The position after the moves, in coordinate notation, in order; nil when one is not legal.
    func playing(line: [String]) -> ChessPosition? {
        var position = self
        for uci in line {
            guard let next = position.playing(uci) else { return nil }
            position = next
        }
        return position
    }
}
