import PDFKit
import XCTest
@testable import Lernwerk

final class TutorAndPlanTests: XCTestCase {
    private func context(selected: String = "f(x) = (2x − 7)³", page: String = "Übungsaufgaben") -> TutorContext {
        TutorContext(
            materialTitle: "Analysis",
            pageNumber: 2,
            selectedText: selected,
            pageText: page,
            topicTitle: nil,
            topicSummary: nil,
            weakSpots: []
        )
    }

    func testHintLadderEscalatesAndStops() {
        XCTAssertEqual(HintLevel.question.next, .hint)
        XCTAssertEqual(HintLevel.hint.next, .explanation)
        XCTAssertNil(HintLevel.explanation.next)
        XCTAssertLessThan(HintLevel.question, HintLevel.explanation)
    }

    func testStudentTurnCarriesTheHelpLevel() {
        let turn = TutorPrompt.studentTurn("Ich weiß nicht weiter", level: .hint)
        XCTAssertTrue(turn.hasPrefix("[help level 2: hint]"))
        XCTAssertTrue(turn.hasSuffix("Ich weiß nicht weiter"))
    }

    func testContextFallsBackToImageWithoutTextLayer() {
        let block = TutorPrompt.contextBlock(context(selected: "   "))
        XCTAssertTrue(block.contains("no text layer"))
    }

    func testContextAsksToTypeWhenNeitherTextNorImageExists() {
        let block = TutorPrompt.contextBlock(context(selected: ""), hasImage: false)
        XCTAssertTrue(block.contains("no image available"))
    }

    func testContextIncludesOnDeviceRecognizedText() {
        var tutorContext = context(selected: "")
        tutorContext.recognizedText = "meine Notiz: u' = 3v²"
        let block = TutorPrompt.contextBlock(tutorContext, hasImage: false)
        XCTAssertTrue(block.contains("<recognized_text source=\"on-device OCR\">\nmeine Notiz: u' = 3v²\n</recognized_text>"))
        XCTAssertFalse(block.contains("no image available"))
    }

    func testRecognizedTextEqualToTextLayerIsNotRepeated() {
        var tutorContext = context(selected: "f(x) = (2x − 7)³")
        tutorContext.recognizedText = "f(x) = (2x − 7)³"
        XCTAssertFalse(TutorPrompt.contextBlock(tutorContext).contains("<recognized_text"))
    }

    @MainActor
    func testTutorSessionRunsOCRBeforeTheFirstRequest() async {
        let client = CapturingClient()
        let session = TutorSession(
            context: context(selected: ""),
            regionImage: Data([1, 2, 3]),
            client: client,
            recognizeText: { _ in "Handschrift: v = 2x − 7" }
        )
        await session.start()

        XCTAssertEqual(session.context.recognizedText, "Handschrift: v = 2x − 7")
        let firstTexts = client.requests.first?.messages.first?.content.compactMap { (item: LLMContent) -> String? in
            if case let .text(text) = item { return text }
            return nil
        } ?? []
        XCTAssertTrue(firstTexts.contains { $0.contains("Handschrift: v = 2x − 7") })
        XCTAssertEqual(session.turns.count, 1)
    }

    @MainActor
    func testTutorSessionKnowsWhenItIsOnlyADemo() {
        let demo = TutorSession(context: context(), regionImage: nil, client: DemoLLMClient())
        XCTAssertTrue(demo.isDemo)
        let real = TutorSession(context: context(), regionImage: nil, client: CapturingClient())
        XCTAssertFalse(real.isDemo)
    }

    func testContextClipsVeryLongPages() {
        let block = TutorPrompt.contextBlock(context(page: String(repeating: "a", count: 20_000)))
        XCTAssertLessThan(block.count, TutorPrompt.pageTextLimit + 500)
    }

    func testContextIncludesTopicAndWeakSpots() {
        var tutorContext = context()
        tutorContext.topicTitle = "Kettenregel"
        tutorContext.topicSummary = "Verkettete Funktionen ableiten"
        tutorContext.weakSpots = ["Was ist die innere Ableitung?"]
        let block = TutorPrompt.contextBlock(tutorContext)
        XCTAssertTrue(block.contains("<study_topic>Kettenregel - Verkettete Funktionen ableiten</study_topic>"))
        XCTAssertTrue(block.contains("- Was ist die innere Ableitung?"))
    }

    func testSchemasAreValidJSON() {
        XCTAssertEqual(PlanGenerator.schema["type"] as? String, "object")
        XCTAssertEqual(Flashcard.schema["type"] as? String, "object")
    }

    func testPlanDecoding() throws {
        let drafts = try PlanGenerator.decode(DemoContent.planJSON)
        XCTAssertEqual(drafts.count, 3)
        XCTAssertEqual(drafts[1].prerequisites, ["Verkettete Funktionen erkennen"])
        XCTAssertEqual(drafts[2].sourcePages, [2])
    }

    func testPlanDecodingRejectsGarbageAndEmptyPlans() {
        XCTAssertThrowsError(try PlanGenerator.decode("kein json"))
        XCTAssertThrowsError(try PlanGenerator.decode(#"{"topics":[]}"#))
    }

    func testDemoPDFHasTwoPagesWithText() throws {
        let data = DemoContent.makePDF()
        let material = try XCTUnwrap(PDFDocumentProbe.pageTexts(of: data))
        XCTAssertEqual(material.count, 2)
        XCTAssertTrue(material[0].contains("Kettenregel"))
    }

    func testDemoTutorFollowsTheLadder() async throws {
        let client = DemoLLMClient()
        let request = LLMRequest(
            purpose: .tutor(.explanation),
            system: TutorPrompt.system,
            messages: [LLMMessage(role: .user, content: [.text("x")])],
            maxTokens: 100
        )
        let response = try await client.complete(request)
        XCTAssertTrue(response.text.contains("Schritt für Schritt"))
    }
}

private enum PDFDocumentProbe {
    static func pageTexts(of data: Data) -> [String]? {
        guard let document = PDFDocument(data: data) else { return nil }
        return (0..<document.pageCount).map { document.page(at: $0)?.string ?? "" }
    }
}

private final class CapturingClient: LLMClient {
    var capabilities = LLMCapabilities(acceptsImages: false, documentHandling: .textOnly)
    private(set) var requests: [LLMRequest] = []

    func complete(_ request: LLMRequest) async throws -> LLMResponse {
        requests.append(request)
        return LLMResponse(text: "Welche Funktion steckt innen?", stopReason: "stop", model: "capturing")
    }
}
