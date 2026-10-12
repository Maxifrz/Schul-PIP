import XCTest
@testable import Lernwerk

/// A course made of plain data, for the path's rules.
struct SampleCourse: CourseProvider {
    var course: Course {
        let units = (1...3).map {
            CourseUnit.standard(courseID: "sample", number: $0, title: "Einheit \($0)", summary: "s", tip: "Tipp")
        }
        return Course(
            id: "sample", title: "Beispiel", subtitle: "Test", kind: .language, color: 0x336699, symbol: "globe",
            sections: [CourseSection(id: "sample.a", title: "A", units: Array(units.prefix(2))), CourseSection(id: "sample.b", title: "B", units: [units[2]])]
        )
    }

    func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] { [] }
}
