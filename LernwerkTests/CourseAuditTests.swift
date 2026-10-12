import XCTest
@testable import Lernwerk

final class CourseAuditTests: XCTestCase {
    private var random = LearnRandom(seed: 3)

    private func node(_ kind: NodeKind = .lesson) -> CourseNode {
        CourseNode(id: "t.u01.l1", courseID: "t", unitID: "t.u01", unitNumber: 1, kind: kind, index: 1, title: "x")
    }

    func testAWellFormedExerciseHasNoProblems() throws {
        let choice = try XCTUnwrap(Exercises.choice(id: "c", prompt: "Frage?", correct: "A", wrong: ["B", "C"], using: &random))
        XCTAssertEqual(CourseAudit.problems(in: choice), [])
        let typed = try XCTUnwrap(Exercises.typed(id: "t", prompt: "Frage?", answer: "3/4", mode: .number))
        XCTAssertEqual(CourseAudit.problems(in: typed), [])
        let move = try XCTUnwrap(Exercises.move(id: "m", prompt: "Zieh.", board: BoardSpec(fen: "8/8/8/8/8/8/8/8 w - - 0 1"), accepted: ["e2e4", "e7e8q"], solution: "e4"))
        XCTAssertEqual(CourseAudit.problems(in: move), [])
        let key = try XCTUnwrap(Exercises.key(id: "k", prompt: "Tippe C.", midi: [60], solution: "C4"))
        XCTAssertEqual(CourseAudit.problems(in: key), [])
    }

    func testBrokenExercisesAreFound() throws {
        let broken = LearnExercise(
            id: "b", kind: .multipleChoice, cardKeys: [], prompt: " ", correctAnswers: ["A"], options: ["A", "a", "B", "C", "D"],
            pairs: [], solution: ""
        )
        let found = CourseAudit.problems(in: broken)
        XCTAssertTrue(found.contains("empty prompt"))
        XCTAssertTrue(found.contains("empty solution"))
        XCTAssertTrue(found.contains("5 options"))
        XCTAssertTrue(found.contains("options that read the same"))

        let wrongMove = LearnExercise(
            id: "m", kind: .chessMove, cardKeys: [], prompt: "?", correctAnswers: ["e2-e4", "z9a1"], options: [], pairs: [],
            solution: "s", media: nil
        )
        let moveProblems = CourseAudit.problems(in: wrongMove)
        XCTAssertTrue(moveProblems.contains("a chess move without a board"))

        let badKey = LearnExercise(id: "k", kind: .pianoKey, cardKeys: [], prompt: "?", correctAnswers: ["C4", "200"], options: [], pairs: [], solution: "s")
        XCTAssertEqual(CourseAudit.problems(in: badKey).filter { $0.contains("not a piano key") }.count, 2)

        let sorted = LearnExercise(id: "w", kind: .wordBank, cardKeys: [], prompt: "?", correctAnswers: ["a", "b"], options: ["a", "b", "c", "d", "e"], pairs: [], solution: "a b")
        let bank = CourseAudit.problems(in: sorted)
        XCTAssertTrue(bank.contains("tiles come in the right order"))
        XCTAssertTrue(bank.contains("too many extra tiles"))
    }

    func testLengthsOrderAndIdsOfALesson() throws {
        let easy = try XCTUnwrap(Exercises.choice(id: "easy", prompt: "?", correct: "A", wrong: ["B"], using: &random))
        let hard = try XCTUnwrap(Exercises.typed(id: "hard", prompt: "?", answer: "A"))
        let tooShort = CourseAudit.problems(in: [easy, hard], node: node())
        XCTAssertTrue(tooShort.contains { $0.contains("2 exercises, expected 8 to 12") })
        let backwards = CourseAudit.problems(in: [hard, easy, easy], node: node())
        XCTAssertTrue(backwards.contains { $0.contains("easy to hard") })
        XCTAssertTrue(backwards.contains { $0.contains("not unique") })
        let ten = (0..<10).compactMap { Exercises.typed(id: "t\($0)", prompt: "?", answer: "A") }
        XCTAssertEqual(CourseAudit.problems(in: ten, node: node()), [])
        XCTAssertEqual(CourseAudit.problems(in: ten, node: node(.checkpoint)), [])
        XCTAssertFalse(CourseAudit.problems(in: Array(ten.prefix(9)), node: node(.checkpoint)).isEmpty, "a checkpoint has at least ten")
    }

    func testAProviderIsRunThroughEveryNode() {
        struct Lazy: CourseProvider {
            var course: Course { SampleCourse().course }
            func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] { [] }
        }
        let problems = CourseAudit.problems(of: Lazy(), seeds: [1])
        XCTAssertTrue(problems.contains { $0.contains("sample.u01.l1: 0 exercises") })
        XCTAssertFalse(problems.contains { $0.contains(".k:") }, "chests have no exercises")
    }
}
