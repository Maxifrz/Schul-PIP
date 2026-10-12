import XCTest
@testable import Lernwerk

final class SkillStoreTests: XCTestCase {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()
    private var defaults: UserDefaults!
    private let provider = SampleCourse()

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "SkillStoreTests-\(UUID().uuidString)")
    }

    private func now(_ day: Int) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 6, day: day, hour: 8))!
    }

    func testWhatWasRecordedIsThereAfterARestart() {
        let map = provider.skillMap()
        let skill = map.skills[0]
        let node = provider.course.nodes[0]
        let store = SkillStore(defaults: defaults)
        store.begin(node: node, map: map)
        let list = (0..<10).map { ExerciseOutcome(exerciseID: "e\($0)", skill: skill.id, level: $0 < 6 ? .recognise : .recall, right: true, helped: false) }
        store.record(outcomes: list, node: node, map: map, now: now(1), calendar: calendar)

        let restarted = SkillStore(defaults: defaults)
        XCTAssertEqual(restarted.records, store.records)
        XCTAssertEqual(SkillAssessor.status(restarted.records[skill.id], skill: skill, completed: [], now: now(1), calendar: calendar), .provisional)
        // And the review plan survives it: due the next day.
        XCTAssertEqual(SkillAssessor.status(restarted.records[skill.id], skill: skill, completed: [], now: now(2), calendar: calendar), .due)
    }

    func testBrokenDataStartsEmptyInsteadOfCrashing() {
        defaults.set(Data("not json".utf8), forKey: SkillStore.key)
        XCTAssertEqual(SkillStore(defaults: defaults).records.count, 0)
    }

    func testRecordsOfSkillsThatNoLongerExistAreHarmless() {
        var progress = SkillProgress()
        progress.records["gone.u01.main"] = SkillRecord()
        defaults.set(try! JSONEncoder().encode(progress), forKey: SkillStore.key)
        let store = SkillStore(defaults: defaults)
        let map = provider.skillMap()
        XCTAssertNil(map.skill("gone.u01.main"))
        store.record(outcomes: [], node: provider.course.nodes[0], map: map, now: now(1), calendar: calendar)
        XCTAssertNotNil(store.records["gone.u01.main"])
    }

    func testTheMapOfACourseIsBuiltOnce() {
        let first = SkillMaps.map(for: SpanishCourse.provider)
        let second = SkillMaps.map(for: SpanishCourse.provider)
        XCTAssertEqual(first, second)
        XCTAssertEqual(first.courseID, "es")
    }
}
