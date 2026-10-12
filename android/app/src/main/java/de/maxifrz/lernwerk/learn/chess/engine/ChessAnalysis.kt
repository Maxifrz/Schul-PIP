package de.maxifrz.lernwerk.learn.chess

/** Why a castling is not possible, one reason each; a position can have several. */
enum class ChessCastlingProblem {
    /** The king or this rook has moved before (the FEN's castling field lacks the right), or is not on its square. */
    RIGHT_LOST,

    /** A piece stands between king and rook. */
    PIECES_BETWEEN,

    /** The king is in check. */
    IN_CHECK,

    /** The king would cross a square the opponent attacks. */
    CROSSES_ATTACKED_SQUARE,

    /** The king would land on a square the opponent attacks. */
    LANDS_ON_ATTACKED_SQUARE,
}

enum class ChessCastleSide {
    KINGSIDE, QUEENSIDE;

    val germanName: String get() = if (this == KINGSIDE) "kurze" else "lange"
    val notation: String get() = if (this == KINGSIDE) "O-O" else "O-O-O"
}

object ChessCastling {
    /**
     * The reasons the side to move cannot castle to a side. Computed from the rules of Article 3.8, independently of
     * the move generator; no reasons means the castling is possible.
     */
    fun problems(side: ChessCastleSide, position: ChessPosition): List<ChessCastlingProblem> {
        val color = position.sideToMove
        val rank = color.homeRank
        fun square(file: Int) = ChessSquare.of(file, rank)!!
        val kingside = side == ChessCastleSide.KINGSIDE
        val rookFile = if (kingside) 7 else 0
        val between = if (kingside) listOf(5, 6) else listOf(1, 2, 3)
        val crossed = if (kingside) 5 else 3
        val landing = if (kingside) 6 else 2
        val enemy = color.opposite
        val result = ArrayList<ChessCastlingProblem>()
        val right = if (kingside) ChessCastlingRights.kingside(color) else ChessCastlingRights.queenside(color)
        if (!position.castling.contains(right) || position[square(4)] != ChessPiece(color, ChessPieceKind.KING) ||
            position[square(rookFile)] != ChessPiece(color, ChessPieceKind.ROOK)
        ) {
            result.add(ChessCastlingProblem.RIGHT_LOST)
        }
        if (between.any { position[square(it)] != null }) result.add(ChessCastlingProblem.PIECES_BETWEEN)
        if (position.isAttacked(square(4), enemy)) result.add(ChessCastlingProblem.IN_CHECK)
        if (position.isAttacked(square(crossed), enemy)) result.add(ChessCastlingProblem.CROSSES_ATTACKED_SQUARE)
        if (position.isAttacked(square(landing), enemy)) result.add(ChessCastlingProblem.LANDS_ON_ATTACKED_SQUARE)
        return result
    }
}

private fun directionsOf(kind: ChessPieceKind): IntRange = when (kind) {
    ChessPieceKind.BISHOP -> 4..7
    ChessPieceKind.ROOK -> 0..3
    else -> 0..7
}

/** The squares the piece on `square` attacks, occupied or not (a pinned piece still attacks). */
fun ChessPosition.attackedSquares(square: ChessSquare): List<ChessSquare> {
    val piece = this[square] ?: return emptyList()
    return when (piece.kind) {
        ChessPieceKind.PAWN -> listOf(-1, 1).mapNotNull { square.offset(it, piece.color.pawnDirection) }
        ChessPieceKind.KNIGHT -> ChessTables.knightJumps[square.index].map { ChessSquare(it) }
        ChessPieceKind.KING -> ChessTables.kingSteps[square.index].map { ChessSquare(it) }
        else -> {
            val result = ArrayList<ChessSquare>()
            for (direction in directionsOf(piece.kind)) {
                for (target in ChessTables.rays[square.index][direction]) {
                    result.add(ChessSquare(target))
                    if (this[ChessSquare(target)] != null) break
                }
            }
            result
        }
    }
}

/** The enemy pieces the piece on `square` attacks. */
fun ChessPosition.attackedEnemies(square: ChessSquare): List<ChessSquare> {
    val piece = this[square] ?: return emptyList()
    return attackedSquares(square).filter { target -> this[target]?.let { it.color != piece.color } ?: false }
}

/** A line on which a long-range piece looks at an enemy piece and, behind it, at another. */
data class ChessLineUp(val attacker: ChessSquare, val front: ChessSquare, val back: ChessSquare)

data class ChessPin(val pinned: ChessSquare, val pinner: ChessSquare)

object ChessTactics {
    /** A piece of `color` that cannot leave a line because its king stands behind it, and the enemy piece on that line. */
    fun absolutePins(color: ChessColor, position: ChessPosition): List<ChessPin> {
        val king = position.kingSquare(color) ?: return emptyList()
        val result = ArrayList<ChessPin>()
        for (direction in 0 until 8) {
            var own: ChessSquare? = null
            for (index in ChessTables.rays[king.index][direction]) {
                val square = ChessSquare(index)
                val piece = position[square] ?: continue
                if (own == null) {
                    if (piece.color == color) own = square else break
                } else {
                    val slidesThere = piece.kind == ChessPieceKind.QUEEN ||
                        (if (direction < 4) piece.kind == ChessPieceKind.ROOK else piece.kind == ChessPieceKind.BISHOP)
                    if (piece.color != color && slidesThere) result.add(ChessPin(own, square))
                    break
                }
            }
        }
        return result.sortedBy { it.pinned }
    }

    /**
     * Every line on which a rook, bishop or queen of `color` attacks an enemy piece with another enemy piece right
     * behind it. A pin if the front piece is worth less (or the back one is the king), a skewer if it is worth more.
     */
    fun lineUps(color: ChessColor, position: ChessPosition): List<ChessLineUp> {
        val result = ArrayList<ChessLineUp>()
        for ((square, piece) in position.pieces) {
            if (piece.color != color || !piece.kind.slides) continue
            for (direction in directionsOf(piece.kind)) {
                var front: ChessSquare? = null
                for (index in ChessTables.rays[square.index][direction]) {
                    val target = ChessSquare(index)
                    val found = position[target] ?: continue
                    if (front == null) {
                        if (found.color == color) break
                        front = target
                    } else {
                        if (found.color != color) result.add(ChessLineUp(square, front, target))
                        break
                    }
                }
            }
        }
        return result
    }

    /** Whether a line-up is a skewer: the front piece is the king or worth more than the one behind it. */
    fun isSkewer(lineUp: ChessLineUp, position: ChessPosition): Boolean {
        val front = position[lineUp.front] ?: return false
        val back = position[lineUp.back] ?: return false
        if (back.kind == ChessPieceKind.KING) return false
        return front.kind == ChessPieceKind.KING || front.kind.value > back.kind.value
    }

    /** Whether a line-up is a pin: the back piece is the king or worth more than the front one. */
    fun isPin(lineUp: ChessLineUp, position: ChessPosition): Boolean {
        val front = position[lineUp.front] ?: return false
        val back = position[lineUp.back] ?: return false
        if (front.kind == ChessPieceKind.KING) return false
        return back.kind == ChessPieceKind.KING || back.kind.value > front.kind.value
    }

    /**
     * The enemy pieces the piece on `square` attacks that are worth attacking: the king, a piece worth more than the
     * attacker, or a piece nothing defends. Two or more of these make a fork.
     */
    fun forkTargets(square: ChessSquare, position: ChessPosition): List<ChessSquare> {
        val attacker = position[square] ?: return emptyList()
        return position.attackedEnemies(square).filter { target ->
            val piece = position[target] ?: return@filter false
            if (piece.kind == ChessPieceKind.KING || piece.kind.value > attacker.kind.value) return@filter true
            position.attackers(target, piece.color).isEmpty()
        }
    }

    /** The enemy pieces that the pieces other than the mover attack after the move and did not before: what a move uncovers. */
    fun discoveredTargets(move: ChessMove, position: ChessPosition): List<ChessSquare> {
        val mover = position[move.from] ?: return emptyList()
        val after = position.applying(move)
        val result = ArrayList<ChessSquare>()
        for ((square, piece) in position.pieces) {
            if (piece.color != mover.color || square == move.from) continue
            val before = position.attackedEnemies(square).toSet()
            for (target in after.attackedEnemies(square)) {
                if (target !in before && target != move.to) result.add(target)
            }
        }
        return result.sorted()
    }

    /** The pieces of `color` that the other side wins by capturing them (the exchange helper), if it were its turn. */
    fun hangingPieces(color: ChessColor, position: ChessPosition): List<ChessSquare> {
        val opponent = position.withSideToMove(color.opposite)
        val result = HashSet<ChessSquare>()
        for (move in opponent.legalMoves()) {
            if (opponent.isCapture(move) && ChessExchange.gain(move, opponent) > 0) result.add(move.to)
        }
        return result.sorted()
    }
}
