import Foundation

struct Flashcard: Codable, Equatable {
    var front: String
    var back: String

    static let schema = JSONSchema.object("""
    {
      "type": "object",
      "properties": {
        "front": { "type": "string" },
        "back": { "type": "string" }
      },
      "required": ["front", "back"],
      "additionalProperties": false
    }
    """)
}
