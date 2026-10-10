import Foundation

/// What a course is about; the Lernpfad groups its course picker by this.
enum CourseKind: String, Equatable, CaseIterable {
    case language, school, math, chess, music

    var title: String {
        switch self {
        case .language: return "Sprachen"
        case .school: return "Schulfächer"
        case .math: return "Mathe"
        case .chess: return "Schach"
        case .music: return "Musik"
        }
    }
}

/// The steps of a unit, in the order of the path.
enum NodeKind: String, Equatable {
    /// A new lesson.
    case lesson
    /// A round over what the unit taught.
    case practice
    /// The unit's test: the longest round, and the one that marks the unit as learned.
    case checkpoint
    /// A reward in gems; tapping it opens it.
    case chest
}

struct CourseNode: Identifiable, Equatable, Hashable {
    /// Unique across all courses, like "es.u03.l2". It is also what the progress stores as done.
    let id: String
    let courseID: String
    let unitID: String
    /// The unit's number in the course, from 1.
    let unitNumber: Int
    let kind: NodeKind
    /// Among the lessons of its unit from 1; always 1 for the other kinds.
    let index: Int
    let title: String
}

struct CourseUnit: Identifiable, Equatable {
    let id: String
    /// From 1, across the sections of the course.
    let number: Int
    let title: String
    /// One line under the title: what the unit is about.
    let summary: String
    /// The unit's guide: what to know before the first lesson. Short paragraphs separated by blank lines.
    let tip: String
    let nodes: [CourseNode]

    /// Three lessons, a practice round, the checkpoint and a chest, as on the path.
    static func standard(courseID: String, number: Int, title: String, summary: String, tip: String, lessons: Int = 3) -> CourseUnit {
        let unitID = "\(courseID).u" + (number < 10 ? "0\(number)" : "\(number)")
        func node(_ suffix: String, _ kind: NodeKind, _ index: Int, _ title: String) -> CourseNode {
            CourseNode(id: "\(unitID).\(suffix)", courseID: courseID, unitID: unitID, unitNumber: number, kind: kind, index: index, title: title)
        }
        var nodes = (1...max(1, lessons)).map { node("l\($0)", .lesson, $0, "Lektion \($0)") }
        nodes.append(node("p", .practice, 1, "Üben"))
        nodes.append(node("t", .checkpoint, 1, "Einheitentest"))
        nodes.append(node("k", .chest, 1, "Truhe"))
        return CourseUnit(id: unitID, number: number, title: title, summary: summary, tip: tip, nodes: nodes)
    }
}

/// A group of units under one heading, like "A1 · Erste Schritte".
struct CourseSection: Identifiable, Equatable {
    let id: String
    let title: String
    let units: [CourseUnit]
}

struct Course: Identifiable, Equatable {
    let id: String
    let title: String
    /// Who it is for and where it starts: "Für Deutschsprachige · A1".
    let subtitle: String
    let kind: CourseKind
    /// The course's color as 0xRRGGBB, like the subjects' in `Subjects`.
    let color: UInt32
    /// An SF Symbol for the course; the path shows it on the checkpoints.
    let symbol: String
    let sections: [CourseSection]

    var units: [CourseUnit] { sections.flatMap(\.units) }
    var nodes: [CourseNode] { units.flatMap(\.nodes) }

    func node(withID id: String) -> CourseNode? {
        nodes.first { $0.id == id }
    }
}

/// One course's content: its structure and the exercises of each of its steps.
protocol CourseProvider {
    var course: Course { get }

    /// The exercises of a lesson, practice or checkpoint node, 8 to 12 (a checkpoint up to 15), easy to hard. The same
    /// seed gives the same exercises; another seed shuffles the same material differently. A chest has none.
    func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise]
}

extension CourseProvider {
    /// Checks the structure the screens rely on; the tests run it for every course.
    func structureProblems() -> [String] {
        var problems: [String] = []
        let ids = course.nodes.map(\.id)
        if Set(ids).count != ids.count { problems.append("Node ids are not unique.") }
        if course.units.isEmpty { problems.append("No units.") }
        for (index, unit) in course.units.enumerated() where unit.number != index + 1 {
            problems.append("Unit \(unit.id) is number \(unit.number), expected \(index + 1).")
        }
        for unit in course.units {
            if unit.title.isEmpty || unit.tip.isEmpty { problems.append("Unit \(unit.id) has no title or tip.") }
            if !unit.nodes.contains(where: { $0.kind == .checkpoint }) { problems.append("Unit \(unit.id) has no checkpoint.") }
            for node in unit.nodes where !node.id.hasPrefix(course.id + ".") {
                problems.append("Node \(node.id) does not start with the course id.")
            }
        }
        return problems
    }
}
