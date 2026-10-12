import XCTest
@testable import Lernwerk

final class SkillAssessorTests: XCTestCase {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()
    private let provider = SampleCourse()

    private func date(_ day: Int, hour: Int = 10) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 3, day: day, hour: hour))!
    }

    private var map: SkillMap { provider.skillMap() }
    private var skill: Skill { map.skills[0] }
    private var node: CourseNode { provider.course.nodes[0] }

    private func outcomes(_ prefix: String, _ count: Int, _ level: CompetenceLevel, right: Bool = true, helped: Bool = false) -> [ExerciseOutcome] {
        (0..<count).map { ExerciseOutcome(exerciseID: "\(prefix)\($0)", skill: skill.id, level: level, right: right, helped: helped) }
    }

    private func play(_ list: [ExerciseOutcome], on day: Int, into records: inout [String: SkillRecord]) {
        SkillAssessor.record(outcomes: list, node: node, map: map, into: &records, now: date(day), calendar: calendar)
    }

    private func status(_ records: [String: SkillRecord], on day: Int, completed: Set<String> = []) -> SkillStatus {
        SkillAssessor.status(records[skill.id], skill: skill, completed: completed, now: date(day), calendar: calendar)
    }

    func testTheDefaultMapHasOneSkillPerUnitAndChainsThem() {
        XCTAssertEqual(map.skills.count, 3)
        XCTAssertEqual(map.problems(), [])
        XCTAssertEqual(map.skills[0].prerequisites, [])
        XCTAssertEqual(map.skills[1].prerequisites, [map.skills[0].id])
        XCTAssertEqual(map.skills[2].prerequisites, [map.skills[1].id])
        XCTAssertEqual(map.dependents(of: map.skills[0].id).map(\.id), [map.skills[1].id])
    }

    func testAMapWithACycleOrAnUnknownPrerequisiteIsReported() {
        let a = Skill(id: "a", courseID: "c", unitID: "u", unitNumber: 1, unitTitle: "U", facet: "a", title: "A", goal: "", levels: [.recognise], prerequisites: ["b"], nodeIDs: ["n"])
        let b = Skill(id: "b", courseID: "c", unitID: "u", unitNumber: 1, unitTitle: "U", facet: "b", title: "B", goal: "", levels: [.recognise], prerequisites: ["a"], nodeIDs: ["n"])
        XCTAssertTrue(SkillMap(courseID: "c", skills: [a, b]).problems().contains { $0.contains("cycle") })
        let c = Skill(id: "c", courseID: "c", unitID: "u", unitNumber: 1, unitTitle: "U", facet: "c", title: "C", goal: "", levels: [.recognise], prerequisites: ["zzz"], nodeIDs: ["n"])
        XCTAssertTrue(SkillMap(courseID: "c", skills: [c]).problems().contains { $0.contains("unknown prerequisite") })
    }

    func testAnUntouchedSkillAndABegunLessonAreNotWorked() {
        var records: [String: SkillRecord] = [:]
        XCTAssertEqual(status(records, on: 1), .notStarted)
        SkillAssessor.begin(node: node, map: map, into: &records)
        XCTAssertEqual(status(records, on: 1), .started)
    }

    func testAFinishedLessonWithoutAnswersIsOnlyWorked() {
        var records: [String: SkillRecord] = [:]
        play([], on: 1, into: &records)
        XCTAssertEqual(status(records, on: 1), .worked)
        // A lesson finished before skills existed counts as worked, never as more.
        XCTAssertEqual(status([:], on: 1, completed: [node.id]), .worked)
    }

    func testClickingThroughChoicesNeverReachesASkillThatAsksForTyping() {
        var records: [String: SkillRecord] = [:]
        for round in 0..<6 { play(outcomes("r\(round)-", 12, .recognise), on: 1 + round, into: &records) }
        XCTAssertNotEqual(status(records, on: 8), .provisional)
        XCTAssertNotEqual(status(records, on: 8), .mastered)
        XCTAssertFalse(SkillAssessor.missing(records[skill.id]!, skill: skill).isEmpty)
        XCTAssertTrue(SkillAssessor.missing(records[skill.id]!, skill: skill).contains { $0.contains("getippt") })
    }

    func testOneRoundCannotAddMoreThanTheCap() {
        var records: [String: SkillRecord] = [:]
        play(outcomes("big", 40, .recall), on: 1, into: &records)
        XCTAssertLessThanOrEqual(records[skill.id]!.tally(.recall).points, SkillAssessor.pointsPerRound)
    }

    func testHintsHalveThePointsAndWrongAnswersGiveNone() {
        var records: [String: SkillRecord] = [:]
        play(outcomes("h", 4, .recall, helped: true) + outcomes("w", 4, .recall, right: false), on: 1, into: &records)
        XCTAssertEqual(records[skill.id]!.tally(.recall).points, 4, accuracy: 0.0001)
        XCTAssertEqual(records[skill.id]!.tally(.recall).right, 0, "an answer with a hint is not a clean first try")
        XCTAssertEqual(records[skill.id]!.tally(.recall).attempts, 8)
    }

    func testRecognisingAndTypingReachesProvisionallyAndAnotherDayMastersIt() {
        var records: [String: SkillRecord] = [:]
        play(outcomes("a", 6, .recognise) + outcomes("b", 4, .recall), on: 1, into: &records)
        XCTAssertEqual(status(records, on: 1), .provisional)
        XCTAssertEqual(SkillAssessor.missing(records[skill.id]!, skill: skill), ["Es fehlt noch eine gute Runde an einem anderen Tag."])
        // The next day the review is due; a good round confirms it.
        XCTAssertEqual(status(records, on: 2), .due)
        play(outcomes("c", 5, .recognise) + outcomes("d", 3, .recall), on: 2, into: &records)
        XCTAssertEqual(status(records, on: 2), .mastered)
        XCTAssertEqual(status(records, on: 5), .mastered)
        XCTAssertEqual(status(records, on: 9), .due, "six days later the review is due again")
    }

    func testASecondRoundOnTheSameDayDoesNotPushTheReviewAway() {
        var records: [String: SkillRecord] = [:]
        play(outcomes("a", 6, .recognise) + outcomes("b", 4, .recall), on: 1, into: &records)
        let after = records[skill.id]!
        play(outcomes("c", 6, .recognise) + outcomes("d", 4, .recall), on: 1, into: &records)
        XCTAssertEqual(records[skill.id]!.repetitions, after.repetitions)
        XCTAssertEqual(records[skill.id]!.dueDay, after.dueDay)
        XCTAssertEqual(records[skill.id]!.confirmations, 0)
    }

    func testABadRoundAfterMasteryTakesItAway() {
        var records: [String: SkillRecord] = [:]
        play(outcomes("a", 6, .recognise) + outcomes("b", 4, .recall), on: 1, into: &records)
        play(outcomes("c", 5, .recognise) + outcomes("d", 3, .recall), on: 2, into: &records)
        XCTAssertEqual(status(records, on: 3), .mastered)
        play(outcomes("e", 6, .recall, right: false), on: 9, into: &records)
        XCTAssertEqual(records[skill.id]!.lapses, 1)
        XCTAssertNil(records[skill.id]!.provisionalDay)
        XCTAssertEqual(status(records, on: 9), .practicing)
    }

    func testTheSameExerciseInOneRoundCountsOnce() {
        var records: [String: SkillRecord] = [:]
        let one = outcomes("x", 1, .recall)
        play(one + one + one, on: 1, into: &records)
        XCTAssertEqual(records[skill.id]!.attempts, 1)
    }

    func testOutcomesForUnknownSkillsAreIgnored() {
        var records: [String: SkillRecord] = [:]
        let stray = ExerciseOutcome(exerciseID: "s", skill: "nowhere.u1.main", level: .recall, right: true, helped: false)
        play([stray], on: 1, into: &records)
        XCTAssertNil(records["nowhere.u1.main"])
    }

    func testAMiddlingRoundNeitherConfirmsNorUndoes() {
        var records: [String: SkillRecord] = [:]
        play(outcomes("a", 6, .recognise) + outcomes("b", 4, .recall), on: 1, into: &records)
        // Seven of ten right on the next day: a "hard", which is no confirmation.
        play(outcomes("c", 7, .recall) + outcomes("d", 3, .recall, right: false), on: 2, into: &records)
        XCTAssertEqual(records[skill.id]!.confirmations, 0)
        XCTAssertNotNil(records[skill.id]!.provisionalDay)
    }

    func testRecordsSurviveEncodingAndTolerateMissingFields() throws {
        var records: [String: SkillRecord] = [:]
        play(outcomes("a", 6, .recognise) + outcomes("b", 4, .recall), on: 1, into: &records)
        let data = try JSONEncoder().encode(SkillProgress(records: records))
        XCTAssertEqual(try JSONDecoder().decode(SkillProgress.self, from: data).records, records)
        XCTAssertEqual(try JSONDecoder().decode(SkillRecord.self, from: Data("{}".utf8)), SkillRecord())
        XCTAssertEqual(try JSONDecoder().decode(SkillProgress.self, from: Data("{\"records\": 5}".utf8)).records.count, 0)
        let partial = try JSONDecoder().decode(SkillRecord.self, from: Data("{\"lapses\": 2}".utf8))
        XCTAssertEqual(partial.schedule.lapses, 0, "an old shape without a schedule falls back on the default")
        let scheduled = try JSONDecoder().decode(SkillRecord.self, from: Data("{\"schedule\": {\"lapses\": 2, \"ease\": 0.1}}".utf8))
        XCTAssertEqual(scheduled.schedule.lapses, 2)
        XCTAssertEqual(scheduled.schedule.ease, SchedulingState.minimumEase, accuracy: 0.0001)
    }

    func testWeakLevelsNameWhatToPractise() {
        var records: [String: SkillRecord] = [:]
        play(outcomes("a", 6, .recognise) + outcomes("b", 4, .recall, right: false), on: 1, into: &records)
        XCTAssertEqual(SkillAssessor.weakLevels(records[skill.id], skill: skill), [.recall])
        XCTAssertEqual(SkillAssessor.weakLevels(nil, skill: skill), [.recognise, .recall])
    }
}

private extension SkillProgress {
    init(records: [String: SkillRecord]) {
        self.init()
        self.records = records
    }
}
