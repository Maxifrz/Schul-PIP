import XCTest
@testable import Lernwerk

final class ExerciseFactoryTests: XCTestCase {
    private var random = LearnRandom(seed: 7)

    func testChoiceKeepsTheRightAnswerOnceAndDropsLookalikes() throws {
        let exercise = try XCTUnwrap(Exercises.choice(
            id: "c", prompt: "Hauptstadt?", correct: "Berlin", wrong: ["berlin", "Paris", "Paris", "Rom", "Wien", "Madrid", " "],
            using: &random
        ))
        XCTAssertEqual(exercise.options.count, 4)
        XCTAssertEqual(exercise.options.filter { $0 == "Berlin" }.count, 1)
        XCTAssertEqual(Set(exercise.options).count, 4)
        XCTAssertEqual(exercise.correctAnswers, ["Berlin"])
        XCTAssertEqual(exercise.missedKeys(for: .option("Berlin")), [])
        XCTAssertEqual(exercise.missedKeys(for: .option("Paris")), ["c"])
        XCTAssertNil(Exercises.choice(id: "x", prompt: "?", correct: "A", wrong: ["a", " "], using: &random))
        let trueFalse = try XCTUnwrap(Exercises.choice(id: "tf", prompt: "Stimmt das?", correct: "Richtig", wrong: ["Falsch"], using: &random))
        XCTAssertEqual(trueFalse.options.count, 2)
    }

    func testTypedKeepsAlternatives() throws {
        let exercise = try XCTUnwrap(Exercises.typed(id: "t", key: "k1", prompt: "adiós", answer: "tschüss", alternatives: ["auf Wiedersehen"]))
        XCTAssertEqual(exercise.missedKeys(for: .typed("Tschuess")), [])
        XCTAssertEqual(exercise.missedKeys(for: .typed("auf wiedersehen")), [])
        XCTAssertEqual(exercise.missedKeys(for: .typed("hallo")), ["k1"])
        XCTAssertNil(Exercises.typed(id: "e", prompt: "?", answer: "  "))
    }

    func testExactAnswersForgiveOnlyCapitalsAccentsAndPunctuation() throws {
        let exercise = try XCTUnwrap(Exercises.typed(id: "x", key: "k", prompt: "?", answer: "¿Cómo te llamas?", mode: .exact))
        XCTAssertEqual(exercise.missedKeys(for: .typed("como te llamas")), [])
        XCTAssertEqual(exercise.missedKeys(for: .typed("CÓMO TE LLAMAS?")), [])
        XCTAssertEqual(exercise.missedKeys(for: .typed("te llamas cómo")), ["k"])
        XCTAssertEqual(exercise.missedKeys(for: .typed("como te llamar")), ["k"])
        XCTAssertEqual(exercise.missedKeys(for: .typed("  ")), ["k"])
        XCTAssertEqual(exercise.missedKeys(for: .typed("¿?")), ["k"])
    }

    func testBankTilesNeverComeInTheRightOrder() throws {
        for seed in UInt64(1)...30 {
            var rng = LearnRandom(seed: seed)
            let exercise = try XCTUnwrap(Exercises.bank(id: "b", prompt: "?", words: ["Me", "llamo", "Ana."], extra: ["casa", "perro", "gato"], using: &rng))
            XCTAssertNotEqual(Array(exercise.options.prefix(3)), ["Me", "llamo", "Ana."])
            XCTAssertEqual(exercise.options.count, 5, "two extra tiles at most")
            XCTAssertEqual(exercise.missedKeys(for: .words(["me", "Llamo", "Ana"])), [], "case and the full stop do not matter")
        }
        XCTAssertNil(Exercises.bank(id: "one", prompt: "?", words: ["Hola"], using: &random))
        XCTAssertEqual(Exercises.tiles(of: "Ich heiße Ana."), ["Ich", "heiße", "Ana."])
    }

    func testPairsNeedFourDistinctItems() throws {
        let items = [("a", "uno", "eins"), ("b", "dos", "zwei"), ("c", "tres", "drei"), ("d", "cuatro", "vier")]
            .map { (key: $0.0, front: $0.1, back: $0.2) }
        let exercise = try XCTUnwrap(Exercises.pairs(id: "p", items: items, using: &random))
        XCTAssertEqual(exercise.cardKeys.sorted(), ["a", "b", "c", "d"])
        XCTAssertEqual(exercise.missedKeys(for: .pairs(missed: ["b"])), ["b"])
        XCTAssertEqual(exercise.missedKeys(for: .pairs(missed: [])), [])
        XCTAssertNil(Exercises.pairs(id: "x", items: Array(items.prefix(3)), using: &random))
        var twins = items
        twins[1] = (key: "b", front: "dos", back: "Eins")
        XCTAssertNil(Exercises.pairs(id: "y", items: twins, using: &random))
    }

    func testChessAndPianoAnswers() throws {
        let board = BoardSpec(fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1")
        let move = try XCTUnwrap(Exercises.move(id: "m", prompt: "Matt in 1", board: board, accepted: ["a1a8"], solution: "Ta8#"))
        XCTAssertEqual(move.missedKeys(for: .move("a1a8")), [])
        XCTAssertEqual(move.missedKeys(for: .move("a1a7")), ["m"])
        XCTAssertEqual(move.missedKeys(for: .option("a1a8")), ["m"])
        XCTAssertEqual(move.media, .board(board))
        XCTAssertNil(Exercises.move(id: "n", prompt: "?", board: board, accepted: [], solution: ""))
        let key = try XCTUnwrap(Exercises.key(id: "k", prompt: "Tippe das C", midi: [60, 72], solution: "C"))
        XCTAssertEqual(key.missedKeys(for: .option("72")), [])
        XCTAssertEqual(key.missedKeys(for: .option("61")), ["k"])
    }

    func testArrangeSortsEasyFirstDropsDuplicatesAndCuts() throws {
        var rng = random
        let easy = try XCTUnwrap(Exercises.choice(id: "easy", prompt: "?", correct: "A", wrong: ["B"], using: &rng))
        let hard = try XCTUnwrap(Exercises.typed(id: "hard", prompt: "?", answer: "A"))
        let arranged = Exercises.arrange([hard, nil, easy, easy])
        XCTAssertEqual(arranged.map(\.id), ["easy", "hard"])
        let many = (0..<20).compactMap { Exercises.typed(id: "t\($0)", prompt: "?", answer: "A") }
        XCTAssertEqual(Exercises.arrange(many).count, ExerciseBuilder.maxExercises)
        XCTAssertEqual(Exercises.arrange(many).map(\.id), (0..<12).map { "t\($0)" })
    }

    func testSeedsDifferByNodeAndRepeatForTheSame() {
        let unit = CourseUnit.standard(courseID: "x", number: 1, title: "T", summary: "", tip: "t")
        let a = Exercises.seed(for: unit.nodes[0], base: 5)
        XCTAssertEqual(a, Exercises.seed(for: unit.nodes[0], base: 5))
        XCTAssertNotEqual(a, Exercises.seed(for: unit.nodes[1], base: 5))
        XCTAssertNotEqual(a, Exercises.seed(for: unit.nodes[0], base: 6))
    }

    func testNoCardsStillMeansWrongWhenWrong() throws {
        // The regression this guards: an exercise with no cards answered wrong must not count as right.
        var rng = random
        let exercise = try XCTUnwrap(Exercises.choice(id: "solo", prompt: "?", correct: "A", wrong: ["B", "C"], using: &rng))
        var session = LessonSession(lessonID: "x.u01.l1", cardKeys: [], exercises: [exercise], sessionID: "s")
        XCTAssertEqual(session.submit(.option("B")), .wrong)
        session.advance()
        XCTAssertEqual(session.queue.count, 2, "the wrong exercise comes back once")
        XCTAssertEqual(session.submit(.option("A")), .right)
        session.advance()
        XCTAssertEqual(session.result?.rightFirstTry, 0)
        XCTAssertEqual(session.result?.rightOnRetry, 1)
    }
}
