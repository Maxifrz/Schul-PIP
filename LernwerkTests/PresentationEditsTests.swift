import XCTest
@testable import Lernwerk

private final class EditsScriptedClient: LLMClient {
    var replies: [String]
    var requests: [LLMRequest] = []

    init(_ replies: [String]) {
        self.replies = replies
    }

    var capabilities: LLMCapabilities { LLMCapabilities(acceptsImages: true, documentHandling: .textOnly) }

    func complete(_ request: LLMRequest) async throws -> LLMResponse {
        requests.append(request)
        return LLMResponse(text: replies.removeFirst(), stopReason: "stop", model: "m")
    }
}

private func texts(_ messages: [LLMMessage]) -> String {
    messages.flatMap(\.content).compactMap { content -> String? in
        if case let .text(text) = content { return text }
        return nil
    }.joined(separator: " ")
}

final class PresentationEditsTests: XCTestCase {
    private func deck() -> Presentation {
        var picture = Slide(elements: SlideLayouts.build(SlideDraft(layout: .bullets, title: "Bild", bullets: ["a"])))
        picture.elements.append(SlideElement(kind: .image, x: 10, y: 10, width: 200, height: 100, image: "pic.png"))
        return Presentation(title: "Deck", slides: [SlideLayouts.preset(.title), SlideLayouts.preset(.bullets), picture])
    }

    func testStateShowsIdsForSlidesAndTexts() {
        let deck = deck()
        let state = PresentationEdits.state(deck)
        let body = deck.slides[1].elements.first { $0.bullets }!
        XCTAssertTrue(state.contains("<slide number=\"2\" id=\"\(deck.slides[1].id)\">"))
        XCTAssertTrue(state.contains("<text id=\"\(body.id)\" role=\"bullets\">"))
        XCTAssertTrue(state.contains("<pictures count=\"1\"/>"))
    }

    func testChangesApplyByIdInOrder() {
        let deck = deck()
        let (first, second, third) = (deck.slides[0], deck.slides[1], deck.slides[2])
        let body = second.elements.first { $0.bullets }!
        let result = PresentationEdits.apply(deck, [
            SlideChange(action: .updateTexts, slideID: second.id, texts: [body.id: "Neu\nZwei"]),
            SlideChange(action: .insertSlide, afterSlideID: first.id, draft: SlideDraft(layout: .section, title: "Teil 1")),
            SlideChange(action: .insertSlide, afterSlideID: "", draft: SlideDraft(layout: .imageText, title: "Vorne", bullets: ["x"])),
            SlideChange(action: .replaceSlide, slideID: third.id, draft: SlideDraft(layout: .imageText, title: "Mit Bild", bullets: ["b"], notes: "N")),
            SlideChange(action: .moveSlide, slideID: third.id, position: 1),
            SlideChange(action: .setNotes, slideID: first.id, notes: " Hallo "),
            SlideChange(action: .setTheme, theme: "Kreide"),
            SlideChange(action: .rename, title: "Neuer Titel"),
            SlideChange(action: .deleteSlide, slideID: "gibt-es-nicht"),
            SlideChange(action: .updateTexts, slideID: second.id, texts: ["unbekannt": "x"]),
        ])
        let slides = result.presentation.slides
        XCTAssertEqual(result.applied.count, 8)
        XCTAssertEqual(result.skipped.count, 2)
        XCTAssertEqual(slides.count, 5)
        XCTAssertEqual(slides[0].id, third.id)
        XCTAssertEqual(slides[0].elements.filter { $0.kind == .image }.map(\.image), ["pic.png"])
        XCTAssertEqual(slides[0].notes, "N")
        // The inserted image layout has no picture, so it became bullets.
        XCTAssertFalse(slides[1].elements.contains { $0.kind == .image || ($0.kind == .shape && $0.shape == .rounded) })
        XCTAssertEqual(slides[2].id, first.id)
        XCTAssertEqual(slides[2].notes, "Hallo")
        XCTAssertEqual(slides[3].elements.first { $0.kind == .text }?.text, "Teil 1")
        XCTAssertEqual(slides[4].elements.first { $0.id == body.id }?.text, "Neu\nZwei")
        XCTAssertEqual(result.presentation.themeId, "kreide")
        XCTAssertEqual(result.presentation.title, "Neuer Titel")
    }

    func testTheLastSlideIsNeverDeleted() {
        let one = Presentation(title: "T", slides: [Slide()])
        let result = PresentationEdits.apply(one, [SlideChange(action: .deleteSlide, slideID: one.slides[0].id)])
        XCTAssertEqual(result.presentation.slides.count, 1)
        XCTAssertEqual(result.skipped.count, 1)
    }

    func testParsingIsLenient() throws {
        let reply = try XCTUnwrap(PresentationEdits.parseChat(#"{"message":" Erledigt ","changes":[{"action":"SET_THEME","theme":"nacht","summary":"Dunkel"},{"action":"fly"},{"action":"insert_slide","afterSlideId":"a","slide":{"layout":"bullets","title":"X","bullets":["1"]}},{"action":"move_slide","slideId":"s","position":"2"}]}"#))
        XCTAssertEqual(reply.message, "Erledigt")
        XCTAssertEqual(reply.changes.count, 3)
        XCTAssertEqual(reply.changes[1].draft?.layout, .bullets)
        XCTAssertEqual(reply.changes[2].position, 2)

        let critique = try XCTUnwrap(PresentationEdits.parseCritique(#"{"verdict":"Zu viel Text.","findings":[{"severity":"HIGH","slideId":"s1","problem":"P","suggestion":"S","changes":[{"action":"set_notes","slideId":"s1","notes":"n"}]},{"severity":"x","problem":"Q","suggestion":""},{"problem":""}]}"#))
        XCTAssertEqual(critique.findings.map(\.severity), [.high, .medium])
        XCTAssertEqual(critique.findings[0].changes.count, 1)
    }

    func testChatSendsMaterialOnceAndStateEveryTime() async throws {
        let client = EditsScriptedClient([#"{"message":"Ok","changes":[]}"#, #"{"message":"Auch","changes":[]}"#])
        let chat = PresentationChat(client: client)
        let deck = deck()
        _ = try await chat.send(deck, instruction: "Mach Folie 2 kürzer", material: [.text("MATERIAL")])
        _ = try await chat.send(deck, instruction: "Und jetzt dunkler")
        XCTAssertEqual(client.requests[0].purpose, .presentationChat)
        XCTAssertFalse(client.requests[0].purpose.needsDepth)
        let lastTurn = texts([client.requests[1].messages.last!])
        XCTAssertTrue(lastTurn.contains("<presentation") && lastTurn.contains("Und jetzt dunkler"))
        XCTAssertFalse(lastTurn.contains("MATERIAL"))
        // Earlier turns stay short: the old state is not repeated.
        let history = texts(Array(client.requests[1].messages.dropLast()))
        XCTAssertFalse(history.contains("<presentation"))
        XCTAssertTrue(history.contains("MATERIAL") && history.contains("Mach Folie 2 kürzer"))
    }

    func testCritiqueThinksLongerAndDemoChangesApply() async throws {
        let client = EditsScriptedClient([#"{"verdict":"V","findings":[]}"#])
        _ = try await PresentationCritic(client: client).critique(deck())
        XCTAssertEqual(client.requests[0].purpose, .presentationCritique)
        XCTAssertTrue(client.requests[0].purpose.needsDepth)

        let deck = deck()
        let demo = try await PresentationCritic(client: DemoLLMClient()).critique(deck)
        let result = PresentationEdits.apply(deck, demo.findings.flatMap(\.changes))
        XCTAssertTrue(result.skipped.isEmpty)
        XCTAssertEqual(result.presentation.slides.count, 4)
        let reply = try await PresentationChat(client: DemoLLMClient()).send(deck, instruction: "egal")
        XCTAssertEqual(reply.changes.map(\.slideID), [deck.slides.last!.id])
    }
}

final class PptxReaderTests: XCTestCase {
    private func fixture(_ name: String) throws -> Data {
        if let url = Bundle(for: Self.self).url(forResource: name, withExtension: "pptx") {
            return try Data(contentsOf: url)
        }
        // The simulator can read the source tree directly.
        return try Data(contentsOf: URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/\(name).pptx"))
    }

    func testReadsPlaceholdersBulletsShapesAndNotes() throws {
        let imported = try PptxReader.read(fixture("school"), title: "Referat")
        let slides = imported.presentation.slides
        XCTAssertEqual(slides.count, 3)

        // 4:3 slides (720 × 540 pt) are centered in 960 × 540.
        let title = try XCTUnwrap(slides[0].elements.first { $0.text == "Photosynthese" })
        XCTAssertEqual(title.align, .center)
        XCTAssertGreaterThanOrEqual(title.fontSize, 40)
        XCTAssertTrue(title.x > 120 && title.x + title.width < 840)
        XCTAssertTrue(slides[0].elements.contains { $0.text == "Biologie · Referat" && !$0.bullets })
        XCTAssertEqual(slides[0].notes, "Begrüßung und Thema nennen.")

        XCTAssertEqual(slides[1].elements.first { $0.bullets }?.text, "Lichtreaktion\n– in den Thylakoiden\nCalvin-Zyklus")
        XCTAssertEqual(slides[1].notes, "Zwei Phasen erklären.\nDann Beispiel.")

        let third = slides[2]
        XCTAssertEqual(third.background, "#203040")
        let pictures = third.elements.filter { $0.kind == .image }
        XCTAssertEqual(pictures.count, 1)
        XCTAssertNotNil(imported.media[pictures[0].image ?? ""])
        XCTAssertEqual(pictures[0].x, 156, accuracy: 0.5)
        XCTAssertEqual(pictures[0].width, 216, accuracy: 0.5)
        let important = try XCTUnwrap(third.elements.first { $0.text == "Wichtig!" })
        XCTAssertTrue(important.bold)
        XCTAssertEqual(important.textColor, "#FFCC00")
        XCTAssertEqual(important.fontSize, 40, accuracy: 0.1)
        XCTAssertTrue(third.elements.contains { $0.text == "Edukt | Produkt\nCO₂ | Glucose" })
        XCTAssertEqual(third.elements.first { $0.kind == .shape && $0.shape == .ellipse }?.fill, "#3D6FB6")
        XCTAssertEqual(third.elements.first { $0.text == "Chloroplast" }?.textColor, "#FFFFFF")
        let arrows = third.elements.filter { $0.kind == .shape && $0.shape == .arrow }
        XCTAssertEqual(arrows.count, 1)
        XCTAssertEqual(arrows.first?.fill, "#C46A55")
        XCTAssertLessThan(arrows.first?.rotation ?? 0, 0) // it points up and to the right
    }

    func testOwnExportRoundTrips() throws {
        var bullets = SlideLayouts.preset(.bullets)
        bullets.notes = "Notiz"
        let original = Presentation(title: "Rund", slides: [
            bullets,
            Slide(elements: [SlideElement(kind: .shape, x: 100, y: 200, width: 300, height: 20, rotation: 30, shape: .arrow, fill: "#C46A55", strokeWidth: 4)]),
        ])
        let back = try PptxReader.read(PptxWriter.write(original) { _ in nil }, title: "Rund").presentation
        let source = original.slides[0].elements.first { $0.bullets }!
        let body = try XCTUnwrap(back.slides[0].elements.first { $0.bullets })
        XCTAssertEqual(body.text, source.text)
        XCTAssertEqual(body.fontSize, source.fontSize, accuracy: 0.1)
        XCTAssertEqual(body.x, source.x, accuracy: 0.5)
        XCTAssertEqual(back.slides[0].notes, "Notiz")
        let arrow = try XCTUnwrap(back.slides[1].elements.first)
        XCTAssertEqual(back.slides[1].elements.count, 1)
        XCTAssertEqual(arrow.rotation, 30, accuracy: 0.5)
        XCTAssertEqual(arrow.width, 300, accuracy: 0.5)
        XCTAssertEqual(arrow.centerX, 250, accuracy: 0.5)
    }

    func testReadsLibreOfficeFiles() throws {
        let presentation = try PptxReader.read(fixture("libreoffice"), title: "LO").presentation
        XCTAssertEqual(presentation.slides.count, 3)
        XCTAssertTrue(presentation.slides[1].elements.contains { $0.text.contains("Äußere & innere Ableitung") })
        XCTAssertEqual(presentation.slides[1].notes, "Sprich langsam.\nZweite Zeile.")
    }

    func testRejectsOtherFiles() {
        XCTAssertThrowsError(try PptxReader.read(Data("kein zip".utf8), title: "x"))
    }

    func testInflateReadsDynamicBlocks() throws {
        // Raw DEFLATE from zlib (level 9, one dynamic Huffman block): 400 random words from the list below.
        let stream = Data(base64Encoded: "pVZ/a8IwEP0q/SrixMHGEBQG+69oXYu1GW0dc59+xlyau9xLVPaHtiS9Xy8v727ZnrZmqIpNfW7Lg2l2xYup26obRrPf7xrzc1lZdFX/2VTFqjajGc7dWFcXi9dmW499VR7GxnTFeuzNsSzW5anqr7bR/pLizOvW9OarLYcx8rfofs9H7mBett9Nl42qc9Ur0oKcRsmHoNpexqc6eRkwgMfMP9N18x3+fisTCA+rhDINB/txPrSnAfgNnySPjydGfnQoX2vwl3bC3yeMXEWeKskzmm1WGc8ZdJ3/93IYqn6Kmj38t9nT6nnKiCxl7pa1tOG/I4QonvMRQLHpuzVIxjzUU/I2rI9nPdKGD53k5wPMDylLGMK6qP4WYT3gMgPnml97lrrbJGVwJPNJ8NqRuICzct5oA8qXXCQsycAGwiXIMu139kfWSAAm6rmo8uisLdJgi4E39AXLyBELwzGl2UAmUFkcXJSVpC99cY/8isOD2AfXSSIxekywWrdMuVwAYKoaUxZnD17QbxtHf0cIpKQurLNTkJ0B6jchALqM0nF6SPtcG2cQoAvD3zWFLFoaSkRq/7QWsDjBCLr+soEoTbiHaI/PAlEjuLPhwnZPrlJ0uD395BQF0+AfoxbUPqokP4Jw6XeoEQ1R0KhtZvuQ0Af4oECpeybXeVdgYiyvl92AeMJzB9cnuh7hA0dx6UaROmoQsAWxa6dngaBVUgv9uhgy+LgWXlVSsf4BVjgb/i8ZJMOmdFlNQTrPqJ9pQUEAy5OWk9i1daUJyqcNTiA8kN4hB9FAG22qKZKvEG4ZAY1nAZ89mlAifZWbqRbnHKpzEknk+o1MCIMYYmj75DSg5395k8HbHw==")!
        let words = Set("Photosynthese Lichtreaktion Thylakoid Calvin Zyklus Glucose Kohlenstoffdioxid Wasser Sauerstoff Chloroplast Energie ATP NADPH Stroma Enzym".split(separator: " ").map(String.init))
        let output = String(decoding: try Inflate.inflate([UInt8](stream)), as: UTF8.self)
        XCTAssertEqual(output.utf8.count, 3815)
        XCTAssertTrue(output.hasPrefix("Glucose Thylakoid Kohlenstoffdioxid"))
        let parsed = output.split(separator: " ").map(String.init)
        XCTAssertEqual(parsed.count, 400)
        XCTAssertTrue(parsed.allSatisfy { words.contains($0) })
    }
}
