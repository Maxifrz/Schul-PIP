import UIKit

/// Draws a diagram element with Core Graphics, in the deck's own colors and fonts. The editor, thumbnails, presenting
/// and the PDF export all draw through here, so what is edited is what is exported. Positions are slide points.
enum ChartDrawing {
    struct Style {
        let text: UIColor
        let muted: UIColor
        let surface: UIColor
        let background: UIColor
        let accent: UIColor
        let palette: [UIColor]
        let regular: String
        let bold: String
        /// The size of ordinary labels, from the size of the diagram.
        let base: CGFloat

        init(theme: SlideTheme, size: CGSize) {
            text = SlideDrawing.uiColor(theme.text)
            muted = SlideDrawing.uiColor(theme.muted)
            surface = SlideDrawing.uiColor(theme.surface)
            background = SlideDrawing.uiColor(theme.background)
            let accentColor = SlideDrawing.uiColor(theme.accent)
            accent = accentColor
            var colors = [accentColor]
            if theme.accent2 != nil { colors.append(SlideDrawing.uiColor(theme.secondAccent)) }
            let extra: [UInt32] = [0x3B6EA8, 0xC9974F, 0x9B5DA6, 0xC0503A, 0x3FA7A0, 0x8A8F3A, 0xD16A9A]
            colors.append(contentsOf: extra.map { SlideDrawing.uiColor($0) })
            palette = colors
            let probe = SlideElement(kind: .text, x: 0, y: 0, width: 1, height: 1, font: "body")
            regular = SlideDesign.fontName(probe, theme: theme)
            var boldProbe = probe
            boldProbe.bold = true
            bold = SlideDesign.fontName(boldProbe, theme: theme)
            base = min(max(min(size.width, size.height) / 21, 9), 20)
        }

        func font(_ size: CGFloat, bold isBold: Bool = false) -> UIFont {
            // Tiny or broken frames can ask for a size below zero; the font is never smaller than one point.
            let safe = size.isFinite ? max(size, 1) : 10
            return UIFont(name: isBold ? bold : regular, size: safe) ?? .systemFont(ofSize: safe, weight: isBold ? .semibold : .regular)
        }

        func color(_ index: Int) -> UIColor {
            palette[((index % palette.count) + palette.count) % palette.count]
        }
    }

    /// Draws the diagram into `rect`. Nothing is drawn outside it.
    static func draw(_ spec: ChartSpec, in rect: CGRect, theme: SlideTheme) {
        guard rect.width > 12, rect.height > 12 else { return }
        let style = Style(theme: theme, size: rect.size)
        var area = rect
        if !spec.title.isEmpty {
            let band = style.base * 2
            drawText(spec.title, at: CGPoint(x: rect.minX, y: rect.minY + band / 2), ax: 0, font: style.font(style.base * 1.15, bold: true), color: style.text, maxWidth: rect.width)
            area = CGRect(x: rect.minX, y: rect.minY + band, width: rect.width, height: rect.height - band)
        }
        switch spec.type {
        case .column: drawColumns(spec, area, style, horizontal: false)
        case .bar: drawColumns(spec, area, style, horizontal: true)
        case .line: drawLines(spec, area, style, filled: false)
        case .area: drawLines(spec, area, style, filled: true)
        case .pie: drawPie(spec, area, style, donut: false)
        case .donut: drawPie(spec, area, style, donut: true)
        case .scatter: drawScatter(spec, area, style, bubbles: false)
        case .bubble: drawScatter(spec, area, style, bubbles: true)
        case .histogram: drawHistogram(spec, area, style)
        case .boxplot: drawBoxes(spec, area, style, violin: false)
        case .violin: drawBoxes(spec, area, style, violin: true)
        case .radar: drawRadar(spec, area, style)
        case .heatmap: drawHeatmap(spec, area, style)
        case .sankey: drawFlow(spec, area, style, alluvial: false)
        case .alluvial: drawFlow(spec, area, style, alluvial: true)
        case .funnel: drawFunnel(spec, area, style)
        case .treemap: drawTreemap(spec, area, style)
        case .orgchart: drawOrgChart(spec, area, style)
        case .geo: drawGeo(spec, area, style)
        case .network: drawNetwork(spec, area, style)
        case .chord: drawChord(spec, area, style)
        case .wordcloud: drawWordCloud(spec, area, style)
        }
    }

    // MARK: Helpers

    static func measure(_ string: String, _ font: UIFont) -> CGSize {
        (string as NSString).size(withAttributes: [.font: font])
    }

    /// Text placed by an anchor: (0, 0) is its top left corner at `point`, (0.5, 0.5) its middle, (1, 1) its bottom right.
    static func drawText(_ string: String, at point: CGPoint, ax: CGFloat = 0.5, ay: CGFloat = 0.5, font: UIFont, color: UIColor, maxWidth: CGFloat? = nil) {
        guard !string.isEmpty else { return }
        let size = measure(string, font)
        if let maxWidth, size.width > maxWidth {
            let paragraph = NSMutableParagraphStyle()
            paragraph.lineBreakMode = .byTruncatingTail
            paragraph.alignment = ax < 0.25 ? .left : (ax > 0.75 ? .right : .center)
            let box = CGRect(x: point.x - maxWidth * ax, y: point.y - size.height * ay, width: maxWidth, height: size.height)
            (string as NSString).draw(in: box, withAttributes: [.font: font, .foregroundColor: color, .paragraphStyle: paragraph])
            return
        }
        (string as NSString).draw(
            at: CGPoint(x: point.x - size.width * ax, y: point.y - size.height * ay),
            withAttributes: [.font: font, .foregroundColor: color]
        )
    }

    /// Text wrapped into a box, in the largest size between `maxSize` and `minSize` that fits it.
    static func drawFitted(_ string: String, in box: CGRect, style: Style, maxSize: CGFloat, minSize: CGFloat, bold: Bool, color: UIColor) {
        guard !string.isEmpty, box.width > 4, box.height > 4 else { return }
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        paragraph.lineBreakMode = .byTruncatingTail
        var size = maxSize
        while size > minSize {
            let bounds = (string as NSString).boundingRect(
                with: CGSize(width: box.width, height: .greatestFiniteMagnitude),
                options: [.usesLineFragmentOrigin], attributes: [.font: style.font(size, bold: bold), .paragraphStyle: paragraph], context: nil
            )
            if bounds.height <= box.height { break }
            size -= 0.5
        }
        let attributes: [NSAttributedString.Key: Any] = [.font: style.font(size, bold: bold), .foregroundColor: color, .paragraphStyle: paragraph]
        let height = (string as NSString).boundingRect(
            with: CGSize(width: box.width, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], attributes: attributes, context: nil
        ).height
        let target = CGRect(x: box.minX, y: box.midY - min(height, box.height) / 2, width: box.width, height: min(height, box.height))
        (string as NSString).draw(with: target, options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], attributes: attributes, context: nil)
    }

    static func placeholder(_ rect: CGRect, _ style: Style, _ message: String = "Keine Daten") {
        drawText(message, at: CGPoint(x: rect.midX, y: rect.midY), font: style.font(style.base), color: style.muted, maxWidth: rect.width)
    }

    /// A number as text with its unit: 12, 12,5 %, 4 €.
    static func number(_ value: Double, unit: String = "") -> String {
        // Far beyond any school number: no overflow in the formatter, and no crash on a typo.
        guard value.isFinite, abs(value) < 1e15 else { return value.isFinite ? String(format: "%.2e", value) : "–" }
        let text = SlideLayouts.formatNumber(value)
        if unit.isEmpty { return text }
        return text + (unit.hasPrefix(" ") ? unit : " " + unit)
    }

    /// A color that reads on top of `color`.
    static func contrast(_ color: UIColor) -> UIColor {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        color.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        let luminance = 0.299 * red + 0.587 * green + 0.114 * blue
        return luminance > 0.62 ? UIColor(white: 0.1, alpha: 1) : .white
    }

    /// `t` of the way from `a` to `b`.
    static func blend(_ a: UIColor, _ b: UIColor, _ t: CGFloat) -> UIColor {
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        a.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        b.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        let k = min(max(t, 0), 1)
        return UIColor(red: r1 + (r2 - r1) * k, green: g1 + (g2 - g1) * k, blue: b1 + (b2 - b1) * k, alpha: 1)
    }

    static func fill(_ path: UIBezierPath, _ color: UIColor, alpha: CGFloat = 1) {
        color.withAlphaComponent(alpha).setFill()
        path.fill()
    }

    static func stroke(_ path: UIBezierPath, _ color: UIColor, width: CGFloat, alpha: CGFloat = 1) {
        color.withAlphaComponent(alpha).setStroke()
        path.lineWidth = width
        path.lineJoinStyle = .round
        path.lineCapStyle = .round
        path.stroke()
    }

    static func line(from a: CGPoint, to b: CGPoint, color: UIColor, width: CGFloat, alpha: CGFloat = 1) {
        let path = UIBezierPath()
        path.move(to: a)
        path.addLine(to: b)
        stroke(path, color, width: width, alpha: alpha)
    }

    /// A row of colored squares with names; returns the height it took.
    @discardableResult
    static func drawLegend(_ items: [(name: String, color: UIColor)], in rect: CGRect, style: Style) -> CGFloat {
        let font = style.font(style.base * 0.9)
        let swatch = style.base * 0.7
        var x = rect.minX
        for item in items {
            let width = measure(item.name, font).width
            if x + swatch + 4 + width > rect.maxX + 0.5, x > rect.minX { break }
            fill(UIBezierPath(roundedRect: CGRect(x: x, y: rect.minY + (style.base * 1.4 - swatch) / 2, width: swatch, height: swatch), cornerRadius: 2), item.color)
            drawText(item.name, at: CGPoint(x: x + swatch + 4, y: rect.minY + style.base * 0.7), ax: 0, font: font, color: style.text, maxWidth: max(20, rect.maxX - x - swatch - 4))
            x += swatch + 4 + width + style.base * 1.1
        }
        return style.base * 1.4
    }

    // MARK: Axes

    /// The frame of a chart with numeric axes: the grid, the tick labels and the axis names. Returns the plot area and
    /// the maps from values to points.
    struct Cartesian {
        var plot: CGRect
        var xLower: Double
        var xUpper: Double
        var yLower: Double
        var yUpper: Double

        func x(_ value: Double) -> CGFloat {
            plot.minX + CGFloat((value - xLower) / max(xUpper - xLower, 1e-9)) * plot.width
        }

        func y(_ value: Double) -> CGFloat {
            plot.maxY - CGFloat((value - yLower) / max(yUpper - yLower, 1e-9)) * plot.height
        }
    }

    static func drawCartesian(
        area: CGRect, style: Style, x xTicks: (ticks: [Double], lower: Double, upper: Double), y yTicks: (ticks: [Double], lower: Double, upper: Double),
        xTitle: String = "", yTitle: String = "", top: CGFloat = 0
    ) -> Cartesian {
        let font = style.font(style.base * 0.9)
        let yTexts = yTicks.ticks.map { number($0) }
        let yWidth = (yTexts.map { measure($0, font).width }.max() ?? 0) + 8
        let bottom = style.base * 1.5 + (xTitle.isEmpty ? 0 : style.base * 1.3)
        let head = top + (yTitle.isEmpty ? style.base * 0.6 : style.base * 1.6)
        let plot = CGRect(x: area.minX + yWidth, y: area.minY + head, width: max(10, area.width - yWidth - style.base), height: max(10, area.height - head - bottom))
        let frame = Cartesian(plot: plot, xLower: xTicks.lower, xUpper: xTicks.upper, yLower: yTicks.lower, yUpper: yTicks.upper)
        for (index, tick) in yTicks.ticks.enumerated() {
            let y = frame.y(tick)
            line(from: CGPoint(x: plot.minX, y: y), to: CGPoint(x: plot.maxX, y: y), color: style.muted, width: 0.8, alpha: tick == 0 ? 0.7 : 0.22)
            drawText(yTexts[index], at: CGPoint(x: plot.minX - 5, y: y), ax: 1, font: font, color: style.muted)
        }
        for tick in xTicks.ticks {
            let x = frame.x(tick)
            line(from: CGPoint(x: x, y: plot.maxY), to: CGPoint(x: x, y: plot.maxY + 4), color: style.muted, width: 0.8, alpha: 0.6)
            drawText(number(tick), at: CGPoint(x: x, y: plot.maxY + 5), ay: 0, font: font, color: style.muted)
        }
        if !xTitle.isEmpty {
            drawText(xTitle, at: CGPoint(x: plot.midX, y: area.maxY), ay: 1, font: style.font(style.base * 0.95, bold: true), color: style.text, maxWidth: plot.width)
        }
        if !yTitle.isEmpty {
            drawText(yTitle, at: CGPoint(x: area.minX, y: area.minY + top + style.base * 0.7), ax: 0, font: style.font(style.base * 0.95, bold: true), color: style.text, maxWidth: area.width)
        }
        return frame
    }

    // MARK: Columns, bars, lines

    static func drawColumns(_ spec: ChartSpec, _ area: CGRect, _ style: Style, horizontal: Bool) {
        let table = ChartParse.table(spec.data)
        let values = table.allValues
        guard !table.isEmpty, let low = values.min(), let high = values.max() else { return placeholder(area, style) }
        let series = table.seriesCount
        let count = table.labels.count
        let ticks = ChartGeometry.niceTicks(min: min(0, low), max: max(0, high), target: horizontal ? 4 : 5)
        var top: CGFloat = 0
        if series > 1 {
            top = drawLegend(table.seriesNames.enumerated().map { (name: $0.element, color: style.color($0.offset)) }, in: area, style: style) + style.base * 0.3
        }
        let font = style.font(style.base * 0.9)
        let valueFont = style.font(style.base * 0.85, bold: true)
        let showValues = spec.showValues && series * count <= 24
        if !horizontal {
            let axis = drawCartesian(area: area, style: style, x: ([], 0, 1), y: ticks, top: top)
            let slot = axis.plot.width / CGFloat(count)
            let group = slot * 0.74
            let barWidth = group / CGFloat(series)
            let zero = axis.y(0)
            for row in 0..<count {
                let left = axis.plot.minX + slot * CGFloat(row) + (slot - group) / 2
                for k in 0..<series {
                    guard let value = table.values[row][k] else { continue }
                    let y = axis.y(value)
                    let rect = CGRect(x: left + barWidth * CGFloat(k) + barWidth * 0.03, y: min(y, zero), width: barWidth * 0.94, height: max(abs(zero - y), 1))
                    fill(UIBezierPath(roundedRect: rect, byRoundingCorners: value >= 0 ? [.topLeft, .topRight] : [.bottomLeft, .bottomRight], cornerRadii: CGSize(width: 2, height: 2)), style.color(k))
                    if showValues, barWidth > style.base * 1.6 {
                        drawText(number(value, unit: spec.unit), at: CGPoint(x: rect.midX, y: value >= 0 ? rect.minY - 2 : rect.maxY + 2), ay: value >= 0 ? 1 : 0, font: valueFont, color: style.text, maxWidth: slot)
                    }
                }
                drawText(table.labels[row], at: CGPoint(x: axis.plot.minX + slot * (CGFloat(row) + 0.5), y: axis.plot.maxY + style.base * 0.4 + 4), ay: 0, font: font, color: style.text, maxWidth: slot - 2)
            }
        } else {
            let labelWidth = min(area.width * 0.3, (table.labels.map { measure($0, font).width }.max() ?? 0) + 8)
            let valueRoom = showValues ? style.base * 3.2 : style.base
            let plot = CGRect(x: area.minX + labelWidth, y: area.minY + top, width: max(10, area.width - labelWidth - valueRoom), height: max(10, area.height - top - style.base * 1.6))
            let axis = Cartesian(plot: plot, xLower: ticks.lower, xUpper: ticks.upper, yLower: 0, yUpper: 1)
            for tick in ticks.ticks {
                let x = axis.x(tick)
                line(from: CGPoint(x: x, y: plot.minY), to: CGPoint(x: x, y: plot.maxY), color: style.muted, width: 0.8, alpha: tick == 0 ? 0.7 : 0.22)
                drawText(number(tick), at: CGPoint(x: x, y: plot.maxY + 4), ay: 0, font: font, color: style.muted)
            }
            let slot = plot.height / CGFloat(count)
            let group = slot * 0.74
            let barHeight = group / CGFloat(series)
            let zero = axis.x(0)
            for row in 0..<count {
                let topEdge = plot.minY + slot * CGFloat(row) + (slot - group) / 2
                for k in 0..<series {
                    guard let value = table.values[row][k] else { continue }
                    let x = axis.x(value)
                    let rect = CGRect(x: min(x, zero), y: topEdge + barHeight * CGFloat(k) + barHeight * 0.03, width: max(abs(x - zero), 1), height: barHeight * 0.94)
                    fill(UIBezierPath(roundedRect: rect, cornerRadius: 2), style.color(k))
                    if showValues, barHeight > style.base * 1.1 {
                        drawText(number(value, unit: spec.unit), at: CGPoint(x: value >= 0 ? rect.maxX + 4 : rect.minX - 4, y: rect.midY), ax: value >= 0 ? 0 : 1, font: valueFont, color: style.text)
                    }
                }
                drawText(table.labels[row], at: CGPoint(x: plot.minX - 6, y: plot.minY + slot * (CGFloat(row) + 0.5)), ax: 1, font: font, color: style.text, maxWidth: labelWidth - 6)
            }
        }
    }

    static func drawLines(_ spec: ChartSpec, _ area: CGRect, _ style: Style, filled: Bool) {
        let table = ChartParse.table(spec.data)
        let values = table.allValues
        guard !table.isEmpty, let low = values.min(), let high = values.max() else { return placeholder(area, style) }
        let series = table.seriesCount
        let count = table.labels.count
        let ticks = ChartGeometry.niceTicks(min: filled ? min(0, low) : low - (high - low) * 0.05, max: max(high, filled ? 0 : high), target: 5)
        var top: CGFloat = 0
        if series > 1 {
            top = drawLegend(table.seriesNames.enumerated().map { (name: $0.element, color: style.color($0.offset)) }, in: area, style: style) + style.base * 0.3
        }
        let axis = drawCartesian(area: area, style: style, x: ([], 0, 1), y: ticks, top: top)
        let font = style.font(style.base * 0.9)
        let slot = axis.plot.width / CGFloat(count)
        func point(_ row: Int, _ value: Double) -> CGPoint {
            CGPoint(x: axis.plot.minX + slot * (CGFloat(row) + 0.5), y: axis.y(value))
        }
        for row in 0..<count {
            drawText(table.labels[row], at: CGPoint(x: point(row, 0).x, y: axis.plot.maxY + style.base * 0.4 + 4), ay: 0, font: font, color: style.text, maxWidth: slot - 2)
        }
        let baseline = axis.y(max(ticks.lower, min(0, ticks.upper)))
        for k in 0..<series {
            let color = style.color(k)
            var points: [CGPoint] = []
            for row in 0..<count {
                if let value = table.values[row][k] { points.append(point(row, value)) }
            }
            guard let first = points.first, let last = points.last else { continue }
            if filled, points.count > 1 {
                let region = UIBezierPath()
                region.move(to: CGPoint(x: first.x, y: baseline))
                points.forEach { region.addLine(to: $0) }
                region.addLine(to: CGPoint(x: last.x, y: baseline))
                region.close()
                fill(region, color, alpha: series > 1 ? 0.22 : 0.3)
            }
            let path = UIBezierPath()
            path.move(to: first)
            points.dropFirst().forEach { path.addLine(to: $0) }
            stroke(path, color, width: max(2, style.base * 0.2))
            if count <= 14 {
                for p in points {
                    let dot = CGRect(x: p.x - style.base * 0.3, y: p.y - style.base * 0.3, width: style.base * 0.6, height: style.base * 0.6)
                    fill(UIBezierPath(ovalIn: dot), style.background)
                    stroke(UIBezierPath(ovalIn: dot.insetBy(dx: 0.8, dy: 0.8)), color, width: max(1.6, style.base * 0.15))
                }
            }
            if spec.showValues, series == 1, count <= 12 {
                for row in 0..<count {
                    if let value = table.values[row][k] {
                        drawText(number(value, unit: spec.unit), at: CGPoint(x: point(row, value).x, y: point(row, value).y - style.base * 0.6), ay: 1, font: style.font(style.base * 0.85, bold: true), color: style.text, maxWidth: slot)
                    }
                }
            }
        }
    }

    // MARK: Pie and donut

    static func drawPie(_ spec: ChartSpec, _ area: CGRect, _ style: Style, donut: Bool) {
        let table = ChartParse.table(spec.data)
        var slices: [(name: String, value: Double)] = []
        for row in 0..<table.labels.count {
            if let value = table.values[row].first ?? nil, value > 0 { slices.append((table.labels[row], value)) }
        }
        let total = slices.reduce(0) { $0 + $1.value }
        guard total > 0 else { return placeholder(area, style) }
        let font = style.font(style.base)
        let legendRows = slices.count
        var legendWidth = min(area.width * 0.42, (slices.map { measure($0.name, font).width }.max() ?? 0) + style.base * 6)
        if area.width < area.height * 1.15 { legendWidth = 0 }
        let diameter = max(20, min(area.height - style.base, area.width - legendWidth - style.base))
        let gap = legendWidth > 0 ? style.base * 1.2 : 0
        let startX = area.minX + max(0, (area.width - diameter - gap - legendWidth) / 2)
        let center = CGPoint(x: startX + diameter / 2, y: area.midY)
        let radius = diameter / 2
        var angle = -CGFloat.pi / 2
        for (index, slice) in slices.enumerated() {
            let sweep = CGFloat(slice.value / total) * 2 * .pi
            let color = style.color(index)
            if donut {
                let thickness = radius * 0.4
                let path = UIBezierPath(arcCenter: center, radius: radius - thickness / 2, startAngle: angle, endAngle: angle + sweep, clockwise: true)
                path.lineWidth = thickness
                path.lineCapStyle = .butt
                color.setStroke()
                path.stroke()
                let edge = UIBezierPath()
                edge.move(to: CGPoint(x: center.x + cos(angle) * (radius - thickness), y: center.y + sin(angle) * (radius - thickness)))
                edge.addLine(to: CGPoint(x: center.x + cos(angle) * radius, y: center.y + sin(angle) * radius))
                stroke(edge, style.background, width: 2)
            } else {
                let wedge = UIBezierPath()
                wedge.move(to: center)
                wedge.addArc(withCenter: center, radius: radius, startAngle: angle, endAngle: angle + sweep, clockwise: true)
                wedge.close()
                fill(wedge, color)
                stroke(wedge, style.background, width: 2)
            }
            if spec.showValues, sweep > 0.32 {
                let mid = angle + sweep / 2
                let place = donut ? radius * 0.8 : radius * 0.66
                let percent = number((slice.value / total * 1000).rounded() / 10) + " %"
                drawText(percent, at: CGPoint(x: center.x + cos(mid) * place, y: center.y + sin(mid) * place), font: style.font(style.base * 0.9, bold: true), color: contrast(color))
            }
            angle += sweep
        }
        if donut {
            drawText(number(total, unit: spec.unit), at: CGPoint(x: center.x, y: center.y - style.base * 0.2), font: style.font(style.base * 1.6, bold: true), color: style.text, maxWidth: radius * 1.1)
            drawText("Gesamt", at: CGPoint(x: center.x, y: center.y + style.base * 1.05), font: style.font(style.base * 0.85), color: style.muted)
        }
        guard legendWidth > 0 else { return }
        let rowHeight = min(style.base * 1.9, (area.height - style.base) / CGFloat(legendRows))
        let legendFont = style.font(min(style.base, rowHeight * 0.62))
        var y = area.midY - rowHeight * CGFloat(legendRows) / 2
        let x = startX + diameter + gap
        for (index, slice) in slices.enumerated() {
            let swatch = min(style.base * 0.75, rowHeight * 0.6)
            fill(UIBezierPath(roundedRect: CGRect(x: x, y: y + (rowHeight - swatch) / 2, width: swatch, height: swatch), cornerRadius: 2), style.color(index))
            let percent = number((slice.value / total * 1000).rounded() / 10) + " %"
            drawText(slice.name, at: CGPoint(x: x + swatch + 6, y: y + rowHeight / 2), ax: 0, font: legendFont, color: style.text, maxWidth: legendWidth - swatch - 6 - measure(percent, legendFont).width - 6)
            drawText(percent, at: CGPoint(x: x + legendWidth, y: y + rowHeight / 2), ax: 1, font: legendFont, color: style.muted)
            y += rowHeight
        }
    }
}
