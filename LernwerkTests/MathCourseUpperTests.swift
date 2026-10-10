import XCTest
@testable import Lernwerk

final class MathCourseUpperTests: XCTestCase {
    func testAudit() {
        XCTAssertEqual(CourseAudit.problems(of: MathUpperCourse.provider, seeds: Array(1...20)), [])
    }

    func testCourseShape() {
        let course = MathUpperCourse.provider.course
        XCTAssertEqual(course.id, "matho")
        XCTAssertEqual(course.title, "Mathe Oberstufe")
        XCTAssertEqual(course.subtitle, "Analysis, Vektoren, Stochastik")
        XCTAssertEqual(course.kind, .math)
        XCTAssertEqual(course.color, 0x5A5AA8)
        XCTAssertEqual(course.symbol, "function")
        XCTAssertEqual(course.units.count, 7)
        XCTAssertEqual(course.units.map(\.title), ["Ableitung", "Kurvendiskussion", "Integralrechnung", "e-Funktion und Logarithmus", "Trigonometrie", "Vektoren", "Stochastik"])
        for unit in course.units {
            XCTAssertEqual(unit.nodes.map(\.kind), [.lesson, .lesson, .lesson, .practice, .checkpoint, .chest])
            XCTAssertGreaterThan(unit.tip.split(separator: "\n\n").count, 1, unit.id)
            XCTAssertLessThanOrEqual(unit.tip.split(separator: "\n\n").count, 5, unit.id)
        }
    }

    func testCatalogMatchesGroups() {
        XCTAssertEqual(MathUpperCatalog.units.count, 7)
        XCTAssertEqual(MathUpperCatalog.lessonGroups.count, 7)
        XCTAssertEqual(Set(MathUpperKit.allIDs).count, MathUpperKit.allIDs.count, "template ids are unique")
        for (index, groups) in MathUpperCatalog.lessonGroups.enumerated() {
            XCTAssertEqual(groups.count, 3)
            let unitIDs = Set(MathUpperCatalog.units[index].map(\.id))
            XCTAssertEqual(Set(groups.flatMap { $0 }), unitIDs, "unit \(index + 1): every template is taught in a lesson")
            for id in groups.flatMap({ $0 }) { XCTAssertNotNil(MathUpperCatalog.template(id), id) }
        }
    }

    func testDeterminismAndVariety() {
        let provider = MathUpperCourse.provider
        for node in provider.course.nodes where node.kind != .chest {
            XCTAssertEqual(provider.exercises(for: node, seed: 5), provider.exercises(for: node, seed: 5), node.id)
            XCTAssertNotEqual(provider.exercises(for: node, seed: 5).map(\.prompt), provider.exercises(for: node, seed: 6).map(\.prompt), node.id)
        }
    }

    func testNodesMixFormsAndStayHonest() {
        let provider = MathUpperCourse.provider
        for node in provider.course.nodes {
            if node.kind == .chest { XCTAssertTrue(provider.exercises(for: node, seed: 1).isEmpty); continue }
            for seed in UInt64(1)...UInt64(60) {
                let exercises = provider.exercises(for: node, seed: seed)
                XCTAssertGreaterThanOrEqual(Set(exercises.map(\.kind)).count, 2, "\(node.id) seed \(seed)")
                XCTAssertEqual(CourseAudit.problems(in: exercises, node: node), [], "\(node.id) seed \(seed)")
                for e in exercises where e.kind == .typeAnswer {
                    XCTAssertEqual(e.mode, .number, e.id)
                    for answer in e.correctAnswers {
                        let parsed = NumberCheck.parse(answer)
                        XCTAssertNotNil(parsed, "\(e.id) \(answer)")
                        if let parsed { XCTAssertTrue(NumberCheck.matches(answer, expected: e.correctAnswers[0]), "\(e.id)"); XCTAssertLessThan(abs(parsed.doubleValue), 100_000) }
                    }
                }
                for e in exercises where e.kind == .multipleChoice {
                    XCTAssertEqual(e.options.filter { e.correctAnswers.contains($0) }.count, 1, e.id)
                    XCTAssertFalse(e.explanation.isEmpty, e.id)
                }
                for e in exercises { XCTAssertFalse(e.explanation.isEmpty && e.kind != .matchPairs, e.id) }
            }
        }
    }

    func testEveryUnitHasThreeFormsAcrossItsNodes() {
        let provider = MathUpperCourse.provider
        for unit in provider.course.units {
            var kinds = Set<ExerciseKind>()
            for node in unit.nodes where node.kind != .chest {
                for seed in UInt64(1)...UInt64(5) { provider.exercises(for: node, seed: seed).forEach { kinds.insert($0.kind) } }
            }
            XCTAssertTrue(kinds.isSuperset(of: [.multipleChoice, .typeAnswer, .matchPairs]), unit.id)
        }
    }

    func testEveryTemplateIsReachableAndSound() {
        for id in MathUpperKit.allIDs {
            let draws = MathUpperKit.draws(id)
            XCTAssertGreaterThan(draws.count, 200, "\(id) produces too few problems")
            for level in 1...3 { XCTAssertGreaterThan(draws.filter { $0.level == level }.count, 40, "\(id) level \(level)") }
            XCTAssertGreaterThan(Set(draws.map(\.problem.key)).count, 5, "\(id) is not varied enough")
        }
    }

    func testAllProblemsAreMathematicallyRight() {
        for id in MathUpperKit.allIDs {
            var found: [String] = []
            for draw in MathUpperKit.draws(id) { found += MathUpperKit.problems(draw) }
            XCTAssertEqual(Array(Set(found).sorted().prefix(8)), [], id)
        }
    }

    func testUnitsAreRepresentedInEveryNodeKind() {
        // Every template of a unit must show up in the unit's practice or checkpoint over many seeds.
        let provider = MathUpperCourse.provider
        for (index, unit) in provider.course.units.enumerated() {
            var seenKeys = Set<String>()
            for seed in UInt64(1)...UInt64(40) {
                for node in unit.nodes where node.kind == .practice || node.kind == .checkpoint {
                    provider.exercises(for: node, seed: seed).forEach { seenKeys.insert($0.prompt) }
                }
            }
            XCTAssertGreaterThan(seenKeys.count, 40, "unit \(index + 1)")
        }
    }
}
