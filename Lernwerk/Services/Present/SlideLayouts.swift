import Foundation

enum SlideLayout: String, CaseIterable, Codable {
    case title = "TITLE"
    case section = "SECTION"
    case statement = "STATEMENT"
    case bullets = "BULLETS"
    case imageText = "IMAGE_TEXT"
    case imageFull = "IMAGE_FULL"
    case twoColumns = "TWO_COLUMNS"
    case cards = "CARDS"
    case process = "PROCESS"
    case timeline = "TIMELINE"
    case bigNumber = "BIG_NUMBER"
    case chart = "CHART"
    case table = "TABLE"
    case quote = "QUOTE"
    case blank = "BLANK"

    var label: String {
        switch self {
        case .title: return "Titel"
        case .section: return "Abschnitt"
        case .statement: return "Aussage"
        case .bullets: return "Stichpunkte"
        case .imageText: return "Bild und Text"
        case .imageFull: return "Großes Bild"
        case .twoColumns: return "Zwei Spalten"
        case .cards: return "Karten"
        case .process: return "Ablauf"
        case .timeline: return "Zeitstrahl"
        case .bigNumber: return "Große Zahl"
        case .chart: return "Diagramm"
        case .table: return "Tabelle"
        case .quote: return "Zitat"
        case .blank: return "Leer"
        }
    }
}

/// One entry of a card grid, process or timeline: a short title (a date on timelines), a line of text, an emoji.
struct DraftItem: Equatable, Codable {
    var title = ""
    var text = ""
    var icon = ""

    init(title: String = "", text: String = "", icon: String = "") {
        self.title = title
        self.text = text
        self.icon = icon
    }

    enum CodingKeys: String, CodingKey { case title, text, icon }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        text = (try? c.decode(String.self, forKey: .text)) ?? ""
        icon = (try? c.decode(String.self, forKey: .icon)) ?? ""
    }
}

enum ChartKind: String, Codable {
    case bar = "BAR"
    case line = "LINE"
}

/// Numbers for a chart, taken from the material; the app draws it.
struct ChartDraft: Equatable, Codable {
    var kind: ChartKind = .bar
    var labels: [String] = []
    var values: [Double] = []
    var unit = ""

    init(kind: ChartKind = .bar, labels: [String] = [], values: [Double] = [], unit: String = "") {
        self.kind = kind
        self.labels = labels
        self.values = values
        self.unit = unit
    }

    enum CodingKeys: String, CodingKey { case kind, labels, values, unit }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = (try? c.decode(ChartKind.self, forKey: .kind)) ?? .bar
        labels = (try? c.decode([String].self, forKey: .labels)) ?? []
        values = (try? c.decode([Double].self, forKey: .values)) ?? []
        unit = (try? c.decode(String.self, forKey: .unit)) ?? ""
    }
}

/// The content of a slide before it becomes free elements; what the AI writes and what "new slide" presets use.
struct SlideDraft: Equatable, Codable {
    var layout: SlideLayout
    var title = ""
    var subtitle = ""
    var bullets: [String] = []
    var leftTitle = ""
    var left: [String] = []
    var rightTitle = ""
    var right: [String] = []
    var quote = ""
    var attribution = ""
    var items: [DraftItem] = []
    /// The number on a BIG_NUMBER slide, e.g. "70 %".
    var value = ""
    var chart: ChartDraft?
    /// Table rows; the first row is the header.
    var table: [[String]] = []
    /// 0-based index into the chosen materials and 1-based page for a picture of that page, if any.
    var imageMaterial: Int?
    var imagePage: Int?
    var notes = ""
    var sourceMaterial: Int?
    var sourcePages: [Int] = []
    /// Ids of the Wikipedia articles (W1, W2 …) the slide's facts come from.
    var webSources: [String] = []

    init(
        layout: SlideLayout, title: String = "", subtitle: String = "", bullets: [String] = [], leftTitle: String = "", left: [String] = [],
        rightTitle: String = "", right: [String] = [], quote: String = "", attribution: String = "", items: [DraftItem] = [], value: String = "",
        chart: ChartDraft? = nil, table: [[String]] = [], imageMaterial: Int? = nil, imagePage: Int? = nil, notes: String = "",
        sourceMaterial: Int? = nil, sourcePages: [Int] = [], webSources: [String] = []
    ) {
        self.layout = layout
        self.title = title
        self.subtitle = subtitle
        self.bullets = bullets
        self.leftTitle = leftTitle
        self.left = left
        self.rightTitle = rightTitle
        self.right = right
        self.quote = quote
        self.attribution = attribution
        self.items = items
        self.value = value
        self.chart = chart
        self.table = table
        self.imageMaterial = imageMaterial
        self.imagePage = imagePage
        self.notes = notes
        self.sourceMaterial = sourceMaterial
        self.sourcePages = sourcePages
        self.webSources = webSources
    }

    enum CodingKeys: String, CodingKey {
        case layout, title, subtitle, bullets, leftTitle, left, rightTitle, right, quote, attribution, items, value, chart, table
        case imageMaterial, imagePage, notes, sourceMaterial, sourcePages, webSources
    }

    /// Every field is optional and a wrong type counts as missing, so a draft saved by another version still loads.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func text(_ key: CodingKeys) -> String { (try? c.decode(String.self, forKey: key)) ?? "" }
        func lines(_ key: CodingKeys) -> [String] { (try? c.decode([String].self, forKey: key)) ?? [] }
        layout = (try? c.decode(SlideLayout.self, forKey: .layout)) ?? .blank
        title = text(.title)
        subtitle = text(.subtitle)
        bullets = lines(.bullets)
        leftTitle = text(.leftTitle)
        left = lines(.left)
        rightTitle = text(.rightTitle)
        right = lines(.right)
        quote = text(.quote)
        attribution = text(.attribution)
        items = (try? c.decode([DraftItem].self, forKey: .items)) ?? []
        value = text(.value)
        chart = try? c.decode(ChartDraft.self, forKey: .chart)
        table = (try? c.decode([[String]].self, forKey: .table)) ?? []
        imageMaterial = try? c.decode(Int.self, forKey: .imageMaterial)
        imagePage = try? c.decode(Int.self, forKey: .imagePage)
        notes = text(.notes)
        sourceMaterial = try? c.decode(Int.self, forKey: .sourceMaterial)
        sourcePages = (try? c.decode([Int].self, forKey: .sourcePages)) ?? []
        webSources = lines(.webSources)
    }
}

/// A picture for a layout: its media file name and width / height.
struct PlacedImage: Equatable {
    var name: String
    var aspect: Double
}

/// Turns layouts into freely editable elements; after this a slide is just a list of objects. The design rules live
/// here, not in the prompt: a fixed grid, one heading style, text sized to fit its box, and visual layouts drawn from
/// shapes so they stay editable and export to PowerPoint as native objects. Mirrors the Android app.
enum SlideLayouts {
    /// The box of a single-column bullet list and of one column of TWO_COLUMNS, for `LayoutAdvisor`.
    static var bulletsBox: (width: Double, height: Double) { LayoutKit.bulletsBox }
    static var columnBox: (width: Double, height: Double) { LayoutKit.columnBox }

    /// Falls back to a layout the content can fill: picture layouts need a picture, charts need numbers, grids need
    /// at least two entries. Models get this wrong often enough that every path goes through here. Editor presets
    /// keep an empty picture frame as a `placeholder` for the student's own picture.
    static func resolve(_ draft: SlideDraft, image: PlacedImage?, placeholder: Bool = false) -> SlideDraft {
        func asBullets(_ lines: [String]) -> SlideDraft {
            var result = draft
            if lines.isEmpty {
                result.layout = draft.title.isBlank ? .blank : .statement
            } else {
                result.layout = .bullets
                result.bullets = lines
            }
            return result
        }
        switch draft.layout {
        case .imageText, .imageFull:
            return image == nil && !placeholder ? asBullets(draft.bullets) : draft
        case .chart:
            let chart = draft.chart
            let count = min(chart?.labels.count ?? 0, chart?.values.count ?? 0)
            guard let chart, count >= 2 else {
                let lines = zip(chart?.labels ?? [], chart?.values ?? []).map { label, value in
                    "\(label): \(formatNumber(value)) \(chart?.unit ?? "")".trimmingCharacters(in: .whitespaces)
                }
                return asBullets(draft.bullets.isEmpty ? lines : draft.bullets)
            }
            return draft
        case .cards, .process, .timeline:
            guard draft.items.count >= 2 else {
                let lines = draft.items.map { [$0.title, $0.text].filter { !$0.isBlank }.joined(separator: ": ") }
                return asBullets(draft.bullets.isEmpty ? lines : draft.bullets)
            }
            return draft
        case .table:
            guard draft.table.count >= 2, !(draft.table.first ?? []).isEmpty else {
                return asBullets(draft.bullets.isEmpty ? draft.table.map { $0.joined(separator: " | ") } : draft.bullets)
            }
            return draft
        case .bigNumber:
            return draft.value.isBlank ? asBullets(draft.bullets) : draft
        default:
            return draft
        }
    }

    /// The elements of a draft in the layout it names, after `resolve`. Kept as the original entry point; the drawings
    /// themselves are the components in `ComponentRegistry`. Content beyond a layout's limit is cut here as it always
    /// was: `LayoutAdvisor` splits such slides before they get this far, and `ComponentRegistry.build` falls back
    /// instead of cutting.
    static func build(_ original: SlideDraft, image: PlacedImage? = nil, placeholder: Bool = false) -> [SlideElement] {
        let draft = resolve(original, image: image, placeholder: placeholder)
        return ComponentRegistry.legacy(draft.layout).draw(draft, image: image)
    }

    /// A bar or line chart built from shapes, with value and category labels; negative values hang below zero.
    static func chart(_ chart: ChartDraft, caption: String = "") -> [SlideElement] {
        LayoutKit.chart(chart, caption: caption)
    }

    static func text(
        _ value: String, _ x: Double, _ y: Double, _ width: Double, _ height: Double, _ size: Double,
        bold: Bool = false, italic: Bool = false, align: SlideTextAlign = .left, anchor: TextAnchor = .top,
        bullets: Bool = false, color: String = "text", font: String = ""
    ) -> SlideElement {
        SlideElement(
            kind: .text, x: x, y: y, width: width, height: height, text: value, fontSize: size, bold: bold, italic: italic,
            align: align, anchor: anchor, bullets: bullets, textColor: color, font: font
        )
    }

    /// The largest font size from `max` down to `min` at which the text fits the box, estimated from average glyph
    /// widths of Work Sans. Deterministic, so both apps and the export agree without measuring real fonts.
    /// `widthFactor` is how much wider than Work Sans the theme's font sets text (`SlideFont.widthFactor`); 1 keeps
    /// the estimate as it always was.
    static func fitSize(
        _ value: String, _ width: Double, _ height: Double, _ max: Double, _ min: Double,
        bold: Bool = false, bullets: Bool = false, italic: Bool = false, widthFactor: Double = 1
    ) -> Double {
        var size = max
        while size > min && !fits(value, width, height, size, bold: bold || italic, bullets: bullets, widthFactor: widthFactor) { size -= 1 }
        return size
    }

    static func fits(_ value: String, _ width: Double, _ height: Double, _ size: Double, bold: Bool, bullets: Bool, widthFactor: Double = 1) -> Bool {
        Double(lineCount(value, width - (bullets ? size * 1.1 : 0), size, bold: bold, widthFactor: widthFactor)) * size * 1.24 <= height
    }

    static func lineCount(_ value: String, _ width: Double, _ size: Double, bold: Bool, widthFactor: Double = 1) -> Int {
        let charWidth = size * (bold ? 0.58 : 0.54) * widthFactor
        let perLine = Swift.max(1, Int(width / charWidth))
        return value.components(separatedBy: "\n").reduce(0) { total, paragraph in
            var lines = 1
            var used = 0
            for word in paragraph.components(separatedBy: " ") where !word.isEmpty {
                let length = word.utf16.count
                if used == 0 {
                    lines += (length - 1) / perLine
                    used = (length - 1) % perLine + 1
                } else if used + 1 + length <= perLine {
                    used += 1 + length
                } else {
                    lines += 1 + (length - 1) / perLine
                    used = (length - 1) % perLine + 1
                }
            }
            return total + lines
        }
    }

    /// A single emoji for a card, or nil for anything else (the card then shows its number).
    static func icon(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let first = trimmed.unicodeScalars.first, trimmed.unicodeScalars.count <= 4 else { return nil }
        return first.value >= 0x2190 && !CharacterSet.alphanumerics.contains(first) ? trimmed : nil
    }

    /// German number format: comma decimals, at most two, dots between thousands.
    static func formatNumber(_ value: Double) -> String {
        // Rounds halves up like Kotlin's roundToLong, so both apps print the same.
        let rounded = Int64((value * 100 + 0.5).rounded(.down))
        let absolute = rounded.magnitude
        var whole = String(String(absolute / 100).reversed())
        var groups: [String] = []
        while !whole.isEmpty {
            groups.append(String(whole.prefix(3)))
            whole = String(whole.dropFirst(3))
        }
        let wholeText = String(groups.joined(separator: ".").reversed())
        var fraction = String(absolute % 100)
        if fraction.count < 2 { fraction = "0" + fraction }
        while fraction.hasSuffix("0") { fraction.removeLast() }
        return (rounded < 0 ? "−" : "") + wholeText + (fraction.isEmpty ? "" : ",\(fraction)")
    }

    /// A slide as the editor's "new slide" menu offers it, with placeholder text to overwrite.
    static func preset(_ layout: SlideLayout) -> Slide {
        let draft: SlideDraft
        switch layout {
        case .title: draft = SlideDraft(layout: layout, title: "Titel der Präsentation", subtitle: "Name · Fach · Datum")
        case .section: draft = SlideDraft(layout: layout, title: "Neuer Abschnitt")
        case .statement: draft = SlideDraft(layout: layout, title: "Eine Aussage oder Frage, die hängen bleibt.")
        case .bullets: draft = SlideDraft(layout: layout, title: "Überschrift", bullets: ["Erster Punkt", "Zweiter Punkt", "Dritter Punkt"])
        case .imageText: draft = SlideDraft(layout: layout, title: "Überschrift", bullets: ["Was das Bild zeigt", "Warum es wichtig ist"])
        case .imageFull: draft = SlideDraft(layout: layout, title: "Was das Bild zeigt", subtitle: "Bildunterschrift")
        case .twoColumns:
            draft = SlideDraft(layout: layout, title: "Vergleich", leftTitle: "Links", left: ["Punkt"], rightTitle: "Rechts", right: ["Punkt"])
        case .cards:
            draft = SlideDraft(layout: layout, title: "Drei Aspekte", items: [
                DraftItem(title: "Erster", text: "Kurz erklärt"), DraftItem(title: "Zweiter", text: "Kurz erklärt"), DraftItem(title: "Dritter", text: "Kurz erklärt"),
            ])
        case .process:
            draft = SlideDraft(layout: layout, title: "So läuft es ab", items: [
                DraftItem(title: "Schritt eins", text: "Was passiert"), DraftItem(title: "Schritt zwei", text: "Was passiert"),
                DraftItem(title: "Schritt drei", text: "Was passiert"),
            ])
        case .timeline:
            draft = SlideDraft(layout: layout, title: "Zeitstrahl", items: [
                DraftItem(title: "1900", text: "Ereignis"), DraftItem(title: "1950", text: "Ereignis"), DraftItem(title: "2000", text: "Ereignis"),
            ])
        case .bigNumber: draft = SlideDraft(layout: layout, title: "Eine Zahl, die überrascht", subtitle: "Was die Zahl bedeutet", value: "42 %")
        case .chart:
            draft = SlideDraft(layout: layout, title: "Diagramm", chart: ChartDraft(kind: .bar, labels: ["A", "B", "C"], values: [3, 5, 2]))
        case .table: draft = SlideDraft(layout: layout, title: "Tabelle", table: [["Merkmal", "A", "B"], ["Zeile", "…", "…"]])
        case .quote: draft = SlideDraft(layout: layout, quote: "Ein Zitat, das den Kern trifft.", attribution: "Quelle")
        case .blank: draft = SlideDraft(layout: layout)
        }
        return Slide(elements: build(draft, placeholder: true))
    }
}

extension String {
    var isBlank: Bool { trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}
