import Foundation

struct ModelOption: Identifiable, Hashable {
    let id: String
    let name: String
    let note: String
}

final class AppSettings: ObservableObject {
    static let models: [ModelOption] = [
        ModelOption(id: "claude-opus-5", name: "Claude Opus 5", note: "Beste Erklärungen"),
        ModelOption(id: "claude-sonnet-5", name: "Claude Sonnet 5", note: "Schneller, günstiger"),
        ModelOption(id: "claude-haiku-4-5", name: "Claude Haiku 4.5", note: "Am günstigsten"),
    ]
    static let defaultModel = "claude-opus-5"

    private enum Keys {
        static let model = "llm.model"
        static let demoMode = "demoMode"
        static let apiKeyAccount = "anthropic-api-key"
    }

    @Published var model: String {
        didSet { defaults.set(model, forKey: Keys.model) }
    }

    @Published var demoMode: Bool {
        didSet { defaults.set(demoMode, forKey: Keys.demoMode) }
    }

    @Published private(set) var hasAPIKey: Bool

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        model = defaults.string(forKey: Keys.model) ?? Self.defaultModel
        demoMode = defaults.bool(forKey: Keys.demoMode)
        hasAPIKey = KeychainStore.load(account: Keys.apiKeyAccount) != nil
    }

    func saveAPIKey(_ key: String) -> Bool {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        let saved = KeychainStore.save(trimmed, account: Keys.apiKeyAccount)
        hasAPIKey = KeychainStore.load(account: Keys.apiKeyAccount) != nil
        return saved
    }

    func deleteAPIKey() {
        KeychainStore.delete(account: Keys.apiKeyAccount)
        hasAPIKey = false
    }

    func makeClient() -> any LLMClient {
        if demoMode {
            return DemoLLMClient()
        }
        guard let key = KeychainStore.load(account: Keys.apiKeyAccount) else {
            return MissingKeyClient()
        }
        return ClaudeClient(apiKey: key, model: model)
    }
}
