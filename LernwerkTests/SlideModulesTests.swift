import XCTest
@testable import Lernwerk

final class SlideModulesTests: XCTestCase {
    func testTheGalleryHasModulesFromSeveralCategoriesAndNoSlidesOfTheirOwn() {
        let ids = Set(SlideModules.all.map(\.id))
        XCTAssertGreaterThanOrEqual(SlideModules.all.count, 8)
        XCTAssertGreaterThanOrEqual(SlideModules.categories.count, 3)
        XCTAssertFalse(ids.contains("blank"))
        XCTAssertFalse(ids.contains("title"))
        XCTAssertFalse(ids.contains("image-full"))
        XCTAssertTrue(ids.contains("timeline"))
        XCTAssertTrue(ids.contains("chart"))
    }

    func testAModuleHasNoHeadingAndFitsTheLandingSize() {
        for component in SlideModules.all {
            let body = SlideModules.body(of: component, theme: .quill)
            XCTAssertFalse(body.isEmpty, component.id)
            XCTAssertTrue(body.allSatisfy { $0.y + $0.height > 136 }, component.id)
            let placed = SlideModules.elements(for: component, theme: .quill)
            let box = SlideModules.bounds(of: placed)!
            XCTAssertLessThanOrEqual(box.width, SlideModules.landingSize.width + 0.5, component.id)
            XCTAssertLessThanOrEqual(box.height, SlideModules.landingSize.height + 0.5, component.id)
        }
    }

    func testAModuleLandsInsideTheSlideEvenDroppedAtTheEdge() {
        let component = SlideModules.all[0]
        for center in [(x: 0.0, y: 0.0), (x: 960.0, y: 540.0), (x: 480.0, y: 270.0)] {
            let box = SlideModules.bounds(of: SlideModules.elements(for: component, theme: .quill, center: center))!
            XCTAssertGreaterThanOrEqual(box.x, 15.9)
            XCTAssertGreaterThanOrEqual(box.y, 15.9)
            XCTAssertLessThanOrEqual(box.x + box.width, SlideSize.width - 15.9)
            XCTAssertLessThanOrEqual(box.y + box.height, SlideSize.height - 15.9)
        }
    }

    func testThePartsShareOneGroupAndGetNewIDs() {
        let component = SlideModules.all[0]
        let first = SlideModules.elements(for: component, theme: .quill)
        let second = SlideModules.elements(for: component, theme: .quill)
        XCTAssertEqual(Set(first.compactMap(\.group)).count, 1)
        XCTAssertNotEqual(first.first?.group, second.first?.group)
        XCTAssertTrue(Set(first.map(\.id)).isDisjoint(with: Set(second.map(\.id))))
    }

    func testScalingKeepsTheMiddleAndLimitsTheSize() {
        let component = SlideModules.all[0]
        let elements = SlideModules.elements(for: component, theme: .quill, center: (x: 480, y: 270))
        let before = SlideModules.bounds(of: elements)!
        let bigger = SlideModules.bounds(of: SlideModules.scaled(elements, by: 1.2))!
        XCTAssertEqual(bigger.width, before.width * 1.2, accuracy: 0.5)
        XCTAssertEqual(bigger.x + bigger.width / 2, before.x + before.width / 2, accuracy: 0.5)
        // Absurd factors are held back.
        let tiny = SlideModules.bounds(of: SlideModules.scaled(elements, by: 0.0001))!
        XCTAssertGreaterThanOrEqual(tiny.width, 39.5)
    }

    func testOldSlidesWithoutGroupsStillDecode() throws {
        let json = #"{"kind":"TEXT","x":1,"y":2,"width":3,"height":4,"text":"a"}"#
        let element = try JSONDecoder().decode(SlideElement.self, from: Data(json.utf8))
        XCTAssertNil(element.group)
        let data = try JSONEncoder().encode(element)
        XCTAssertFalse(String(decoding: data, as: UTF8.self).contains("group"))
    }
}
