import XCTest
@testable import Lernwerk

final class MaterialCourseTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 1_800_000_000)
    private let material = UUID(uuidString: "00000000-0000-0000-0000-0000000000AA")!

    private func cards(_ count: Int) -> [CardSnapshot] {
        (0..<count).map {
            CardSnapshot(front: "Frage \($0)", back: "Antwort \($0)", materialID: material, createdAt: start.addingTimeInterval(Double($0)), dueDate: start)
        }
    }

    func testTheLessonsOfAMaterialBecomeThePathOfACourse() throws {
        let unit = try XCTUnwrap(LearnPath.units(from: cards(14), completed: []).first)
        XCTAssertEqual(unit.lessons.count, 2)
        let course = MaterialCourse.course(for: unit, title: "Biologie Zelle")
        XCTAssertEqual(course.id, "material." + unit.id)
        XCTAssertTrue(MaterialCourse.isMaterialCourse(course.id))
        XCTAssertFalse(MaterialCourse.isMaterialCourse("es"))
        XCTAssertEqual(course.nodes.map(\.kind), [.lesson, .lesson, .chest])
        XCTAssertEqual(course.nodes.prefix(2).map(\.id), unit.lessons.map(\.id), "the lessons keep their ids")
        XCTAssertEqual(course.units[0].summary, "14 Karten in 2 Lektionen")
        XCTAssertEqual(course.title, "Biologie Zelle")
        XCTAssertFalse(course.units[0].tip.isEmpty)
        XCTAssertEqual(MaterialCourse.lesson(for: course.nodes[1], in: unit)?.id, unit.lessons[1].id)
        XCTAssertNil(MaterialCourse.lesson(for: course.nodes[2], in: unit))
    }

    func testTheStatesOfTheCourseFollowWhatWasFinishedBefore() throws {
        let unit = try XCTUnwrap(LearnPath.units(from: cards(14), completed: []).first)
        let course = MaterialCourse.course(for: unit, title: "Bio")
        var path = CoursePath.units(of: course, completed: [])
        XCTAssertEqual(path[0].steps.map(\.state), [.open, .locked, .locked])
        // What an earlier version saved as done (the bare lesson id) still counts.
        path = CoursePath.units(of: course, completed: [unit.lessons[0].id])
        XCTAssertEqual(path[0].steps.map(\.state), [.done, .open, .locked])
        path = CoursePath.units(of: course, completed: Set(unit.lessons.map(\.id)))
        XCTAssertEqual(CoursePath.current(in: path)?.node.kind, .chest)
        XCTAssertEqual(CoursePath.fraction(of: course, completed: [unit.lessons[0].id]), 0.5, accuracy: 0.001)
    }

    func testOneLessonStillMakesACourse() throws {
        let unit = try XCTUnwrap(LearnPath.units(from: cards(4), completed: []).first)
        let course = MaterialCourse.course(for: unit, title: "Kurz")
        XCTAssertEqual(course.units[0].summary, "4 Karten in 1 Lektion")
        XCTAssertEqual(course.nodes.count, 2)
    }
}
