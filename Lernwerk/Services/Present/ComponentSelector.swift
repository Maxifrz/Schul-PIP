import Foundation

/// What a slide is about before it is written: the outline's role and slide type, and what its content mentions. The
/// app derives it locally, so it can narrow the components down before the model chooses.
struct ContentForm: Equatable {
    var tags: Set<ContentTag>
    var layout: SlideLayout?
    var role: String
    var hasImage: Bool
}

/// The component and parameters chosen for one draft, with what had to be corrected on the way.
struct ComponentChoice: Equatable {
    var componentID: String
    var params: ComponentParams
    var log: [String]
}

/// Picks components locally. The model sees at most `maxCandidates` per slide and answers with an id and parameter
/// values; whatever it answers is checked here, and anything unknown or unfit falls back to the best local candidate
/// or to the draft's own `layout`, never to an error.
enum ComponentSelector {
    static let maxCandidates = 5

    // MARK: Content form

    /// The form of an outline slide: its slide type, role and the hints in its content text.
    static func form(role: String, layout: String, content: String) -> ContentForm {
        let hint = SlideLayout(rawValue: layout.trimmingCharacters(in: .whitespaces).uppercased())
        var tags = Set(hint.map { ComponentRegistry.legacy($0).tags } ?? [])
        let text = content.lowercased()
        if text.contains(where: \.isNumber) { tags.insert(.numbers) }
        if ["vergleich", " vs", "gegenüber", "unterschied", "pro und contra", "vorher", "nachher"].contains(where: text.contains) { tags.insert(.comparison) }
        if ["definition", "begriff", "bedeutet"].contains(where: text.contains) { tags.insert(.definition) }
        if ["agenda", "gliederung", "überblick"].contains(where: text.contains) { tags.insert(.agenda) }
        if ["zitat"].contains(where: text.contains) { tags.insert(.quote) }
        let image = hint == .imageText || hint == .imageFull
        if image { tags.insert(.image) }
        return ContentForm(tags: tags, layout: hint, role: role, hasImage: image)
    }

    /// The form of a written draft, from what it holds.
    static func form(of draft: SlideDraft, role: String = "", hasImage: Bool) -> ContentForm {
        var tags = Set(ComponentRegistry.legacy(draft.layout).tags)
        for part in draft.parts {
            switch part {
            case .bullets: tags.insert(.list)
            case .columns: tags.insert(.comparison)
            case .quote: tags.insert(.quote)
            case .items: tags.formUnion([.grid, .steps])
            case .value: tags.insert(.numbers)
            case .chart: tags.formUnion([.chart, .numbers])
            case .table: tags.insert(.table)
            case .subtitle: break
            }
        }
        if hasImage { tags.insert(.image) }
        return ContentForm(tags: tags, layout: draft.layout, role: role, hasImage: hasImage)
    }

    // MARK: Candidates

    private static let roleBoosts: [(words: [String], tags: [ContentTag], categories: [ComponentCategory])] = [
        (["hook", "einstieg", "opening", "einleitung"], [.statement, .quote], [.opening]),
        (["summary", "fazit", "zusammenfassung", "conclusion", "schluss"], [.checklist, .statement, .list], []),
        (["comparison", "vergleich"], [.comparison], [.comparison]),
        (["example", "beispiel"], [.quote, .image], []),
        (["context", "kontext", "hintergrund", "history", "geschichte"], [.timeline], []),
        (["core", "kern", "definition"], [.definition, .list], []),
        (["agenda", "überblick", "overview"], [.agenda], []),
    ]

    private static func score(_ component: SlideComponent, _ form: ContentForm, recent: [String]) -> Int {
        var score = 4 * component.tags.filter { form.tags.contains($0) }.count
        if let layout = form.layout, component.id == layout.componentID { score += 8 }
        let role = form.role.lowercased()
        for boost in roleBoosts where boost.words.contains(where: role.contains) {
            if component.tags.contains(where: boost.tags.contains) { score += 3 }
            if boost.categories.contains(component.category) { score += 2 }
        }
        if recent.suffix(2).contains(component.id) { score -= 3 }
        return score
    }

    /// The components that suit the form, best first, at most `limit`. Components that need a picture are left out
    /// when there is none, and so is the blank slide unless it was asked for. The slide type the outline named is
    /// always among them when it can be drawn.
    static func candidates(for form: ContentForm, recent: [String] = [], limit: Int = maxCandidates) -> [SlideComponent] {
        let scored = ComponentRegistry.all.enumerated().compactMap { offset, component -> (SlideComponent, Int, Int)? in
            if component.accepts.needsImage && !form.hasImage { return nil }
            if component.id == SlideLayout.blank.componentID && form.layout != .blank { return nil }
            let value = score(component, form, recent: recent)
            return value > 0 ? (component, value, offset) : nil
        }
        let ranked = scored.sorted { $0.1 != $1.1 ? $0.1 > $1.1 : $0.2 < $1.2 }
        return Array(ranked.prefix(max(0, limit)).map(\.0))
    }

    // MARK: Choice

    /// The component for a written draft. Without a `component` in the draft the layout decides, as it always did.
    /// A component the model named is used if it exists and draws the draft's content; otherwise the best local
    /// candidate that draws all of it, otherwise the layout. Every correction is logged.
    static func choose(_ draft: SlideDraft, image: PlacedImage?, role: String = "", recent: [String] = []) -> ComponentChoice {
        let layoutID = ComponentRegistry.legacy(draft.layout).id
        guard let named = draft.component, !named.trimmingCharacters(in: .whitespaces).isEmpty else {
            return ComponentChoice(componentID: layoutID, params: [:], log: [])
        }
        var log: [String] = []
        if let component = ComponentRegistry.component(named) {
            if component.covers(draft) && component.fits(draft, image: image) {
                return ComponentChoice(componentID: component.id, params: component.resolvedParams(draft.params), log: [])
            }
            log.append("Komponente „\(component.id)“ passt nicht zum Inhalt der Folie.")
        } else {
            log.append("Unbekannte Komponente „\(named)“.")
        }
        let form = form(of: draft, role: role, hasImage: image != nil)
        if let best = candidates(for: form, recent: recent).first(where: { $0.covers(draft) && $0.fits(draft, image: image) }) {
            log.append("Nehme „\(best.id)“.")
            return ComponentChoice(componentID: best.id, params: best.resolvedParams(draft.params), log: log)
        }
        log.append("Nehme das Layout „\(layoutID)“.")
        return ComponentChoice(componentID: layoutID, params: [:], log: log)
    }
}
