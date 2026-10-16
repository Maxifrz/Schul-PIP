import Foundation

/// How a finished step of the path stands with the goals behind it: finishing it is one thing, the goals sitting is
/// another.
enum NodeMastery: Equatable {
    /// Nothing to say: the step has no goals (a chest) or the course tracks none (the student's own cards).
    case none
    /// Finished; at least one of its goals is not reached yet.
    case worked
    /// Finished, and every goal it shows evidence of is reached.
    case sits
    /// Finished and reached before, but a review of one of its goals is due.
    case due
}

/// The goals of a unit that are reached, for the unit's banner.
struct UnitMastery: Equatable {
    let reached: Int
    let total: Int
    let due: Int

    var isEmpty: Bool { total == 0 }

    /// "2 von 4 erreicht", with the reviews that are due: "2 von 4 erreicht, 1 fällig".
    var text: String {
        let base = "\(reached) von \(total) erreicht"
        return due > 0 ? base + ", \(due) fällig" : base
    }
}

/// What the path shows of the skills: the map of the course and where each goal stands today. Plain values, so the
/// rules are tested without a screen.
struct PathMastery: Equatable {
    let map: SkillMap
    let statuses: [String: SkillStatus]

    init(map: SkillMap, statuses: [String: SkillStatus]) {
        self.map = map
        self.statuses = statuses
    }

    init(map: SkillMap, records: [String: SkillRecord], completed: Set<String>, now: Date, calendar: Calendar) {
        self.map = map
        var statuses: [String: SkillStatus] = [:]
        for skill in map.skills {
            statuses[skill.id] = SkillAssessor.status(records[skill.id], skill: skill, completed: completed, now: now, calendar: calendar)
        }
        self.statuses = statuses
    }

    func unit(_ unit: CourseUnit) -> UnitMastery {
        let skills = map.skills(inUnit: unit.id)
        let states = skills.map { statuses[$0.id] ?? .notStarted }
        return UnitMastery(reached: states.filter(\.isReached).count, total: skills.count, due: states.filter { $0 == .due }.count)
    }

    func node(_ step: PathStep) -> NodeMastery {
        guard step.state == .done else { return .none }
        let skills = map.skills.filter { $0.nodeIDs.contains(step.node.id) }
        guard !skills.isEmpty else { return .none }
        let states = skills.map { statuses[$0.id] ?? .notStarted }
        if states.contains(.due) { return .due }
        return states.allSatisfy { $0 == .provisional || $0 == .mastered } ? .sits : .worked
    }
}
