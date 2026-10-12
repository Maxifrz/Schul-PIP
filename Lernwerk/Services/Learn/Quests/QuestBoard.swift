import Foundation

/// What a quest asks for.
enum QuestKind: String, Codable, CaseIterable {
    /// Earn XP.
    case xp
    /// Finish lessons, practice rounds or checkpoints.
    case lessons
    /// Finish rounds in which every exercise was right on the first try.
    case perfect
    /// Answer exercises right on the first try, in any rounds.
    case firstTry
    /// Learn in different courses on one day.
    case courses
    /// Finish practice rounds or checkpoints.
    case practice
    /// Learn on different days of the week (weekly only).
    case days
}

struct Quest: Codable, Equatable, Identifiable {
    let id: String
    let kind: QuestKind
    let target: Int
    var progress = 0
    /// Gems for claiming it.
    let reward: Int
    var claimed = false

    var isDone: Bool { progress >= target }
    var fraction: Double { target == 0 ? 1 : min(1, Double(progress) / Double(target)) }

    /// What the student reads.
    var title: String {
        switch kind {
        case .xp: return "Sammle \(target) XP"
        case .lessons: return target == 1 ? "Schließe eine Lektion ab" : "Schließe \(target) Lektionen ab"
        case .perfect: return target == 1 ? "Eine Lektion ohne Fehler" : "\(target) Lektionen ohne Fehler"
        case .firstTry: return "Beantworte \(target) Aufgaben auf Anhieb richtig"
        case .courses: return "Lerne in \(target) verschiedenen Kursen"
        case .practice: return target == 1 ? "Schließe eine Übungsrunde ab" : "Schließe \(target) Übungsrunden ab"
        case .days: return "Lerne an \(target) Tagen"
        }
    }
}

/// A finished round, as the quests see it.
struct QuestEvent: Equatable {
    let xp: Int
    let courseID: String?
    let nodeKind: NodeKind?
    let rightFirstTry: Int
    let exerciseCount: Int

    var isPerfect: Bool { exerciseCount > 0 && rightFirstTry == exerciseCount }
    var isPractice: Bool { nodeKind == .practice || nodeKind == .checkpoint }
}

/// Three quests a day and one for the week, chosen from the date alone, so a day's quests are the same on every launch
/// and nothing needs a server. Everything takes the time and the calendar as parameters.
struct QuestBoard: Codable, Equatable {
    static let dailyCount = 3
    /// Gems for claiming all three of a day's quests.
    static let bonusGems = 20

    private(set) var day: LearnDay?
    private(set) var daily: [Quest] = []
    private(set) var bonusClaimed = false
    private var coursesToday: Set<String> = []
    private(set) var weekStart: LearnDay?
    private(set) var weekly: Quest?
    private var weekDays: Set<LearnDay> = []
    private var weekXP = 0
    private var weekLessons = 0

    init() {}

    // MARK: Choosing

    /// Variants of each kind: target and reward.
    private static func variants(_ kind: QuestKind) -> [(target: Int, reward: Int)] {
        switch kind {
        case .xp: return [(30, 10), (50, 15), (80, 20)]
        case .lessons: return [(2, 10), (3, 15), (4, 20)]
        case .perfect: return [(1, 15)]
        case .firstTry: return [(15, 10), (25, 15)]
        case .courses: return [(2, 15)]
        case .practice: return [(1, 10)]
        case .days: return [(4, 40), (5, 50)]
        }
    }

    private static let dailyKinds: [QuestKind] = [.xp, .lessons, .perfect, .firstTry, .courses, .practice]

    private static func seed(for day: LearnDay) -> UInt64 {
        UInt64(day.year * 10_000 + day.month * 100 + day.day)
    }

    static func dailyQuests(for day: LearnDay) -> [Quest] {
        var mix = SplitMix(seed: seed(for: day))
        var pool = dailyKinds
        var chosen: [Quest] = []
        // The first quest is always about XP or lessons, so every day has one that anything done counts for.
        let anchors: [QuestKind] = [.xp, .lessons]
        let anchor = anchors[Int(mix.next() % UInt64(anchors.count))]
        pool.removeAll { $0 == anchor }
        var kinds = [anchor]
        while kinds.count < dailyCount, !pool.isEmpty {
            kinds.append(pool.remove(at: Int(mix.next() % UInt64(pool.count))))
        }
        for kind in kinds {
            let options = variants(kind)
            let option = options[Int(mix.next() % UInt64(options.count))]
            chosen.append(Quest(id: "d.\(day.year)-\(day.month)-\(day.day).\(kind.rawValue)", kind: kind, target: option.target, reward: option.reward))
        }
        return chosen
    }

    static func weeklyQuest(for start: LearnDay) -> Quest {
        var mix = SplitMix(seed: seed(for: start) &+ 7)
        let kinds: [QuestKind] = [.days, .xp, .lessons]
        let kind = kinds[Int(mix.next() % UInt64(kinds.count))]
        let option: (target: Int, reward: Int)
        switch kind {
        case .xp: option = (300, 50)
        case .lessons: option = (12, 50)
        default: option = variants(.days)[Int(mix.next() % 2)]
        }
        return Quest(id: "w.\(start.year)-\(start.month)-\(start.day).\(kind.rawValue)", kind: kind, target: option.target, reward: option.reward)
    }

    // MARK: Time

    /// Starts a new day's quests and a new week's, when the day or the week has changed. A date that goes back (a
    /// changed time zone) keeps the quests of the later day.
    mutating func refresh(now: Date, calendar: Calendar) {
        var today = LearnDay(now, calendar: calendar)
        if let day, let gap = day.days(to: today, calendar: calendar), gap < 0 { today = day }
        if day != today {
            day = today
            daily = QuestBoard.dailyQuests(for: today)
            bonusClaimed = false
            coursesToday = []
        }
        let start = QuestBoard.weekStart(of: now, calendar: calendar).flatMap { candidate -> LearnDay? in
            if let current = weekStart, let gap = current.days(to: candidate, calendar: calendar), gap < 0 { return current }
            return candidate
        }
        if let start, weekStart != start {
            weekStart = start
            weekly = QuestBoard.weeklyQuest(for: start)
            weekDays = []
            weekXP = 0
            weekLessons = 0
        }
    }

    private static func weekStart(of date: Date, calendar: Calendar) -> LearnDay? {
        calendar.dateInterval(of: .weekOfYear, for: date).map { LearnDay($0.start, calendar: calendar) }
    }

    /// Seconds until midnight, for the timer on the quest tile.
    static func secondsUntilNextDay(now: Date, calendar: Calendar) -> TimeInterval {
        guard let next = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) else { return 0 }
        return max(0, next.timeIntervalSince(now))
    }

    // MARK: Progress

    /// Counts a finished round; the quests that became done with it.
    @discardableResult
    mutating func apply(_ event: QuestEvent, now: Date, calendar: Calendar) -> [Quest] {
        refresh(now: now, calendar: calendar)
        guard event.exerciseCount > 0 else { return [] }
        var finished: [Quest] = []
        if let courseID = event.courseID { coursesToday.insert(courseID) }
        for index in daily.indices {
            let before = daily[index].isDone
            daily[index].progress += gain(daily[index].kind, event, courses: coursesToday.count, current: daily[index].progress)
            if !before, daily[index].isDone { finished.append(daily[index]) }
        }
        if var quest = weekly {
            let before = quest.isDone
            if let day { weekDays.insert(day) }
            weekXP += event.xp
            weekLessons += 1
            switch quest.kind {
            case .days: quest.progress = weekDays.count
            case .xp: quest.progress = weekXP
            default: quest.progress = weekLessons
            }
            weekly = quest
            if !before, quest.isDone { finished.append(quest) }
        }
        return finished
    }

    /// How much a round moves a quest of this kind. `courses` is a count that is set, not added to.
    private func gain(_ kind: QuestKind, _ event: QuestEvent, courses: Int, current: Int) -> Int {
        switch kind {
        case .xp: return event.xp
        case .lessons: return 1
        case .perfect: return event.isPerfect ? 1 : 0
        case .firstTry: return event.rightFirstTry
        case .courses: return max(0, courses - current)
        case .practice: return event.isPractice ? 1 : 0
        case .days: return 0
        }
    }

    // MARK: Rewards

    var dailyDone: Int { daily.filter(\.isDone).count }
    var allDailyClaimed: Bool { !daily.isEmpty && daily.allSatisfy(\.claimed) }
    var bonusAvailable: Bool { allDailyClaimed && !bonusClaimed }
    var hasUnclaimed: Bool { daily.contains { $0.isDone && !$0.claimed } || (weekly.map { $0.isDone && !$0.claimed } ?? false) || bonusAvailable }

    /// Claims a finished quest; its gems, or 0 when it is not done or claimed already.
    mutating func claim(_ id: String) -> Int {
        if let index = daily.firstIndex(where: { $0.id == id }), daily[index].isDone, !daily[index].claimed {
            daily[index].claimed = true
            return daily[index].reward
        }
        if var quest = weekly, quest.id == id, quest.isDone, !quest.claimed {
            quest.claimed = true
            weekly = quest
            return quest.reward
        }
        return 0
    }

    /// The gems for claiming all of the day's quests, once.
    mutating func claimBonus() -> Int {
        guard bonusAvailable else { return 0 }
        bonusClaimed = true
        return QuestBoard.bonusGems
    }

    // Saved boards from an older version miss newer fields; each falls back on its default.

    private enum CodingKeys: String, CodingKey {
        case day, daily, bonusClaimed, coursesToday, weekStart, weekly, weekDays, weekXP, weekLessons
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        func value<T: Decodable>(_ key: CodingKeys, _ fallback: T) -> T {
            (try? container.decodeIfPresent(T.self, forKey: key)) ?? fallback
        }
        day = value(.day, nil as LearnDay?)
        daily = value(.daily, [Quest]())
        bonusClaimed = value(.bonusClaimed, false)
        coursesToday = value(.coursesToday, Set<String>())
        weekStart = value(.weekStart, nil as LearnDay?)
        weekly = value(.weekly, nil as Quest?)
        weekDays = value(.weekDays, Set<LearnDay>())
        weekXP = value(.weekXP, 0)
        weekLessons = value(.weekLessons, 0)
    }
}

/// The quests in UserDefaults, like `LearnProgressStore`.
final class QuestStore: ObservableObject {
    static let key = "learn.quests"

    @Published private(set) var board: QuestBoard

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        board = defaults.data(forKey: QuestStore.key).flatMap { try? JSONDecoder().decode(QuestBoard.self, from: $0) } ?? QuestBoard()
    }

    /// Starts today's quests if the day has changed.
    func refresh(now: Date, calendar: Calendar) {
        var updated = board
        updated.refresh(now: now, calendar: calendar)
        guard updated != board else { return }
        board = updated
        save()
    }

    /// Counts a finished round; the quests it completed.
    @discardableResult
    func record(_ event: QuestEvent, now: Date, calendar: Calendar) -> [Quest] {
        var updated = board
        let finished = updated.apply(event, now: now, calendar: calendar)
        board = updated
        save()
        return finished
    }

    /// Claims a quest (or the day's bonus with `QuestBoard.bonusID`); the gems to pay out.
    func claim(_ id: String) -> Int {
        var updated = board
        let gems = id == QuestStore.bonusID ? updated.claimBonus() : updated.claim(id)
        guard gems > 0 else { return 0 }
        board = updated
        save()
        return gems
    }

    static let bonusID = "bonus"

    private func save() {
        if let data = try? JSONEncoder().encode(board) {
            defaults.set(data, forKey: QuestStore.key)
        }
    }
}
