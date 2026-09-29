import Foundation

/// One suggestion in the design sheet: a theme and a motion style from the catalogs, with the reason to show.
struct DesignSuggestion: Equatable {
    var themeID: String
    var motion: MotionPreset
    var reason: String
}

/// Suggests designs for a finished deck. The model only picks ids from the catalogs (never colors or geometry);
/// its answer is read tolerantly and anything unknown is dropped. If the model fails or says nothing usable, a local
/// heuristic on the deck's topics, text density and picture share answers instead, so the sheet is never empty.
enum DesignAdvisor {
    static let limit = 4
    private static let maxReason = 140

    // MARK: Deck facts

    struct Profile: Equatable {
        var text: String
        /// Average characters of text per slide.
        var density: Double
        /// Share of slides with a picture, 0 to 1.
        var pictureShare: Double
        /// Slides that hold boxes worth revealing one by one.
        var boxSlides: Int
    }

    static func profile(_ presentation: Presentation) -> Profile {
        let slides = presentation.slides
        var parts = [presentation.title]
        var characters = 0
        var pictures = 0
        var boxes = 0
        for slide in slides {
            let texts = slide.elements.filter { $0.kind == .text }.map(\.text)
            parts.append(contentsOf: texts)
            characters += texts.reduce(0) { $0 + $1.count }
            if slide.elements.contains(where: { $0.kind == .image }) { pictures += 1 }
            if !MotionPlanner.groups(slide).isEmpty { boxes += 1 }
        }
        let count = Double(max(1, slides.count))
        return Profile(text: parts.joined(separator: " "), density: Double(characters) / count, pictureShare: Double(pictures) / count, boxSlides: boxes)
    }

    // MARK: Model

    static var schema: [String: Any] {
        let themes = SlideTheme.all.map { "\"\($0.id)\"" }.joined(separator: ",")
        let motions = MotionPreset.allCases.map { "\"\($0.rawValue)\"" }.joined(separator: ",")
        return JSONSchema.object("""
        {
          "type": "object",
          "properties": {
            "suggestions": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "theme": { "type": "string", "enum": [\(themes)] },
                  "motion": { "type": "string", "enum": [\(motions)] },
                  "reason": { "type": "string" }
                },
                "required": ["theme", "motion", "reason"]
              }
            }
          },
          "required": ["suggestions"]
        }
        """)
    }

    static let system = """
    You suggest slide designs for a student's finished presentation. You only choose ids from the lists you are given: \
    a design id and a motion id per suggestion, plus one short German sentence saying why it suits this talk. \
    You never invent colors, fonts or positions. Suggest three or four different designs, best first, and not the current one.
    """

    static func request(_ presentation: Presentation) -> String {
        let profile = profile(presentation)
        let titles = presentation.slides.compactMap { slide in
            slide.elements.first { $0.kind == .text && SlideDesign.isHeading($0) && !$0.text.isBlank }?.text
        }
        let motions = MotionPreset.allCases.map { "- \($0.rawValue): \($0.detail)" }.joined(separator: "\n")
        return """
        Talk: \(presentation.title)
        Slide titles: \(titles.prefix(20).joined(separator: " | "))
        Slides: \(presentation.slides.count), about \(Int(profile.density)) characters of text per slide, \(Int(profile.pictureShare * 100)) % of the slides have a picture.
        Current design: \(presentation.themeId)

        Designs:
        \(SlideDesign.catalog)

        Motion styles:
        \(motions)
        """
    }

    /// Reads the model's answer: an object with `suggestions`, or the bare array. Unknown themes are dropped, an unknown
    /// motion becomes CALM, the current design and repeated designs are removed. Nil if the text is no JSON at all.
    static func parse(_ text: String, current: String) -> [DesignSuggestion]? {
        guard let data = text.data(using: .utf8), let json = try? JSONSerialization.jsonObject(with: data) else { return nil }
        let rows: [Any]
        if let object = json as? [String: Any] {
            rows = object["suggestions"] as? [Any] ?? []
        } else if let array = json as? [Any] {
            rows = array
        } else {
            return nil
        }
        let known = Set(SlideTheme.all.map(\.id))
        var seen: Set<String> = [current.lowercased()]
        var result: [DesignSuggestion] = []
        for case let row as [String: Any] in rows {
            let theme = ((row["theme"] ?? row["themeId"] ?? row["design"]) as? String ?? "").trimmingCharacters(in: .whitespaces).lowercased()
            guard known.contains(theme), seen.insert(theme).inserted else { continue }
            let motion = MotionPreset(rawValue: (row["motion"] as? String ?? "").trimmingCharacters(in: .whitespaces).uppercased()) ?? .calm
            let reason = clean(row["reason"] as? String ?? "")
            result.append(DesignSuggestion(themeID: theme, motion: motion, reason: reason.isEmpty ? "Vorschlag der KI" : reason))
        }
        return Array(result.prefix(limit))
    }

    private static func clean(_ reason: String) -> String {
        let text = reason.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
        return text.count > maxReason ? String(text.prefix(maxReason - 1)) + "…" : text
    }

    // MARK: Heuristic

    /// The motion style that suits the deck.
    static func motion(for profile: Profile) -> MotionPreset {
        if profile.density > 320 { return .calm }
        if profile.pictureShare >= 0.3 { return .dynamic }
        if profile.boxSlides >= 2 { return .stepwise }
        return .calm
    }

    /// Designs by the deck's subjects first, then by fit to its density: text-heavy decks get quiet designs without
    /// decoration, picture-heavy ones the calm frame designs that leave the pictures alone.
    static func heuristic(_ presentation: Presentation, limit: Int = DesignAdvisor.limit) -> [DesignSuggestion] {
        let profile = profile(presentation)
        let motion = motion(for: profile)
        var picked: [(id: String, reason: String)] = []
        var seen: Set<String> = [presentation.themeId]
        func add(_ id: String, _ reason: String) {
            if seen.insert(id).inserted { picked.append((id, reason)) }
        }
        for id in SlideDesign.ranked(profile.text) {
            let mood = SlideTheme.all.first { $0.id == id }?.mood ?? ""
            add(id, "Passt zum Thema: \(mood.components(separatedBy: ",").prefix(3).map { $0.trimmingCharacters(in: .whitespaces) }.joined(separator: ", "))")
        }
        let quiet: [DecorStyle] = profile.density > 260 || profile.pictureShare >= 0.3 ? [.none, .band, .frame] : [.corners, .glow, .blocks, .circles]
        let fill = profile.density > 260 ? "Viel Text: ruhig und ohne viel Dekoration" : (profile.pictureShare >= 0.3 ? "Viele Bilder: die Gestaltung hält sich zurück" : "Locker gesetzt: etwas mehr Gestaltung")
        for theme in SlideTheme.all where quiet.contains(theme.decor) { add(theme.id, fill) }
        for theme in SlideTheme.all { add(theme.id, "Weitere Auswahl") }
        return picked.prefix(limit).map { DesignSuggestion(themeID: $0.id, motion: motion, reason: $0.reason) }
    }

    // MARK: Entry point

    /// Suggestions for the design sheet. Never throws: a failed or useless answer is replaced by the heuristic, and
    /// a short answer is filled up with heuristic suggestions.
    static func suggestions(for presentation: Presentation, client: any LLMClient) async -> [DesignSuggestion] {
        let request = LLMRequest(
            purpose: .presentationFeedback,
            system: system,
            messages: [LLMMessage(role: .user, content: [.text(request(presentation))])],
            maxTokens: 1500,
            effort: .low,
            jsonSchema: schema
        )
        let current = presentation.themeId
        let modelAnswer = (try? await StructuredOutput.complete(request: request, client: client, parse: { parse($0, current: current) }, isValid: { !$0.isEmpty })) ?? []
        guard modelAnswer.count < limit else { return modelAnswer }
        let taken = Set(modelAnswer.map(\.themeID))
        let extra = heuristic(presentation, limit: limit).filter { !taken.contains($0.themeID) }
        return modelAnswer.isEmpty ? Array(extra.prefix(limit)) : Array((modelAnswer + extra).prefix(limit))
    }
}
