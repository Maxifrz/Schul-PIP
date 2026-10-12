import Foundation

/// What an exercise asks of the student. A skill is only shown to be mastered by the higher levels: seeing the right
/// answer among others is the weakest evidence there is.
enum CompetenceLevel: String, Codable, CaseIterable, Comparable {
    /// Picking the right answer from a few: a choice, pairs, a key on the piano.
    case recognise
    /// Producing the answer from memory: typing it.
    case recall
    /// Using the knowledge: putting a sentence together, finding a move on the board, a form in a sentence.
    case apply

    var order: Int {
        switch self {
        case .recognise: return 0
        case .recall: return 1
        case .apply: return 2
        }
    }

    static func < (lhs: CompetenceLevel, rhs: CompetenceLevel) -> Bool { lhs.order < rhs.order }

    /// Points for an answer right on the first try without help.
    var weight: Double {
        switch self {
        case .recognise: return 1
        case .recall, .apply: return 2
        }
    }

    var title: String {
        switch self {
        case .recognise: return "Wiedererkennen"
        case .recall: return "Abrufen"
        case .apply: return "Anwenden"
        }
    }

    /// The level an exercise has when the course does not say otherwise.
    static func standard(for kind: ExerciseKind) -> CompetenceLevel {
        switch kind {
        case .multipleChoice, .matchPairs, .pianoKey: return .recognise
        case .typeAnswer: return .recall
        case .wordBank, .chessMove: return .apply
        }
    }
}

/// One thing a unit teaches, as a course declares it: "Wortschatz", "Anwenden am Brett".
struct SkillFacet: Equatable {
    /// Unique within the unit: "vocab", "board".
    let key: String
    let title: String
    /// The goal in a sentence the student reads: "Du erkennst die Wörter und rufst sie ohne Auswahl ab."
    let goal: String
    /// The levels the unit's exercises have for this facet. Mastery needs evidence at every level above recognising
    /// that is listed here, so a goal with typing in it is not mastered by choosing alone.
    let levels: [CompetenceLevel]
    /// Facets of the same unit that come first.
    var requires: [String] = []
    /// The facet of the previous unit this one builds on, if that unit has it.
    var after: String? = nil
}

/// Which facet an exercise belongs to, and at which level it asks.
struct SkillTag: Equatable {
    let facet: String
    let level: CompetenceLevel
}

/// A learning goal with its prerequisites. Ids are stable: unit id and facet key, so progress survives a new version
/// of the app as long as the course keeps its ids.
struct Skill: Identifiable, Equatable {
    let id: String
    let courseID: String
    let unitID: String
    let unitNumber: Int
    let unitTitle: String
    let facet: String
    let title: String
    let goal: String
    let levels: [CompetenceLevel]
    /// Skills that should be reached (at least provisionally) first. Soft: they steer what is suggested, never lock a step.
    let prerequisites: [String]
    /// The lessons, the practice round and the checkpoint of the unit: the steps that show evidence of the skill.
    let nodeIDs: [String]
}

/// The skills of a course and how they depend on each other.
struct SkillMap: Equatable {
    let courseID: String
    let skills: [Skill]

    func skill(_ id: String) -> Skill? { skills.first { $0.id == id } }

    func skills(inUnit unitID: String) -> [Skill] { skills.filter { $0.unitID == unitID } }

    /// Skills that need this one.
    func dependents(of id: String) -> [Skill] { skills.filter { $0.prerequisites.contains(id) } }

    /// Problems of the structure itself: a course with any of them is not shipped.
    func problems() -> [String] {
        var problems: [String] = []
        let ids = Set(skills.map(\.id))
        if ids.count != skills.count { problems.append("duplicate skill ids") }
        for skill in skills {
            if skill.levels.isEmpty { problems.append("\(skill.id): no levels") }
            if skill.nodeIDs.isEmpty { problems.append("\(skill.id): no steps") }
            for prerequisite in skill.prerequisites where !ids.contains(prerequisite) {
                problems.append("\(skill.id): unknown prerequisite \(prerequisite)")
            }
            if skill.prerequisites.contains(skill.id) { problems.append("\(skill.id): needs itself") }
        }
        // Cycles: a depth-first walk that meets a skill on its own way down.
        var state: [String: Int] = [:]
        func visit(_ id: String) -> Bool {
            if state[id] == 2 { return true }
            if state[id] == 1 { return false }
            state[id] = 1
            for next in skill(id)?.prerequisites ?? [] where ids.contains(next) {
                if !visit(next) { return false }
            }
            state[id] = 2
            return true
        }
        for skill in skills where !visit(skill.id) {
            problems.append("\(skill.id): prerequisites form a cycle")
            break
        }
        return problems
    }

    static func build(for provider: any CourseProvider) -> SkillMap {
        let course = provider.course
        var skills: [Skill] = []
        var previousFacets: [String: String] = [:]
        for unit in course.units {
            let facets = provider.skillFacets(of: unit)
            let nodes = unit.nodes.filter { $0.kind != .chest }.map(\.id)
            var current: [String: String] = [:]
            for facet in facets {
                let id = unit.id + "." + facet.key
                current[facet.key] = id
                var prerequisites = facet.requires.map { unit.id + "." + $0 }
                if let after = facet.after, let earlier = previousFacets[after] { prerequisites.append(earlier) }
                skills.append(Skill(
                    id: id, courseID: course.id, unitID: unit.id, unitNumber: unit.number, unitTitle: unit.title,
                    facet: facet.key, title: facet.title, goal: facet.goal, levels: facet.levels,
                    prerequisites: prerequisites, nodeIDs: nodes
                ))
            }
            previousFacets = current
        }
        return SkillMap(courseID: course.id, skills: skills)
    }
}

extension CourseProvider {
    /// By default a unit is one skill: its topic, shown by choosing and by typing. Engines with more to say override this.
    func skillFacets(of unit: CourseUnit) -> [SkillFacet] {
        [SkillFacet(
            key: "main", title: unit.title, goal: "Du beherrschst: " + unit.summary,
            levels: [.recognise, .recall], after: "main"
        )]
    }

    func skillTag(for exercise: LearnExercise, node: CourseNode) -> SkillTag {
        SkillTag(facet: "main", level: .standard(for: exercise.kind))
    }

    func feedback(for exercise: LearnExercise, answer: LearnAnswer) -> String? { nil }

    /// The exercises of a step with the skill and level each one shows evidence of. A tag that names a facet the
    /// unit does not declare is dropped, so evidence never goes to a skill that is not on the map.
    func lessonExercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] {
        let facets = Set(course.units.first { $0.id == node.unitID }.map { skillFacets(of: $0).map(\.key) } ?? [])
        return exercises(for: node, seed: seed).map { exercise in
            var tagged = exercise
            let tag = skillTag(for: exercise, node: node)
            if facets.contains(tag.facet) {
                tagged.skill = node.unitID + "." + tag.facet
                tagged.level = tag.level
            }
            return tagged
        }
    }

    func skillMap() -> SkillMap { SkillMap.build(for: self) }
}
