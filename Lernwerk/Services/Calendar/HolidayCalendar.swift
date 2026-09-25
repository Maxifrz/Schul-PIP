import Foundation

/// The 16 German states, for Ferien and Feiertage; the raw value is the two-letter code the bundled data and
/// `openholidaysapi.org` use.
enum Bundesland: String, CaseIterable, Codable, Identifiable, Hashable {
    case bw = "BW", by = "BY", be = "BE", bb = "BB", hb = "HB", hh = "HH", he = "HE", mv = "MV"
    case ni = "NI", nw = "NW", rp = "RP", sl = "SL", sn = "SN", st = "ST", sh = "SH", th = "TH"

    var id: String { rawValue }

    var name: String {
        switch self {
        case .bw: return "Baden-Württemberg"
        case .by: return "Bayern"
        case .be: return "Berlin"
        case .bb: return "Brandenburg"
        case .hb: return "Bremen"
        case .hh: return "Hamburg"
        case .he: return "Hessen"
        case .mv: return "Mecklenburg-Vorpommern"
        case .ni: return "Niedersachsen"
        case .nw: return "Nordrhein-Westfalen"
        case .rp: return "Rheinland-Pfalz"
        case .sl: return "Saarland"
        case .sn: return "Sachsen"
        case .st: return "Sachsen-Anhalt"
        case .sh: return "Schleswig-Holstein"
        case .th: return "Thüringen"
        }
    }
}

/// A block of school holidays, like "Herbstferien" from one day to another, both included.
struct SchoolHoliday: Codable, Equatable, Identifiable {
    var name: String
    var start: CalendarDay
    var end: CalendarDay

    var id: String { "\(name)|\(start.iso)|\(end.iso)" }

    func contains(_ day: CalendarDay) -> Bool { day >= start && day <= end }
}

/// A single-day public holiday, like "Tag der Arbeit".
struct PublicHoliday: Codable, Equatable, Identifiable {
    var name: String
    var date: CalendarDay

    var id: String { "\(name)|\(date.iso)" }
}

/// Bundled Ferien and Feiertage for every Bundesland, 2023–2029 (see `calendar/README.md`), with the lookups a
/// student's calendar needs: is today a school day, when is the next holiday, how many school days are left until
/// an exam.
enum HolidayCalendar {
    private struct Bundle: Decodable {
        var states: [StateInfo]
        var nationalHolidays: [PublicHoliday]
        var regionalHolidays: [String: [PublicHoliday]]
        var schoolHolidays: [String: [SchoolHoliday]]
    }

    private struct StateInfo: Decodable {
        var code: String
        var name: String
    }

    private static let bundle: Bundle = {
        // The bundled data is generated and checked by tests; a decode failure here would mean it is corrupted.
        guard let loaded = try? JSONDecoder().decode(Bundle.self, from: Data(HolidayData.json.utf8)) else {
            return Bundle(states: [], nationalHolidays: [], regionalHolidays: [:], schoolHolidays: [:])
        }
        return loaded
    }()

    /// The school holidays of one state, earliest first.
    static func schoolHolidays(for state: Bundesland) -> [SchoolHoliday] {
        (bundle.schoolHolidays[state.rawValue] ?? []).sorted { $0.start < $1.start }
    }

    /// The public holidays that apply in one state — nationwide ones plus its own — earliest first.
    static func publicHolidays(for state: Bundesland) -> [PublicHoliday] {
        (bundle.nationalHolidays + (bundle.regionalHolidays[state.rawValue] ?? [])).sorted { $0.date < $1.date }
    }

    static func isSchoolHoliday(_ day: CalendarDay, in state: Bundesland) -> Bool {
        schoolHolidays(for: state).contains { $0.contains(day) }
    }

    static func isPublicHoliday(_ day: CalendarDay, in state: Bundesland) -> Bool {
        publicHolidays(for: state).contains { $0.date == day }
    }

    /// Whether lessons happen on `day`: not a weekend, not a holiday, not a Feiertag.
    static func isSchoolDay(_ day: CalendarDay, in state: Bundesland) -> Bool {
        !day.isWeekend && !isPublicHoliday(day, in: state) && !isSchoolHoliday(day, in: state)
    }

    /// The holiday `day` currently falls in, if any.
    static func currentSchoolHoliday(on day: CalendarDay, in state: Bundesland) -> SchoolHoliday? {
        schoolHolidays(for: state).first { $0.contains(day) }
    }

    /// The next school holiday that has not started yet, or the one running now.
    static func nextSchoolHoliday(from day: CalendarDay, in state: Bundesland) -> SchoolHoliday? {
        if let current = currentSchoolHoliday(on: day, in: state) { return current }
        return schoolHolidays(for: state).first { $0.start > day }
    }

    /// The next public holiday from `day` on, `day` itself included.
    static func nextPublicHoliday(from day: CalendarDay, in state: Bundesland) -> PublicHoliday? {
        publicHolidays(for: state).first { $0.date >= day }
    }

    /// School days from `start` through `end`, both included when they are school days: how many more days of
    /// school stand between now and an exam.
    static func schoolDays(from start: CalendarDay, through end: CalendarDay, in state: Bundesland) -> Int {
        guard end >= start else { return 0 }
        var count = 0
        var day = start
        while day <= end {
            if isSchoolDay(day, in: state) { count += 1 }
            day = day.adding(days: 1)
        }
        return count
    }
}
