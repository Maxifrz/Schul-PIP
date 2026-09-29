import Foundation

/// A calendar date with no time or time zone: "2026-05-14" and nothing else. Arithmetic goes through the Julian
/// day number, so it is exact and gives the same answer on every machine, unlike `Date` subtraction across time
/// zones or daylight-saving changes.
struct CalendarDay: Hashable, Comparable, CustomStringConvertible {
    var year: Int
    var month: Int
    var day: Int

    init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    /// From a Julian day number, the inverse of `julianDayNumber`.
    init(julianDayNumber: Int) {
        let a = julianDayNumber + 32044
        let b = (4 * a + 3) / 146097
        let c = a - (146097 * b) / 4
        let d = (4 * c + 3) / 1461
        let e = c - (1461 * d) / 4
        let m = (5 * e + 2) / 153
        day = e - (153 * m + 2) / 5 + 1
        month = m + 3 - 12 * (m / 10)
        year = 100 * b + d - 4800 + m / 10
    }

    /// "2026-05-14", the format the bundled holiday data uses; nil for anything else.
    init?(iso: String) {
        let parts = iso.split(separator: "-")
        guard parts.count == 3, let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
        self.init(year: y, month: m, day: d)
    }

    /// Today, in the given calendar's time zone (the device's, by default) — the day the student is looking at,
    /// not a UTC one that could be a day off.
    static func today(_ calendar: Calendar = .current) -> CalendarDay {
        let components = calendar.dateComponents([.year, .month, .day], from: Date())
        return CalendarDay(year: components.year ?? 1970, month: components.month ?? 1, day: components.day ?? 1)
    }

    /// Fliegel & Van Flandern's Gregorian-to-Julian-day conversion; proleptic, so it also works for dates before
    /// the calendar's adoption.
    var julianDayNumber: Int {
        let a = (14 - month) / 12
        let y = year + 4800 - a
        let m = month + 12 * a - 3
        return day + (153 * m + 2) / 5 + 365 * y + y / 4 - y / 100 + y / 400 - 32045
    }

    /// Monday = 1 ... Sunday = 7, like `Calendar`'s ISO weekday.
    var weekday: Int {
        ((julianDayNumber % 7) + 7) % 7 + 1
    }

    var isWeekend: Bool { weekday >= 6 }

    func adding(days: Int) -> CalendarDay {
        CalendarDay(julianDayNumber: julianDayNumber + days)
    }

    /// Days from `other` to `self`: positive when `self` is later.
    func days(since other: CalendarDay) -> Int {
        julianDayNumber - other.julianDayNumber
    }

    static func < (a: CalendarDay, b: CalendarDay) -> Bool {
        (a.year, a.month, a.day) < (b.year, b.month, b.day)
    }

    var iso: String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    var description: String { iso }

    /// "Mo., 12. Mai" — the weekday and day the student reads, month names always German regardless of the
    /// device's language.
    var germanLabel: String {
        let weekdayNames = ["Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa.", "So."]
        let monthNames = [
            "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember",
        ]
        return "\(weekdayNames[weekday - 1]) \(day). \(monthNames[month - 1])"
    }

    /// "12.05.2026", for compact rows.
    var shortLabel: String {
        String(format: "%02d.%02d.%04d", day, month, year)
    }
}

extension CalendarDay: Codable {
    /// From the "yyyy-MM-dd" the bundled data and every API around this type use.
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let string = try container.decode(String.self)
        guard let day = CalendarDay(iso: string) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Not a yyyy-MM-dd date: \(string)")
        }
        self = day
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(iso)
    }
}
