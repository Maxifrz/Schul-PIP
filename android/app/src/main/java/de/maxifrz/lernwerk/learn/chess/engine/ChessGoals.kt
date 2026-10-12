package de.maxifrz.lernwerk.learn.chess

/** A description of the legal moves an exercise asks for. All fields that are set must hold at once. */
data class ChessMoveFilter(
    val from: ChessSquare? = null,
    val to: ChessSquare? = null,
    /** The kind of the piece that moves. */
    val kind: ChessPieceKind? = null,
    val capture: Boolean? = null,
    val promotion: Boolean? = null,
    /** The piece a promoting pawn becomes. */
    val promotionTo: ChessPieceKind? = null,
    val enPassant: Boolean? = null,
    val castling: ChessCastleSide? = null,
    val check: Boolean? = null,
    val mate: Boolean? = null,
) {
    fun matches(move: ChessMove, position: ChessPosition): Boolean {
        if (from != null && move.from != from) return false
        if (to != null && move.to != to) return false
        if (kind != null && position[move.from]?.kind != kind) return false
        if (capture != null && position.isCapture(move) != capture) return false
        if (promotion != null && (move.promotion != null) != promotion) return false
        if (promotionTo != null && move.promotion != promotionTo) return false
        if (enPassant != null && position.isEnPassant(move) != enPassant) return false
        if (castling != null) {
            if (!position.isCastling(move) || (move.to.file == 6) != (castling == ChessCastleSide.KINGSIDE)) return false
        }
        if (check != null || mate != null) {
            val after = position.applying(move)
            if (check != null && after.isCheck != check) return false
            if (mate != null && after.isCheckmate != mate) return false
        }
        return true
    }
}

enum class ChessEscape { ANY, KING_MOVES, CAPTURE_CHECKER, INTERPOSE }

/**
 * What the student has to find. The engine turns a goal and a position into the accepted moves, so a course never
 * states an answer by hand.
 */
sealed class ChessGoal {
    /** Every legal move that fits the filter. */
    data class Moves(val filter: ChessMoveFilter) : ChessGoal()

    /** Every legal move that checkmates. */
    data object MateInOne : ChessGoal()

    /** Moves out of check by the king, by capturing the checking piece, or by putting a piece in between. */
    data class Escape(val kind: ChessEscape) : ChessGoal()

    /** The captures that win the most by the exchange helper. */
    data object BestCapture : ChessGoal()

    /** The moves with the best result of the material search to this depth (half moves). */
    data class BestMove(val depth: Int) : ChessGoal()

    /** The goal as the exercise carries it for the coach. */
    val coachCode: String
        get() = when (this) {
            is Moves -> "moves"
            MateInOne -> "mate"
            is Escape -> when (kind) {
                ChessEscape.ANY -> "escape.any"
                ChessEscape.KING_MOVES -> "escape.king"
                ChessEscape.CAPTURE_CHECKER -> "escape.capture"
                ChessEscape.INTERPOSE -> "escape.block"
            }
            BestCapture -> "capture"
            is BestMove -> "best"
        }
}

object ChessGoals {
    private data class Key(val fen: String, val goal: ChessGoal)

    private val cache = HashMap<Key, List<ChessMove>>()

    /** Forgets the remembered answers (for tests). */
    fun clearCache() {
        synchronized(cache) { cache.clear() }
    }

    /** The legal moves that reach the goal, in the generator's order. */
    fun accepted(goal: ChessGoal, position: ChessPosition): List<ChessMove> {
        val key = Key(position.fen, goal)
        synchronized(cache) { cache[key] }?.let { return it }
        val result = compute(goal, position)
        synchronized(cache) { cache[key] = result }
        return result
    }

    private fun compute(goal: ChessGoal, position: ChessPosition): List<ChessMove> {
        val legal = position.legalMoves()
        return when (goal) {
            is ChessGoal.Moves -> legal.filter { goal.filter.matches(it, position) }
            ChessGoal.MateInOne -> legal.filter { position.applying(it).isCheckmate }
            is ChessGoal.Escape -> {
                val king = position.kingSquare(position.sideToMove)
                if (!position.isCheck || king == null) return emptyList()
                val checkers = position.attackers(king, position.sideToMove.opposite).toSet()
                when (goal.kind) {
                    ChessEscape.ANY -> legal
                    ChessEscape.KING_MOVES -> legal.filter { it.from == king }
                    ChessEscape.CAPTURE_CHECKER -> legal.filter { it.to in checkers && position.isCapture(it) }
                    ChessEscape.INTERPOSE -> legal.filter { it.from != king && !(it.to in checkers && position.isCapture(it)) }
                }
            }
            ChessGoal.BestCapture -> ChessExchange.bestCaptures(position).moves
            is ChessGoal.BestMove -> ChessSearch.bestMoves(position, goal.depth).moves
        }
    }

    /**
     * The answers the app can receive for these moves: coordinate notation, and for a queen promotion also the four
     * characters a tap on the piece and its target square gives. null if some accepted move is an under-promotion
     * without the queen promotion of the same squares beside it, which the app could not tell apart.
     */
    fun answers(moves: List<ChessMove>): List<String>? {
        val result = ArrayList<String>()
        for (move in moves) {
            if (move.promotion == null) {
                result.add(move.uci)
                continue
            }
            val queenAccepted = moves.any { it.from == move.from && it.to == move.to && it.promotion == ChessPieceKind.QUEEN }
            if (!queenAccepted) return null
            result.add(move.uci)
            if (move.promotion == ChessPieceKind.QUEEN) result.add(move.from.name + move.to.name)
        }
        return result.distinct()
    }

    /** The accepted moves in notation for the feedback: "Dh5#", at most `limit` of them, joined with "oder". */
    fun solutionText(moves: List<ChessMove>, position: ChessPosition, limit: Int = 3): String {
        val texts = moves.mapNotNull { ChessNotation.san(it, position) }
        val shown = texts.take(limit).toMutableList()
        if (texts.size > limit) shown.add("…")
        return shown.joinToString(" oder ")
    }
}
