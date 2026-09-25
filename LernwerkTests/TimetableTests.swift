import XCTest
@testable import Lernwerk

final class TimetableTests: XCTestCase {
    private typealias Entry = TimetableLayout.Entry

    func testNonOverlappingEntriesEachTakeTheFullWidth() {
        let entries = [
            Entry(weekday: 1, start: 480, end: 525), // Monday 08:00–08:45
            Entry(weekday: 1, start: 525, end: 570), // Monday 08:45–09:30, touches but does not overlap
            Entry(weekday: 2, start: 480, end: 525), // Tuesday, different day entirely
        ]
        let placements = TimetableLayout.placements(for: entries)
        XCTAssertEqual(placements, [
            .init(index: 0, column: 0, columns: 1),
            .init(index: 1, column: 0, columns: 1),
            .init(index: 2, column: 0, columns: 1),
        ])
    }

    func testTwoOverlappingEntriesGetTwoColumns() {
        let entries = [
            Entry(weekday: 1, start: 480, end: 570), // 08:00–09:30
            Entry(weekday: 1, start: 500, end: 545), // 08:20–09:05, inside the first
        ]
        let placements = TimetableLayout.placements(for: entries).sorted { $0.index < $1.index }
        XCTAssertEqual(placements[0], .init(index: 0, column: 0, columns: 2))
        XCTAssertEqual(placements[1], .init(index: 1, column: 1, columns: 2))
    }

    func testAChainOfOverlapsNeverExceedsTheRealConcurrency() {
        // A: 0–10, B: 5–15, C: 12–20. A/B overlap, B/C overlap, A/C do not — never more than two at once.
        let entries = [
            Entry(weekday: 1, start: 0, end: 10),
            Entry(weekday: 1, start: 5, end: 15),
            Entry(weekday: 1, start: 12, end: 20),
        ]
        let placements = TimetableLayout.placements(for: entries).sorted { $0.index < $1.index }
        XCTAssertEqual(Set(placements.map(\.columns)), [2])
        XCTAssertEqual(placements[0].column, 0)
        XCTAssertEqual(placements[1].column, 1)
        // C reuses A's column, since A already ended by the time C starts.
        XCTAssertEqual(placements[2].column, 0)
    }

    func testThreeAtOnceNeedThreeColumns() {
        let entries = [
            Entry(weekday: 3, start: 480, end: 570),
            Entry(weekday: 3, start: 480, end: 570),
            Entry(weekday: 3, start: 480, end: 570),
        ]
        let placements = TimetableLayout.placements(for: entries)
        XCTAssertEqual(Set(placements.map(\.column)), [0, 1, 2])
        XCTAssertTrue(placements.allSatisfy { $0.columns == 3 })
    }

    func testDifferentWeekdaysDoNotInteract() {
        let entries = (1...5).map { Entry(weekday: $0, start: 480, end: 1000) }
        let placements = TimetableLayout.placements(for: entries)
        XCTAssertTrue(placements.allSatisfy { $0.column == 0 && $0.columns == 1 })
    }

    func testDayRangeRoundsToFullHoursAndHasAFallback() {
        XCTAssertEqual(TimetableLayout.dayRange(for: []).start, ClockTime.minutes(hour: 8, minute: 0))
        XCTAssertEqual(TimetableLayout.dayRange(for: []).end, ClockTime.minutes(hour: 16, minute: 0))
        let entries = [Entry(weekday: 1, start: 465, end: 530), Entry(weekday: 2, start: 800, end: 845)]
        let range = TimetableLayout.dayRange(for: entries)
        XCTAssertEqual(range.start, ClockTime.minutes(hour: 7, minute: 0))
        // The latest end, 14:05, is not a full hour, so it rounds up to 15:00.
        XCTAssertEqual(range.end, ClockTime.minutes(hour: 15, minute: 0))
    }

    func testClockTimeFormatting() {
        XCTAssertEqual(ClockTime.label(ClockTime.minutes(hour: 7, minute: 45)), "07:45")
        XCTAssertEqual(ClockTime.label(ClockTime.minutes(hour: 0, minute: 5)), "00:05")
        XCTAssertEqual(ClockTime.minutes(hour: 13, minute: 30), 810)
    }

    func testWeekdayLabels() {
        XCTAssertEqual(Weekday.monday.shortLabel, "Mo")
        XCTAssertEqual(Weekday.sunday.label, "Sonntag")
        XCTAssertTrue(Weekday.monday < Weekday.friday)
        XCTAssertEqual(Weekday.allCases.count, 7)
    }
}

final class ExamCountdownTests: XCTestCase {
    func testDaysLabel() {
        let today = CalendarDay(year: 2026, month: 5, day: 1)
        XCTAssertEqual(ExamCountdown.daysLabel(from: today, to: today), "heute")
        XCTAssertEqual(ExamCountdown.daysLabel(from: today, to: today.adding(days: 1)), "morgen")
        XCTAssertEqual(ExamCountdown.daysLabel(from: today, to: today.adding(days: -1)), "gestern")
        XCTAssertEqual(ExamCountdown.daysLabel(from: today, to: today.adding(days: 5)), "in 5 Tagen")
        XCTAssertEqual(ExamCountdown.daysLabel(from: today, to: today.adding(days: -5)), "vor 5 Tagen")
    }

    func testSchoolDaysLeftIsNilInThePast() {
        let today = CalendarDay(year: 2026, month: 5, day: 1)
        XCTAssertNil(ExamCountdown.schoolDaysLeft(from: today, to: today.adding(days: -1), in: .by))
        XCTAssertNil(ExamCountdown.schoolDaysLabel(from: today, to: today.adding(days: -1), in: .by))
    }

    func testSchoolDaysLeftForTodayIsZeroButLabelReadsHeute() {
        let today = CalendarDay(year: 2026, month: 5, day: 1)
        XCTAssertEqual(ExamCountdown.schoolDaysLeft(from: today, to: today, in: .by), 0)
        XCTAssertEqual(ExamCountdown.schoolDaysLabel(from: today, to: today, in: .by), "heute")
    }

    func testSchoolDaysLeftExcludesTheGivenDayFromTodayButIncludesTheExamDay() {
        let state = Bundesland.nw
        // Search for a clean Monday-to-Friday school week to pin exact numbers.
        var monday = CalendarDay(year: 2027, month: 3, day: 1)
        while monday.weekday != 1 { monday = monday.adding(days: 1) }
        for _ in 0..<200 {
            let friday = monday.adding(days: 4)
            let clean = !HolidayCalendar.schoolHolidays(for: state).contains { $0.start <= friday && $0.end >= monday }
                && !HolidayCalendar.publicHolidays(for: state).contains { $0.date >= monday && $0.date <= friday }
            if clean {
                XCTAssertEqual(ExamCountdown.schoolDaysLeft(from: monday, to: friday, in: state), 4)
                XCTAssertEqual(ExamCountdown.schoolDaysLabel(from: monday, to: friday, in: state), "noch 4 Schultage")
                XCTAssertEqual(ExamCountdown.schoolDaysLabel(from: monday, to: monday.adding(days: 1), in: state), "noch 1 Schultag")
                return
            }
            monday = monday.adding(days: 7)
        }
        XCTFail("could not find a clean week in the bundled range")
    }
}
