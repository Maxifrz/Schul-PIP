import CoreGraphics
import Foundation

/// What the Studio rail shows besides the live data: the lines of the pixel card, the exam countdown and the
/// results of the jump bar. Plain values in, plain values out, so the tests need no SwiftData and no clock.
enum StudioToday {
    // MARK: Pixel card

    struct Lesson: Equatable {
        let subject: String
        let room: String
        let start: Int
        let end: Int
    }

    enum Tone: Equatable {
        case ink, accent, muted
    }

    struct PixelLine: Equatable {
        let text: String
        let size: CGFloat
        let tone: Tone
    }

    /// The card says what is next in the timetable: "DU HAST GLEICH / MATHE. / RAUM 204 · IN 5 MIN." `now` is the
    /// minute of the day; `lessons` are today's lessons, any order.
    static func lines(now: Int, lessons: [Lesson]) -> [PixelLine] {
        let sorted = lessons.sorted { $0.start < $1.start }
        let current = sorted.first { $0.start <= now && now < $0.end }
        let upcoming = sorted.first { $0.start > now }
        guard let lesson = current ?? upcoming else {
            return [
                PixelLine(text: "KEIN UNTERRICHT", size: 15, tone: .ink),
                PixelLine(text: "MEHR HEUTE.", size: 28, tone: .accent),
                PixelLine(text: "LERNPLAN WARTET.", size: 12, tone: .ink),
            ]
        }
        let until = lesson.start - now
        let intro: PixelLine
        if current != nil {
            intro = PixelLine(text: "DU BIST GERADE IN", size: 14, tone: .ink)
        } else if until <= 15 {
            intro = PixelLine(text: "DU HAST GLEICH", size: 17, tone: .ink)
        } else {
            intro = PixelLine(text: "DEINE NÄCHSTE STUNDE", size: 17, tone: .ink)
        }
        let place = lesson.room.isEmpty ? "" : "RAUM \(pixelText(lesson.room))"
        let when = current != nil ? "BIS \(ClockTime.label(lesson.end))" : "IN \(until) MIN."
        var result = [
            intro,
            PixelLine(text: pixelText(lesson.subject) + ".", size: subjectSize(lesson.subject), tone: .accent),
            PixelLine(text: place.isEmpty ? when : place + " · " + when, size: 12, tone: .ink),
        ]
        if let after = sorted.first(where: { $0.start > lesson.start && $0.subject != lesson.subject }) {
            result.append(PixelLine(text: "DANACH: \(pixelText(after.subject)) · \(ClockTime.label(after.start))", size: 10, tone: .muted))
        }
        return result
    }

    /// The pixel font draws capitals; Jersey 10 has the umlauts, so upper-casing is all it takes.
    static func pixelText(_ text: String) -> String {
        text.uppercased()
    }

    /// The subject's name as large as the card is wide, at most 34 points: a word takes about 0.92 of its size per
    /// letter in the pixel font, and the card has 236 points to fill.
    static func subjectSize(_ subject: String) -> CGFloat {
        let letters = CGFloat(max(1, subject.count))
        return min(34, (236 / (letters * 0.92 + 1)).rounded(.down))
    }

    /// The hero card's lines at the Dock layout's sizes: the subject is as large as the card is wide.
    static func heroLines(now: Int, lessons: [Lesson], portrait: Bool) -> [PixelLine] {
        let base = lines(now: now, lessons: lessons)
        let sizes: [CGFloat] = [26, 0, 28, 22]
        return base.enumerated().map { index, line in
            let size = index == 1 ? heroSize(line.text, portrait: portrait) : sizes[min(index, sizes.count - 1)]
            return PixelLine(text: line.text, size: size, tone: line.tone)
        }
    }

    /// At most 96 points; a letter of Jersey 10 takes about 0.6 of its size.
    static func heroSize(_ text: String, portrait: Bool) -> CGFloat {
        let width: CGFloat = portrait ? 440 : 370
        return min(96, (width / (CGFloat(max(1, text.count)) * 0.6 + 0.4)).rounded(.down))
    }

    // MARK: Homework

    /// Lessons of one subject that follow each other (at most ten minutes between) count as one block, so a double
    /// lesson is asked about once.
    struct Block: Equatable {
        let subject: String
        let start: Int
        var end: Int
    }

    static func blocks(_ lessons: [Lesson]) -> [Block] {
        var result: [Block] = []
        for lesson in lessons.sorted(by: { $0.start < $1.start }) {
            if let last = result.last, last.subject == lesson.subject, lesson.start - last.end <= 10 {
                result[result.count - 1].end = lesson.end
            } else {
                result.append(Block(subject: lesson.subject, start: lesson.start, end: lesson.end))
            }
        }
        return result
    }

    /// The block Pip should ask about: the first one that ends within five minutes or has ended and has no answer yet.
    static func askBlock(blocks: [Block], answered: Set<String>, now: Int) -> Block? {
        blocks.first { $0.end - 5 <= now && !answered.contains($0.subject) }
    }

    /// "FR 2.10." for the next day the subject is taught, else "ZUR NÄCHSTEN STUNDE".
    static func dueLabel(subject: String, week: [(weekday: Int, subject: String)], today: CalendarDay) -> String {
        let names = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"]
        for offset in 1...7 {
            let day = today.adding(days: offset)
            if week.contains(where: { $0.weekday == day.weekday && $0.subject == subject }) {
                return "\(names[day.weekday - 1]) \(day.day).\(day.month)."
            }
        }
        return "ZUR NÄCHSTEN STUNDE"
    }

    // MARK: Exam countdown

    struct ExamSummary: Equatable {
        let days: Int
        let dateLabel: String
        /// One entry per topic of the study plan, true when it is done; empty when the date is an exam from the
        /// Klausurenplan with no plan behind it.
        let blocks: [Bool]

        var doneCount: Int { blocks.filter { $0 }.count }

        var progressLabel: String? {
            blocks.isEmpty ? nil : "\(doneCount) von \(blocks.count) Themen erledigt"
        }
    }

    struct PlanInfo: Equatable {
        let examDay: CalendarDay
        let done: [Bool]
    }

    /// The nearest exam that has not passed: a study plan's exam date (with its topics as progress blocks) or an
    /// exam from the Klausurenplan. On a tie the plan wins, because it has the progress.
    static func examSummary(plans: [PlanInfo], exams: [CalendarDay], today: CalendarDay) -> ExamSummary? {
        let plan = plans.filter { $0.examDay >= today }.min { $0.examDay < $1.examDay }
        let exam = exams.filter { $0 >= today }.min()
        if let plan, exam.map({ plan.examDay <= $0 }) ?? true {
            return ExamSummary(days: plan.examDay.days(since: today), dateLabel: longLabel(plan.examDay), blocks: plan.done)
        }
        if let exam {
            return ExamSummary(days: exam.days(since: today), dateLabel: longLabel(exam), blocks: [])
        }
        return nil
    }

    /// "29. Oktober 2026", German whatever the device's language.
    static func longLabel(_ day: CalendarDay) -> String {
        let months = [
            "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember",
        ]
        return "\(day.day). \(months[day.month - 1]) \(day.year)"
    }

    // MARK: Date caption

    /// "DONNERSTAG · 1. OKT · 9:41" above the pixel card.
    static func caption(day: CalendarDay, minute: Int) -> String {
        let weekdays = ["MONTAG", "DIENSTAG", "MITTWOCH", "DONNERSTAG", "FREITAG", "SAMSTAG", "SONNTAG"]
        let months = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"]
        return "\(weekdays[day.weekday - 1]) · \(day.day). \(months[day.month - 1]) · \(minute / 60):\(String(format: "%02d", minute % 60))"
    }

    // MARK: Jump bar

    struct OmniEntry: Equatable, Identifiable {
        enum Kind: Equatable {
            case area, document
        }

        let id: String
        let label: String
        let kind: Kind

        var kindLabel: String { kind == .area ? "BEREICH" : "DOKUMENT" }
    }

    /// Areas and documents whose names contain the query, areas first, at most five. An empty query finds nothing.
    static func omni(query: String, areas: [OmniEntry], documents: [OmniEntry]) -> [OmniEntry] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return [] }
        let hits = (areas + documents).filter { $0.label.lowercased().contains(needle) }
        return Array(hits.prefix(5))
    }
}
