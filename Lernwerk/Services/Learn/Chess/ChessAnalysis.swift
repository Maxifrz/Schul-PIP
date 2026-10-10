import Foundation

/// Why a castling is not possible, one reason each; a position can have several.
enum ChessCastlingProblem: Equatable, Hashable {
    /// The king or this rook has moved before (the FEN's castling field lacks the right), or is not on its square.
    case rightLost
    /// A piece stands between king and rook.
    case piecesBetween
    /// The king is in check.
    case inCheck
    /// The king would cross a square the opponent attacks.
    case crossesAttackedSquare
    /// The king would land on a square the opponent attacks.
    case landsOnAttackedSquare
}

enum ChessCastling {
    /// The reasons the side to move cannot castle to a side. Computed from the rules of Article 3.8, independently of
    /// the move generator; no reasons means the castling is possible.
    static func problems(_ side: ChessCastleSide, in position: ChessPosition) -> [ChessCastlingProblem] {
        let color = position.sideToMove
        let rank = color.homeRank
        func square(_ file: Int) -> ChessSquare { ChessSquare(file: file, rank: rank)! }
        let rookFile = side == .kingside ? 7 : 0
        let between = side == .kingside ? [5, 6] : [1, 2, 3]
        let crossed = side == .kingside ? 5 : 3
        let landing = side == .kingside ? 6 : 2
        let enemy = color.opposite
        var result: [ChessCastlingProblem] = []
        let right: ChessCastlingRights = side == .kingside ? .kingside(color) : .queenside(color)
        if !position.castling.contains(right) || position[square(4)] != ChessPiece(color, .king)
            || position[square(rookFile)] != ChessPiece(color, .rook) {
            result.append(.rightLost)
        }
        if between.contains(where: { position[square($0)] != nil }) { result.append(.piecesBetween) }
        if position.isAttacked(square(4), by: enemy) { result.append(.inCheck) }
        if position.isAttacked(square(crossed), by: enemy) { result.append(.crossesAttackedSquare) }
        if position.isAttacked(square(landing), by: enemy) { result.append(.landsOnAttackedSquare) }
        return result
    }
}

/// Where a piece attacks; the building block of the tactical motifs.
extension ChessPosition {
    /// The squares the piece on `square` attacks, occupied or not (a pinned piece still attacks).
    func attackedSquares(by square: ChessSquare) -> [ChessSquare] {
        guard let piece = self[square] else { return [] }
        switch piece.kind {
        case .pawn:
            return [-1, 1].compactMap { square.offset(file: $0, rank: piece.color.pawnDirection) }
        case .knight:
            return ChessTables.knightJumps[square.index].map { ChessSquare(index: $0) }
        case .king:
            return ChessTables.kingSteps[square.index].map { ChessSquare(index: $0) }
        case .bishop, .rook, .queen:
            let directions = piece.kind == .bishop ? 4..<8 : (piece.kind == .rook ? 0..<4 : 0..<8)
            var result: [ChessSquare] = []
            for direction in directions {
                for target in ChessTables.rays[square.index][direction] {
                    result.append(ChessSquare(index: target))
                    if board[target] != 0 { break }
                }
            }
            return result
        }
    }

    /// The enemy pieces the piece on `square` attacks.
    func attackedEnemies(by square: ChessSquare) -> [ChessSquare] {
        guard let piece = self[square] else { return [] }
        return attackedSquares(by: square).filter { self[$0].map { $0.color != piece.color } ?? false }
    }
}

/// A line on which a long-range piece looks at an enemy piece and, behind it, at another.
struct ChessLineUp: Equatable {
    let attacker: ChessSquare
    let front: ChessSquare
    let back: ChessSquare
}

enum ChessTactics {
    /// A piece of `color` that cannot leave a line because its king stands behind it, and the enemy piece on that line.
    static func absolutePins(of color: ChessColor, in position: ChessPosition) -> [(pinned: ChessSquare, pinner: ChessSquare)] {
        guard let king = position.kingSquare(of: color) else { return [] }
        var result: [(ChessSquare, ChessSquare)] = []
        for direction in 0..<8 {
            var own: ChessSquare?
            for index in ChessTables.rays[king.index][direction] {
                let square = ChessSquare(index: index)
                guard let piece = position[square] else { continue }
                if own == nil {
                    if piece.color == color { own = square } else { break }
                } else {
                    let slidesThere = piece.kind == .queen || (direction < 4 ? piece.kind == .rook : piece.kind == .bishop)
                    if piece.color != color, slidesThere, let pinned = own { result.append((pinned, square)) }
                    break
                }
            }
        }
        return result.sorted { $0.0 < $1.0 }
    }

    /// Every line on which a rook, bishop or queen of `color` attacks an enemy piece with another enemy piece right
    /// behind it. A pin if the front piece is worth less (or the back one is the king), a skewer if it is worth more.
    static func lineUps(by color: ChessColor, in position: ChessPosition) -> [ChessLineUp] {
        var result: [ChessLineUp] = []
        for (square, piece) in position.pieces where piece.color == color && piece.kind.slides {
            let directions = piece.kind == .bishop ? 4..<8 : (piece.kind == .rook ? 0..<4 : 0..<8)
            for direction in directions {
                var front: ChessSquare?
                for index in ChessTables.rays[square.index][direction] {
                    let target = ChessSquare(index: index)
                    guard let found = position[target] else { continue }
                    if front == nil {
                        if found.color == color { break }
                        front = target
                    } else {
                        if found.color != color, let front { result.append(ChessLineUp(attacker: square, front: front, back: target)) }
                        break
                    }
                }
            }
        }
        return result
    }

    /// Whether a line-up is a skewer: the front piece is the king or worth more than the one behind it.
    static func isSkewer(_ lineUp: ChessLineUp, in position: ChessPosition) -> Bool {
        guard let front = position[lineUp.front], let back = position[lineUp.back] else { return false }
        if back.kind == .king { return false }
        return front.kind == .king || front.kind.value > back.kind.value
    }

    /// Whether a line-up is a pin: the back piece is the king or worth more than the front one.
    static func isPin(_ lineUp: ChessLineUp, in position: ChessPosition) -> Bool {
        guard let front = position[lineUp.front], let back = position[lineUp.back] else { return false }
        if front.kind == .king { return false }
        return back.kind == .king || back.kind.value > front.kind.value
    }

    /// The enemy pieces the piece on `square` attacks that are worth attacking: the king, a piece worth more than the
    /// attacker, or a piece nothing defends. Two or more of these make a fork.
    static func forkTargets(of square: ChessSquare, in position: ChessPosition) -> [ChessSquare] {
        guard let attacker = position[square] else { return [] }
        return position.attackedEnemies(by: square).filter { target in
            guard let piece = position[target] else { return false }
            if piece.kind == .king || piece.kind.value > attacker.kind.value { return true }
            return position.attackers(of: target, by: piece.color).isEmpty
        }
    }

    /// The enemy pieces that the pieces other than the mover attack after the move and did not before: what a move
    /// uncovers.
    static func discoveredTargets(by move: ChessMove, in position: ChessPosition) -> [ChessSquare] {
        guard let mover = position[move.from] else { return [] }
        let after = position.applying(move)
        var result: [ChessSquare] = []
        for (square, piece) in position.pieces where piece.color == mover.color && square != move.from {
            let before = Set(position.attackedEnemies(by: square))
            for target in after.attackedEnemies(by: square) where !before.contains(target) && target != move.to {
                result.append(target)
            }
        }
        return result.sorted()
    }

    /// The pieces of `color` that the other side wins by capturing them (the exchange helper), if it were its turn.
    static func hangingPieces(of color: ChessColor, in position: ChessPosition) -> [ChessSquare] {
        let opponent = position.with(sideToMove: color.opposite)
        var result = Set<ChessSquare>()
        for move in opponent.legalMoves() where opponent.isCapture(move) && ChessExchange.gain(of: move, in: opponent) > 0 {
            result.insert(move.to)
        }
        return result.sorted()
    }
}
