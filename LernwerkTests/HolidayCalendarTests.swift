import XCTest
@testable import Lernwerk

final class HolidayCalendarTests: XCTestCase {
    /// The states the bundled JSON actually ships, decoded independently of `HolidayCalendar` so a mismatch in
    /// `Bundesland`'s cases (one added, renamed or removed on either side) fails loudly instead of just reading
    /// as "no data for that state".
    private struct RawBundle: Decodable { var states: [RawState] }
    private struct RawState: Decodable { var code: String }

    func testBundeslandCasesMatchTheBundledStates() throws {
        let raw = try JSONDecoder().decode(RawBundle.self, from: Data(HolidayData.json.utf8))
        let bundled = Set(raw.states.map(\.code))
        let cases = Set(Bundesland.allCases.map(\.rawValue))
        XCTAssertEqual(bundled, cases)
        XCTAssertEqual(bundled.count, 16)
    }

    func testEveryStateHasHolidaysCoveringSeveralYears() {
        for state in Bundesland.allCases {
            let school = HolidayCalendar.schoolHolidays(for: state)
            XCTAssertGreaterThan(school.count, 20, "\(state.rawValue) has too few school holidays bundled")
            XCTAssertEqual(school, school.sorted { $0.start < $1.start })
            for holiday in school {
                XCTAssertLessThanOrEqual(holiday.start, holiday.end, "\(holiday.name) in \(state.rawValue) ends before it starts")
            }

            let years = Set(school.map(\.start.year))
            XCTAssertGreaterThanOrEqual(years.count, 4, "\(state.rawValue) should cover several years")
        }
    }

    func testPublicHolidaysIncludeNationwideOnesEverywhere() {
        let nationwide = HolidayCalendar.publicHolidays(for: .bw).filter { $0.name == "Neujahr" }
        XCTAssertFalse(nationwide.isEmpty)
        for state in Bundesland.allCases {
            let names = Set(HolidayCalendar.publicHolidays(for: state).map(\.name))
            XCTAssertTrue(names.contains("Neujahr"), "\(state.rawValue) is missing Neujahr")
            XCTAssertTrue(names.contains("Tag der Arbeit"), "\(state.rawValue) is missing Tag der Arbeit")
        }
        XCTAssertEqual(HolidayCalendar.publicHolidays(for: .bw), HolidayCalendar.publicHolidays(for: .bw).sorted { $0.date < $1.date })
    }

    func testIsSchoolDayComposesWeekendsHolidaysAndFerien() {
        let state = Bundesland.by
        // Every Saturday and Sunday in a school holiday's range is already excluded by isWeekend; check both
        // reasons hold on their own too.
        guard let holiday = HolidayCalendar.schoolHolidays(for: state).first(where: { $0.end.days(since: $0.start) >= 2 }) else {
            return XCTFail("expected at least one multi-day school holiday")
        }
        var day = holiday.start
        while day <= holiday.end {
            XCTAssertFalse(HolidayCalendar.isSchoolDay(day, in: state), "\(day) is inside \(holiday.name), should not be a school day")
            day = day.adding(days: 1)
        }
        guard let feiertag = HolidayCalendar.publicHolidays(for: state).first(where: { !$0.date.isWeekend && !HolidayCalendar.isSchoolHoliday($0.date, in: state) }) else {
            return XCTFail("expected a public holiday outside the school holidays")
        }
        XCTAssertFalse(HolidayCalendar.isSchoolDay(feiertag.date, in: state))
        // A Saturday is never a school day, holiday or not.
        var saturday = CalendarDay.today()
        while saturday.weekday != 6 { saturday = saturday.adding(days: 1) }
        XCTAssertFalse(HolidayCalendar.isSchoolDay(saturday, in: state))
    }

    func testCurrentAndNextSchoolHoliday() {
        let state = Bundesland.by
        let holidays = HolidayCalendar.schoolHolidays(for: state)
        guard let holiday = holidays.first(where: { $0.end.days(since: $0.start) >= 1 }) else {
            return XCTFail("need a multi-day holiday")
        }
        XCTAssertEqual(HolidayCalendar.currentSchoolHoliday(on: holiday.start, in: state), holiday)
        XCTAssertEqual(HolidayCalendar.currentSchoolHoliday(on: holiday.end, in: state), holiday)
        XCTAssertEqual(HolidayCalendar.nextSchoolHoliday(from: holiday.start, in: state), holiday)

        let dayBefore = holiday.start.adding(days: -1)
        if HolidayCalendar.currentSchoolHoliday(on: dayBefore, in: state) == nil {
            XCTAssertEqual(HolidayCalendar.nextSchoolHoliday(from: dayBefore, in: state), holiday)
        }
        // Long after the bundled data ends, there is nothing more to find.
        XCTAssertNil(HolidayCalendar.nextSchoolHoliday(from: CalendarDay(year: 2099, month: 1, day: 1), in: state))
    }

    func testNextPublicHoliday() {
        let state = Bundesland.by
        guard let holiday = HolidayCalendar.publicHolidays(for: state).first(where: { $0.date > CalendarDay(year: 2020, month: 1, day: 1) }) else {
            return XCTFail("expected public holidays after 2020")
        }
        XCTAssertEqual(HolidayCalendar.nextPublicHoliday(from: holiday.date, in: state), holiday)
        let dayBefore = holiday.date.adding(days: -1)
        if !HolidayCalendar.isPublicHoliday(dayBefore, in: state) {
            XCTAssertEqual(HolidayCalendar.nextPublicHoliday(from: dayBefore, in: state)?.date, holiday.date)
        }
    }

    func testSchoolDaysCountsOnlyRealSchoolDays() {
        let state = Bundesland.by
        guard let holiday = HolidayCalendar.schoolHolidays(for: state).first(where: { $0.end.days(since: $0.start) >= 6 }) else {
            return XCTFail("need a holiday spanning at least a week")
        }
        // No day inside a week-plus holiday is a school day.
        XCTAssertEqual(HolidayCalendar.schoolDays(from: holiday.start, through: holiday.end, in: state), 0)
        // A reversed range counts nothing rather than crashing or going negative.
        XCTAssertEqual(HolidayCalendar.schoolDays(from: holiday.end, through: holiday.start, in: state), 0)
        // A single school day counts as exactly one.
        var probe = holiday.end.adding(days: 1)
        while !HolidayCalendar.isSchoolDay(probe, in: state) { probe = probe.adding(days: 1) }
        XCTAssertEqual(HolidayCalendar.schoolDays(from: probe, through: probe, in: state), 1)
    }

    func testSchoolDaysIsAdditiveAcrossASplitRange() {
        let state = Bundesland.th
        let start = CalendarDay(year: 2026, month: 3, day: 1)
        let end = CalendarDay(year: 2026, month: 7, day: 1)
        let split = CalendarDay(year: 2026, month: 5, day: 1)
        let whole = HolidayCalendar.schoolDays(from: start, through: end, in: state)
        let firstHalf = HolidayCalendar.schoolDays(from: start, through: split, in: state)
        let secondHalf = HolidayCalendar.schoolDays(from: split.adding(days: 1), through: end, in: state)
        XCTAssertEqual(whole, firstHalf + secondHalf)
    }

    func testSchoolDaysOverAnUndisturbedFullWeekIsFive() {
        let state = Bundesland.nw
        var monday = CalendarDay(year: 2027, month: 3, day: 1)
        while monday.weekday != 1 { monday = monday.adding(days: 1) }
        // Search forward for a Monday-to-Sunday week with no holidays or Ferien touching it at all.
        for _ in 0..<200 {
            let sunday = monday.adding(days: 6)
            let clean = !HolidayCalendar.schoolHolidays(for: state).contains { $0.start <= sunday && $0.end >= monday }
                && !HolidayCalendar.publicHolidays(for: state).contains { $0.date >= monday && $0.date <= sunday }
            if clean {
                XCTAssertEqual(HolidayCalendar.schoolDays(from: monday, through: sunday, in: state), 5)
                return
            }
            monday = monday.adding(days: 7)
        }
        XCTFail("could not find a clean week in the bundled range to test with")
    }
}
