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
            intro = PixelLine(text: "DEINE NAECHSTE STUNDE", size: 17, tone: .ink)
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

    /// The pixel font draws capitals and no umlauts, so text is upper-cased and Ä, Ö, Ü, ß are spelled out.
    static func pixelText(_ text: String) -> String {
        var out = ""
        for character in text.uppercased() {
            switch character {
            case "Ä": out += "AE"
            case "Ö": out += "OE"
            case "Ü": out += "UE"
            case "ß": out += "SS"
            default: out.append(character)
            }
        }
        return out
    }

    /// The subject's name as large as the card is wide, at most 34 points: a word takes about 0.92 of its size per
    /// letter in the pixel font, and the card has 236 points to fill.
    static func subjectSize(_ subject: String) -> CGFloat {
        let letters = CGFloat(max(1, subject.count))
        return min(34, (236 / (letters * 0.92 + 1)).rounded(.down))
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
