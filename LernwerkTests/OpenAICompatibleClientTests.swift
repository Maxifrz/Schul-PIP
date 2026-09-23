import XCTest
@testable import Lernwerk

final class OpenAICompatibleClientTests: XCTestCase {
    private func request(content: [LLMContent], schema: [String: Any]? = nil) -> LLMRequest {
        LLMRequest(
            purpose: .flashcard,
            system: "system",
            messages: [LLMMessage(role: .user, content: content)],
            maxTokens: 500,
            effort: .low,
            jsonSchema: schema
        )
    }

    private func messages(_ body: [String: Any]) -> [[String: Any]] {
        body["messages"] as? [[String: Any]] ?? []
    }

    func testSystemPromptComesFirstAndCarriesTheSchema() {
        let body = OpenAICompatibleClient.body(
            for: request(content: [.text("Hallo")], schema: Flashcard.schema),
            model: "moonshotai/kimi-k3",
            provider: .nvidia,
            sendsImages: true
        )
        let sent = messages(body)
        XCTAssertEqual(body["model"] as? String, "moonshotai/kimi-k3")
        XCTAssertEqual(body["max_tokens"] as? Int, 500)
        XCTAssertNil(body["response_format"])
        XCTAssertEqual(sent.first?["role"] as? String, "system")
        let system = sent.first?["content"] as? String ?? ""
        XCTAssertTrue(system.hasPrefix("system"))
        XCTAssertTrue(system.contains("<json_schema>"))
        XCTAssertTrue(system.contains("\"front\""))
        XCTAssertTrue(JSONSerialization.isValidJSONObject(body))
    }

    func testTextOnlyUserMessageIsAPlainString() {
        let body = OpenAICompatibleClient.body(
            for: request(content: [.text("a"), .text("b")]),
            model: "m",
            provider: .nvidia,
            sendsImages: true
        )
        XCTAssertEqual(messages(body)[1]["content"] as? String, "a\n\nb")
    }

    func testImagesBecomeDataURLs() {
        let body = OpenAICompatibleClient.body(
            for: request(content: [.image(jpeg: Data([1, 2, 3])), .text("x")]),
            model: "m",
            provider: .openRouter,
            sendsImages: true
        )
        let parts = messages(body)[1]["content"] as? [[String: Any]]
        XCTAssertEqual(parts?.count, 2)
        XCTAssertEqual(parts?[0]["type"] as? String, "image_url")
        let imageURL = parts?[0]["image_url"] as? [String: Any]
        XCTAssertEqual(imageURL?["url"] as? String, "data:image/jpeg;base64," + Data([1, 2, 3]).base64EncodedString())
    }

    func testImagesAreDroppedWhenTheModelCannotSeeThem() {
        let tutorRequest = request(content: [.image(jpeg: Data([1])), .text("x")])
        let body = OpenAICompatibleClient.body(for: tutorRequest, model: "m", provider: .nvidia, sendsImages: false)
        XCTAssertEqual(messages(body)[1]["content"] as? String, "x")
        XCTAssertFalse(OpenAICompatibleClient.containsImages(tutorRequest, sendsImages: false))
        XCTAssertTrue(OpenAICompatibleClient.containsImages(tutorRequest, sendsImages: true))
    }

    func testOpenRouterPDFsUseTheOCRParser() {
        let body = OpenAICompatibleClient.body(
            for: request(content: [.pdf(Data([9])), .text("plan")]),
            model: "m",
            provider: .openRouter,
            sendsImages: false
        )
        let parts = messages(body)[1]["content"] as? [[String: Any]]
        XCTAssertEqual(parts?[0]["type"] as? String, "file")
        let file = parts?[0]["file"] as? [String: Any]
        XCTAssertEqual(file?["file_data"] as? String, "data:application/pdf;base64," + Data([9]).base64EncodedString())
        let plugins = body["plugins"] as? [[String: Any]]
        XCTAssertEqual(plugins?.first?["id"] as? String, "file-parser")
        let pdf = plugins?.first?["pdf"] as? [String: Any]
        XCTAssertEqual(pdf?["engine"] as? String, OpenAICompatibleClient.ocrEngine)
    }

    func testAssistantTurnsAreStrings() {
        let message = LLMMessage(role: .assistant, content: [.text("Antwort")])
        let encoded = OpenAICompatibleClient.encodeMessage(message, provider: .nvidia, sendsImages: true)
        XCTAssertEqual(encoded["role"] as? String, "assistant")
        XCTAssertEqual(encoded["content"] as? String, "Antwort")
    }

    func testCapabilitiesDependOnProvider() {
        let nvidia = OpenAICompatibleClient(provider: .nvidia, apiKey: "k", model: "m", sendsImages: false)
        XCTAssertEqual(nvidia.capabilities, LLMCapabilities(acceptsImages: false, documentHandling: .textOnly))
        let openRouter = OpenAICompatibleClient(provider: .openRouter, apiKey: "k", model: "m", sendsImages: true)
        XCTAssertEqual(openRouter.capabilities, LLMCapabilities(acceptsImages: true, documentHandling: .providerOCR))
    }

    func testParseReadsContentAndStripsReasoning() throws {
        let json = #"{"model":"m","choices":[{"message":{"role":"assistant","content":"<think>hmm</think>\nWelche Funktion ist innen?"},"finish_reason":"stop"}]}"#
        let response = try OpenAICompatibleClient.parse(data: Data(json.utf8), status: 200, expectsJSON: false, sentImages: false)
        XCTAssertEqual(response.text, "Welche Funktion ist innen?")
        XCTAssertEqual(response.model, "m")
    }

    func testParseMapsErrors() {
        func parseError(_ json: String, status: Int, sentImages: Bool = false) -> LLMError? {
            do {
                _ = try OpenAICompatibleClient.parse(data: Data(json.utf8), status: status, expectsJSON: false, sentImages: sentImages)
                return nil
            } catch {
                return error as? LLMError
            }
        }

        XCTAssertEqual(parseError(#"{"error":{"message":"bad key","code":401}}"#, status: 401), .invalidAPIKey)
        XCTAssertEqual(parseError(#"{"error":{"message":"slow down","code":429}}"#, status: 429), .rateLimited("slow down"))
        XCTAssertEqual(parseError(#"{"error":{"message":"no credits","code":402}}"#, status: 402), .paymentRequired("no credits"))
        XCTAssertEqual(parseError(#"{"status":404,"title":"Not Found","detail":"model not found"}"#, status: 404), .http(status: 404, message: "model not found"))
        XCTAssertEqual(
            parseError(#"{"error":{"message":"image input not supported","code":400}}"#, status: 400, sentImages: true),
            .http(status: 400, message: "image input not supported" + OpenAICompatibleClient.imageHint)
        )
        XCTAssertEqual(parseError(#"{"error":{"message":"upstream failed","code":502}}"#, status: 200), .http(status: 502, message: "upstream failed"))
        XCTAssertEqual(parseError(#"{"choices":[{"message":{"content":""},"finish_reason":"content_filter"}]}"#, status: 200), .refusal)
        XCTAssertEqual(parseError(#"{"choices":[{"message":{"content":null},"finish_reason":"length"}]}"#, status: 200), .truncated)
    }
}
