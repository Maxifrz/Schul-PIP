import XCTest
@testable import Lernwerk

final class LessonSessionTests: XCTestCase {
    private func exercise(_ kind: ExerciseKind, _ key: String, back: String = "Berlin") -> LearnExercise {
        LearnExercise(
            id: "\(kind.rawValue):\(key)", kind: kind, cardKeys: [key], prompt: "Frage \(key)", correctAnswers: [back],
            options: kind == .multipleChoice ? [back, "Paris", "Rom", "Madrid"] : [], pairs: [], solution: back
        )
    }

    private func pairs(_ keys: [String]) -> LearnExercise {
        let pairs = keys.map { LearnExercise.Pair(key: $0, front: "Frage \($0)", back: "Antwort \($0)") }
        return LearnExercise(
            id: "matchPairs:" + keys.joined(separator: "+"), kind: .matchPairs, cardKeys: keys, prompt: "Finde die Paare",
            correctAnswers: pairs.map(\.back), options: pairs.map(\.back), pairs: pairs, solution: ""
        )
    }

    private func session(_ exercises: [LearnExercise], cards: [String] = ["a", "b"]) -> LessonSession {
        LessonSession(lessonID: "L1", cardKeys: cards, exercises: exercises, sessionID: "s1")
    }

    func testAllRightFinishesWithFullAccuracy() {
        var lesson = session([exercise(.multipleChoice, "a"), exercise(.typeAnswer, "a"), exercise(.typeAnswer, "b")])
        XCTAssertEqual(lesson.progress, 0)
        XCTAssertEqual(lesson.submit(.option("Berlin")), .right)
        XCTAssertEqual(lesson.phase, .feedback(.right))
        XCTAssertEqual(lesson.progress, 1.0 / 3, accuracy: 0.0001)
        XCTAssertNil(lesson.result)
        lesson.advance()
        XCTAssertEqual(lesson.submit(.typed("berlin")), .right)
        lesson.advance()
        XCTAssertEqual(lesson.submit(.typed("Berlin")), .right)
        lesson.advance()
        XCTAssertEqual(lesson.phase, .finished)
        XCTAssertNil(lesson.current)
        XCTAssertEqual(lesson.progress, 1)
        let result = lesson.result
        XCTAssertEqual(result?.exerciseCount, 3)
        XCTAssertEqual(result?.rightFirstTry, 3)
        XCTAssertEqual(result?.rightOnRetry, 0)
        XCTAssertEqual(result?.accuracy, 1)
        XCTAssertEqual(result?.cardsRightFirstTry, ["a", "b"])
        XCTAssertEqual(result?.lessonID, "L1")
        XCTAssertEqual(result?.sessionID, "s1")
    }

    func testAWrongExerciseComesBackExactlyOnce() {
        var lesson = session([exercise(.multipleChoice, "a"), exercise(.typeAnswer, "b")])
        XCTAssertEqual(lesson.submit(.option("Paris")), .wrong)
        XCTAssertEqual(lesson.progress, 0)
        lesson.advance()
        XCTAssertEqual(lesson.queue.count, 3)
        XCTAssertFalse(lesson.isRetry)
        lesson.submit(.typed("Berlin"))
        lesson.advance()

        XCTAssertEqual(lesson.current?.id, "multipleChoice:a")
        XCTAssertTrue(lesson.isRetry)
        XCTAssertEqual(lesson.submit(.option("Rom")), .wrong)
        XCTAssertEqual(lesson.progress, 1)
        lesson.advance()
        XCTAssertEqual(lesson.queue.count, 3, "a second wrong answer does not queue it again")
        XCTAssertEqual(lesson.phase, .finished)
        XCTAssertEqual(lesson.result?.rightFirstTry, 1)
        XCTAssertEqual(lesson.result?.rightOnRetry, 0)
        XCTAssertEqual(lesson.result?.accuracy, 0.5)
        XCTAssertEqual(lesson.result?.cardsRightFirstTry, ["b"])
    }

    func testARightRetryCountsAsRetryNotAsFirstTry() {
        var lesson = session([exercise(.typeAnswer, "a")], cards: ["a"])
        lesson.submit(.typed("Paris"))
        lesson.advance()
        XCTAssertEqual(lesson.submit(.typed("Berlin")), .right)
        lesson.advance()
        XCTAssertEqual(lesson.result?.rightFirstTry, 0)
        XCTAssertEqual(lesson.result?.rightOnRetry, 1)
        XCTAssertEqual(lesson.result?.cardsRightFirstTry, [])
    }

    func testProgressNeverGoesBack() {
        var lesson = session([exercise(.multipleChoice, "a"), exercise(.multipleChoice, "b"), exercise(.typeAnswer, "a")])
        var last = lesson.progress
        let answers = ["Paris", "Berlin", "Rom", "Berlin"]
        var index = 0
        while lesson.phase != .finished {
            let answer = answers[min(index, answers.count - 1)]
            let current = lesson.current!
            lesson.submit(current.kind == .typeAnswer ? .typed(answer) : .option(answer))
            XCTAssertGreaterThanOrEqual(lesson.progress, last)
            last = lesson.progress
            lesson.advance()
            XCTAssertGreaterThanOrEqual(lesson.progress, last)
            index += 1
        }
        XCTAssertEqual(lesson.progress, 1)
    }

    func testOverruledTypingCountsAsRight() {
        var lesson = session([exercise(.typeAnswer, "a", back: "Die Photosynthese wandelt Licht in chemische Energie um")], cards: ["a"])
        XCTAssertEqual(lesson.submit(.typed("Licht wird zu Zucker")), .wrong)
        lesson.overrule()
        XCTAssertEqual(lesson.phase, .feedback(.right))
        lesson.advance()
        XCTAssertEqual(lesson.queue.count, 1, "an overruled answer does not come back")
        XCTAssertEqual(lesson.result?.rightFirstTry, 1)
        XCTAssertEqual(lesson.result?.cardsRightFirstTry, ["a"])
    }

    func testOnlyTypingCanBeOverruled() {
        var lesson = session([exercise(.multipleChoice, "a")], cards: ["a"])
        lesson.submit(.option("Paris"))
        lesson.overrule()
        XCTAssertEqual(lesson.phase, .feedback(.wrong))
    }

    func testASecondTapNeitherAnswersTwiceNorSkips() {
        var lesson = session([exercise(.typeAnswer, "a"), exercise(.typeAnswer, "b")])
        XCTAssertEqual(lesson.submit(.typed("Paris")), .wrong)
        XCTAssertNil(lesson.submit(.typed("Berlin")))
        XCTAssertEqual(lesson.phase, .feedback(.wrong))
        lesson.advance()
        lesson.advance()
        XCTAssertEqual(lesson.current?.id, "typeAnswer:b")
        XCTAssertEqual(lesson.queue.count, 3)
    }

    func testPairsMarkOnlyTheMissedCards() {
        var lesson = session([pairs(["a", "b", "c", "d"])], cards: ["a", "b", "c", "d"])
        XCTAssertEqual(lesson.submit(.pairs(missed: ["c", "x"])), .wrong)
        lesson.advance()
        lesson.submit(.pairs(missed: []))
        lesson.advance()
        XCTAssertEqual(lesson.result?.cardsRightFirstTry, ["a", "b", "d"])
    }

    func testACardWrongInAnyFirstTryIsWrong() {
        var lesson = session([exercise(.multipleChoice, "a"), exercise(.typeAnswer, "a")], cards: ["a"])
        lesson.submit(.option("Berlin"))
        lesson.advance()
        lesson.submit(.typed("Rom"))
        lesson.advance()
        lesson.submit(.typed("Berlin"))
        lesson.advance()
        XCTAssertEqual(lesson.result?.cardsRightFirstTry, [])
    }

    func testAnEmptyLessonIsFinishedAtOnce() {
        let lesson = session([])
        XCTAssertEqual(lesson.phase, .finished)
        XCTAssertEqual(lesson.progress, 1)
        XCTAssertEqual(lesson.result?.exerciseCount, 0)
        XCTAssertEqual(lesson.result?.accuracy, 0)
    }

    func testAFinishedLessonStaysFinished() {
        var lesson = session([exercise(.typeAnswer, "a")], cards: ["a"])
        lesson.submit(.typed("Berlin"))
        lesson.advance()
        let result = lesson.result
        XCTAssertNotNil(result)
        lesson.advance()
        XCTAssertNil(lesson.submit(.typed("Paris")))
        lesson.overrule()
        lesson.advance()
        XCTAssertEqual(lesson.phase, .finished)
        XCTAssertEqual(lesson.position, 1)
        XCTAssertEqual(lesson.result, result)
    }

    func testOverrulingTwiceCountsOnce() {
        var lesson = session([exercise(.typeAnswer, "a"), exercise(.typeAnswer, "b")])
        lesson.submit(.typed("Paris"))
        lesson.overrule()
        lesson.overrule()
        lesson.advance()
        lesson.overrule()
        lesson.submit(.typed("Rom"))
        lesson.advance()
        lesson.submit(.typed("Berlin"))
        lesson.advance()
        XCTAssertEqual(lesson.result?.rightFirstTry, 1)
        XCTAssertEqual(lesson.result?.rightOnRetry, 1)
        XCTAssertEqual(lesson.result?.cardsRightFirstTry, ["a"])
    }

    func testACardListedTwiceIsGradedOnce() {
        let result = LessonResult(
            lessonID: "L1", sessionID: "s1", exerciseCount: 2, rightFirstTry: 2, rightOnRetry: 0,
            cardKeys: ["a", "b", "a"], cardsRightFirstTry: ["a", "b"]
        )
        XCTAssertEqual(LessonGrading.gradesToApply(result, dueKeys: ["a", "b"]).map(\.key), ["a", "b"])
        let session = LessonSession(lessonID: "L1", cardKeys: ["a", "a", "b"], exercises: [exercise(.typeAnswer, "a")], sessionID: "s")
        XCTAssertEqual(session.cardKeys, ["a", "b"])
    }

    func testOnlyDueCardsAreGraded() {
        let result = LessonResult(
            lessonID: "L1", sessionID: "s1", exerciseCount: 6, rightFirstTry: 4, rightOnRetry: 1,
            cardKeys: ["a", "b", "c", "d"], cardsRightFirstTry: ["a", "c"]
        )
        let grades = LessonGrading.gradesToApply(result, dueKeys: ["a", "b", "x"])
        XCTAssertEqual(grades.map(\.key), ["a", "b"])
        XCTAssertEqual(grades.map(\.grade), [.good, .again])
        XCTAssertTrue(LessonGrading.gradesToApply(result, dueKeys: []).isEmpty)
    }

    func testABuiltLessonRunsToTheEnd() {
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let cards = ["Berlin", "Paris", "Rom", "Madrid", "Wien", "Prag"].enumerated().map { index, city in
            CardSnapshot(front: "Hauptstadt \(index)?", back: city, materialID: nil, createdAt: start.addingTimeInterval(Double(index)), dueDate: start)
        }
        let exercises = ExerciseBuilder(lesson: cards, deck: cards).build(seed: 3)
        var lesson = LessonSession(lessonID: LearnPath.lessonID(for: cards.map(\.key)), cardKeys: cards.map(\.key), exercises: exercises, sessionID: "s")
        var steps = 0
        while let current = lesson.current, steps < 100 {
            switch current.kind {
            case .multipleChoice: lesson.submit(.option(current.correctAnswers[0]))
            case .typeAnswer: lesson.submit(.typed(current.correctAnswers[0]))
            case .wordBank: lesson.submit(.words(current.correctAnswers))
            case .matchPairs: lesson.submit(.pairs(missed: []))
            case .chessMove: lesson.submit(.move(current.correctAnswers[0]))
            case .pianoKey: lesson.submit(.option(current.correctAnswers[0]))
            }
            lesson.advance()
            steps += 1
        }
        XCTAssertEqual(steps, exercises.count)
        XCTAssertEqual(lesson.result?.accuracy, 1)
        XCTAssertEqual(lesson.result?.cardsRightFirstTry, Set(cards.map(\.key)))
    }
}
