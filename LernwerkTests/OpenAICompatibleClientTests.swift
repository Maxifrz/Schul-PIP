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

    func testTutorAndFlashcardsSkipLongReasoningButThePlanKeepsIt() {
        let tutor = LLMRequest(
            purpose: .tutor(.question),
            system: "s",
            messages: [LLMMessage(role: .user, content: [.text("x")])],
            maxTokens: 100
        )
        let nim = OpenAICompatibleClient.body(for: tutor, model: "m", provider: .nvidia, sendsImages: false)
        let kwargs = nim["chat_template_kwargs"] as? [String: Any]
        XCTAssertEqual(kwargs?["enable_thinking"] as? Bool, false)
        XCTAssertEqual(kwargs?["thinking"] as? Bool, false)
        XCTAssertNil(nim["reasoning"])

        let openRouter = OpenAICompatibleClient.body(for: tutor, model: "m", provider: .openRouter, sendsImages: false)
        XCTAssertEqual((openRouter["reasoning"] as? [String: Any])?["effort"] as? String, "low")
        XCTAssertNil(openRouter["chat_template_kwargs"])

        var plan = tutor
        plan.purpose = .studyPlan
        XCTAssertNil(OpenAICompatibleClient.body(for: plan, model: "m", provider: .nvidia, sendsImages: false)["chat_template_kwargs"])
        XCTAssertNil(OpenAICompatibleClient.body(for: plan, model: "m", provider: .openRouter, sendsImages: false)["reasoning"])
    }

    func testTimeoutsMatchWhatTheStudentWaitsFor() {
        XCTAssertEqual(LLMPurpose.tutor(.hint).timeout, 75)
        XCTAssertEqual(LLMPurpose.flashcard.timeout, 90)
        XCTAssertEqual(LLMPurpose.studyPlan.timeout, 600)
        XCTAssertTrue(LLMError.timeout(seconds: 75).errorDescription?.contains("75 Sekunden") ?? false)
    }

    func testOverloadedModelFallsBackToTheNextOne() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ScriptedProtocol.self]
        ScriptedProtocol.reset(replies: [
            (504, #"{"error":{"message":"Gateway Timeout","code":504}}"#),
            (200, #"{"choices":[{"message":{"content":"Welche Funktion ist innen?"},"finish_reason":"stop"}]}"#),
        ])
        let client = OpenAICompatibleClient(
            provider: .nvidia,
            apiKey: "k",
            model: "z-ai/glm-5.3-flash",
            sendsImages: false,
            fallbackModels: ["google/gemma-4-31b-it"],
            session: URLSession(configuration: configuration)
        )
        let tutor = LLMRequest(
            purpose: .tutor(.question),
            system: "s",
            messages: [LLMMessage(role: .user, content: [.text("x")])],
            maxTokens: 100
        )

        let response = try await client.complete(tutor)

        XCTAssertEqual(response.text, "Welche Funktion ist innen?")
        XCTAssertEqual(response.model, "google/gemma-4-31b-it")
        XCTAssertEqual(ScriptedProtocol.requestedModels, ["z-ai/glm-5.3-flash", "google/gemma-4-31b-it"])
    }

    func testFallbackGivesUpWithAClearError() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ScriptedProtocol.self]
        ScriptedProtocol.reset(replies: [(504, "{}"), (503, "{}")])
        let client = OpenAICompatibleClient(
            provider: .nvidia,
            apiKey: "k",
            model: "a",
            sendsImages: false,
            fallbackModels: ["b"],
            session: URLSession(configuration: configuration)
        )
        let tutor = LLMRequest(purpose: .tutor(.hint), system: "s", messages: [LLMMessage(role: .user, content: [.text("x")])], maxTokens: 100)
        do {
            _ = try await client.complete(tutor)
            XCTFail("Expected an error")
        } catch {
            XCTAssertEqual(error as? LLMError, .overloaded(status: 503))
        }
    }

    func testRequestErrorsDoNotTriggerAFallback() {
        XCTAssertFalse(LLMError.invalidAPIKey.isModelUnavailable)
        XCTAssertFalse(LLMError.rateLimited("x").isModelUnavailable)
        XCTAssertTrue(LLMError.overloaded(status: 504).isModelUnavailable)
        XCTAssertTrue(LLMError.timeout(seconds: 75).isModelUnavailable)
        XCTAssertTrue(LLMError.http(status: 404, message: "model not found").isModelUnavailable)
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
        XCTAssertEqual(parseError(#"{"error":{"message":"upstream failed","code":502}}"#, status: 200), .overloaded(status: 502))
        XCTAssertEqual(parseError(#"{"status":504,"title":"Gateway Timeout"}"#, status: 504), .overloaded(status: 504))
        XCTAssertEqual(parseError(#"{"choices":[{"message":{"content":""},"finish_reason":"content_filter"}]}"#, status: 200), .refusal)
        XCTAssertEqual(parseError(#"{"choices":[{"message":{"content":null},"finish_reason":"length"}]}"#, status: 200), .truncated)
    }
}

/// Answers requests from a fixed script and records which model each request asked for.
private final class ScriptedProtocol: URLProtocol {
    private static var replies: [(Int, String)] = []
    private(set) static var requestedModels: [String] = []

    static func reset(replies: [(Int, String)]) {
        self.replies = replies
        requestedModels = []
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        if let body = Self.body(of: request),
           let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
           let model = json["model"] as? String {
            Self.requestedModels.append(model)
        }
        let (status, text) = Self.replies.isEmpty ? (500, "{}") : Self.replies.removeFirst()
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(text.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private static func body(of request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count > 0 else { break }
            data.append(buffer, count: count)
        }
        return data
    }
}
