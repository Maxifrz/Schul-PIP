import XCTest
@testable import Lernwerk

final class CoursePathTests: XCTestCase {
    private let sample = SampleCourse()

    func testAUnitHasThreeLessonsPracticeCheckpointAndChest() {
        let unit = sample.course.units[0]
        XCTAssertEqual(unit.id, "sample.u01")
        XCTAssertEqual(unit.nodes.map(\.id), ["sample.u01.l1", "sample.u01.l2", "sample.u01.l3", "sample.u01.p", "sample.u01.t", "sample.u01.k"])
        XCTAssertEqual(unit.nodes.map(\.kind), [.lesson, .lesson, .lesson, .practice, .checkpoint, .chest])
        XCTAssertEqual(unit.nodes.map(\.index), [1, 2, 3, 1, 1, 1])
        XCTAssertEqual(sample.course.nodes.count, 18)
        XCTAssertEqual(sample.course.node(withID: "sample.u02.t")?.unitNumber, 2)
        XCTAssertTrue(sample.structureProblems().isEmpty, "\(sample.structureProblems())")
        XCTAssertEqual(CourseUnit.standard(courseID: "x", number: 12, title: "T", summary: "", tip: "t", lessons: 4).id, "x.u12")
        XCTAssertEqual(CourseUnit.standard(courseID: "x", number: 1, title: "T", summary: "", tip: "t", lessons: 4).nodes.count, 7)
    }

    func testStepsOpenOneAfterTheOtherThroughTheWholeCourse() {
        var done: Set<String> = []
        var units = CoursePath.units(of: sample.course, completed: done)
        XCTAssertEqual(units.count, 3)
        XCTAssertEqual(units[0].steps.map(\.state), [.open, .locked, .locked, .locked, .locked, .locked])
        XCTAssertEqual(units[1].steps.first?.state, .locked)
        XCTAssertEqual(CoursePath.current(in: units)?.id, "sample.u01.l1")
        XCTAssertEqual([units[0].sectionNumber, units[2].sectionNumber], [1, 2])

        for node in sample.course.units[0].nodes { done.insert(node.id) }
        units = CoursePath.units(of: sample.course, completed: done)
        XCTAssertTrue(units[0].isDone)
        XCTAssertEqual(units[1].steps.first?.state, .open, "the next unit opens when the chest is open")
        XCTAssertEqual(CoursePath.current(in: units)?.id, "sample.u02.l1")

        // Skipping ahead in the saved set does not open a step whose predecessor is not done.
        done = ["sample.u01.l1", "sample.u01.l3"]
        units = CoursePath.units(of: sample.course, completed: done)
        XCTAssertEqual(units[0].steps.map(\.state), [.done, .open, .done, .locked, .locked, .locked])
    }

    func testProgressCountsEverythingButChests() {
        var done = Set(sample.course.units[0].nodes.map(\.id))
        XCTAssertEqual(CoursePath.fraction(of: sample.course, completed: done), 5.0 / 15.0, accuracy: 0.0001)
        done.remove("sample.u01.k")
        XCTAssertEqual(CoursePath.fraction(of: sample.course, completed: done), 5.0 / 15.0, accuracy: 0.0001)
        XCTAssertEqual(CoursePath.fraction(of: sample.course, completed: Set(sample.course.nodes.map(\.id))), 1)
        XCTAssertTrue(CoursePath.isFinished(sample.course, completed: Set(sample.course.nodes.map(\.id))))
        XCTAssertFalse(CoursePath.isFinished(sample.course, completed: done))
        XCTAssertNil(CoursePath.current(in: CoursePath.units(of: sample.course, completed: Set(sample.course.nodes.map(\.id)))))
    }

    func testChestsPayTenFifteenOrTwenty() {
        let chests = sample.course.nodes.filter { $0.kind == .chest }
        XCTAssertEqual(chests.map(CoursePath.chestGems), [15, 20, 10])
    }

    func testNextNodeAndTheCatalogsLookup() {
        let course = sample.course
        XCTAssertEqual(CoursePath.next(after: course.nodes[0], in: course)?.id, "sample.u01.l2")
        XCTAssertNil(CoursePath.next(after: course.nodes.last!, in: course))
        for provider in CourseCatalog.providers {
            XCTAssertEqual(CourseCatalog.provider(forNode: provider.course.nodes[0].id)?.course.id, provider.course.id)
        }
    }

    func testStructureProblemsAreFound() {
        struct Broken: CourseProvider {
            var course: Course {
                let good = CourseUnit.standard(courseID: "broken", number: 1, title: "T", summary: "", tip: "t")
                let twin = CourseUnit.standard(courseID: "broken", number: 1, title: "", summary: "", tip: "")
                return Course(id: "broken", title: "B", subtitle: "", kind: .math, color: 0, symbol: "x", sections: [CourseSection(id: "s", title: "S", units: [good, twin])])
            }
            func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] { [] }
        }
        let problems = Broken().structureProblems()
        XCTAssertTrue(problems.contains { $0.contains("not unique") })
        XCTAssertTrue(problems.contains { $0.contains("no title or tip") })
        XCTAssertTrue(problems.contains { $0.contains("expected 2") })
    }
}
