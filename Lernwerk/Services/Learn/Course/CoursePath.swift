import Foundation

struct PathStep: Identifiable, Equatable {
    let node: CourseNode
    let state: LessonState
    var id: String { node.id }
}

/// A unit with its steps, for the path's banner and nodes.
struct PathUnit: Identifiable, Equatable {
    let section: CourseSection
    /// The section's number in the course, from 1.
    let sectionNumber: Int
    let unit: CourseUnit
    let steps: [PathStep]
    var id: String { unit.id }

    var isDone: Bool { steps.allSatisfy { $0.state == .done } }
    var doneCount: Int { steps.filter { $0.state == .done }.count }
}

/// Which steps of a course are done, open or locked. The steps open one after the other through the whole course,
/// as on a path: exactly one step is open, the first that is not done. The finished ones come from the progress.
enum CoursePath {
    static func units(of course: Course, completed: Set<String>) -> [PathUnit] {
        // Only the first step that is not done is open; everything after it stays locked, whatever the saved set says.
        var frontierFound = false
        var result: [PathUnit] = []
        for (sectionIndex, section) in course.sections.enumerated() {
            for unit in section.units {
                var steps: [PathStep] = []
                for node in unit.nodes {
                    let state: LessonState
                    if completed.contains(node.id) {
                        state = .done
                    } else if frontierFound {
                        state = .locked
                    } else {
                        state = .open
                        frontierFound = true
                    }
                    steps.append(PathStep(node: node, state: state))
                }
                result.append(PathUnit(section: section, sectionNumber: sectionIndex + 1, unit: unit, steps: steps))
            }
        }
        return result
    }

    /// The step to do next, or nil when the course is finished.
    static func current(in units: [PathUnit]) -> PathStep? {
        units.lazy.flatMap(\.steps).first { $0.state == .open }
    }

    /// Lessons, practice rounds and checkpoints done, of all of them; chests do not count.
    static func fraction(of course: Course, completed: Set<String>) -> Double {
        let counted = course.nodes.filter { $0.kind != .chest }
        guard !counted.isEmpty else { return 0 }
        return Double(counted.filter { completed.contains($0.id) }.count) / Double(counted.count)
    }

    static func isFinished(_ course: Course, completed: Set<String>) -> Bool {
        course.nodes.allSatisfy { completed.contains($0.id) }
    }

    /// Gems in a chest: 10, 15 or 20, by the unit's number, so the course pays out the same every time.
    static func chestGems(_ node: CourseNode) -> Int {
        10 + (node.unitNumber % 3) * 5
    }

    /// The step after this one, for "next lesson" after a finished round.
    static func next(after node: CourseNode, in course: Course) -> CourseNode? {
        let nodes = course.nodes
        guard let index = nodes.firstIndex(of: node), index + 1 < nodes.count else { return nil }
        return nodes[index + 1]
    }
}

/// The courses the app ships with; each engine's provider is listed here once it exists.
enum CourseCatalog {
    static let providers: [any CourseProvider] = []

    static var courses: [Course] { providers.map(\.course) }

    static func provider(for courseID: String) -> (any CourseProvider)? {
        providers.first { $0.course.id == courseID }
    }

    static func provider(forNode nodeID: String) -> (any CourseProvider)? {
        providers.first { $0.course.id + "." == String(nodeID.prefix($0.course.id.count + 1)) }
    }
}
