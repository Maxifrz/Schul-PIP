import XCTest
@testable import Lernwerk

final class QuestBoardTests: XCTestCase {
    private func calendar(_ zone: String = "Europe/Berlin") -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: zone)!
        calendar.firstWeekday = 2
        return calendar
    }

    private var berlin: Calendar { calendar() }

    private func date(_ day: Int, _ hour: Int = 12, month: Int = 10, in zone: String = "Europe/Berlin") -> Date {
        calendar(zone).date(from: DateComponents(year: 2026, month: month, day: day, hour: hour))!
    }

    private func event(xp: Int = 40, course: String? = "es", kind: NodeKind? = .lesson, right: Int = 8, of total: Int = 10) -> QuestEvent {
        QuestEvent(xp: xp, courseID: course, nodeKind: kind, rightFirstTry: right, exerciseCount: total)
    }

    func testADaysQuestsComeFromTheDateAlone() {
        let day = LearnDay(year: 2026, month: 10, day: 10)
        let first = QuestBoard.dailyQuests(for: day)
        XCTAssertEqual(first, QuestBoard.dailyQuests(for: day))
        XCTAssertEqual(first.count, 3)
        XCTAssertEqual(Set(first.map(\.kind)).count, 3, "three different kinds")
        XCTAssertTrue([.xp, .lessons].contains(first[0].kind), "the first is one that any round counts for")
        var kinds = Set<QuestKind>()
        var firsts = Set<QuestKind>()
        for offset in 1...28 {
            let quests = QuestBoard.dailyQuests(for: LearnDay(year: 2026, month: 11, day: offset))
            XCTAssertEqual(Set(quests.map(\.kind)).count, 3)
            XCTAssertTrue(quests.allSatisfy { $0.target > 0 && $0.reward > 0 && !$0.title.isEmpty })
            XCTAssertFalse(quests.contains { $0.kind == .days })
            kinds.formUnion(quests.map(\.kind))
            firsts.insert(quests[0].kind)
        }
        XCTAssertGreaterThanOrEqual(kinds.count, 5, "a month shows most kinds")
        XCTAssertEqual(firsts, [.xp, .lessons])
        XCTAssertEqual(Set(QuestBoard.dailyQuests(for: day).map(\.id)).count, 3)
    }

    func testTitles() {
        XCTAssertEqual(Quest(id: "a", kind: .xp, target: 50, reward: 10).title, "Sammle 50 XP")
        XCTAssertEqual(Quest(id: "a", kind: .lessons, target: 1, reward: 10).title, "Schließe eine Lektion ab")
        XCTAssertEqual(Quest(id: "a", kind: .lessons, target: 3, reward: 10).title, "Schließe 3 Lektionen ab")
        XCTAssertEqual(Quest(id: "a", kind: .perfect, target: 1, reward: 10).title, "Eine Lektion ohne Fehler")
        XCTAssertEqual(Quest(id: "a", kind: .courses, target: 2, reward: 10).title, "Lerne in 2 verschiedenen Kursen")
        XCTAssertEqual(Quest(id: "a", kind: .days, target: 5, reward: 10).title, "Lerne an 5 Tagen")
    }

    func testRoundsMoveTheQuestsAndFinishThemOnce() {
        var board = QuestBoard()
        board.refresh(now: date(10), calendar: berlin)
        XCTAssertEqual(board.daily.count, 3)
        XCTAssertNotNil(board.weekly)
        XCTAssertEqual(board.dailyDone, 0)

        var done = 0
        var rounds = 0
        while board.dailyDone < 3, rounds < 60 {
            let finished = board.apply(
                event(xp: 100, course: rounds % 3 == 0 ? "fr" : "es", kind: rounds % 2 == 0 ? .practice : .lesson, right: 10, of: 10),
                now: date(10), calendar: berlin
            )
            done += finished.filter { $0.id.hasPrefix("d.") }.count
            rounds += 1
        }
        XCTAssertEqual(board.dailyDone, 3, "rounds in two courses, practice and lessons finish every kind")
        XCTAssertEqual(done, 3, "each quest is reported as finished exactly once")
        XCTAssertTrue(board.apply(event(xp: 100), now: date(10), calendar: berlin).filter { $0.id.hasPrefix("d.") }.isEmpty)
    }

    func testNothingCountsForARoundWithoutExercises() {
        var board = QuestBoard()
        XCTAssertTrue(board.apply(event(xp: 20, right: 0, of: 0), now: date(10), calendar: berlin).isEmpty)
        XCTAssertEqual(board.daily.map(\.progress), [0, 0, 0])
        XCTAssertEqual(board.weekly?.progress, 0)
    }

    func testEachKindCountsWhatItSays() {
        func progress(_ kind: QuestKind, events: [QuestEvent]) -> Int {
            var board = QuestBoard()
            board.refresh(now: date(10), calendar: berlin)
            // Put a quest of this kind in place of the first one.
            var quests = board.daily
            quests[0] = Quest(id: "t", kind: kind, target: 99, reward: 1)
            let injected = try! JSONDecoder().decode(QuestBoard.self, from: {
                var data = try! JSONSerialization.jsonObject(with: JSONEncoder().encode(board)) as! [String: Any]
                data["daily"] = try! JSONSerialization.jsonObject(with: JSONEncoder().encode(quests))
                return try! JSONSerialization.data(withJSONObject: data)
            }())
            var live = injected
            for e in events { live.apply(e, now: date(10), calendar: berlin) }
            return live.daily[0].progress
        }
        let perfect = event(xp: 30, kind: .lesson, right: 10, of: 10)
        let flawed = event(xp: 20, kind: .practice, right: 7, of: 10)
        XCTAssertEqual(progress(.xp, events: [perfect, flawed]), 50)
        XCTAssertEqual(progress(.lessons, events: [perfect, flawed]), 2)
        XCTAssertEqual(progress(.perfect, events: [perfect, flawed, perfect]), 2)
        XCTAssertEqual(progress(.firstTry, events: [perfect, flawed]), 17)
        XCTAssertEqual(progress(.practice, events: [perfect, flawed, flawed]), 2)
        XCTAssertEqual(progress(.courses, events: [event(course: "es"), event(course: "es"), event(course: "fr"), event(course: nil)]), 2)
    }

    func testClaimingPaysOnceAndTheBonusNeedsAllThree() {
        var board = QuestBoard()
        board.refresh(now: date(10), calendar: berlin)
        XCTAssertEqual(board.claim(board.daily[0].id), 0, "not done yet")
        for _ in 0..<40 { board.apply(event(xp: 100, kind: .practice, right: 10, of: 10), now: date(10), calendar: berlin) }
        let ready = board.daily.filter(\.isDone)
        XCTAssertGreaterThanOrEqual(ready.count, 2)
        XCTAssertTrue(board.hasUnclaimed)
        var paid = 0
        for quest in board.daily where quest.isDone {
            let gems = board.claim(quest.id)
            XCTAssertEqual(gems, quest.reward)
            XCTAssertEqual(board.claim(quest.id), 0, "only once")
            paid += gems
        }
        XCTAssertGreaterThan(paid, 0)
        XCTAssertEqual(board.claimBonus(), board.allDailyClaimed ? QuestBoard.bonusGems : 0)
        XCTAssertEqual(board.claimBonus(), 0, "the bonus is paid once")
        XCTAssertEqual(board.claim("nonsense"), 0)
    }

    func testANewDayStartsNewQuestsAndTheOldProgressGoes() {
        var board = QuestBoard()
        board.apply(event(xp: 60), now: date(10, 22), calendar: berlin)
        let before = board.daily
        XCTAssertGreaterThan(board.daily[0].progress, 0)
        board.refresh(now: date(11, 1), calendar: berlin)
        XCTAssertNotEqual(board.daily.map(\.id), before.map(\.id))
        XCTAssertEqual(board.daily.map(\.progress), [0, 0, 0])
        XCTAssertFalse(board.bonusClaimed)
        // The same day again changes nothing.
        let same = board
        board.refresh(now: date(11, 23), calendar: berlin)
        XCTAssertEqual(board, same)
    }

    func testTheWeeklyQuestCountsFromMondayToSunday() {
        var board = QuestBoard()
        // 12 October 2026 is a Monday.
        board.refresh(now: date(7), calendar: berlin)
        let lastWeek = board.weekly
        XCTAssertEqual(board.weekStart, LearnDay(year: 2026, month: 10, day: 5))
        board.apply(event(xp: 50), now: date(7), calendar: berlin)
        board.apply(event(xp: 50), now: date(11), calendar: berlin)
        XCTAssertGreaterThan(board.weekly?.progress ?? 0, 0)
        board.refresh(now: date(12, 8), calendar: berlin)
        XCTAssertEqual(board.weekStart, LearnDay(year: 2026, month: 10, day: 12))
        XCTAssertNotEqual(board.weekly?.id, lastWeek?.id)
        XCTAssertEqual(board.weekly?.progress, 0)

        // The days kind counts days, not rounds.
        var days = QuestBoard()
        var found = false
        for week in stride(from: 5, through: 26, by: 7) {
            var attempt = QuestBoard()
            attempt.refresh(now: date(week), calendar: berlin)
            if attempt.weekly?.kind == .days { days = attempt; found = true; break }
        }
        XCTAssertTrue(found, "one of the first weeks asks for days")
        let start = days.weekStart!
        for offset in 0..<3 {
            let now = berlin.date(from: DateComponents(year: start.year, month: start.month, day: start.day + offset, hour: 10))!
            days.apply(event(), now: now, calendar: berlin)
            days.apply(event(), now: now.addingTimeInterval(3600), calendar: berlin)
        }
        XCTAssertEqual(days.weekly?.progress, 3)
    }

    func testTheClockGoingBackKeepsTheLaterDay() {
        var board = QuestBoard()
        board.refresh(now: date(10, 23), calendar: berlin)
        let ids = board.daily.map(\.id)
        board.refresh(now: date(10, 23).addingTimeInterval(3 * 3600), calendar: calendar("America/Los_Angeles"))
        XCTAssertEqual(board.daily.map(\.id), ids, "it is still the 10th in Los Angeles at that moment; the board stays")
        var later = QuestBoard()
        later.refresh(now: date(12, 9), calendar: berlin)
        let kept = later.daily.map(\.id)
        later.refresh(now: date(10, 9), calendar: berlin)
        XCTAssertEqual(later.daily.map(\.id), kept, "a date before the board's day does not bring old quests back")
    }

    func testTimeUntilMidnightAcrossDaylightSavingTime() {
        XCTAssertEqual(QuestBoard.secondsUntilNextDay(now: date(10, 23), calendar: berlin), 3600, accuracy: 1)
        // On 25 October 2026 the clocks go back in Berlin: the day has 25 hours.
        XCTAssertEqual(QuestBoard.secondsUntilNextDay(now: date(25, 0), calendar: berlin), 25 * 3600, accuracy: 1)
    }

    func testSavedBoardsRoundTripAndOlderOnesLoad() throws {
        var board = QuestBoard()
        board.apply(event(xp: 70), now: date(10), calendar: berlin)
        let data = try JSONEncoder().encode(board)
        XCTAssertEqual(try JSONDecoder().decode(QuestBoard.self, from: data), board)
        let older = try JSONDecoder().decode(QuestBoard.self, from: Data("{}".utf8))
        XCTAssertEqual(older, QuestBoard())
        XCTAssertTrue(older.daily.isEmpty)
        XCTAssertFalse(older.hasUnclaimed)
    }

    func testTheStoreKeepsTheBoardAndPaysOnce() {
        let suite = "QuestBoardTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = QuestStore(defaults: defaults)
        store.refresh(now: date(10), calendar: berlin)
        XCTAssertEqual(store.board.daily.count, 3)
        for _ in 0..<40 { store.record(event(xp: 100, kind: .practice, right: 10, of: 10), now: date(10), calendar: berlin) }
        let quest = store.board.daily.first { $0.isDone }!
        XCTAssertEqual(store.claim(quest.id), quest.reward)
        XCTAssertEqual(store.claim(quest.id), 0)
        let reopened = QuestStore(defaults: defaults)
        XCTAssertEqual(reopened.board, store.board)
        XCTAssertEqual(reopened.claim(quest.id), 0, "a claimed quest stays claimed")
        for other in reopened.board.daily where other.isDone { _ = reopened.claim(other.id) }
        if reopened.board.bonusAvailable {
            XCTAssertEqual(reopened.claim(QuestStore.bonusID), QuestBoard.bonusGems)
            XCTAssertEqual(reopened.claim(QuestStore.bonusID), 0)
        }
    }
}
