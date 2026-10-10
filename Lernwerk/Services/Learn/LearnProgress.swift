import Foundation

/// A day as year, month and day in the student's calendar, so a saved day keeps its meaning across daylight saving
/// time and time zones.
struct LearnDay: Codable, Hashable {
    let year: Int
    let month: Int
    let day: Int

    init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    init(_ date: Date, calendar: Calendar) {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        self.init(year: parts.year ?? 0, month: parts.month ?? 0, day: parts.day ?? 0)
    }

    /// Whole days from this day to `other`; counted from noon to noon, so a day of 23 or 25 hours is one day.
    func days(to other: LearnDay, calendar: Calendar) -> Int? {
        guard let from = calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12)),
              let to = calendar.date(from: DateComponents(year: other.year, month: other.month, day: other.day, hour: 12))
        else { return nil }
        return calendar.dateComponents([.day], from: from, to: to).day
    }
}

/// XP, daily goal, streak and finished lessons of the Lernpfad. Plain values: the time and the calendar come in as
/// parameters, so midnight, daylight saving time and other time zones can be tested.
struct LearnProgress: Codable, Equatable {
    static let dailyGoals = [20, 50, 100]
    static let defaultGoal = 20
    static let xpFirstTry = 10
    static let xpRetry = 5
    static let xpLesson = 20
    static let xpAccuracyBonus = 10
    /// Percent right on the first try for the bonus.
    static let bonusPercent = 90
    /// Runs remembered to ignore the same result arriving twice.
    static let rememberedRuns = 50
    static let gemsLesson = 2
    /// More for a lesson in which every exercise was right on the first try.
    static let gemsPerfect = 3
    static let gemsGoal = 5
    static let freezePrice = 30
    static let maxFreezes = 2

    /// What a finished lesson brought.
    struct Reward: Equatable {
        let xp: Int
        let xpToday: Int
        /// The daily goal was reached with this lesson; true once a day at most.
        let goalReached: Bool
        let streak: Int
        /// The first lesson of the day, which counts for the streak.
        let streakExtended: Bool
        /// Gems for the lesson, with the daily goal's if this lesson reached it.
        let gems: Int
        /// Days of the streak a streak freeze covered with this lesson.
        let freezesUsed: Int
    }

    private(set) var dailyGoal = LearnProgress.defaultGoal
    private(set) var totalXP = 0
    /// The XP of `xpDay`; read through `xpToday(now:calendar:)`, which knows when the day is over.
    private(set) var xpOfDay = 0
    private(set) var xpDay: LearnDay?
    private(set) var goalReachedDay: LearnDay?
    /// As of `lastLessonDay`; read through `currentStreak(now:calendar:)`, which knows when a day was skipped.
    private(set) var streak = 0
    private(set) var longestStreak = 0
    private(set) var lastLessonDay: LearnDay?
    /// Lesson ids come from their cards, so a lesson whose cards changed is not in here.
    private(set) var completedLessons: Set<String> = []
    private(set) var recentRuns: [String] = []
    private(set) var gems = 0
    /// Streak freezes in stock: each covers one skipped day.
    private(set) var freezes = 0
    /// XP per course id, for the number next to the course's icon.
    private(set) var courseXP: [String: Int] = [:]

    init() {}

    static func xp(for result: LessonResult) -> Int {
        var xp = result.rightFirstTry * xpFirstTry + result.rightOnRetry * xpRetry + xpLesson
        if result.exerciseCount > 0, result.rightFirstTry * 100 >= result.exerciseCount * bonusPercent {
            xp += xpAccuracyBonus
        }
        return xp
    }

    /// Gems for a lesson: a little for finishing it, more when nothing went wrong.
    static func gems(for result: LessonResult) -> Int {
        gemsLesson + (result.exerciseCount > 0 && result.rightFirstTry == result.exerciseCount ? gemsPerfect : 0)
    }

    func xp(inCourse courseID: String) -> Int {
        courseXP[courseID] ?? 0
    }

    func xpToday(now: Date, calendar: Calendar) -> Int {
        xpDay == day(now, calendar: calendar) ? xpOfDay : 0
    }

    func goalFraction(now: Date, calendar: Calendar) -> Double {
        min(1, Double(xpToday(now: now, calendar: calendar)) / Double(max(1, dailyGoal)))
    }

    /// The streak as it stands: it holds through today if the last lesson was today or yesterday, or if freezes cover
    /// the days since.
    func currentStreak(now: Date, calendar: Calendar) -> Int {
        guard let last = lastLessonDay, let gap = last.days(to: LearnDay(now, calendar: calendar), calendar: calendar) else {
            return 0
        }
        return gap - 1 <= freezes ? streak : 0
    }

    func isCompleted(_ lessonID: String) -> Bool {
        completedLessons.contains(lessonID)
    }

    /// Today in the calendar, but never before the last lesson's day: after a change of time zone or clock, or a
    /// flight across the date line, the local date can go back, and a lesson then belongs to the last lesson day
    /// instead of starting the day's XP, goal and streak over.
    private func day(_ now: Date, calendar: Calendar) -> LearnDay {
        let today = LearnDay(now, calendar: calendar)
        guard let last = lastLessonDay, let gap = last.days(to: today, calendar: calendar), gap < 0 else { return today }
        return last
    }

    mutating func setDailyGoal(_ goal: Int) {
        guard LearnProgress.dailyGoals.contains(goal) else { return }
        dailyGoal = goal
    }

    mutating func addGems(_ amount: Int) {
        gems += max(0, amount)
    }

    /// Buys a streak freeze; false if there are not enough gems or two are in stock already.
    mutating func buyFreeze() -> Bool {
        guard gems >= LearnProgress.freezePrice, freezes < LearnProgress.maxFreezes else { return false }
        gems -= LearnProgress.freezePrice
        freezes += 1
        return true
    }

    /// Opens a chest once: false if it was open already.
    mutating func openChest(_ nodeID: String, gems amount: Int) -> Bool {
        guard completedLessons.insert(nodeID).inserted else { return false }
        addGems(amount)
        return true
    }

    /// Counts a finished lesson; nil if this run was counted before or had no exercise to count. `courseID` adds its
    /// XP to the course's own count.
    mutating func record(_ result: LessonResult, courseID: String? = nil, now: Date, calendar: Calendar) -> Reward? {
        guard result.exerciseCount > 0, !recentRuns.contains(result.sessionID) else { return nil }
        recentRuns.append(result.sessionID)
        if recentRuns.count > LearnProgress.rememberedRuns {
            recentRuns.removeFirst(recentRuns.count - LearnProgress.rememberedRuns)
        }

        let today = day(now, calendar: calendar)
        let earned = LearnProgress.xp(for: result)
        if xpDay != today {
            xpDay = today
            xpOfDay = 0
        }
        xpOfDay += earned
        totalXP += earned
        if let courseID { courseXP[courseID, default: 0] += earned }
        let goalReached = goalReachedDay != today && xpOfDay >= dailyGoal
        if goalReached { goalReachedDay = today }

        var extended = false
        var used = 0
        if lastLessonDay != today {
            let gap = lastLessonDay.flatMap { $0.days(to: today, calendar: calendar) }
            if gap == 1 {
                streak += 1
            } else if let gap, gap > 1, gap - 1 <= freezes {
                // A freeze covers each skipped day, so the streak goes on.
                used = gap - 1
                freezes -= used
                streak += 1
            } else {
                streak = 1
            }
            lastLessonDay = today
            extended = true
        }
        longestStreak = max(longestStreak, streak)
        completedLessons.insert(result.lessonID)
        let earnedGems = LearnProgress.gems(for: result) + (goalReached ? LearnProgress.gemsGoal : 0)
        addGems(earnedGems)
        return Reward(
            xp: earned, xpToday: xpOfDay, goalReached: goalReached, streak: streak, streakExtended: extended,
            gems: earnedGems, freezesUsed: used
        )
    }

    // Saved progress from an older version lacks the newer fields; each one falls back on its default.

    private enum CodingKeys: String, CodingKey {
        case dailyGoal, totalXP, xpOfDay, xpDay, goalReachedDay, streak, longestStreak, lastLessonDay, completedLessons, recentRuns
        case gems, freezes, courseXP
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        func value<T: Decodable>(_ key: CodingKeys, _ fallback: T) -> T {
            (try? container.decodeIfPresent(T.self, forKey: key)) ?? fallback
        }
        let goal = value(.dailyGoal, LearnProgress.defaultGoal)
        dailyGoal = LearnProgress.dailyGoals.contains(goal) ? goal : LearnProgress.defaultGoal
        totalXP = value(.totalXP, 0)
        xpOfDay = value(.xpOfDay, 0)
        xpDay = value(.xpDay, nil as LearnDay?)
        goalReachedDay = value(.goalReachedDay, nil as LearnDay?)
        streak = value(.streak, 0)
        longestStreak = max(value(.longestStreak, 0), streak)
        lastLessonDay = value(.lastLessonDay, nil as LearnDay?)
        completedLessons = value(.completedLessons, Set<String>())
        recentRuns = value(.recentRuns, [String]())
        gems = max(0, value(.gems, 0))
        freezes = min(LearnProgress.maxFreezes, max(0, value(.freezes, 0)))
        courseXP = value(.courseXP, [String: Int]())
    }
}

/// The Lernpfad's progress in UserDefaults, like `AppSettings`.
final class LearnProgressStore: ObservableObject {
    static let key = "learn.progress"

    @Published private(set) var progress: LearnProgress

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        progress = defaults.data(forKey: LearnProgressStore.key)
            .flatMap { try? JSONDecoder().decode(LearnProgress.self, from: $0) } ?? LearnProgress()
    }

    func setDailyGoal(_ goal: Int) {
        progress.setDailyGoal(goal)
        save()
    }

    /// Counts a finished lesson once; nil if this run was counted before or had no exercise.
    @discardableResult
    func record(_ result: LessonResult, courseID: String? = nil, now: Date, calendar: Calendar) -> LearnProgress.Reward? {
        var updated = progress
        guard let reward = updated.record(result, courseID: courseID, now: now, calendar: calendar) else { return nil }
        progress = updated
        save()
        return reward
    }

    /// Opens a chest once and pays its gems; false if it was open already.
    @discardableResult
    func openChest(_ nodeID: String, gems: Int) -> Bool {
        var updated = progress
        guard updated.openChest(nodeID, gems: gems) else { return false }
        progress = updated
        save()
        return true
    }

    func addGems(_ amount: Int) {
        guard amount > 0 else { return }
        progress.addGems(amount)
        save()
    }

    @discardableResult
    func buyFreeze() -> Bool {
        var updated = progress
        guard updated.buyFreeze() else { return false }
        progress = updated
        save()
        return true
    }

    private func save() {
        if let data = try? JSONEncoder().encode(progress) {
            defaults.set(data, forKey: LearnProgressStore.key)
        }
    }
}
