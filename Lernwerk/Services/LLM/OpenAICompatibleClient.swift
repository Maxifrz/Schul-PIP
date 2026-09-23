import Foundation

/// Chat Completions client for OpenRouter and NVIDIA NIM, which both speak the OpenAI wire format.
struct OpenAICompatibleClient: LLMClient {
    static let ocrEngine = "mistral-ocr"
    static let imageHint = " – Falls das Modell keine Bilder versteht: In den Einstellungen „Bilder mitschicken“ ausschalten."

    var provider: LLMProvider
    var apiKey: String
    var model: String
    var sendsImages: Bool
    var session: URLSession = .shared

    var capabilities: LLMCapabilities {
        LLMCapabilities(
            acceptsImages: sendsImages,
            documentHandling: provider == .openRouter ? .providerOCR : .textOnly
        )
    }

    func complete(_ request: LLMRequest) async throws -> LLMResponse {
        guard let url = provider.chatCompletionsURL else {
            throw LLMError.invalidResponse
        }
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.timeoutInterval = 600
        urlRequest.setValue("application/json", forHTTPHeaderField: "content-type")
        urlRequest.setValue("Bearer \(apiKey)", forHTTPHeaderField: "authorization")
        if provider == .openRouter {
            urlRequest.setValue("Lernwerk", forHTTPHeaderField: "X-Title")
        }
        let body = Self.body(for: request, model: model, provider: provider, sendsImages: sendsImages)
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: urlRequest)
        guard let http = response as? HTTPURLResponse else {
            throw LLMError.invalidResponse
        }
        return try Self.parse(
            data: data,
            status: http.statusCode,
            expectsJSON: request.jsonSchema != nil,
            sentImages: Self.containsImages(request, sendsImages: sendsImages)
        )
    }

    static func body(for request: LLMRequest, model: String, provider: LLMProvider, sendsImages: Bool) -> [String: Any] {
        var messages: [[String: Any]] = [["role": "system", "content": systemPrompt(for: request)]]
        messages += request.messages.map { encodeMessage($0, provider: provider, sendsImages: sendsImages) }

        var body: [String: Any] = [
            "model": model,
            "max_tokens": request.maxTokens,
            "messages": messages,
        ]
        let hasPDF = request.messages.contains { message in
            message.content.contains { if case .pdf = $0 { return true } else { return false } }
        }
        if hasPDF, provider == .openRouter {
            let parser: [String: Any] = ["id": "file-parser", "pdf": ["engine": ocrEngine]]
            body["plugins"] = [parser]
        }
        return body
    }

    /// Not every hosted model enforces JSON schemas (OpenRouter rejects the request instead), so the schema goes into the prompt.
    static func systemPrompt(for request: LLMRequest) -> String {
        guard let schema = request.jsonSchema,
              let data = try? JSONSerialization.data(withJSONObject: schema, options: [.sortedKeys]),
              let schemaText = String(data: data, encoding: .utf8)
        else {
            return request.system
        }
        return """
        \(request.system)

        Output format: reply with exactly one JSON object that validates against this JSON schema. \
        Output only the JSON object, without code fences or explanations.
        <json_schema>
        \(schemaText)
        </json_schema>
        """
    }

    static func encodeMessage(_ message: LLMMessage, provider: LLMProvider, sendsImages: Bool) -> [String: Any] {
        let parts = message.content.compactMap { encodeContent($0, provider: provider, sendsImages: sendsImages) }
        let isTextOnly = parts.allSatisfy { $0["type"] as? String == "text" }
        if message.role == .assistant || isTextOnly {
            let text = parts.compactMap { $0["text"] as? String }.joined(separator: "\n\n")
            return ["role": message.role.rawValue, "content": text]
        }
        return ["role": message.role.rawValue, "content": parts]
    }

    static func encodeContent(_ content: LLMContent, provider: LLMProvider, sendsImages: Bool) -> [String: Any]? {
        switch content {
        case let .text(text):
            return ["type": "text", "text": text]
        case let .image(jpeg):
            guard sendsImages else { return nil }
            let data = provider.maxImageBytes.map { ImageCompressor.jpeg(jpeg, maxBytes: $0) } ?? jpeg
            let imageURL: [String: Any] = ["url": "data:image/jpeg;base64," + data.base64EncodedString()]
            return ["type": "image_url", "image_url": imageURL]
        case let .pdf(data):
            let file: [String: Any] = [
                "filename": "material.pdf",
                "file_data": "data:application/pdf;base64," + data.base64EncodedString(),
            ]
            return ["type": "file", "file": file]
        }
    }

    static func containsImages(_ request: LLMRequest, sendsImages: Bool) -> Bool {
        sendsImages && request.messages.contains { message in
            message.content.contains { if case .image = $0 { return true } else { return false } }
        }
    }

    static func parse(data: Data, status: Int, expectsJSON: Bool, sentImages: Bool) throws -> LLMResponse {
        let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        let apiError = object?["error"] as? [String: Any]

        if !(200..<300).contains(status) || apiError != nil {
            let code = (apiError?["code"] as? Int) ?? status
            let message = (apiError?["message"] as? String)
                ?? (object?["detail"] as? String)
                ?? (object?["title"] as? String)
                ?? String(decoding: data, as: UTF8.self)
            switch code {
            case 401, 403:
                throw LLMError.invalidAPIKey
            case 402:
                throw LLMError.paymentRequired(message)
            case 429:
                throw LLMError.rateLimited(message)
            case 400 where sentImages, 422 where sentImages:
                throw LLMError.http(status: code, message: message + imageHint)
            default:
                throw LLMError.http(status: code, message: message)
            }
        }

        guard let object,
              let choices = object["choices"] as? [[String: Any]],
              let choice = choices.first
        else {
            throw LLMError.invalidResponse
        }

        let finishReason = choice["finish_reason"] as? String
        if finishReason == "content_filter" {
            throw LLMError.refusal
        }

        let message = choice["message"] as? [String: Any]
        let text = ModelText.removingReasoning(contentText(message?["content"]))
        if finishReason == "length", expectsJSON || text.isEmpty {
            throw LLMError.truncated
        }
        guard !text.isEmpty else {
            throw LLMError.invalidResponse
        }
        return LLMResponse(text: text, stopReason: finishReason, model: object["model"] as? String)
    }

    private static func contentText(_ content: Any?) -> String {
        if let text = content as? String {
            return text
        }
        if let parts = content as? [[String: Any]] {
            return parts.compactMap { $0["text"] as? String }.joined()
        }
        return ""
    }
}
