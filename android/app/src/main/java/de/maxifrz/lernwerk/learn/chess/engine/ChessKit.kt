package de.maxifrz.lernwerk.learn.chess

import kotlin.math.abs
import kotlin.math.max

/** Where a piece could go on an empty board; independent of the move generator, so the tests can compare the two. */
object ChessGeometry {
    fun canReach(kind: ChessPieceKind, from: ChessSquare, to: ChessSquare): Boolean {
        if (from == to) return false
        val files = abs(to.file - from.file)
        val ranks = abs(to.rank - from.rank)
        return when (kind) {
            ChessPieceKind.ROOK -> files == 0 || ranks == 0
            ChessPieceKind.BISHOP -> files == ranks
            ChessPieceKind.QUEEN -> files == 0 || ranks == 0 || files == ranks
            ChessPieceKind.KING -> max(files, ranks) == 1
            ChessPieceKind.KNIGHT -> (files == 1 && ranks == 2) || (files == 2 && ranks == 1)
            ChessPieceKind.PAWN -> false
        }
    }

    /** The squares a piece reaches from a square on an empty board. */
    fun reach(kind: ChessPieceKind, from: ChessSquare): List<ChessSquare> =
        ChessSquare.all.filter { canReach(kind, from, it) }
}

/** The engine-only helpers of ChessKit.swift (words, lists, rule sentences, destinations, typed forms). */
object ChessKit {
    const val EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1"

    /** "den Springer", "die Dame", "den Bauern". */
    fun accusative(kind: ChessPieceKind): String = "${kind.article(ChessCase.ACCUSATIVE)} ${kind.noun(ChessCase.ACCUSATIVE)}"

    /** "der Springer", "die Dame". */
    fun nominative(kind: ChessPieceKind): String = "${kind.article(ChessCase.NOMINATIVE)} ${kind.noun(ChessCase.NOMINATIVE)}"

    /** "dem Springer", "der Dame". */
    fun dative(kind: ChessPieceKind): String = "${kind.article(ChessCase.DATIVE)} ${kind.noun(ChessCase.DATIVE)}"

    /** "einen Springer", "eine Dame", "einen Bauern". */
    fun indefiniteAccusative(kind: ChessPieceKind): String =
        if (kind.isFeminine) "eine ${kind.germanName}" else "einen ${kind.noun(ChessCase.ACCUSATIVE)}"

    /** "ein Springer", "eine Dame". */
    fun indefinite(kind: ChessPieceKind): String = "${if (kind.isFeminine) "eine" else "ein"} ${kind.germanName}"

    /** A list in German: "a4", "a4 und g4", "a4, b5 und g4". */
    fun list(items: List<String>): String = when (items.size) {
        0 -> ""
        1 -> items[0]
        else -> items.dropLast(1).joinToString(", ") + " und " + items.last()
    }

    /** The rule sentence of a piece, for the feedback. */
    fun rule(kind: ChessPieceKind): String = when (kind) {
        ChessPieceKind.ROOK -> "Der Turm zieht gerade, so weit er will."
        ChessPieceKind.BISHOP -> "Der Läufer zieht schräg, so weit er will."
        ChessPieceKind.QUEEN -> "Die Dame zieht wie Turm und Läufer zusammen."
        ChessPieceKind.KING -> "Der König zieht ein Feld in jede Richtung."
        ChessPieceKind.KNIGHT -> "Der Springer springt zwei Felder in eine Richtung und eins quer dazu."
        ChessPieceKind.PAWN -> "Der Bauer zieht ein Feld vorwärts und schlägt schräg vorwärts."
    }

    /** Whether more pieces than the direct attackers aim at a square, hidden behind them on the same line. */
    fun hasHiddenAttackers(square: ChessSquare, position: ChessPosition): Boolean {
        var cleared = position
        for (color in ChessColor.entries) {
            for (attacker in position.attackers(square, color)) cleared = cleared.setting(null, attacker)
        }
        return ChessColor.entries.any { cleared.attackers(square, it).isNotEmpty() }
    }

    /** The squares a piece can move to from a square (a pawn that promotes counts its square once). */
    fun destinations(square: ChessSquare, position: ChessPosition): List<ChessSquare> =
        position.legalMoves().filter { it.from == square }.map { it.to }.distinct()

    /** The solution as the feedback shows it: "Sf3 (g1–f3)", up to three accepted moves joined with "oder". */
    fun solution(moves: List<ChessMove>, position: ChessPosition, withSquares: Boolean, limit: Int = 3): String {
        val texts = moves.mapNotNull { move ->
            val san = ChessNotation.san(move, position) ?: return@mapNotNull null
            if (withSquares) "$san (${move.from.name}–${move.to.name})" else san
        }
        val shown = texts.take(limit).toMutableList()
        if (texts.size > limit) shown.add("…")
        return shown.joinToString(" oder ")
    }

    /**
     * The answer forms of a typed move in notation: with and without the sign and the capture mark, so "Dxf7#", "Dxf7"
     * and "Dxf7+" all count. Capitals do not matter to the checker.
     */
    fun typedVariants(san: String): List<String> {
        val bare = san.filter { it != '+' && it != '#' }
        val forms = mutableListOf(san, bare, "$bare+", "$bare#")
        if (bare.contains('x')) forms.add(bare.replace("x", ""))
        return forms.distinct()
    }

    /** The notation without the check sign, so a prompt can name a move without giving away that it mates. */
    fun sanWithoutSign(san: String): String = san.filter { it != '+' && it != '#' }
}
