import XCTest
@testable import Lernwerk

/// New components through JSON, PowerPoint and back, and old decks through the new code.
final class ComponentExportTests: XCTestCase {
    private let picture = PlacedImage(name: "p.jpg", aspect: 1.5)
    private let png = Data([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

    /// One slide per new component with typical content, built through the registry, with its origin.
    private func sampleDeck(themeID: String = "quill", density: String = "airy") -> Presentation {
        func items(_ n: Int) -> [DraftItem] { (1...n).map { DraftItem(title: "\($0)0 %", text: "Beschriftung \($0)", icon: "🔥") } }
        var drafts: [(String, SlideDraft)] = []
        drafts.append(("stat-row", SlideDraft(layout: .cards, title: "Zahlen", items: items(3))))
        drafts.append(("comparison", SlideDraft(layout: .twoColumns, title: "Vergleich", leftTitle: "Alt", left: ["a", "b"], rightTitle: "Neu", right: ["c"])))
        drafts.append(("matrix-2x2", SlideDraft(layout: .cards, title: "Matrix", leftTitle: "Aufwand", rightTitle: "Nutzen", items: items(4))))
        drafts.append(("definition", SlideDraft(layout: .bigNumber, title: "Begriff", subtitle: "Aufbau von Zucker aus Licht.", bullets: ["Beispiel eins"], value: "Photosynthese")))
        drafts.append(("agenda", SlideDraft(layout: .process, title: "Agenda", items: items(5))))
        drafts.append(("checklist", SlideDraft(layout: .bullets, title: "Merksätze", bullets: ["Eins", "Zwei", "Drei", "Vier"])))
        drafts.append(("quote-image", SlideDraft(layout: .quote, quote: "Ein Zitat.", attribution: "Jemand")))
        drafts.append(("icon-grid", SlideDraft(layout: .cards, title: "Raster", items: items(6))))
        drafts.append(("staircase", SlideDraft(layout: .process, title: "Treppe", items: items(4))))
        drafts.append(("before-after", SlideDraft(layout: .twoColumns, title: "Wandel", leftTitle: "Vorher", left: ["a"], rightTitle: "Nachher", right: ["b"])))
        let theme = SlideTheme.byID(themeID)
        let slides = drafts.map { id, draft -> Slide in
            let built = ComponentRegistry.build(draft, componentID: id, params: [DeckRhythm.densityParameter: density], image: picture, theme: theme)
            XCTAssertEqual(built.componentID, id, "\(id): \(built.log)")
            return Slide(elements: built.elements, notes: "Notiz \(id)", origin: SlideOrigin(componentID: built.componentID, params: built.params, draft: built.draft))
        }
        return Presentation(title: "Bibliothek", themeId: themeID, slides: slides)
    }

    func testDeckRoundTripsThroughJSON() throws {
        let deck = sampleDeck()
        let back = try JSONDecoder().decode(Presentation.self, from: try JSONEncoder().encode(deck))
        XCTAssertEqual(back, deck)
        XCTAssertTrue(back.slides.allSatisfy { $0.origin != nil })
    }

    func testEveryPartOfThePptxIsWellFormedForEveryTheme() throws {
        for theme in SlideTheme.all {
            let deck = sampleDeck(themeID: theme.id, density: theme.id.hashValue % 2 == 0 ? "compact" : "airy")
            let data = PptxWriter.write(deck) { $0 == "p.jpg" ? self.png : nil }
            let files = try ZipArchive.files(data)
            XCTAssertTrue(files.keys.contains("ppt/slides/slide10.xml"))
            for (name, bytes) in files where name.hasSuffix(".xml") || name.hasSuffix(".rels") {
                XCTAssertNotNil(OfficeXML.parse(bytes), "\(theme.id): \(name)")
            }
        }
    }

    func testPptxRoundTripKeepsEveryText() throws {
        let deck = sampleDeck()
        let back = try PptxReader.read(PptxWriter.write(deck) { $0 == "p.jpg" ? self.png : nil }, title: "Bibliothek").presentation
        XCTAssertEqual(back.slides.count, deck.slides.count)
        for (original, read) in zip(deck.slides, back.slides) {
            let written = Set(original.elements.filter { $0.kind == .text }.map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) })
            let found = read.elements.filter { $0.kind == .text }.map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }
            for text in written where !text.isEmpty {
                XCTAssertTrue(found.contains(text), "lost \"\(text)\" of \(original.origin?.componentID ?? "")")
            }
            XCTAssertEqual(read.notes, original.notes)
        }
    }

    func testMissingPictureLeavesAWellFormedFile() throws {
        let deck = sampleDeck()
        let files = try ZipArchive.files(PptxWriter.write(deck) { _ in nil })
        for (name, bytes) in files where name.hasSuffix(".xml") { XCTAssertNotNil(OfficeXML.parse(bytes), name) }
    }

    // MARK: Old decks

    func testOldDeckJSONKeepsExactlyTheOldKeys() throws {
        var deck = Presentation(title: "Alt", slides: [SlideLayouts.preset(.title), SlideLayouts.preset(.cards), SlideLayouts.preset(.chart)])
        deck.slides[0].elements.append(SlideElement(kind: .image, x: 0, y: 0, width: 10, height: 10, image: "a.jpg"))
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(deck)) as? [String: Any])
        XCTAssertEqual(Set(object.keys), ["id", "title", "themeId", "createdAt", "updatedAt", "slides", "materialIds", "minutes"])
        let slides = try XCTUnwrap(object["slides"] as? [[String: Any]])
        for slide in slides {
            XCTAssertEqual(Set(slide.keys), ["id", "elements", "notes", "sources", "extractedText", "background"])
            for element in try XCTUnwrap(slide["elements"] as? [[String: Any]]) {
                let keys = Set(element.keys)
                XCTAssertTrue(keys.isSubset(of: ["id", "kind", "x", "y", "width", "height", "rotation", "text", "fontSize", "bold", "italic", "align", "anchor", "bullets", "textColor", "shape", "fill", "stroke", "strokeWidth", "image", "font"]), "\(keys)")
                XCTAssertFalse(keys.contains("animation"))
            }
        }
    }

    func testAnOldFileLoadsAndSavesBackTheSame() throws {
        let old = """
        {"id":"d1","title":"Alt","themeId":"quill","createdAt":1,"updatedAt":2,"materialIds":["m"],"minutes":7,
         "slides":[{"id":"s1","notes":"n","sources":[{"materialId":"m","page":2}],"extractedText":"","background":"",
           "elements":[{"id":"e1","kind":"TEXT","x":64,"y":30,"width":832,"height":90,"rotation":0,"text":"Titel","fontSize":36,"bold":true,"italic":false,
             "align":"LEFT","anchor":"BOTTOM","bullets":false,"textColor":"text","shape":"RECT","fill":"accent","stroke":"none","strokeWidth":0,"font":"heading"}]}]}
        """
        let deck = try JSONDecoder().decode(Presentation.self, from: Data(old.utf8))
        XCTAssertEqual(deck.slides[0].elements[0].text, "Titel")
        XCTAssertNil(deck.slides[0].origin)
        XCTAssertNil(deck.slides[0].transition)
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let saved = try JSONSerialization.jsonObject(with: encoder.encode(deck)) as? NSDictionary
        let original = try JSONSerialization.jsonObject(with: Data(old.utf8)) as? NSDictionary
        XCTAssertEqual(saved, original)
        // And it exports like any other deck.
        XCTAssertNoThrow(try PptxReader.read(PptxWriter.write(deck) { _ in nil }, title: "Alt"))
    }

    func testAnUnknownComponentInAnOriginDoesNotBreakLoading() throws {
        var slide = SlideLayouts.preset(.bullets)
        slide.origin = SlideOrigin(componentID: "kommt-spaeter", params: ["x": "y"], draft: SlideDraft(layout: .bullets))
        let back = try JSONDecoder().decode(Slide.self, from: try JSONEncoder().encode(slide))
        XCTAssertEqual(back.origin?.componentID, "kommt-spaeter")
        XCTAssertNil(ComponentRegistry.component("kommt-spaeter"))
        XCTAssertFalse(ComponentRegistry.build(back.origin!.draft, componentID: back.origin!.componentID).elements.isEmpty)
    }
}
