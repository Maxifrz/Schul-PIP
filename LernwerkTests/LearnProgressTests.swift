import XCTest
@testable import Lernwerk

final class LearnProgressTests: XCTestCase {
    private func calendar(_ zone: String) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: zone)!
        return calendar
    }

    private var berlin: Calendar { calendar("Europe/Berlin") }

    private func date(_ day: Int, _ hour: Int = 12, _ minute: Int = 0, month: Int = 10, in calendar: Calendar? = nil) -> Date {
        (calendar ?? berlin).date(from: DateComponents(year: 2026, month: month, day: day, hour: hour, minute: minute))!
    }

    private var runs = 0

    private func result(right: Int, retry: Int = 0, of total: Int, lesson: String = "L1") -> LessonResult {
        runs += 1
        return LessonResult(
            lessonID: lesson, sessionID: "run-\(runs)", exerciseCount: total, rightFirstTry: right, rightOnRetry: retry,
            cardKeys: ["a"], cardsRightFirstTry: []
        )
    }

    func testXPTable() {
        // 10 per first try, 5 per right retry, 20 for the lesson, 10 more from 90 % right on the first try.
        XCTAssertEqual(LearnProgress.xp(for: result(right: 8, retry: 2, of: 10)), 80 + 10 + 20)
        XCTAssertEqual(LearnProgress.xp(for: result(right: 9, retry: 1, of: 10)), 90 + 5 + 20 + 10)
        XCTAssertEqual(LearnProgress.xp(for: result(right: 10, of: 10)), 100 + 20 + 10)
        XCTAssertEqual(LearnProgress.xp(for: result(right: 27, of: 30)), 270 + 20 + 10)
        XCTAssertEqual(LearnProgress.xp(for: result(right: 26, of: 30)), 260 + 20)
        XCTAssertEqual(LearnProgress.xp(for: result(right: 0, retry: 3, of: 3)), 15 + 20)
        XCTAssertEqual(LearnProgress.xp(for: result(right: 0, of: 0)), 20)
    }

    func testTheDailyGoalIsReachedOncePerDay() {
        var progress = LearnProgress()
        XCTAssertEqual(progress.dailyGoal, 20)
        progress.setDailyGoal(100)
        progress.setDailyGoal(30)
        XCTAssertEqual(progress.dailyGoal, 100)

        let lesson = { self.result(right: 2, of: 4) } // 40 XP
        XCTAssertEqual(progress.record(lesson(), now: date(9, 9), calendar: berlin)?.goalReached, false)
        XCTAssertEqual(progress.record(lesson(), now: date(9, 10), calendar: berlin)?.goalReached, false)
        let third = progress.record(lesson(), now: date(9, 11), calendar: berlin)
        XCTAssertEqual(third?.goalReached, true)
        XCTAssertEqual(third?.xpToday, 120)
        XCTAssertEqual(progress.record(lesson(), now: date(9, 12), calendar: berlin)?.goalReached, false)
        XCTAssertEqual(progress.goalFraction(now: date(9, 13), calendar: berlin), 1)

        // A higher goal later that day is not celebrated again.
        progress.setDailyGoal(50)
        progress.setDailyGoal(100)
        XCTAssertEqual(progress.record(lesson(), now: date(9, 14), calendar: berlin)?.goalReached, false)

        XCTAssertEqual(progress.record(lesson(), now: date(10, 9), calendar: berlin)?.goalReached, false)
        XCTAssertEqual(progress.goalFraction(now: date(10, 9), calendar: berlin), 0.4, accuracy: 0.0001)
        XCTAssertEqual(progress.totalXP, 6 * 40)
    }

    func testXPTodayStartsAgainAtMidnight() {
        var progress = LearnProgress()
        progress.record(result(right: 3, of: 4), now: date(9, 23, 50), calendar: berlin)
        XCTAssertEqual(progress.xpToday(now: date(9, 23, 59), calendar: berlin), 50)
        XCTAssertEqual(progress.xpToday(now: date(10, 0, 1), calendar: berlin), 0)
        progress.record(result(right: 1, of: 4), now: date(10, 0, 5), calendar: berlin)
        XCTAssertEqual(progress.xpToday(now: date(10, 0, 6), calendar: berlin), 30)
        XCTAssertEqual(progress.totalXP, 80)
    }

    func testStreakContinuesBreaksAndCountsADayOnce() {
        var progress = LearnProgress()
        XCTAssertEqual(progress.currentStreak(now: date(1), calendar: berlin), 0)
        XCTAssertEqual(progress.record(result(right: 1, of: 1), now: date(1, 8), calendar: berlin)?.streak, 1)
        let second = progress.record(result(right: 1, of: 1), now: date(1, 20), calendar: berlin)
        XCTAssertEqual(second?.streak, 1)
        XCTAssertEqual(second?.streakExtended, false)
        let nextDay = progress.record(result(right: 1, of: 1), now: date(2, 7), calendar: berlin)
        XCTAssertEqual(nextDay?.streak, 2)
        XCTAssertEqual(nextDay?.streakExtended, true)
        progress.record(result(right: 1, of: 1), now: date(3, 22), calendar: berlin)
        XCTAssertEqual(progress.currentStreak(now: date(3, 23), calendar: berlin), 3)
        // The day after, the streak still stands until midnight; a skipped day ends it.
        XCTAssertEqual(progress.currentStreak(now: date(4, 23, 59), calendar: berlin), 3)
        XCTAssertEqual(progress.currentStreak(now: date(5, 0, 1), calendar: berlin), 0)
        XCTAssertEqual(progress.record(result(right: 1, of: 1), now: date(5, 9), calendar: berlin)?.streak, 1)
        XCTAssertEqual(progress.longestStreak, 3)
    }

    func testStreakAcrossDaylightSavingTime() {
        // Berlin switches to summer time on 29 March 2026 (23 hours) and back on 25 October (25 hours).
        var spring = LearnProgress()
        spring.record(result(right: 1, of: 1), now: date(28, 23, 30, month: 3), calendar: berlin)
        XCTAssertEqual(spring.record(result(right: 1, of: 1), now: date(29, 23, 30, month: 3), calendar: berlin)?.streak, 2)
        XCTAssertEqual(spring.record(result(right: 1, of: 1), now: date(30, 0, 10, month: 3), calendar: berlin)?.streak, 3)

        var autumn = LearnProgress()
        autumn.record(result(right: 1, of: 1), now: date(24, 0, 10), calendar: berlin)
        XCTAssertEqual(autumn.record(result(right: 1, of: 1), now: date(25, 23, 50), calendar: berlin)?.streak, 2)
        XCTAssertEqual(autumn.currentStreak(now: date(26, 23, 59), calendar: berlin), 2)
        XCTAssertEqual(autumn.currentStreak(now: date(27, 0, 0), calendar: berlin), 0)
    }

    func testDaysFollowTheCalendarsTimeZoneNotUTC() {
        let utc = calendar("UTC")
        let auckland = calendar("Pacific/Auckland")
        // 10:00 and 12:00 UTC on 9 October are 23:00 on the 9th and 01:00 on the 10th in Auckland.
        let late = date(9, 10, in: utc)
        let early = date(9, 12, in: utc)
        var there = LearnProgress()
        there.record(result(right: 1, of: 1), now: late, calendar: auckland)
        XCTAssertEqual(there.record(result(right: 1, of: 1), now: early, calendar: auckland)?.streak, 2)
        XCTAssertEqual(there.xpToday(now: early, calendar: auckland), 40)

        var inUTC = LearnProgress()
        inUTC.record(result(right: 1, of: 1), now: late, calendar: utc)
        XCTAssertEqual(inUTC.record(result(right: 1, of: 1), now: early, calendar: utc)?.streak, 1)
        XCTAssertEqual(inUTC.xpToday(now: early, calendar: utc), 80)

        XCTAssertEqual(LearnDay(year: 2026, month: 12, day: 31).days(to: LearnDay(year: 2027, month: 1, day: 1), calendar: utc), 1)
        XCTAssertEqual(LearnDay(late, calendar: auckland), LearnDay(year: 2026, month: 10, day: 9))
        XCTAssertEqual(LearnDay(early, calendar: auckland), LearnDay(year: 2026, month: 10, day: 10))
    }

    func testALocalDateThatGoesBackKeepsTheDay() {
        // Two lessons in Berlin on consecutive days, then one an hour later in New York, where it is the day before.
        var progress = LearnProgress()
        progress.setDailyGoal(50)
        progress.record(result(right: 1, of: 1), now: date(9, 18), calendar: berlin)
        let second = progress.record(result(right: 1, of: 1), now: date(10, 0, 30), calendar: berlin)
        XCTAssertEqual(second?.streak, 2)
        XCTAssertEqual(second?.goalReached, false)
        let thirdReward = progress.record(result(right: 1, of: 1), now: date(10, 0, 30).addingTimeInterval(3600), calendar: calendar("America/New_York"))
        XCTAssertEqual(thirdReward?.streak, 2)
        XCTAssertEqual(thirdReward?.streakExtended, false)
        XCTAssertEqual(thirdReward?.xpToday, 80)
        XCTAssertEqual(thirdReward?.goalReached, true)
        XCTAssertEqual(progress.xpToday(now: date(10, 2), calendar: calendar("America/New_York")), 80)
        XCTAssertEqual(progress.currentStreak(now: date(10, 2), calendar: calendar("America/New_York")), 2)
        let fourth = progress.record(result(right: 1, of: 1), now: date(10, 3), calendar: calendar("America/New_York"))
        XCTAssertEqual(fourth?.goalReached, false, "the goal is reached once on that day")
        XCTAssertEqual(progress.longestStreak, 2)
    }

    func testFinishedLessonsAreRememberedAndARunCountsOnce() {
        var progress = LearnProgress()
        let run = result(right: 4, of: 4, lesson: "L7")
        XCTAssertNotNil(progress.record(run, now: date(9), calendar: berlin))
        XCTAssertNil(progress.record(run, now: date(9, 13), calendar: berlin))
        XCTAssertEqual(progress.totalXP, 70)
        XCTAssertTrue(progress.isCompleted("L7"))
        XCTAssertEqual(progress.completedLessons, ["L7"])
        for _ in 0..<(LearnProgress.rememberedRuns + 5) {
            progress.record(result(right: 1, of: 1), now: date(9), calendar: berlin)
        }
        XCTAssertEqual(progress.recentRuns.count, LearnProgress.rememberedRuns)
    }

    func testARunWithoutExercisesCountsNothing() {
        var progress = LearnProgress()
        XCTAssertNil(progress.record(result(right: 0, of: 0), now: date(9), calendar: berlin))
        XCTAssertEqual(progress.totalXP, 0)
        XCTAssertEqual(progress.currentStreak(now: date(9), calendar: berlin), 0)
        XCTAssertTrue(progress.completedLessons.isEmpty)
    }

    func testJSONRoundTrip() throws {
        var progress = LearnProgress()
        progress.setDailyGoal(50)
        progress.record(result(right: 5, of: 6, lesson: "A"), now: date(8), calendar: berlin)
        progress.record(result(right: 6, of: 6, lesson: "B"), now: date(9), calendar: berlin)
        let data = try JSONEncoder().encode(progress)
        XCTAssertEqual(try JSONDecoder().decode(LearnProgress.self, from: data), progress)
    }

    func testOlderSavesLoadWithDefaults() throws {
        let older = #"{"totalXP": 340, "streak": 4, "completedLessons": ["L1", "L2"], "dailyGoal": 35, "lastLessonDay": {"year": 2026, "month": 10, "day": 8}}"#
        let progress = try JSONDecoder().decode(LearnProgress.self, from: Data(older.utf8))
        XCTAssertEqual(progress.totalXP, 340)
        XCTAssertEqual(progress.dailyGoal, LearnProgress.defaultGoal)
        XCTAssertEqual(progress.longestStreak, 4)
        XCTAssertEqual(progress.currentStreak(now: date(9), calendar: berlin), 4)
        XCTAssertEqual(progress.completedLessons, ["L1", "L2"])
        XCTAssertEqual(progress.xpToday(now: date(9), calendar: berlin), 0)
        XCTAssertTrue(progress.recentRuns.isEmpty)
        XCTAssertEqual(try JSONDecoder().decode(LearnProgress.self, from: Data("{}".utf8)), LearnProgress())
        XCTAssertEqual(try JSONDecoder().decode(LearnProgress.self, from: Data(#"{"totalXP": "viel"}"#.utf8)).totalXP, 0)
    }

    func testTheStoreLoadsWhatAnOlderStoreSaved() {
        let suite = "LearnProgressTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }

        defaults.set(Data(#"{"totalXP": 120, "streak": 2, "completedLessons": ["L9"]}"#.utf8), forKey: LearnProgressStore.key)
        let store = LearnProgressStore(defaults: defaults)
        XCTAssertEqual(store.progress.totalXP, 120)
        XCTAssertTrue(store.progress.isCompleted("L9"))

        store.setDailyGoal(100)
        let run = result(right: 4, of: 4, lesson: "L10")
        XCTAssertNotNil(store.record(run, now: date(9), calendar: berlin))
        XCTAssertNil(store.record(run, now: date(9), calendar: berlin))

        let reopened = LearnProgressStore(defaults: defaults)
        XCTAssertEqual(reopened.progress, store.progress)
        XCTAssertEqual(reopened.progress.dailyGoal, 100)
        XCTAssertEqual(reopened.progress.totalXP, 190)
        XCTAssertEqual(reopened.progress.completedLessons, ["L9", "L10"])

        defaults.set(Data("kaputt".utf8), forKey: LearnProgressStore.key)
        XCTAssertEqual(LearnProgressStore(defaults: defaults).progress, LearnProgress())
    }
}
