import Foundation

/// One change to a presentation, as the chat and the critic propose it. Slides are addressed by id, not number.
struct SlideChange: Equatable {
    enum Action: String, CaseIterable {
        case updateTexts = "update_texts"
        case replaceSlide = "replace_slide"
        case insertSlide = "insert_slide"
        case deleteSlide = "delete_slide"
        case moveSlide = "move_slide"
        case setNotes = "set_notes"
        case setTheme = "set_theme"
        case rename
    }

    var action: Action
    var summary = ""
    var slideID: String?
    /// For insertSlide: the slide the new one follows; nil or unknown means the start.
    var afterSlideID: String?
    /// For moveSlide: the new 1-based position.
    var position: Int?
    var texts: [String: String] = [:]
    var draft: SlideDraft?
    var notes: String?
    var theme: String?
    var title: String?

    /// A German fallback when the model left the summary empty.
    var label: String {
        if !summary.isBlank { return summary }
        switch action {
        case .updateTexts: return "Texte geändert"
        case .replaceSlide: return "Folie neu gestaltet"
        case .insertSlide: return "Folie eingefügt"
        case .deleteSlide: return "Folie gelöscht"
        case .moveSlide: return "Folie verschoben"
        case .setNotes: return "Notizen geändert"
        case .setTheme: return "Design geändert"
        case .rename: return "Titel geändert"
        }
    }
}

struct ChatReply: Equatable {
    var message: String
    var changes: [SlideChange]
}

struct Finding: Equatable {
    enum Severity: CaseIterable {
        case high, medium, low

        var label: String {
            switch self {
            case .high: return "Wichtig"
            case .medium: return "Mittel"
            case .low: return "Klein"
            }
        }
    }

    var severity: Severity
    var slideID: String?
    var problem: String
    var suggestion: String
    var changes: [SlideChange]
}

struct Critique: Equatable {
    var verdict: String
    var findings: [Finding]
}

/// Prompts and parsing for the presentation chat and the critic, plus applying their changes. Mirrors the Android app.
enum PresentationEdits {
    private static let changeProperties = """
    "action": { "type": "string", "enum": ["update_texts", "replace_slide", "insert_slide", "delete_slide", "move_slide", "set_notes", "set_theme", "rename"] },
    "summary": { "type": "string" },
    "slideId": { "type": "string" },
    "afterSlideId": { "type": "string" },
    "position": { "type": "integer" },
    "texts": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "text": { "type": "string" } }, "required": ["id", "text"] } },
    "slide": { "type": "object", "properties": {
      "layout": { "type": "string", "enum": ["TITLE", "SECTION", "BULLETS", "IMAGE_TEXT", "TWO_COLUMNS", "QUOTE"] },
      "title": { "type": "string" }, "subtitle": { "type": "string" },
      "bullets": { "type": "array", "items": { "type": "string" } },
      "leftTitle": { "type": "string" }, "left": { "type": "array", "items": { "type": "string" } },
      "rightTitle": { "type": "string" }, "right": { "type": "array", "items": { "type": "string" } },
      "quote": { "type": "string" }, "attribution": { "type": "string" }, "notes": { "type": "string" }
    } },
    "notes": { "type": "string" },
    "theme": { "type": "string", "enum": ["quill", "nacht", "kreide", "papier"] },
    "title": { "type": "string" }
    """

    private static let changeRules = """
    Changes use these actions; slides and text boxes are addressed by the ids shown in the presentation:
    - update_texts: slideId and texts (every changed text box with its id and the complete new text; bullets are lines separated by \\n)
    - replace_slide: slideId and slide (a new layout with content; keeps the slide's picture for IMAGE_TEXT)
    - insert_slide: afterSlideId ("" for the very beginning) and slide
    - delete_slide: slideId
    - move_slide: slideId and position (new 1-based position)
    - set_notes: slideId and notes (the complete new speaker notes)
    - set_theme: theme (quill, nacht, kreide or papier)
    - rename: title
    Every change gets a short German summary of what it does. Keep slides short (at most 5 bullets of at most
    8 words), details go into the speaker notes. Write German, math in Unicode, never LaTeX.
    """

    static let chatSystem = """
    You edit a German school presentation together with the student who wrote it. They tell you what to change;
    you carry it out as changes and answer briefly in German (one to three sentences, address them as "du").
    Do exactly what they ask, nothing more. If something is unclear or would make the presentation worse, say so in
    the message and make no change. Only use facts from the presentation or the provided material; if they ask for
    content that is not there, say that you cannot check it.
    """ + "\n\n" + changeRules

    static let critiqueSystem = """
    You are a sceptical, demanding critic of a German school presentation, like a strict teacher before a graded
    talk. Look for real weaknesses: claims that are wrong, unsupported or contradict the provided material; missing
    steps in the argument; unclear structure or missing red thread; too much text on a slide; slides without a clear
    message; missing sources; speaker notes that do not fit the slide or the planned talk length; design problems
    such as unreadable colors or overloaded slides. Do not praise. Report at most 10 findings, the most important
    first, each with its severity (high, medium, low), the slide it concerns (slideId, empty for the whole talk),
    the problem, a concrete suggestion, and the changes that implement the suggestion (empty if the student has to
    do it themselves, e.g. rehearse). The verdict is two German sentences on the overall state.
    """ + "\n\n" + changeRules

    static let chatSchema = JSONSchema.object("""
    {
      "type": "object",
      "properties": {
        "message": { "type": "string" },
        "changes": { "type": "array", "items": { "type": "object", "properties": { \(changeProperties) }, "required": ["action", "summary"] } }
      },
      "required": ["message", "changes"]
    }
    """)

    static let critiqueSchema = JSONSchema.object("""
    {
      "type": "object",
      "properties": {
        "verdict": { "type": "string" },
        "findings": { "type": "array", "items": { "type": "object", "properties": {
          "severity": { "type": "string", "enum": ["high", "medium", "low"] },
          "slideId": { "type": "string" },
          "problem": { "type": "string" },
          "suggestion": { "type": "string" },
          "changes": { "type": "array", "items": { "type": "object", "properties": { \(changeProperties) }, "required": ["action", "summary"] } }
        }, "required": ["severity", "problem", "suggestion"] } }
      },
      "required": ["verdict", "findings"]
    }
    """)

    /// The whole presentation with slide and text box ids, as the model sees it before every answer.
    static func state(_ presentation: Presentation) -> String {
        var lines = ["<presentation title=\"\(presentation.title)\" theme=\"\(presentation.themeId)\" minutes=\"\(presentation.minutes)\" slides=\"\(presentation.slides.count)\">"]
        for (index, slide) in presentation.slides.enumerated() {
            lines.append("<slide number=\"\(index + 1)\" id=\"\(slide.id)\">")
            let texts = slide.elements
                .filter { $0.kind == .text && !$0.text.isBlank }
                .sorted { ($0.y, $0.x) < ($1.y, $1.x) }
            for element in texts {
                let role = element.fontSize >= 32 ? "heading" : (element.bullets ? "bullets" : "text")
                lines.append("<text id=\"\(element.id)\" role=\"\(role)\">")
                lines.append(element.text.trimmingCharacters(in: .whitespacesAndNewlines))
                lines.append("</text>")
            }
            let pictures = slide.elements.filter { $0.kind == .image }.count
            if pictures > 0 { lines.append("<pictures count=\"\(pictures)\"/>") }
            if !slide.extractedText.isBlank {
                lines.append("<picture_text>\(String(slide.extractedText.trimmingCharacters(in: .whitespacesAndNewlines).prefix(1500)))</picture_text>")
            }
            if !slide.notes.isBlank { lines.append("<notes>\(slide.notes.trimmingCharacters(in: .whitespacesAndNewlines))</notes>") }
            lines.append("</slide>")
        }
        lines.append("</presentation>")
        return lines.map { $0 + "\n" }.joined()
    }

    // Parsing

    private static func object(_ text: String) -> [String: Any]? {
        guard let data = text.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    private static func trimmed(_ value: Any?) -> String? {
        (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func parseChat(_ text: String) -> ChatReply? {
        guard let root = object(text), let message = root["message"] as? String else { return nil }
        return ChatReply(message: message.trimmingCharacters(in: .whitespacesAndNewlines), changes: parseChanges(root["changes"]))
    }

    static func parseCritique(_ text: String) -> Critique? {
        guard let root = object(text), let items = root["findings"] as? [Any] else { return nil }
        let findings = items.compactMap { item -> Finding? in
            guard let object = item as? [String: Any], let problem = trimmed(object["problem"]), !problem.isEmpty else { return nil }
            let severity: Finding.Severity
            switch (object["severity"] as? String)?.lowercased() {
            case "high", "hoch": severity = .high
            case "low", "niedrig": severity = .low
            default: severity = .medium
            }
            return Finding(
                severity: severity,
                slideID: (object["slideId"] as? String).flatMap { $0.isBlank ? nil : $0 },
                problem: problem,
                suggestion: trimmed(object["suggestion"]) ?? "",
                changes: parseChanges(object["changes"])
            )
        }
        return Critique(verdict: trimmed(root["verdict"]) ?? "", findings: findings)
    }

    private static func parseChanges(_ value: Any?) -> [SlideChange] {
        ((value as? [Any]) ?? []).compactMap { item -> SlideChange? in
            guard let object = item as? [String: Any],
                  let wire = (object["action"] as? String)?.lowercased(),
                  let action = SlideChange.Action(rawValue: wire)
            else { return nil }
            var texts: [String: String] = [:]
            for case let text as [String: Any] in (object["texts"] as? [Any]) ?? [] {
                if let id = text["id"] as? String, let value = text["text"] as? String { texts[id] = value }
            }
            return SlideChange(
                action: action,
                summary: trimmed(object["summary"]) ?? "",
                slideID: (object["slideId"] as? String).flatMap { $0.isBlank ? nil : $0 },
                afterSlideID: object["afterSlideId"] as? String,
                position: PresentationPrompt.int(object["position"]),
                texts: texts,
                draft: (object["slide"] as? [String: Any]).flatMap(PresentationPrompt.parseSlide),
                notes: object["notes"] as? String,
                theme: object["theme"] as? String,
                title: object["title"] as? String
            )
        }
    }

    // Applying

    struct Result {
        var presentation: Presentation
        var applied: [SlideChange]
        var skipped: [SlideChange]
    }

    /// Applies changes in order; a change whose slide no longer exists is skipped, not guessed.
    static func apply(_ presentation: Presentation, _ changes: [SlideChange]) -> Result {
        var current = presentation
        var slides = presentation.slides
        var applied: [SlideChange] = []
        var skipped: [SlideChange] = []

        for change in changes {
            let index = slides.firstIndex { $0.id == change.slideID }
            var ok = false
            switch change.action {
            case .updateTexts:
                if let index, change.texts.keys.contains(where: { key in slides[index].elements.contains { $0.id == key } }) {
                    for i in slides[index].elements.indices {
                        if let text = change.texts[slides[index].elements[i].id] {
                            slides[index].elements[i].text = text.trimmingCharacters(in: .whitespacesAndNewlines)
                        }
                    }
                    ok = true
                }
            case .replaceSlide:
                if let index, let draft = change.draft {
                    slides[index] = rebuild(slides[index], draft)
                    ok = true
                }
            case .insertSlide:
                if var draft = change.draft {
                    if draft.layout == .imageText { draft.layout = .bullets }
                    let slide = Slide(elements: SlideLayouts.build(draft), notes: draft.notes)
                    let after = slides.firstIndex { $0.id == change.afterSlideID } ?? -1
                    slides.insert(slide, at: after + 1)
                    ok = true
                }
            case .deleteSlide:
                if let index, slides.count > 1 {
                    slides.remove(at: index)
                    ok = true
                }
            case .moveSlide:
                if let index, let position = change.position {
                    let slide = slides.remove(at: index)
                    slides.insert(slide, at: min(max(position - 1, 0), slides.count))
                    ok = true
                }
            case .setNotes:
                if let index, let notes = change.notes {
                    slides[index].notes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
                    ok = true
                }
            case .setTheme:
                if let theme = SlideTheme.all.first(where: { $0.id == change.theme?.lowercased() }) {
                    current.themeId = theme.id
                    ok = true
                }
            case .rename:
                if let title = change.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty {
                    current.title = title
                    ok = true
                }
            }
            if ok { applied.append(change) } else { skipped.append(change) }
        }
        current.slides = slides
        return Result(presentation: current, applied: applied, skipped: skipped)
    }

    /// A new layout for an existing slide; its first picture stays for image layouts.
    static func rebuild(_ slide: Slide, _ draft: SlideDraft) -> Slide {
        let image = slide.elements.first { $0.kind == .image && $0.image != nil }
            .map { PlacedImage(name: $0.image!, aspect: $0.width / max(1, $0.height)) }
        var adjusted = draft
        if adjusted.layout == .imageText, image == nil { adjusted.layout = .bullets }
        var result = slide
        result.elements = SlideLayouts.build(adjusted, image: image)
        if !draft.notes.isBlank { result.notes = draft.notes }
        return result
    }
}

/// A conversation about one presentation; earlier turns are kept short so the current state always fits.
final class PresentationChat {
    private let client: any LLMClient
    private var history: [LLMMessage] = []
    private static let maxHistory = 8

    init(client: any LLMClient) {
        self.client = client
    }

    /// `material` is the source material as the plan reader prepares it; it is sent with the first message only.
    func send(_ presentation: Presentation, instruction: String, material: [LLMContent] = []) async throws -> ChatReply {
        let trimmedInstruction = instruction.trimmingCharacters(in: .whitespacesAndNewlines)
        var content: [LLMContent] = history.isEmpty ? material : []
        content.append(.text(PresentationEdits.state(presentation) + "\nInstruction: " + trimmedInstruction))
        let request = LLMRequest(
            purpose: .presentationChat,
            system: PresentationEdits.chatSystem,
            messages: Array(history.suffix(Self.maxHistory)) + [LLMMessage(role: .user, content: content)],
            maxTokens: 8000,
            effort: .low,
            jsonSchema: PresentationEdits.chatSchema
        )
        let reply = try await StructuredOutput.complete(request: request, client: client, parse: PresentationEdits.parseChat)
        // Later turns only need what was asked and answered; the state is sent fresh each time.
        let asked: [LLMContent] = (history.isEmpty ? material : []) + [.text("Instruction: \(trimmedInstruction)")]
        history.append(LLMMessage(role: .user, content: asked))
        history.append(LLMMessage(role: .assistant, content: [.text(reply.message + reply.changes.map { "\n- " + $0.summary }.joined())]))
        return reply
    }

    /// The messages kept for the next turn, for tests.
    var historyCount: Int { history.count }
}

/// The sceptical reviewer: finds weaknesses and proposes changes the student approves one by one.
struct PresentationCritic {
    let client: any LLMClient

    func critique(_ presentation: Presentation, material: [LLMContent] = []) async throws -> Critique {
        var prompt = material.isEmpty ? "" : "The material above is what the presentation is based on; check the slides against it.\n"
        prompt += PresentationEdits.state(presentation) + "\nReview this presentation."
        let request = LLMRequest(
            purpose: .presentationCritique,
            system: PresentationEdits.critiqueSystem,
            messages: [LLMMessage(role: .user, content: material + [.text(prompt)])],
            maxTokens: 12000,
            effort: .high,
            jsonSchema: PresentationEdits.critiqueSchema
        )
        return try await StructuredOutput.complete(request: request, client: client, parse: PresentationEdits.parseCritique)
    }
}
