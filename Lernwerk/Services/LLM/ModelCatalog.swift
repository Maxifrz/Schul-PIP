import Foundation

/// A model a provider offers right now, as its model list reports it.
struct RemoteModel: Identifiable, Hashable {
    let id: String
    let name: String
    /// True or false when the list says so (OpenRouter) or the name gives it away; nil when unknown.
    let vision: Bool?
    let free: Bool
    let contextLength: Int?

    var note: String {
        var parts: [String] = []
        if free { parts.append("Gratis") }
        if vision == true { parts.append("Bilder") }
        if let contextLength, contextLength >= 1000 { parts.append("\(contextLength / 1000)k Kontext") }
        return parts.joined(separator: " · ")
    }
}

/// Looks up which models a provider offers, so the student can search them instead of typing an id.
enum ModelCatalog {
    enum Failure: LocalizedError, Equatable {
        case needsKey
        case needsAddress
        case rejected
        case http(Int)
        case unreadable
        case offline

        var errorDescription: String? {
            switch self {
            case .needsKey: return "Für die Modellsuche braucht dieser Anbieter einen API-Key. Trag ihn unten ein."
            case .needsAddress: return "Trag zuerst die Adresse der eigenen API ein."
            case .rejected: return "Der Anbieter hat den Key abgelehnt."
            case let .http(status): return "Der Anbieter hat die Modellliste verweigert (\(status))."
            case .unreadable: return "Die Modellliste des Anbieters ließ sich nicht lesen. Tipp die Modell-ID selbst ein."
            case .offline: return "Keine Verbindung zum Anbieter."
            }
        }
    }

    /// Where the list lives; the custom API's is next to its chat completions address.
    static func listURL(for provider: LLMProvider, endpoint: URL?) -> URL? {
        switch provider {
        case .nvidia: return URL(string: "https://integrate.api.nvidia.com/v1/models")
        case .openRouter: return URL(string: "https://openrouter.ai/api/v1/models")
        case .google: return URL(string: "https://generativelanguage.googleapis.com/v1beta/openai/models")
        case .anthropic: return URL(string: "https://api.anthropic.com/v1/models?limit=1000")
        case .custom:
            guard let endpoint else { return nil }
            var text = endpoint.absoluteString
            let suffix = "/chat/completions"
            if text.lowercased().hasSuffix(suffix) { text.removeLast(suffix.count) }
            while text.hasSuffix("/") { text.removeLast() }
            return URL(string: text + "/models")
        }
    }

    /// OpenRouter lists its models without a key; every other provider wants one (a custom server may not).
    static func needsKey(_ provider: LLMProvider) -> Bool {
        provider != .openRouter && provider != .custom
    }

    static func request(provider: LLMProvider, apiKey: String, endpoint: URL?) -> URLRequest? {
        guard let url = listURL(for: provider, endpoint: endpoint) else { return nil }
        var request = URLRequest(url: url, timeoutInterval: 20)
        request.setValue("application/json", forHTTPHeaderField: "accept")
        if provider == .anthropic {
            request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
            request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        } else if !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "authorization")
        }
        return request
    }

    static func fetch(provider: LLMProvider, apiKey: String, endpoint: URL?, session: URLSession = .shared) async throws -> [RemoteModel] {
        if needsKey(provider), apiKey.isEmpty { throw Failure.needsKey }
        if provider == .custom, endpoint == nil { throw Failure.needsAddress }
        guard let request = request(provider: provider, apiKey: apiKey, endpoint: endpoint) else { throw Failure.needsAddress }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw Failure.offline
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 || status == 403 { throw Failure.rejected }
        guard (200..<300).contains(status) else { throw Failure.http(status) }
        let models = parse(data)
        if models.isEmpty { throw Failure.unreadable }
        return models
    }

    // MARK: Reading the list

    /// OpenAI, OpenRouter, NVIDIA and Anthropic answer {"data": [...]}, Gemini's own API {"models": [...]}.
    static func parse(_ data: Data) -> [RemoteModel] {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [] }
        let items = (object["data"] as? [[String: Any]]) ?? (object["models"] as? [[String: Any]]) ?? []
        var seen = Set<String>()
        var result: [RemoteModel] = []
        for item in items {
            guard let raw = (item["id"] as? String) ?? (item["name"] as? String) else { continue }
            let id = raw.hasPrefix("models/") ? String(raw.dropFirst("models/".count)) : raw
            guard !id.isEmpty, isChatModel(id), seen.insert(id).inserted else { continue }
            let displayName = (item["display_name"] as? String) ?? (item["displayName"] as? String)
            let plainName = (item["name"] as? String).flatMap { $0.hasPrefix("models/") ? nil : $0 }
            let name = [displayName, plainName].compactMap { $0 }.first { !$0.isEmpty } ?? id
            result.append(RemoteModel(
                id: id, name: name, vision: vision(item, id: id), free: isFree(item, id: id),
                contextLength: (item["context_length"] as? Int) ?? (item["inputTokenLimit"] as? Int)
            ))
        }
        return result
    }

    /// Embedding, speech, ranking and safety models are in the lists too, but cannot answer a question.
    static func isChatModel(_ id: String) -> Bool {
        let lower = id.lowercased()
        let other = ["embed", "rerank", "whisper", "tts", "moderation", "guard", "reward", "dall-e", "transcribe"]
        return !other.contains { lower.contains($0) }
    }

    private static func isFree(_ item: [String: Any], id: String) -> Bool {
        if id.hasSuffix(":free") { return true }
        guard let pricing = item["pricing"] as? [String: Any] else { return false }
        let prompt = pricing["prompt"] as? String
        let completion = pricing["completion"] as? String
        return prompt == "0" && completion == "0"
    }

    private static func vision(_ item: [String: Any], id: String) -> Bool? {
        if let architecture = item["architecture"] as? [String: Any],
           let inputs = architecture["input_modalities"] as? [String] {
            return inputs.contains("image")
        }
        return guessVision(id)
    }

    /// Names that give away a model which reads pictures; nil when the name says nothing.
    static func guessVision(_ id: String) -> Bool? {
        let lower = id.lowercased()
        let hints = [
            "vision", "-vl", "vl-", "llava", "pixtral", "gemini", "gemma-3", "gemma-4", "gemma3", "gemma4", "claude",
            "gpt-4o", "gpt-4.1", "gpt-5", "llama-3.2-11b", "llama-3.2-90b", "llama-4", "kimi", "glm-4v", "omni",
        ]
        return hints.contains { lower.contains($0) } ? true : nil
    }

    // MARK: Searching

    /// Every word of the query has to be in the id or the name; the best matches come first.
    static func search(_ models: [RemoteModel], query: String) -> [RemoteModel] {
        let words = query.lowercased().split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard !words.isEmpty else { return models }
        let whole = query.trimmingCharacters(in: .whitespaces).lowercased()
        let matches = models.filter { model in
            let haystack = (model.id + " " + model.name).lowercased()
            return words.allSatisfy { haystack.contains($0) }
        }
        func rank(_ model: RemoteModel) -> Int {
            let id = model.id.lowercased()
            let name = model.name.lowercased()
            if id == whole || name == whole { return 0 }
            if id.hasPrefix(whole) { return 1 }
            if name.hasPrefix(whole) { return 2 }
            return 3
        }
        return matches.sorted { (rank($0), $0.id) < (rank($1), $1.id) }
    }
}
