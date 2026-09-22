import XCTest
@testable import Lernwerk

final class PlanSchedulerTests: XCTestCase {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    private let start = Date(timeIntervalSince1970: 1_800_000_000)

    private func draft(_ title: String, prerequisites: [String] = [], minutes: Int = 30) -> TopicDraft {
        TopicDraft(
            title: title,
            summary: "",
            prerequisites: prerequisites,
            materialIndex: 0,
            sourcePages: [1],
            estimatedMinutes: minutes
        )
    }

    private func day(_ offset: Int) -> Date {
        calendar.date(byAdding: .day, value: offset, to: calendar.startOfDay(for: start))!
    }

    func testPrerequisitesComeFirst() {
        let ordered = PlanScheduler.order([
            draft("B", prerequisites: ["A"]),
            draft("A"),
            draft("C", prerequisites: ["B"]),
        ])
        XCTAssertEqual(ordered.map(\.title), ["A", "B", "C"])
    }

    func testOriginalOrderIsKeptWithoutDependencies() {
        let ordered = PlanScheduler.order([draft("X"), draft("Y"), draft("Z")])
        XCTAssertEqual(ordered.map(\.title), ["X", "Y", "Z"])
    }

    func testPrerequisiteMatchingIgnoresCaseAndWhitespace() {
        let ordered = PlanScheduler.order([
            draft("Ableitung", prerequisites: ["  grenzwert "]),
            draft("Grenzwert"),
        ])
        XCTAssertEqual(ordered.map(\.title), ["Grenzwert", "Ableitung"])
    }

    func testCycleDoesNotDropTopics() {
        let ordered = PlanScheduler.order([
            draft("A", prerequisites: ["B"]),
            draft("B", prerequisites: ["A"]),
        ])
        XCTAssertEqual(Set(ordered.map(\.title)), ["A", "B"])
        XCTAssertEqual(ordered.count, 2)
    }

    func testUnknownPrerequisiteIsIgnored() {
        let ordered = PlanScheduler.order([draft("A", prerequisites: ["Gibt es nicht"])])
        XCTAssertEqual(ordered.map(\.title), ["A"])
    }

    func testAssignDatesPacksTopicsIntoDays() {
        let dates = PlanScheduler.assignDates(
            minutes: [20, 20, 30, 90, 10],
            start: start,
            minutesPerDay: 45,
            calendar: calendar
        )
        XCTAssertEqual(dates, [day(0), day(0), day(1), day(2), day(3)])
    }

    func testScheduleFlagsPlansThatReachTheExam() {
        let drafts = [draft("A", minutes: 45), draft("B", minutes: 45), draft("C", minutes: 45)]

        let tight = PlanScheduler.schedule(drafts, start: start, examDate: day(1), minutesPerDay: 45, calendar: calendar)
        XCTAssertTrue(tight.isOverbooked)

        let relaxed = PlanScheduler.schedule(drafts, start: start, examDate: day(10), minutesPerDay: 45, calendar: calendar)
        XCTAssertFalse(relaxed.isOverbooked)
        XCTAssertEqual(relaxed.topics.map(\.order), [0, 1, 2])
        XCTAssertEqual(relaxed.topics.map(\.date), [day(0), day(1), day(2)])
    }
}
