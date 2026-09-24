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
struct DraftItem: Equatable {
    var title = ""
    var text = ""
    var icon = ""
}

enum ChartKind: String {
    case bar = "BAR"
    case line = "LINE"
}

/// Numbers for a chart, taken from the material; the app draws it.
struct ChartDraft: Equatable {
    var kind: ChartKind = .bar
    var labels: [String] = []
    var values: [Double] = []
    var unit = ""
}

/// The content of a slide before it becomes free elements; what the AI writes and what "new slide" presets use.
struct SlideDraft: Equatable {
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
    private static let margin: Double = 64
    private static let contentWidth = SlideSize.width - 2 * margin
    private static let contentTop: Double = 150
    private static let contentBottom: Double = 490

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

    static func build(_ original: SlideDraft, image: PlacedImage? = nil, placeholder: Bool = false) -> [SlideElement] {
        let draft = resolve(original, image: image, placeholder: placeholder)
        var elements: [SlideElement] = []
        switch draft.layout {
        case .title:
            elements = [
                decoration(700, 290, 240),
                decoration(40, 36, 90),
                text(draft.title, 100, 140, 760, 170, fitSize(draft.title, 760, 170, 54, 34, bold: true), bold: true, align: .center, anchor: .bottom),
                SlideElement(kind: .shape, x: 450, y: 326, width: 60, height: 6, shape: .rect, fill: "accent"),
            ]
            if !draft.subtitle.isBlank {
                elements.append(text(draft.subtitle, 100, 350, 760, 80, fitSize(draft.subtitle, 760, 80, 24, 16), align: .center, color: "muted"))
            }
        case .section:
            elements = [
                decoration(620, 190, 320),
                SlideElement(kind: .shape, x: 0, y: 0, width: 24, height: SlideSize.height, shape: .rect, fill: "accent"),
                text(draft.title, 96, 150, 720, 150, fitSize(draft.title, 720, 150, 48, 30, bold: true), bold: true, anchor: .bottom),
            ]
            if !draft.subtitle.isBlank {
                elements.append(text(draft.subtitle, 96, 312, 720, 80, fitSize(draft.subtitle, 720, 80, 24, 16), color: "muted"))
            }
        case .statement:
            elements = [
                SlideElement(kind: .shape, x: margin, y: 150, width: 8, height: 200, shape: .rect, fill: "accent"),
                text(draft.title, 104, 110, 760, 280, fitSize(draft.title, 760, 280, 46, 28, bold: true), bold: true, anchor: .middle),
            ]
            if !draft.subtitle.isBlank {
                elements.append(text(draft.subtitle, 104, 400, 760, 80, fitSize(draft.subtitle, 760, 80, 22, 15), color: "muted"))
            }
        case .bullets:
            elements = heading(draft.title) + [bulletBox(draft.bullets, margin, contentTop, contentWidth, contentBottom - contentTop, 28)]
        case .imageText:
            elements = heading(draft.title) + [picture(image, margin, contentTop, 420, contentBottom - contentTop)]
            if !draft.bullets.isEmpty { elements.append(bulletBox(draft.bullets, 516, contentTop, 380, contentBottom - contentTop, 24)) }
        case .imageFull:
            elements = heading(draft.title) + [picture(image, margin, 144, contentWidth, draft.subtitle.isBlank ? 360 : 316)]
            if !draft.subtitle.isBlank {
                elements.append(text(draft.subtitle, margin, 470, contentWidth, 44, fitSize(draft.subtitle, contentWidth, 44, 18, 12), align: .center, color: "muted"))
            }
        case .twoColumns:
            elements = heading(draft.title)
            elements.append(SlideElement(kind: .shape, x: 479, y: contentTop, width: 2, height: contentBottom - contentTop, shape: .rect, fill: "surface"))
            if !draft.leftTitle.isBlank {
                elements.append(text(draft.leftTitle, margin, contentTop, 390, 40, fitSize(draft.leftTitle, 390, 40, 24, 16, bold: true), bold: true, color: "accent"))
            }
            elements.append(bulletBox(draft.left, margin, 200, 390, 290, 22))
            if !draft.rightTitle.isBlank {
                elements.append(text(draft.rightTitle, 506, contentTop, 390, 40, fitSize(draft.rightTitle, 390, 40, 24, 16, bold: true), bold: true, color: "accent"))
            }
            elements.append(bulletBox(draft.right, 506, 200, 390, 290, 22))
        case .cards:
            elements = heading(draft.title) + cards(Array(draft.items.prefix(4)))
        case .process:
            elements = heading(draft.title) + process(Array(draft.items.prefix(5)))
        case .timeline:
            elements = heading(draft.title) + timeline(Array(draft.items.prefix(6)))
        case .bigNumber:
            elements = heading(draft.title) + [
                text(draft.value, margin, 170, 440, 240, fitSize(draft.value, 440, 240, 120, 48, bold: true), bold: true, anchor: .middle, color: "accent"),
                SlideElement(kind: .shape, x: 528, y: 200, width: 4, height: 180, shape: .rect, fill: "surface"),
            ]
            let explanation = draft.subtitle.isBlank ? draft.bullets.joined(separator: "\n") : draft.subtitle
            if !explanation.isBlank {
                elements.append(text(explanation, 560, 170, 336, 240, fitSize(explanation, 336, 240, 28, 16), anchor: .middle))
            }
        case .chart:
            elements = heading(draft.title) + chart(draft.chart ?? ChartDraft(), caption: draft.subtitle)
        case .table:
            elements = heading(draft.title) + table(draft.table)
        case .quote:
            let quote = draft.quote.isBlank ? draft.title : draft.quote
            elements = [
                text("„", 80, 40, 120, 150, 130, bold: true, color: "accent"),
                text(quote, 150, 140, 680, 240, fitSize(quote, 680, 240, 36, 22, italic: true), italic: true, anchor: .middle),
            ]
            if !draft.attribution.isBlank {
                elements.append(text("– \(draft.attribution)", 150, 390, 680, 40, 20, align: .right, color: "muted"))
            }
        case .blank:
            break
        }
        return elements
    }

    private static func decoration(_ x: Double, _ y: Double, _ size: Double) -> SlideElement {
        SlideElement(kind: .shape, x: x, y: y, width: size, height: size, shape: .ellipse, fill: "surface")
    }

    private static func heading(_ title: String) -> [SlideElement] {
        [
            text(title, margin, 30, contentWidth, 90, fitSize(title, contentWidth, 90, 36, 24, bold: true), bold: true, anchor: .bottom),
            SlideElement(kind: .shape, x: margin, y: 128, width: 56, height: 5, shape: .rect, fill: "accent"),
        ]
    }

    private static func bulletBox(_ lines: [String], _ x: Double, _ y: Double, _ w: Double, _ h: Double, _ max: Double) -> SlideElement {
        let value = lines.joined(separator: "\n")
        return text(value, x, y, w, h, fitSize(value, w, h, max, 14, bullets: true), bullets: true)
    }

    private static func picture(_ image: PlacedImage?, _ x: Double, _ y: Double, _ w: Double, _ h: Double) -> SlideElement {
        guard let image else {
            return SlideElement(kind: .shape, x: x, y: y, width: w, height: h, shape: .rounded, fill: "surface")
        }
        // Pictures keep their aspect ratio: fitted into the box and centered.
        let fw = min(w, h * image.aspect)
        let fh = fw / image.aspect
        return SlideElement(kind: .image, x: x + (w - fw) / 2, y: y + (h - fh) / 2, width: fw, height: fh, image: image.name)
    }

    /// Columns of equal width across the content area.
    private static func columns(_ count: Int, gap: Double) -> [(x: Double, width: Double)] {
        let width = (contentWidth - gap * Double(count - 1)) / Double(count)
        return (0..<count).map { (margin + Double($0) * (width + gap), width) }
    }

    private static func badge(_ label: String, _ x: Double, _ y: Double) -> [SlideElement] {
        [
            SlideElement(kind: .shape, x: x, y: y, width: 44, height: 44, shape: .ellipse, fill: "accent"),
            text(label, x, y, 44, 44, 20, bold: true, align: .center, anchor: .middle, color: "background"),
        ]
    }

    private static func cards(_ items: [DraftItem]) -> [SlideElement] {
        var out: [SlideElement] = []
        for (index, (column, item)) in zip(columns(items.count, gap: 24), items).enumerated() {
            let x = column.x
            let inner = column.width - 40
            out.append(SlideElement(kind: .shape, x: x, y: 160, width: column.width, height: 320, shape: .rounded, fill: "surface"))
            if let icon = icon(item.icon) {
                out.append(text(icon, x + 20, 180, inner, 60, 40))
            } else {
                out += badge("\(index + 1)", x + 20, 186)
            }
            out.append(text(item.title, x + 20, 252, inner, 64, fitSize(item.title, inner, 64, 24, 15, bold: true), bold: true))
            if !item.text.isBlank {
                out.append(text(item.text, x + 20, 322, inner, 144, fitSize(item.text, inner, 144, 21, 12), color: "muted"))
            }
        }
        return out
    }

    private static func process(_ items: [DraftItem]) -> [SlideElement] {
        var out: [SlideElement] = []
        for (index, (column, item)) in zip(columns(items.count, gap: 40), items).enumerated() {
            let x = column.x
            let inner = column.width - 32
            out.append(SlideElement(kind: .shape, x: x, y: 170, width: column.width, height: 260, shape: .rounded, fill: "surface"))
            out += badge("\(index + 1)", x + 16, 186)
            out.append(text(item.title, x + 16, 244, inner, 60, fitSize(item.title, inner, 60, 21, 14, bold: true), bold: true))
            if !item.text.isBlank {
                out.append(text(item.text, x + 16, 308, inner, 110, fitSize(item.text, inner, 110, 19, 11), color: "muted"))
            }
            if index < items.count - 1 {
                out.append(SlideElement(kind: .shape, x: x + column.width + 6, y: 290, width: 28, height: 20, shape: .arrow, fill: "accent", strokeWidth: 3))
            }
        }
        return out
    }

    private static func timeline(_ items: [DraftItem]) -> [SlideElement] {
        let slot = contentWidth / Double(items.count)
        var out = [SlideElement(kind: .shape, x: margin, y: 280, width: contentWidth, height: 20, shape: .line, fill: "muted", strokeWidth: 3)]
        for (index, item) in items.enumerated() {
            let x = margin + Double(index) * slot
            let center = x + slot / 2
            let inner = slot - 16
            out.append(SlideElement(kind: .shape, x: center - 11, y: 279, width: 22, height: 22, shape: .ellipse, fill: "accent"))
            out.append(text(item.title, x + 8, 196, inner, 72, fitSize(item.title, inner, 72, 24, 14, bold: true), bold: true, align: .center, anchor: .bottom, color: "accent"))
            if !item.text.isBlank {
                out.append(text(item.text, x + 8, 316, inner, 170, fitSize(item.text, inner, 170, 18, 11), align: .center))
            }
        }
        return out
    }

    /// A bar or line chart built from shapes, with value and category labels; negative values hang below zero.
    static func chart(_ chart: ChartDraft, caption: String = "") -> [SlideElement] {
        let count = min(chart.labels.count, chart.values.count, 12)
        guard count > 0 else { return [] }
        let values = Array(chart.values.prefix(count))
        let labels = Array(chart.labels.prefix(count))
        let left = margin + 16
        let right = SlideSize.width - margin - 16
        let top: Double = 190
        let bottom: Double = caption.isBlank ? 430 : 410
        let maxValue = max(0, values.max() ?? 0)
        let minValue = min(0, values.min() ?? 0)
        let range = maxValue - minValue > 0 ? maxValue - minValue : 1
        func y(_ value: Double) -> Double { bottom - (value - minValue) / range * (bottom - top) }
        let zero = y(0)
        let slot = (right - left) / Double(count)
        var out = [SlideElement(kind: .shape, x: left, y: zero - 10, width: right - left, height: 20, shape: .line, fill: "muted", strokeWidth: 2)]
        let points = values.enumerated().map { (x: left + slot * Double($0.offset) + slot / 2, y: y($0.element)) }
        if chart.kind == .bar {
            let barWidth = min(slot * 0.62, 110)
            for point in points {
                let height = max(abs(zero - point.y), 2)
                out.append(SlideElement(kind: .shape, x: point.x - barWidth / 2, y: min(zero, point.y), width: barWidth, height: height, shape: .rect, fill: "accent"))
            }
        } else {
            for (a, b) in zip(points, points.dropFirst()) {
                let length = hypot(b.x - a.x, b.y - a.y)
                let angle = atan2(b.y - a.y, b.x - a.x) * 180 / .pi
                out.append(SlideElement(
                    kind: .shape, x: (a.x + b.x) / 2 - length / 2, y: (a.y + b.y) / 2 - 10, width: length, height: 20,
                    rotation: angle, shape: .line, fill: "accent", strokeWidth: 4
                ))
            }
            for point in points {
                out.append(SlideElement(kind: .shape, x: point.x - 7, y: point.y - 7, width: 14, height: 14, shape: .ellipse, fill: "accent"))
            }
        }
        let longest = labels.max { $0.utf16.count < $1.utf16.count } ?? ""
        let labelSize = fitSize(longest, slot - 8, 40, 16, 10)
        for (index, value) in values.enumerated() {
            let point = points[index]
            let label = "\(formatNumber(value)) \(chart.unit)".trimmingCharacters(in: .whitespaces)
            let above = value >= 0
            out.append(text(label, point.x - slot / 2, above ? point.y - 32 : point.y + 6, slot, 26, fitSize(label, slot - 4, 26, 16, 10, bold: true), bold: true, align: .center))
            out.append(text(labels[index], point.x - slot / 2 + 4, max(zero, bottom) + 10, slot - 8, 40, labelSize, align: .center, color: "muted"))
        }
        if !caption.isBlank {
            out.append(text(caption, margin, 490, contentWidth, 30, fitSize(caption, contentWidth, 30, 14, 10), color: "muted"))
        }
        return out
    }

    private static func table(_ rows: [[String]]) -> [SlideElement] {
        let shown = Array(rows.prefix(8))
        let columnCount = min(shown.map(\.count).max() ?? 1, 5)
        let rowHeight = min(52, (contentBottom - contentTop) / Double(shown.count))
        let width = contentWidth / Double(columnCount)
        var out: [SlideElement] = []
        for (r, row) in shown.enumerated() {
            let y = contentTop + Double(r) * rowHeight
            let header = r == 0
            if header || r % 2 == 0 {
                out.append(SlideElement(kind: .shape, x: margin, y: y, width: contentWidth, height: rowHeight, shape: .rect, fill: header ? "accent" : "surface"))
            }
            for c in 0..<columnCount {
                let cell = c < row.count ? row[c] : ""
                if cell.isBlank { continue }
                out.append(text(
                    cell, margin + Double(c) * width + 12, y, width - 24, rowHeight,
                    fitSize(cell, width - 24, rowHeight - 6, 18, 10, bold: header), bold: header, anchor: .middle,
                    color: header ? "background" : "text"
                ))
            }
        }
        return out
    }

    static func text(
        _ value: String, _ x: Double, _ y: Double, _ width: Double, _ height: Double, _ size: Double,
        bold: Bool = false, italic: Bool = false, align: SlideTextAlign = .left, anchor: TextAnchor = .top,
        bullets: Bool = false, color: String = "text"
    ) -> SlideElement {
        SlideElement(
            kind: .text, x: x, y: y, width: width, height: height, text: value, fontSize: size, bold: bold, italic: italic,
            align: align, anchor: anchor, bullets: bullets, textColor: color
        )
    }

    /// The largest font size from `max` down to `min` at which the text fits the box, estimated from average glyph
    /// widths of Work Sans. Deterministic, so both apps and the export agree without measuring real fonts.
    static func fitSize(
        _ value: String, _ width: Double, _ height: Double, _ max: Double, _ min: Double,
        bold: Bool = false, bullets: Bool = false, italic: Bool = false
    ) -> Double {
        var size = max
        while size > min && !fits(value, width, height, size, bold: bold || italic, bullets: bullets) { size -= 1 }
        return size
    }

    static func fits(_ value: String, _ width: Double, _ height: Double, _ size: Double, bold: Bool, bullets: Bool) -> Bool {
        Double(lineCount(value, width - (bullets ? size * 1.1 : 0), size, bold: bold)) * size * 1.24 <= height
    }

    static func lineCount(_ value: String, _ width: Double, _ size: Double, bold: Bool) -> Int {
        let charWidth = size * (bold ? 0.58 : 0.54)
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
