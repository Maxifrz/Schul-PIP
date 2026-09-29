import Foundation

/// The ten components added after the first fifteen layouts. Each has the `density` parameter that `DeckRhythm` sets for
/// the whole deck and one of its own, so a component has at least two variants. Their slot contracts are tight enough
/// that what passes always fits its boxes at the smallest text size, in every theme; anything longer falls back.
enum NewComponents {
    private static let titleLimit = 90

    /// The first message of several checks, or nil if all pass.
    private static func firstProblem(_ checks: String?...) -> String? {
        checks.compactMap { $0 }.first
    }

    private static func title(_ draft: SlideDraft) -> String? {
        SlotContract.tooLong("Titel", draft.title, titleLimit)
    }

    private static func parameter(_ name: String, _ label: String, _ values: [String]) -> ComponentParameter {
        ComponentParameter(name: name, label: label, values: values, defaultValue: values[0])
    }

    static let all: [SlideComponent] = [
        SlideComponent(
            id: "stat-row", label: "Statistik-Reihe", category: .data, tags: [.numbers, .grid],
            summary: "Zwei bis vier große Zahlen mit Beschriftung (items: title = Zahl mit Einheit, höchstens 14 Zeichen, text = Beschriftung)",
            accepts: SlotContract(field: .items, min: 2, max: 4, needsNumbers: true, maxChars: 90, maxTitle: 14, extra: title),
            reads: [.items],
            parameters: [LayoutKit.densityParameter, parameter("style", "Stil", ["cards", "plain"])],
            fallback: .cards,
            build: { draft, params, _, theme in LayoutKit.buildStatRow(draft, params, theme) }
        ),
        SlideComponent(
            id: "comparison", label: "Vergleich", category: .comparison, tags: [.comparison, .list],
            summary: "Zwei Karten mit Kopf gegenüber (leftTitle, left, rightTitle, right; je 1 bis 5 kurze Stichpunkte)",
            accepts: SlotContract(field: .columns, min: 1, max: 5, maxChars: 80, extra: { draft in
                firstProblem(title(draft), SlotContract.tooLong("Kopf links", draft.leftTitle, 34), SlotContract.tooLong("Kopf rechts", draft.rightTitle, 34))
            }),
            reads: [.columns],
            parameters: [LayoutKit.densityParameter, parameter("emphasis", "Betonung", ["none", "left", "right"])],
            fallback: .twoColumns,
            build: { draft, params, _, theme in LayoutKit.buildComparison(draft, params, theme) }
        ),
        SlideComponent(
            id: "matrix-2x2", label: "2×2-Matrix", category: .structure, tags: [.grid, .comparison, .hierarchy],
            summary: "Vier Felder in zwei mal zwei (items: genau 4 mit title und kurzem text; leftTitle und rightTitle benennen die Achsen)",
            accepts: SlotContract(field: .items, min: 4, max: 4, maxChars: 100, maxTitle: 28, extra: { draft in
                firstProblem(title(draft), SlotContract.tooLong("Achse", draft.leftTitle, 40), SlotContract.tooLong("Achse", draft.rightTitle, 40))
            }),
            reads: [.items, .columns],
            parameters: [LayoutKit.densityParameter, parameter("style", "Stil", ["filled", "outlined"])],
            fallback: .cards,
            build: { draft, params, _, theme in LayoutKit.buildMatrix(draft, params, theme) }
        ),
        SlideComponent(
            id: "definition", label: "Definition", category: .text, tags: [.definition, .statement],
            summary: "Ein Begriff mit Erklärung und Beispiel (value = Begriff, subtitle = Erklärung, bullets = ein bis zwei Beispiele)",
            accepts: SlotContract(requires: [.value, .subtitle], extra: { draft in
                firstProblem(
                    title(draft), SlotContract.tooLong("Begriff", draft.value, 40), SlotContract.tooLong("Erklärung", draft.subtitle, 240),
                    draft.bullets.count > 2 ? "zu viele Beispiele (\(draft.bullets.count), höchstens 2)" : nil,
                    draft.bullets.compactMap { SlotContract.tooLong("Beispiel", $0, 100) }.first
                )
            }),
            reads: [.value, .subtitle, .bullets],
            parameters: [LayoutKit.densityParameter, parameter("style", "Stil", ["stacked", "split"])],
            fallback: .bigNumber,
            build: { draft, params, _, theme in LayoutKit.buildDefinition(draft, params, theme) }
        ),
        SlideComponent(
            id: "agenda", label: "Agenda", category: .structure, tags: [.agenda, .steps, .list],
            summary: "Nummerierte Gliederung mit drei bis sieben Punkten (items: title, optional text)",
            accepts: SlotContract(field: .items, min: 3, max: 7, maxChars: 60, maxTitle: 46, extra: title),
            reads: [.items],
            parameters: [LayoutKit.densityParameter, parameter("numbering", "Nummern", ["badge", "numeral"])],
            fallback: .process,
            build: { draft, params, _, theme in LayoutKit.buildAgenda(draft, params, theme) }
        ),
        SlideComponent(
            id: "checklist", label: "Kernaussagen-Checkliste", category: .text, tags: [.checklist, .list],
            summary: "Drei bis sechs Kernaussagen mit Haken (bullets, je höchstens 100 Zeichen)",
            accepts: SlotContract(field: .bullets, min: 3, max: 6, maxChars: 100, extra: title),
            reads: [.bullets],
            parameters: [LayoutKit.densityParameter, parameter("marker", "Markierung", ["check", "square"])],
            fallback: .bullets,
            build: { draft, params, _, theme in LayoutKit.buildChecklist(draft, params, theme) }
        ),
        SlideComponent(
            id: "quote-image", label: "Zitat mit Bild", category: .visual, tags: [.quote, .image],
            summary: "Zitat neben einem Bild der Materialseite (quote, attribution, imageMaterial und imagePage)",
            accepts: SlotContract(needsImage: true, requires: [.quote], extra: { draft in
                firstProblem(title(draft), SlotContract.tooLong("Zitat", draft.quote, 240), SlotContract.tooLong("Quelle", draft.attribution, 60))
            }),
            reads: [.quote],
            parameters: [LayoutKit.densityParameter, parameter("side", "Bildseite", ["left", "right"])],
            fallback: .quote,
            build: { draft, params, image, theme in LayoutKit.buildQuoteImage(draft, params, image, theme) }
        ),
        SlideComponent(
            id: "icon-grid", label: "Icon-Raster", category: .structure, tags: [.grid],
            summary: "Vier bis sechs Felder mit Symbol, Titel und kurzem Text (items mit icon als ein Emoji)",
            accepts: SlotContract(field: .items, min: 4, max: 6, maxChars: 60, maxTitle: 26, extra: title),
            reads: [.items],
            parameters: [LayoutKit.densityParameter, parameter("style", "Stil", ["cards", "plain"])],
            fallback: .cards,
            build: { draft, params, _, theme in LayoutKit.buildIconGrid(draft, params, theme) }
        ),
        SlideComponent(
            id: "staircase", label: "Treppe und Schichten", category: .structure, tags: [.hierarchy, .steps],
            summary: "Drei bis fünf Stufen oder Schichten, die aufeinander aufbauen (items: kurzer title, text höchstens 48 Zeichen)",
            accepts: SlotContract(field: .items, min: 3, max: 5, maxChars: 48, maxTitle: 24, extra: title),
            reads: [.items],
            parameters: [LayoutKit.densityParameter, parameter("form", "Form", ["stairs", "layers"])],
            fallback: .process,
            build: { draft, params, _, theme in LayoutKit.buildStaircase(draft, params, theme) }
        ),
        SlideComponent(
            id: "before-after", label: "Vorher und Nachher", category: .comparison, tags: [.comparison, .image],
            summary: "Zustand vorher und nachher mit Pfeil (leftTitle, left, rightTitle, right; je 1 bis 4 Stichpunkte)",
            accepts: SlotContract(field: .columns, min: 1, max: 4, maxChars: 60, extra: { draft in
                firstProblem(title(draft), SlotContract.tooLong("Kopf links", draft.leftTitle, 24), SlotContract.tooLong("Kopf rechts", draft.rightTitle, 24))
            }),
            reads: [.columns],
            parameters: [LayoutKit.densityParameter, parameter("imageSide", "Bild", ["none", "left", "right"])],
            fallback: .twoColumns,
            build: { draft, params, image, theme in LayoutKit.buildBeforeAfter(draft, params, image, theme) }
        ),
    ]
}
