package de.maxifrz.lernwerk.learn.chess

data class ScoredMove(val move: ChessMove, val score: Int)
data class BestMoves(val moves: List<ChessMove>, val score: Int)
data class CaptureGain(val move: ChessMove, val gain: Int)

/**
 * A small material-only search the course uses to prove that a "best move" really is best: negamax with alpha-beta
 * pruning and a capture search at the leaves. Values are the exchange values 1, 3, 3, 5, 9; a mate is worth 1000 minus
 * the number of half moves to it. Deterministic, no randomness, no clock.
 */
object ChessSearch {
    const val MATE_SCORE = 1000
    private const val INFINITY = 100_000

    /** How many half moves the capture search may go beyond the nominal depth. */
    private const val CAPTURE_DEPTH = 8

    /** The material balance for the side to move after a position has been searched `depth` half moves. */
    fun value(position: ChessPosition, depth: Int): Int = search(position, depth, -INFINITY, INFINITY, 0)

    /** Every legal move with its score for the side to move, best first; equal scores keep the generator's order. */
    fun scoredMoves(position: ChessPosition, depth: Int): List<ScoredMove> {
        val moves = ordered(position.legalMoves(), position)
        val scored = moves.map { move ->
            ScoredMove(move, -search(position.applying(move), maxOf(0, depth - 1), -INFINITY, INFINITY, 1))
        }
        return scored.sortedByDescending { it.score }
    }

    /** All moves that reach the best score of the search, and that score. Empty when there is no legal move. */
    fun bestMoves(position: ChessPosition, depth: Int): BestMoves {
        val moves = ordered(position.legalMoves(), position)
        if (moves.isEmpty()) return BestMoves(emptyList(), if (position.isCheck) -MATE_SCORE else 0)
        // First find the best score with a normal alpha-beta window, then keep the moves that reach it.
        var best = -INFINITY
        for (move in moves) {
            val score = -search(position.applying(move), maxOf(0, depth - 1), -INFINITY, -best, 1)
            best = maxOf(best, score)
        }
        val good = ArrayList<ChessMove>()
        for (move in moves) {
            // A window of one point around the best score tells whether this move reaches it.
            val score = -search(position.applying(move), maxOf(0, depth - 1), -best - 1, -best + 1, 1)
            if (score >= best) good.add(move)
        }
        return BestMoves(good, best)
    }

    private fun search(position: ChessPosition, depth: Int, alphaIn: Int, beta: Int, ply: Int): Int {
        val moves = position.legalMoves()
        if (moves.isEmpty()) return if (position.isCheck) -(MATE_SCORE - ply) else 0
        if (position.hasInsufficientMaterial) return 0
        if (depth <= 0) return quiesce(position, moves, alphaIn, beta, ply, CAPTURE_DEPTH)
        var alpha = alphaIn
        var best = -INFINITY
        for (move in ordered(moves, position)) {
            val score = -search(position.applying(move), depth - 1, -beta, -alpha, ply + 1)
            if (score > best) best = score
            if (best > alpha) alpha = best
            if (alpha >= beta) break
        }
        return best
    }

    /** Captures (and promotions) only, so a score is never taken in the middle of an exchange. In check every move is tried, within the budget. */
    private fun quiesce(position: ChessPosition, moves: List<ChessMove>, alphaIn: Int, beta: Int, ply: Int, budget: Int): Int {
        var alpha = alphaIn
        val stand = position.materialBalanceForSideToMove
        val inCheck = position.isCheck
        var best: Int
        if (inCheck && budget > 0) {
            best = -INFINITY
        } else {
            if (budget <= 0 || stand >= beta) return stand
            best = stand
            if (stand > alpha) alpha = stand
        }
        for (move in ordered(moves, position)) {
            if ((!inCheck || budget <= 0) && !position.isCapture(move) && move.promotion != ChessPieceKind.QUEEN) continue
            val next = position.applying(move)
            val replies = next.legalMoves()
            val score = if (replies.isEmpty()) {
                if (next.isCheck) MATE_SCORE - ply - 1 else 0
            } else if (next.hasInsufficientMaterial) {
                0
            } else {
                -quiesce(next, replies, -beta, -alpha, ply + 1, budget - 1)
            }
            if (score > best) best = score
            if (best > alpha) alpha = best
            if (alpha >= beta) break
        }
        return best
    }

    /** Captures of valuable pieces by cheap ones first, then promotions and checks to the back; stable otherwise. */
    private fun ordered(moves: List<ChessMove>, position: ChessPosition): List<ChessMove> {
        val keys = IntArray(moves.size)
        for ((offset, move) in moves.withIndex()) {
            var key = 0
            val captured = position.capturedPiece(move)
            val mover = position[move.from]
            if (captured != null && mover != null) key = 10 + captured.kind.value * 10 - mover.kind.value
            if (move.promotion == ChessPieceKind.QUEEN) key += 50
            keys[offset] = key
        }
        return moves.indices.sortedWith { a, b -> if (keys[a] != keys[b]) keys[b].compareTo(keys[a]) else a.compareTo(b) }
            .map { moves[it] }
    }
}

/**
 * What a capture on one square wins once both sides keep taking on it for as long as that pays. Only the moves onto that
 * square count; every other idea (a threat elsewhere, a check) is outside this helper.
 */
object ChessExchange {
    /**
     * The net material the side to move gains by playing the capture, with the best recaptures on the square counted.
     * A pawn that promotes while capturing gains the promoted piece's value minus the pawn's. 0 for a move that is no
     * capture.
     */
    fun gain(move: ChessMove, position: ChessPosition): Int {
        val captured = position.capturedPiece(move) ?: return 0
        var gain = captured.kind.value
        move.promotion?.let { gain += it.value - 1 }
        val after = position.applying(move)
        return gain - bestRecapture(after, move.to)
    }

    /** The most the side to move wins by capturing on `square`, or 0 when it is better not to. */
    fun bestRecapture(position: ChessPosition, square: ChessSquare): Int {
        var best = 0
        for (reply in position.legalMoves()) {
            if (reply.to == square && position.isCapture(reply)) best = maxOf(best, gain(reply, position))
        }
        return best
    }

    /** Every capture of the side to move with its gain, best first. */
    fun captures(position: ChessPosition): List<CaptureGain> =
        position.legalMoves().filter { position.isCapture(it) }.map { CaptureGain(it, gain(it, position)) }
            .sortedByDescending { it.gain }

    /** The captures that win the most, with that gain; empty when no capture wins anything. */
    fun bestCaptures(position: ChessPosition): BestMoves {
        val all = captures(position)
        val top = all.firstOrNull()
        if (top == null || top.gain <= 0) return BestMoves(emptyList(), 0)
        return BestMoves(all.filter { it.gain == top.gain }.map { it.move }, top.gain)
    }
}
