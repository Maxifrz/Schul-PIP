import Foundation

enum LLMTask {
    case tutor
    case plan
}

struct ModelOption: Identifiable, Hashable {
    let id: String
    let name: String
    let note: String
    let vision: Bool
}

enum LLMProvider: String, CaseIterable, Identifiable, Codable {
    case nvidia
    case openRouter
    case google
    case anthropic

    var id: String { rawValue }

    var name: String {
        switch self {
        case .nvidia: return "NVIDIA NIM"
        case .openRouter: return "OpenRouter"
        case .google: return "Gemini"
        case .anthropic: return "Claude API"
        }
    }

    var keychainAccount: String {
        switch self {
        case .nvidia: return "nvidia-api-key"
        case .openRouter: return "openrouter-api-key"
        case .google: return "google-api-key"
        case .anthropic: return "anthropic-api-key"
        }
    }

    var keyPlaceholder: String {
        switch self {
        case .nvidia: return "nvapi-…"
        case .openRouter: return "sk-or-…"
        case .google: return "AIza…"
        case .anthropic: return "sk-ant-…"
        }
    }

    var keyPortal: URL {
        switch self {
        case .nvidia: return URL(string: "https://build.nvidia.com")!
        case .openRouter: return URL(string: "https://openrouter.ai")!
        case .google: return URL(string: "https://aistudio.google.com/apikey")!
        case .anthropic: return URL(string: "https://console.anthropic.com")!
        }
    }

    /// Endpoint for OpenAI-compatible providers; Claude uses its own Messages API.
    var chatCompletionsURL: URL? {
        switch self {
        case .nvidia: return URL(string: "https://integrate.api.nvidia.com/v1/chat/completions")!
        case .openRouter: return URL(string: "https://openrouter.ai/api/v1/chat/completions")!
        case .google: return URL(string: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions")!
        case .anthropic: return nil
        }
    }

    /// NVIDIA's hosted endpoints reject large inline images, so they get recompressed below this size.
    var maxImageBytes: Int? {
        switch self {
        case .nvidia: return 180_000
        case .openRouter, .google, .anthropic: return nil
        }
    }

    var models: [ModelOption] {
        switch self {
        case .nvidia:
            return [
                ModelOption(id: "moonshotai/kimi-k3", name: "Kimi K3", note: "Stark, versteht Bilder", vision: true),
                ModelOption(id: "google/gemma-4-31b-it", name: "Gemma 4 31B", note: "Schnell, versteht Bilder", vision: true),
                ModelOption(id: "z-ai/glm-5.3-flash", name: "GLM 5.3 Flash", note: "Schnell, versteht Bilder", vision: true),
                ModelOption(id: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 3 Super", note: "Nur Text", vision: false),
            ]
        case .openRouter:
            return [
                ModelOption(id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B", note: "Gratis, versteht Bilder", vision: true),
                ModelOption(id: "qwen/qwen3.8-27b:free", name: "Qwen 3.8 27B", note: "Gratis, versteht Bilder", vision: true),
                ModelOption(id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super", note: "Gratis, nur Text, großer Kontext", vision: false),
                ModelOption(id: "openrouter/free", name: "Automatisch", note: "Gratis, wechselndes Modell", vision: true),
                ModelOption(id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5", note: "Kostenpflichtig, braucht Guthaben", vision: true),
            ]
        case .google:
            return [
                ModelOption(id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", note: "Stark, versteht Bilder, Gratis-Kontingent", vision: true),
                ModelOption(id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite", note: "Am schnellsten, versteht Bilder", vision: true),
                ModelOption(id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", note: "Beste Qualität, Vorschau, oft kostenpflichtig", vision: true),
            ]
        case .anthropic:
            return [
                ModelOption(id: "claude-opus-5", name: "Claude Opus 5", note: "Beste Erklärungen", vision: true),
                ModelOption(id: "claude-sonnet-5", name: "Claude Sonnet 5", note: "Schneller, günstiger", vision: true),
                ModelOption(id: "claude-haiku-4-5", name: "Claude Haiku 4.5", note: "Am günstigsten", vision: true),
            ]
        }
    }

    /// Fast, widely available models to fall back on when the chosen one is overloaded.
    var fallbackModelIDs: [String] {
        switch self {
        case .nvidia: return ["google/gemma-4-31b-it", "z-ai/glm-5.3-flash"]
        case .openRouter: return ["google/gemma-4-31b-it:free", "openrouter/free"]
        case .google: return ["gemini-3.5-flash-lite", "gemini-3.8-flash"]
        case .anthropic: return []
        }
    }

    func defaultModel(for task: LLMTask) -> ModelOption {
        switch (self, task) {
        case (.openRouter, .plan):
            return models[2]
        case (.nvidia, .tutor):
            return models[1]
        default:
            return models[0]
        }
    }

    func option(for modelID: String) -> ModelOption? {
        models.first { $0.id == modelID }
    }
}

struct ModelSelection: Codable, Equatable {
    var provider: LLMProvider
    var model: String
    var sendsImages: Bool

    static func defaultSelection(for task: LLMTask, provider: LLMProvider) -> ModelSelection {
        let option = provider.defaultModel(for: task)
        return ModelSelection(provider: provider, model: option.id, sendsImages: option.vision)
    }
}
