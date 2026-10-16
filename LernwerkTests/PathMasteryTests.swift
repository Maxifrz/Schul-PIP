import XCTest
@testable import Lernwerk

final class PathMasteryTests: XCTestCase {
    private let provider = SampleCourse()
    private var map: SkillMap { provider.skillMap() }

    private func steps(done: Set<String>) -> [PathStep] {
        CoursePath.units(of: provider.course, completed: done).flatMap(\.steps)
    }

    private func mastery(_ status: SkillStatus, for skill: String) -> PathMastery {
        PathMastery(map: map, statuses: [skill: status])
    }

    func testTheBannerCountsReachedGoalsOfItsUnit() {
        let unit = provider.course.units[0]
        let skill = map.skills(inUnit: unit.id)[0].id
        XCTAssertEqual(mastery(.practicing, for: skill).unit(unit), UnitMastery(reached: 0, total: 1, due: 0))
        XCTAssertEqual(mastery(.provisional, for: skill).unit(unit).text, "1 von 1 erreicht")
        XCTAssertEqual(mastery(.due, for: skill).unit(unit).text, "1 von 1 erreicht, 1 fällig")
        XCTAssertEqual(mastery(.mastered, for: skill).unit(provider.course.units[1]).text, "0 von 1 erreicht", "other units are not touched")
    }

    func testAFinishedStepSitsOnlyWhenEveryGoalItShowsIsReached() {
        let unit = provider.course.units[0]
        let skill = map.skills(inUnit: unit.id)[0].id
        let lesson = unit.nodes[0].id
        let step = steps(done: [lesson]).first { $0.node.id == lesson }!
        XCTAssertEqual(mastery(.worked, for: skill).node(step), .worked)
        XCTAssertEqual(mastery(.practicing, for: skill).node(step), .worked)
        XCTAssertEqual(mastery(.provisional, for: skill).node(step), .sits)
        XCTAssertEqual(mastery(.mastered, for: skill).node(step), .sits)
        XCTAssertEqual(mastery(.due, for: skill).node(step), .due, "a review that is due breaks the ring")
    }

    func testAnOpenOrLockedStepAndAChestSayNothing() {
        let unit = provider.course.units[0]
        let skill = map.skills(inUnit: unit.id)[0].id
        let all = mastery(.mastered, for: skill)
        let path = steps(done: [unit.nodes[0].id])
        XCTAssertEqual(all.node(path.first { $0.state == .open }!), .none)
        XCTAssertEqual(all.node(path.first { $0.state == .locked }!), .none)
        let chest = steps(done: Set(provider.course.nodes.map(\.id))).first { $0.node.kind == .chest }!
        XCTAssertEqual(all.node(chest), .none, "a chest shows evidence of no goal")
    }

    func testStatusesComeFromTheRecordsAndTheDay() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let now = Date(timeIntervalSince1970: 1_780_000_000)
        let fresh = PathMastery(map: map, records: [:], completed: [], now: now, calendar: calendar)
        XCTAssertTrue(fresh.statuses.values.allSatisfy { $0 == .notStarted })
        let worked = PathMastery(map: map, records: [:], completed: Set(provider.course.nodes.map(\.id)), now: now, calendar: calendar)
        XCTAssertTrue(worked.statuses.values.allSatisfy { $0 == .worked }, "finishing lessons alone never reaches a goal")
        XCTAssertEqual(worked.unit(provider.course.units[0]).reached, 0)
    }
}
