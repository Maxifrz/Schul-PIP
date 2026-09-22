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
