import XCTest
@testable import Lernwerk

final class LessonModelTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 1_800_000_000)

    private func card(_ key: String, _ back: String) -> CardSnapshot {
        CardSnapshot(key: key, front: "Frage \(key)", back: back, materialID: nil, createdAt: start, dueDate: start)
    }

    private func typing(_ key: String, _ back: String) -> LearnExercise {
        LearnExercise(id: "typeAnswer:\(key)", kind: .typeAnswer, cardKeys: [key], prompt: "Frage \(key)", correctAnswers: [back], options: [], pairs: [], solution: back)
    }

    func testTheResultIsHandedOutOnce() {
        let model = LessonModel(cards: [card("a", "Berlin")], exercises: [typing("a", "Berlin")], sessionID: "run")
        XCTAssertNil(model.takeResult())
        XCTAssertFalse(model.canCheck)
        model.typed = "  "
        XCTAssertFalse(model.canCheck)
        model.typed = "Berlin"
        XCTAssertEqual(model.check(), .right)
        XCTAssertNil(model.check(), "a second tap on Prüfen does nothing")
        model.advance()
        model.advance()
        XCTAssertEqual(model.typed, "")
        let result = model.takeResult()
        XCTAssertEqual(result?.sessionID, "run")
        XCTAssertEqual(result?.lessonID, LearnPath.lessonID(for: ["a"]))
        XCTAssertEqual(result?.rightFirstTry, 1)
        XCTAssertNil(model.takeResult())
    }

    func testAnEmptyLessonIsHandedOutOnceAndCountsNothing() {
        let model = LessonModel(cards: [], exercises: [], sessionID: "empty")
        let result = model.takeResult()
        XCTAssertEqual(result?.exerciseCount, 0)
        XCTAssertNil(model.takeResult())
        var progress = LearnProgress()
        XCTAssertNil(progress.record(result!, now: start, calendar: Calendar(identifier: .gregorian)))
    }

    func testPairsCountAMissAndFinishOnTheLastMatch() {
        let keys = ["a", "b", "c", "d"]
        let pairs = keys.map { LearnExercise.Pair(key: $0, front: "Frage \($0)", back: "Antwort \($0)") }
        let exercise = LearnExercise(
            id: "matchPairs:a+b+c+d", kind: .matchPairs, cardKeys: keys, prompt: "Finde die Paare",
            correctAnswers: pairs.map(\.back), options: pairs.map(\.back).reversed(), pairs: pairs, solution: ""
        )
        let model = LessonModel(cards: keys.map { card($0, "Antwort \($0)") }, exercises: [exercise], sessionID: "pairs")
        XCTAssertFalse(model.canCheck)
        // options: d, c, b, a
        XCTAssertNil(model.pickFront("a"))
        XCTAssertEqual(model.pickBack(0), .miss)
        XCTAssertEqual(model.lastMiss, LessonModel.PairMiss(key: "a", back: 0))
        XCTAssertEqual(model.pickBack(3), nil)
        XCTAssertEqual(model.pickFront("a"), .match)
        XCTAssertNil(model.pickFront("a"), "a matched card cannot be picked again")
        XCTAssertNil(model.pickBack(3))
        XCTAssertEqual(model.pickFront("b"), nil)
        XCTAssertEqual(model.pickBack(2), .match)
        XCTAssertNil(model.pickFront("c"))
        XCTAssertEqual(model.pickBack(1), .match)
        XCTAssertNil(model.pickBack(0))
        XCTAssertEqual(model.pickFront("d"), .finished(.wrong))
        XCTAssertEqual(model.verdict, .wrong)
        XCTAssertNil(model.pickFront("d"))
        model.advance()
        // The round comes back once; without a miss it is right.
        XCTAssertTrue(model.matched.isEmpty)
        for (index, key) in ["d", "c", "b", "a"].enumerated() {
            _ = model.pickFront(key)
            _ = model.pickBack(index)
        }
        XCTAssertEqual(model.verdict, .right)
        model.advance()
        let result = model.takeResult()
        XCTAssertEqual(result?.cardsRightFirstTry, ["b", "c", "d"])
        XCTAssertEqual(result?.rightOnRetry, 1)
    }

    func testWordBankTilesGoInAndOut() {
        let exercise = LearnExercise(
            id: "wordBank:a", kind: .wordBank, cardKeys: ["a"], prompt: "?", correctAnswers: ["Der", "Zellkern", "steuert"],
            options: ["steuert", "Zellwand", "Der", "Zellkern"], pairs: [], solution: "Der Zellkern steuert"
        )
        let model = LessonModel(cards: [card("a", "Der Zellkern steuert")], exercises: [exercise], sessionID: "bank")
        XCTAssertFalse(model.canCheck)
        model.addTile(2)
        model.addTile(1)
        model.addTile(2)
        XCTAssertEqual(model.tiles, [2, 1])
        model.removeTile(1)
        model.addTile(3)
        model.addTile(0)
        XCTAssertEqual(model.check(), .right)
        model.addTile(1)
        XCTAssertEqual(model.tiles, [2, 3, 0], "tiles are locked while the verdict shows")
    }
}
