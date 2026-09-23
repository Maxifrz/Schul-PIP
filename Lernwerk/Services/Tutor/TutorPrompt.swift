import Foundation

struct TutorContext {
    var materialTitle: String
    var pageNumber: Int
    var selectedText: String
    var pageText: String
    var topicTitle: String?
    var topicSummary: String?
    var weakSpots: [String]
    /// On-device OCR of the marked region, which also catches the student's handwriting.
    var recognizedText: String = ""
}

enum TutorPrompt {
    static let pageTextLimit = 6000

    static let system = """
    You are a Socratic tutor inside a study app used by a German upper-secondary student preparing for the Abitur.
    The student marked a region of their study material because they are stuck. You receive an image of the marked \
    region, the text extracted from it, text recognized on the device (including the student's handwriting), the \
    surrounding page, and, when available, the current topic of their study plan and flashcards they struggled with \
    before. Recognized text can contain OCR errors, especially in formulas; when it disagrees with the image, trust \
    the image.

    Every student message starts with a tag like [help level 2: hint]. Follow that level exactly:
    - Level 1 (question): Do not explain and do not solve. Ask exactly one guiding question that points the student \
    at the key idea. At most three sentences.
    - Level 2 (hint): Give one concrete hint that narrows the problem down. Name the relevant rule, formula or \
    concept, but leave the final step to the student. End with a question.
    - Level 3 (explanation): Explain fully and step by step, including the solution if the region contains a task. \
    Finish with one short check question so the student can test themselves.

    When the student answers, first say whether the answer is right, partly right or wrong, with one sentence on why. \
    If it is right, confirm it and go one step deeper. If it is wrong, do not reveal the solution below level 3; \
    ask a question that exposes the misconception instead.

    Pair words with pictures: when a sketch, diagram or concrete example would help, describe a small one the student \
    can draw in the margin. Ground everything in the provided material; if it does not contain enough information, \
    say so instead of guessing.

    Always answer in German and address the student as "du". Keep answers short. Write math with Unicode characters \
    (x², √, ·, ≤, →, ∫), never LaTeX. Use Markdown only for **bold**, *italics* and short lists.
    """

    static func contextBlock(_ context: TutorContext, hasImage: Bool = true) -> String {
        var parts: [String] = []
        parts.append("<material title=\"\(context.materialTitle)\" page=\"\(context.pageNumber)\"/>")

        let selected = context.selectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        let recognized = context.recognizedText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !selected.isEmpty {
            parts.append("<marked_text>\n\(selected)\n</marked_text>")
        } else if !recognized.isEmpty {
            parts.append("<marked_text>(no text layer - see recognized_text)</marked_text>")
        } else if hasImage {
            parts.append("<marked_text>(no text layer - read the marked region from the image)</marked_text>")
        } else {
            parts.append("<marked_text>(no text layer and no image available - ask the student to type out the part they are stuck on)</marked_text>")
        }
        if !recognized.isEmpty, recognized != selected {
            parts.append("<recognized_text source=\"on-device OCR\">\n\(recognized)\n</recognized_text>")
        }

        let page = context.pageText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !page.isEmpty {
            let clipped = page.count > pageTextLimit ? String(page.prefix(pageTextLimit)) + "\n[...]" : page
            parts.append("<page_text>\n\(clipped)\n</page_text>")
        }

        if let topic = context.topicTitle {
            let summary = context.topicSummary.map { " - \($0)" } ?? ""
            parts.append("<study_topic>\(topic)\(summary)</study_topic>")
        }

        if !context.weakSpots.isEmpty {
            let list = context.weakSpots.map { "- \($0)" }.joined(separator: "\n")
            parts.append("<weak_spots>\n\(list)\n</weak_spots>")
        }

        return parts.joined(separator: "\n")
    }

    static func studentTurn(_ text: String, level: HintLevel) -> String {
        "[help level \(level.rawValue): \(level.promptName)]\n\(text)"
    }

    static let flashcardSystem = """
    You turn a tutoring conversation into exactly one flashcard for spaced repetition, written in German.
    Front: a question that tests the core idea the student struggled with. No yes/no questions.
    Back: a concise answer of at most three sentences.
    Write math with Unicode characters, never LaTeX.
    """

    static func flashcardRequest(context: TutorContext, transcript: String) -> String {
        """
        Material: \(context.materialTitle), page \(context.pageNumber)
        Marked text: \(context.selectedText.isEmpty ? "(image only)" : context.selectedText)

        <conversation>
        \(transcript)
        </conversation>
        """
    }
}
