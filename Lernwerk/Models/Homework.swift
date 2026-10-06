import Foundation
import SwiftData

/// What Pip noted after a lesson: the homework for a subject on one day, or that there was none.
@Model
final class Homework {
    var subject: String
    /// The day of the lesson, "2026-10-01".
    var dayISO: String
    var text: String
    /// True when the student answered "no homework"; `text` is empty then.
    var isNone: Bool
    var isDone: Bool
    /// When it is due, like "FR 2.10." or "ZUR NÄCHSTEN STUNDE".
    var due: String
    var createdAt: Date

    init(subject: String, dayISO: String, text: String = "", isNone: Bool = false, due: String = "") {
        self.subject = subject
        self.dayISO = dayISO
        self.text = text
        self.isNone = isNone
        isDone = false
        self.due = due
        createdAt = .now
    }
}
