import Foundation

/// How far away an exam is, in the two ways a student thinks about it: calendar days, and actual school days left
/// to prepare (weekends, Feiertage and Ferien do not count).
enum ExamCountdown {
    /// "heute", "morgen", "in 3 Tagen", "gestern", "vor 2 Tagen".
    static func daysLabel(from today: CalendarDay, to day: CalendarDay) -> String {
        let diff = day.days(since: today)
        switch diff {
        case 0: return "heute"
        case 1: return "morgen"
        case -1: return "gestern"
        default: return diff > 0 ? "in \(diff) Tagen" : "vor \(-diff) Tagen"
        }
    }

    /// School days strictly between today and `day`, `day` itself included when it is one; nil once `day` is past.
    static func schoolDaysLeft(from today: CalendarDay, to day: CalendarDay, in state: Bundesland) -> Int? {
        guard day >= today else { return nil }
        guard day > today else { return 0 }
        return HolidayCalendar.schoolDays(from: today.adding(days: 1), through: day, in: state)
    }

    /// "heute", "noch 1 Schultag", "noch 12 Schultage", or nil once the exam is in the past.
    static func schoolDaysLabel(from today: CalendarDay, to day: CalendarDay, in state: Bundesland) -> String? {
        guard let count = schoolDaysLeft(from: today, to: day, in: state) else { return nil }
        if day == today { return "heute" }
        return count == 1 ? "noch 1 Schultag" : "noch \(count) Schultage"
    }
}
