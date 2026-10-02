import Foundation

final class AppSettings: ObservableObject {
    private enum Keys {
        static let tutor = "llm.tutor"
        static let plan = "llm.plan"
        static let demoMode = "demoMode"
        static let bundesland = "bundesland"
        static let customURL = "llm.customURL"
    }

    /// Model for the help panel and the flashcards created from it.
    @Published var tutor: ModelSelection {
        didSet { store(tutor, forKey: Keys.tutor) }
    }

    /// Model that reads the material and builds the study plan.
    @Published var plan: ModelSelection {
        didSet { store(plan, forKey: Keys.plan) }
    }

    @Published var demoMode: Bool {
        didSet { defaults.set(demoMode, forKey: Keys.demoMode) }
    }

    /// For Ferien and Feiertage; nil until the student picks one, so the app never guesses wrong.
    @Published var bundesland: Bundesland? {
        didSet { defaults.set(bundesland?.rawValue, forKey: Keys.bundesland) }
    }

    /// The address of the custom API as typed; `CustomEndpoint.check` turns it into the endpoint.
    @Published var customURL: String {
        didSet { defaults.set(customURL, forKey: Keys.customURL) }
    }

    @Published private(set) var providersWithKey: Set<LLMProvider>

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        tutor = AppSettings.load(Keys.tutor, from: defaults) ?? .defaultSelection(for: .tutor, provider: .nvidia)
        plan = AppSettings.load(Keys.plan, from: defaults) ?? .defaultSelection(for: .plan, provider: .openRouter)
        demoMode = defaults.bool(forKey: Keys.demoMode)
        bundesland = (defaults.string(forKey: Keys.bundesland)).flatMap(Bundesland.init(rawValue:))
        customURL = defaults.string(forKey: Keys.customURL) ?? ""
        providersWithKey = Set(LLMProvider.allCases.filter { KeychainStore.load(account: $0.keychainAccount) != nil })
    }

    var hasAnyKey: Bool {
        !providersWithKey.isEmpty || customEndpoint != nil
    }

    /// The custom API's chat completions address, nil while none (or no valid one) is entered.
    var customEndpoint: URL? {
        CustomEndpoint.check(customURL).url
    }

    /// For the custom API an address is all it takes; its key is optional.
    func hasKey(for provider: LLMProvider) -> Bool {
        provider == .custom ? customEndpoint != nil : providersWithKey.contains(provider)
    }

    func saveKey(_ key: String, for provider: LLMProvider) -> Bool {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, KeychainStore.save(trimmed, account: provider.keychainAccount) else {
            return false
        }
        providersWithKey.insert(provider)
        // Saving a key means the student wants real answers; a demo mode left on from the sample material would hide them.
        demoMode = false
        return true
    }

    /// Forgets the custom API: its address and its key.
    func removeCustomAPI() {
        customURL = ""
        deleteKey(for: .custom)
    }

    func deleteKey(for provider: LLMProvider) {
        KeychainStore.delete(account: provider.keychainAccount)
        providersWithKey.remove(provider)
    }

    func selection(for task: LLMTask) -> ModelSelection {
        switch task {
        case .tutor: return tutor
        case .plan: return plan
        }
    }

    func modelLabel(for task: LLMTask) -> String {
        if demoMode { return "Demo" }
        let chosen = self.selection(for: task)
        return chosen.provider.option(for: chosen.model)?.name ?? chosen.model
    }

    func makeClient(for task: LLMTask) -> any LLMClient {
        if demoMode {
            return DemoLLMClient()
        }
        let chosen = self.selection(for: task)
        let model = chosen.model.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !model.isEmpty else {
            return FailingClient(error: .missingModel)
        }
        if chosen.provider == .custom {
            guard let endpoint = customEndpoint else { return FailingClient(error: .missingEndpoint) }
            return OpenAICompatibleClient(
                provider: .custom,
                apiKey: KeychainStore.load(account: LLMProvider.custom.keychainAccount) ?? "",
                model: model,
                sendsImages: chosen.sendsImages,
                endpoint: endpoint
            )
        }
        guard let key = KeychainStore.load(account: chosen.provider.keychainAccount) else {
            return FailingClient(error: .missingAPIKey(provider: chosen.provider.name))
        }
        switch chosen.provider {
        case .anthropic:
            return ClaudeClient(apiKey: key, model: model)
        case .custom:
            return FailingClient(error: .missingEndpoint)
        case .nvidia, .openRouter, .google:
            let fallback = chosen.provider.fallbackModelIDs.first { $0 != model }
            return OpenAICompatibleClient(
                provider: chosen.provider,
                apiKey: key,
                model: model,
                sendsImages: chosen.sendsImages,
                fallbackModels: fallback.map { [$0] } ?? []
            )
        }
    }

    private func store(_ selection: ModelSelection, forKey key: String) {
        if let data = try? JSONEncoder().encode(selection) {
            defaults.set(data, forKey: key)
        }
    }

    private static func load(_ key: String, from defaults: UserDefaults) -> ModelSelection? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(ModelSelection.self, from: data)
    }
}
