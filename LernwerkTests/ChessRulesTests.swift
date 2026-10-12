import XCTest
@testable import Lernwerk

/// The rules engine, proved by counting: the perft numbers of the start position and of the well-known test
/// positions (Chess Programming Wiki, "Perft Results") only come out right when castling, en passant, promotion,
/// pins and checks are all right. The rest of the file checks the individual rules and the notation.
final class ChessRulesTests: XCTestCase {
    private func position(_ fen: String, file: StaticString = #filePath, line: UInt = #line) -> ChessPosition {
        guard let position = ChessPosition(fen: fen) else {
            XCTFail("FEN does not parse: \(fen)", file: file, line: line)
            return .start
        }
        return position
    }

    private func ucis(_ position: ChessPosition) -> Set<String> {
        Set(position.legalMoves().map(\.uci))
    }

    /// The legal moves of the piece on a square, sorted.
    private func moves(_ fen: String, from square: String) -> [String] {
        position(fen).legalMoves().filter { $0.from.name == square }.map(\.uci).sorted()
    }

    // MARK: Perft

    private func perft(_ fen: String, _ expected: [Int], file: StaticString = #filePath, line: UInt = #line) {
        let start = position(fen, file: file, line: line)
        XCTAssertEqual(start.validationProblems(), [], file: file, line: line)
        for (index, count) in expected.enumerated() {
            XCTAssertEqual(start.perft(index + 1), count, "depth \(index + 1) of \(fen)", file: file, line: line)
        }
    }

    func testPerftStartPosition() {
        perft(ChessPosition.startFEN, [20, 400, 8902, 197_281])
    }

    func testPerftKiwipete() {
        perft("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -", [48, 2039, 97_862])
    }

    func testPerftPosition3() {
        perft("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -", [14, 191, 2812, 43_238])
    }

    func testPerftPosition4() {
        perft("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467])
    }

    func testPerftPosition4MirroredForBlack() {
        // The same position with the colors swapped has the same counts.
        perft("r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1", [6, 264, 9467])
    }

    func testPerftPosition5() {
        perft("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62_379])
    }

    func testPerftPosition6() {
        perft("r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", [46, 2079, 89_890])
    }

    // MARK: Squares and FEN

    func testSquareNamesAndColors() {
        XCTAssertEqual(ChessSquare(index: 0).name, "a1")
        XCTAssertEqual(ChessSquare(index: 7).name, "h1")
        XCTAssertEqual(ChessSquare(index: 63).name, "h8")
        XCTAssertEqual(ChessSquare("e4")?.index, 28)
        XCTAssertNil(ChessSquare("i4"))
        XCTAssertNil(ChessSquare("e9"))
        XCTAssertEqual(ChessSquare.all.map(\.name), ChessSquare.all.map { ChessSquare($0.name)!.name })
        // a1 is dark and the colors alternate along ranks and files, so h1 and a8 are light (FIDE Article 2.1).
        XCTAssertTrue(ChessSquare("a1")!.isDark)
        XCTAssertTrue(ChessSquare("h1")!.isLight)
        XCTAssertTrue(ChessSquare("a8")!.isLight)
        XCTAssertTrue(ChessSquare("h8")!.isDark)
        for square in ChessSquare.all {
            for (df, dr) in [(1, 0), (0, 1)] {
                if let next = square.offset(file: df, rank: dr) { XCTAssertNotEqual(square.isDark, next.isDark) }
            }
        }
        XCTAssertEqual(ChessSquare.all.filter(\.isDark).count, 32)
    }

    func testFENRoundTrips() {
        for fen in [
            ChessPosition.startFEN,
            "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
            "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
            "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
            "4k3/8/8/8/8/8/8/R3K2R b Kq - 37 71",
        ] {
            XCTAssertEqual(position(fen).fen, fen)
        }
        // Four fields are completed with the counters 0 and 1.
        XCTAssertEqual(position("8/8/8/8/8/8/8/K6k w - -").fen, "8/8/8/8/8/8/8/K6k w - - 0 1")
    }

    func testMalformedFENsAreRejected() {
        for fen in [
            "", "8/8/8/8/8/8/8 w - - 0 1", "9/8/8/8/8/8/8/8 w - - 0 1", "7/8/8/8/8/8/8/8 w - - 0 1",
            "8/8/8/8/8/8/8/7x w - - 0 1", "8/8/8/8/8/8/8/8 x - - 0 1", "8/8/8/8/8/8/8/8 w KK - 0 1",
            "8/8/8/8/8/8/8/8 w X - 0 1", "8/8/8/8/8/8/8/8 w - e5 0 1", "8/8/8/8/8/8/8/8 w - z3 0 1",
            "8/8/8/8/8/8/8/8 w - - -1 1", "8/8/8/8/8/8/8/8 w - - 0 0", "8/8/8/8/8/8/8/8 w - - 0", "8/8/8/8/8/8/8/8/8 w - - 0 1",
        ] {
            XCTAssertNil(ChessPosition(fen: fen), fen)
        }
    }

    func testValidationFindsImpossiblePositions() {
        XCTAssertEqual(position(ChessPosition.startFEN).validationProblems(), [])
        XCTAssertFalse(position("8/8/8/8/8/8/8/K7 w - - 0 1").validationProblems().isEmpty, "no black king")
        XCTAssertFalse(position("kk6/8/8/8/8/8/8/K7 w - - 0 1").validationProblems().isEmpty, "two black kings")
        XCTAssertFalse(position("k6R/8/8/8/8/8/8/K7 w - - 0 1").validationProblems().isEmpty, "black is in check but white is to move")
        XCTAssertFalse(position("P3k3/8/8/8/8/8/8/4K3 w - - 0 1").validationProblems().isEmpty, "pawn on the last rank")
        XCTAssertFalse(position("4k3/8/8/8/8/8/8/R3K3 w K - 0 1").validationProblems().isEmpty, "castling right without the rook")
        XCTAssertFalse(position("4k3/8/8/8/4P3/8/8/4K3 w - e3 0 1").validationProblems().isEmpty, "en passant square for the wrong side")
        XCTAssertFalse(position("4k3/8/8/8/8/8/8/4K3 b - e3 0 1").validationProblems().isEmpty, "en passant square without a pawn")
        XCTAssertEqual(position("4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1").validationProblems(), [])
        XCTAssertFalse(position("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".replacingOccurrences(of: "RNBQKBNR", with: "QQQQKQQQ")).validationProblems().isEmpty, "too many queens")
    }

    // MARK: The pieces

    func testStartPositionMoves() {
        let start = ChessPosition.start
        XCTAssertEqual(start.legalMoves().count, 20)
        XCTAssertTrue(ucis(start).isSuperset(of: ["e2e4", "e2e3", "g1f3", "g1h3", "b1c3", "b1a3"]))
        XCTAssertFalse(ucis(start).contains("f1c4"))
        // After 1.e4 Black has 20 moves too.
        XCTAssertEqual(start.playing("e2e4")?.legalMoves().count, 20)
        XCTAssertNil(start.playing("e2e5"))
        XCTAssertNil(start.playing("zzzz"))
    }

    func testEachPieceMovesAsTheLawsSay() {
        // A knight on d4 has eight squares, a rook 14, a bishop 13 from d4 on an empty board with kings far away.
        XCTAssertEqual(ChessGoals.accepted(.moves(ChessMoveFilter(from: ChessSquare("d4"))), in: position("k7/8/8/8/3N4/8/8/7K w - - 0 1")).count, 8)
        XCTAssertEqual(ChessGoals.accepted(.moves(ChessMoveFilter(from: ChessSquare("d4"))), in: position("7k/8/8/8/3R4/8/8/K7 w - - 0 1")).count, 14)
        XCTAssertEqual(ChessGoals.accepted(.moves(ChessMoveFilter(from: ChessSquare("d4"))), in: position("k7/8/8/8/3B4/8/7K/8 w - - 0 1")).count, 13)
        XCTAssertEqual(ChessGoals.accepted(.moves(ChessMoveFilter(from: ChessSquare("d4"))), in: position("k7/8/8/8/3Q4/8/8/7K w - - 0 1")).count, 27)
        XCTAssertEqual(ChessGoals.accepted(.moves(ChessMoveFilter(from: ChessSquare("e4"))), in: position("k7/8/8/8/4K3/8/8/8 w - - 0 1")).count, 8)
        // A knight jumps over a ring of pawns.
        XCTAssertEqual(ChessGoals.accepted(.moves(ChessMoveFilter(from: ChessSquare("d4"))), in: position("k7/8/8/2PPP3/2PNP3/2PPP3/8/7K w - - 0 1")).count, 8)
        // A rook stops at its own pieces and captures enemy ones.
        let rook = position("7k/8/8/3P4/1P1R4/8/8/K7 w - - 0 1")
        XCTAssertEqual(ChessGoals.accepted(.moves(ChessMoveFilter(from: ChessSquare("d4"))), in: rook).count, 8)
        let capture = position("7k/8/8/8/n2R2p1/8/8/K7 w - - 0 1")
        XCTAssertEqual(Set(ChessGoals.accepted(.moves(ChessMoveFilter(from: ChessSquare("d4"), capture: true)), in: capture).map(\.uci)), ["d4a4", "d4g4"])
    }

    func testKingCannotStepIntoCheckOrNextToTheOtherKing() {
        // The rook on d1 covers the d-file: the king on e4 has five squares left.
        XCTAssertEqual(ChessGoals.accepted(.moves(ChessMoveFilter(from: ChessSquare("e4"))), in: position("k7/8/8/8/4K3/8/8/3r4 w - - 0 1")).count, 5)
        // Kings face each other: three squares next to the black king are closed.
        let opposition = position("8/8/8/3k4/8/3K4/8/8 w - - 0 1")
        XCTAssertEqual(ucis(opposition), ["d3c3", "d3e3", "d3c2", "d3d2", "d3e2"])
    }

    func testPawnMoves() {
        XCTAssertEqual(moves("7k/8/8/8/8/8/4P3/K7 w - - 0 1", from: "e2"), ["e2e3", "e2e4"])
        XCTAssertEqual(moves("7k/8/8/8/8/4P3/8/K7 w - - 0 1", from: "e3"), ["e3e4"])
        // Blocked in front: no step, no capture straight ahead; one step blocks the double step too.
        XCTAssertEqual(moves("7k/8/8/8/8/4n3/4P3/K7 w - - 0 1", from: "e2"), [])
        XCTAssertEqual(moves("7k/8/8/8/4n3/8/4P3/K7 w - - 0 1", from: "e2"), ["e2e3"])
        // Captures go diagonally forward only.
        XCTAssertEqual(moves("7k/8/8/3p1p2/4P3/8/8/K7 w - - 0 1", from: "e4"), ["e4d5", "e4e5", "e4f5"])
        // Black pawns move down.
        XCTAssertEqual(moves("k7/4p3/8/8/8/8/8/7K b - - 0 1", from: "e7"), ["e7e5", "e7e6"])
    }

    // MARK: Special moves

    func testCastlingBothSidesAndTheRookMoves() throws {
        let both = position("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
        XCTAssertTrue(ucis(both).isSuperset(of: ["e1g1", "e1c1"]))
        let short = try XCTUnwrap(both.playing("e1g1"))
        XCTAssertEqual(short.fen, "r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1")
        let long = try XCTUnwrap(both.playing("e1c1"))
        XCTAssertEqual(long.fen, "r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1")
        // White's new rook on f1 looks at f8, so Black cannot castle short there, but long it can.
        XCTAssertNil(short.playing("e8g8"))
        let blackLong = try XCTUnwrap(short.playing("e8c8"))
        XCTAssertEqual(blackLong.fen, "2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2")
        XCTAssertNil(long.playing("e8c8"), "the rook on d1 looks at d8")
        let blackShort = try XCTUnwrap(long.playing("e8g8"))
        XCTAssertEqual(blackShort.fen, "r4rk1/8/8/8/8/8/8/2KR3R w - - 2 2")
    }

    func testCastlingRules() {
        // The right is gone, or something stands in between.
        XCTAssertFalse(ucis(position("r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1")).contains("e1g1"))
        XCTAssertFalse(ucis(position("r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1")).contains("e1c1"))
        XCTAssertTrue(ucis(position("r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1")).contains("e1g1"))
        // Not out of check, not across or onto an attacked square.
        let inCheck = position("4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1")
        XCTAssertFalse(ucis(inCheck).contains("e1g1") || ucis(inCheck).contains("e1c1"))
        let across = position("5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1")
        XCTAssertFalse(ucis(across).contains("e1g1"))
        XCTAssertTrue(ucis(across).contains("e1c1"))
        let onto = position("6rk/8/8/8/8/8/8/R3K2R w KQ - 0 1")
        XCTAssertFalse(ucis(onto).contains("e1g1"))
        XCTAssertTrue(ucis(onto).contains("e1c1"))
        // The rook may be attacked, and so may b1 on the long side.
        XCTAssertTrue(ucis(position("r3k3/8/8/8/8/8/8/R3K2R w KQ - 0 1")).contains("e1c1"))
        XCTAssertTrue(ucis(position("1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1")).contains("e1c1"))
    }

    func testCastlingRightsAreLostByMoving() throws {
        let both = position("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
        XCTAssertEqual(both.playing("h1h2")?.castling.fen, "Qkq")
        XCTAssertEqual(both.playing("a1a2")?.castling.fen, "Kkq")
        XCTAssertEqual(both.playing("e1e2")?.castling.fen, "kq")
        // A rook captured on its corner takes the right with it.
        let capture = position("r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1")
        XCTAssertEqual(capture.playing("g2h1")?.castling.fen, "Qkq")
        // The rights do not come back when the king returns.
        let back = try XCTUnwrap(both.playing(line: ["e1e2", "e8e7", "e2e1", "e7e8"]))
        XCTAssertEqual(back.castling.fen, "-")
        XCTAssertFalse(ucis(back).contains("e1g1"))
    }

    func testEnPassantOnlyRightAfterTheDoubleStep() throws {
        let after = try XCTUnwrap(position("7k/3p4/8/4P3/8/8/8/K7 b - - 0 1").playing("d7d5"))
        XCTAssertEqual(after.enPassant?.name, "d6")
        XCTAssertEqual(after.fen, "7k/8/8/3pP3/8/8/8/K7 w - d6 0 2")
        XCTAssertTrue(ucis(after).contains("e5d6"))
        let captured = try XCTUnwrap(after.playing("e5d6"))
        XCTAssertEqual(captured.fen, "7k/8/3P4/8/8/8/8/K7 b - - 0 2")
        XCTAssertNil(captured[ChessSquare("d5")!], "the passed pawn is gone")
        // One move later the right has lapsed.
        let later = try XCTUnwrap(after.playing("a1a2"))
        XCTAssertNil(later.enPassant)
        let waited = try XCTUnwrap(later.playing("h8g8"))
        XCTAssertFalse(ucis(waited).contains("e5d6"))
        // Two single steps do not allow it.
        XCTAssertFalse(ucis(position("7k/8/8/3pP3/8/8/8/K7 w - - 0 1")).contains("e5d6"))
        // Black captures en passant too.
        let black = position("k7/8/8/8/3pP3/8/8/7K b - e3 0 1")
        XCTAssertEqual(black.playing("d4e3")?.fen, "k7/8/8/8/8/4p3/8/7K w - - 0 2")
    }

    func testEnPassantThatExposesTheKingIsIllegal() {
        // Taking en passant would clear the fifth rank between the king on a5 and the rook on h5.
        let pinned = position("8/8/8/K1pP3r/8/8/8/7k w - c6 0 1")
        XCTAssertEqual(ucis(pinned), ["a5a4", "a5a6", "a5b5", "a5b6", "d5d6"])
    }

    func testPromotionToEveryPiece() throws {
        let start = position("7k/P7/8/8/8/8/8/K7 w - - 0 1")
        XCTAssertEqual(moves("7k/P7/8/8/8/8/8/K7 w - - 0 1", from: "a7"), ["a7a8b", "a7a8n", "a7a8q", "a7a8r"])
        for letter in ["q", "r", "b", "n"] {
            let promoted = try XCTUnwrap(start.playing("a7a8" + letter))
            XCTAssertEqual(promoted[ChessSquare("a8")!], ChessPiece(.white, ChessPieceKind(fenLetter: Character(letter))!))
        }
        XCTAssertNil(start.playing("a7a8"), "a promotion needs the piece named")
        XCTAssertNil(start.playing("a7a8k"))
        // With a capture, and for Black.
        let capture = position("r6k/1P6/8/8/8/8/8/6K1 w - - 0 1")
        XCTAssertEqual(moves("r6k/1P6/8/8/8/8/8/6K1 w - - 0 1", from: "b7").count, 8)
        XCTAssertTrue(ucis(capture).contains("b7a8n"))
        XCTAssertEqual(moves("k7/8/8/8/8/8/p7/7K b - - 0 1", from: "a2"), ["a2a1b", "a2a1n", "a2a1q", "a2a1r"])
        // A pawn that promotes with the piece left out by the engine's own apply becomes a queen.
        XCTAssertEqual(start.applying(ChessMove(from: ChessSquare("a7")!, to: ChessSquare("a8")!))[ChessSquare("a8")!]?.kind, .queen)
    }

    // MARK: Check, mate, stalemate, draws

    func testCheckMateAndStalemate() throws {
        var game = ChessPosition.start
        for uci in ["f2f3", "e7e5", "g2g4", "d8h4"] { game = try XCTUnwrap(game.playing(uci)) }
        XCTAssertTrue(game.isCheck)
        XCTAssertTrue(game.isCheckmate)
        XCTAssertFalse(game.isStalemate)
        XCTAssertEqual(game.legalMoves(), [])
        XCTAssertEqual(game.fen, "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3")
        // Back-rank mate.
        let backRank = try XCTUnwrap(position("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1").playing("a1a8"))
        XCTAssertTrue(backRank.isCheckmate)
        // Stalemate: the king has no square and is not attacked.
        for fen in ["7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "k7/2Q5/1K6/8/8/8/8/8 b - - 0 1"] {
            let stalemate = position(fen)
            XCTAssertFalse(stalemate.isCheck)
            XCTAssertTrue(stalemate.isStalemate)
            XCTAssertFalse(stalemate.isCheckmate)
        }
        // Check that can be answered is neither.
        let answer = position("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1")
        XCTAssertTrue(answer.isCheck)
        XCTAssertFalse(answer.isCheckmate)
        XCTAssertEqual(ucis(answer), ["e1e2", "e1d1", "e1f1"])
    }

    func testInsufficientMaterial() {
        for fen in ["4k3/8/8/8/8/8/8/4K3 w - - 0 1", "4k3/8/8/8/8/8/8/3BK3 w - - 0 1", "4k3/8/8/8/8/8/8/3NK3 w - - 0 1", "3bk3/8/8/8/8/8/8/4K3 w - - 0 1"] {
            XCTAssertTrue(position(fen).hasInsufficientMaterial, fen)
        }
        // Bishops that stand on squares of one color cannot mate; one on each color can, with help.
        XCTAssertTrue(position("4k3/8/8/8/8/8/8/2B1K1b1 w - - 0 1").hasInsufficientMaterial, "c1 and g1 are both dark")
        XCTAssertFalse(position("4k3/8/8/8/8/8/8/3BK1b1 w - - 0 1").hasInsufficientMaterial, "d1 is light, g1 is dark")
        XCTAssertFalse(position("4k3/8/8/8/8/8/8/2BNK3 w - - 0 1").hasInsufficientMaterial)
        XCTAssertFalse(position("4k3/8/8/8/8/8/P7/4K3 w - - 0 1").hasInsufficientMaterial)
        XCTAssertFalse(position("4k3/8/8/8/8/8/8/R3K3 w - - 0 1").hasInsufficientMaterial)
        XCTAssertFalse(position(ChessPosition.startFEN).hasInsufficientMaterial)
        XCTAssertFalse(position("4k3/8/8/8/8/8/8/2NNK3 w - - 0 1").hasInsufficientMaterial, "two knights can mate with help")
    }

    func testFiftyMoveCounterAndMoveNumber() throws {
        var current = ChessPosition.start
        XCTAssertEqual(current.halfmoveClock, 0)
        current = try XCTUnwrap(current.playing("g1f3"))
        XCTAssertEqual(current.fen, "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1")
        current = try XCTUnwrap(current.playing("g8f6"))
        XCTAssertEqual(current.halfmoveClock, 2)
        XCTAssertEqual(current.fullmoveNumber, 2)
        current = try XCTUnwrap(current.playing("e2e4"))
        XCTAssertEqual(current.halfmoveClock, 0, "a pawn move resets the counter")
        current = try XCTUnwrap(current.playing("f6e4"))
        XCTAssertEqual(current.halfmoveClock, 0, "so does a capture")
        let long = position("4k3/8/8/8/8/8/8/R3K3 w - - 99 80")
        XCTAssertFalse(long.canClaimFiftyMoveDraw)
        let next = try XCTUnwrap(long.playing("a1a2"))
        XCTAssertEqual(next.halfmoveClock, 100)
        XCTAssertTrue(next.canClaimFiftyMoveDraw)
        XCTAssertEqual(next.fullmoveNumber, 80, "the move number grows after Black's move")
        XCTAssertEqual(try XCTUnwrap(next.playing("e8d8")).fullmoveNumber, 81)
    }

    // MARK: Notation

    func testGermanNotationBasics() throws {
        let start = ChessPosition.start
        func san(_ uci: String, in position: ChessPosition) -> String? { ChessMove(uci: uci).flatMap { ChessNotation.san($0, in: position) } }
        XCTAssertEqual(san("e2e4", in: start), "e4")
        XCTAssertEqual(san("g1f3", in: start), "Sf3")
        XCTAssertNil(san("e2e5", in: start))
        let scholar = try XCTUnwrap(ChessNotation.play(["e4", "e5", "Lc4", "Sc6", "Dh5", "Sf6", "Dxf7#"]))
        XCTAssertTrue(scholar.isCheckmate)
        XCTAssertEqual(scholar.fen, "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4")
        XCTAssertEqual(ChessNotation.sanLine(try ["e2e4", "e7e5", "d1h5"].map { try XCTUnwrap(ChessMove(uci: $0)) }, from: start), ["e4", "e5", "Dh5"])
        // Letters: König, Dame, Turm, Läufer, Springer.
        XCTAssertEqual(ChessPieceKind.allCases.map(\.letter), ["", "S", "L", "T", "D", "K"])
        // Captures, pawn captures, castling, check.
        let castling = position("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
        XCTAssertEqual(san("e1g1", in: castling), "O-O")
        XCTAssertEqual(san("e1c1", in: castling), "O-O-O")
        XCTAssertEqual(san("a1a8", in: castling), "Txa8+")
        let pawns = position("7k/8/8/3p4/4P3/8/8/K7 w - - 0 1")
        XCTAssertEqual(san("e4d5", in: pawns), "exd5")
        // En passant is written like a capture on the passed square.
        XCTAssertEqual(san("e5d6", in: position("7k/8/8/3pP3/8/8/8/K7 w - d6 0 1")), "exd6")
        // A promotion takes the German letter, with the check sign.
        XCTAssertEqual(san("a7a8q", in: position("7k/P7/8/8/8/8/8/K7 w - - 0 1")), "a8D+")
        XCTAssertEqual(san("a7a8n", in: position("7k/P7/8/8/8/8/8/K7 w - - 0 1")), "a8S")
    }

    func testNotationDisambiguation() {
        func sans(_ fen: String, to target: String) -> Set<String> {
            let position = self.position(fen)
            return Set(ChessNotation.allSAN(in: position).filter { $0.move.to.name == target }.map(\.san))
        }
        // Two knights that can reach the same square: the file tells them apart, else the rank.
        XCTAssertEqual(sans("4k3/8/8/8/8/N7/8/N3K3 w - - 0 1", to: "c2"), ["S3c2", "S1c2"])
        XCTAssertEqual(sans("4k3/8/8/8/8/N7/8/N3K3 w - - 0 1", to: "b5"), ["Sb5"])
        XCTAssertEqual(sans("4k3/8/8/8/8/R7/8/R3K3 w - - 0 1", to: "a2"), ["T3a2", "T1a2"])
        XCTAssertEqual(sans("4k3/8/8/2Q1Q3/8/8/2Q5/4K3 w - - 0 1", to: "e3"), ["Dee3+", "Dce3+"])
        // Three queens: a file, a rank and a full square are all needed.
        XCTAssertEqual(sans("4k3/8/8/8/8/8/Q1Q5/Q3K3 w - - 0 1", to: "b2"), ["Dcb2", "Da2b2", "D1b2"])
        // Both knights block the check on the e-file by going to e4.
        XCTAssertEqual(sans("4r1k1/8/8/8/8/8/3N1N2/4K3 w - - 0 1", to: "e4"), ["Sfe4", "Sde4"])
    }

    func testNotationParsingIsForgivingAndExact() throws {
        let kiwi = position("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1")
        for entry in ChessNotation.allSAN(in: kiwi) {
            XCTAssertEqual(ChessNotation.move(fromSAN: entry.san, in: kiwi), entry.move, entry.san)
        }
        XCTAssertEqual(ChessNotation.move(fromSAN: "0-0", in: kiwi), ChessMove(uci: "e1g1"))
        XCTAssertEqual(ChessNotation.move(fromSAN: "O-O-O", in: kiwi), ChessMove(uci: "e1c1"))
        XCTAssertNil(ChessNotation.move(fromSAN: "Sxh6", in: kiwi), "no knight can take h6 here")
        XCTAssertNotNil(ChessNotation.move(fromSAN: "Sxf7", in: kiwi))
        XCTAssertNil(ChessNotation.move(fromSAN: "Zz9", in: kiwi))
        XCTAssertNil(ChessNotation.move(fromSAN: "", in: kiwi))
        XCTAssertEqual(ChessNotation.move(fromSAN: "gxh3", in: kiwi), ChessMove(uci: "g2h3"))
    }

    // MARK: The search and the exchange helper

    func testMateInOneIsFoundBySearchAndGoal() {
        let backRank = position("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1")
        XCTAssertEqual(ChessGoals.accepted(.mateInOne, in: backRank).map(\.uci), ["a1a8"])
        let best = ChessSearch.bestMoves(in: backRank, depth: 2)
        XCTAssertEqual(best.moves.map(\.uci), ["a1a8"])
        XCTAssertEqual(best.score, ChessSearch.mateScore - 1)
        XCTAssertEqual(ChessSearch.bestMoves(in: position("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), depth: 3).moves, [])
    }

    func testSearchDoesNotLoseMaterial() {
        // The queen on d1 can take the rook on d8, which is defended by the king: the capture loses the queen.
        let trap = position("3rk3/8/8/8/8/8/8/3QK3 w - - 0 1")
        let best = ChessSearch.bestMoves(in: trap, depth: 3)
        XCTAssertFalse(best.moves.map(\.uci).contains("d1d8"))
        XCTAssertGreaterThanOrEqual(best.score, 0)
        // A free piece is taken.
        let free = position("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1")
        XCTAssertEqual(ChessSearch.bestMoves(in: free, depth: 2).moves.map(\.uci), ["d1d5"])
    }

    func testExchangeHelper() {
        // A pawn takes a pawn that a pawn defends: 1 - 1 = 0.
        let even = position("4k3/8/2p5/3p4/4P3/8/8/4K3 w - - 0 1")
        let pawnTakes = ChessMove(uci: "e4d5")!
        XCTAssertEqual(ChessExchange.gain(of: pawnTakes, in: even), 0)
        // A queen takes a pawn that a pawn defends: 1 - 9 = -8.
        let queen = position("4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1")
        XCTAssertEqual(ChessExchange.gain(of: ChessMove(uci: "d1d5")!, in: queen), -8)
        // The same pawn without its defender is free.
        let free = position("4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1")
        XCTAssertEqual(ChessExchange.gain(of: ChessMove(uci: "d1d5")!, in: free), 1)
        // A rook takes a knight that a bishop defends: 3 - 5 = -2.
        let knight = position("4k3/8/4b3/3n4/8/8/8/3RK3 w - - 0 1")
        XCTAssertEqual(ChessExchange.gain(of: ChessMove(uci: "d1d5")!, in: knight), -2)
        XCTAssertEqual(ChessExchange.bestCaptures(in: knight).moves, [])
        // With a pawn beside, the pawn takes the knight first and the bishop cannot recapture profitably.
        let pawn = position("4k3/8/4b3/3n4/4P3/8/8/3RK3 w - - 0 1")
        XCTAssertEqual(ChessExchange.gain(of: ChessMove(uci: "e4d5")!, in: pawn), 3)
        XCTAssertEqual(ChessExchange.gain(of: ChessMove(uci: "d1d5")!, in: pawn), 1)
        XCTAssertEqual(ChessExchange.bestCaptures(in: pawn).moves.map(\.uci), ["e4d5"])
        XCTAssertEqual(ChessExchange.bestCaptures(in: queen).moves, [], "no capture wins anything")
        // A pinned defender does not defend: the knight on d7 cannot take back on e5, because the bishop b5 pins it.
        let pinned = position("4k3/3n4/8/1B2p3/8/8/8/4R1K1 w - - 0 1")
        XCTAssertEqual(ChessExchange.gain(of: ChessMove(uci: "e1e5")!, in: pinned), 1)
    }

    func testMaterialCount() {
        XCTAssertEqual(ChessPosition.start.material(of: .white), 39)
        XCTAssertEqual(ChessPosition.start.material(of: .black), 39)
        XCTAssertEqual(position("4k3/8/8/8/8/8/8/R3K3 w - - 0 1").materialBalanceForSideToMove, 5)
        XCTAssertEqual(position("4k3/8/8/8/8/8/8/R3K3 b - - 0 1").materialBalanceForSideToMove, -5)
    }

    func testAnswersHandleThePromotionTap() {
        let up = ChessMove(uci: "a7a8q")!
        let rook = ChessMove(uci: "a7a8r")!
        XCTAssertEqual(ChessGoals.answers(for: [up]), ["a7a8q", "a7a8"])
        XCTAssertEqual(ChessGoals.answers(for: [up, rook]), ["a7a8q", "a7a8", "a7a8r"])
        XCTAssertNil(ChessGoals.answers(for: [rook]), "an under-promotion alone cannot be given by tapping two squares")
        XCTAssertEqual(ChessGoals.answers(for: [ChessMove(uci: "e2e4")!]), ["e2e4"])
    }
}
