import Foundation

/// Prompts, schemas and tolerant parsing for everything the AI does with presentations. Mirrors the Android app.
enum PresentationPrompt {
    static let deckSystem = """
    You help a German upper-secondary student build a school presentation (Referat) from their own material.
    Good school slides: one idea per slide, at most 5 bullets of at most 8 words each, no full sentences on slides,
    the details go into the speaker notes. Start with a title slide, use section slides to structure longer talks,
    end with a summary slide (Fazit) and a sources slide listing the materials and pages used.
    Only use content that is actually in the material; never invent facts, numbers or quotes.
    Write everything in German. Write math with Unicode characters, never LaTeX.
    """

    static func deckInstructions(topic: String, slideCount: Int, minutes: Int) -> String {
        let focus = topic.isBlank ? "the main content of the material" : topic
        let seconds = max(15, minutes * 60 / max(1, slideCount))
        return """
        Create a presentation from the material above.
        Topic or focus: \(focus)
        Number of slides: about \(slideCount) (title and sources slides included)
        Talk length: \(minutes) minutes, so each slide's notes should take about \(seconds) seconds to say.

        For every slide choose a layout:
        - TITLE: title and subtitle (e.g. name, subject, date placeholder "Name · Fach")
        - SECTION: a short title for a new part of the talk
        - BULLETS: title and 2–5 bullets
        - IMAGE_TEXT: title, 2–4 bullets and a page of the material that shows a figure, diagram or table worth showing (imageMaterial, imagePage)
        - TWO_COLUMNS: title, leftTitle/left bullets, rightTitle/right bullets, for comparisons
        - QUOTE: a short quote or definition taken literally from the material, with attribution
        Only use IMAGE_TEXT when that page really contains a figure. Give every slide speaker notes in full German sentences
        and the material (sourceMaterial, the number of the material) and pages (sourcePages) it is based on.
        """
    }

    private static let slideProperties = """
    "layout": { "type": "string", "enum": ["TITLE", "SECTION", "BULLETS", "IMAGE_TEXT", "TWO_COLUMNS", "QUOTE"] },
    "title": { "type": "string" },
    "subtitle": { "type": "string" },
    "bullets": { "type": "array", "items": { "type": "string" } },
    "leftTitle": { "type": "string" },
    "left": { "type": "array", "items": { "type": "string" } },
    "rightTitle": { "type": "string" },
    "right": { "type": "array", "items": { "type": "string" } },
    "quote": { "type": "string" },
    "attribution": { "type": "string" },
    "imageMaterial": { "type": "integer" },
    "imagePage": { "type": "integer" },
    "notes": { "type": "string" },
    "sourceMaterial": { "type": "integer" },
    "sourcePages": { "type": "array", "items": { "type": "integer" } }
    """

    static let slideSchema = JSONSchema.object(
        #"{ "type": "object", "properties": { "# + slideProperties + #" }, "required": ["layout", "title", "notes"] }"#
    )

    static let deckSchema = JSONSchema.object("""
    {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "slides": { "type": "array", "items": { "type": "object", "properties": { \(slideProperties) }, "required": ["layout", "title", "notes"] } }
      },
      "required": ["title", "slides"]
    }
    """)

    enum Rewrite: CaseIterable {
        case shorter, simpler, detailed

        var label: String {
            switch self {
            case .shorter: return "Kürzen"
            case .simpler: return "Vereinfachen"
            case .detailed: return "Ausführlicher"
            }
        }

        var instruction: String {
            switch self {
            case .shorter: return "Make every text shorter: fewer bullets and fewer words, keep the key facts."
            case .simpler: return "Use simpler words and shorter sentences a classmate understands at first hearing; explain or replace technical terms."
            case .detailed: return "Add the most important missing detail from the material, at most one bullet or a few words per text."
            }
        }
    }

    static let rewriteSystem = """
    You edit the texts of one slide of a German school presentation. Keep the language German, keep the slide's topic,
    keep one line per bullet (lines are separated by \\n), never invent facts. Write math with Unicode characters, never LaTeX.
    """

    static let rewriteSchema = JSONSchema.object("""
    {
      "type": "object",
      "properties": {
        "texts": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "text": { "type": "string" } }, "required": ["id", "text"] } }
      },
      "required": ["texts"]
    }
    """)

    static func rewriteRequest(_ slide: Slide, rewrite: Rewrite) -> String {
        var lines = [rewrite.instruction, "Return every text box with its id, changed or unchanged.", "", "<slide>"]
        for element in slide.elements where element.kind == .text && !element.text.isBlank {
            let role = element.fontSize >= 32 ? "heading" : (element.bullets ? "bullets" : "text")
            lines.append("<text id=\"\(element.id)\" role=\"\(role)\">")
            lines.append(element.text)
            lines.append("</text>")
        }
        lines.append("</slide>")
        if !slide.notes.isBlank {
            lines += ["<speaker_notes>", slide.notes, "</speaker_notes>"]
        }
        return lines.joined(separator: "\n") + "\n"
    }

    static func redesignRequest(_ slide: Slide) -> String {
        """
        Redesign this slide: pick the layout that fits its content best (TITLE, SECTION, BULLETS, IMAGE_TEXT, TWO_COLUMNS or QUOTE)
        and rewrite the content for it, following the rules for good school slides. Keep the speaker notes' meaning.
        Only choose IMAGE_TEXT if the slide already has a picture.

        \(outline(slide, includeNotes: true))
        """
    }

    static let notesSystem = """
    You write speaker notes for a German school presentation: what the student says for each slide, in natural spoken
    German, full sentences, addressing the class. Explain what the slide shows instead of reading it out.
    Never invent facts that are not on the slides or in the existing notes.
    """

    static let notesSchema = JSONSchema.object("""
    {
      "type": "object",
      "properties": {
        "notes": { "type": "array", "items": { "type": "object", "properties": { "slide": { "type": "integer" }, "notes": { "type": "string" } }, "required": ["slide", "notes"] } }
      },
      "required": ["notes"]
    }
    """)

    static func notesRequest(_ presentation: Presentation) -> String {
        let perSlide = presentation.minutes * 60 / max(1, presentation.slides.count)
        var text = "Talk length: \(presentation.minutes) minutes for \(presentation.slides.count) slides, so about \(perSlide) seconds per slide\n"
        text += "(roughly \(perSlide * 2) words). Write notes for every slide, numbered from 1.\n\n"
        text += slidesBlock(presentation)
        return text
    }

    static let feedbackSystem = """
    You give feedback on a German school presentation like a good teacher preparing a student: Socratic, encouraging,
    concrete. Look at structure and red thread, amount of text per slide, whether each slide has one clear message,
    the transition between slides and whether the talk length fits. Do not rewrite the slides for the student.
    Name at most three strengths briefly, then ask at most five questions that make the student find the weak spots
    themselves, each question pointing at a specific slide number. Answer in German, address the student as "du",
    use Markdown only for **bold** and short lists.
    """

    static func feedbackRequest(_ presentation: Presentation) -> String {
        "Presentation \"\(presentation.title)\", planned talk length \(presentation.minutes) minutes, \(presentation.slides.count) slides.\n\n"
            + slidesBlock(presentation)
    }

    private static func slidesBlock(_ presentation: Presentation) -> String {
        presentation.slides.enumerated().map { index, slide in
            "<slide number=\"\(index + 1)\">\n\(outline(slide, includeNotes: true))</slide>\n"
        }.joined()
    }

    /// The texts of a slide in reading order, for prompts.
    static func outline(_ slide: Slide, includeNotes: Bool) -> String {
        var lines = slide.elements
            .filter { $0.kind == .text && !$0.text.isBlank }
            .sorted { ($0.y, $0.x) < ($1.y, $1.x) }
            .map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }
        if slide.elements.contains(where: { $0.kind == .image }) { lines.append("[picture]") }
        if includeNotes, !slide.notes.isBlank { lines.append("Notes: \(slide.notes.trimmingCharacters(in: .whitespacesAndNewlines))") }
        return lines.map { $0 + "\n" }.joined()
    }

    // Parsing

    struct DeckDraft {
        var title: String
        var slides: [SlideDraft]
    }

    private static func object(_ text: String) -> [String: Any]? {
        guard let data = text.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    static func parseDeck(_ text: String) -> DeckDraft? {
        guard let root = object(text), let slides = root["slides"] as? [Any] else { return nil }
        let drafts = slides.compactMap { ($0 as? [String: Any]).flatMap(parseSlide) }
        return DeckDraft(title: (root["title"] as? String) ?? drafts.first?.title ?? "Präsentation", slides: drafts)
    }

    static func parseSlideDraft(_ text: String) -> SlideDraft? {
        object(text).flatMap(parseSlide)
    }

    private static func parseSlide(_ object: [String: Any]) -> SlideDraft? {
        let layout = (object["layout"] as? String).flatMap { SlideLayout(rawValue: $0.uppercased()) } ?? .bullets
        let draft = SlideDraft(
            layout: layout,
            title: object["title"] as? String ?? "",
            subtitle: object["subtitle"] as? String ?? "",
            bullets: strings(object["bullets"]),
            leftTitle: object["leftTitle"] as? String ?? "",
            left: strings(object["left"]),
            rightTitle: object["rightTitle"] as? String ?? "",
            right: strings(object["right"]),
            quote: object["quote"] as? String ?? "",
            attribution: object["attribution"] as? String ?? "",
            imageMaterial: int(object["imageMaterial"]),
            imagePage: int(object["imagePage"]).flatMap { $0 > 0 ? $0 : nil },
            notes: object["notes"] as? String ?? "",
            sourceMaterial: int(object["sourceMaterial"]),
            sourcePages: (object["sourcePages"] as? [Any])?.compactMap(int) ?? []
        )
        let hasContent = !draft.title.isBlank || !draft.bullets.isEmpty || !draft.quote.isBlank || !draft.left.isEmpty
        return hasContent ? draft : nil
    }

    private static func strings(_ value: Any?) -> [String] {
        ((value as? [Any]) ?? []).compactMap { ($0 as? String)?.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    /// Numbers may arrive as numbers or as strings from models without schema enforcement.
    private static func int(_ value: Any?) -> Int? {
        // No check for Bool: JSON numbers 0 and 1 bridge to Bool as well, and a boolean here is meaningless anyway.
        if let number = value as? Int { return number }
        if let number = value as? Double { return Int(number) }
        if let number = value as? NSNumber { return number.intValue }
        if let text = value as? String { return Int(text.trimmingCharacters(in: .whitespaces)) ?? Double(text).map { Int($0) } }
        return nil
    }

    static func parseTexts(_ text: String) -> [String: String]? {
        guard let root = object(text), let texts = root["texts"] as? [Any] else { return nil }
        var result: [String: String] = [:]
        for case let item as [String: Any] in texts {
            if let id = item["id"] as? String, let value = item["text"] as? String { result[id] = value }
        }
        return result
    }

    static func parseNotes(_ text: String) -> [Int: String]? {
        guard let root = object(text), let notes = root["notes"] as? [Any] else { return nil }
        var result: [Int: String] = [:]
        for case let item as [String: Any] in notes {
            if let slide = int(item["slide"]), let value = item["notes"] as? String { result[slide] = value }
        }
        return result
    }
}

/// The AI features of the presentation tab; all of them are ordinary LLM requests through the chosen provider.
struct PresentationAssistant {
    let client: any LLMClient

    /// Builds a whole presentation. `content` is the material as the plan generator prepares it for this provider;
    /// `pageImage` renders a material page and stores it as a media file.
    func generate(
        content: [LLMContent],
        materialIDs: [String],
        topic: String,
        slideCount: Int,
        minutes: Int,
        themeID: String,
        pageImage: (_ materialIndex: Int, _ page: Int) async -> PlacedImage?
    ) async throws -> Presentation {
        let request = LLMRequest(
            purpose: .presentation,
            system: PresentationPrompt.deckSystem,
            messages: [LLMMessage(role: .user, content: content)],
            maxTokens: 16000,
            effort: .high,
            jsonSchema: PresentationPrompt.deckSchema
        )
        let deck = try await StructuredOutput.complete(request: request, client: client, parse: PresentationPrompt.parseDeck) { !$0.slides.isEmpty }
        var slides: [Slide] = []
        for draft in deck.slides {
            var image: PlacedImage?
            if draft.layout == .imageText, let page = draft.imagePage {
                let index = draft.imageMaterial ?? draft.sourceMaterial ?? 0
                if materialIDs.indices.contains(index) { image = await pageImage(index, page) }
            }
            var adjusted = draft
            if draft.layout == .imageText, image == nil { adjusted.layout = .bullets }
            let materialID = draft.sourceMaterial.flatMap { materialIDs.indices.contains($0) ? materialIDs[$0] : nil }
                ?? (materialIDs.count == 1 ? materialIDs[0] : nil)
            slides.append(Slide(
                elements: SlideLayouts.build(adjusted, image: image),
                notes: draft.notes,
                sources: draft.sourcePages.map { SourceRef(materialId: materialID, page: $0) }
            ))
        }
        let title = deck.title.isBlank ? (topic.isBlank ? "Präsentation" : topic) : deck.title
        return Presentation(title: title, themeId: themeID, slides: slides, materialIds: materialIDs, minutes: minutes)
    }

    /// New texts for the slide's text boxes; ids the model dropped keep their old text.
    func rewrite(_ slide: Slide, _ rewrite: PresentationPrompt.Rewrite) async throws -> Slide {
        let request = LLMRequest(
            purpose: .slideRewrite,
            system: PresentationPrompt.rewriteSystem,
            messages: [LLMMessage(role: .user, content: [.text(PresentationPrompt.rewriteRequest(slide, rewrite: rewrite))])],
            maxTokens: 4000,
            effort: .low,
            jsonSchema: PresentationPrompt.rewriteSchema
        )
        let ids = Set(slide.elements.map(\.id))
        let texts = try await StructuredOutput.complete(request: request, client: client, parse: PresentationPrompt.parseTexts) { result in
            result.keys.contains { ids.contains($0) }
        }
        var result = slide
        result.elements = slide.elements.map { element in
            var copy = element
            if let text = texts[element.id] { copy.text = text.trimmingCharacters(in: .whitespacesAndNewlines) }
            return copy
        }
        return result
    }

    /// Rebuilds the slide from a fresh layout; an existing picture is kept for image layouts.
    func redesign(_ slide: Slide) async throws -> Slide {
        let request = LLMRequest(
            purpose: .slideRewrite,
            system: PresentationPrompt.deckSystem,
            messages: [LLMMessage(role: .user, content: [.text(PresentationPrompt.redesignRequest(slide))])],
            maxTokens: 4000,
            effort: .low,
            jsonSchema: PresentationPrompt.slideSchema
        )
        var draft = try await StructuredOutput.complete(request: request, client: client, parse: PresentationPrompt.parseSlideDraft)
        let image = slide.elements.first { $0.kind == .image && $0.image != nil }
            .map { PlacedImage(name: $0.image!, aspect: $0.width / max(1, $0.height)) }
        if draft.layout == .imageText, image == nil { draft.layout = .bullets }
        var result = slide
        result.elements = SlideLayouts.build(draft, image: image)
        if !draft.notes.isBlank { result.notes = draft.notes }
        return result
    }

    func speakerNotes(_ presentation: Presentation) async throws -> Presentation {
        let request = LLMRequest(
            purpose: .speakerNotes,
            system: PresentationPrompt.notesSystem,
            messages: [LLMMessage(role: .user, content: [.text(PresentationPrompt.notesRequest(presentation))])],
            maxTokens: 12000,
            effort: .low,
            jsonSchema: PresentationPrompt.notesSchema
        )
        let notes = try await StructuredOutput.complete(request: request, client: client, parse: PresentationPrompt.parseNotes) { !$0.isEmpty }
        var result = presentation
        for index in result.slides.indices {
            if let text = notes[index + 1] { result.slides[index].notes = text.trimmingCharacters(in: .whitespacesAndNewlines) }
        }
        return result
    }

    func feedback(_ presentation: Presentation) async throws -> String {
        let response = try await client.complete(LLMRequest(
            purpose: .presentationFeedback,
            system: PresentationPrompt.feedbackSystem,
            messages: [LLMMessage(role: .user, content: [.text(PresentationPrompt.feedbackRequest(presentation))])],
            maxTokens: 6000,
            effort: .medium
        ))
        return ModelText.removingReasoning(response.text)
    }
}
