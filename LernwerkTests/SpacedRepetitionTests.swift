import XCTest
@testable import Lernwerk

final class SpacedRepetitionTests: XCTestCase {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    func testSuccessfulReviewsGrowTheInterval() {
        var state = SchedulingState.new
        state = SpacedRepetition.next(state, grade: .good)
        XCTAssertEqual(state.intervalDays, 1)
        state = SpacedRepetition.next(state, grade: .good)
        XCTAssertEqual(state.intervalDays, 6)
        state = SpacedRepetition.next(state, grade: .good)
        XCTAssertEqual(state.intervalDays, 15)
        XCTAssertEqual(state.repetitions, 3)
        XCTAssertEqual(state.easeFactor, 2.5, accuracy: 0.0001)
    }

    func testAgainResetsProgressAndCountsALapse() {
        let learned = SchedulingState(intervalDays: 15, easeFactor: 2.5, repetitions: 3, lapses: 0)
        let state = SpacedRepetition.next(learned, grade: .again)
        XCTAssertEqual(state.repetitions, 0)
        XCTAssertEqual(state.intervalDays, 0)
        XCTAssertEqual(state.lapses, 1)
        XCTAssertEqual(state.easeFactor, 1.7, accuracy: 0.0001)
    }

    func testEaseNeverDropsBelowMinimum() {
        var state = SchedulingState.new
        for _ in 0..<10 {
            state = SpacedRepetition.next(state, grade: .again)
        }
        XCTAssertEqual(state.easeFactor, SchedulingState.minimumEase, accuracy: 0.0001)
    }

    func testHardLowersAndEasyRaisesEase() {
        XCTAssertEqual(SpacedRepetition.next(.new, grade: .hard).easeFactor, 2.36, accuracy: 0.0001)
        XCTAssertEqual(SpacedRepetition.next(.new, grade: .easy).easeFactor, 2.6, accuracy: 0.0001)
    }

    func testFailedCardComesBackAfterShortDelay() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let failed = SpacedRepetition.next(.new, grade: .again)
        let due = SpacedRepetition.dueDate(for: failed, reviewedAt: now, calendar: calendar)
        XCTAssertEqual(due.timeIntervalSince(now), SpacedRepetition.relearnDelay, accuracy: 0.001)
    }

    func testDueDateIsStartOfTheTargetDay() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let state = SchedulingState(intervalDays: 6, easeFactor: 2.5, repetitions: 2, lapses: 0)
        let due = SpacedRepetition.dueDate(for: state, reviewedAt: now, calendar: calendar)
        let expected = calendar.date(byAdding: .day, value: 6, to: calendar.startOfDay(for: now))
        XCTAssertEqual(due, expected)
    }
}
