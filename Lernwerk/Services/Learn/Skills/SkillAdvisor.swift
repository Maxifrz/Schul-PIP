import Foundation

/// What the Lernen tab suggests next, and why.
struct Recommendation: Equatable {
    enum Kind: Equatable {
        /// Skills reached before are due again.
        case review
        /// Skills that are shaky, or that the next step builds on.
        case practice
        /// The next step of the path.
        case step
        /// Nothing is left: the course is done and nothing is due.
        case finished
    }

    let kind: Kind
    let title: String
    let reason: String
    let skillIDs: [String]
    let step: PathStep?
}

/// Chooses the next sensible thing from the path and the skills. Nothing here locks a step: the path stays as it is,
/// and the advice says when another round would help more than the next lesson.
enum SkillAdvisor {
    static let mostSkillsPerRound = 3

    static func recommend(
        map: SkillMap, records: [String: SkillRecord], units: [PathUnit], completed: Set<String>, now: Date, calendar: Calendar
    ) -> Recommendation {
        func status(_ skill: Skill) -> SkillStatus {
            SkillAssessor.status(records[skill.id], skill: skill, completed: completed, now: now, calendar: calendar)
        }
        let today = LearnDay(now, calendar: calendar)
        let step = CoursePath.current(in: units)

        // 1. Reviews that are due, the longest overdue first.
        let due = map.skills.filter { status($0) == .due }.sorted { a, b in
            let first = records[a.id]?.dueDay.flatMap { $0.days(to: today, calendar: calendar) } ?? 0
            let second = records[b.id]?.dueDay.flatMap { $0.days(to: today, calendar: calendar) } ?? 0
            return first != second ? first > second : a.id < b.id
        }
        if !due.isEmpty {
            let chosen = Array(due.prefix(mostSkillsPerRound))
            let names = chosen.map(\.title).joined(separator: ", ")
            return Recommendation(
                kind: .review, title: "Wiederholen: " + names,
                reason: due.count == 1 ? "Das hast du schon gekonnt. Jetzt festigst du es." : "Das hast du schon gekonnt. Jetzt festigst du es, bevor es verblasst.",
                skillIDs: chosen.map(\.id), step: nil
            )
        }

        // 2. What the next step builds on and the student does not yet do well.
        if let step, let unit = units.first(where: { $0.steps.contains { $0.id == step.id } }) {
            let weakPrerequisites = map.skills(inUnit: unit.unit.id).flatMap { skill in
                skill.prerequisites.compactMap { map.skill($0) }
            }.filter { prerequisite in
                let state = status(prerequisite)
                return !state.isReached && state != .notStarted && isWeak(records[prerequisite.id], skill: prerequisite)
            }
            var seen = Set<String>()
            let unique = weakPrerequisites.filter { seen.insert($0.id).inserted }
            if !unique.isEmpty {
                let chosen = Array(unique.prefix(mostSkillsPerRound))
                return Recommendation(
                    kind: .practice, title: "Erst festigen: " + chosen.map(\.title).joined(separator: ", "),
                    reason: "Die nächste Lektion baut darauf auf, und es klappt noch nicht sicher.",
                    skillIDs: chosen.map(\.id), step: step
                )
            }
        }

        // 3. A skill of a finished unit that went badly.
        let shaky = map.skills.filter { skill in
            let state = status(skill)
            return (state == .worked || state == .practicing) && isWeak(records[skill.id], skill: skill)
                && skill.nodeIDs.allSatisfy { completed.contains($0) }
        }
        if !shaky.isEmpty {
            let chosen = Array(shaky.prefix(mostSkillsPerRound))
            return Recommendation(
                kind: .practice, title: "Üben: " + chosen.map(\.title).joined(separator: ", "),
                reason: "Die Lektionen sind durch, aber die Antworten sind noch nicht sicher.", skillIDs: chosen.map(\.id), step: step
            )
        }

        if let step {
            return Recommendation(kind: .step, title: "Weiter mit " + stepTitle(step, in: units), reason: "Der nächste Schritt auf deinem Pfad.", skillIDs: [], step: step)
        }
        return Recommendation(kind: .finished, title: "Kurs geschafft", reason: "Es ist nichts fällig. Beim nächsten Mal wiederholst du, was fällig wird.", skillIDs: [], step: nil)
    }

    /// Weak: some answers exist and the recent ones were mostly wrong or helped.
    static func isWeak(_ record: SkillRecord?, skill: Skill) -> Bool {
        guard let record, record.attempts >= 3, let accuracy = record.recentAccuracy else { return false }
        return accuracy < SkillAssessor.weakAccuracy
    }

    static func stepTitle(_ step: PathStep, in units: [PathUnit]) -> String {
        let unit = units.first { $0.steps.contains { $0.id == step.id } }
        let name: String
        switch step.node.kind {
        case .lesson: name = "Lektion \(step.node.index)"
        case .practice: name = "der Übungsrunde"
        case .checkpoint: name = "dem Einheitentest"
        case .chest: name = "der Truhe"
        }
        return unit.map { "\(name) · \($0.unit.title)" } ?? name
    }
}

/// A round made of the exercises that fit what a skill still needs.
enum SkillPractice {
    static let size = 10
    static let minimum = 6

    /// Exercises for the target skills. Levels the student answers badly or never met are drawn more often; levels
    /// answered well in the recent past less often. Same seed, same round.
    static func exercises(
        provider: any CourseProvider, map: SkillMap, targets: [String], records: [String: SkillRecord], seed: UInt64
    ) -> [LearnExercise] {
        let targetSet = Set(targets)
        let wanted = map.skills.filter { targetSet.contains($0.id) }
        guard !wanted.isEmpty else { return [] }
        var nodeIDs: [String] = []
        for skill in wanted { for id in skill.nodeIDs where !nodeIDs.contains(id) { nodeIDs.append(id) } }
        var pool: [LearnExercise] = []
        var rest: [LearnExercise] = []
        var seen = Set<String>()
        for (index, id) in nodeIDs.enumerated() {
            guard let node = provider.course.node(withID: id) else { continue }
            let batch = provider.lessonExercises(for: node, seed: seed &+ UInt64(index) &* 7919)
            for exercise in batch where !exercise.skill.isEmpty && seen.insert(exercise.id).inserted {
                if targetSet.contains(exercise.skill) { pool.append(exercise) } else { rest.append(exercise) }
            }
        }
        guard !pool.isEmpty else { return [] }
        var weighted = pool.map { exercise -> (LearnExercise, Double) in
            (exercise, weight(of: exercise, records: records, map: map))
        }
        // A goal with few exercises gets company from the same units, so a round is never a handful of questions.
        if pool.count < minimum {
            weighted += rest.map { ($0, 0.3 * weight(of: $0, records: records, map: map)) }
        }
        var random = LearnRandom(seed: seed ^ 0xA5A5_5A5A_1234_5678)
        var picked: [LearnExercise] = []
        while picked.count < size, !weighted.isEmpty {
            let total = weighted.reduce(0.0) { $0 + $1.1 }
            var roll = Double.random(in: 0..<max(total, 0.0001), using: &random)
            var choice = weighted.count - 1
            for (index, entry) in weighted.enumerated() {
                roll -= entry.1
                if roll < 0 { choice = index; break }
            }
            picked.append(weighted.remove(at: choice).0)
        }
        return Exercises.arrange(picked, limit: size)
    }

    static func weight(of exercise: LearnExercise, records: [String: SkillRecord], map: SkillMap) -> Double {
        guard let level = exercise.level else { return 1 }
        let tally = records[exercise.skill]?.tally(level) ?? SkillRecord.Tally()
        guard let accuracy = tally.recentAccuracy else { return 2 }
        if accuracy < SkillAssessor.weakAccuracy { return 3 }
        if accuracy >= 0.9, tally.attempts >= 6 { return 0.5 }
        return 1
    }
}

/// Skipping a unit by passing its test, for a student who knows it already.
enum TestOut {
    static let passRate = 0.85

    /// The unit that may be tested out: the first one not done, if nothing of it was done yet.
    static func candidate(in units: [PathUnit]) -> PathUnit? {
        guard let unit = units.first(where: { !$0.isDone }), unit.doneCount == 0,
              unit.steps.first?.state == .open else { return nil }
        return unit
    }

    static func passed(_ result: LessonResult) -> Bool {
        result.exerciseCount >= 10 && result.accuracy >= passRate
    }

    /// The steps a pass marks as done: everything but the chest, which the student opens.
    static func nodesToComplete(in unit: CourseUnit) -> [String] {
        unit.nodes.filter { $0.kind != .chest }.map(\.id)
    }
}
