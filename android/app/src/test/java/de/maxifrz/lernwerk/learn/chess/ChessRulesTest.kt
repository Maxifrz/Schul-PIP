package de.maxifrz.lernwerk.learn.chess

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Port of LernwerkTests/ChessRulesTests.swift: the rules engine, proved by counting (perft) and rule by rule.
 */
class ChessRulesTest {
    private fun <T : Any> unwrap(value: T?): T = value ?: throw AssertionError("unexpected null")

    // MARK: Perft

    private fun perft(fen: String, expected: List<Long>) {
        val start = pos(fen)
        assertEquals(emptyList<String>(), start.validationProblems())
        for ((index, count) in expected.withIndex()) {
            assertEquals("depth ${index + 1} of $fen", count, start.perft(index + 1))
        }
    }

    @Test fun perftStartPosition() = perft(ChessPosition.START_FEN, listOf(20, 400, 8902, 197_281))

    @Test fun perftKiwipete() =
        perft("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -", listOf(48, 2039, 97_862))

    @Test fun perftPosition3() = perft("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -", listOf(14, 191, 2812, 43_238))

    @Test fun perftPosition4() =
        perft("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", listOf(6, 264, 9467))

    @Test fun perftPosition4MirroredForBlack() =
        perft("r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1", listOf(6, 264, 9467))

    @Test fun perftPosition5() =
        perft("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", listOf(44, 1486, 62_379))

    @Test fun perftPosition6() =
        perft("r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", listOf(46, 2079, 89_890))

    // MARK: Squares and FEN

    @Test fun squareNamesAndColors() {
        assertEquals("a1", ChessSquare(0).name)
        assertEquals("h1", ChessSquare(7).name)
        assertEquals("h8", ChessSquare(63).name)
        assertEquals(28, ChessSquare.fromName("e4")?.index)
        assertNull(ChessSquare.fromName("i4"))
        assertNull(ChessSquare.fromName("e9"))
        assertEquals(ChessSquare.all.map { it.name }, ChessSquare.all.map { sq(it.name).name })
        assertTrue(sq("a1").isDark)
        assertTrue(sq("h1").isLight)
        assertTrue(sq("a8").isLight)
        assertTrue(sq("h8").isDark)
        for (square in ChessSquare.all) {
            for ((df, dr) in listOf(1 to 0, 0 to 1)) {
                val next = square.offset(df, dr)
                if (next != null) assertTrue(square.isDark != next.isDark)
            }
        }
        assertEquals(32, ChessSquare.all.count { it.isDark })
    }

    @Test fun fenRoundTrips() {
        for (fen in listOf(
            ChessPosition.START_FEN,
            "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
            "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
            "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
            "4k3/8/8/8/8/8/8/R3K2R b Kq - 37 71",
        )) {
            assertEquals(fen, pos(fen).fen)
        }
        // Four fields are completed with the counters 0 and 1.
        assertEquals("8/8/8/8/8/8/8/K6k w - - 0 1", pos("8/8/8/8/8/8/8/K6k w - -").fen)
    }

    @Test fun malformedFensAreRejected() {
        for (fen in listOf(
            "", "8/8/8/8/8/8/8 w - - 0 1", "9/8/8/8/8/8/8/8 w - - 0 1", "7/8/8/8/8/8/8/8 w - - 0 1",
            "8/8/8/8/8/8/8/7x w - - 0 1", "8/8/8/8/8/8/8/8 x - - 0 1", "8/8/8/8/8/8/8/8 w KK - 0 1",
            "8/8/8/8/8/8/8/8 w X - 0 1", "8/8/8/8/8/8/8/8 w - e5 0 1", "8/8/8/8/8/8/8/8 w - z3 0 1",
            "8/8/8/8/8/8/8/8 w - - -1 1", "8/8/8/8/8/8/8/8 w - - 0 0", "8/8/8/8/8/8/8/8 w - - 0",
            "8/8/8/8/8/8/8/8/8 w - - 0 1",
        )) {
            assertNull(fen, ChessPosition.fromFen(fen))
        }
    }

    @Test fun validationFindsImpossiblePositions() {
        assertEquals(emptyList<String>(), pos(ChessPosition.START_FEN).validationProblems())
        assertFalse("no black king", pos("8/8/8/8/8/8/8/K7 w - - 0 1").validationProblems().isEmpty())
        assertFalse("two black kings", pos("kk6/8/8/8/8/8/8/K7 w - - 0 1").validationProblems().isEmpty())
        assertFalse("black in check, white to move", pos("k6R/8/8/8/8/8/8/K7 w - - 0 1").validationProblems().isEmpty())
        assertFalse("pawn on the last rank", pos("P3k3/8/8/8/8/8/8/4K3 w - - 0 1").validationProblems().isEmpty())
        assertFalse("castling right without the rook", pos("4k3/8/8/8/8/8/8/R3K3 w K - 0 1").validationProblems().isEmpty())
        assertFalse("en passant square for the wrong side", pos("4k3/8/8/8/4P3/8/8/4K3 w - e3 0 1").validationProblems().isEmpty())
        assertFalse("en passant square without a pawn", pos("4k3/8/8/8/8/8/8/4K3 b - e3 0 1").validationProblems().isEmpty())
        assertEquals(emptyList<String>(), pos("4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1").validationProblems())
        val queens = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".replace("RNBQKBNR", "QQQQKQQQ")
        assertFalse("too many queens", pos(queens).validationProblems().isEmpty())
    }

    // MARK: The pieces

    @Test fun startPositionMoves() {
        val start = ChessPosition.start
        assertEquals(20, start.legalMoves().size)
        assertTrue(ucis(start).containsAll(listOf("e2e4", "e2e3", "g1f3", "g1h3", "b1c3", "b1a3")))
        assertFalse(ucis(start).contains("f1c4"))
        assertEquals(20, start.playing("e2e4")?.legalMoves()?.size)
        assertNull(start.playing("e2e5"))
        assertNull(start.playing("zzzz"))
    }

    @Test fun eachPieceMovesAsTheLawsSay() {
        fun count(fen: String, from: String) = accepted(ChessMoveFilter(from = sq(from)), pos(fen)).size
        assertEquals(8, count("k7/8/8/8/3N4/8/8/7K w - - 0 1", "d4"))
        assertEquals(14, count("7k/8/8/8/3R4/8/8/K7 w - - 0 1", "d4"))
        assertEquals(13, count("k7/8/8/8/3B4/8/7K/8 w - - 0 1", "d4"))
        assertEquals(27, count("k7/8/8/8/3Q4/8/8/7K w - - 0 1", "d4"))
        assertEquals(8, count("k7/8/8/8/4K3/8/8/8 w - - 0 1", "e4"))
        // A knight jumps over a ring of pawns.
        assertEquals(8, count("k7/8/8/2PPP3/2PNP3/2PPP3/8/7K w - - 0 1", "d4"))
        // A rook stops at its own pieces and captures enemy ones.
        assertEquals(8, count("7k/8/8/3P4/1P1R4/8/8/K7 w - - 0 1", "d4"))
        val capture = pos("7k/8/8/8/n2R2p1/8/8/K7 w - - 0 1")
        assertEquals(setOf("d4a4", "d4g4"), accepted(ChessMoveFilter(from = sq("d4"), capture = true), capture).map { it.uci }.toSet())
    }

    @Test fun kingCannotStepIntoCheckOrNextToTheOtherKing() {
        assertEquals(5, accepted(ChessMoveFilter(from = sq("e4")), pos("k7/8/8/8/4K3/8/8/3r4 w - - 0 1")).size)
        val opposition = pos("8/8/8/3k4/8/3K4/8/8 w - - 0 1")
        assertEquals(setOf("d3c3", "d3e3", "d3c2", "d3d2", "d3e2"), ucis(opposition))
    }

    @Test fun pawnMoves() {
        assertEquals(listOf("e2e3", "e2e4"), movesFrom("7k/8/8/8/8/8/4P3/K7 w - - 0 1", "e2"))
        assertEquals(listOf("e3e4"), movesFrom("7k/8/8/8/8/4P3/8/K7 w - - 0 1", "e3"))
        assertEquals(emptyList<String>(), movesFrom("7k/8/8/8/8/4n3/4P3/K7 w - - 0 1", "e2"))
        assertEquals(listOf("e2e3"), movesFrom("7k/8/8/8/4n3/8/4P3/K7 w - - 0 1", "e2"))
        assertEquals(listOf("e4d5", "e4e5", "e4f5"), movesFrom("7k/8/8/3p1p2/4P3/8/8/K7 w - - 0 1", "e4"))
        assertEquals(listOf("e7e5", "e7e6"), movesFrom("k7/4p3/8/8/8/8/8/7K b - - 0 1", "e7"))
    }

    // MARK: Special moves

    @Test fun castlingBothSidesAndTheRookMoves() {
        val both = pos("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
        assertTrue(ucis(both).containsAll(listOf("e1g1", "e1c1")))
        val short = unwrap(both.playing("e1g1"))
        assertEquals("r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1", short.fen)
        val long = unwrap(both.playing("e1c1"))
        assertEquals("r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1", long.fen)
        assertNull(short.playing("e8g8"))
        val blackLong = unwrap(short.playing("e8c8"))
        assertEquals("2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2", blackLong.fen)
        assertNull("the rook on d1 looks at d8", long.playing("e8c8"))
        val blackShort = unwrap(long.playing("e8g8"))
        assertEquals("r4rk1/8/8/8/8/8/8/2KR3R w - - 2 2", blackShort.fen)
    }

    @Test fun castlingRules() {
        assertFalse(ucis(pos("r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1")).contains("e1g1"))
        assertFalse(ucis(pos("r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1")).contains("e1c1"))
        assertTrue(ucis(pos("r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1")).contains("e1g1"))
        val inCheck = pos("4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1")
        assertFalse(ucis(inCheck).contains("e1g1") || ucis(inCheck).contains("e1c1"))
        val across = pos("5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1")
        assertFalse(ucis(across).contains("e1g1"))
        assertTrue(ucis(across).contains("e1c1"))
        val onto = pos("6rk/8/8/8/8/8/8/R3K2R w KQ - 0 1")
        assertFalse(ucis(onto).contains("e1g1"))
        assertTrue(ucis(onto).contains("e1c1"))
        assertTrue(ucis(pos("r3k3/8/8/8/8/8/8/R3K2R w KQ - 0 1")).contains("e1c1"))
        assertTrue(ucis(pos("1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1")).contains("e1c1"))
    }

    @Test fun castlingRightsAreLostByMoving() {
        val both = pos("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
        assertEquals("Qkq", both.playing("h1h2")?.castling?.fen)
        assertEquals("Kkq", both.playing("a1a2")?.castling?.fen)
        assertEquals("kq", both.playing("e1e2")?.castling?.fen)
        val capture = pos("r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1")
        assertEquals("Qkq", capture.playing("g2h1")?.castling?.fen)
        val back = unwrap(both.playing(listOf("e1e2", "e8e7", "e2e1", "e7e8")))
        assertEquals("-", back.castling.fen)
        assertFalse(ucis(back).contains("e1g1"))
    }

    @Test fun enPassantOnlyRightAfterTheDoubleStep() {
        val after = unwrap(pos("7k/3p4/8/4P3/8/8/8/K7 b - - 0 1").playing("d7d5"))
        assertEquals("d6", after.enPassant?.name)
        assertEquals("7k/8/8/3pP3/8/8/8/K7 w - d6 0 2", after.fen)
        assertTrue(ucis(after).contains("e5d6"))
        val captured = unwrap(after.playing("e5d6"))
        assertEquals("7k/8/3P4/8/8/8/8/K7 b - - 0 2", captured.fen)
        assertNull("the passed pawn is gone", captured[sq("d5")])
        val later = unwrap(after.playing("a1a2"))
        assertNull(later.enPassant)
        val waited = unwrap(later.playing("h8g8"))
        assertFalse(ucis(waited).contains("e5d6"))
        assertFalse(ucis(pos("7k/8/8/3pP3/8/8/8/K7 w - - 0 1")).contains("e5d6"))
        val black = pos("k7/8/8/8/3pP3/8/8/7K b - e3 0 1")
        assertEquals("k7/8/8/8/8/4p3/8/7K w - - 0 2", black.playing("d4e3")?.fen)
    }

    @Test fun enPassantThatExposesTheKingIsIllegal() {
        val pinned = pos("8/8/8/K1pP3r/8/8/8/7k w - c6 0 1")
        assertEquals(setOf("a5a4", "a5a6", "a5b5", "a5b6", "d5d6"), ucis(pinned))
    }

    @Test fun promotionToEveryPiece() {
        val fen = "7k/P7/8/8/8/8/8/K7 w - - 0 1"
        val start = pos(fen)
        assertEquals(listOf("a7a8b", "a7a8n", "a7a8q", "a7a8r"), movesFrom(fen, "a7"))
        for (letter in listOf("q", "r", "b", "n")) {
            val promoted = unwrap(start.playing("a7a8$letter"))
            assertEquals(ChessPiece(ChessColor.WHITE, ChessPieceKind.fromFenLetter(letter[0])!!), promoted[sq("a8")])
        }
        assertNull("a promotion needs the piece named", start.playing("a7a8"))
        assertNull(start.playing("a7a8k"))
        val captureFen = "r6k/1P6/8/8/8/8/8/6K1 w - - 0 1"
        assertEquals(8, movesFrom(captureFen, "b7").size)
        assertTrue(ucis(pos(captureFen)).contains("b7a8n"))
        assertEquals(listOf("a2a1b", "a2a1n", "a2a1q", "a2a1r"), movesFrom("k7/8/8/8/8/8/p7/7K b - - 0 1", "a2"))
        assertEquals(ChessPieceKind.QUEEN, start.applying(ChessMove(sq("a7"), sq("a8")))[sq("a8")]?.kind)
    }

    // MARK: Check, mate, stalemate, draws

    @Test fun checkMateAndStalemate() {
        var game = ChessPosition.start
        for (uci in listOf("f2f3", "e7e5", "g2g4", "d8h4")) game = unwrap(game.playing(uci))
        assertTrue(game.isCheck)
        assertTrue(game.isCheckmate)
        assertFalse(game.isStalemate)
        assertEquals(emptyList<ChessMove>(), game.legalMoves())
        assertEquals("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", game.fen)
        val backRank = unwrap(pos("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1").playing("a1a8"))
        assertTrue(backRank.isCheckmate)
        for (fen in listOf("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "k7/2Q5/1K6/8/8/8/8/8 b - - 0 1")) {
            val stalemate = pos(fen)
            assertFalse(stalemate.isCheck)
            assertTrue(stalemate.isStalemate)
            assertFalse(stalemate.isCheckmate)
        }
        val answer = pos("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1")
        assertTrue(answer.isCheck)
        assertFalse(answer.isCheckmate)
        assertEquals(setOf("e1e2", "e1d1", "e1f1"), ucis(answer))
    }

    @Test fun insufficientMaterial() {
        for (fen in listOf(
            "4k3/8/8/8/8/8/8/4K3 w - - 0 1", "4k3/8/8/8/8/8/8/3BK3 w - - 0 1",
            "4k3/8/8/8/8/8/8/3NK3 w - - 0 1", "3bk3/8/8/8/8/8/8/4K3 w - - 0 1",
        )) {
            assertTrue(fen, pos(fen).hasInsufficientMaterial)
        }
        assertTrue("c1 and g1 are both dark", pos("4k3/8/8/8/8/8/8/2B1K1b1 w - - 0 1").hasInsufficientMaterial)
        assertFalse("d1 is light, g1 is dark", pos("4k3/8/8/8/8/8/8/3BK1b1 w - - 0 1").hasInsufficientMaterial)
        assertFalse(pos("4k3/8/8/8/8/8/8/2BNK3 w - - 0 1").hasInsufficientMaterial)
        assertFalse(pos("4k3/8/8/8/8/8/P7/4K3 w - - 0 1").hasInsufficientMaterial)
        assertFalse(pos("4k3/8/8/8/8/8/8/R3K3 w - - 0 1").hasInsufficientMaterial)
        assertFalse(pos(ChessPosition.START_FEN).hasInsufficientMaterial)
        assertFalse("two knights can mate with help", pos("4k3/8/8/8/8/8/8/2NNK3 w - - 0 1").hasInsufficientMaterial)
    }

    @Test fun fiftyMoveCounterAndMoveNumber() {
        var current = ChessPosition.start
        assertEquals(0, current.halfmoveClock)
        current = unwrap(current.playing("g1f3"))
        assertEquals("rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1", current.fen)
        current = unwrap(current.playing("g8f6"))
        assertEquals(2, current.halfmoveClock)
        assertEquals(2, current.fullmoveNumber)
        current = unwrap(current.playing("e2e4"))
        assertEquals("a pawn move resets the counter", 0, current.halfmoveClock)
        current = unwrap(current.playing("f6e4"))
        assertEquals("so does a capture", 0, current.halfmoveClock)
        val long = pos("4k3/8/8/8/8/8/8/R3K3 w - - 99 80")
        assertFalse(long.canClaimFiftyMoveDraw)
        val next = unwrap(long.playing("a1a2"))
        assertEquals(100, next.halfmoveClock)
        assertTrue(next.canClaimFiftyMoveDraw)
        assertEquals("the move number grows after Black's move", 80, next.fullmoveNumber)
        assertEquals(81, unwrap(next.playing("e8d8")).fullmoveNumber)
    }

    // MARK: Notation

    private fun san(uci: String, position: ChessPosition): String? = ChessNotation.san(mv(uci), position)

    @Test fun germanNotationBasics() {
        val start = ChessPosition.start
        assertEquals("e4", san("e2e4", start))
        assertEquals("Sf3", san("g1f3", start))
        assertNull(san("e2e5", start))
        val scholar = unwrap(ChessNotation.play(listOf("e4", "e5", "Lc4", "Sc6", "Dh5", "Sf6", "Dxf7#")))
        assertTrue(scholar.isCheckmate)
        assertEquals("r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4", scholar.fen)
        assertEquals(listOf("e4", "e5", "Dh5"), ChessNotation.sanLine(listOf("e2e4", "e7e5", "d1h5").map { mv(it) }, start))
        assertEquals(listOf("", "S", "L", "T", "D", "K"), ChessPieceKind.entries.map { it.letter })
        val castling = pos("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
        assertEquals("O-O", san("e1g1", castling))
        assertEquals("O-O-O", san("e1c1", castling))
        assertEquals("Txa8+", san("a1a8", castling))
        assertEquals("exd5", san("e4d5", pos("7k/8/8/3p4/4P3/8/8/K7 w - - 0 1")))
        assertEquals("exd6", san("e5d6", pos("7k/8/8/3pP3/8/8/8/K7 w - d6 0 1")))
        assertEquals("a8D+", san("a7a8q", pos("7k/P7/8/8/8/8/8/K7 w - - 0 1")))
        assertEquals("a8S", san("a7a8n", pos("7k/P7/8/8/8/8/8/K7 w - - 0 1")))
    }

    @Test fun notationDisambiguation() {
        fun sans(fen: String, target: String): Set<String> =
            ChessNotation.allSAN(pos(fen)).filter { it.move.to.name == target }.map { it.san }.toSet()
        assertEquals(setOf("S3c2", "S1c2"), sans("4k3/8/8/8/8/N7/8/N3K3 w - - 0 1", "c2"))
        assertEquals(setOf("Sb5"), sans("4k3/8/8/8/8/N7/8/N3K3 w - - 0 1", "b5"))
        assertEquals(setOf("T3a2", "T1a2"), sans("4k3/8/8/8/8/R7/8/R3K3 w - - 0 1", "a2"))
        assertEquals(setOf("Dee3+", "Dce3+"), sans("4k3/8/8/2Q1Q3/8/8/2Q5/4K3 w - - 0 1", "e3"))
        assertEquals(setOf("Dcb2", "Da2b2", "D1b2"), sans("4k3/8/8/8/8/8/Q1Q5/Q3K3 w - - 0 1", "b2"))
        assertEquals(setOf("Sfe4", "Sde4"), sans("4r1k1/8/8/8/8/8/3N1N2/4K3 w - - 0 1", "e4"))
    }

    @Test fun notationParsingIsForgivingAndExact() {
        val kiwi = pos("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1")
        for (entry in ChessNotation.allSAN(kiwi)) {
            assertEquals(entry.san, entry.move, ChessNotation.move(entry.san, kiwi))
        }
        assertEquals(mv("e1g1"), ChessNotation.move("0-0", kiwi))
        assertEquals(mv("e1c1"), ChessNotation.move("O-O-O", kiwi))
        assertNull("no knight can take h6 here", ChessNotation.move("Sxh6", kiwi))
        assertNotNull(ChessNotation.move("Sxf7", kiwi))
        assertNull(ChessNotation.move("Zz9", kiwi))
        assertNull(ChessNotation.move("", kiwi))
        assertEquals(mv("g2h3"), ChessNotation.move("gxh3", kiwi))
    }

    // MARK: The search and the exchange helper

    @Test fun mateInOneIsFoundBySearchAndGoal() {
        val backRank = pos("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1")
        assertEquals(listOf("a1a8"), ChessGoals.accepted(ChessGoal.MateInOne, backRank).map { it.uci })
        val best = ChessSearch.bestMoves(backRank, 2)
        assertEquals(listOf("a1a8"), best.moves.map { it.uci })
        assertEquals(ChessSearch.MATE_SCORE - 1, best.score)
        assertEquals(emptyList<ChessMove>(), ChessSearch.bestMoves(pos("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), 3).moves)
    }

    @Test fun searchDoesNotLoseMaterial() {
        val trap = pos("3rk3/8/8/8/8/8/8/3QK3 w - - 0 1")
        val best = ChessSearch.bestMoves(trap, 3)
        assertFalse(best.moves.map { it.uci }.contains("d1d8"))
        assertTrue(best.score >= 0)
        val free = pos("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1")
        assertEquals(listOf("d1d5"), ChessSearch.bestMoves(free, 2).moves.map { it.uci })
    }

    @Test fun exchangeHelper() {
        val even = pos("4k3/8/2p5/3p4/4P3/8/8/4K3 w - - 0 1")
        assertEquals(0, ChessExchange.gain(mv("e4d5"), even))
        val queen = pos("4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1")
        assertEquals(-8, ChessExchange.gain(mv("d1d5"), queen))
        val free = pos("4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1")
        assertEquals(1, ChessExchange.gain(mv("d1d5"), free))
        val knight = pos("4k3/8/4b3/3n4/8/8/8/3RK3 w - - 0 1")
        assertEquals(-2, ChessExchange.gain(mv("d1d5"), knight))
        assertEquals(emptyList<ChessMove>(), ChessExchange.bestCaptures(knight).moves)
        val pawn = pos("4k3/8/4b3/3n4/4P3/8/8/3RK3 w - - 0 1")
        assertEquals(3, ChessExchange.gain(mv("e4d5"), pawn))
        assertEquals(1, ChessExchange.gain(mv("d1d5"), pawn))
        assertEquals(listOf("e4d5"), ChessExchange.bestCaptures(pawn).moves.map { it.uci })
        assertEquals("no capture wins anything", emptyList<ChessMove>(), ChessExchange.bestCaptures(queen).moves)
        val pinned = pos("4k3/3n4/8/1B2p3/8/8/8/4R1K1 w - - 0 1")
        assertEquals(1, ChessExchange.gain(mv("e1e5"), pinned))
    }

    @Test fun materialCount() {
        assertEquals(39, ChessPosition.start.material(ChessColor.WHITE))
        assertEquals(39, ChessPosition.start.material(ChessColor.BLACK))
        assertEquals(5, pos("4k3/8/8/8/8/8/8/R3K3 w - - 0 1").materialBalanceForSideToMove)
        assertEquals(-5, pos("4k3/8/8/8/8/8/8/R3K3 b - - 0 1").materialBalanceForSideToMove)
    }

    @Test fun answersHandleThePromotionTap() {
        val up = mv("a7a8q")
        val rook = mv("a7a8r")
        assertEquals(listOf("a7a8q", "a7a8"), ChessGoals.answers(listOf(up)))
        assertEquals(listOf("a7a8q", "a7a8", "a7a8r"), ChessGoals.answers(listOf(up, rook)))
        assertNull("an under-promotion alone cannot be given by tapping two squares", ChessGoals.answers(listOf(rook)))
        assertEquals(listOf("e2e4"), ChessGoals.answers(listOf(mv("e2e4"))))
    }
}
