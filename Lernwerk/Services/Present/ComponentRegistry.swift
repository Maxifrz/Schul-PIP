import Foundation

extension SlideLayout {
    /// The id of the component that is this layout: "image-text" for IMAGE_TEXT.
    var componentID: String {
        rawValue.lowercased().replacingOccurrences(of: "_", with: "-")
    }
}

/// Every slide component the app knows, and the one way to build a slide from one: `build` checks the contract and
/// falls back instead of cutting or failing.
enum ComponentRegistry {
    static var all: [SlideComponent] { legacyComponents + additionalComponents }

    static func component(_ id: String) -> SlideComponent? {
        let key = id.trimmingCharacters(in: .whitespaces).lowercased()
        return all.first { $0.id == key }
    }

    /// The component that is the given first-version layout.
    static func legacy(_ layout: SlideLayout) -> SlideComponent {
        legacyComponents.first { $0.id == layout.componentID }!
    }

    /// Builds a slide from a component id and parameters. An unknown id means the draft's own `layout` decides;
    /// content the component does not accept goes to its fallback layout, which turns the content into bullets if
    /// nothing better fits. Every step is logged in the result; nothing throws.
    static func build(
        _ draft: SlideDraft, componentID: String? = nil, params: ComponentParams = [:], image: PlacedImage? = nil,
        theme: SlideTheme = .quill, placeholder: Bool = false
    ) -> BuiltSlide {
        var log: [String] = []
        var component = legacy(draft.layout)
        if let componentID, !componentID.trimmingCharacters(in: .whitespaces).isEmpty {
            if let found = self.component(componentID) {
                component = found
            } else {
                log.append("Unbekannte Komponente „\(componentID)“, nehme \(component.id).")
            }
        }
        var content = draft
        if let reason = component.accepts.violation(content, image: image, placeholder: placeholder) {
            var fallback = content
            fallback.layout = component.fallback
            fallback = SlideLayouts.resolve(fallback, image: image, placeholder: placeholder)
            if fallback.layout == component.fallback, fallback.bullets.isEmpty { fallback = bulletsFromContent(fallback) }
            let used = legacy(fallback.layout)
            log.append("\(component.id): \(reason); Rückfall auf \(used.id).")
            component = used
            content = fallback
        }
        let resolved = component.resolvedParams(params)
        let elements = component.build(content, resolved, image, theme)
        return BuiltSlide(elements: elements, componentID: component.id, params: resolved, log: log, draft: content)
    }

    /// The draft's content as bullet lines, so a fallback loses no text: entries of cards, steps, timelines, table
    /// rows, both columns, the numbers of a chart, the quote.
    static func bulletsFromContent(_ draft: SlideDraft) -> SlideDraft {
        var lines = draft.bullets
        if lines.isEmpty {
            lines += draft.items.map { [$0.title, $0.text].filter { !$0.isBlank }.joined(separator: ": ") }
            lines += draft.table.map { $0.joined(separator: " | ") }
            lines += draft.left + draft.right
            if let chart = draft.chart {
                lines += zip(chart.labels, chart.values).map { "\($0): \(SlideLayouts.formatNumber($1)) \(chart.unit)".trimmingCharacters(in: .whitespaces) }
            }
            if !draft.quote.isBlank { lines.append(draft.attribution.isBlank ? draft.quote : "\(draft.quote) – \(draft.attribution)") }
            if !draft.value.isBlank { lines.append(draft.value) }
            lines = lines.filter { !$0.isBlank }
        }
        var result = draft
        if lines.isEmpty {
            result.layout = draft.title.isBlank ? .blank : .statement
        } else {
            result.layout = .bullets
            result.bullets = lines
        }
        return result
    }

    // MARK: The fifteen layouts of the first version

    private static func legacyComponent(
        _ layout: SlideLayout, _ category: ComponentCategory, _ tags: [ContentTag], _ summary: String, reads: Set<DraftPart> = [],
        accepts: SlotContract = SlotContract(), draw: @escaping (SlideDraft, PlacedImage?) -> [SlideElement]
    ) -> SlideComponent {
        SlideComponent(
            id: layout.componentID, label: layout.label, category: category, tags: tags, summary: summary, accepts: accepts, reads: reads, layout: layout,
            build: { draft, _, image, _ in draw(draft, image) }
        )
    }

    static let legacyComponents: [SlideComponent] = [
        legacyComponent(.title, .opening, [.title], "Titelfolie mit Untertitel", reads: [.subtitle]) { d, _ in LayoutKit.buildTitle(d) },
        legacyComponent(.section, .opening, [.section], "Abschnittswechsel mit großem Titel", reads: [.subtitle]) { d, _ in LayoutKit.buildSection(d) },
        legacyComponent(.statement, .text, [.statement], "Eine große Aussage oder Frage", reads: [.subtitle]) { d, _ in LayoutKit.buildStatement(d) },
        legacyComponent(.bullets, .text, [.list], "Überschrift mit Stichpunkten", reads: [.bullets], accepts: SlotContract(field: .bullets, max: 30)) { d, _ in LayoutKit.buildBullets(d) },
        legacyComponent(.imageText, .visual, [.image, .list], "Bild links, Stichpunkte rechts", reads: [.bullets], accepts: SlotContract(needsImage: true)) { d, i in LayoutKit.buildImageText(d, image: i) },
        legacyComponent(.imageFull, .visual, [.image], "Ein großes Bild mit Unterschrift", reads: [.subtitle], accepts: SlotContract(needsImage: true)) { d, i in LayoutKit.buildImageFull(d, image: i) },
        legacyComponent(.twoColumns, .comparison, [.comparison, .list], "Zwei Spalten mit Stichpunkten", reads: [.columns]) { d, _ in LayoutKit.buildTwoColumns(d) },
        legacyComponent(.cards, .structure, [.grid, .list], "Zwei bis vier Karten", reads: [.items], accepts: SlotContract(field: .items, min: 2, max: 4)) { d, _ in LayoutKit.buildCards(d) },
        legacyComponent(.process, .structure, [.steps], "Zwei bis fünf Schritte mit Pfeilen", reads: [.items], accepts: SlotContract(field: .items, min: 2, max: 5)) { d, _ in LayoutKit.buildProcess(d) },
        legacyComponent(.timeline, .structure, [.timeline], "Zeitstrahl mit zwei bis sechs Ereignissen", reads: [.items], accepts: SlotContract(field: .items, min: 2, max: 6)) { d, _ in LayoutKit.buildTimeline(d) },
        legacyComponent(.bigNumber, .data, [.numbers], "Eine große Zahl mit Erklärung", reads: [.value, .subtitle, .bullets], accepts: SlotContract(needsNumbers: true)) { d, _ in LayoutKit.buildBigNumber(d) },
        legacyComponent(.chart, .data, [.chart, .numbers], "Balken- oder Liniendiagramm", reads: [.chart, .subtitle], accepts: SlotContract(field: .chartPoints, min: 2, max: 12, needsNumbers: true)) { d, _ in LayoutKit.buildChart(d) },
        legacyComponent(.table, .data, [.table], "Tabelle mit Kopfzeile", reads: [.table], accepts: SlotContract(field: .tableRows, min: 2, max: 8)) { d, _ in LayoutKit.buildTable(d) },
        legacyComponent(.quote, .text, [.quote], "Zitat mit Quelle", reads: [.quote]) { d, _ in LayoutKit.buildQuote(d) },
        legacyComponent(.blank, .text, [], "Leere Folie") { _, _ in [] },
    ]

    /// The components added after the first fifteen; see `NewComponents`.
    static var additionalComponents: [SlideComponent] { [] }
}
