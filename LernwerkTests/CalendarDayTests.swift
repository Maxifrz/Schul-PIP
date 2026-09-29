import XCTest
@testable import Lernwerk

final class CalendarDayTests: XCTestCase {
    func testIsoParsingRoundTrips() {
        let day = CalendarDay(iso: "2026-05-14")
        XCTAssertEqual(day, CalendarDay(year: 2026, month: 5, day: 14))
        XCTAssertEqual(day?.iso, "2026-05-14")
        XCTAssertNil(CalendarDay(iso: "2026/05/14"))
        XCTAssertNil(CalendarDay(iso: "not-a-date"))
        XCTAssertNil(CalendarDay(iso: "2026-05"))
    }

    func testJulianDayNumberRoundTripsAcrossAWideRange() {
        var day = CalendarDay(year: 1970, month: 1, day: 1)
        for _ in 0..<5000 {
            let restored = CalendarDay(julianDayNumber: day.julianDayNumber)
            XCTAssertEqual(restored, day, "round trip failed for \(day)")
            day = day.adding(days: 37)
        }
    }

    func testKnownWeekdays() {
        // 2024-01-01 was a Monday; well documented and independently checkable.
        XCTAssertEqual(CalendarDay(year: 2024, month: 1, day: 1).weekday, 1)
        XCTAssertEqual(CalendarDay(year: 2024, month: 1, day: 7).weekday, 7)
        // Christi Himmelfahrt is mathematically always 39 days after Easter Sunday, always a Thursday.
        XCTAssertEqual(CalendarDay(iso: "2026-05-14")!.weekday, 4)
        XCTAssertTrue(CalendarDay(year: 2024, month: 1, day: 6).isWeekend)
        XCTAssertTrue(CalendarDay(year: 2024, month: 1, day: 7).isWeekend)
        XCTAssertFalse(CalendarDay(year: 2024, month: 1, day: 5).isWeekend)
    }

    func testAddingDaysCrossesMonthsYearsAndLeapDays() {
        XCTAssertEqual(CalendarDay(year: 2024, month: 2, day: 28).adding(days: 1), CalendarDay(year: 2024, month: 2, day: 29))
        XCTAssertEqual(CalendarDay(year: 2025, month: 2, day: 28).adding(days: 1), CalendarDay(year: 2025, month: 3, day: 1))
        XCTAssertEqual(CalendarDay(year: 2025, month: 12, day: 31).adding(days: 1), CalendarDay(year: 2026, month: 1, day: 1))
        XCTAssertEqual(CalendarDay(year: 2026, month: 1, day: 1).adding(days: -1), CalendarDay(year: 2025, month: 12, day: 31))
    }

    func testDaysSinceAndOrdering() {
        let a = CalendarDay(year: 2026, month: 1, day: 1)
        let b = CalendarDay(year: 2026, month: 3, day: 1)
        XCTAssertEqual(b.days(since: a), 59) // 2026 is not a leap year: 31 (Jan) + 28 (Feb)
        XCTAssertEqual(a.days(since: b), -59)
        XCTAssertTrue(a < b)
        XCTAssertEqual([b, a].sorted(), [a, b])
    }

    func testCodableUsesIsoStrings() throws {
        struct Wrapper: Codable, Equatable { var day: CalendarDay }
        let wrapper = Wrapper(day: CalendarDay(year: 2026, month: 5, day: 14))
        let data = try JSONEncoder().encode(wrapper)
        XCTAssertEqual(String(decoding: data, as: UTF8.self), #"{"day":"2026-05-14"}"#)
        XCTAssertEqual(try JSONDecoder().decode(Wrapper.self, from: data), wrapper)
        XCTAssertThrowsError(try JSONDecoder().decode(Wrapper.self, from: Data(#"{"day":"14.05.2026"}"#.utf8)))
    }

    func testLabels() {
        let day = CalendarDay(year: 2026, month: 5, day: 14)
        XCTAssertEqual(day.germanLabel, "Do. 14. Mai")
        XCTAssertEqual(day.shortLabel, "14.05.2026")
        XCTAssertEqual(CalendarDay(year: 2026, month: 1, day: 6).germanLabel, "Di. 6. Januar")
    }

    func testTodayUsesTheGivenCalendarsTimeZone() {
        var berlin = Calendar(identifier: .gregorian)
        berlin.timeZone = TimeZone(identifier: "Europe/Berlin")!
        let today = CalendarDay.today(berlin)
        let components = berlin.dateComponents([.year, .month, .day], from: Date())
        XCTAssertEqual(today, CalendarDay(year: components.year!, month: components.month!, day: components.day!))
    }
}
