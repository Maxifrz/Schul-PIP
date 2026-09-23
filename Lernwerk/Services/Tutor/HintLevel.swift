import Foundation

/// The Socratic hint ladder: the tutor starts with a question and only reveals more on request.
enum HintLevel: Int, CaseIterable, Comparable {
    case question = 1
    case hint
    case explanation

    static func < (lhs: HintLevel, rhs: HintLevel) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    var next: HintLevel? {
        HintLevel(rawValue: rawValue + 1)
    }

    var title: String {
        switch self {
        case .question: return "Frage"
        case .hint: return "Hinweis"
        case .explanation: return "Erklärung"
        }
    }

    var promptName: String {
        switch self {
        case .question: return "question"
        case .hint: return "hint"
        case .explanation: return "explanation"
        }
    }
}
