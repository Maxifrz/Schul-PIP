import XCTest
@testable import Lernwerk

final class ComponentRegistryTests: XCTestCase {
    /// The golden test: everything `SlideLayouts.build` made before layouts became components is still made, exactly.
    func testWrapperReproducesTheOriginalOutputForEveryCase() {
        for c in GoldenLayoutCases.all {
            let digest = GoldenLayoutCases.digest(SlideLayouts.build(c.draft, image: c.image, placeholder: c.placeholder))
            XCTAssertEqual(digest, GoldenLayoutDigests.all[c.name], c.name)
        }
        XCTAssertEqual(Set(GoldenLayoutCases.all.map(\.name)), Set(GoldenLayoutDigests.all.keys))
    }

    /// Through the registry the result is the same for every case; a fallback shows up in the log exactly when the
    /// draft's own layout does not accept the content.
    func testRegistryReproducesTheOriginalOutputAndLogsFallbacks() {
        // These cases hold more than the layout takes. `SlideLayouts.build` still cuts them as it always did; the
        // registry does not cut, it falls back to bullets and logs.
        let overfull: Set<String> = ["cards-5", "process-6", "timeline-7", "chart-many", "table-tall"]
        for c in GoldenLayoutCases.all {
            let built = ComponentRegistry.build(c.draft, image: c.image, placeholder: c.placeholder)
            if overfull.contains(c.name) {
                XCTAssertEqual(built.componentID, "bullets", c.name)
                XCTAssertFalse(built.log.isEmpty, c.name)
                continue
            }
            XCTAssertEqual(GoldenLayoutCases.digest(built.elements), GoldenLayoutDigests.all[c.name], c.name)
            let accepted = ComponentRegistry.legacy(c.draft.layout).fits(c.draft, image: c.image, placeholder: c.placeholder)
            XCTAssertEqual(built.log.isEmpty, accepted, "\(c.name): \(built.log)")
        }
    }

    func testEveryLayoutIsAComponentWithAUniqueId() {
        for layout in SlideLayout.allCases { XCTAssertEqual(ComponentRegistry.legacy(layout).id, layout.componentID) }
        let ids = ComponentRegistry.all.map(\.id)
        XCTAssertEqual(Set(ids).count, ids.count)
        XCTAssertEqual(ComponentRegistry.legacy(.imageText).id, "image-text")
        XCTAssertNotNil(ComponentRegistry.component(" BIG-NUMBER "))
        XCTAssertNil(ComponentRegistry.component("gibtsnicht"))
    }

    func testUnknownIdFallsBackToTheDraftsLayoutAndLogs() {
        let draft = SlideDraft(layout: .bullets, title: "T", bullets: ["a"])
        let built = ComponentRegistry.build(draft, componentID: "gibtsnicht")
        XCTAssertEqual(built.componentID, "bullets")
        XCTAssertEqual(built.log.count, 1)
        XCTAssertEqual(GoldenLayoutCases.digest(built.elements), GoldenLayoutCases.digest(SlideLayouts.build(draft)))
        XCTAssertTrue(ComponentRegistry.build(draft, componentID: "").log.isEmpty)
        XCTAssertTrue(ComponentRegistry.build(draft, componentID: nil).log.isEmpty)
    }

    func testContentBeyondTheContractFallsBackWithoutLosingText() {
        let items = (1...6).map { DraftItem(title: "T\($0)", text: "Text \($0)") }
        let built = ComponentRegistry.build(SlideDraft(layout: .cards, title: "Karten", items: items))
        XCTAssertEqual(built.componentID, "bullets")
        XCTAssertEqual(built.log.count, 1)
        let all = built.elements.map(\.text).joined(separator: "\n")
        for item in items { XCTAssertTrue(all.contains(item.title) && all.contains(item.text)) }
    }

    func testMissingPictureFallsBackLikeResolve() {
        let built = ComponentRegistry.build(SlideDraft(layout: .imageText, title: "T", bullets: ["a", "b"]))
        XCTAssertEqual(built.componentID, "bullets")
        XCTAssertEqual(built.draft.bullets, ["a", "b"])
        let placeholder = ComponentRegistry.build(SlideDraft(layout: .imageText, title: "T"), placeholder: true)
        XCTAssertEqual(placeholder.componentID, "image-text")
        XCTAssertTrue(placeholder.log.isEmpty)
    }

    func testEverythingEndsAsSomeSlideForAnyDraft() {
        for layout in SlideLayout.allCases {
            for draft in [SlideDraft(layout: layout), SlideDraft(layout: layout, title: "T"), SlideDraft(layout: layout, title: "T", bullets: ["a"], quote: "q", value: "1")] {
                let built = ComponentRegistry.build(draft, componentID: layout.componentID)
                XCTAssertNotNil(ComponentRegistry.component(built.componentID))
            }
        }
    }

    func testParametersFallBackToDefaults() {
        let component = SlideComponent(
            id: "x", label: "X", category: .text, tags: [], summary: "", accepts: SlotContract(),
            parameters: [ComponentParameter(name: "side", label: "Seite", values: ["left", "right"], defaultValue: "left")],
            build: { _, _, _, _ in [] }
        )
        XCTAssertEqual(component.resolvedParams([:]), ["side": "left"])
        XCTAssertEqual(component.resolvedParams(["side": "RIGHT"]), ["side": "right"])
        XCTAssertEqual(component.resolvedParams(["side": "oben", "zusatz": "1"]), ["side": "left"])
    }

    func testSlotContractViolations() {
        let contract = SlotContract(field: .items, min: 2, max: 3, maxChars: 10)
        XCTAssertNotNil(contract.violation(SlideDraft(layout: .cards, items: [DraftItem(title: "a")]), image: nil))
        XCTAssertNotNil(contract.violation(SlideDraft(layout: .cards, items: Array(repeating: DraftItem(title: "a"), count: 4)), image: nil))
        XCTAssertNotNil(contract.violation(SlideDraft(layout: .cards, items: [DraftItem(title: "a"), DraftItem(title: "sehr sehr langer Titel")]), image: nil))
        XCTAssertNil(contract.violation(SlideDraft(layout: .cards, items: [DraftItem(title: "a"), DraftItem(title: "b")]), image: nil))
        XCTAssertNotNil(SlotContract(needsImage: true).violation(SlideDraft(layout: .imageFull), image: nil))
        XCTAssertNil(SlotContract(needsImage: true).violation(SlideDraft(layout: .imageFull), image: nil, placeholder: true))
        XCTAssertNotNil(SlotContract(needsNumbers: true).violation(SlideDraft(layout: .bigNumber), image: nil))
    }
}
