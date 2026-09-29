import Foundation

enum ComponentCategory: String, CaseIterable {
    case opening, text, structure, data, comparison, visual

    var label: String {
        switch self {
        case .opening: return "Einstieg"
        case .text: return "Text"
        case .structure: return "Ablauf und Struktur"
        case .data: return "Zahlen und Daten"
        case .comparison: return "Vergleich"
        case .visual: return "Bild"
        }
    }
}

/// What a slide's content looks like, so the app can pick the components that suit it before the model chooses.
enum ContentTag: String, CaseIterable {
    case title, section, statement, list, image, numbers, steps, timeline, comparison, table, quote, chart, definition, agenda, checklist, grid, hierarchy
}

/// The part of a draft a component counts entries in.
enum SlotField: String {
    case none, bullets, items, tableRows, chartPoints
    /// The two columns of a comparison: the longer side counts, both must have entries.
    case columns
}

/// The kinds of content a draft can hold, apart from its title, notes and sources. A component lists the ones it draws.
enum DraftPart: String, CaseIterable {
    case subtitle, bullets, columns, quote, items, value, chart, table
}

extension SlideDraft {
    /// The kinds of content this draft actually has.
    var parts: Set<DraftPart> {
        var result: Set<DraftPart> = []
        if !subtitle.isBlank { result.insert(.subtitle) }
        if !bullets.isEmpty { result.insert(.bullets) }
        if !leftTitle.isBlank || !rightTitle.isBlank || !left.isEmpty || !right.isEmpty { result.insert(.columns) }
        if !quote.isBlank || !attribution.isBlank { result.insert(.quote) }
        if !items.isEmpty { result.insert(.items) }
        if !value.isBlank { result.insert(.value) }
        if let chart, !chart.labels.isEmpty || !chart.values.isEmpty { result.insert(.chart) }
        if !table.isEmpty { result.insert(.table) }
        return result
    }
}

/// What a component can take: how many entries, whether it needs a picture or numbers, which kinds of content must be
/// there, how long one slot's text may be, and any limit of its own. Content outside the contract is never squeezed
/// in: the registry falls back to another component.
struct SlotContract {
    var field: SlotField = .none
    var min = 0
    var max = Int.max
    var needsImage = false
    /// At least one digit in the numbers the slide shows: the value, the entries' titles or the chart.
    var needsNumbers = false
    /// Kinds of content the draft must have, like a definition's term.
    var requires: Set<DraftPart> = []
    /// Characters per slot text (one bullet, one card text, one table cell).
    var maxChars = 1000
    /// Characters of an entry's title, for components that show titles bigger than texts.
    var maxTitle = 1000
    /// Limits the fields above cannot express; returns why the draft does not fit, or nil.
    var extra: ((SlideDraft) -> String?)?

    func count(_ draft: SlideDraft) -> Int {
        switch field {
        case .none: return 0
        case .bullets: return draft.bullets.count
        case .items: return draft.items.count
        case .tableRows: return draft.table.count
        case .chartPoints: return Swift.min(draft.chart?.labels.count ?? 0, draft.chart?.values.count ?? 0)
        case .columns: return Swift.max(draft.left.count, draft.right.count)
        }
    }

    /// The slots' texts, for the length check.
    private func slots(_ draft: SlideDraft) -> [String] {
        switch field {
        case .none: return []
        case .bullets: return draft.bullets
        case .items: return draft.items.map(\.text)
        case .tableRows: return draft.table.flatMap { $0 }
        case .chartPoints: return draft.chart?.labels ?? []
        case .columns: return draft.left + draft.right
        }
    }

    private static func length(_ text: String) -> Int { text.trimmingCharacters(in: .whitespacesAndNewlines).count }

    /// A helper for `extra`: a message if `text` is longer than `limit`.
    static func tooLong(_ name: String, _ text: String, _ limit: Int) -> String? {
        length(text) > limit ? "\(name) zu lang (\(length(text)) Zeichen, höchstens \(limit))" : nil
    }

    /// Why the draft does not fit, or nil. A `placeholder` (the editor's "new slide") may lack the picture.
    func violation(_ draft: SlideDraft, image: PlacedImage?, placeholder: Bool = false) -> String? {
        if needsImage && image == nil && !placeholder { return "Bild fehlt" }
        if !requires.isSubset(of: draft.parts) {
            return "Inhalt fehlt (\(requires.subtracting(draft.parts).map(\.rawValue).sorted().joined(separator: ", ")))"
        }
        if needsNumbers {
            let numbers = [draft.value] + draft.items.map(\.title) + (draft.chart?.values.map { String($0) } ?? [])
            if !numbers.contains(where: { $0.contains(where: \.isNumber) }) { return "Zahlen fehlen" }
        }
        if field != .none {
            let n = count(draft)
            if n < min { return "zu wenige Einträge (\(n), mindestens \(min))" }
            if n > max { return "zu viele Einträge (\(n), höchstens \(max))" }
            if field == .tableRows, (draft.table.first ?? []).isEmpty { return "Kopfzeile fehlt" }
            if field == .columns, draft.left.isEmpty || draft.right.isEmpty { return "eine Spalte ist leer" }
            if let longest = slots(draft).map(Self.length).max(), longest > maxChars {
                return "Text zu lang (\(longest) Zeichen, höchstens \(maxChars))"
            }
            if field == .items, let longest = draft.items.map({ Self.length($0.title) }).max(), longest > maxTitle {
                return "Titel zu lang (\(longest) Zeichen, höchstens \(maxTitle))"
            }
        }
        return extra?(draft)
    }
}

struct ComponentParameter: Equatable {
    var name: String
    var label: String
    /// The allowed values, as the model sees them.
    var values: [String]
    var defaultValue: String
}

typealias ComponentParams = [String: String]

/// A design component: a named way to lay out one kind of content. It is data plus one drawing function, so the model
/// only ever picks an id and parameter values from lists, and the app decides every position and size.
struct SlideComponent {
    var id: String
    var label: String
    var category: ComponentCategory
    var tags: [ContentTag]
    /// A line for the model's candidate list.
    var summary: String
    var accepts: SlotContract
    /// The kinds of content it draws. A component can replace another for a draft only if it draws all of the draft's.
    var reads: Set<DraftPart> = []
    var parameters: [ComponentParameter] = []
    /// The layout to take when the content does not fit (see `ComponentRegistry.build`).
    var fallback: SlideLayout = .bullets
    /// The first-version layout this component is, for the fifteen that are one.
    var layout: SlideLayout?

    /// The layout name the model gives in `layout` next to this component: its own, or the fallback.
    var hintLayout: SlideLayout { layout ?? fallback }
    /// Draws the elements. Gets valid parameters only; the theme is there for its text widths.
    var build: (_ draft: SlideDraft, _ params: ComponentParams, _ image: PlacedImage?, _ theme: SlideTheme) -> [SlideElement]

    /// The parameters with every missing or invalid value replaced by its default and unknown names dropped.
    func resolvedParams(_ given: ComponentParams) -> ComponentParams {
        var result: ComponentParams = [:]
        for parameter in parameters {
            let value = given[parameter.name]?.trimmingCharacters(in: .whitespaces)
            let match = parameter.values.first { $0.caseInsensitiveCompare(value ?? "") == .orderedSame }
            result[parameter.name] = match ?? parameter.defaultValue
        }
        return result
    }

    /// Whether the draft fits this component's contract.
    func fits(_ draft: SlideDraft, image: PlacedImage?, placeholder: Bool = false) -> Bool {
        accepts.violation(draft, image: image, placeholder: placeholder) == nil
    }

    /// Whether the component draws every kind of content the draft has, so choosing it loses none.
    func covers(_ draft: SlideDraft) -> Bool {
        draft.parts.isSubset(of: reads)
    }

    /// The layout drawing of the first version, for the fifteen components that are those layouts.
    func draw(_ draft: SlideDraft, image: PlacedImage?) -> [SlideElement] {
        build(draft, resolvedParams([:]), image, .quill)
    }
}

/// The result of building through the registry.
struct BuiltSlide: Equatable {
    var elements: [SlideElement]
    /// The component that drew the slide; differs from the requested one after a fallback.
    var componentID: String
    var params: ComponentParams
    /// What went wrong on the way (unknown id, content outside the contract), one line each; empty if all went well.
    var log: [String]
    var draft: SlideDraft
}
