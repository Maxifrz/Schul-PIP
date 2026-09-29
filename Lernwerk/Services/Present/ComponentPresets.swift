import Foundation

/// Placeholder content for the editor's "new slide" menu, so every component can be inserted and then overwritten.
extension ComponentRegistry {
    static func sampleDraft(_ component: SlideComponent) -> SlideDraft {
        if let layout = component.layout { return SlideLayouts.presetDraft(layout) }
        func entries(_ titles: [String], text: String, icons: [String] = []) -> [DraftItem] {
            titles.enumerated().map { DraftItem(title: $0.element, text: text, icon: icons.indices.contains($0.offset) ? icons[$0.offset] : "") }
        }
        switch component.id {
        case "stat-row":
            return SlideDraft(layout: .cards, title: "Drei Zahlen", items: [
                DraftItem(title: "42 %", text: "Anteil"), DraftItem(title: "1,5 Mio.", text: "Einwohner"), DraftItem(title: "3 von 4", text: "Befragte"),
            ])
        case "comparison":
            return SlideDraft(layout: .twoColumns, title: "Vergleich", leftTitle: "Früher", left: ["Punkt"], rightTitle: "Heute", right: ["Punkt"])
        case "matrix-2x2":
            return SlideDraft(layout: .cards, title: "Vier Felder", leftTitle: "Aufwand", rightTitle: "Nutzen", items: entries(["Feld 1", "Feld 2", "Feld 3", "Feld 4"], text: "Kurz erklärt"))
        case "definition":
            return SlideDraft(layout: .bigNumber, title: "Definition", subtitle: "Eine knappe Erklärung in ein bis zwei Sätzen.", bullets: ["Ein Beispiel"], value: "Begriff")
        case "agenda":
            return SlideDraft(layout: .process, title: "Agenda", items: entries(["Einstieg", "Hauptteil", "Beispiele", "Fazit"], text: ""))
        case "checklist":
            return SlideDraft(layout: .bullets, title: "Das nehmen wir mit", bullets: ["Erste Kernaussage", "Zweite Kernaussage", "Dritte Kernaussage"])
        case "quote-image":
            return SlideDraft(layout: .quote, quote: "Ein Zitat, das den Kern trifft.", attribution: "Quelle")
        case "icon-grid":
            return SlideDraft(layout: .cards, title: "Sechs Aspekte", items: entries((1...6).map { "Aspekt \($0)" }, text: "Kurz erklärt", icons: ["🔥", "🌍", "💡", "📈", "🧪", "🎯"]))
        case "staircase":
            return SlideDraft(layout: .process, title: "Stufe für Stufe", items: entries((1...4).map { "Stufe \($0)" }, text: "Was dazukommt"))
        case "before-after":
            return SlideDraft(layout: .twoColumns, title: "Vorher und nachher", leftTitle: "Vorher", left: ["Zustand"], rightTitle: "Nachher", right: ["Zustand"])
        default:
            return SlideDraft(layout: component.hintLayout)
        }
    }

    /// A new slide of the component with its placeholder content and the origin that lets it be redesigned. Picture
    /// components get an empty frame for the student's own picture.
    static func preset(_ component: SlideComponent, theme: SlideTheme = .quill) -> Slide {
        let draft = sampleDraft(component)
        let built = build(draft, componentID: component.id, image: nil, theme: theme, placeholder: true)
        return Slide(elements: built.elements, origin: SlideOrigin(componentID: built.componentID, params: built.params, draft: built.draft))
    }

    /// The components of one category in registry order, for the grouped "new slide" menu; the blank slide comes last.
    static func components(in category: ComponentCategory) -> [SlideComponent] {
        all.filter { $0.category == category }
    }

    static var categories: [ComponentCategory] {
        ComponentCategory.allCases.filter { !components(in: $0).isEmpty }
    }
}

extension ComponentParameter {
    /// The German name of a value for menus; unknown values show as they are.
    static func valueLabel(_ value: String) -> String {
        let names = [
            "cards": "Karten", "plain": "Schlicht", "none": "Ohne", "left": "Links", "right": "Rechts", "filled": "Gefüllt", "outlined": "Umrandet",
            "stacked": "Gestapelt", "split": "Geteilt", "badge": "Kreise", "numeral": "Ziffern", "check": "Haken", "square": "Kästchen",
            "stairs": "Treppe", "layers": "Schichten", "compact": "Kompakt", "airy": "Luftig",
        ]
        return names[value] ?? value
    }
}
