import Foundation

enum ModelText {
    /// Some open models put their reasoning into the answer; only the part after it is meant for the student.
    static func removingReasoning(_ text: String) -> String {
        var result = text
        if let end = result.range(of: "</think>", options: .backwards) {
            result = String(result[end.upperBound...])
        }
        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// Gets JSON out of any model: strict schemas where the API enforces them, tolerant parsing and one retry otherwise.
enum StructuredOutput {
    static let retryInstruction = "Your last reply was not a valid JSON object for the schema. Reply again with only the JSON object and nothing else."

    static func extractJSON(from text: String) -> String {
        var candidate = ModelText.removingReasoning(text)
        if let fenceStart = candidate.range(of: "```") {
            let afterFence = candidate[fenceStart.upperBound...]
            let bodyStart = afterFence.firstIndex(of: "\n").map { afterFence.index(after: $0) } ?? afterFence.startIndex
            let body = afterFence[bodyStart...]
            if let fenceEnd = body.range(of: "```") {
                candidate = String(body[..<fenceEnd.lowerBound])
            }
        }
        if let first = candidate.firstIndex(of: "{"), let last = candidate.lastIndex(of: "}"), first < last {
            candidate = String(candidate[first...last])
        }
        return candidate.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func decode<T: Decodable>(_ type: T.Type, from text: String) -> T? {
        try? JSONDecoder().decode(type, from: Data(extractJSON(from: text).utf8))
    }

    /// Like the Decodable version, but with a hand-written parser for answers that need lenient reading.
    static func complete<T>(
        request: LLMRequest,
        client: any LLMClient,
        parse: (String) -> T?,
        isValid: (T) -> Bool = { _ in true }
    ) async throws -> T {
        let first = try await client.complete(request)
        if let value = parse(extractJSON(from: first.text)), isValid(value) {
            return value
        }
        var retry = request
        retry.messages.append(LLMMessage(role: .assistant, content: [.text(first.text)]))
        retry.messages.append(LLMMessage(role: .user, content: [.text(retryInstruction)]))
        let second = try await client.complete(retry)
        guard let value = parse(extractJSON(from: second.text)), isValid(value) else {
            throw LLMError.invalidResponse
        }
        return value
    }

    static func complete<T: Decodable>(
        _ type: T.Type,
        request: LLMRequest,
        client: any LLMClient,
        isValid: (T) -> Bool = { _ in true }
    ) async throws -> T {
        let first = try await client.complete(request)
        if let value = decode(type, from: first.text), isValid(value) {
            return value
        }

        var retry = request
        retry.messages.append(LLMMessage(role: .assistant, content: [.text(first.text)]))
        retry.messages.append(LLMMessage(role: .user, content: [.text(retryInstruction)]))
        let second = try await client.complete(retry)
        guard let value = decode(type, from: second.text), isValid(value) else {
            throw LLMError.invalidResponse
        }
        return value
    }
}
