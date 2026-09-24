import UIKit
import XCTest
@testable import Lernwerk

private final class SlideScriptedClient: LLMClient {
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

final class PresentationTests: XCTestCase {
    func testLayoutsStayOnTheSlide() {
        for layout in SlideLayout.allCases {
            for element in SlideLayouts.preset(layout).elements {
                XCTAssertGreaterThanOrEqual(element.x, 0)
                XCTAssertLessThanOrEqual(element.x + element.width, SlideSize.width)
                XCTAssertLessThanOrEqual(element.y + element.height, SlideSize.height)
            }
        }
    }

    func testResizeKeepsTheOppositeCorner() {
        let base = SlideElement(kind: .shape, x: 100, y: 100, width: 200, height: 100, rotation: 30)
        let anchor = SlideGeometry.corner(base, .topLeft)
        let target = base.toSlide(260, 150)
        let resized = SlideGeometry.resize(base, corner: .bottomRight, to: target.0, target.1, keepAspect: false)
        let after = SlideGeometry.corner(resized, .topLeft)
        XCTAssertEqual(resized.width, 260, accuracy: 0.01)
        XCTAssertEqual(after.0, anchor.0, accuracy: 0.01)
        XCTAssertEqual(after.1, anchor.1, accuracy: 0.01)
    }

    func testJSONMatchesTheAndroidApp() throws {
        let json = #"{"id":"a","kind":"TEXT","x":1.0,"y":2.0,"width":3.0,"height":4.0,"text":"Hi","align":"CENTER","anchor":"BOTTOM"}"#
        let element = try JSONDecoder().decode(SlideElement.self, from: Data(json.utf8))
        XCTAssertEqual(element.align, .center)
        XCTAssertEqual(element.anchor, .bottom)
        XCTAssertEqual(element.fontSize, 24)
    }

    func testGenerationAddsPageImagesAndFallsBack() async throws {
        let reply = #"{"title":"Ableiten","slides":[{"layout":"TITLE","title":"Ableiten","notes":"Hallo","sourceMaterial":0,"sourcePages":[1]},{"layout":"IMAGE_TEXT","title":"Graph","bullets":["Steigung"],"imagePage":2,"notes":"Seht her","sourceMaterial":0},{"layout":"IMAGE_TEXT","title":"Ohne Bild","bullets":["a"],"notes":"n"}]}"#
        let client = SlideScriptedClient([reply])
        let presentation = try await PresentationAssistant(client: client).generate(
            content: [.text("material")], materialIDs: ["m1"], topic: "", slideCount: 8, minutes: 10, themeID: "kreide",
            pageImage: { _, page in PlacedImage(name: "page-\(page).png", aspect: 0.75) }
        )
        XCTAssertEqual(client.requests.first?.purpose, .presentation)
        XCTAssertEqual(presentation.themeId, "kreide")
        XCTAssertEqual(presentation.slides[1].elements.first { $0.kind == .image }?.image, "page-2.png")
        XCTAssertFalse(presentation.slides[2].elements.contains { $0.kind == .image })
    }

    func testNotesUseSlideNumbersFromOne() async throws {
        let slide = SlideLayouts.preset(.bullets)
        let client = SlideScriptedClient([#"{"notes":[{"slide":1,"notes":"Eins"},{"slide":3,"notes":"Drei"}]}"#])
        let result = try await PresentationAssistant(client: client).speakerNotes(Presentation(title: "T", slides: [slide, slide, slide], minutes: 6))
        XCTAssertEqual(result.slides.map(\.notes), ["Eins", "", "Drei"])
    }

    func testDemoAnswersEveryFeature() async throws {
        let assistant = PresentationAssistant(client: DemoLLMClient())
        let deck = try await assistant.generate(content: [], materialIDs: ["m"], topic: "", slideCount: 6, minutes: 5, themeID: "quill") { _, _ in nil }
        XCTAssertEqual(deck.slides.count, 6)
        let feedback = try await assistant.feedback(deck)
        XCTAssertTrue(feedback.contains("Fragen"))
    }

    func testPptxIsAZipWithNotes() {
        var slide = SlideLayouts.preset(.bullets)
        slide.notes = "Sprich langsam."
        let data = PptxWriter.write(Presentation(title: "T", slides: [slide])) { _ in nil }
        XCTAssertEqual(Array(data.prefix(2)), [0x50, 0x4B])
        let text = String(decoding: data, as: UTF8.self)
        XCTAssertTrue(text.contains("ppt/slides/slide1.xml"))
        XCTAssertTrue(text.contains("Sprich langsam."))
        XCTAssertEqual(CRC32.checksum(Data("123456789".utf8)), 0xCBF4_3926)
    }

    func testPdfHasOnePagePerSlide() {
        let presentation = Presentation(title: "T", slides: [SlideLayouts.preset(.title), SlideLayouts.preset(.quote)])
        let data = SlideDrawing.pdf(presentation, images: [:])
        let pages = CGPDFDocument(CGDataProvider(data: data as CFData)!)?.numberOfPages
        XCTAssertEqual(pages, 2)
    }

    @MainActor
    func testEditorGestureIsOneUndoStep() {
        let model = PresentationEditorModel(Presentation(title: "T", slides: [SlideLayouts.preset(.bullets)])) { _ in }
        let id = model.slide.elements[0].id
        model.beginGesture()
        for step in 1...5 {
            model.updateElement(id, record: false) { element in
                var moved = element
                moved.x += Double(step)
                return moved
            }
        }
        model.endGesture()
        model.undo()
        XCTAssertEqual(model.slide.elements[0].x, 64, accuracy: 0.01)
        XCTAssertFalse(model.canUndo)
    }
}
