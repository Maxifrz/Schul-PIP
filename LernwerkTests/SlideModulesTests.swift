import XCTest
@testable import Lernwerk

final class SlideModulesTests: XCTestCase {
    func testTheGalleryHasDiagramsArrangementsAndComponents() {
        let ids = Set(SlideModules.all.map(\.id))
        for type in ChartType.allCases { XCTAssertTrue(ids.contains("chart-" + type.rawValue), type.rawValue) }
        XCTAssertTrue(ids.contains("composite-dashboard"))
        XCTAssertTrue(ids.contains("composite-infographic"))
        XCTAssertTrue(ids.contains("timeline"))
        XCTAssertTrue(ids.contains("stat-row"))
        XCTAssertEqual(ids.count, SlideModules.all.count, "ids are unique")
        for group in [ModuleGroup.diagrams, .distributions, .flows, .special, .composite] {
            XCTAssertTrue(SlideModules.groups.contains(group), group.rawValue)
        }
        // No slides of their own: no opening, no picture, no blank.
        XCTAssertFalse(ids.contains("blank"))
        XCTAssertFalse(ids.contains("title"))
        XCTAssertFalse(ids.contains("image-full"))
    }

    func testTheRequestedDiagramsAreThere() {
        let labels = Set(SlideModules.all.map(\.label))
        for wanted in [
            "Säulendiagramm", "Balkendiagramm", "Liniendiagramm", "Kreisdiagramm", "Donut-Diagramm", "Streudiagramm", "Blasendiagramm",
            "Histogramm", "Boxplot", "Violin-Plot", "Netzdiagramm", "Heatmap", "Sankey-Diagramm", "Alluvial-Diagramm", "Trichter-Diagramm",
            "Treemap", "Organigramm", "Netzwerk", "Chord-Diagramm", "Wortwolke", "Dashboard", "Infografik",
        ] {
            XCTAssertTrue(labels.contains(wanted), wanted)
        }
        XCTAssertTrue(SlideModules.all.contains { $0.group == .special && $0.label.hasPrefix("Kachelkarte") })
    }

    func testEveryModuleBuildsAndFitsItsLandingSize() {
        for module in SlideModules.all {
            let body = module.build(.quill)
            XCTAssertFalse(body.isEmpty, module.id)
            let placed = SlideModules.elements(for: module, theme: .quill)
            let box = SlideModules.bounds(of: placed)!
            XCTAssertLessThanOrEqual(box.width, module.landing.width + 0.5, module.id)
            XCTAssertLessThanOrEqual(box.height, module.landing.height + 0.5, module.id)
            XCTAssertGreaterThanOrEqual(box.x, 15.9, module.id)
            XCTAssertLessThanOrEqual(box.x + box.width, SlideSize.width - 15.9, module.id)
            XCTAssertLessThanOrEqual(box.y + box.height, SlideSize.height - 15.9, module.id)
        }
    }

    func testAModuleLandsInsideTheSlideEvenDroppedAtTheEdge() {
        let module = SlideModules.module(id: "chart-column")!
        for center in [(x: 0.0, y: 0.0), (x: 960.0, y: 540.0), (x: 480.0, y: 270.0)] {
            let box = SlideModules.bounds(of: SlideModules.elements(for: module, theme: .quill, center: center))!
            XCTAssertGreaterThanOrEqual(box.x, 15.9)
            XCTAssertGreaterThanOrEqual(box.y, 15.9)
            XCTAssertLessThanOrEqual(box.x + box.width, SlideSize.width - 15.9)
            XCTAssertLessThanOrEqual(box.y + box.height, SlideSize.height - 15.9)
        }
    }

    func testThePartsShareOneGroupAndGetNewIDs() {
        let module = SlideModules.module(id: "composite-dashboard")!
        let first = SlideModules.elements(for: module, theme: .quill)
        let second = SlideModules.elements(for: module, theme: .quill)
        XCTAssertEqual(Set(first.compactMap(\.group)).count, 1)
        XCTAssertEqual(first.compactMap(\.group).count, first.count)
        XCTAssertNotEqual(first.first?.group, second.first?.group)
        XCTAssertTrue(Set(first.map(\.id)).isDisjoint(with: Set(second.map(\.id))))
    }

    func testADiagramModuleIsOneElementWithItsData() {
        let module = SlideModules.module(id: "chart-donut")!
        let parts = SlideModules.elements(for: module, theme: .quill)
        XCTAssertEqual(parts.count, 1)
        XCTAssertEqual(parts[0].kind, .chart)
        XCTAssertEqual(parts[0].chart?.type, .donut)
        XCTAssertEqual(parts[0].chart?.data, ChartType.donut.sample)
    }

    func testTheDashboardHasKeyFiguresAndThreeDiagrams() {
        let parts = SlideModules.dashboard()
        XCTAssertEqual(parts.filter { $0.kind == .chart }.count, 3)
        XCTAssertGreaterThanOrEqual(parts.filter { $0.kind == .text }.count, 6)
        let infographic = SlideModules.infographic()
        XCTAssertEqual(infographic.filter { $0.kind == .chart }.count, 1)
    }

    func testScalingKeepsTheMiddleAndLimitsTheSize() {
        let module = SlideModules.module(id: "composite-dashboard")!
        let elements = SlideModules.elements(for: module, theme: .quill, center: (x: 480, y: 270))
        let before = SlideModules.bounds(of: elements)!
        let bigger = SlideModules.bounds(of: SlideModules.scaled(elements, by: 1.1))!
        XCTAssertEqual(bigger.width, before.width * 1.1, accuracy: 0.5)
        XCTAssertEqual(bigger.x + bigger.width / 2, before.x + before.width / 2, accuracy: 0.5)
        // Absurd factors are held back.
        let tiny = SlideModules.bounds(of: SlideModules.scaled(elements, by: 0.0001))!
        XCTAssertGreaterThanOrEqual(tiny.width, 39.5)
    }

    func testOldSlidesWithoutGroupsAndDiagramsStillDecode() throws {
        let json = #"{"kind":"TEXT","x":1,"y":2,"width":3,"height":4,"text":"a"}"#
        let element = try JSONDecoder().decode(SlideElement.self, from: Data(json.utf8))
        XCTAssertNil(element.group)
        XCTAssertNil(element.chart)
        let data = try JSONEncoder().encode(element)
        let text = String(decoding: data, as: UTF8.self)
        XCTAssertFalse(text.contains("group"))
        XCTAssertFalse(text.contains("chart"))
    }

    func testADiagramElementSurvivesSaving() throws {
        let element = SlideElement(kind: .chart, x: 10, y: 20, width: 300, height: 200, chart: ChartSpec(type: .sankey, data: "A -> B; 3", unit: "t", title: "Fluss", showValues: false))
        let data = try JSONEncoder().encode(element)
        let back = try JSONDecoder().decode(SlideElement.self, from: data)
        XCTAssertEqual(back, element)
        XCTAssertEqual(back.kind, .chart)
        // A type this version does not know becomes a column chart instead of losing the slide.
        let odd = #"{"kind":"CHART","x":0,"y":0,"width":10,"height":10,"chart":{"type":"hologram","data":"a; 1"}}"#
        let decoded = try JSONDecoder().decode(SlideElement.self, from: Data(odd.utf8))
        XCTAssertEqual(decoded.chart?.type, .column)
        XCTAssertEqual(decoded.chart?.data, "a; 1")
    }
}
