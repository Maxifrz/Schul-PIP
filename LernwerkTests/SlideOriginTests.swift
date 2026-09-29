import XCTest
@testable import Lernwerk

final class SlideOriginTests: XCTestCase {
    private func draft() -> SlideDraft {
        var draft = SlideDraft(layout: .cards, title: "Karten", items: [DraftItem(title: "A", text: "a", icon: "🔥"), DraftItem(title: "B")])
        draft.chart = ChartDraft(kind: .line, labels: ["x"], values: [1.5], unit: "kg")
        draft.table = [["a", "b"]]
        draft.imageMaterial = 2
        draft.sourcePages = [3]
        draft.webSources = ["W1"]
        draft.notes = "n"
        return draft
    }

    func testDraftRoundTrips() throws {
        let original = draft()
        let back = try JSONDecoder().decode(SlideDraft.self, from: try JSONEncoder().encode(original))
        XCTAssertEqual(back, original)
    }

    func testDraftDecodesTolerantly() throws {
        let json = #"{"layout":"CARDS","title":5,"bullets":"x","items":[{"title":"A","text":7},{"foo":1}],"chart":{"kind":"PIE","values":["a"]},"imageMaterial":"x","sourcePages":[1,2]}"#
        let draft = try JSONDecoder().decode(SlideDraft.self, from: Data(json.utf8))
        XCTAssertEqual(draft.layout, .cards)
        XCTAssertEqual(draft.title, "")
        XCTAssertEqual(draft.bullets, [])
        XCTAssertEqual(draft.items.count, 2, "both entries survive, the broken parts become empty")
        XCTAssertEqual(draft.items[0], DraftItem(title: "A"))
        XCTAssertEqual(draft.chart?.kind, .bar)
        XCTAssertEqual(draft.chart?.values, [])
        XCTAssertNil(draft.imageMaterial)
        XCTAssertEqual(draft.sourcePages, [1, 2])
        XCTAssertEqual(try JSONDecoder().decode(SlideDraft.self, from: Data("{}".utf8)).layout, .blank)
    }

    func testOldSlideJSONHasNoOriginAndEncodesWithoutIt() throws {
        let old = #"{"id":"s1","elements":[],"notes":"n"}"#
        let slide = try JSONDecoder().decode(Slide.self, from: Data(old.utf8))
        XCTAssertNil(slide.origin)
        XCTAssertFalse(String(decoding: try JSONEncoder().encode(slide), as: UTF8.self).contains("origin"))
        let deck = Presentation(title: "T", slides: [SlideLayouts.preset(.bullets)])
        XCTAssertFalse(String(decoding: try JSONEncoder().encode(deck), as: UTF8.self).contains("origin"))
    }

    func testSlideWithOriginRoundTrips() throws {
        var slide = SlideLayouts.preset(.cards)
        slide.origin = SlideOrigin(componentID: "cards", params: ["style": "a"], draft: draft())
        let back = try JSONDecoder().decode(Slide.self, from: try JSONEncoder().encode(slide))
        XCTAssertEqual(back, slide)
    }

    func testBrokenOriginDropsOnlyTheOrigin() throws {
        for origin in [#""nope""#, #"{"componentID":"cards"}"#, #"{"draft":{}}"#, "[]", "null"] {
            let json = #"{"id":"s1","elements":[],"notes":"keep","origin":\#(origin)}"#
            let slide = try JSONDecoder().decode(Slide.self, from: Data(json.utf8))
            XCTAssertNil(slide.origin, origin)
            XCTAssertEqual(slide.notes, "keep")
        }
        let partial = #"{"id":"s","origin":{"componentID":"cards","params":5,"draft":{"layout":"CARDS"}}}"#
        let slide = try JSONDecoder().decode(Slide.self, from: Data(partial.utf8))
        XCTAssertEqual(slide.origin?.componentID, "cards")
        XCTAssertEqual(slide.origin?.params, [:])
    }

    func testEditedFromDropsTheOriginOnlyWhenElementsChange() {
        var old = SlideLayouts.preset(.bullets)
        old.origin = SlideOrigin(componentID: "bullets", draft: SlideDraft(layout: .bullets))
        var moved = old
        moved.elements[0].x += 10
        XCTAssertNil(moved.editedFrom(old).origin)
        var animated = old
        animated.elements[0].animation = ElementAnimation(kind: .fly)
        animated.transition = SlideTransition(kind: .push)
        XCTAssertNotNil(animated.editedFrom(old).origin, "motion is not part of the design")
        var notes = old
        notes.notes = "neu"
        XCTAssertNotNil(notes.editedFrom(old).origin, "notes are not part of the design")
        XCTAssertEqual(old.editedFrom(old), old)
        var redesigned = old
        redesigned.elements = SlideLayouts.preset(.cards).elements
        redesigned.origin = SlideOrigin(componentID: "cards", draft: SlideDraft(layout: .cards))
        XCTAssertEqual(redesigned.editedFrom(old).origin?.componentID, "cards", "a change that sets its own origin keeps it")
        var plain = SlideLayouts.preset(.bullets)
        plain.elements[0].x += 1
        XCTAssertNil(plain.editedFrom(SlideLayouts.preset(.bullets)).origin)
    }

    func testChatEditsDropTheOrigin() {
        var slide = SlideLayouts.preset(.bullets)
        slide.origin = SlideOrigin(componentID: "bullets", draft: SlideDraft(layout: .bullets))
        let deck = Presentation(title: "T", slides: [slide])
        let id = slide.elements.first { $0.kind == .text }!.id
        var change = SlideChange(action: .updateTexts, slideID: slide.id)
        change.texts = [id: "Neu"]
        let result = PresentationEdits.apply(deck, [change]).presentation
        XCTAssertEqual(result.slides[0].elements.first { $0.id == id }?.text, "Neu")
        XCTAssertNil(result.slides[0].origin)
    }
}
