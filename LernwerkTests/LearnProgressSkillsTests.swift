import XCTest
@testable import Lernwerk

final class LearnProgressSkillsTests: XCTestCase {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()
    private let now = Date(timeIntervalSince1970: 1_780_000_000)

    private func result(_ id: String, session: String = "s1") -> LessonResult {
        LessonResult(lessonID: id, sessionID: session, exerciseCount: 10, rightFirstTry: 9, rightOnRetry: 1, cardKeys: [], cardsRightFirstTry: [])
    }

    func testARoundOnChosenGoalsEarnsXPAndMarksNothingAsDone() {
        var progress = LearnProgress()
        let reward = progress.record(result("practice.es"), courseID: "es", completes: false, now: now, calendar: calendar)
        XCTAssertNotNil(reward)
        XCTAssertGreaterThan(progress.totalXP, 0)
        XCTAssertEqual(progress.xp(inCourse: "es"), progress.totalXP)
        XCTAssertTrue(progress.completedLessons.isEmpty)
        XCTAssertEqual(progress.currentStreak(now: now, calendar: calendar), 1)
    }

    func testAStepStillCompletesByDefaultAndTheSameRunCountsOnce() {
        var progress = LearnProgress()
        XCTAssertNotNil(progress.record(result("es.u01.l1"), courseID: "es", now: now, calendar: calendar))
        XCTAssertTrue(progress.completedLessons.contains("es.u01.l1"))
        let xp = progress.totalXP
        XCTAssertNil(progress.record(result("es.u01.l1"), courseID: "es", now: now, calendar: calendar), "the same run is not counted twice")
        XCTAssertEqual(progress.totalXP, xp)
    }

    func testPassingAUnitTestMarksItsStepsDoneAndStoresThem() {
        let defaults = UserDefaults(suiteName: "LearnProgressSkillsTests-\(UUID().uuidString)")!
        let store = LearnProgressStore(defaults: defaults)
        store.complete(["a", "b"])
        XCTAssertEqual(LearnProgressStore(defaults: defaults).progress.completedLessons, ["a", "b"])
    }

    func testALessonResultWithoutOutcomesIsStillEqualToItself() {
        XCTAssertEqual(result("x"), result("x"))
        XCTAssertEqual(result("x").outcomes, [])
    }
}
