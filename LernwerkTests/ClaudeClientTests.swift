import XCTest
@testable import Lernwerk

final class ClaudeClientTests: XCTestCase {
    private func request(effort: LLMEffort? = nil, schema: [String: Any]? = nil) -> LLMRequest {
        LLMRequest(
            purpose: .flashcard,
            system: "system",
            messages: [LLMMessage(role: .user, content: [.text("Hallo")])],
            maxTokens: 100,
            effort: effort,
            jsonSchema: schema
        )
    }

    func testOpusBodyCarriesSchemaEffortAndFallbacks() {
        let body = ClaudeClient.body(for: request(effort: .low, schema: Flashcard.schema), model: "claude-opus-5")

        XCTAssertEqual(body["model"] as? String, "claude-opus-5")
        XCTAssertEqual(body["max_tokens"] as? Int, 100)
        XCTAssertEqual(body["fallbacks"] as? String, "default")
        let outputConfig = body["output_config"] as? [String: Any]
        XCTAssertEqual(outputConfig?["effort"] as? String, "low")
        let format = outputConfig?["format"] as? [String: Any]
        XCTAssertEqual(format?["type"] as? String, "json_schema")
        XCTAssertNotNil(format?["schema"])
        XCTAssertTrue(JSONSerialization.isValidJSONObject(body))
    }

    func testHaikuBodySkipsUnsupportedOptions() {
        let body = ClaudeClient.body(for: request(effort: .low), model: "claude-haiku-4-5")
        XCTAssertNil(body["fallbacks"])
        XCTAssertNil(body["output_config"])
    }

    func testImageAndPDFBlocksAreBase64Encoded() {
        let message = LLMMessage(role: .user, content: [.image(jpeg: Data([1, 2, 3])), .pdf(Data([4])), .text("x")])
        let encoded = ClaudeClient.encodeMessage(message)
        let content = encoded["content"] as? [[String: Any]]

        XCTAssertEqual(encoded["role"] as? String, "user")
        XCTAssertEqual(content?.count, 3)
        XCTAssertEqual(content?[0]["type"] as? String, "image")
        let imageSource = content?[0]["source"] as? [String: Any]
        XCTAssertEqual(imageSource?["media_type"] as? String, "image/jpeg")
        XCTAssertEqual(imageSource?["data"] as? String, Data([1, 2, 3]).base64EncodedString())
        XCTAssertEqual(content?[1]["type"] as? String, "document")
        let pdfSource = content?[1]["source"] as? [String: Any]
        XCTAssertEqual(pdfSource?["media_type"] as? String, "application/pdf")
    }

    func testParseReturnsTextAndSkipsThinking() throws {
        let json = #"{"model":"claude-opus-5","stop_reason":"end_turn","content":[{"type":"thinking","thinking":""},{"type":"text","text":"Hallo"}]}"#
        let response = try ClaudeClient.parse(data: Data(json.utf8), status: 200, expectsJSON: false)
        XCTAssertEqual(response.text, "Hallo")
        XCTAssertEqual(response.model, "claude-opus-5")
    }

    func testParseThrowsOnRefusal() {
        let json = #"{"stop_reason":"refusal","content":[]}"#
        XCTAssertThrowsError(try ClaudeClient.parse(data: Data(json.utf8), status: 200, expectsJSON: false)) { error in
            XCTAssertEqual(error as? LLMError, .refusal)
        }
    }

    func testParseSurfacesAPIErrorMessage() {
        let json = #"{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}"#
        XCTAssertThrowsError(try ClaudeClient.parse(data: Data(json.utf8), status: 401, expectsJSON: false)) { error in
            XCTAssertEqual(error as? LLMError, .http(status: 401, message: "invalid x-api-key"))
        }
    }

    func testParseThrowsOnTruncatedJSON() {
        let json = #"{"stop_reason":"max_tokens","content":[{"type":"text","text":"{\"front\":"}]}"#
        XCTAssertThrowsError(try ClaudeClient.parse(data: Data(json.utf8), status: 200, expectsJSON: true)) { error in
            XCTAssertEqual(error as? LLMError, .truncated)
        }
    }
}
