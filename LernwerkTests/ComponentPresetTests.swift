import XCTest
@testable import Lernwerk

final class ComponentPresetTests: XCTestCase {
    private func inBounds(_ e: SlideElement) -> Bool {
        e.x >= -0.5 && e.y >= -0.5 && e.x + e.width <= SlideSize.width + 0.5 && e.y + e.height <= SlideSize.height + 0.5
    }

    func testEveryComponentHasAPlaceholderSlideThatFitsItsOwnContract() {
        for component in ComponentRegistry.all {
            let slide = ComponentRegistry.preset(component)
            XCTAssertFalse(slide.elements.isEmpty && component.id != "blank", component.id)
            XCTAssertEqual(slide.origin?.componentID, component.id, "no fallback for \(component.id)")
            XCTAssertTrue(component.fits(ComponentRegistry.sampleDraft(component), image: nil, placeholder: true), component.id)
            XCTAssertTrue(slide.elements.allSatisfy(inBounds), component.id)
            for theme in SlideTheme.all {
                let themed = ComponentRegistry.preset(component, theme: theme)
                for element in themed.elements where element.kind == .text && component.layout == nil {
                    XCTAssertFalse(SlideAutoFit.overflows(element, theme: theme), "\(component.id) \(theme.id)")
                }
            }
        }
    }

    func testFirstVersionPresetsAreTheOldPresets() {
        for layout in SlideLayout.allCases {
            let old = SlideLayouts.preset(layout)
            let new = ComponentRegistry.preset(ComponentRegistry.legacy(layout))
            XCTAssertEqual(SlideVariants.signature(new.elements), SlideVariants.signature(old.elements), layout.rawValue)
            XCTAssertNil(old.origin, "the old entry point stays without an origin")
        }
    }

    func testCategoriesCoverEveryComponentOnce() {
        let listed = ComponentRegistry.categories.flatMap { ComponentRegistry.components(in: $0).map(\.id) }
        XCTAssertEqual(listed.sorted(), ComponentRegistry.all.map(\.id).sorted())
        XCTAssertTrue(ComponentRegistry.categories.allSatisfy { !$0.label.isEmpty })
    }

    func testValueLabels() {
        XCTAssertEqual(ComponentParameter.valueLabel("compact"), "Kompakt")
        XCTAssertEqual(ComponentParameter.valueLabel("neu"), "neu")
        for component in ComponentRegistry.all {
            for parameter in component.parameters {
                for value in parameter.values { XCTAssertNotEqual(ComponentParameter.valueLabel(value), "", "\(component.id).\(value)") }
            }
        }
    }

    // MARK: Variants

    func testNoOriginNoVariants() {
        XCTAssertTrue(SlideVariants.variants(for: SlideLayouts.preset(.bullets), theme: .quill).isEmpty)
    }

    func testVariantsDifferKeepTheContentAndTheSlidesOwnData() {
        for component in ComponentRegistry.all where component.id != "blank" {
            var slide = ComponentRegistry.preset(component)
            slide.notes = "meine Notiz"
            slide.background = "#112233"
            slide.sources = [SourceRef(materialId: "m", page: 3)]
            let variants = SlideVariants.variants(for: slide, theme: .quill)
            XCTAssertLessThanOrEqual(variants.count, SlideVariants.maxVariants, component.id)
            var seen: Set<String> = [SlideVariants.signature(slide.elements)]
            let draft = slide.origin!.draft
            for variant in variants {
                XCTAssertTrue(seen.insert(SlideVariants.signature(variant.slide.elements)).inserted, "\(component.id): duplicate look")
                XCTAssertFalse(variant.label.isEmpty)
                let all = variant.slide.elements.map(\.text).joined(separator: "\n")
                for text in [draft.title, draft.subtitle, draft.value, draft.quote] + draft.bullets + draft.left + draft.right + draft.items.flatMap({ [$0.title, $0.text] }) where !text.isBlank {
                    XCTAssertTrue(all.contains(text), "\(component.id) -> \(variant.id) lost \"\(text)\"")
                }
                let applied = SlideVariants.applying(variant, to: slide)
                XCTAssertEqual(applied.id, slide.id)
                XCTAssertEqual(applied.notes, "meine Notiz")
                XCTAssertEqual(applied.background, "#112233")
                XCTAssertEqual(applied.sources, slide.sources)
                XCTAssertEqual(applied.origin?.componentID, variant.componentID)
                XCTAssertEqual(applied.origin?.draft, draft)
            }
        }
    }

    func testEveryNewComponentOffersAtLeastTwoLooks() {
        for id in ["stat-row", "comparison", "matrix-2x2", "definition", "agenda", "checklist", "icon-grid", "staircase"] {
            let slide = ComponentRegistry.preset(ComponentRegistry.component(id)!)
            XCTAssertGreaterThanOrEqual(SlideVariants.variants(for: slide, theme: .quill).count, 2, id)
        }
    }

    func testVariantsKeepTheDecksDensityAndAreDeterministic() {
        var slide = ComponentRegistry.preset(ComponentRegistry.component("stat-row")!)
        slide.origin?.params["density"] = "compact"
        let a = SlideVariants.variants(for: slide, theme: .quill)
        let b = SlideVariants.variants(for: slide, theme: .quill)
        XCTAssertEqual(a.map(\.id), b.map(\.id))
        XCTAssertTrue(a.filter { $0.componentID == "stat-row" }.allSatisfy { $0.params["density"] == "compact" })
    }

    func testAPictureSlideKeepsItsPictureInVariants() {
        let draft = SlideDraft(layout: .imageText, title: "Bild", bullets: ["a", "b"])
        let image = PlacedImage(name: "p.jpg", aspect: 1.5)
        let built = ComponentRegistry.build(draft, componentID: "image-text", image: image)
        let slide = Slide(elements: built.elements, origin: SlideOrigin(componentID: "image-text", params: built.params, draft: built.draft))
        let variants = SlideVariants.variants(for: slide, theme: .quill)
        XCTAssertTrue(variants.contains { $0.componentID == "image-text" && $0.params["side"] == "right" })
        for variant in variants where variant.componentID == "image-text" {
            XCTAssertTrue(variant.slide.elements.contains { $0.kind == .image && $0.image == "p.jpg" })
        }
    }
}
