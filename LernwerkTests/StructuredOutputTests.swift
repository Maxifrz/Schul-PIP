import XCTest
@testable import Lernwerk

private final class ScriptedClient: LLMClient {
    var capabilities = LLMCapabilities(acceptsImages: true, documentHandling: .textOnly)
    private var replies: [String]
    private(set) var requests: [LLMRequest] = []

    init(replies: [String]) {
        self.replies = replies
    }

    func complete(_ request: LLMRequest) async throws -> LLMResponse {
        requests.append(request)
        return LLMResponse(text: replies.removeFirst(), stopReason: "stop", model: "scripted")
    }
}

final class StructuredOutputTests: XCTestCase {
    private let flashcardRequest = LLMRequest(
        purpose: .flashcard,
        system: "s",
        messages: [LLMMessage(role: .user, content: [.text("mach eine Karte")])],
        maxTokens: 100,
        jsonSchema: Flashcard.schema
    )

    func testExtractsJSONFromFencesProseAndReasoning() {
        let fenced = "Hier ist die Karte:\n```json\n{\"front\":\"F\",\"back\":\"B\"}\n```\nViel Erfolg!"
        XCTAssertEqual(StructuredOutput.extractJSON(from: fenced), #"{"front":"F","back":"B"}"#)

        let reasoning = "<think>{not this}</think>Klar: {\"front\":\"F\",\"back\":\"B\"} – fertig."
        XCTAssertEqual(StructuredOutput.decode(Flashcard.self, from: reasoning), Flashcard(front: "F", back: "B"))
    }

    func testValidReplyNeedsNoRetry() async throws {
        let client = ScriptedClient(replies: [#"{"front":"F","back":"B"}"#])
        let card = try await StructuredOutput.complete(Flashcard.self, request: flashcardRequest, client: client)
        XCTAssertEqual(card, Flashcard(front: "F", back: "B"))
        XCTAssertEqual(client.requests.count, 1)
    }

    func testInvalidReplyIsRetriedOnceWithTheConversation() async throws {
        let client = ScriptedClient(replies: ["Gerne! Die Karte lautet: Vorderseite F", #"{"front":"F","back":"B"}"#])
        let card = try await StructuredOutput.complete(Flashcard.self, request: flashcardRequest, client: client)
        XCTAssertEqual(card, Flashcard(front: "F", back: "B"))
        XCTAssertEqual(client.requests.count, 2)
        let retry = client.requests[1].messages
        XCTAssertEqual(retry.count, 3)
        XCTAssertEqual(retry[1].role, .assistant)
        XCTAssertEqual(retry[2].content, [.text(StructuredOutput.retryInstruction)])
    }

    func testSecondFailureThrows() async {
        let client = ScriptedClient(replies: ["nope", "still nope"])
        do {
            _ = try await StructuredOutput.complete(Flashcard.self, request: flashcardRequest, client: client)
            XCTFail("Expected an error")
        } catch {
            XCTAssertEqual(error as? LLMError, .invalidResponse)
        }
    }

    func testValidationTriggersRetry() async throws {
        let client = ScriptedClient(replies: [#"{"topics":[]}"#, DemoContent.planJSON])
        let plan = try await StructuredOutput.complete(
            PlanResponse.self,
            request: flashcardRequest,
            client: client,
            isValid: { !$0.topics.isEmpty }
        )
        XCTAssertEqual(plan.topics.count, 3)
    }

    func testTopicDecodingToleratesLooseModels() throws {
        let json = #"{"topics":[{"title":"Kettenregel","estimatedMinutes":"25","sourcePages":["2","3"]}]}"#
        let topics = try PlanGenerator.decode(json)
        XCTAssertEqual(topics.first?.title, "Kettenregel")
        XCTAssertEqual(topics.first?.estimatedMinutes, 25)
        XCTAssertEqual(topics.first?.sourcePages, [2, 3])
        XCTAssertEqual(topics.first?.prerequisites, [])
        XCTAssertEqual(topics.first?.materialIndex, 0)
    }
}
