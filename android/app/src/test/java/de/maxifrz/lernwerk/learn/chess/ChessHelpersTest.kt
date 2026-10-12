package de.maxifrz.lernwerk.learn.chess

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/** Engine helpers without a Swift test of their own: castling reasons, geometry, coach texts, goals, kit. */
class ChessHelpersTest {
    @Test fun castlingProblemsAgreeWithTheGenerator() {
        for (fen in listOf(
            "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1", "5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1",
            "6rk/8/8/8/8/8/8/R3K2R w KQ - 0 1", "r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1", "r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1",
        )) {
            val p = pos(fen)
            val legal = ucis(p)
            assertEquals(fen, legal.contains("e1g1"), ChessCastling.problems(ChessCastleSide.KINGSIDE, p).isEmpty())
            assertEquals(fen, legal.contains("e1c1"), ChessCastling.problems(ChessCastleSide.QUEENSIDE, p).isEmpty())
        }
        assertEquals(listOf(ChessCastlingProblem.RIGHT_LOST), ChessCastling.problems(ChessCastleSide.KINGSIDE, pos("r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1")))
        assertEquals(listOf(ChessCastlingProblem.IN_CHECK), ChessCastling.problems(ChessCastleSide.KINGSIDE, pos("4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1")))
    }

    @Test fun geometryOnAnEmptyBoardMatchesLonePieces() {
        val expected = mapOf(
            ChessPieceKind.KNIGHT to 8, ChessPieceKind.ROOK to 14, ChessPieceKind.BISHOP to 13,
            ChessPieceKind.QUEEN to 27, ChessPieceKind.KING to 8,
        )
        for ((kind, count) in expected) assertEquals(count, ChessGeometry.reach(kind, sq("d4")).size)
    }

    @Test fun goalsEscapeKindsAndCache() {
        val p = pos("4r1k1/8/8/8/8/8/3N4/4K3 w - - 0 1")
        val king = ChessGoals.accepted(ChessGoal.Escape(ChessEscape.KING_MOVES), p).map { it.uci }
        val block = ChessGoals.accepted(ChessGoal.Escape(ChessEscape.INTERPOSE), p).map { it.uci }
        assertTrue(king.all { it.startsWith("e1") })
        assertEquals(listOf("d2e4"), block)
        assertEquals(king.size + block.size, ChessGoals.accepted(ChessGoal.Escape(ChessEscape.ANY), p).size)
        assertSame(ChessGoals.accepted(ChessGoal.Escape(ChessEscape.ANY), p), ChessGoals.accepted(ChessGoal.Escape(ChessEscape.ANY), p))
        assertEquals("escape.block", ChessGoal.Escape(ChessEscape.INTERPOSE).coachCode)
        assertEquals(emptyList<ChessMove>(), ChessGoals.accepted(ChessGoal.Escape(ChessEscape.ANY), ChessPosition.start))
    }

    @Test fun tacticsAndKitHelpers() {
        assertEquals(
            listOf("e5", "d7"),
            ChessTactics.absolutePins(ChessColor.BLACK, pos("4k3/3n4/8/1B2p3/8/8/8/4R1K1 w - - 0 1")).map { it.pinned.name },
        )
        assertTrue(ChessKit.hasHiddenAttackers(sq("e5"), pos("4k3/8/8/4p3/8/8/4R3/4RK2 w - - 0 1")))
        assertEquals("a4, b5 und g4", ChessKit.list(listOf("a4", "b5", "g4")))
        assertEquals("a4 und g4", ChessKit.list(listOf("a4", "g4")))
        assertEquals(listOf("Dxf7#", "Dxf7", "Dxf7+", "Df7"), ChessKit.typedVariants("Dxf7#"))
        assertEquals("Dxf7", ChessKit.sanWithoutSign("Dxf7#"))
        assertEquals("den Bauern", ChessKit.accusative(ChessPieceKind.PAWN))
        assertEquals("der Dame", ChessKit.dative(ChessPieceKind.QUEEN))
        assertEquals("eine Dame", ChessKit.indefinite(ChessPieceKind.QUEEN))
        assertEquals("der weiße Springer", ChessPiece(ChessColor.WHITE, ChessPieceKind.KNIGHT).phrase())
        assertEquals("den schwarzen Bauern", ChessPiece(ChessColor.BLACK, ChessPieceKind.PAWN).phrase(ChessCase.ACCUSATIVE))
        assertEquals("die schwarze Dame", ChessPiece(ChessColor.BLACK, ChessPieceKind.QUEEN).phrase(ChessCase.ACCUSATIVE))
        assertEquals("dem schwarzen Turm", ChessPiece(ChessColor.BLACK, ChessPieceKind.ROOK).phrase(ChessCase.DATIVE))
        assertEquals(listOf("e3", "e4"), ChessKit.destinations(sq("e2"), ChessPosition.start.playing("a2a3")!!.playing("a7a6")!!).map { it.name })
        assertEquals("Sf3 (g1–f3)", ChessKit.solution(listOf(mv("g1f3")), ChessPosition.start, true))
        assertEquals("Sf3 oder Sh3 oder a3 oder …", ChessKit.solution(listOf(mv("g1f3"), mv("g1h3"), mv("a2a3"), mv("a2a4")), ChessPosition.start, false))
        assertEquals("Sf3", ChessGoals.solutionText(listOf(mv("g1f3")), ChessPosition.start))
    }

    @Test fun lineUpsAndFork() {
        // A rook looks at a knight with the king behind it: a pin.
        val pin = pos("4k3/4n3/8/8/8/8/8/4R1K1 w - - 0 1")
        val lineUps = ChessTactics.lineUps(ChessColor.WHITE, pin)
        assertEquals(listOf(ChessLineUp(sq("e1"), sq("e7"), sq("e8"))), lineUps)
        assertTrue(ChessTactics.isPin(lineUps[0], pin))
        assertFalse(ChessTactics.isSkewer(lineUps[0], pin))
        val forked = pos("r3k3/8/8/8/3N4/8/8/4K3 w - - 0 1")
        assertEquals(emptyList<ChessSquare>(), ChessTactics.forkTargets(sq("d4"), forked))
    }

    @Test fun coachTexts() {
        val start = ChessPosition.start
        assertEquals("Auf e3 steht keine Figur.", ChessCoach.explain("e3e4", "best", start))
        assertEquals("Auf e7 steht eine schwarze Figur, aber Weiß ist am Zug.", ChessCoach.explain("e7e5", "best", start))
        assertEquals("Der Weg von f1 nach c4 ist versperrt.", ChessCoach.explain("f1c4", "best", start))
        assertEquals("Auf d2 steht schon eine eigene Figur.", ChessCoach.explain("d1d2", "best", start))
        assertEquals("Der Springer kann nicht von b1 nach b3 ziehen. Der Springer springt zwei Felder in eine Richtung und eins quer dazu.", ChessCoach.explain("b1b3", "best", start))
        assertNull(ChessCoach.explain("zz", "best", start))
        assertEquals("Der Zug ist erlaubt, aber es gibt einen stärkeren.", ChessCoach.explain("e2e4", "best", start))
        assertEquals("Der Zug ist erlaubt, aber er ist nicht der, nach dem gefragt ist.", ChessCoach.explain("e2e4", "moves", start))
    }

    @Test fun coachHints() {
        val p = pos("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1")
        val accepted = ChessGoals.accepted(ChessGoal.MateInOne, p)
        assertEquals("Es zieht die Figur auf a1.", ChessCoach.hints(ChessGoal.MateInOne, accepted, p)[1])
        val rook = ChessGoals.accepted(ChessGoal.Moves(ChessMoveFilter(kind = ChessPieceKind.ROOK)), p)
        assertEquals("Der Turm zieht gerade, so weit er will.", ChessCoach.hints(ChessGoal.Moves(ChessMoveFilter(kind = ChessPieceKind.ROOK)), rook, p)[0])
        val two = pos("4k3/8/8/8/8/8/8/N3K2N w - - 0 1")
        val all = ChessGoals.accepted(ChessGoal.Moves(ChessMoveFilter(kind = ChessPieceKind.KNIGHT)), two)
        assertEquals("Es zieht der Springer.", ChessCoach.hints(ChessGoal.Moves(ChessMoveFilter(kind = ChessPieceKind.KNIGHT)), all, two)[1])
    }
}
