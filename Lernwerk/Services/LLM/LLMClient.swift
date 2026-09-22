import Foundation

enum LLMRole: String {
    case user
    case assistant
}

enum LLMContent {
    case text(String)
    case image(jpeg: Data)
    case pdf(Data)
}

struct LLMMessage {
    var role: LLMRole
    var content: [LLMContent]
}

enum LLMPurpose: Equatable {
    case tutor(HintLevel)
    case flashcard
    case studyPlan
}

enum LLMEffort: String {
    case low
    case medium
    case high
}

struct LLMRequest {
    var purpose: LLMPurpose
    var system: String
    var messages: [LLMMessage]
    var maxTokens: Int
    var effort: LLMEffort? = nil
    var jsonSchema: [String: Any]? = nil
}

struct LLMResponse {
    var text: String
    var stopReason: String?
    var model: String?
}

protocol LLMClient {
    func complete(_ request: LLMRequest) async throws -> LLMResponse
}

enum LLMError: LocalizedError, Equatable {
    case missingAPIKey
    case http(status: Int, message: String)
    case refusal
    case truncated
    case invalidResponse
    case requestTooLarge

    var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "Kein API-Key hinterlegt. Trag ihn in den Einstellungen ein oder aktiviere den Demo-Modus."
        case let .http(status, message):
            return "Die KI-Anfrage ist fehlgeschlagen (\(status)): \(message)"
        case .refusal:
            return "Das Modell hat die Anfrage abgelehnt. Formuliere sie anders oder markiere einen anderen Bereich."
        case .truncated:
            return "Die Antwort war zu lang und wurde abgeschnitten. Versuch es mit weniger Material."
        case .invalidResponse:
            return "Die Antwort der KI konnte nicht gelesen werden. Versuch es noch einmal."
        case .requestTooLarge:
            return "Das Material ist zu groß für eine Anfrage (max. ca. 22 MB PDF). Wähle weniger Dateien aus."
        }
    }
}

struct MissingKeyClient: LLMClient {
    func complete(_ request: LLMRequest) async throws -> LLMResponse {
        throw LLMError.missingAPIKey
    }
}

enum JSONSchema {
    static func object(_ json: String) -> [String: Any] {
        guard let data = json.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            preconditionFailure("Invalid JSON schema literal")
        }
        return object
    }
}
