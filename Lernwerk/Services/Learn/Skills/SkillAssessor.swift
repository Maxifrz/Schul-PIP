import Foundation

/// One answer of a round as the skills see it: the first attempt of an exercise.
struct ExerciseOutcome: Codable, Equatable {
    let exerciseID: String
    let skill: String
    let level: CompetenceLevel
    /// Right on the first attempt.
    let right: Bool
    /// A hint was shown before the answer.
    let helped: Bool
}

/// Where a skill stands. Finishing a lesson only gets a skill to "worked"; everything above needs answers.
enum SkillStatus: String, Codable, CaseIterable {
    /// No step of it was opened.
    case notStarted
    /// A lesson was begun and not finished.
    case started
    /// A step was finished, but the answers do not yet show much.
    case worked
    /// Enough right answers to say the student is practising it well, short of the criteria for being reached.
    case practicing
    /// The criteria are met once: enough right answers at every level, and a good recent run.
    case provisional
    /// Reached, and confirmed on a later day.
    case mastered
    /// Reached before, and the review is due.
    case due

    var title: String {
        switch self {
        case .notStarted: return "Noch nicht begonnen"
        case .started: return "Begonnen"
        case .worked: return "Bearbeitet"
        case .practicing: return "Geübt"
        case .provisional: return "Vorläufig erreicht"
        case .mastered: return "Beherrscht"
        case .due: return "Wiederholung fällig"
        }
    }

    /// Reached at least once: later skills may build on it.
    var isReached: Bool { self == .provisional || self == .mastered || self == .due }
}

/// What one skill has shown so far. Plain values; the day and the calendar always come in as parameters.
struct SkillRecord: Codable, Equatable {
    struct Tally: Codable, Equatable {
        var attempts = 0
        /// First try, no hint.
        var right = 0
        var helped = 0
        var points = 0.0
        /// The last eight answers, true for right on the first try without a hint.
        var recent: [Bool] = []

        var recentAccuracy: Double? {
            recent.isEmpty ? nil : Double(recent.filter { $0 }.count) / Double(recent.count)
        }
    }

    /// The spaced review of the skill: one step per day, from how that day's answers went.
    struct Schedule: Codable, Equatable {
        var repetitions = 0
        var intervalDays = 0
        var ease = SchedulingState.initialEase
        var lapses = 0
        /// The last day a review step was taken.
        var reviewDay: LearnDay?
        var dueDay: LearnDay?
        /// The day the criteria were first met (again after a lapse).
        var provisionalDay: LearnDay?
        /// Good days after `provisionalDay`.
        var confirmations = 0

        init() {}

        private enum CodingKeys: String, CodingKey {
            case repetitions, intervalDays, ease, lapses, reviewDay, dueDay, provisionalDay, confirmations
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            func value<T: Decodable>(_ key: CodingKeys, _ fallback: T) -> T {
                (try? container.decodeIfPresent(T.self, forKey: key)) ?? fallback
            }
            repetitions = max(0, value(.repetitions, 0))
            intervalDays = max(0, value(.intervalDays, 0))
            ease = max(SchedulingState.minimumEase, value(.ease, SchedulingState.initialEase))
            lapses = max(0, value(.lapses, 0))
            reviewDay = value(.reviewDay, nil as LearnDay?)
            dueDay = value(.dueDay, nil as LearnDay?)
            provisionalDay = value(.provisionalDay, nil as LearnDay?)
            confirmations = max(0, value(.confirmations, 0))
        }
    }

    var tallies: [String: Tally] = [:]
    /// The last ten answers over all levels.
    var recent: [Bool] = []
    var started: Set<String> = []
    var worked: Set<String> = []
    var days: [LearnDay] = []
    var schedule = Schedule()
    /// The day the counters below belong to, with the answers and the clean ones of that day, and the schedule as it
    /// was before that day's review, so the review can be worked out again as the day's answers come in.
    var today: LearnDay?
    var answersToday = 0
    var cleanToday = 0
    var scheduleBeforeToday = Schedule()

    var provisionalDay: LearnDay? { schedule.provisionalDay }
    var confirmations: Int { schedule.confirmations }
    var dueDay: LearnDay? { schedule.dueDay }
    var lapses: Int { schedule.lapses }
    var repetitions: Int { schedule.repetitions }

    init() {}

    // A saved record from an older version lacks newer fields; each one falls back on its default.
    private enum CodingKeys: String, CodingKey {
        case tallies, recent, started, worked, days, schedule, today, answersToday, cleanToday, scheduleBeforeToday
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        func value<T: Decodable>(_ key: CodingKeys, _ fallback: T) -> T {
            (try? container.decodeIfPresent(T.self, forKey: key)) ?? fallback
        }
        tallies = value(.tallies, [String: Tally]())
        recent = value(.recent, [Bool]())
        started = value(.started, Set<String>())
        worked = value(.worked, Set<String>())
        days = value(.days, [LearnDay]())
        schedule = value(.schedule, Schedule())
        today = value(.today, nil as LearnDay?)
        answersToday = max(0, value(.answersToday, 0))
        cleanToday = max(0, value(.cleanToday, 0))
        scheduleBeforeToday = value(.scheduleBeforeToday, Schedule())
    }

    func tally(_ level: CompetenceLevel) -> Tally { tallies[level.rawValue] ?? Tally() }

    var attempts: Int { tallies.values.reduce(0) { $0 + $1.attempts } }

    var recentAccuracy: Double? {
        recent.isEmpty ? nil : Double(recent.filter { $0 }.count) / Double(recent.count)
    }
}

extension LearnDay {
    func adding(days count: Int, calendar: Calendar) -> LearnDay? {
        guard let noon = calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12)),
              let moved = calendar.date(byAdding: .day, value: count, to: noon) else { return nil }
        return LearnDay(moved, calendar: calendar)
    }
}

/// The rules that turn answers into a status. They are the whole definition of "mastered": no screen decides it.
enum SkillAssessor {
    /// Points that count towards recognising when the skill also asks for more: recognising is the weakest proof.
    static let recognitionCapWithHigherLevels = 4.0
    static let recognitionCapAlone = 10.0
    /// Points a skill needs in all: eight is four typed answers, or two typed and four recognised.
    static let pointsForReached = 8.0
    /// Points at each level above recognising that the skill asks for.
    static let pointsPerHigherLevel = 2.0
    /// A finished lesson and a few right answers: practising.
    static let pointsForPractising = 4.0
    static let attemptsForReached = 8
    static let accuracyForReached = 0.75
    /// A round counts as a review session with at least this many answers for the skill.
    static let answersForSession = 3
    /// The most points one round can add to one skill, so a long run of easy answers does not do it alone.
    static let pointsPerRound = 12.0
    static let weakAccuracy = 0.7

    // MARK: Recording

    /// Counts a finished round. `node` is the step the round came from (nil for a mixed practice round).
    static func record(
        outcomes: [ExerciseOutcome], node: CourseNode?, map: SkillMap, into records: inout [String: SkillRecord],
        now: Date, calendar: Calendar
    ) {
        let today = LearnDay(now, calendar: calendar)
        var seen = Set<String>()
        let unique = outcomes.filter { seen.insert($0.exerciseID).inserted && map.skill($0.skill) != nil }
        let bySkill = Dictionary(grouping: unique, by: \.skill)
        for (id, list) in bySkill {
            guard let skill = map.skill(id) else { continue }
            var record = records[id] ?? SkillRecord()
            var added = 0.0
            for outcome in list {
                var tally = record.tally(outcome.level)
                tally.attempts += 1
                let clean = outcome.right && !outcome.helped
                if outcome.helped { tally.helped += 1 }
                if clean { tally.right += 1 }
                var gain = 0.0
                if outcome.right { gain = outcome.level.weight * (outcome.helped ? 0.5 : 1) }
                gain = min(gain, pointsPerRound - added)
                added += gain
                tally.points += gain
                tally.recent = Array((tally.recent + [clean]).suffix(8))
                record.tallies[outcome.level.rawValue] = tally
                record.recent = Array((record.recent + [clean]).suffix(10))
            }
            if record.days.last != today { record.days = Array((record.days + [today]).suffix(60)) }
            if let node, skill.nodeIDs.contains(node.id) { record.worked.insert(node.id) }
            if record.today != today {
                record.today = today
                record.answersToday = 0
                record.cleanToday = 0
                record.scheduleBeforeToday = record.schedule
            }
            record.answersToday += list.count
            record.cleanToday += list.filter { $0.right && !$0.helped }.count
            review(&record, today: today, calendar: calendar)
            if record.schedule.provisionalDay == nil, meetsCriteria(record, skill: skill) { record.schedule.provisionalDay = today }
            records[id] = record
        }
        if let node {
            // A step finished with no answer for a skill still counts as worked on it.
            for skill in map.skills where skill.nodeIDs.contains(node.id) && bySkill[skill.id] == nil {
                var record = records[skill.id] ?? SkillRecord()
                record.worked.insert(node.id)
                records[skill.id] = record
            }
        }
    }

    static func begin(node: CourseNode, map: SkillMap, into records: inout [String: SkillRecord]) {
        for skill in map.skills where skill.nodeIDs.contains(node.id) {
            var record = records[skill.id] ?? SkillRecord()
            record.started.insert(node.id)
            records[skill.id] = record
        }
    }

    /// One scheduling step per skill and day, worked out from all of the day's answers and worked out again as more
    /// come in: a second round the same day adds evidence but does not push the review further away. A day with fewer
    /// than three answers for the skill takes no step.
    private static func review(_ record: inout SkillRecord, today: LearnDay, calendar: Calendar) {
        guard record.answersToday >= answersForSession else { return }
        var schedule = record.scheduleBeforeToday
        let accuracy = Double(record.cleanToday) / Double(record.answersToday)
        let grade: ReviewGrade = accuracy >= 0.85 ? .good : (accuracy >= 0.6 ? .hard : .again)
        if let reached = schedule.provisionalDay, reached != today, grade == .good {
            // A later day with a good run confirms it; a middling one does not count for or against.
            schedule.confirmations += 1
        }
        if grade == .again {
            schedule.confirmations = 0
            schedule.provisionalDay = nil
        }
        let state = SpacedRepetition.next(
            SchedulingState(intervalDays: schedule.intervalDays, easeFactor: schedule.ease, repetitions: schedule.repetitions, lapses: schedule.lapses),
            grade: grade
        )
        schedule.intervalDays = state.intervalDays
        schedule.ease = state.easeFactor
        schedule.repetitions = state.repetitions
        schedule.lapses = state.lapses
        schedule.reviewDay = today
        schedule.dueDay = today.adding(days: state.intervalDays, calendar: calendar)
        record.schedule = schedule
    }

    // MARK: Reading

    static func points(_ record: SkillRecord, skill: Skill) -> Double {
        let higher = skill.levels.contains { $0 > .recognise }
        let cap = higher ? recognitionCapWithHigherLevels : recognitionCapAlone
        return CompetenceLevel.allCases.reduce(0.0) { sum, level in
            let points = record.tally(level).points
            return sum + (level == .recognise ? min(points, cap) : points)
        }
    }

    static func meetsCriteria(_ record: SkillRecord, skill: Skill) -> Bool {
        missing(record, skill: skill, includeConfirmation: false).isEmpty
    }

    /// Why the skill is not reached yet, in sentences the student can act on. Empty when the criteria are met.
    static func missing(_ record: SkillRecord, skill: Skill, includeConfirmation: Bool = true) -> [String] {
        var reasons: [String] = []
        let total = points(record, skill: skill)
        if record.attempts < attemptsForReached || total < pointsForReached {
            reasons.append("Es fehlen noch richtige Antworten ohne Hilfe.")
        }
        for level in skill.levels where level > .recognise && record.tally(level).points < pointsPerHigherLevel {
            switch level {
            case .recall: reasons.append("Du hast noch zu wenig aus dem Kopf getippt, ohne Auswahl.")
            case .apply: reasons.append("Du hast es noch zu selten selbst angewendet.")
            case .recognise: break
            }
        }
        if let accuracy = record.recentAccuracy, accuracy < accuracyForReached {
            reasons.append("In den letzten Antworten waren noch zu viele Fehler oder Hinweise.")
        }
        if reasons.isEmpty, includeConfirmation, record.provisionalDay != nil, record.confirmations < 1 {
            reasons.append("Es fehlt noch eine gute Runde an einem anderen Tag.")
        }
        return reasons
    }

    static func status(_ record: SkillRecord?, skill: Skill, completed: Set<String>, now: Date, calendar: Calendar) -> SkillStatus {
        let record = record ?? SkillRecord()
        let today = LearnDay(now, calendar: calendar)
        let worked = !record.worked.isEmpty || skill.nodeIDs.contains { completed.contains($0) }
        if record.attempts == 0 {
            if worked { return .worked }
            return record.started.isEmpty ? .notStarted : .started
        }
        if record.provisionalDay != nil {
            let confirmed = record.confirmations >= 1 && (record.recentAccuracy ?? 0) >= accuracyForReached
            if let due = record.dueDay, let gap = due.days(to: today, calendar: calendar), gap >= 0 { return .due }
            return confirmed ? .mastered : .provisional
        }
        return points(record, skill: skill) >= pointsForPractising ? .practicing : .worked
    }

    /// Levels in which the answers are weak or missing, weakest first; what a targeted round leans on.
    static func weakLevels(_ record: SkillRecord?, skill: Skill) -> [CompetenceLevel] {
        let record = record ?? SkillRecord()
        let scored: [(CompetenceLevel, Double)] = skill.levels.map { level in
            let tally = record.tally(level)
            return (level, tally.recentAccuracy ?? -1)
        }
        return scored.filter { $0.1 < weakAccuracy }.sorted { $0.1 < $1.1 }.map(\.0)
    }
}
