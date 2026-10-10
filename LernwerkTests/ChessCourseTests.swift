import XCTest
@testable import Lernwerk

/// The chess course. The rules engine is proved in ChessRulesTests; here the authored positions are proved legal and
/// right, and every exercise the course can build is re-checked by routes that do not share the generator's code.
final class ChessCourseTests: XCTestCase {
    // MARK: Helpers independent of the generator

    /// Legal moves by a second route: every pseudo-legal move is played, and it counts when the mover's own king is not
    /// attacked afterwards. The generator itself checks legality in place on one board.
    static func bruteLegal(_ position: ChessPosition) -> [ChessMove] {
        position.pseudoLegalMoves().filter { !position.applying($0).isInCheck(position.sideToMove) }
    }

    static func bruteMates(_ position: ChessPosition) -> [ChessMove] {
        bruteLegal(position).filter { move in
            let next = position.applying(move)
            return next.isInCheck(next.sideToMove) && bruteLegal(next).isEmpty
        }
    }

    static func bruteAttacked(_ square: ChessSquare, by color: ChessColor, in position: ChessPosition) -> Bool {
        position.with(sideToMove: color).pseudoLegalMoves().contains { move in
            move.to == square && position[move.from]?.kind != nil && !(position[move.from]?.kind == .pawn && move.from.file == move.to.file)
        }
    }

    func position(_ fen: String, file: StaticString = #filePath, line: UInt = #line) -> ChessPosition {
        guard let position = ChessPosition(fen: fen) else {
            XCTFail("FEN does not parse: \(fen)", file: file, line: line)
            return .start
        }
        return position
    }

    func sans(_ moves: [ChessMove], in position: ChessPosition) -> [String] {
        moves.compactMap { ChessNotation.san($0, in: position) }.sorted()
    }

    /// The exercises of every node of the course for the seeds 1 to 20, built once.
    struct Item {
        let node: CourseNode
        let seed: UInt64
        let exercise: LearnExercise
    }

    static let corpus: [Item] = {
        let provider = ChessCourse.provider
        var items: [Item] = []
        for node in provider.course.nodes where node.kind != .chest {
            for seed in UInt64(1)...20 {
                for exercise in provider.exercises(for: node, seed: seed) { items.append(Item(node: node, seed: seed, exercise: exercise)) }
            }
        }
        return items
    }()

    /// The corpus items whose exercise id starts with a topic prefix.
    func items(_ prefix: String) -> [Item] {
        Self.corpus.filter { $0.exercise.id.hasPrefix(prefix) }
    }

    func board(of exercise: LearnExercise) -> BoardSpec? {
        if case let .board(spec)? = exercise.media { return spec }
        return nil
    }

    func positionOf(_ exercise: LearnExercise, file: StaticString = #filePath, line: UInt = #line) -> ChessPosition {
        guard let spec = board(of: exercise) else {
            XCTFail("\(exercise.id) has no board", file: file, line: line)
            return .start
        }
        return position(spec.fen, file: file, line: line)
    }

    /// The squares named in a text, in order: "von g1 nach f3" gives g1 and f3.
    func squares(in text: String) -> [ChessSquare] {
        let characters = Array(text)
        var result: [ChessSquare] = []
        var index = 0
        while index + 1 < characters.count {
            if "abcdefgh".contains(characters[index]), "12345678".contains(characters[index + 1]),
               index == 0 || !characters[index - 1].isLetter, index + 2 >= characters.count || !characters[index + 2].isLetter && !characters[index + 2].isNumber,
               let square = ChessSquare(String(characters[index...index + 1])) {
                result.append(square)
                index += 2
            } else {
                index += 1
            }
        }
        return result
    }

    // MARK: The course

    func testCourseAudit() {
        XCTAssertEqual(CourseAudit.problems(of: ChessCourse.provider, seeds: Array(1...20)), [])
    }

    func testCourseStructure() {
        let course = ChessCourse.provider.course
        XCTAssertEqual(course.id, "chess")
        XCTAssertEqual(course.title, "Schach")
        XCTAssertEqual(course.subtitle, "Vom ersten Zug bis zum Matt")
        XCTAssertEqual(course.kind, .chess)
        XCTAssertEqual(course.color, 0xD17A9E)
        XCTAssertEqual(course.symbol, "crown.fill")
        XCTAssertEqual(course.units.count, 8)
        XCTAssertEqual(course.units.map(\.title), [
            "Das Brett", "Die Figuren und ihre Züge", "Der Bauer", "Schach und Matt", "Sonderzüge", "Werte und Tausch", "Matt in einem Zug", "Taktik-Grundlagen",
        ])
        for unit in course.units {
            XCTAssertEqual(unit.nodes.filter { $0.kind == .lesson }.count, 3, unit.id)
            XCTAssertEqual(unit.nodes.map(\.kind), [.lesson, .lesson, .lesson, .practice, .checkpoint, .chest], unit.id)
            XCTAssertFalse(unit.summary.isEmpty)
            let paragraphs = unit.tip.components(separatedBy: "\n\n")
            XCTAssertTrue((2...5).contains(paragraphs.count), "\(unit.id) tip has \(paragraphs.count) paragraphs")
        }
        XCTAssertEqual(course.sections.map { $0.units.count }, [3, 2, 3])
    }

    func testTipsTeachTheGermanTerms() {
        let tips = ChessCourse.provider.course.units.map(\.tip)
        let required: [(Int, [String])] = [
            (0, ["Linien", "Reihen", "Diagonalen", "e4", "a1"]),
            (1, ["Springer", "Läufer", "Turm", "Dame", "König", "Sf3"]),
            (2, ["Doppelschritt", "en passant", "Bauernumwandlung"]),
            (3, ["Schach", "Matt", "Patt", "Remis"]),
            (4, ["Rochade", "O-O-O", "Umwandlung", "en passant"]),
            (5, ["Bauer 1", "Springer 3", "Läufer 3", "Turm 5", "Dame 9"]),
            (6, ["Grundreihenmatt", "Erstickungsmatt", "Schäfermatt", "Leitermatt"]),
            (7, ["Gabel", "Fesselung", "Spieß", "Abzugsangriff"]),
        ]
        for (index, words) in required {
            for word in words { XCTAssertTrue(tips[index].contains(word), "unit \(index + 1) tip lacks \(word)") }
        }
        // Everything a student reads is German and plain: no emoji, no leftover markers.
        for item in Self.corpus where item.seed == 1 {
            let texts = [item.exercise.prompt, item.exercise.explanation, item.exercise.solution] + item.exercise.options
            for text in texts {
                XCTAssertFalse(text.unicodeScalars.contains { $0.value >= 0x1F300 && $0.value <= 0x1FAFF }, text)
                XCTAssertFalse(text.contains("TODO"), text)
            }
        }
    }

    func testNodesWithoutExercises() {
        let provider = ChessCourse.provider
        for node in provider.course.nodes where node.kind == .chest {
            XCTAssertEqual(provider.exercises(for: node, seed: 1), [])
        }
        let strange = CourseNode(id: "chess.u99.l1", courseID: "chess", unitID: "chess.u99", unitNumber: 99, kind: .lesson, index: 1, title: "x")
        XCTAssertEqual(provider.exercises(for: strange, seed: 1), [])
    }

    func testEveryNodeUsesSeveralKindsAndEveryUnitAllThree() {
        let provider = ChessCourse.provider
        for unit in provider.course.units {
            var unitKinds = Set<ExerciseKind>()
            for node in unit.nodes where node.kind != .chest {
                let kinds = Set(provider.exercises(for: node, seed: 1).map(\.kind))
                XCTAssertGreaterThanOrEqual(kinds.count, 2, node.id)
                unitKinds.formUnion(kinds)
            }
            XCTAssertGreaterThanOrEqual(unitKinds.count, 3, "\(unit.id) meets its items in too few forms: \(unitKinds)")
        }
    }

    func testNodeSizes() {
        let provider = ChessCourse.provider
        for node in provider.course.nodes where node.kind != .chest {
            let expected = node.kind == .checkpoint ? 14 : (node.kind == .practice ? 12 : 10)
            for seed in UInt64(1)...20 { XCTAssertEqual(provider.exercises(for: node, seed: seed).count, expected, "\(node.id) seed \(seed)") }
        }
    }

    func testSeedsGiveDifferentLessonsAndTheSameSeedTheSame() {
        let provider = ChessCourse.provider
        for node in provider.course.nodes where node.kind != .chest {
            let runs = (UInt64(1)...20).map { provider.exercises(for: node, seed: $0) }
            let distinct = Set(runs.map { $0.map(\.id).joined(separator: "|") })
            XCTAssertGreaterThanOrEqual(distinct.count, 12, "\(node.id) shows too few different lessons: \(distinct.count)")
            XCTAssertEqual(provider.exercises(for: node, seed: 7), provider.exercises(for: node, seed: 7))
        }
    }

    func testManyDistinctPositionsAreShown() {
        var fens = Set<String>()
        for item in Self.corpus {
            if let spec = board(of: item.exercise), spec.fen != ChessKit.emptyFEN { fens.insert(spec.fen.split(separator: " ").prefix(2).joined(separator: " ")) }
        }
        XCTAssertGreaterThanOrEqual(fens.count, 60, "only \(fens.count) distinct positions")
        let authored = Set(ChessSamples.all.map { $0.fen.split(separator: " ").prefix(2).joined(separator: " ") })
        XCTAssertGreaterThanOrEqual(authored.count, 150)
    }

    func testBuildingALessonIsFast() {
        let provider = ChessCourse.provider
        let nodes = provider.course.nodes.filter { $0.kind != .chest }
        let start = Date()
        // A seed no other test uses, so the cache of accepted moves is not yet warm for everything.
        for node in nodes { _ = provider.exercises(for: node, seed: 987_654) }
        let seconds = Date().timeIntervalSince(start)
        XCTAssertLessThan(seconds, 20, "building all \(nodes.count) nodes took \(seconds) s")
        let again = Date()
        for node in nodes { _ = provider.exercises(for: node, seed: 987_654) }
        XCTAssertLessThan(Date().timeIntervalSince(again), 5)
    }

    // MARK: Every exercise, whatever it asks

    func testEveryBoardIsASoundPosition() {
        for item in Self.corpus {
            guard let spec = board(of: item.exercise) else { continue }
            let position = position(spec.fen)
            XCTAssertEqual(spec.flipped, position.sideToMove == .black, "\(item.exercise.id): the board is turned towards the side to move")
            for name in spec.marked { XCTAssertNotNil(ChessSquare(name), "\(item.exercise.id): marked \(name)") }
            if spec.fen != ChessKit.emptyFEN {
                XCTAssertEqual(position.validationProblems(), [], "\(item.exercise.id) \(spec.fen)")
            }
        }
    }

    func testEveryMoveExerciseAcceptsOnlyLegalMovesAndTheSolutionNamesOne() {
        var count = 0
        for item in Self.corpus where item.exercise.kind == .chessMove {
            count += 1
            let position = positionOf(item.exercise)
            let legal = Set(Self.bruteLegal(position).map(\.uci))
            XCTAssertFalse(item.exercise.correctAnswers.isEmpty, item.exercise.id)
            for answer in item.exercise.correctAnswers {
                if answer.count == 5 {
                    XCTAssertTrue(legal.contains(answer), "\(item.exercise.id): \(answer) is not legal")
                } else {
                    // Four characters: a legal move, or a pawn move that promotes (taken as the queen).
                    XCTAssertTrue(legal.contains(answer) || legal.contains(answer + "q"), "\(item.exercise.id): \(answer) is not legal")
                }
            }
            XCTAssertFalse(item.exercise.solution.isEmpty)
            XCTAssertFalse(item.exercise.explanation.isEmpty, item.exercise.id)
            // The solution shows the notation of an accepted move.
            let first = item.exercise.solution.components(separatedBy: " oder ")[0].components(separatedBy: " (")[0]
            if first != "…", let move = ChessNotation.move(fromSAN: first, in: position) {
                XCTAssertTrue(item.exercise.correctAnswers.contains(move.uci) || item.exercise.correctAnswers.contains(move.from.name + move.to.name), item.exercise.id)
            } else if first != "…" {
                XCTFail("\(item.exercise.id): solution \(first) is no move")
            }
        }
        XCTAssertGreaterThan(count, 500)
    }

    func testPromptsAreShortAndEveryRuleExerciseExplainsItself() {
        for item in Self.corpus {
            XCTAssertLessThanOrEqual(item.exercise.prompt.count, 170, item.exercise.id)
            if item.exercise.kind != .matchPairs, item.exercise.kind != .wordBank {
                XCTAssertFalse(item.exercise.explanation.isEmpty, "\(item.exercise.id) has no explanation")
            }
        }
    }

    func testSamplesAreAllSoundAndUnique() {
        let all = ChessSamples.all
        XCTAssertEqual(Set(all.map(\.id)).count, all.count, "sample ids are not unique")
        for sample in all {
            guard let position = sample.position else {
                XCTFail("\(sample.id): FEN does not parse")
                continue
            }
            XCTAssertEqual(position.validationProblems(), [], sample.id)
            XCTAssertEqual(position.fen, sample.fen, "\(sample.id): FEN is not in the engine's own form")
            if let focus = sample.focus { XCTAssertNotNil(ChessSquare(focus), sample.id) }
            XCTAssertEqual(Self.bruteLegal(position).count, position.legalMoves().count, sample.id)
            if sample.theme.isEmpty { XCTFail("\(sample.id) has no theme") }
        }
    }
}
