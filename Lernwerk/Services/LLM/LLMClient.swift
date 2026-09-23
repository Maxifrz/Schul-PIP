import Foundation

enum LLMRole: String {
    case user
    case assistant
}

enum LLMContent: Equatable {
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

    /// Free tiers queue requests; a student waiting in the help panel needs an answer or an error, not silence.
    var timeout: TimeInterval {
        switch self {
        case .tutor: return 75
        case .flashcard: return 90
        case .studyPlan: return 600
        }
    }
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

/// How a provider can take in a PDF.
enum DocumentHandling: Equatable {
    /// The model reads the PDF itself (Claude).
    case nativePDF
    /// The provider converts scanned PDFs with OCR (OpenRouter's file parser).
    case providerOCR
    /// Only text and images; the app has to extract the PDF itself (NVIDIA NIM).
    case textOnly
}

struct LLMCapabilities: Equatable {
    var acceptsImages: Bool
    var documentHandling: DocumentHandling
}

protocol LLMClient {
    var capabilities: LLMCapabilities { get }
    func complete(_ request: LLMRequest) async throws -> LLMResponse
}

extension URLSession {
    /// Sends a request and turns a timeout into an error the student can act on.
    func llmData(for request: URLRequest) async throws -> (Data, Int) {
        do {
            let (data, response) = try await data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw LLMError.invalidResponse
            }
            return (data, http.statusCode)
        } catch let error as URLError where error.code == .timedOut {
            throw LLMError.timeout(seconds: Int(request.timeoutInterval))
        }
    }
}

enum LLMError: LocalizedError, Equatable {
    case missingAPIKey(provider: String)
    case missingModel
    case invalidAPIKey
    case rateLimited(String)
    case paymentRequired(String)
    case http(status: Int, message: String)
    case refusal
    case truncated
    case invalidResponse
    case requestTooLarge
    case unreadablePDF(String)
    case scannedPDF(title: String, pages: Int)
    case timeout(seconds: Int)
    case overloaded(status: Int)

    var errorDescription: String? {
        switch self {
        case let .missingAPIKey(provider):
            return "Für \(provider) ist noch kein API-Key hinterlegt. Trag ihn in den Einstellungen ein, wähl dort einen anderen Anbieter oder aktiviere den Demo-Modus."
        case .missingModel:
            return "Es ist kein Modell eingetragen. Wähl in den Einstellungen ein Modell aus."
        case .invalidAPIKey:
            return "Der API-Key wurde abgelehnt. Prüf ihn in den Einstellungen."
        case let .rateLimited(message):
            return "Limit des Anbieters erreicht – warte kurz oder versuch es morgen wieder. (\(message))"
        case let .paymentRequired(message):
            return "Der Anbieter verlangt Guthaben für diese Anfrage. (\(message))"
        case let .http(status, message):
            return "Die KI-Anfrage ist fehlgeschlagen (\(status)): \(message)"
        case .refusal:
            return "Das Modell hat die Anfrage abgelehnt. Formuliere sie anders oder markiere einen anderen Bereich."
        case .truncated:
            return "Die Antwort war zu lang und wurde abgeschnitten. Versuch es mit weniger Material."
        case .invalidResponse:
            return "Die Antwort der KI konnte nicht gelesen werden. Versuch es noch einmal oder wähl ein anderes Modell."
        case .requestTooLarge:
            return "Das Material ist zu umfangreich für eine Anfrage. Wähl weniger Dateien aus."
        case let .unreadablePDF(title):
            return "„\(title)“ lässt sich nicht als PDF öffnen."
        case let .overloaded(status):
            return "Der Server des Anbieters war überlastet (\(status)), auch ein Ausweich-Modell hat nicht geantwortet. Versuch es in ein paar Minuten nochmal oder wähl in den Einstellungen ein anderes Modell."
        case let .timeout(seconds):
            return "Keine Antwort nach \(seconds) Sekunden. Das kostenlose Modell ist vermutlich gerade überlastet. Versuch es nochmal oder wähl in den Einstellungen ein anderes Modell."
        case let .scannedPDF(title, pages):
            return "„\(title)“ hat \(pages) eingescannte Seiten, die auch die Texterkennung auf dem iPad nicht lesen konnte. Mit diesem Modell kann die App höchstens \(PlanGenerator.maxScannedPageImages) solcher Seiten als Bild schicken. Stell den Lernplan in den Einstellungen auf OpenRouter oder die Claude API um."
        }
    }
}

extension LLMError {
    /// Errors caused by the hosted model rather than the request; another model may still answer.
    var isModelUnavailable: Bool {
        switch self {
        case .timeout, .overloaded:
            return true
        case let .http(status, _):
            return status == 404
        default:
            return false
        }
    }
}

/// Stands in for a client that cannot be built, so the error surfaces where the request is made.
struct FailingClient: LLMClient {
    let error: LLMError

    var capabilities: LLMCapabilities {
        LLMCapabilities(acceptsImages: true, documentHandling: .nativePDF)
    }

    func complete(_ request: LLMRequest) async throws -> LLMResponse {
        throw error
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
