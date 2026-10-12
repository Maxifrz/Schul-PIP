import Foundation

/// Every skill's record, saved as one value. A record whose skill no longer exists is simply never read.
struct SkillProgress: Codable, Equatable {
    var records: [String: SkillRecord] = [:]

    init() {}

    private enum CodingKeys: String, CodingKey { case records }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        records = (try? container.decodeIfPresent([String: SkillRecord].self, forKey: .records)) ?? [:]
    }
}

/// The skill maps of the shipped courses, built once.
final class SkillMaps: @unchecked Sendable {
    static let shared = SkillMaps()

    private let lock = NSLock()
    private var cache: [String: SkillMap] = [:]

    static func map(for provider: any CourseProvider) -> SkillMap {
        shared.map(for: provider)
    }

    func map(for provider: any CourseProvider) -> SkillMap {
        let id = provider.course.id
        lock.lock()
        if let known = cache[id] {
            lock.unlock()
            return known
        }
        lock.unlock()
        let built = provider.skillMap()
        lock.lock()
        cache[id] = built
        lock.unlock()
        return built
    }
}

/// The skills in UserDefaults, like `LearnProgressStore`.
final class SkillStore: ObservableObject {
    static let key = "learn.skills"

    @Published private(set) var progress: SkillProgress

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        progress = defaults.data(forKey: SkillStore.key).flatMap { try? JSONDecoder().decode(SkillProgress.self, from: $0) } ?? SkillProgress()
    }

    var records: [String: SkillRecord] { progress.records }

    /// A step was opened.
    func begin(node: CourseNode, map: SkillMap) {
        var updated = progress
        SkillAssessor.begin(node: node, map: map, into: &updated.records)
        guard updated != progress else { return }
        progress = updated
        save()
    }

    /// Counts a finished round once; the caller has already made sure the run is new.
    func record(outcomes: [ExerciseOutcome], node: CourseNode?, map: SkillMap, now: Date, calendar: Calendar) {
        var updated = progress
        SkillAssessor.record(outcomes: outcomes, node: node, map: map, into: &updated.records, now: now, calendar: calendar)
        guard updated != progress else { return }
        progress = updated
        save()
    }

    private func save() {
        if let data = try? JSONEncoder().encode(progress) {
            defaults.set(data, forKey: SkillStore.key)
        }
    }
}
