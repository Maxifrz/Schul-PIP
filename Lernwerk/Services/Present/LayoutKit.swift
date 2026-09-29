import Foundation

/// The grid and the building blocks every slide component draws with: margins, the heading, bullet boxes, pictures,
/// columns, badges and the shared card, step, timeline, chart and table drawings. Geometry is decided here and in the
/// components, never by the model.
enum LayoutKit {
    static let margin: Double = 64
    static let contentWidth = SlideSize.width - 2 * margin
    static let contentTop: Double = 150
    static let contentBottom: Double = 490
    /// The box of a single-column bullet list and of one column of TWO_COLUMNS, for `LayoutAdvisor`.
    static let bulletsBox = (width: contentWidth, height: contentBottom - contentTop)
    static let columnBox = (width: 390.0, height: 290.0)

    static func decoration(_ x: Double, _ y: Double, _ size: Double) -> SlideElement {
        SlideElement(kind: .shape, x: x, y: y, width: size, height: size, shape: .ellipse, fill: "surface")
    }

    static func heading(_ title: String) -> [SlideElement] {
        [
            text(title, margin, 30, contentWidth, 90, fitSize(title, contentWidth, 90, 36, 24, bold: true), bold: true, anchor: .bottom, font: "heading"),
            SlideElement(kind: .shape, x: margin, y: 128, width: 56, height: 5, shape: .rect, fill: "accent"),
        ]
    }

    static func bulletBox(_ lines: [String], _ x: Double, _ y: Double, _ w: Double, _ h: Double, _ max: Double) -> SlideElement {
        let value = lines.joined(separator: "\n")
        return text(value, x, y, w, h, fitSize(value, w, h, max, 14, bullets: true), bullets: true)
    }

    static func picture(_ image: PlacedImage?, _ x: Double, _ y: Double, _ w: Double, _ h: Double) -> SlideElement {
        guard let image else {
            return SlideElement(kind: .shape, x: x, y: y, width: w, height: h, shape: .rounded, fill: "surface")
        }
        // Pictures keep their aspect ratio: fitted into the box and centered.
        let fw = min(w, h * image.aspect)
        let fh = fw / image.aspect
        return SlideElement(kind: .image, x: x + (w - fw) / 2, y: y + (h - fh) / 2, width: fw, height: fh, image: image.name)
    }

    /// Columns of equal width across the content area.
    static func columns(_ count: Int, gap: Double) -> [(x: Double, width: Double)] {
        let width = (contentWidth - gap * Double(count - 1)) / Double(count)
        return (0..<count).map { (margin + Double($0) * (width + gap), width) }
    }

    static func badge(_ label: String, _ x: Double, _ y: Double) -> [SlideElement] {
        [
            SlideElement(kind: .shape, x: x, y: y, width: 44, height: 44, shape: .ellipse, fill: "accent"),
            text(label, x, y, 44, 44, 20, bold: true, align: .center, anchor: .middle, color: "background"),
        ]
    }

    static func cards(_ items: [DraftItem]) -> [SlideElement] {
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

    static func process(_ items: [DraftItem]) -> [SlideElement] {
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

    static func timeline(_ items: [DraftItem]) -> [SlideElement] {
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

    static func table(_ rows: [[String]]) -> [SlideElement] {
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

    // Forwarders, so the drawings above read as they always did.

    static func text(
        _ value: String, _ x: Double, _ y: Double, _ width: Double, _ height: Double, _ size: Double,
        bold: Bool = false, italic: Bool = false, align: SlideTextAlign = .left, anchor: TextAnchor = .top,
        bullets: Bool = false, color: String = "text", font: String = ""
    ) -> SlideElement {
        SlideLayouts.text(value, x, y, width, height, size, bold: bold, italic: italic, align: align, anchor: anchor, bullets: bullets, color: color, font: font)
    }

    static func fitSize(
        _ value: String, _ width: Double, _ height: Double, _ max: Double, _ min: Double,
        bold: Bool = false, bullets: Bool = false, italic: Bool = false, widthFactor: Double = 1
    ) -> Double {
        SlideLayouts.fitSize(value, width, height, max, min, bold: bold, bullets: bullets, italic: italic, widthFactor: widthFactor)
    }

    static func icon(_ value: String) -> String? { SlideLayouts.icon(value) }

    static func formatNumber(_ value: Double) -> String { SlideLayouts.formatNumber(value) }
}

// The fifteen layouts of the first version, one drawing each. `SlideLayouts.build` and the component registry both
// end up here, so what they make is the same by construction and by the golden test.
extension LayoutKit {
    static func buildTitle(_ draft: SlideDraft) -> [SlideElement] {
        var elements = [
            decoration(700, 290, 240),
            decoration(40, 36, 90),
            text(draft.title, 100, 140, 760, 170, fitSize(draft.title, 760, 170, 54, 34, bold: true), bold: true, align: .center, anchor: .bottom, font: "heading"),
            SlideElement(kind: .shape, x: 450, y: 326, width: 60, height: 6, shape: .rect, fill: "accent"),
        ]
        if !draft.subtitle.isBlank {
            elements.append(text(draft.subtitle, 100, 350, 760, 80, fitSize(draft.subtitle, 760, 80, 24, 16), align: .center, color: "muted"))
        }
        return elements
    }

    static func buildSection(_ draft: SlideDraft) -> [SlideElement] {
        var elements = [
            decoration(620, 190, 320),
            SlideElement(kind: .shape, x: 0, y: 0, width: 24, height: SlideSize.height, shape: .rect, fill: "accent"),
            text(draft.title, 96, 150, 720, 150, fitSize(draft.title, 720, 150, 48, 30, bold: true), bold: true, anchor: .bottom, font: "heading"),
        ]
        if !draft.subtitle.isBlank {
            elements.append(text(draft.subtitle, 96, 312, 720, 80, fitSize(draft.subtitle, 720, 80, 24, 16), color: "muted"))
        }
        return elements
    }

    static func buildStatement(_ draft: SlideDraft) -> [SlideElement] {
        var elements = [
            SlideElement(kind: .shape, x: margin, y: 150, width: 8, height: 200, shape: .rect, fill: "accent"),
            text(draft.title, 104, 110, 760, 280, fitSize(draft.title, 760, 280, 46, 28, bold: true), bold: true, anchor: .middle, font: "heading"),
        ]
        if !draft.subtitle.isBlank {
            elements.append(text(draft.subtitle, 104, 400, 760, 80, fitSize(draft.subtitle, 760, 80, 22, 15), color: "muted"))
        }
        return elements
    }

    static func buildBullets(_ draft: SlideDraft) -> [SlideElement] {
        heading(draft.title) + [bulletBox(draft.bullets, margin, contentTop, contentWidth, contentBottom - contentTop, 28)]
    }

    static func buildImageText(_ draft: SlideDraft, image: PlacedImage?) -> [SlideElement] {
        var elements = heading(draft.title) + [picture(image, margin, contentTop, 420, contentBottom - contentTop)]
        if !draft.bullets.isEmpty { elements.append(bulletBox(draft.bullets, 516, contentTop, 380, contentBottom - contentTop, 24)) }
        return elements
    }

    static func buildImageFull(_ draft: SlideDraft, image: PlacedImage?) -> [SlideElement] {
        var elements = heading(draft.title) + [picture(image, margin, 144, contentWidth, draft.subtitle.isBlank ? 360 : 316)]
        if !draft.subtitle.isBlank {
            elements.append(text(draft.subtitle, margin, 470, contentWidth, 44, fitSize(draft.subtitle, contentWidth, 44, 18, 12), align: .center, color: "muted"))
        }
        return elements
    }

    static func buildTwoColumns(_ draft: SlideDraft) -> [SlideElement] {
        var elements = heading(draft.title)
        elements.append(SlideElement(kind: .shape, x: 479, y: contentTop, width: 2, height: contentBottom - contentTop, shape: .rect, fill: "surface"))
        if !draft.leftTitle.isBlank {
            elements.append(text(draft.leftTitle, margin, contentTop, 390, 40, fitSize(draft.leftTitle, 390, 40, 24, 16, bold: true), bold: true, color: "accent"))
        }
        elements.append(bulletBox(draft.left, margin, 200, columnBox.width, columnBox.height, 22))
        if !draft.rightTitle.isBlank {
            elements.append(text(draft.rightTitle, 506, contentTop, 390, 40, fitSize(draft.rightTitle, 390, 40, 24, 16, bold: true), bold: true, color: "accent"))
        }
        elements.append(bulletBox(draft.right, 506, 200, columnBox.width, columnBox.height, 22))
        return elements
    }

    static func buildCards(_ draft: SlideDraft) -> [SlideElement] {
        heading(draft.title) + cards(Array(draft.items.prefix(4)))
    }

    static func buildProcess(_ draft: SlideDraft) -> [SlideElement] {
        heading(draft.title) + process(Array(draft.items.prefix(5)))
    }

    static func buildTimeline(_ draft: SlideDraft) -> [SlideElement] {
        heading(draft.title) + timeline(Array(draft.items.prefix(6)))
    }

    static func buildBigNumber(_ draft: SlideDraft) -> [SlideElement] {
        var elements = heading(draft.title) + [
            text(draft.value, margin, 170, 440, 240, fitSize(draft.value, 440, 240, 120, 48, bold: true), bold: true, anchor: .middle, color: "accent", font: "heading"),
            SlideElement(kind: .shape, x: 528, y: 200, width: 4, height: 180, shape: .rect, fill: "surface"),
        ]
        let explanation = draft.subtitle.isBlank ? draft.bullets.joined(separator: "\n") : draft.subtitle
        if !explanation.isBlank {
            elements.append(text(explanation, 560, 170, 336, 240, fitSize(explanation, 336, 240, 28, 16), anchor: .middle))
        }
        return elements
    }

    static func buildChart(_ draft: SlideDraft) -> [SlideElement] {
        heading(draft.title) + chart(draft.chart ?? ChartDraft(), caption: draft.subtitle)
    }

    static func buildTable(_ draft: SlideDraft) -> [SlideElement] {
        heading(draft.title) + table(draft.table)
    }

    static func buildQuote(_ draft: SlideDraft) -> [SlideElement] {
        let quote = draft.quote.isBlank ? draft.title : draft.quote
        var elements = [
            text("\u{201E}", 80, 40, 120, 150, 130, bold: true, color: "accent", font: "heading"),
            text(quote, 150, 140, 680, 240, fitSize(quote, 680, 240, 36, 22, italic: true), italic: true, anchor: .middle),
        ]
        if !draft.attribution.isBlank {
            elements.append(text("\u{2013} \(draft.attribution)", 150, 390, 680, 40, 20, align: .right, color: "muted"))
        }
        return elements
    }
}
