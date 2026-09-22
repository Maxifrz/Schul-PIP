import Foundation

/// Calls the Claude Messages API over plain HTTP; there is no official Swift SDK.
struct ClaudeClient: LLMClient {
    static let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!
    static let apiVersion = "2023-06-01"
    static let fallbackBeta = "server-side-fallback-2026-07-01"

    var apiKey: String
    var model: String
    var session: URLSession = .shared

    func complete(_ request: LLMRequest) async throws -> LLMResponse {
        var urlRequest = URLRequest(url: Self.endpoint)
        urlRequest.httpMethod = "POST"
        urlRequest.timeoutInterval = 600
        urlRequest.setValue("application/json", forHTTPHeaderField: "content-type")
        urlRequest.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        urlRequest.setValue(Self.apiVersion, forHTTPHeaderField: "anthropic-version")
        if Self.supportsFallbacks(model) {
            urlRequest.setValue(Self.fallbackBeta, forHTTPHeaderField: "anthropic-beta")
        }
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: Self.body(for: request, model: model))

        let (data, response) = try await session.data(for: urlRequest)
        guard let http = response as? HTTPURLResponse else {
            throw LLMError.invalidResponse
        }
        return try Self.parse(data: data, status: http.statusCode, expectsJSON: request.jsonSchema != nil)
    }

    static func body(for request: LLMRequest, model: String) -> [String: Any] {
        var body: [String: Any] = [
            "model": model,
            "max_tokens": request.maxTokens,
            "system": request.system,
            "messages": request.messages.map(encodeMessage),
        ]

        var outputConfig: [String: Any] = [:]
        if let effort = request.effort, supportsEffort(model) {
            outputConfig["effort"] = effort.rawValue
        }
        if let schema = request.jsonSchema {
            let format: [String: Any] = ["type": "json_schema", "schema": schema]
            outputConfig["format"] = format
        }
        if !outputConfig.isEmpty {
            body["output_config"] = outputConfig
        }
        if supportsFallbacks(model) {
            body["fallbacks"] = "default"
        }
        return body
    }

    static func encodeMessage(_ message: LLMMessage) -> [String: Any] {
        [
            "role": message.role.rawValue,
            "content": message.content.map(encodeContent),
        ]
    }

    static func encodeContent(_ content: LLMContent) -> [String: Any] {
        switch content {
        case let .text(text):
            return ["type": "text", "text": text]
        case let .image(jpeg):
            let source: [String: Any] = [
                "type": "base64",
                "media_type": "image/jpeg",
                "data": jpeg.base64EncodedString(),
            ]
            return ["type": "image", "source": source]
        case let .pdf(data):
            let source: [String: Any] = [
                "type": "base64",
                "media_type": "application/pdf",
                "data": data.base64EncodedString(),
            ]
            return ["type": "document", "source": source]
        }
    }

    static func supportsFallbacks(_ model: String) -> Bool {
        model == "claude-opus-5" || model == "claude-fable-5-1"
    }

    static func supportsEffort(_ model: String) -> Bool {
        model.hasPrefix("claude-opus") || model.hasPrefix("claude-sonnet-5") || model.hasPrefix("claude-fable")
    }

    static func parse(data: Data, status: Int, expectsJSON: Bool) throws -> LLMResponse {
        let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]

        guard (200..<300).contains(status) else {
            let apiError = object?["error"] as? [String: Any]
            let message = apiError?["message"] as? String ?? String(decoding: data, as: UTF8.self)
            throw LLMError.http(status: status, message: message)
        }
        guard let object, let blocks = object["content"] as? [[String: Any]] else {
            throw LLMError.invalidResponse
        }

        let stopReason = object["stop_reason"] as? String
        if stopReason == "refusal" {
            throw LLMError.refusal
        }

        let text = blocks
            .filter { $0["type"] as? String == "text" }
            .compactMap { $0["text"] as? String }
            .joined()

        if stopReason == "max_tokens", expectsJSON || text.isEmpty {
            throw LLMError.truncated
        }
        guard !text.isEmpty else {
            throw LLMError.invalidResponse
        }
        return LLMResponse(text: text, stopReason: stopReason, model: object["model"] as? String)
    }
}
