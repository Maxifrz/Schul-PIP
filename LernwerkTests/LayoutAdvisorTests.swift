import XCTest
@testable import Lernwerk

final class LayoutAdvisorTests: XCTestCase {
    private func items(_ count: Int) -> [DraftItem] {
        (1...count).map { DraftItem(title: "Titel \($0)", text: "Text \($0)") }
    }

    private func draft(_ layout: SlideLayout, items: [DraftItem] = [], bullets: [String] = [], table: [[String]] = []) -> SlideDraft {
        var draft = SlideDraft(layout: layout, title: "Thema", bullets: bullets, items: items, table: table)
        draft.notes = "Notiz"
        draft.sourceMaterial = 1
        draft.sourcePages = [3, 4]
        draft.webSources = ["W1"]
        return draft
    }

    func testEvenSizes() {
        XCTAssertEqual(LayoutAdvisor.evenSizes(5, max: 4), [3, 2])
        XCTAssertEqual(LayoutAdvisor.evenSizes(9, max: 4), [3, 3, 3])
        XCTAssertEqual(LayoutAdvisor.evenSizes(4, max: 4), [4])
        XCTAssertEqual(LayoutAdvisor.evenSizes(7, max: 6), [4, 3])
        XCTAssertEqual(LayoutAdvisor.evenSizes(0, max: 4), [])
        XCTAssertEqual(LayoutAdvisor.evenSizes(3, max: 0), [])
    }

    func testFittingContentIsLeftAlone() {
        for count in 2...4 { XCTAssertEqual(LayoutAdvisor.split(draft(.cards, items: items(count))).count, 1) }
        XCTAssertEqual(LayoutAdvisor.split(draft(.process, items: items(5))).count, 1)
        XCTAssertEqual(LayoutAdvisor.split(draft(.timeline, items: items(6))).count, 1)
        let rows = [["A", "B"]] + (1...7).map { ["\($0)", "x"] }
        XCTAssertEqual(LayoutAdvisor.split(draft(.table, table: rows)).count, 1)
        let short = draft(.bullets, bullets: ["Eins", "Zwei", "Drei"])
        XCTAssertEqual(LayoutAdvisor.split(short), [short])
    }

    func testOtherLayoutsPassThrough() {
        for layout in [SlideLayout.title, .section, .statement, .quote, .bigNumber, .blank, .chart, .imageText, .twoColumns] {
            let original = draft(layout, items: items(9), bullets: Array(repeating: "Zeile", count: 30))
            XCTAssertEqual(LayoutAdvisor.split(original), [original], "\(layout)")
        }
    }

    func testCardsSplitEvenlyWithNumberedTitles() {
        let parts = LayoutAdvisor.split(draft(.cards, items: items(5)))
        XCTAssertEqual(parts.map { $0.items.count }, [3, 2])
        XCTAssertEqual(parts.map(\.title), ["Thema (1/2)", "Thema (2/2)"])
        XCTAssertEqual(parts.flatMap(\.items), items(5))
    }

    func testNotesOnFirstPartSourcesOnAll() {
        let parts = LayoutAdvisor.split(draft(.process, items: items(7)))
        XCTAssertEqual(parts.map { $0.items.count }, [4, 3])
        XCTAssertEqual(parts.map(\.notes), ["Notiz", ""])
        for part in parts {
            XCTAssertEqual(part.sourceMaterial, 1)
            XCTAssertEqual(part.sourcePages, [3, 4])
            XCTAssertEqual(part.webSources, ["W1"])
        }
    }

    func testTimelineAndManyParts() {
        XCTAssertEqual(LayoutAdvisor.split(draft(.timeline, items: items(7))).map { $0.items.count }, [4, 3])
        let parts = LayoutAdvisor.split(draft(.cards, items: items(9)))
        XCTAssertEqual(parts.map { $0.items.count }, [3, 3, 3])
        XCTAssertEqual(parts.last?.title, "Thema (3/3)")
    }

    func testTableRepeatsHeader() {
        let rows = [["Merkmal", "Wert"]] + (1...9).map { ["Zeile \($0)", "\($0)"] }
        let parts = LayoutAdvisor.split(draft(.table, table: rows))
        XCTAssertEqual(parts.count, 2)
        XCTAssertEqual(parts.map { $0.table.count }, [6, 5])
        for part in parts { XCTAssertEqual(part.table[0], ["Merkmal", "Wert"]) }
        XCTAssertEqual(parts.flatMap { $0.table.dropFirst() }, Array(rows.dropFirst()))
    }

    func testLongBulletsBecomeTwoColumnsFirst() {
        let lines = (1...8).map { "Ein etwas längerer Stichpunkt Nummer \($0), der mehr als eine Zeile füllt und deshalb Platz braucht, weil er wirklich lang ist." }
        let parts = LayoutAdvisor.split(draft(.bullets, bullets: lines))
        XCTAssertEqual(parts.count, 1)
        XCTAssertEqual(parts[0].layout, .twoColumns)
        XCTAssertEqual(parts[0].left + parts[0].right, lines)
        XCTAssertTrue(parts[0].bullets.isEmpty)
        XCTAssertEqual(parts[0].title, "Thema")
    }

    func testVeryLongBulletsBecomeSeveralSlidesWithoutLoss() {
        let lines = (1...16).map { "Ein etwas längerer Stichpunkt Nummer \($0), der eine Zeile füllt und ein bisschen mehr, damit es eng wird." }
        let parts = LayoutAdvisor.split(draft(.bullets, bullets: lines))
        XCTAssertGreaterThan(parts.count, 1)
        XCTAssertEqual(parts.flatMap(\.bullets), lines)
        let sizes = parts.map { $0.bullets.count }
        XCTAssertLessThanOrEqual((sizes.max() ?? 0) - (sizes.min() ?? 0), 1, "even split")
        XCTAssertEqual(parts.map(\.notes).filter { !$0.isEmpty }.count, 1)
    }

    func testSingleHugeBulletIsNeverDropped() {
        let huge = String(repeating: "wort ", count: 400)
        let parts = LayoutAdvisor.split(draft(.bullets, bullets: [huge]))
        XCTAssertEqual(parts.flatMap(\.bullets), [huge])
    }

    func testSplitIsDeterministic() {
        let lines = (1...16).map { "Stichpunkt \($0) mit ziemlich vielen Worten, die zusammen eine lange Zeile ergeben und mehr." }
        XCTAssertEqual(LayoutAdvisor.split(draft(.bullets, bullets: lines)), LayoutAdvisor.split(draft(.bullets, bullets: lines)))
    }

    func testBuiltPartsLoseNothing() {
        let parts = LayoutAdvisor.split(draft(.cards, items: items(6)))
        let built = parts.map { SlideLayouts.build($0) }
        let titles = built.flatMap { $0.filter { $0.bold && $0.textColor == "text" }.map(\.text) }
        for item in items(6) { XCTAssertTrue(titles.contains(item.title), item.title) }
    }

    // MARK: SlideAutoFit

    private func box(_ text: String, size: Double, width: Double = 200, height: Double = 60, bullets: Bool = false) -> SlideElement {
        SlideLayouts.text(text, 0, 0, width, height, size, bullets: bullets)
    }

    func testFittingTextIsUntouched() {
        let element = box("Kurz", size: 24)
        XCTAssertEqual(SlideAutoFit.fit(element, theme: .quill), element)
        let slide = Slide(elements: [element, SlideElement(kind: .shape, x: 0, y: 0, width: 10, height: 10)])
        XCTAssertEqual(SlideAutoFit.fit(slide, theme: .quill), slide)
    }

    func testOverflowingTextShrinksToFit() {
        let element = box(String(repeating: "Wort ", count: 20), size: 30)
        let fitted = SlideAutoFit.fit(element, theme: .quill)
        XCTAssertLessThan(fitted.fontSize, 30)
        XCTAssertGreaterThanOrEqual(fitted.fontSize, SlideAutoFit.minimumSize)
        XCTAssertFalse(SlideAutoFit.overflows(fitted, theme: .quill))
        XCTAssertEqual(fitted.text, element.text)
        XCTAssertEqual(fitted.width, element.width)
        XCTAssertEqual(SlideAutoFit.fit(fitted, theme: .quill), fitted, "idempotent")
    }

    func testNeverBelowMinimum() {
        let element = box(String(repeating: "Wort ", count: 500), size: 24)
        XCTAssertEqual(SlideAutoFit.fit(element, theme: .quill).fontSize, SlideAutoFit.minimumSize)
    }

    func testWiderFontsShrinkMore() throws {
        let text = String(repeating: "Wort ", count: 12)
        let element = box(text, size: 26, width: 300, height: 90)
        let courier = try XCTUnwrap(SlideTheme.all.first { $0.body == .courier })
        let sans = try XCTUnwrap(SlideTheme.all.first { $0.body == .workSans })
        XCTAssertLessThanOrEqual(SlideAutoFit.fit(element, theme: courier).fontSize, SlideAutoFit.fit(element, theme: sans).fontSize)
    }

    func testEveryBuiltSlideFitsOrIsAtMinimumInEveryTheme() {
        let long = String(repeating: "Ein langer Satz mit vielen Wörtern. ", count: 6)
        let drafts: [SlideDraft] = [
            draft(.cards, items: (1...4).map { _ in DraftItem(title: long, text: long) }),
            draft(.bullets, bullets: [long, long, long]),
            SlideDraft(layout: .statement, title: long),
        ]
        for theme in SlideTheme.all {
            for d in drafts {
                let slide = SlideAutoFit.fit(Slide(elements: SlideLayouts.build(d)), theme: theme)
                for element in slide.elements where element.kind == .text {
                    XCTAssertTrue(!SlideAutoFit.overflows(element, theme: theme) || element.fontSize == SlideAutoFit.minimumSize, "\(theme.id) \(d.layout)")
                }
            }
        }
    }

    // MARK: Pipeline

    func testDemoGenerationStillHasElevenSlides() async throws {
        let assistant = PresentationAssistant(client: DemoLLMClient())
        let deck = try await assistant.generate(content: [], materialIDs: ["m"], topic: "", slideCount: 6, minutes: 5, themeID: "quill", pageImage: { _, _ in nil })
        XCTAssertEqual(deck.slides.count, 11)
    }
}
