import Foundation

struct PlanResponse: Codable {
    var topics: [TopicDraft]
}

struct PlanGenerator {
    struct Input {
        var title: String
        var pdf: Data
    }

    /// Base64 inflates PDFs by a third; this keeps the request below the API's 32 MB limit.
    static let maxTotalBytes = 22_000_000

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
    - sourcePages: the 1-based page numbers in that material
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
        let totalBytes = inputs.reduce(0) { $0 + $1.pdf.count }
        guard totalBytes <= Self.maxTotalBytes else {
            throw LLMError.requestTooLarge
        }

        var content: [LLMContent] = []
        for (index, input) in inputs.enumerated() {
            content.append(.text("Material \(index): \(input.title)"))
            content.append(.pdf(input.pdf))
        }
        content.append(.text(Self.instructions))

        let request = LLMRequest(
            purpose: .studyPlan,
            system: Self.system,
            messages: [LLMMessage(role: .user, content: content)],
            maxTokens: 16000,
            effort: .high,
            jsonSchema: Self.schema
        )
        let response = try await client.complete(request)
        return try Self.decode(response.text)
    }

    static func decode(_ text: String) throws -> [TopicDraft] {
        guard let response = try? JSONDecoder().decode(PlanResponse.self, from: Data(text.utf8)),
              !response.topics.isEmpty
        else {
            throw LLMError.invalidResponse
        }
        return response.topics
    }
}
