import XCTest
@testable import Lernwerk

final class DeckExportTests: XCTestCase {
    func testFileNamesAreSafeAndSuffixedPerFormat() {
        XCTAssertEqual(DeckExport.fileName("Ableitungen", format: .pptx), "Ableitungen.pptx")
        XCTAssertEqual(DeckExport.fileName("Ableitungen", format: .pdf), "Ableitungen.pdf")
        XCTAssertEqual(DeckExport.fileName("Ableitungen", format: .pdfNotes), "Ableitungen-Notizen.pdf")
        XCTAssertEqual(DeckExport.fileName("Ableitungen", format: .pngZip), "Ableitungen-Folien.zip")
        XCTAssertEqual(DeckExport.fileName("Ableitungen", format: .markdown), "Ableitungen-Gliederung.md")
        let names = ExportFormat.allCases.map { DeckExport.fileName("X", format: $0) }
        XCTAssertEqual(Set(names).count, names.count, "one name per format")
    }

    func testForbiddenCharactersAndEdgeCases() {
        XCTAssertEqual(DeckExport.fileName("a/b\\c:d?e*f\"g<h>i|j", format: .pdf), "a b c d e f g h i j.pdf")
        XCTAssertEqual(DeckExport.fileName("  ..Titel..  ", format: .pdf), "Titel.pdf")
        XCTAssertEqual(DeckExport.fileName("Zeile\neins\tzwei", format: .pdf), "Zeile eins zwei.pdf")
        XCTAssertEqual(DeckExport.fileName("", format: .markdown), "Präsentation-Gliederung.md")
        XCTAssertEqual(DeckExport.fileName("///", format: .pdf), "Präsentation.pdf")
        XCTAssertEqual(DeckExport.fileName("CON", format: .pdf), "CON_.pdf")
        let long = DeckExport.fileName(String(repeating: "ä", count: 300), format: .pngZip)
        XCTAssertLessThanOrEqual(long.count, 80 + "-Folien.zip".count)
        for format in ExportFormat.allCases {
            let name = DeckExport.fileName("a/b:c", format: format)
            XCTAssertFalse(name.contains("/") || name.contains(":"))
        }
    }

    private func deck() -> Presentation {
        var bullets = Slide(elements: SlideLayouts.build(SlideDraft(layout: .bullets, title: "Erste Folie", bullets: ["Punkt A", "Punkt B"])))
        bullets.notes = "Erste Zeile.\nZweite Zeile."
        let cards = Slide(elements: SlideLayouts.build(SlideDraft(layout: .cards, title: "Karten", items: [
            DraftItem(title: "Eins", text: "Text eins"), DraftItem(title: "Zwei", text: "Text zwei"),
        ])))
        return Presentation(title: "Mein Vortrag", slides: [bullets, cards, Slide(elements: [])])
    }

    func testMarkdownOutline() {
        let text = DeckExport.markdown(deck())
        XCTAssertTrue(text.hasPrefix("# Mein Vortrag\n\n## 1. Erste Folie\n\n- Punkt A\n- Punkt B\n"))
        XCTAssertTrue(text.contains("> **Notizen**\n> Erste Zeile.\n> Zweite Zeile."))
        XCTAssertTrue(text.contains("## 2. Karten"))
        XCTAssertTrue(text.contains("## 3. Folie 3"))
        XCTAssertTrue(text.hasSuffix("\n") && !text.hasSuffix("\n\n"))
        let eins = text.range(of: "Text eins")!.lowerBound, zwei = text.range(of: "Text zwei")!.lowerBound
        XCTAssertLessThan(eins, zwei, "left to right")
        XCTAssertEqual(DeckExport.markdown(deck()), DeckExport.markdown(deck()).self)
    }

    func testMarkdownOfEmptyDeck() {
        XCTAssertEqual(DeckExport.markdown(Presentation(title: "", slides: [])), "# Präsentation\n")
    }

    func testImageNamesPadToTheDeckSize() {
        XCTAssertEqual(DeckExport.imageNames(count: 0), [])
        XCTAssertEqual(DeckExport.imageNames(count: 3), ["folie-01.png", "folie-02.png", "folie-03.png"])
        XCTAssertEqual(DeckExport.imageNames(count: 100).last, "folie-100.png")
        XCTAssertEqual(DeckExport.imageNames(count: 100).first, "folie-001.png")
    }

    func testPngArchiveIsAReadableZipWithNamedEntries() throws {
        let pages = [Data([1, 2, 3]), Data([4, 5]), Data()]
        let files = try ZipArchive.files(DeckExport.pngArchive(pages))
        XCTAssertEqual(Set(files.keys), Set(DeckExport.imageNames(count: 3)))
        XCTAssertEqual(files["folie-01.png"], pages[0])
        XCTAssertEqual(files["folie-02.png"], pages[1])
        XCTAssertEqual(files["folie-03.png"], pages[2])
    }

    func testPaginateKeepsEveryWord() {
        let text = (1...200).map { "wort\($0)" }.joined(separator: " ")
        let pages = DeckExport.paginate(text) { $0.count <= 300 }
        XCTAssertGreaterThan(pages.count, 1)
        XCTAssertTrue(pages.allSatisfy { $0.count <= 300 })
        XCTAssertEqual(pages.joined(separator: " "), text)
    }

    func testPaginateShortTextEmptyTextAndHugeWord() {
        XCTAssertEqual(DeckExport.paginate("kurz") { _ in true }, ["kurz"])
        XCTAssertEqual(DeckExport.paginate("") { _ in true }, [""])
        let pages = DeckExport.paginate("a " + String(repeating: "x", count: 50) + " b") { $0.count <= 10 }
        XCTAssertEqual(pages.joined(separator: " "), "a " + String(repeating: "x", count: 50) + " b")
        XCTAssertTrue(pages.contains(String(repeating: "x", count: 50)))
    }

    func testPngZipFileIsPlainStoredZip() throws {
        let data = DeckExport.pngArchive([Data([9])])
        XCTAssertEqual(Array(data.prefix(2)), [0x50, 0x4B])
    }
}
