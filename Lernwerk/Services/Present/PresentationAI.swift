import Foundation

/// Prompts, schemas and tolerant parsing for everything the AI does with presentations. Mirrors the Android app.
enum PresentationPrompt {
    static let deckSystem = """
    You help a German upper-secondary student build a school presentation (Referat) from their own material.
    Only use content that is actually in the material (or in the research, if there is any); never invent facts,
    numbers, dates or quotes.
    Write everything in German. Write math with Unicode characters, never LaTeX.

    What makes a good school talk:
    - A red thread: open with a hook (a question, a surprising fact or a problem from the material), give the
      context, build up the core in logical steps, show at least one concrete example, answer the opening question
      in the summary (Fazit), end with the sources.
    - One message per slide. The slide title states that message as a short claim (at most 10 words), not a topic
      label: "Enzyme senken die Aktivierungsenergie" instead of "Enzyme".
    - Slides support the talk, they do not replace it: at most 5 bullets of at most 8 words, no full sentences on
      slides. Everything else goes into the speaker notes.
    - Show instead of list. Pick the slide type that fits the content:
      numbers → BIG_NUMBER (one striking number) or CHART (several numbers from the material);
      dates or eras → TIMELINE; steps, cycles or cause and effect → PROCESS;
      three or four parallel aspects → CARDS; a comparison → TWO_COLUMNS or TABLE;
      a figure, diagram or table page in the material → IMAGE_TEXT or IMAGE_FULL;
      a key question or thesis → STATEMENT; a literal definition or quote → QUOTE.
      Use BULLETS only when nothing else fits, never more than two BULLETS slides in a row.
    - Charts only with numbers that literally appear in the material, with their unit.
    - Speaker notes are what the student says: full spoken sentences that explain the slide and lead over to the
      next one.
    """

    /// Slide types as the model may choose them; BLANK is for the editor only.
    private static let layoutNames = SlideLayout.allCases.filter { $0 != .blank }.map { "\"\($0.rawValue)\"" }.joined(separator: ", ")

    static let layoutGuide = """
    Slide types and the fields they use:
    - TITLE: title, subtitle ("Name · Fach · Datum" if unknown)
    - SECTION: title of a new part, optional subtitle
    - STATEMENT: title is one striking claim or question, optional subtitle
    - BULLETS: title, 2–5 bullets
    - IMAGE_TEXT: title, 2–4 bullets, imageMaterial and imagePage of a material page with a figure
    - IMAGE_FULL: title, subtitle as caption, imageMaterial and imagePage of a material page with a figure
    - TWO_COLUMNS: title, leftTitle, left, rightTitle, right
    - CARDS: title, 3–4 items with title (2–4 words), text (at most 12 words) and icon (one fitting emoji)
    - PROCESS: title, 3–5 items with title (the step) and text (at most 10 words)
    - TIMELINE: title, 3–6 items with title (date or era) and text (at most 10 words)
    - BIG_NUMBER: title, value (the number with unit, e.g. "70 %"), subtitle explaining it
    - CHART: title, chart with kind (BAR for categories, LINE for development over time), labels, values (numbers
      only) and unit, subtitle naming the source
    - TABLE: title, table as rows of cells, first row is the header, at most 5 columns and 7 rows
    - QUOTE: quote taken literally from the material, attribution
    """

    /// Added to `deckSystem` when the app looks things up on Wikipedia.
    static let researchRules = """
    Research: besides the material you may get excerpts of German Wikipedia articles, each with an id (W1, W2 …).
    - The student's material comes first. Use the research for context, background, current numbers and examples
      the material does not give.
    - Only use facts that are literally stated in the excerpts or the material, never facts from your own memory.
    - Every slide that uses a fact from an article lists the article ids in webSources, and its notes say where the
      fact comes from ("laut Wikipedia …").
    - If the research contradicts the material, follow the material and mention the difference in the notes.
    """

    static func system(research: Bool) -> String {
        research ? deckSystem + "\n\n" + researchRules : deckSystem
    }

    static func deckInstructions(topic: String, slideCount: Int, minutes: Int, research: Bool = false, hasMaterial: Bool = true) -> String {
        let focus = topic.isBlank ? "the main content of the material" : topic
        let source = hasMaterial ? "from the material above" : "from the Wikipedia research above; there is no material"
        return """
        Plan a presentation \(source).
        First only the outline: the red thread, not the finished slides.
        Topic or focus: \(focus)
        Number of slides: about \(slideCount) (title and sources slides included)
        Talk length: \(minutes) minutes

        Give the whole talk's core message (thesis) and, for every slide, its role in the talk (hook, context, core,
        example, comparison, summary, sources …), its message as one German sentence, the slide type that shows it
        best, what goes on it (facts, numbers with units, dates, the material page of a figure) and the material
        (sourceMaterial, the number of the material) and pages (sourcePages) it is based on.
        """ + (research ? "\n\n" + researchInstructions(hasMaterial: hasMaterial) : "") + "\n\n" + layoutGuide
    }

    private static func researchInstructions(hasMaterial: Bool) -> String {
        """
        Research: before the slides are written, the app looks up the German Wikipedia for you. Give up to
        \(Research.maxQueries) short German search terms in research (ideally article titles) for context, background,
        current numbers or examples the talk needs beyond \(hasMaterial ? "the material" : "the research above").
        Leave research empty if nothing is missing.
        """
    }

    static func slidesInstructions(slideCount: Int, minutes: Int, research: Bool = false) -> String {
        let seconds = max(15, minutes * 60 / max(1, slideCount))
        return """
        Now write the finished slides for this outline, in the same order. Use the planned slide type unless the
        material does not give enough for it. Each title is the slide's message, shortened to at most 10 words.
        Keep texts short, move details into the notes. Each slide's notes should take about
        \(seconds) seconds to say and lead over to the next slide.
        Give every slide its sourceMaterial and sourcePages\(research ? ", and webSources for facts from the research" : "").
        """
    }

    static let outlineSchema = JSONSchema.object("""
    {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "thesis": { "type": "string" },
        "slides": { "type": "array", "items": { "type": "object", "properties": {
          "role": { "type": "string" },
          "message": { "type": "string" },
          "layout": { "type": "string", "enum": [\(layoutNames)] },
          "content": { "type": "string" },
          "sourceMaterial": { "type": "integer" },
          "sourcePages": { "type": "array", "items": { "type": "integer" } }
        }, "required": ["role", "message", "layout", "content"] } },
        "research": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["title", "thesis", "slides"]
    }
    """)

    /// The fields of one slide's content; shared with the chat and the critic, which cannot place pictures.
    static let slideContentProperties = """
    "layout": { "type": "string", "enum": [\(layoutNames)] },
    "title": { "type": "string" },
    "subtitle": { "type": "string" },
    "bullets": { "type": "array", "items": { "type": "string" } },
    "leftTitle": { "type": "string" },
    "left": { "type": "array", "items": { "type": "string" } },
    "rightTitle": { "type": "string" },
    "right": { "type": "array", "items": { "type": "string" } },
    "items": { "type": "array", "items": { "type": "object", "properties": {
      "title": { "type": "string" }, "text": { "type": "string" }, "icon": { "type": "string" }
    }, "required": ["title"] } },
    "value": { "type": "string" },
    "chart": { "type": "object", "properties": {
      "kind": { "type": "string", "enum": ["BAR", "LINE"] },
      "labels": { "type": "array", "items": { "type": "string" } },
      "values": { "type": "array", "items": { "type": "number" } },
      "unit": { "type": "string" }
    }, "required": ["kind", "labels", "values"] },
    "table": { "type": "array", "items": { "type": "array", "items": { "type": "string" } } },
    "quote": { "type": "string" },
    "attribution": { "type": "string" },
    "notes": { "type": "string" }
    """

    private static let slideProperties = slideContentProperties + """
    ,
    "imageMaterial": { "type": "integer" },
    "imagePage": { "type": "integer" },
    "sourceMaterial": { "type": "integer" },
    "sourcePages": { "type": "array", "items": { "type": "integer" } },
    "webSources": { "type": "array", "items": { "type": "string" } }
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
        Redesign this slide: pick the slide type that shows its content best and rewrite the content for it,
        following the rules for good school slides. Keep the message and the speaker notes' meaning.
        Only choose IMAGE_TEXT or IMAGE_FULL if the slide already has a picture, CHART only with numbers that are on the slide.

        \(layoutGuide)

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
        if !slide.extractedText.isBlank { lines.append("Text in the slide picture: \(String(slide.extractedText.trimmingCharacters(in: .whitespacesAndNewlines).prefix(1500)))") }
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

    static func parseSlide(_ object: [String: Any]) -> SlideDraft? {
        let layout = (object["layout"] as? String).flatMap { SlideLayout(rawValue: $0.uppercased()) } ?? .bullets
        let chart = (object["chart"] as? [String: Any]).map { chart in
            ChartDraft(
                kind: (chart["kind"] as? String)?.uppercased() == "LINE" ? .line : .bar,
                labels: strings(chart["labels"]),
                values: ((chart["values"] as? [Any]) ?? []).compactMap(number),
                unit: (chart["unit"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
            )
        }
        let items = ((object["items"] as? [Any]) ?? []).compactMap { item -> DraftItem? in
            guard let entry = item as? [String: Any] else { return nil }
            let result = DraftItem(
                title: (entry["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
                text: (entry["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
                icon: (entry["icon"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            )
            return result.title.isEmpty && result.text.isEmpty ? nil : result
        }
        let table = ((object["table"] as? [Any]) ?? []).compactMap { row -> [String]? in
            guard let cells = row as? [Any] else { return nil }
            let values = cells.map { cell -> String in
                if let text = cell as? String { return text.trimmingCharacters(in: .whitespacesAndNewlines) }
                return cell is NSNull ? "" : "\(cell)"
            }
            return values.contains { !$0.isBlank } ? values : nil
        }
        let draft = SlideDraft(
            layout: layout,
            title: (object["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
            subtitle: (object["subtitle"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
            bullets: strings(object["bullets"]),
            leftTitle: object["leftTitle"] as? String ?? "",
            left: strings(object["left"]),
            rightTitle: object["rightTitle"] as? String ?? "",
            right: strings(object["right"]),
            quote: object["quote"] as? String ?? "",
            attribution: object["attribution"] as? String ?? "",
            items: items,
            value: (object["value"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
            chart: chart,
            table: table,
            imageMaterial: int(object["imageMaterial"]),
            imagePage: int(object["imagePage"]).flatMap { $0 > 0 ? $0 : nil },
            notes: object["notes"] as? String ?? "",
            sourceMaterial: int(object["sourceMaterial"]),
            sourcePages: (object["sourcePages"] as? [Any])?.compactMap(int) ?? [],
            webSources: strings(object["webSources"]).map { $0.trimmingCharacters(in: CharacterSet(charactersIn: "[] ")).uppercased() }
        )
        let hasContent = !draft.title.isBlank || !draft.bullets.isEmpty || !draft.quote.isBlank || !draft.left.isEmpty
            || !draft.items.isEmpty || !draft.table.isEmpty || draft.chart != nil
        return hasContent ? draft : nil
    }

    /// Numbers may come as strings, with a German decimal comma or a unit attached.
    private static func number(_ value: Any?) -> Double? {
        if let text = value as? String {
            if let direct = Double(text.trimmingCharacters(in: .whitespaces)) { return direct }
            let cleaned = String(text.unicodeScalars.filter { "0123456789,.-−".unicodeScalars.contains($0) }.map(Character.init))
                .replacingOccurrences(of: "−", with: "-")
            let normalized = cleaned.contains(",") ? cleaned.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".") : cleaned
            return Double(normalized)
        }
        if let number = value as? Double { return number }
        if let number = value as? Int { return Double(number) }
        if let number = value as? NSNumber { return number.doubleValue }
        return nil
    }

    struct OutlineSlide: Equatable {
        var role: String
        var message: String
        var layout: String
        var content: String
    }

    struct Outline: Equatable {
        var title: String
        var thesis: String
        var slides: [OutlineSlide]
        var research: [String] = []
    }

    static func parseOutline(_ text: String) -> Outline? {
        guard let root = object(text), let slides = root["slides"] as? [Any] else { return nil }
        let parsed = slides.compactMap { item -> OutlineSlide? in
            guard let entry = item as? [String: Any] else { return nil }
            let slide = OutlineSlide(
                role: entry["role"] as? String ?? "",
                message: (entry["message"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
                layout: entry["layout"] as? String ?? "",
                content: entry["content"] as? String ?? ""
            )
            return slide.message.isEmpty && slide.content.isBlank ? nil : slide
        }
        return Outline(
            title: root["title"] as? String ?? "",
            thesis: root["thesis"] as? String ?? "",
            slides: parsed,
            research: Array(strings(root["research"]).prefix(Research.maxQueries))
        )
    }

    /// The outline as the model's own earlier answer, compact, for the second step.
    static func outlineText(_ outline: Outline) -> String {
        var lines = ["Title: \(outline.title)", "Thesis: \(outline.thesis)"]
        for (index, slide) in outline.slides.enumerated() {
            lines.append("\(index + 1). [\(slide.layout)] (\(slide.role)) \(slide.message)")
            if !slide.content.isBlank { lines.append("   \(slide.content.trimmingCharacters(in: .whitespacesAndNewlines))") }
        }
        return lines.map { $0 + "\n" }.joined()
    }

    /// Names the Wikipedia articles a slide used in its notes and lists them on the sources slide, which is added if the
    /// model left it out. If no slide says what it used, all researched articles are listed: they shaped the talk.
    static func citingSources(_ drafts: [SlideDraft], sources: [WebSource], materialTitles: [String], date: Date = Date()) -> [SlideDraft] {
        guard !sources.isEmpty else { return drafts }
        let byID = Dictionary(sources.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        func used(_ draft: SlideDraft) -> [WebSource] {
            var seen = Set<String>()
            return draft.webSources.compactMap { byID[$0] }.filter { seen.insert($0.id).inserted }
        }
        var cited: [WebSource] = []
        for draft in drafts {
            for source in used(draft) where !cited.contains(source) {
                cited.append(source)
            }
        }
        let listed = (cited.isEmpty ? sources : cited).map { Research.citation($0, date: date) }
        var result = drafts.map { draft -> SlideDraft in
            let articles = used(draft)
            guard !articles.isEmpty else { return draft }
            var copy = draft
            let line = "Quelle: " + articles.map { "Wikipedia – „\($0.title)“" }.joined(separator: "; ")
            copy.notes = [draft.notes.trimmingCharacters(in: .whitespacesAndNewlines), line].filter { !$0.isEmpty }.joined(separator: "\n\n")
            return copy
        }
        if let index = result.lastIndex(where: { $0.title.range(of: "Quelle", options: .caseInsensitive) != nil }) {
            var slide = result[index]
            let own = (slide.bullets + slide.left + slide.right).filter { $0.range(of: "wikipedia", options: .caseInsensitive) == nil }
            slide.layout = .bullets
            slide.bullets = own + listed
            slide.left = []
            slide.right = []
            result[index] = slide
        } else {
            result.append(SlideDraft(
                layout: .bullets,
                title: "Quellen",
                bullets: materialTitles.map { "Material: \($0)" } + listed,
                notes: "Zum Schluss nenne ich meine Quellen."
            ))
        }
        return result
    }

    private static func strings(_ value: Any?) -> [String] {
        ((value as? [Any]) ?? []).compactMap { ($0 as? String)?.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    /// Numbers may arrive as numbers or as strings from models without schema enforcement.
    static func int(_ value: Any?) -> Int? {
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

/// Applies the critic's important findings (high and medium) without asking; minor ones are left to the student.
func autoApply(_ presentation: Presentation, _ critique: Critique) -> Presentation {
    let changes = critique.findings.filter { $0.severity != .low }.flatMap(\.changes)
    return PresentationEdits.apply(presentation, changes).presentation
}

enum ResearchError: LocalizedError, Equatable {
    case nothingFound(String)

    var errorDescription: String? {
        switch self {
        case let .nothingFound(topic):
            return "Zu „\(topic)“ hat Wikipedia nichts gefunden. Formulier das Thema anders oder wähl Material aus."
        }
    }
}

/// The AI features of the presentation tab; all of them are ordinary LLM requests through the chosen provider.
struct PresentationAssistant {
    let client: any LLMClient

    /// The steps of building a deck, for the progress shown while the student waits.
    enum Stage: Int, CaseIterable {
        case outline, research, slides, review

        var label: String {
            switch self {
            case .outline: return "Die KI plant den roten Faden …"
            case .research: return "Die KI recherchiert auf Wikipedia …"
            case .slides: return "Die KI schreibt die Folien …"
            case .review: return "Der Kritiker prüft und verbessert …"
            }
        }
    }

    /// Builds a whole presentation in three steps: an outline with one message per slide, then the slides for that
    /// outline in the same conversation, then (with `review`) the critic's important findings applied automatically.
    /// `content` is the material as the plan generator prepares it for this provider, ending with the planning
    /// instructions; `pageImage` renders a material page and stores it as a media file. With `wikipedia` the outline
    /// names search terms, the articles found go into the slides step and the critic's check, and the slides cite
    /// them; without materials the talk is built from the research on `topic` alone.
    func generate(
        content prepared: [LLMContent],
        materialIDs: [String],
        materialTitles: [String] = [],
        topic: String,
        slideCount: Int,
        minutes: Int,
        themeID: String,
        review: Bool = true,
        wikipedia: WikipediaClient? = nil,
        today: Date = Date(),
        onStage: (Stage) -> Void = { _ in },
        pageImage: (_ materialIndex: Int, _ page: Int) async -> PlacedImage?
    ) async throws -> Presentation {
        let research = wikipedia != nil
        let system = PresentationPrompt.system(research: research)
        var sources: [WebSource] = []
        if let wikipedia, materialIDs.isEmpty {
            onStage(.research)
            sources = try await Research.gather(wikipedia, queries: [topic])
            if sources.isEmpty { throw ResearchError.nothingFound(topic) }
        }
        // The research on the topic sits between the material and the instructions.
        let researchBlock: [LLMContent] = sources.isEmpty ? [] : [.text(Research.prompt(sources))]
        let content = Array(prepared.dropLast()) + researchBlock + Array(prepared.suffix(1))

        onStage(.outline)
        let outlineRequest = LLMRequest(
            purpose: .presentationOutline,
            system: system,
            messages: [LLMMessage(role: .user, content: content)],
            maxTokens: 8000,
            effort: .high,
            jsonSchema: PresentationPrompt.outlineSchema
        )
        let outline = try await StructuredOutput.complete(request: outlineRequest, client: client, parse: PresentationPrompt.parseOutline) { !$0.slides.isEmpty }

        let known = sources.count
        if let wikipedia, !outline.research.isEmpty {
            onStage(.research)
            sources = try await Research.gather(wikipedia, queries: outline.research, existing: sources)
        }
        let found = Array(sources.dropFirst(known))

        onStage(.slides)
        let slidesPrompt = PresentationPrompt.slidesInstructions(slideCount: outline.slides.count, minutes: minutes, research: research && !sources.isEmpty)
        let request = LLMRequest(
            purpose: .presentation,
            system: system,
            messages: [
                LLMMessage(role: .user, content: content),
                LLMMessage(role: .assistant, content: [.text(PresentationPrompt.outlineText(outline))]),
                LLMMessage(role: .user, content: (found.isEmpty ? [] : [.text(Research.prompt(found))]) + [.text(slidesPrompt)]),
            ],
            maxTokens: 16000,
            effort: .medium,
            jsonSchema: PresentationPrompt.deckSchema
        )
        let deck = try await StructuredOutput.complete(request: request, client: client, parse: PresentationPrompt.parseDeck) { !$0.slides.isEmpty }
        var slides: [Slide] = []
        let drafts = PresentationPrompt.citingSources(deck.slides, sources: sources, materialTitles: materialTitles, date: today)
        for draft in drafts {
            var image: PlacedImage?
            if draft.layout == .imageText || draft.layout == .imageFull, let page = draft.imagePage {
                let index = draft.imageMaterial ?? draft.sourceMaterial ?? 0
                if materialIDs.indices.contains(index) { image = await pageImage(index, page) }
            }
            let materialID = draft.sourceMaterial.flatMap { materialIDs.indices.contains($0) ? materialIDs[$0] : nil }
                ?? (materialIDs.count == 1 ? materialIDs[0] : nil)
            slides.append(Slide(
                elements: SlideLayouts.build(draft, image: image),
                notes: draft.notes,
                sources: draft.sourcePages.map { SourceRef(materialId: materialID, page: $0) }
            ))
        }
        let title = !deck.title.isBlank ? deck.title : (!outline.title.isBlank ? outline.title : (topic.isBlank ? "Präsentation" : topic))
        var presentation = Presentation(title: title, themeId: themeID, slides: slides, materialIds: materialIDs, minutes: minutes)
        if review {
            onStage(.review)
            // The critic improves the draft before the student sees it; a failed review keeps the draft.
            let material = Array(prepared.dropLast()) + (sources.isEmpty ? [] : [LLMContent.text(Research.prompt(sources))])
            if let critique = try? await PresentationCritic(client: client).critique(presentation, material: material) {
                presentation = autoApply(presentation, critique)
            }
        }
        return presentation
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
        let draft = try await StructuredOutput.complete(request: request, client: client, parse: PresentationPrompt.parseSlideDraft)
        let image = slide.elements.first { $0.kind == .image && $0.image != nil }
            .map { PlacedImage(name: $0.image!, aspect: $0.width / max(1, $0.height)) }
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
