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

    /// What a finished lesson brought.
    struct Reward: Equatable {
        let xp: Int
        let xpToday: Int
        /// The daily goal was reached with this lesson; true once a day at most.
        let goalReached: Bool
        let streak: Int
        /// The first lesson of the day, which counts for the streak.
        let streakExtended: Bool
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

    init() {}

    static func xp(for result: LessonResult) -> Int {
        var xp = result.rightFirstTry * xpFirstTry + result.rightOnRetry * xpRetry + xpLesson
        if result.exerciseCount > 0, result.rightFirstTry * 100 >= result.exerciseCount * bonusPercent {
            xp += xpAccuracyBonus
        }
        return xp
    }

    func xpToday(now: Date, calendar: Calendar) -> Int {
        xpDay == day(now, calendar: calendar) ? xpOfDay : 0
    }

    func goalFraction(now: Date, calendar: Calendar) -> Double {
        min(1, Double(xpToday(now: now, calendar: calendar)) / Double(max(1, dailyGoal)))
    }

    /// The streak as it stands: it holds through today if the last lesson was today or yesterday.
    func currentStreak(now: Date, calendar: Calendar) -> Int {
        guard let last = lastLessonDay, let gap = last.days(to: LearnDay(now, calendar: calendar), calendar: calendar) else {
            return 0
        }
        return gap <= 1 ? streak : 0
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

    /// Counts a finished lesson; nil if this run was counted before or had no exercise to count.
    mutating func record(_ result: LessonResult, now: Date, calendar: Calendar) -> Reward? {
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
        let goalReached = goalReachedDay != today && xpOfDay >= dailyGoal
        if goalReached { goalReachedDay = today }

        var extended = false
        if lastLessonDay != today {
            let gap = lastLessonDay.flatMap { $0.days(to: today, calendar: calendar) }
            streak = gap == 1 ? streak + 1 : 1
            lastLessonDay = today
            extended = true
        }
        longestStreak = max(longestStreak, streak)
        completedLessons.insert(result.lessonID)
        return Reward(xp: earned, xpToday: xpOfDay, goalReached: goalReached, streak: streak, streakExtended: extended)
    }

    // Saved progress from an older version lacks the newer fields; each one falls back on its default.

    private enum CodingKeys: String, CodingKey {
        case dailyGoal, totalXP, xpOfDay, xpDay, goalReachedDay, streak, longestStreak, lastLessonDay, completedLessons, recentRuns
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
    func record(_ result: LessonResult, now: Date, calendar: Calendar) -> LearnProgress.Reward? {
        var updated = progress
        guard let reward = updated.record(result, now: now, calendar: calendar) else { return nil }
        progress = updated
        save()
        return reward
    }

    private func save() {
        if let data = try? JSONEncoder().encode(progress) {
            defaults.set(data, forKey: LearnProgressStore.key)
        }
    }
}
