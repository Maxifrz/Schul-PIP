package de.maxifrz.lernwerk.learn.chess

/** A legal move with its notation. */
data class SanEntry(val move: ChessMove, val san: String)

/**
 * German standard algebraic notation: K König, D Dame, T Turm, L Läufer, S Springer, no letter for a pawn, x for a
 * capture, + for check, # for mate, O-O and O-O-O for castling, a letter after the square for a promotion ("e8D").
 */
object ChessNotation {
    /** The notation of a legal move in a position, like "Sf3", "exd5", "Tae1", "O-O", "e8D+", "Dh5#". null when the move is not legal there. */
    fun san(move: ChessMove, position: ChessPosition): String? = san(move, position, position.legalMoves())

    /** The notation of every legal move of a position, in the generator's order. */
    fun allSAN(position: ChessPosition): List<SanEntry> {
        val legal = position.legalMoves()
        return legal.mapNotNull { move -> san(move, position, legal)?.let { SanEntry(move, it) } }
    }

    private fun san(move: ChessMove, position: ChessPosition, legal: List<ChessMove>): String? {
        if (!legal.contains(move)) return null
        val piece = position[move.from] ?: return null
        val text = StringBuilder()
        if (position.isCastling(move)) {
            text.append(if (move.to.file == 6) "O-O" else "O-O-O")
        } else {
            val capture = position.isCapture(move)
            if (piece.kind == ChessPieceKind.PAWN) {
                if (capture) text.append(move.from.fileLetter).append('x')
                text.append(move.to.name)
                move.promotion?.let { text.append(it.letter) }
            } else {
                text.append(piece.kind.letter)
                // Other pieces of the same kind that could also go there make the origin necessary.
                val rivals = legal.filter { it.to == move.to && it.from != move.from && position[it.from] == piece }
                if (rivals.isNotEmpty()) {
                    if (rivals.none { it.from.file == move.from.file }) {
                        text.append(move.from.fileLetter)
                    } else if (rivals.none { it.from.rank == move.from.rank }) {
                        text.append(move.from.rankDigit)
                    } else {
                        text.append(move.from.name)
                    }
                }
                if (capture) text.append('x')
                text.append(move.to.name)
            }
        }
        val after = position.applying(move)
        if (after.isCheck) text.append(if (after.hasLegalMove) "+" else "#")
        return text.toString()
    }

    /** The legal move a notation names, or null. Check signs, "x", "=" and "e.p." are optional in the input; the letters are the German ones. */
    fun move(fromSAN: String, position: ChessPosition): ChessMove? {
        val wanted = bare(fromSAN)
        if (wanted.isEmpty()) return null
        val matches = allSAN(position).filter { bare(it.san) == wanted }
        return if (matches.size == 1) matches[0].move else null
    }

    /** The notations of several moves, in order, each played after the one before; null if one is not legal. */
    fun sanLine(moves: List<ChessMove>, from: ChessPosition): List<String>? {
        var current = from
        val result = ArrayList<String>()
        for (move in moves) {
            result.add(san(move, current) ?: return null)
            current = current.applying(move)
        }
        return result
    }

    /** The position after moves given in notation, in order; null if one is not legal or unclear. */
    fun play(line: List<String>, from: ChessPosition = ChessPosition.start): ChessPosition? {
        var current = from
        for (text in line) {
            val move = move(text, current) ?: return null
            current = current.applying(move)
        }
        return current
    }

    private const val IGNORED = "+#x×=!?:"

    /** A notation reduced to what names the move: no signs, no capture mark, zeros read as the letter O. */
    private fun bare(text: String): String {
        var result = text.replace("e.p.", "").replace(" ", "")
        result = result.replace('0', 'O')
        return result.filter { IGNORED.indexOf(it) < 0 }
    }
}
