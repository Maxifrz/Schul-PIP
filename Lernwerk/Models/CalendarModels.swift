import Foundation
import SwiftData

/// One lesson slot in the weekly timetable, like "Mathe, Mo 08:00–08:45, Raum 204". The color comes from
/// `Subjects.color(subject)`, the same list the library colors documents with.
@Model
final class TimetableEntry {
    var subject: String
    var room: String
    /// Monday = 1 ... Sunday = 7.
    var weekday: Int
    var startMinute: Int
    var endMinute: Int
    var createdAt: Date

    init(subject: String, room: String = "", weekday: Int, startMinute: Int, endMinute: Int) {
        self.subject = subject
        self.room = room
        self.weekday = weekday
        self.startMinute = startMinute
        self.endMinute = endMinute
        createdAt = .now
    }
}

/// One exam or test on the Klausurenplan.
@Model
final class Exam {
    var subject: String
    var topic: String
    var date: Date
    var room: String
    var createdAt: Date

    init(subject: String, topic: String = "", date: Date, room: String = "") {
        self.subject = subject
        self.topic = topic
        self.date = date
        self.room = room
        createdAt = .now
    }

    /// `date`, as the day-only value the holiday calendar works with.
    var calendarDay: CalendarDay {
        let components = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return CalendarDay(year: components.year ?? 1970, month: components.month ?? 1, day: components.day ?? 1)
    }
}
