package de.maxifrz.lernwerk.learn.chess

import java.io.File

/** Shared helpers of the chess engine tests. */
internal fun pos(fen: String): ChessPosition = ChessPosition.fromFen(fen) ?: throw AssertionError("FEN does not parse: $fen")

internal fun mv(uci: String): ChessMove = ChessMove.fromUci(uci) ?: throw AssertionError("bad move $uci")

internal fun sq(name: String): ChessSquare = ChessSquare.fromName(name) ?: throw AssertionError("bad square $name")

internal fun ucis(p: ChessPosition): Set<String> = p.legalMoves().map { it.uci }.toSet()

/** The legal moves of the piece on a square, sorted. */
internal fun movesFrom(fen: String, square: String): List<String> =
    pos(fen).legalMoves().filter { it.from.name == square }.map { it.uci }.sorted()

internal fun accepted(filter: ChessMoveFilter, p: ChessPosition): List<ChessMove> =
    ChessGoals.accepted(ChessGoal.Moves(filter), p)

internal fun repoFile(relative: String): File {
    val root = System.getProperty("repo.root")
    val candidates = listOfNotNull(root, "../..", "../../..", ".")
    for (base in candidates) {
        val file = File(base, relative)
        if (file.exists()) return file
    }
    throw AssertionError("cannot find $relative")
}
