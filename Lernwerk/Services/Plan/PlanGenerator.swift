import Foundation
import PDFKit

struct PlanResponse: Codable {
    var topics: [TopicDraft]
}

struct PlanGenerator {
    struct Input {
        var title: String
        var pdf: Data
    }

    /// Base64 inflates PDFs by a third; this keeps requests below the API upload limits.
    static let maxTotalBytes = 22_000_000
    /// Roughly 100k tokens of extracted text.
    static let maxTextCharacters = 400_000
    static let maxScannedPageImages = 12

    let client: any LLMClient

    static let system = """
    You design study plans for a German upper-secondary student preparing for an exam. \
    You read the student's own material and split it into learning units, each small enough for one focused \
    study session. Only use content that is actually in the material.
    """

    static let instructions = """
    Split the material above into 5 to 25 learning topics, in the order they should be learned.
    For every topic provide:
    - title: short German title, unique within the plan
    - summary: one German sentence saying what the student can do after studying it
    - prerequisites: exact titles of other topics in this plan that must be learned first (may be empty)
    - materialIndex: the number of the material that covers the topic
    - sourcePages: the 1-based page numbers in that material (use the "--- Page N ---" markers when present)
    - estimatedMinutes: realistic study time between 15 and 60 minutes, including practice
    """

    static let schema = JSONSchema.object("""
    {
      "type": "object",
      "properties": {
        "topics": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "summary": { "type": "string" },
              "prerequisites": { "type": "array", "items": { "type": "string" } },
              "materialIndex": { "type": "integer" },
              "sourcePages": { "type": "array", "items": { "type": "integer" } },
              "estimatedMinutes": { "type": "integer" }
            },
            "required": ["title", "summary", "prerequisites", "materialIndex", "sourcePages", "estimatedMinutes"],
            "additionalProperties": false
          }
        }
      },
      "required": ["topics"],
      "additionalProperties": false
    }
    """)

    func generate(from inputs: [Input]) async throws -> [TopicDraft] {
        let content = try Self.content(for: inputs, capabilities: client.capabilities)
        let request = LLMRequest(
            purpose: .studyPlan,
            system: Self.system,
            messages: [LLMMessage(role: .user, content: content)],
            maxTokens: 16000,
            effort: .high,
            jsonSchema: Self.schema
        )
        let response = try await StructuredOutput.complete(
            PlanResponse.self,
            request: request,
            client: client,
            isValid: { !$0.topics.isEmpty }
        )
        return response.topics
    }

    /// Picks the cheapest way each provider can read the material: native PDF, local text (from the text layer or
    /// on-device OCR), provider OCR or page images.
    static func content(
        for inputs: [Input],
        capabilities: LLMCapabilities,
        instructions: String = PlanGenerator.instructions,
        recognizeText: (PDFDocument, Int) -> String = TextRecognizer.text(of:pageNumber:)
    ) throws -> [LLMContent] {
        var content: [LLMContent] = []
        var pdfBytes = 0
        var textCharacters = 0
        var imageBudget = maxScannedPageImages

        for (index, input) in inputs.enumerated() {
            if capabilities.documentHandling == .nativePDF {
                content.append(.text("Material \(index): \(input.title)"))
                content.append(.pdf(input.pdf))
                pdfBytes += input.pdf.count
                continue
            }

            guard let document = PDFDocument(data: input.pdf) else {
                throw LLMError.unreadablePDF(input.title)
            }
            var pages = PDFMaterialReader.pageTexts(of: document)
            var recognizedPages = Set<Int>()
            for pageNumber in PDFMaterialReader.scannedPages(in: pages) {
                let recognized = recognizeText(document, pageNumber).trimmingCharacters(in: .whitespacesAndNewlines)
                if recognized.count >= PDFMaterialReader.minimumTextLength {
                    pages[pageNumber - 1] = recognized
                    recognizedPages.insert(pageNumber)
                }
            }
            let scanned = PDFMaterialReader.scannedPages(in: pages)

            if !scanned.isEmpty, capabilities.documentHandling == .providerOCR {
                content.append(.text("Material \(index): \(input.title)"))
                content.append(.pdf(input.pdf))
                pdfBytes += input.pdf.count
                continue
            }

            let text = PDFMaterialReader.labeledText(
                materialIndex: index,
                title: input.title,
                pages: pages,
                recognizedPages: recognizedPages
            )
            textCharacters += text.count
            content.append(.text(text))

            guard !scanned.isEmpty else { continue }
            guard capabilities.acceptsImages, scanned.count <= imageBudget else {
                throw LLMError.scannedPDF(title: input.title, pages: scanned.count)
            }
            for pageNumber in scanned {
                guard let image = PDFMaterialReader.pageImage(of: document, pageNumber: pageNumber) else { continue }
                content.append(.text("Material \(index), page \(pageNumber) (scanned):"))
                content.append(.image(jpeg: image))
            }
            imageBudget -= scanned.count
        }

        guard pdfBytes <= maxTotalBytes, textCharacters <= maxTextCharacters else {
            throw LLMError.requestTooLarge
        }
        content.append(.text(instructions))
        return content
    }

    static func decode(_ text: String) throws -> [TopicDraft] {
        guard let response = StructuredOutput.decode(PlanResponse.self, from: text), !response.topics.isEmpty else {
            throw LLMError.invalidResponse
        }
        return response.topics
    }
}
