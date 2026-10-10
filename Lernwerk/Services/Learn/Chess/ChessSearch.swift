import Foundation

/// A small material-only search the course uses to prove that a "best move" really is best: negamax with alpha-beta
/// pruning and a capture search at the leaves. Values are the exchange values 1, 3, 3, 5, 9; a mate is worth 1000
/// minus the number of half moves to it. Deterministic, no randomness, no clock.
enum ChessSearch {
    static let mateScore = 1000
    private static let infinity = 100_000
    /// How many half moves the capture search may go beyond the nominal depth.
    private static let captureDepth = 8

    /// The material balance for the side to move after a position has been searched `depth` half moves.
    static func value(of position: ChessPosition, depth: Int) -> Int {
        search(position, depth: depth, alpha: -infinity, beta: infinity, ply: 0)
    }

    /// Every legal move with its score for the side to move, best first; equal scores keep the generator's order.
    static func scoredMoves(in position: ChessPosition, depth: Int) -> [(move: ChessMove, score: Int)] {
        let moves = ordered(position.legalMoves(), in: position)
        var scored = moves.map { move in
            (move: move, score: -search(position.applying(move), depth: max(0, depth - 1), alpha: -infinity, beta: infinity, ply: 1))
        }
        scored.sort { $0.score > $1.score }
        return scored
    }

    /// All moves that reach the best score of the search, and that score. Empty when there is no legal move.
    static func bestMoves(in position: ChessPosition, depth: Int) -> (moves: [ChessMove], score: Int) {
        let moves = ordered(position.legalMoves(), in: position)
        guard !moves.isEmpty else { return ([], position.isCheck ? -mateScore : 0) }
        // First find the best score with a normal alpha-beta window, then keep the moves that reach it.
        var best = -infinity
        for move in moves {
            let score = -search(position.applying(move), depth: max(0, depth - 1), alpha: -infinity, beta: -best, ply: 1)
            best = max(best, score)
        }
        var good: [ChessMove] = []
        for move in moves {
            // A window of one point around the best score tells whether this move reaches it.
            let score = -search(position.applying(move), depth: max(0, depth - 1), alpha: -best - 1, beta: -best + 1, ply: 1)
            if score >= best { good.append(move) }
        }
        return (good, best)
    }

    // MARK: Search

    private static func search(_ position: ChessPosition, depth: Int, alpha: Int, beta: Int, ply: Int) -> Int {
        let moves = position.legalMoves()
        if moves.isEmpty { return position.isCheck ? -(mateScore - ply) : 0 }
        if position.hasInsufficientMaterial { return 0 }
        if depth <= 0 { return quiesce(position, moves: moves, alpha: alpha, beta: beta, ply: ply, budget: captureDepth) }
        var alpha = alpha
        var best = -infinity
        for move in ordered(moves, in: position) {
            let score = -search(position.applying(move), depth: depth - 1, alpha: -beta, beta: -alpha, ply: ply + 1)
            if score > best { best = score }
            if best > alpha { alpha = best }
            if alpha >= beta { break }
        }
        return best
    }

    /// Captures (and promotions) only, so a score is never taken in the middle of an exchange. In check every move is
    /// tried, within the budget.
    private static func quiesce(_ position: ChessPosition, moves: [ChessMove], alpha: Int, beta: Int, ply: Int, budget: Int) -> Int {
        var alpha = alpha
        let stand = position.materialBalanceForSideToMove
        let inCheck = position.isCheck
        var best: Int
        if inCheck && budget > 0 {
            best = -infinity
        } else {
            if budget <= 0 || stand >= beta { return stand }
            best = stand
            if stand > alpha { alpha = stand }
        }
        for move in ordered(moves, in: position) {
            if !inCheck || budget <= 0, !position.isCapture(move), move.promotion != .queen { continue }
            let next = position.applying(move)
            let replies = next.legalMoves()
            let score: Int
            if replies.isEmpty {
                score = next.isCheck ? mateScore - ply - 1 : 0
            } else if next.hasInsufficientMaterial {
                score = 0
            } else {
                score = -quiesce(next, moves: replies, alpha: -beta, beta: -alpha, ply: ply + 1, budget: budget - 1)
            }
            if score > best { best = score }
            if best > alpha { alpha = best }
            if alpha >= beta { break }
        }
        return best
    }

    /// Captures of valuable pieces by cheap ones first, then promotions and checks to the back; stable otherwise.
    private static func ordered(_ moves: [ChessMove], in position: ChessPosition) -> [ChessMove] {
        let keyed = moves.enumerated().map { offset, move -> (Int, Int, ChessMove) in
            var key = 0
            if let captured = position.capturedPiece(by: move), let mover = position[move.from] {
                key = 10 + captured.kind.value * 10 - mover.kind.value
            }
            if move.promotion == .queen { key += 50 }
            return (key, offset, move)
        }
        return keyed.sorted { $0.0 != $1.0 ? $0.0 > $1.0 : $0.1 < $1.1 }.map { $0.2 }
    }
}

/// What a capture on one square wins once both sides keep taking on it for as long as that pays. Only the moves onto
/// that square count; every other idea (a threat elsewhere, a check) is outside this helper.
enum ChessExchange {
    /// The net material the side to move gains by playing the capture, with the best recaptures on the square
    /// counted. A pawn that promotes while capturing gains the promoted piece's value minus the pawn's. 0 for a move
    /// that is no capture.
    static func gain(of move: ChessMove, in position: ChessPosition) -> Int {
        guard let captured = position.capturedPiece(by: move) else { return 0 }
        var gain = captured.kind.value
        if let promotion = move.promotion { gain += promotion.value - 1 }
        let after = position.applying(move)
        return gain - bestRecapture(in: after, on: move.to)
    }

    /// The most the side to move wins by capturing on `square`, or 0 when it is better not to.
    static func bestRecapture(in position: ChessPosition, on square: ChessSquare) -> Int {
        var best = 0
        for reply in position.legalMoves() where reply.to == square && position.isCapture(reply) {
            best = max(best, gain(of: reply, in: position))
        }
        return best
    }

    /// Every capture of the side to move with its gain, best first.
    static func captures(in position: ChessPosition) -> [(move: ChessMove, gain: Int)] {
        let captures = position.legalMoves().filter { position.isCapture($0) }
        return captures.map { (move: $0, gain: gain(of: $0, in: position)) }.sorted { $0.gain > $1.gain }
    }

    /// The captures that win the most, with that gain; empty when no capture wins anything.
    static func bestCaptures(in position: ChessPosition) -> (moves: [ChessMove], gain: Int) {
        let all = captures(in: position)
        guard let top = all.first, top.gain > 0 else { return ([], 0) }
        return (all.filter { $0.gain == top.gain }.map(\.move), top.gain)
    }
}
