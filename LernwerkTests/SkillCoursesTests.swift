import XCTest
@testable import Lernwerk

/// The skills of the shipped courses: the map is sound, every exercise belongs to a goal, and each goal can really be
/// reached by a student who does what it asks.
final class SkillCoursesTests: XCTestCase {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    private func date(_ day: Int) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 5, day: day, hour: 10))!
    }

    private var practising: [any CourseProvider] {
        [SpanishCourse.provider, FrenchCourse.provider, LatinCourse.provider, GermanForeignCourse.provider, GermanSchoolCourse.provider, ChessCourse.provider]
    }

    private func steps(of provider: any CourseProvider) -> [CourseNode] {
        provider.course.nodes.filter { $0.kind != .chest }
    }

    func testEveryShippedCourseHasASoundSkillMap() {
        for provider in CourseCatalog.providers {
            let map = provider.skillMap()
            XCTAssertEqual(map.problems(), [], provider.course.id)
            for unit in provider.course.units {
                XCTAssertFalse(map.skills(inUnit: unit.id).isEmpty, "\(provider.course.id) \(unit.id) has no skill")
            }
        }
    }

    func testLanguageUnitsHaveTheirOwnGoalsWithPrerequisites() {
        let map = SpanishCourse.provider.skillMap()
        let first = map.skills(inUnit: "es.u01")
        XCTAssertTrue(first.contains { $0.facet == "vocab" })
        let sentences = first.first { $0.facet == "sentences" }
        XCTAssertEqual(sentences?.prerequisites, ["es.u01.vocab"])
        let second = map.skills.first { $0.id == "es.u02.vocab" }
        XCTAssertEqual(second?.prerequisites, ["es.u01.vocab"], "words of the next unit build on the words before")
    }

    func testChessSplitsKnowingFromDoingAtTheBoard() {
        let map = ChessCourse.provider.skillMap()
        XCTAssertEqual(map.skills.count, 16)
        let board = map.skill("chess.u08.board")
        XCTAssertEqual(board?.levels, [.apply])
        XCTAssertEqual(board?.prerequisites, ["chess.u08.know"])
        XCTAssertEqual(map.skill("chess.u02.know")?.prerequisites, ["chess.u01.know"])
    }

    func testEveryExerciseOfALanguageOrChessStepBelongsToADeclaredGoal() {
        for provider in practising {
            let map = provider.skillMap()
            for node in steps(of: provider) {
                for seed in UInt64(1)...2 {
                    for exercise in provider.lessonExercises(for: node, seed: seed) {
                        XCTAssertFalse(exercise.skill.isEmpty, "\(exercise.id) has no skill")
                        XCTAssertNotNil(exercise.level, exercise.id)
                        XCTAssertNotNil(map.skill(exercise.skill), "\(exercise.id) -> \(exercise.skill)")
                    }
                }
            }
        }
    }

    func testEveryLevelAGoalAsksForIsShownInItsSteps() {
        for provider in practising {
            let map = provider.skillMap()
            var seen: [String: Set<CompetenceLevel>] = [:]
            for node in steps(of: provider) {
                for seed in UInt64(1)...4 {
                    for exercise in provider.lessonExercises(for: node, seed: seed) {
                        if let level = exercise.level { seen[exercise.skill, default: []].insert(level) }
                    }
                }
            }
            for skill in map.skills {
                for level in skill.levels {
                    XCTAssertTrue(seen[skill.id]?.contains(level) ?? false, "\(skill.id) never asks at level \(level)")
                }
            }
        }
    }

    /// Plays every step of the course once, right on every first try, and records it.
    private func perfectDay(_ provider: any CourseProvider, day: Int, seed: UInt64, into records: inout [String: SkillRecord]) {
        let map = provider.skillMap()
        for node in steps(of: provider) {
            let list = provider.lessonExercises(for: node, seed: seed).compactMap { exercise -> ExerciseOutcome? in
                guard let level = exercise.level else { return nil }
                return ExerciseOutcome(exerciseID: exercise.id, skill: exercise.skill, level: level, right: true, helped: false)
            }
            SkillAssessor.record(outcomes: list, node: node, map: map, into: &records, now: date(day), calendar: calendar)
        }
    }

    func testAStudentWhoAnswersEverythingRightMastersEveryGoalWithinAFewDaysOfPath() {
        for provider in practising {
            let map = provider.skillMap()
            var records: [String: SkillRecord] = [:]
            perfectDay(provider, day: 1, seed: 1, into: &records)
            perfectDay(provider, day: 2, seed: 2, into: &records)
            // Goals the path alone gives too few answers for get the rounds the advice would suggest.
            for day in 2...5 {
                for skill in map.skills {
                    let status = SkillAssessor.status(records[skill.id], skill: skill, completed: [], now: date(day), calendar: calendar)
                    guard status != .mastered else { continue }
                    let round = SkillPractice.exercises(provider: provider, map: map, targets: [skill.id], records: records, seed: UInt64(day * 100))
                    let list = round.compactMap { exercise -> ExerciseOutcome? in
                        guard let level = exercise.level else { return nil }
                        return ExerciseOutcome(exerciseID: exercise.id, skill: exercise.skill, level: level, right: true, helped: false)
                    }
                    SkillAssessor.record(outcomes: list, node: nil, map: map, into: &records, now: date(day), calendar: calendar)
                }
            }
            for skill in map.skills {
                let status = SkillAssessor.status(records[skill.id], skill: skill, completed: [], now: date(5), calendar: calendar)
                XCTAssertTrue(status == .mastered, "\(skill.id) is \(status): \(SkillAssessor.missing(records[skill.id] ?? SkillRecord(), skill: skill))")
            }
        }
    }

    func testOneDayAloneNeverMastersAnything() {
        for provider in [SpanishCourse.provider, ChessCourse.provider] {
            let map = provider.skillMap()
            var records: [String: SkillRecord] = [:]
            perfectDay(provider, day: 1, seed: 1, into: &records)
            perfectDay(provider, day: 1, seed: 2, into: &records)
            for skill in map.skills {
                let status = SkillAssessor.status(records[skill.id], skill: skill, completed: [], now: date(1), calendar: calendar)
                XCTAssertNotEqual(status, .mastered, skill.id)
            }
        }
    }

    func testAStudentWhoOnlyChoosesNeverReachesTypedOrBoardGoals() {
        for provider in [SpanishCourse.provider, ChessCourse.provider] {
            let map = provider.skillMap()
            var records: [String: SkillRecord] = [:]
            for (index, seed) in [UInt64(1), 2, 3].enumerated() {
                for node in steps(of: provider) {
                    let list = provider.lessonExercises(for: node, seed: seed).compactMap { exercise -> ExerciseOutcome? in
                        guard let level = exercise.level else { return nil }
                        // Right where there is something to pick, wrong where something must be produced.
                        return ExerciseOutcome(exerciseID: exercise.id, skill: exercise.skill, level: level, right: level == .recognise, helped: false)
                    }
                    SkillAssessor.record(outcomes: list, node: node, map: map, into: &records, now: date(1 + index), calendar: calendar)
                }
            }
            for skill in map.skills where skill.levels.contains(where: { $0 > .recognise }) {
                let status = SkillAssessor.status(records[skill.id], skill: skill, completed: [], now: date(4), calendar: calendar)
                XCTAssertFalse(status.isReached, "\(skill.id) is \(status)")
            }
        }
    }

    func testGoalsStayUnreachedUntilWhatTheyBuildOnIsRecommendedFirst() {
        // A student who did unit 1 badly is told to practise it before unit 2.
        let provider = SpanishCourse.provider
        let map = provider.skillMap()
        var records: [String: SkillRecord] = [:]
        let unit = provider.course.units[0]
        var completed = Set<String>()
        for node in unit.nodes where node.kind != .chest {
            let list = provider.lessonExercises(for: node, seed: 1).compactMap { exercise -> ExerciseOutcome? in
                guard let level = exercise.level else { return nil }
                return ExerciseOutcome(exerciseID: exercise.id, skill: exercise.skill, level: level, right: exercise.id.hashValue % 2 == 0 && false, helped: false)
            }
            SkillAssessor.record(outcomes: list, node: node, map: map, into: &records, now: date(1), calendar: calendar)
            completed.insert(node.id)
        }
        let units = CoursePath.units(of: provider.course, completed: completed)
        let advice = SkillAdvisor.recommend(map: map, records: records, units: units, completed: completed, now: date(1), calendar: calendar)
        XCTAssertEqual(advice.kind, .practice)
        XCTAssertTrue(advice.skillIDs.allSatisfy { $0.hasPrefix("es.u01.") })
    }
}
