import Foundation

// The drawings of the ten components added after the first fifteen. Each takes valid parameters (see
// `SlideComponent.resolvedParams`) and content that passed the component's contract, and sizes every text for the theme.
extension LayoutKit {
    // MARK: Statistik-Reihe

    static func buildStatRow(_ draft: SlideDraft, _ params: ComponentParams, _ theme: SlideTheme) -> [SlideElement] {
        let m = Metrics(params)
        let items = Array(draft.items.prefix(4))
        let cards = params["style"] != "plain"
        let width = (contentWidth - m.gap * Double(items.count - 1)) / Double(items.count)
        var out = heading(draft.title, theme: theme)
        for (index, item) in items.enumerated() {
            let x = margin + Double(index) * (width + m.gap)
            if cards {
                out.append(SlideElement(kind: .shape, x: x, y: 170, width: width, height: 290, shape: .rounded, fill: "surface"))
            } else if index > 0 {
                out.append(SlideElement(kind: .shape, x: x - m.gap / 2 - 1, y: 190, width: 2, height: 250, shape: .rect, fill: "surface"))
            }
            out.append(fitted(item.title, x + m.pad, 196, width - 2 * m.pad, 120, max: 72, min: 24, theme: theme, heading: true, bold: true, align: .center, anchor: .middle, color: "accent"))
            out.append(SlideElement(kind: .shape, x: x + width / 2 - 24, y: 330, width: 48, height: 5, shape: .rect, fill: "accent"))
            if !item.text.isBlank {
                out.append(fitted(item.text, x + m.pad, 350, width - 2 * m.pad, 96, max: 22, min: 12, theme: theme, align: .center))
            }
        }
        return out
    }

    // MARK: Vergleich

    static func buildComparison(_ draft: SlideDraft, _ params: ComponentParams, _ theme: SlideTheme) -> [SlideElement] {
        let m = Metrics(params)
        let gap = m.gap + 8
        let width = (contentWidth - gap) / 2
        let emphasis = params["emphasis"] ?? "none"
        var out = heading(draft.title, theme: theme)
        let sides: [(title: String, lines: [String], fill: String)] = [
            (draft.leftTitle.isBlank ? "A" : draft.leftTitle, draft.left, emphasis == "right" ? "muted" : "accent"),
            (draft.rightTitle.isBlank ? "B" : draft.rightTitle, draft.right, emphasis == "left" ? "muted" : "accent"),
        ]
        for (index, side) in sides.enumerated() {
            let x = margin + Double(index) * (width + gap)
            out.append(SlideElement(kind: .shape, x: x, y: 204, width: width, height: 286, shape: .rect, fill: "surface"))
            out.append(SlideElement(kind: .shape, x: x, y: 150, width: width, height: 54, shape: .rect, fill: side.fill))
            out.append(fitted(side.title, x + 16, 150, width - 32, 54, max: 24, min: 14, theme: theme, bold: true, anchor: .middle, color: "background"))
            out.append(fitted(side.lines.joined(separator: "\n"), x + m.pad, 204 + m.pad, width - 2 * m.pad, 286 - 2 * m.pad, max: 24, min: 13, theme: theme, bullets: true))
        }
        if emphasis == "none" && m.gap > 16 {
            let x = margin + width + gap / 2 - 22
            out.append(SlideElement(kind: .shape, x: x, y: 165, width: 44, height: 44, shape: .ellipse, fill: "text"))
            out.append(fitted("VS", x, 165, 44, 44, max: 16, min: 10, theme: theme, bold: true, align: .center, anchor: .middle, color: "background"))
        }
        return out
    }

    // MARK: 2x2-Matrix

    static func buildMatrix(_ draft: SlideDraft, _ params: ComponentParams, _ theme: SlideTheme) -> [SlideElement] {
        let m = Metrics(params)
        let gap = m.gap / 2 + 8
        let captions = !draft.leftTitle.isBlank || !draft.rightTitle.isBlank
        let bottom: Double = captions ? 464 : 490
        let width = (contentWidth - gap) / 2
        let height = (bottom - 150 - gap) / 2
        let outlined = params["style"] == "outlined"
        var out = heading(draft.title, theme: theme)
        for (index, item) in draft.items.prefix(4).enumerated() {
            let x = margin + Double(index % 2) * (width + gap)
            let y: Double = 150 + Double(index / 2) * (height + gap)
            out.append(SlideElement(
                kind: .shape, x: x, y: y, width: width, height: height, shape: .rounded, fill: outlined ? "none" : "surface",
                stroke: outlined ? "accent" : "none", strokeWidth: outlined ? 2 : 0
            ))
            out.append(fitted(item.title, x + 20, y + 12, width - 40, 40, max: 24, min: 14, theme: theme, bold: true, anchor: .middle, color: "accent"))
            if !item.text.isBlank {
                out.append(fitted(item.text, x + 20, y + 56, width - 40, height - 68, max: 20, min: 12, theme: theme))
            }
        }
        if captions {
            if !draft.leftTitle.isBlank {
                out.append(fitted("↔ " + draft.leftTitle, margin, 470, 400, 24, max: 16, min: 11, theme: theme, color: "muted"))
            }
            if !draft.rightTitle.isBlank {
                out.append(fitted("↕ " + draft.rightTitle, margin + contentWidth - 400, 470, 400, 24, max: 16, min: 11, theme: theme, align: .right, color: "muted"))
            }
        }
        return out
    }

    // MARK: Definition

    static func buildDefinition(_ draft: SlideDraft, _ params: ComponentParams, _ theme: SlideTheme) -> [SlideElement] {
        let split = params["style"] == "split"
        let compact = Metrics(params).gap < 32
        let explanationSize: Double = compact ? 24 : 28
        let example = draft.bullets.joined(separator: "\n")
        let hasExample = !example.isBlank
        var out = heading(draft.title, theme: theme)
        if split {
            out.append(SlideElement(kind: .shape, x: margin, y: 150, width: 300, height: 340, shape: .rounded, fill: "accent"))
            out.append(fitted(draft.value, margin + 20, 170, 260, 300, max: 44, min: 20, theme: theme, heading: true, bold: true, anchor: .middle, color: "background"))
            let explanationHeight: Double = hasExample ? 190 : 340
            out.append(fitted(draft.subtitle, 396, 150, 500, explanationHeight, max: explanationSize - 2, min: 15, theme: theme, anchor: hasExample ? .top : .middle))
            if hasExample { out += examplePanel(example, bullets: draft.bullets.count > 1, x: 396, y: 356, width: 500, height: 134, theme: theme) }
        } else {
            out.append(fitted(draft.value, margin, 150, contentWidth, 70, max: 54, min: 28, theme: theme, heading: true, bold: true, anchor: .bottom, color: "accent"))
            out.append(SlideElement(kind: .shape, x: margin, y: 228, width: 56, height: 5, shape: .rect, fill: "accent"))
            out.append(fitted(draft.subtitle, margin, 246, contentWidth, hasExample ? 124 : 240, max: explanationSize, min: 16, theme: theme))
            if hasExample { out += examplePanel(example, bullets: draft.bullets.count > 1, x: margin, y: 384, width: contentWidth, height: 106, theme: theme) }
        }
        return out
    }

    private static func examplePanel(_ example: String, bullets: Bool, x: Double, y: Double, width: Double, height: Double, theme: SlideTheme) -> [SlideElement] {
        [
            SlideElement(kind: .shape, x: x, y: y, width: width, height: height, shape: .rounded, fill: "surface"),
            fitted("Beispiel", x + 24, y + 10, 300, 22, max: 15, min: 11, theme: theme, bold: true, color: "accent"),
            fitted(example, x + 24, y + 36, width - 48, height - 46, max: 20, min: 12, theme: theme, bullets: bullets),
        ]
    }

    // MARK: Agenda

    static func buildAgenda(_ draft: SlideDraft, _ params: ComponentParams, _ theme: SlideTheme) -> [SlideElement] {
        let items = Array(draft.items.prefix(7))
        let rowHeight = min(Metrics(params).gap < 32 ? 52 : 64, 340 / Double(items.count))
        let numerals = params["numbering"] == "numeral"
        let badge = min(40, rowHeight - 10)
        var out = heading(draft.title, theme: theme)
        for (index, item) in items.enumerated() {
            let y = 150 + Double(index) * rowHeight
            let label = numerals ? String(format: "%02d", index + 1) : "\(index + 1)"
            if numerals {
                out.append(fitted(label, margin, y, 64, rowHeight, max: 32, min: 14, theme: theme, heading: true, bold: true, anchor: .middle, color: "accent"))
            } else {
                out += numberBadge(label, margin + 4, y + (rowHeight - badge) / 2, size: badge, theme: theme)
            }
            let hasText = !item.text.isBlank
            out.append(fitted(item.title, 140, y, hasText ? 470 : 756, rowHeight, max: 26, min: 13, theme: theme, bold: true, anchor: .middle))
            if hasText {
                out.append(fitted(item.text, 630, y, 266, rowHeight, max: 18, min: 11, theme: theme, anchor: .middle, color: "muted"))
            }
            if index < items.count - 1 {
                out.append(SlideElement(kind: .shape, x: margin, y: y + rowHeight - 1, width: contentWidth, height: 2, shape: .rect, fill: "surface"))
            }
        }
        return out
    }

    // MARK: Kernaussagen-Checkliste

    static func buildChecklist(_ draft: SlideDraft, _ params: ComponentParams, _ theme: SlideTheme) -> [SlideElement] {
        let lines = Array(draft.bullets.prefix(6))
        let rowHeight = min(Metrics(params).gap < 32 ? 56 : 72, 340 / Double(lines.count))
        let square = params["marker"] == "square"
        var out = heading(draft.title, theme: theme)
        for (index, line) in lines.enumerated() {
            let y = 150 + Double(index) * rowHeight
            let marker = y + (rowHeight - 36) / 2
            if square {
                out.append(SlideElement(kind: .shape, x: margin + 2, y: marker, width: 36, height: 36, shape: .rounded, fill: "none", stroke: "accent", strokeWidth: 3))
            } else {
                out.append(SlideElement(kind: .shape, x: margin + 2, y: marker, width: 36, height: 36, shape: .ellipse, fill: "accent"))
                out.append(fitted("✓", margin + 2, marker, 36, 36, max: 22, min: 12, theme: theme, bold: true, align: .center, anchor: .middle, color: "background"))
            }
            out.append(fitted(line, 116, y, 780, rowHeight, max: 26, min: 13, theme: theme, anchor: .middle))
        }
        return out
    }

    // MARK: Zitat mit Bild

    static func buildQuoteImage(_ draft: SlideDraft, _ params: ComponentParams, _ image: PlacedImage?, _ theme: SlideTheme) -> [SlideElement] {
        let right = params["side"] == "right"
        let imageX = right ? margin + contentWidth - 320 : margin
        let textX: Double = right ? margin : 424
        var out = draft.title.isBlank ? [] : heading(draft.title, theme: theme)
        out.append(picture(image, imageX, 150, 320, 340))
        out.append(fitted("\u{201E}", textX, 140, 100, 110, max: 96, min: 60, theme: theme, heading: true, bold: true, color: "accent"))
        out.append(fitted(draft.quote, textX, 210, 472, 200, max: Metrics(params).gap < 32 ? 26 : 32, min: 15, theme: theme, italic: true, anchor: .middle))
        if !draft.attribution.isBlank {
            out.append(fitted("\u{2013} " + draft.attribution, textX, 424, 472, 40, max: 20, min: 11, theme: theme, color: "muted"))
        }
        return out
    }

    // MARK: Icon-Raster

    static func buildIconGrid(_ draft: SlideDraft, _ params: ComponentParams, _ theme: SlideTheme) -> [SlideElement] {
        let m = Metrics(params)
        let items = Array(draft.items.prefix(6))
        let columns = items.count == 4 ? 2 : 3
        let rows = (items.count + columns - 1) / columns
        let gap = m.gap - 8
        let width = (contentWidth - gap * Double(columns - 1)) / Double(columns)
        let height = (340 - gap * Double(rows - 1)) / Double(rows)
        let cards = params["style"] != "plain"
        var out = heading(draft.title, theme: theme)
        for (index, item) in items.enumerated() {
            let x = margin + Double(index % columns) * (width + gap)
            let y = 150 + Double(index / columns) * (height + gap)
            if cards { out.append(SlideElement(kind: .shape, x: x, y: y, width: width, height: height, shape: .rounded, fill: "surface")) }
            if let icon = icon(item.icon) {
                out.append(text(icon, x + 16, y + 10, 70, 46, 34, font: "body"))
            } else {
                out += numberBadge("\(index + 1)", x + 16, y + 12, size: 40, theme: theme)
            }
            out.append(fitted(item.title, x + 16, y + 58, width - 32, 34, max: 20, min: 13, theme: theme, bold: true))
            if !item.text.isBlank {
                out.append(fitted(item.text, x + 16, y + 94, width - 32, height - 104, max: 16, min: 11, theme: theme, color: "muted"))
            }
        }
        return out
    }

    // MARK: Treppe und Schichten

    static func buildStaircase(_ draft: SlideDraft, _ params: ComponentParams, _ theme: SlideTheme) -> [SlideElement] {
        let m = Metrics(params)
        let items = Array(draft.items.prefix(5))
        let count = Double(items.count)
        let layers = params["form"] == "layers"
        let gap = m.gap / 2 + 2
        var out = heading(draft.title, theme: theme)
        if layers {
            let rowHeight = (340 - gap * (count - 1)) / count
            for (index, item) in items.enumerated() {
                let top = index == items.count - 1
                let width = contentWidth * (0.52 + 0.48 * Double(index) / max(1, count - 1))
                let x = margin + (contentWidth - width) / 2
                let y = 150 + Double(index) * (rowHeight + gap)
                out.append(SlideElement(kind: .shape, x: x, y: y, width: width, height: rowHeight, shape: .rounded, fill: top ? "accent" : "surface"))
                out.append(fitted(item.title, x + 16, y, width / 2 - 24, rowHeight, max: 22, min: 12, theme: theme, bold: true, anchor: .middle, color: top ? "background" : "text"))
                if !item.text.isBlank {
                    out.append(fitted(item.text, x + width / 2, y, width / 2 - 16, rowHeight, max: 16, min: 11, theme: theme, anchor: .middle, color: top ? "background" : "muted"))
                }
            }
        } else {
            let width = (contentWidth - gap * (count - 1)) / count
            for (index, item) in items.enumerated() {
                let top = index == items.count - 1
                let height = 130 + Double(index) * (340 - 130) / max(1, count - 1)
                let x = margin + Double(index) * (width + gap)
                let y = 490 - height
                out.append(SlideElement(kind: .shape, x: x, y: y, width: width, height: height, shape: .rounded, fill: top ? "accent" : "surface"))
                out.append(fitted(item.title, x + 12, y + 10, width - 24, 48, max: 22, min: 12, theme: theme, bold: true, color: top ? "background" : "text"))
                if !item.text.isBlank {
                    out.append(fitted(item.text, x + 12, y + 60, width - 24, height - 72, max: 16, min: 11, theme: theme, color: top ? "background" : "muted"))
                }
            }
        }
        return out
    }

    // MARK: Vorher und Nachher

    static func buildBeforeAfter(_ draft: SlideDraft, _ params: ComponentParams, _ image: PlacedImage?, _ theme: SlideTheme) -> [SlideElement] {
        let m = Metrics(params)
        let gap = m.gap + 24
        let width = (contentWidth - gap) / 2
        let side = params["imageSide"] ?? "none"
        // A picture only where the bullets beside it stay short enough to fit under it.
        let showImage = image != nil && side != "none" && max(draft.left.count, draft.right.count) <= 2
        var out = heading(draft.title, theme: theme)
        let sides: [(title: String, lines: [String], fill: String, picture: Bool)] = [
            (draft.leftTitle.isBlank ? "Vorher" : draft.leftTitle, draft.left, "muted", showImage && side == "left"),
            (draft.rightTitle.isBlank ? "Nachher" : draft.rightTitle, draft.right, "accent", showImage && side == "right"),
        ]
        for (index, entry) in sides.enumerated() {
            let x = margin + Double(index) * (width + gap)
            out.append(fitted(entry.title, x, 148, width, 44, max: 28, min: 16, theme: theme, heading: true, bold: true, anchor: .bottom, color: index == 0 ? "muted" : "accent"))
            out.append(SlideElement(kind: .shape, x: x, y: 196, width: width, height: 3, shape: .rect, fill: entry.fill))
            out.append(SlideElement(kind: .shape, x: x, y: 206, width: width, height: 284, shape: .rounded, fill: "surface"))
            var top: Double = 206 + m.pad
            var room: Double = 284 - 2 * m.pad
            if entry.picture {
                out.append(picture(image, x + 12, 218, width - 24, 130))
                top = 358
                room = 490 - 12 - top
            }
            out.append(fitted(entry.lines.joined(separator: "\n"), x + m.pad, top, width - 2 * m.pad, room, max: 24, min: 13, theme: theme, bullets: true))
        }
        out.append(SlideElement(kind: .shape, x: margin + width + 4, y: 340, width: gap - 8, height: 20, shape: .arrow, fill: "accent", strokeWidth: 3))
        return out
    }
}
