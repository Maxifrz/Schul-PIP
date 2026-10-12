import XCTest
@testable import Lernwerk

/// Hints, outcomes of a round, the chess coach and the advice on typed answers in a language.
final class SkillFeedbackTests: XCTestCase {
    private func exercise(_ id: String, skill: String = "c.u1.main", level: CompetenceLevel = .recognise, hints: [String] = []) -> LearnExercise {
        LearnExercise(
            id: id, kind: .multipleChoice, cardKeys: [], prompt: "?", correctAnswers: ["a"], options: ["a", "b"], pairs: [],
            solution: "a", skill: skill, level: level, hints: hints
        )
    }

    // MARK: Session

    func testHintsComeOneAtATimeAndStopAtTheLast() {
        var session = LessonSession(lessonID: "l", cardKeys: [], exercises: [exercise("e1", hints: ["eins", "zwei"])], sessionID: "s")
        XCTAssertTrue(session.hasMoreHints)
        XCTAssertEqual(session.showHint(), ["eins"])
        XCTAssertEqual(session.showHint(), ["eins", "zwei"])
        XCTAssertEqual(session.showHint(), ["eins", "zwei"])
        XCTAssertFalse(session.hasMoreHints)
        XCTAssertEqual(session.hintCount, 2)
    }

    func testAnExerciseWithoutHintsShowsNone() {
        var session = LessonSession(lessonID: "l", cardKeys: [], exercises: [exercise("e1")], sessionID: "s")
        XCTAssertFalse(session.hasMoreHints)
        XCTAssertEqual(session.showHint(), [])
    }

    func testTheOutcomeOfAnExerciseIsItsFirstAttemptAndRemembersHelp() {
        var session = LessonSession(
            lessonID: "l", cardKeys: [],
            exercises: [exercise("e1", hints: ["h"]), exercise("e2"), exercise("e3", skill: "")], sessionID: "s"
        )
        // e1: a hint, then wrong, then right on the retry.
        session.showHint()
        session.submit(.option("b"))
        session.advance()
        // e2: right at once.
        session.submit(.option("a"))
        session.advance()
        // e3 belongs to no skill.
        session.submit(.option("a"))
        session.advance()
        // The retry of e1.
        session.submit(.option("a"))
        session.advance()
        let result = session.result
        XCTAssertEqual(result?.outcomes.map(\.exerciseID), ["e1", "e2"])
        XCTAssertEqual(result?.outcomes[0], ExerciseOutcome(exerciseID: "e1", skill: "c.u1.main", level: .recognise, right: false, helped: true))
        XCTAssertEqual(result?.outcomes[1].right, true)
        XCTAssertEqual(result?.outcomes[1].helped, false)
    }

    func testARetryAnsweredWithAHintDoesNotChangeTheFirstOutcome() {
        var session = LessonSession(lessonID: "l", cardKeys: [], exercises: [exercise("e1", hints: ["h"])], sessionID: "s")
        session.submit(.option("b"))
        session.advance()
        session.showHint()
        session.submit(.option("a"))
        session.advance()
        XCTAssertEqual(session.result?.outcomes, [ExerciseOutcome(exerciseID: "e1", skill: "c.u1.main", level: .recognise, right: false, helped: false)])
    }

    func testOverrulingATypedAnswerMakesItsOutcomeRight() {
        let typed = LearnExercise(
            id: "t", kind: .typeAnswer, cardKeys: [], prompt: "?", correctAnswers: ["Haus"], options: [], pairs: [],
            solution: "Haus", skill: "c.u1.main", level: .recall
        )
        var session = LessonSession(lessonID: "l", cardKeys: [], exercises: [typed], sessionID: "s")
        session.submit(.typed("Hous"))
        session.overrule()
        session.advance()
        XCTAssertEqual(session.result?.outcomes.first?.right, true)
    }

    func testRoundsOfCardsHaveNoOutcomesAndKeepTheirBehaviour() {
        let plain = LearnExercise(id: "p", kind: .multipleChoice, cardKeys: ["k"], prompt: "?", correctAnswers: ["a"], options: ["a", "b"], pairs: [], solution: "a")
        var session = LessonSession(lessonID: "l", cardKeys: ["k"], exercises: [plain], sessionID: "s")
        session.submit(.option("a"))
        session.advance()
        XCTAssertEqual(session.result?.outcomes, [])
        XCTAssertEqual(session.result?.cardsRightFirstTry, ["k"])
    }

    // MARK: Chess

    private let start = ChessPosition(fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")!

    private func explain(_ move: String, goal: String = "moves", fen: String? = nil) -> String? {
        ChessCoach.explain(move: move, goal: goal, in: fen.flatMap(ChessPosition.init(fen:)) ?? start)
    }

    func testTheCoachSaysWhyAMoveIsNotAllowed() {
        XCTAssertEqual(explain("e4e5"), "Auf e4 steht keine Figur.")
        XCTAssertEqual(explain("e7e5"), "Auf e7 steht eine schwarze Figur, aber Weiß ist am Zug.")
        XCTAssertEqual(explain("g1g2"), "Auf g2 steht schon eine eigene Figur.")
        XCTAssertEqual(explain("a1a3"), "Der Weg von a1 nach a3 ist versperrt.")
        XCTAssertTrue(explain("e2e5")?.hasPrefix("Der Bauer kann nicht von e2 nach e5 ziehen.") ?? false)
    }

    func testTheCoachKnowsAPinAndACheck() {
        XCTAssertEqual(explain("e2d3", fen: "4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1"), "Nach diesem Zug stünde dein König im Schach. Das ist nicht erlaubt.")
        XCTAssertEqual(explain("a1a2", fen: "4r1k1/8/8/8/8/8/8/R3K3 w - - 0 1"), "Du stehst im Schach. Dieser Zug beendet das Schach nicht.")
    }

    func testTheCoachSaysWhatALegalButWrongMoveDoesNotDo() {
        let backRank = "6k1/5p1p/6p1/8/8/8/8/R3K3 w - - 0 1"
        XCTAssertTrue(explain("a1a8", goal: "mate", fen: backRank)?.contains("verteidigen") ?? false, "Ra8+ is check, but the king can go to g7")
        XCTAssertTrue(explain("a1a7", goal: "mate", fen: backRank)?.contains("kein Schach") ?? false)
        let knight = "4k3/8/2p5/3p4/5N2/8/8/4K3 w - - 0 1"
        XCTAssertTrue(explain("f4d5", goal: "capture", fen: knight)?.contains("zurückschlagen") ?? false)
        XCTAssertTrue(explain("f4h5", goal: "capture", fen: knight)?.contains("schlägt aber nichts") ?? false)
        XCTAssertEqual(explain("e2e4", goal: "moves"), "Der Zug ist erlaubt, aber er ist nicht der, nach dem gefragt ist.")
    }

    func testEveryMoveExerciseOfTheChessCourseHasHintsAndACoach() {
        let course = ChessCourse.provider
        var found = 0
        for node in course.course.nodes where node.kind != .chest {
            for exercise in course.lessonExercises(for: node, seed: 1) where exercise.kind == .chessMove {
                found += 1
                XCTAssertTrue((1...2).contains(exercise.hints.count), exercise.id)
                XCTAssertTrue(exercise.coach.hasPrefix(ChessCoach.prefix), exercise.id)
                XCTAssertTrue(exercise.hints.allSatisfy { !$0.isEmpty })
            }
        }
        XCTAssertGreaterThan(found, 20)
    }

    func testTheCoachAnswersEveryWrongMoveOfEveryMoveExercise() {
        let course = ChessCourse.provider
        for node in course.course.nodes where node.kind == .lesson {
            for exercise in course.lessonExercises(for: node, seed: 3) where exercise.kind == .chessMove {
                guard case let .board(spec)? = exercise.media, ChessPosition(fen: spec.fen) != nil else {
                    XCTFail("\(exercise.id) has no valid position")
                    continue
                }
                // A handful of wrong moves, from every square to a couple of others.
                var asked = 0
                for from in ChessSquare.all {
                    for to in [ChessSquare(file: (from.file + 1) % 8, rank: from.rank), ChessSquare(file: from.file, rank: (from.rank + 2) % 8)].compactMap({ $0 }) {
                        let uci = from.name + to.name
                        guard !exercise.correctAnswers.contains(uci), from != to else { continue }
                        let text = course.feedback(for: exercise, answer: .move(uci))
                        XCTAssertNotNil(text, "\(exercise.id) \(uci)")
                        asked += 1
                    }
                }
                XCTAssertGreaterThan(asked, 50)
            }
        }
    }

    func testAnAcceptedMoveNeverGetsAnExplanationOfWhyItFails() {
        let course = ChessCourse.provider
        for node in course.course.nodes where node.kind == .practice {
            for exercise in course.lessonExercises(for: node, seed: 2) where exercise.kind == .chessMove && exercise.coach == "chess:mate" {
                guard case let .board(spec)? = exercise.media, let position = ChessPosition(fen: spec.fen) else { continue }
                for answer in exercise.correctAnswers {
                    guard let move = ChessMove(uci: answer) else { continue }
                    XCTAssertTrue(position.applying(move).isCheckmate, "\(exercise.id) \(answer) is accepted but is no mate")
                }
            }
        }
    }

    // MARK: Language

    func testAdviceNamesTheKindOfSlip() {
        XCTAssertNil(LanguageAnswerAdvice.advice(given: "el hermano", expected: ["el hermano"]))
        XCTAssertNil(LanguageAnswerAdvice.advice(given: "El Hermano", expected: ["el hermano"]))
        XCTAssertTrue(LanguageAnswerAdvice.advice(given: "el hermana", expected: ["el hermano"])?.contains("Endung") ?? false)
        XCTAssertEqual(LanguageAnswerAdvice.advice(given: "hermano el", expected: ["el hermano"]), "Die Wörter stimmen, aber die Reihenfolge nicht.")
        XCTAssertEqual(LanguageAnswerAdvice.advice(given: "el", expected: ["el hermano"]), "Es fehlt mindestens ein Wort.")
        XCTAssertEqual(LanguageAnswerAdvice.advice(given: "el hermano grande", expected: ["el hermano"]), "Es sind zu viele Wörter.")
        XCTAssertTrue(LanguageAnswerAdvice.advice(given: "el libro", expected: ["el hermano"])?.contains("Ein Wort stimmt nicht") ?? false)
        XCTAssertNil(LanguageAnswerAdvice.advice(given: "la casa", expected: ["el hermano"]), "two words wrong: no sure advice")
        XCTAssertNil(LanguageAnswerAdvice.advice(given: "  ", expected: ["el hermano"]))
    }

    func testTheLanguageProviderGivesAdviceOnlyForStrictTypedAnswers() {
        let provider = LanguageCourseProvider.make(source: LanguageSample.source).provider
        let strict = Exercises.typed(id: "x", prompt: "?", answer: "el hermano", mode: .exact)!
        XCTAssertNotNil(provider.feedback(for: strict, answer: .typed("el hermana")))
        let loose = Exercises.typed(id: "y", prompt: "?", answer: "Haus", mode: .text)!
        XCTAssertNil(provider.feedback(for: loose, answer: .typed("Haus2")))
        XCTAssertNil(provider.feedback(for: strict, answer: .option("el hermana")))
    }

    func testTheTagsOfTheLanguageEngineSeparateRecognisingFromProducing() {
        let provider = LanguageCourseProvider.make(source: LanguageSample.source).provider
        func tag(_ id: String) -> SkillTag {
            let node = provider.course.nodes[0]
            return provider.skillTag(for: exercise(id), node: node)
        }
        XCTAssertEqual(tag("n#w1-0a"), SkillTag(facet: "vocab", level: .recognise))
        XCTAssertEqual(tag("n#w1-0c"), SkillTag(facet: "listening", level: .recognise))
        XCTAssertEqual(tag("n#w1-0d"), SkillTag(facet: "vocab", level: .recall))
        XCTAssertEqual(tag("n#s1-2b"), SkillTag(facet: "sentences", level: .apply))
        XCTAssertEqual(tag("n#s1-2e"), SkillTag(facet: "listening", level: .apply))
        XCTAssertEqual(tag("n#f1-0d"), SkillTag(facet: "grammar", level: .apply))
        XCTAssertEqual(tag("n#g1-0a"), SkillTag(facet: "grammar", level: .recognise))
        XCTAssertEqual(tag("n#p1"), SkillTag(facet: "vocab", level: .recognise))
    }

    func testAnExerciseWhoseGoalTheUnitDoesNotDeclareIsLeftUntagged() {
        struct Odd: CourseProvider {
            var course: Course { SampleCourse().course }
            func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] {
                [Exercises.typed(id: "\(node.id)#a", prompt: "?", answer: "x")!]
            }
            func skillTag(for exercise: LearnExercise, node: CourseNode) -> SkillTag { SkillTag(facet: "ghost", level: .recall) }
        }
        let list = Odd().lessonExercises(for: SampleCourse().course.nodes[0], seed: 1)
        XCTAssertEqual(list.first?.skill, "")
        XCTAssertNil(list.first?.level)
    }
}
