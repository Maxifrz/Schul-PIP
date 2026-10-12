import Foundation

/// Legal moves, the end of the game and the checks on a position's consistency.
extension ChessPosition {
    // MARK: Pseudo-legal moves

    /// Every move the pieces can make by their own rules, castling included, whether or not it leaves the own king in
    /// check. `legalMoves()` filters those.
    func pseudoLegalMoves() -> [ChessMove] {
        var moves: [ChessMove] = []
        moves.reserveCapacity(48)
        let side = sideToMove
        let bit = ChessPosition.colorBit(side)
        for from in 0..<64 {
            let code = board[from]
            guard code != 0, code & 8 == bit else { continue }
            let origin = ChessSquare(index: from)
            switch code & 7 {
            case 1: addPawnMoves(from: origin, side: side, to: &moves)
            case 2:
                for target in ChessTables.knightJumps[from] where board[target] == 0 || board[target] & 8 != bit {
                    moves.append(ChessMove(from: origin, to: ChessSquare(index: target)))
                }
            case 3: addSlidingMoves(from: origin, directions: 4..<8, bit: bit, to: &moves)
            case 4: addSlidingMoves(from: origin, directions: 0..<4, bit: bit, to: &moves)
            case 5: addSlidingMoves(from: origin, directions: 0..<8, bit: bit, to: &moves)
            default:
                for target in ChessTables.kingSteps[from] where board[target] == 0 || board[target] & 8 != bit {
                    moves.append(ChessMove(from: origin, to: ChessSquare(index: target)))
                }
                addCastlingMoves(side: side, to: &moves)
            }
        }
        return moves
    }

    private func addSlidingMoves(from: ChessSquare, directions: Range<Int>, bit: UInt8, to moves: inout [ChessMove]) {
        let rays = ChessTables.rays[from.index]
        for direction in directions {
            for target in rays[direction] {
                let code = board[target]
                if code == 0 {
                    moves.append(ChessMove(from: from, to: ChessSquare(index: target)))
                    continue
                }
                if code & 8 != bit { moves.append(ChessMove(from: from, to: ChessSquare(index: target))) }
                break
            }
        }
    }

    private func addPawnMoves(from: ChessSquare, side: ChessColor, to moves: inout [ChessMove]) {
        let step = side.pawnDirection
        let promotes = from.rank + step == side.promotionRank
        func add(_ target: ChessSquare) {
            if promotes {
                for kind in [ChessPieceKind.queen, .rook, .bishop, .knight] {
                    moves.append(ChessMove(from: from, to: target, promotion: kind))
                }
            } else {
                moves.append(ChessMove(from: from, to: target))
            }
        }
        if let ahead = from.offset(file: 0, rank: step), board[ahead.index] == 0 {
            add(ahead)
            if from.rank == side.pawnStartRank, let twice = from.offset(file: 0, rank: 2 * step), board[twice.index] == 0 {
                moves.append(ChessMove(from: from, to: twice))
            }
        }
        for df in [-1, 1] {
            guard let target = from.offset(file: df, rank: step) else { continue }
            let code = board[target.index]
            if code != 0 {
                if code & 8 != ChessPosition.colorBit(side) { add(target) }
            } else if target == enPassant {
                // The captured pawn stands beside the capturing one, on the square the double step ended on.
                let victim = board[from.rank * 8 + target.file]
                if victim == ChessPosition.code(side.opposite, .pawn) { moves.append(ChessMove(from: from, to: target)) }
            }
        }
    }

    /// Castling needs the right, king and rook at home, nothing between them, and the king neither in check nor
    /// crossing or landing on an attacked square. The rook may be attacked, and the rook's own path may be.
    private func addCastlingMoves(side: ChessColor, to moves: inout [ChessMove]) {
        let rank = side.homeRank
        let base = rank * 8
        let king = ChessPosition.code(side, .king)
        let rook = ChessPosition.code(side, .rook)
        guard board[base + 4] == king else { return }
        let enemy = side.opposite
        let kingside = castling.contains(.kingside(side)) && board[base + 7] == rook && board[base + 5] == 0 && board[base + 6] == 0
        let queenside = castling.contains(.queenside(side)) && board[base] == rook && board[base + 1] == 0 && board[base + 2] == 0 && board[base + 3] == 0
        guard kingside || queenside, !ChessPosition.isAttacked(board: board, square: base + 4, by: enemy) else { return }
        if kingside, !ChessPosition.isAttacked(board: board, square: base + 5, by: enemy), !ChessPosition.isAttacked(board: board, square: base + 6, by: enemy) {
            moves.append(ChessMove(from: ChessSquare(index: base + 4), to: ChessSquare(index: base + 6)))
        }
        if queenside, !ChessPosition.isAttacked(board: board, square: base + 3, by: enemy), !ChessPosition.isAttacked(board: board, square: base + 2, by: enemy) {
            moves.append(ChessMove(from: ChessSquare(index: base + 4), to: ChessSquare(index: base + 2)))
        }
    }

    // MARK: Legal moves

    /// The moves that do not leave the mover's own king in check.
    func legalMoves() -> [ChessMove] {
        let side = sideToMove
        guard var king = kingSquare(of: side)?.index else { return [] }
        let enemy = side.opposite
        var work = board
        var result: [ChessMove] = []
        result.reserveCapacity(40)
        for move in pseudoLegalMoves() {
            let from = move.from.index
            let to = move.to.index
            let moving = work[from]
            let captured = work[to]
            var victimIndex = -1
            var victim: UInt8 = 0
            if ChessPosition.kindCode(moving) == 1, captured == 0, move.from.file != move.to.file {
                victimIndex = move.from.rank * 8 + move.to.file
                victim = work[victimIndex]
                work[victimIndex] = 0
            }
            work[to] = moving
            work[from] = 0
            let isKingMove = ChessPosition.kindCode(moving) == 6
            if isKingMove { king = to }
            let safe = !ChessPosition.isAttacked(board: work, square: king, by: enemy)
            if isKingMove { king = from }
            work[from] = moving
            work[to] = captured
            if victimIndex >= 0 { work[victimIndex] = victim }
            if safe { result.append(move) }
        }
        return result
    }

    func isLegal(_ move: ChessMove) -> Bool {
        legalMoves().contains(move)
    }

    /// Whether the move captures something, en passant included.
    func isCapture(_ move: ChessMove) -> Bool {
        if board[move.to.index] != 0 { return true }
        return isEnPassant(move)
    }

    func isEnPassant(_ move: ChessMove) -> Bool {
        ChessPosition.kindCode(board[move.from.index]) == 1 && move.to == enPassant && board[move.to.index] == 0 && move.from.file != move.to.file
    }

    func isCastling(_ move: ChessMove) -> Bool {
        ChessPosition.kindCode(board[move.from.index]) == 6 && abs(move.to.file - move.from.file) == 2
    }

    /// The piece a move takes, if any (the pawn for en passant).
    func capturedPiece(by move: ChessMove) -> ChessPiece? {
        if let piece = self[move.to] { return piece }
        return isEnPassant(move) ? ChessPiece(sideToMove.opposite, .pawn) : nil
    }

    /// Whether the move gives check or mate to the opponent.
    func givesCheck(_ move: ChessMove) -> Bool {
        applying(move).isCheck
    }

    // MARK: End of the game

    var hasLegalMove: Bool { !legalMoves().isEmpty }

    var isCheckmate: Bool { isCheck && !hasLegalMove }

    /// The side to move is not in check and has no legal move: a draw.
    var isStalemate: Bool { !isCheck && !hasLegalMove }

    /// A draw can be claimed after 50 moves by each side without a capture or a pawn move (100 half moves).
    var canClaimFiftyMoveDraw: Bool { halfmoveClock >= 100 }

    /// No series of legal moves can end in mate: bare kings, a king and one minor piece against a king, or only
    /// bishops that all stand on squares of one color. (A knight against a knight can still be mated with help, so it
    /// is not counted.)
    var hasInsufficientMaterial: Bool {
        var knights = 0
        var bishopsOnDark = 0
        var bishopsOnLight = 0
        for index in 0..<64 {
            let kind = ChessPosition.kindCode(board[index])
            switch kind {
            case 0, 6: continue
            case 2: knights += 1
            case 3:
                if ChessSquare(index: index).isDark { bishopsOnDark += 1 } else { bishopsOnLight += 1 }
            default: return false
            }
        }
        let bishops = bishopsOnDark + bishopsOnLight
        if knights == 0 { return bishopsOnDark == 0 || bishopsOnLight == 0 }
        return knights == 1 && bishops == 0
    }

    // MARK: Perft

    /// The number of move sequences of the given length: the engine's proof of correctness against known counts.
    func perft(_ depth: Int) -> Int {
        guard depth > 0 else { return 1 }
        let moves = legalMoves()
        if depth == 1 { return moves.count }
        var total = 0
        for move in moves { total += applying(move).perft(depth - 1) }
        return total
    }

    // MARK: Consistency

    /// Reasons a position could not arise in a game or cannot be played on: empty when it is sound. Courses check
    /// every authored position with it.
    func validationProblems() -> [String] {
        var problems: [String] = []
        for color in ChessColor.allCases {
            let kings = count(of: ChessPiece(color, .king))
            if kings != 1 { problems.append("\(color.germanName) has \(kings) kings.") }
            let pawns = count(of: ChessPiece(color, .pawn))
            let total = squares(of: color).count
            if pawns > 8 { problems.append("\(color.germanName) has \(pawns) pawns.") }
            if total > 16 { problems.append("\(color.germanName) has \(total) pieces.") }
            // Every piece beyond the starting set must come from a promoted pawn.
            let extras = [(ChessPieceKind.queen, 1), (.rook, 2), (.bishop, 2), (.knight, 2)].reduce(0) {
                $0 + max(0, count(of: ChessPiece(color, $1.0)) - $1.1)
            }
            if extras > 8 - pawns { problems.append("\(color.germanName) has more pieces than promotions allow.") }
        }
        for index in 0..<64 where ChessPosition.kindCode(board[index]) == 1 {
            let rank = ChessSquare(index: index).rank
            if rank == 0 || rank == 7 { problems.append("A pawn stands on \(ChessSquare(index: index).name).") }
        }
        // The side that just moved cannot have left its own king in check.
        if isInCheck(sideToMove.opposite) { problems.append("\(sideToMove.opposite.germanName) is in check but \(sideToMove.germanName) is to move.") }
        let rights: [(ChessCastlingRights, ChessColor, Int, String)] = [
            (.whiteKingside, .white, 7, "h1"), (.whiteQueenside, .white, 0, "a1"),
            (.blackKingside, .black, 63, "h8"), (.blackQueenside, .black, 56, "a8"),
        ]
        for (right, color, rookIndex, rookName) in rights where castling.contains(right) {
            let kingIndex = color.homeRank * 8 + 4
            if board[kingIndex] != ChessPosition.code(color, .king) { problems.append("\(color.germanName) may castle but the king is not on its square.") }
            if board[rookIndex] != ChessPosition.code(color, .rook) { problems.append("\(color.germanName) may castle but there is no rook on \(rookName).") }
        }
        if let target = enPassant {
            let mover = sideToMove.opposite
            // After White's double step the target is on rank 3 and Black is to move, and the other way round.
            let expectedRank = mover == .white ? 2 : 5
            if target.rank != expectedRank { problems.append("The en passant square \(target.name) does not fit the side to move.") }
            if board[target.index] != 0 { problems.append("The en passant square \(target.name) is occupied.") }
            let pawnIndex = (target.rank + mover.pawnDirection) * 8 + target.file
            if (0..<64).contains(pawnIndex), board[pawnIndex] != ChessPosition.code(mover, .pawn) {
                problems.append("There is no pawn that could have just moved to the square in front of \(target.name).")
            }
            let originIndex = (target.rank - mover.pawnDirection) * 8 + target.file
            if (0..<64).contains(originIndex), board[originIndex] != 0 { problems.append("The pawn's start square for \(target.name) is not empty.") }
        }
        return problems
    }
}
