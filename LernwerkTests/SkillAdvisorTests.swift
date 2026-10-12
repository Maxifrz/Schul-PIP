import XCTest
@testable import Lernwerk

final class SkillAdvisorTests: XCTestCase {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()
    private let provider = SampleCourse()

    private func date(_ day: Int) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 4, day: day, hour: 9))!
    }

    private var map: SkillMap { provider.skillMap() }

    private func outcomes(_ skill: Skill, _ prefix: String, recognise: Int, recall: Int, right: Bool = true) -> [ExerciseOutcome] {
        (0..<recognise).map { ExerciseOutcome(exerciseID: "\(prefix)r\($0)", skill: skill.id, level: .recognise, right: right, helped: false) }
            + (0..<recall).map { ExerciseOutcome(exerciseID: "\(prefix)t\($0)", skill: skill.id, level: .recall, right: right, helped: false) }
    }

    private func advice(_ records: [String: SkillRecord], completed: Set<String>, on day: Int) -> Recommendation {
        let units = CoursePath.units(of: provider.course, completed: completed)
        return SkillAdvisor.recommend(map: map, records: records, units: units, completed: completed, now: date(day), calendar: calendar)
    }

    func testAFreshCourseSuggestsItsFirstStep() {
        let result = advice([:], completed: [], on: 1)
        XCTAssertEqual(result.kind, .step)
        XCTAssertEqual(result.step?.id, "sample.u01.l1")
    }

    func testAReachedSkillThatIsDueIsSuggestedBeforeTheNextStep() {
        var records: [String: SkillRecord] = [:]
        let first = map.skills[0]
        SkillAssessor.record(outcomes: outcomes(first, "a", recognise: 6, recall: 4), node: provider.course.nodes[0], map: map, into: &records, now: date(1), calendar: calendar)
        let result = advice(records, completed: [provider.course.nodes[0].id], on: 2)
        XCTAssertEqual(result.kind, .review)
        XCTAssertEqual(result.skillIDs, [first.id])
        XCTAssertEqual(advice(records, completed: [provider.course.nodes[0].id], on: 1).kind, .step, "not due on the day it was reached")
    }

    func testAShakyPrerequisiteIsPractisedBeforeTheUnitThatBuildsOnIt() {
        var records: [String: SkillRecord] = [:]
        let first = map.skills[0]
        let unit = provider.course.units[0]
        var completed = Set<String>()
        for node in unit.nodes where node.kind != .chest {
            SkillAssessor.record(outcomes: outcomes(first, node.id, recognise: 4, recall: 2, right: false), node: node, map: map, into: &records, now: date(1), calendar: calendar)
            completed.insert(node.id)
        }
        let result = advice(records, completed: completed, on: 1)
        XCTAssertEqual(result.kind, .practice)
        XCTAssertEqual(result.skillIDs, [first.id])
        XCTAssertNotNil(result.step, "the path itself stays open")
    }

    func testAFinishedCourseWithNothingDueSaysSo() {
        let all = Set(provider.course.nodes.map(\.id))
        let result = advice([:], completed: all, on: 1)
        XCTAssertEqual(result.kind, .finished)
    }

    func testTheMostOverdueSkillComesFirstAndAtMostThreeAreNamed() {
        var records: [String: SkillRecord] = [:]
        for (index, skill) in map.skills.enumerated() {
            SkillAssessor.record(outcomes: outcomes(skill, "s\(index)", recognise: 6, recall: 4), node: nil, map: map, into: &records, now: date(1 + index), calendar: calendar)
        }
        let result = advice(records, completed: [], on: 9)
        XCTAssertEqual(result.kind, .review)
        XCTAssertEqual(result.skillIDs.first, map.skills[0].id)
        XCTAssertLessThanOrEqual(result.skillIDs.count, SkillAdvisor.mostSkillsPerRound)
    }

    // MARK: Practice rounds

    func testAPracticeRoundHoldsOnlyExercisesOfTheTargetsAndIsRepeatable() {
        let spanish = SpanishCourse.provider
        let spanishMap = spanish.skillMap()
        let target = "es.u01.vocab"
        let first = SkillPractice.exercises(provider: spanish, map: spanishMap, targets: [target], records: [:], seed: 5)
        XCTAssertFalse(first.isEmpty)
        XCTAssertLessThanOrEqual(first.count, SkillPractice.size)
        XCTAssertTrue(first.contains { $0.skill == target })
        XCTAssertEqual(Set(first.map(\.id)).count, first.count, "no exercise twice")
        XCTAssertEqual(first, SkillPractice.exercises(provider: spanish, map: spanishMap, targets: [target], records: [:], seed: 5))
        XCTAssertNotEqual(first.map(\.id), SkillPractice.exercises(provider: spanish, map: spanishMap, targets: [target], records: [:], seed: 6).map(\.id))
    }

    func testAWeakLevelIsAskedMoreOftenThanAStrongOne() {
        let spanish = SpanishCourse.provider
        let spanishMap = spanish.skillMap()
        let target = spanishMap.skill("es.u01.vocab")!
        var weakRecall = SkillRecord()
        weakRecall.tallies[CompetenceLevel.recall.rawValue] = SkillRecord.Tally(attempts: 8, right: 1, helped: 0, points: 2, recent: [false, false, false, true, false, false, false, false])
        weakRecall.tallies[CompetenceLevel.recognise.rawValue] = SkillRecord.Tally(attempts: 8, right: 8, helped: 0, points: 8, recent: Array(repeating: true, count: 8))
        var recall = 0
        var recognise = 0
        for seed in UInt64(1)...12 {
            for exercise in SkillPractice.exercises(provider: spanish, map: spanishMap, targets: [target.id], records: [target.id: weakRecall], seed: seed) where exercise.skill == target.id {
                if exercise.level == .recall { recall += 1 }
                if exercise.level == .recognise { recognise += 1 }
            }
        }
        let evenRecall = SkillPractice.weight(of: LearnExercise(id: "x", kind: .typeAnswer, cardKeys: [], prompt: "", correctAnswers: ["a"], options: [], pairs: [], solution: "a", skill: target.id, level: .recall), records: [target.id: weakRecall], map: spanishMap)
        let evenRecognise = SkillPractice.weight(of: LearnExercise(id: "y", kind: .multipleChoice, cardKeys: [], prompt: "", correctAnswers: ["a"], options: ["a", "b"], pairs: [], solution: "a", skill: target.id, level: .recognise), records: [target.id: weakRecall], map: spanishMap)
        XCTAssertGreaterThan(evenRecall, evenRecognise)
        XCTAssertGreaterThan(recall + recognise, 0)
    }

    func testAnUnknownTargetMakesNoRound() {
        XCTAssertEqual(SkillPractice.exercises(provider: SpanishCourse.provider, map: SpanishCourse.provider.skillMap(), targets: ["nope"], records: [:], seed: 1), [])
    }

    // MARK: Test out

    func testOnlyAnUntouchedFrontierUnitCanBeTestedOut() {
        let fresh = CoursePath.units(of: provider.course, completed: [])
        XCTAssertEqual(TestOut.candidate(in: fresh)?.unit.id, "sample.u01")
        let started = CoursePath.units(of: provider.course, completed: ["sample.u01.l1"])
        XCTAssertNil(TestOut.candidate(in: started))
        let firstDone = Set(provider.course.units[0].nodes.map(\.id))
        XCTAssertEqual(TestOut.candidate(in: CoursePath.units(of: provider.course, completed: firstDone))?.unit.id, "sample.u02")
        XCTAssertNil(TestOut.candidate(in: CoursePath.units(of: provider.course, completed: Set(provider.course.nodes.map(\.id)))))
    }

    func testPassingNeedsEnoughExercisesAndAccuracy() {
        func result(count: Int, right: Int) -> LessonResult {
            LessonResult(lessonID: "t", sessionID: "s", exerciseCount: count, rightFirstTry: right, rightOnRetry: 0, cardKeys: [], cardsRightFirstTry: [])
        }
        XCTAssertTrue(TestOut.passed(result(count: 14, right: 12)))
        XCTAssertFalse(TestOut.passed(result(count: 14, right: 11)))
        XCTAssertFalse(TestOut.passed(result(count: 5, right: 5)), "a short round proves nothing")
    }

    func testAPassMarksEverythingButTheChest() {
        let unit = provider.course.units[0]
        let nodes = TestOut.nodesToComplete(in: unit)
        let chests = Set(unit.nodes.filter { $0.kind == .chest }.map(\.id))
        XCTAssertFalse(chests.isEmpty)
        XCTAssertTrue(chests.isDisjoint(with: nodes))
        XCTAssertEqual(nodes.count, unit.nodes.count - chests.count)
    }
}
