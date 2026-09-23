import Foundation

@MainActor
final class TutorSession: ObservableObject {
    struct Turn: Identifiable {
        enum Speaker {
            case tutor
            case student
        }

        let id = UUID()
        let speaker: Speaker
        let text: String
    }

    @Published private(set) var turns: [Turn] = []
    @Published private(set) var level: HintLevel = .question
    @Published private(set) var isLoading = false
    /// What the panel shows while waiting, so a slow free model is visibly working rather than frozen.
    @Published private(set) var waitingFor: String?
    @Published private(set) var waitingSince: Date?
    @Published var errorMessage: String?

    private(set) var context: TutorContext
    let regionImage: Data?
    let modelLabel: String

    private let client: any LLMClient
    private let recognizeText: (Data) async -> String
    private var history: [LLMMessage] = []

    init(
        context: TutorContext,
        regionImage: Data?,
        client: any LLMClient,
        modelLabel: String = "KI",
        recognizeText: @escaping (Data) async -> String = TextRecognizer.recognize
    ) {
        self.context = context
        self.regionImage = regionImage
        self.modelLabel = modelLabel
        self.client = client
        self.recognizeText = recognizeText
    }

    var isDemo: Bool {
        client is DemoLLMClient
    }

    var hasHelped: Bool {
        turns.contains { $0.speaker == .tutor }
    }

    func start() async {
        guard history.isEmpty, !isLoading else { return }
        if context.recognizedText.isEmpty, let regionImage {
            beginWaiting("Lese den markierten Bereich")
            context.recognizedText = await recognizeText(regionImage)
            endWaiting()
        }
        await send("Ich brauche Hilfe bei dem markierten Bereich.", showAsStudentTurn: false)
    }

    func answer(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        await send(trimmed, showAsStudentTurn: true)
    }

    func requestMoreHelp() async {
        guard let next = level.next else { return }
        level = next
        await send("Ich komme nicht weiter. Bitte hilf mir etwas mehr.", showAsStudentTurn: true)
    }

    func revealExplanation() async {
        guard level != .explanation else { return }
        level = .explanation
        await send("Erklär es mir bitte direkt.", showAsStudentTurn: true)
    }

    func makeFlashcard() async throws -> Flashcard {
        let transcript = turns
            .map { ($0.speaker == .tutor ? "Tutor: " : "Student: ") + $0.text }
            .joined(separator: "\n\n")
        let request = LLMRequest(
            purpose: .flashcard,
            system: TutorPrompt.flashcardSystem,
            messages: [LLMMessage(role: .user, content: [.text(TutorPrompt.flashcardRequest(context: context, transcript: transcript))])],
            maxTokens: 4000,
            effort: .low,
            jsonSchema: Flashcard.schema
        )
        return try await StructuredOutput.complete(
            Flashcard.self,
            request: request,
            client: client,
            isValid: { !$0.front.isEmpty && !$0.back.isEmpty }
        )
    }

    private func send(_ text: String, showAsStudentTurn: Bool) async {
        guard !isLoading else { return }

        var content: [LLMContent] = []
        if history.isEmpty {
            let imageToSend = client.capabilities.acceptsImages ? regionImage : nil
            if let imageToSend {
                content.append(.image(jpeg: imageToSend))
            }
            content.append(.text(TutorPrompt.contextBlock(context, hasImage: imageToSend != nil)))
        }
        content.append(.text(TutorPrompt.studentTurn(text, level: level)))
        history.append(LLMMessage(role: .user, content: content))
        if showAsStudentTurn {
            turns.append(Turn(speaker: .student, text: text))
        }

        errorMessage = nil
        beginWaiting("Warte auf \(modelLabel)")
        defer { endWaiting() }

        do {
            let request = LLMRequest(
                purpose: .tutor(level),
                system: TutorPrompt.system,
                messages: history,
                maxTokens: 8000,
                effort: .medium
            )
            let response = try await client.complete(request)
            history.append(LLMMessage(role: .assistant, content: [.text(response.text)]))
            turns.append(Turn(speaker: .tutor, text: response.text))
        } catch {
            history.removeLast()
            if showAsStudentTurn {
                turns.removeLast()
            }
            errorMessage = error.localizedDescription
        }
    }

    private func beginWaiting(_ label: String) {
        isLoading = true
        waitingFor = label
        waitingSince = Date()
    }

    private func endWaiting() {
        isLoading = false
        waitingFor = nil
        waitingSince = nil
    }
}
