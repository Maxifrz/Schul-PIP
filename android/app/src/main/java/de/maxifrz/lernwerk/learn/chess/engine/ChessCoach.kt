package de.maxifrz.lernwerk.learn.chess

/**
 * Says why a move on the board does not solve the exercise, from the position alone: whether the move is allowed at
 * all, and, if it is, what it does not do. Nothing here claims more than the engine can show. Port of ChessCoach.
 */
object ChessCoach {
    const val PREFIX = "chess:"

    /** The two hints of a move exercise: first what to look for, then which piece it is, when all answers agree. */
    fun hints(goal: ChessGoal, accepted: List<ChessMove>, position: ChessPosition): List<String> {
        val hints = ArrayList<String>()
        when (goal) {
            is ChessGoal.Moves -> {
                val filter = goal.filter
                if (filter.castling != null) {
                    hints.add("Bei der Rochade ziehen König und Turm in einem Zug.")
                } else if (filter.enPassant == true) {
                    hints.add("En passant gibt es nur direkt nach dem Doppelschritt eines Bauern, und man schlägt ihn im Vorbeigehen.")
                } else if (filter.promotion == true) {
                    hints.add("Ein Bauer auf der letzten Reihe wird umgewandelt, meist in eine Dame.")
                } else if (filter.kind != null) {
                    hints.add(ChessKit.rule(filter.kind))
                } else {
                    hints.add("Lies die Aufgabe noch einmal: Welche Figur soll wohin ziehen?")
                }
            }
            ChessGoal.MateInOne ->
                hints.add("Suche Züge, die Schach bieten, und prüfe, ob der König danach noch ein Feld oder eine Antwort hat.")
            is ChessGoal.Escape ->
                hints.add("Es gibt drei Wege aus dem Schach: den König wegziehen, die schachbietende Figur schlagen oder eine Figur dazwischenstellen.")
            ChessGoal.BestCapture ->
                hints.add("Vergleiche, welche Figur du schlagen kannst, was sie wert ist und ob sie gedeckt ist.")
            is ChessGoal.BestMove ->
                hints.add("Suche nach einer Gabel, einer Fesselung, einem Spieß oder einer Figur, die niemand deckt.")
        }
        val origins = accepted.map { it.from }.toSet()
        if (origins.size == 1) {
            hints.add("Es zieht die Figur auf ${origins.first().name}.")
        } else {
            val kinds = accepted.mapNotNull { position[it.from]?.kind }.toSet()
            if (kinds.size == 1) hints.add("Es zieht ${ChessKit.nominative(kinds.first())}.")
        }
        return hints
    }

    /** The feedback for a coordinate move `text` against the goal code of the exercise; null when there is nothing to say. */
    fun explain(text: String, goal: String, position: ChessPosition): String? {
        val parsed = ChessMove.fromUci(text) ?: return null
        val side = position.sideToMove
        val piece = position[parsed.from] ?: return "Auf ${parsed.from.name} steht keine Figur."
        if (piece.color != side) {
            return "Auf ${parsed.from.name} steht eine ${piece.color.adjectiveStem}e Figur, aber ${side.germanName} ist am Zug."
        }
        val legal = position.legalMoves().filter { it.from == parsed.from && it.to == parsed.to }
        val move = legal.firstOrNull { it.promotion == ChessPieceKind.QUEEN } ?: legal.firstOrNull()
            ?: return illegal(parsed, piece, position)
        val after = position.applying(move)
        val opponent = side.opposite
        return when (goal) {
            "mate" -> {
                if (!after.isCheck) {
                    return "Der Zug ist erlaubt, bietet aber kein Schach. Matt setzt, wer Schach bietet und dem König keine Antwort lässt."
                }
                val reply = after.legalMoves().firstOrNull()
                val replyText = reply?.let { ChessNotation.san(it, after) }
                if (replyText != null) {
                    "Der Zug bietet Schach, aber ${opponent.germanName} kann sich verteidigen, zum Beispiel mit $replyText."
                } else {
                    null
                }
            }
            "capture" -> {
                if (!position.isCapture(move)) {
                    "Der Zug ist erlaubt, schlägt aber nichts. Gesucht ist der Schlag, der am meisten Material gewinnt."
                } else if (after.legalMoves().any { it.to == move.to }) {
                    "Die Figur auf ${move.to.name} ist gedeckt: ${opponent.germanName} kann zurückschlagen. Ein anderer Schlag gewinnt mehr."
                } else {
                    "Das gewinnt Material, aber ein anderer Schlag gewinnt mehr."
                }
            }
            "best" ->
                if (after.legalMoves().any { it.to == move.to }) {
                    "Der Zug ist erlaubt, aber ${opponent.germanName} kann die Figur auf ${move.to.name} schlagen. Es gibt einen stärkeren Zug."
                } else {
                    "Der Zug ist erlaubt, aber es gibt einen stärkeren."
                }
            "escape.king" -> "Der Zug beendet das Schach, aber nicht mit dem König. Hier ist der Königszug gesucht."
            "escape.capture" -> "Der Zug beendet das Schach, schlägt aber nicht die schachbietende Figur. Hier ist das Schlagen gesucht."
            "escape.block" -> "Der Zug beendet das Schach, stellt aber keine Figur dazwischen. Hier ist das Dazwischenstellen gesucht."
            else -> "Der Zug ist erlaubt, aber er ist nicht der, nach dem gefragt ist."
        }
    }

    /** Why a move that the rules do not allow is not allowed. */
    private fun illegal(move: ChessMove, piece: ChessPiece, position: ChessPosition): String {
        val name = ChessKit.nominative(piece.kind)
        val pseudo = position.pseudoLegalMoves().any { it.from == move.from && it.to == move.to }
        if (pseudo) {
            return if (position.isCheck) {
                "Du stehst im Schach. Dieser Zug beendet das Schach nicht."
            } else {
                "Nach diesem Zug stünde dein König im Schach. Das ist nicht erlaubt."
            }
        }
        val target = position[move.to]
        if (target != null && target.color == piece.color) return "Auf ${move.to.name} steht schon eine eigene Figur."
        if (piece.kind != ChessPieceKind.PAWN && ChessGeometry.canReach(piece.kind, move.from, move.to)) {
            return "Der Weg von ${move.from.name} nach ${move.to.name} ist versperrt."
        }
        val capitalised = name.substring(0, 1).uppercase() + name.substring(1)
        return "$capitalised kann nicht von ${move.from.name} nach ${move.to.name} ziehen. ${ChessKit.rule(piece.kind)}"
    }
}
