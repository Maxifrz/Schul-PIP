import UIKit

/// The diagrams of distributions, correlations and profiles.
extension ChartDrawing {
    struct ScatterPoint {
        var x: Double
        var y: Double
        var size: Double
        var label: String
    }

    /// `x; y` (scatter) or `x; y; Größe; Name` (bubbles) per line, with an optional header naming the axes.
    static func scatterPoints(_ text: String, bubbles: Bool) -> (points: [ScatterPoint], xName: String, yName: String) {
        let rows = ChartParse.rows(text)
        var xName = ""
        var yName = ""
        var body = rows
        if let first = rows.first, first.count >= 2, ChartParse.number(first[0]) == nil || ChartParse.number(first[1]) == nil {
            xName = first[0]
            yName = first[1]
            body = Array(rows.dropFirst())
        }
        var points: [ScatterPoint] = []
        for row in body where row.count >= 2 {
            guard let x = ChartParse.number(row[0]), let y = ChartParse.number(row[1]) else { continue }
            var size = 1.0
            var label = ""
            if bubbles {
                if row.count > 2, let value = ChartParse.number(row[2]), value > 0 { size = value }
                if row.count > 3 { label = row[3] }
            } else if row.count > 2, ChartParse.number(row[2]) == nil {
                label = row[2]
            }
            points.append(ScatterPoint(x: x, y: y, size: size, label: label))
        }
        return (points, xName, yName)
    }

    static func drawScatter(_ spec: ChartSpec, _ area: CGRect, _ style: Style, bubbles: Bool) {
        let parsed = scatterPoints(spec.data, bubbles: bubbles)
        let points = parsed.points
        guard points.count >= 1, let minX = points.map({ $0.x }).min(), let maxX = points.map({ $0.x }).max(),
              let minY = points.map({ $0.y }).min(), let maxY = points.map({ $0.y }).max()
        else { return placeholder(area, style) }
        let xTicks = ChartGeometry.niceTicks(min: minX, max: maxX, target: 6)
        let yTicks = ChartGeometry.niceTicks(min: minY, max: maxY, target: 5)
        let axis = drawCartesian(area: area, style: style, x: xTicks, y: yTicks, xTitle: parsed.xName, yTitle: parsed.yName)
        let context = UIGraphicsGetCurrentContext()
        context?.saveGState()
        UIBezierPath(rect: axis.plot.insetBy(dx: -style.base, dy: -style.base)).addClip()
        if bubbles {
            let maxSize = points.map { $0.size }.max() ?? 1
            let maxRadius = min(axis.plot.width, axis.plot.height) / 8
            for point in points.sorted(by: { $0.size > $1.size }) {
                let radius = max(style.base * 0.5, maxRadius * CGFloat(sqrt(point.size / maxSize)))
                let center = CGPoint(x: axis.x(point.x), y: axis.y(point.y))
                let oval = UIBezierPath(ovalIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
                fill(oval, style.accent, alpha: 0.5)
                stroke(oval, style.accent, width: 1.6, alpha: 0.95)
                if !point.label.isEmpty {
                    let font = style.font(style.base * 0.85, bold: true)
                    if measure(point.label, font).width <= radius * 1.7 {
                        drawText(point.label, at: center, font: font, color: style.text)
                    } else {
                        drawText(point.label, at: CGPoint(x: center.x + radius + 3, y: center.y), ax: 0, font: font, color: style.text)
                    }
                }
            }
        } else {
            if let fit = ChartGeometry.regression(points.map { (x: $0.x, y: $0.y) }) {
                let a = CGPoint(x: axis.x(minX), y: axis.y(fit.slope * minX + fit.intercept))
                let b = CGPoint(x: axis.x(maxX), y: axis.y(fit.slope * maxX + fit.intercept))
                line(from: a, to: b, color: style.text, width: max(1.5, style.base * 0.14), alpha: 0.55)
                if spec.showValues {
                    drawText("r = " + number((fit.r * 100).rounded() / 100), at: CGPoint(x: axis.plot.maxX - 4, y: axis.plot.minY + 4), ax: 1, ay: 0, font: style.font(style.base * 0.95, bold: true), color: style.muted)
                }
            }
            for point in points {
                let center = CGPoint(x: axis.x(point.x), y: axis.y(point.y))
                let radius = style.base * 0.36
                let oval = UIBezierPath(ovalIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
                fill(oval, style.accent, alpha: 0.9)
                stroke(oval, style.background, width: 1)
                if !point.label.isEmpty {
                    drawText(point.label, at: CGPoint(x: center.x + radius + 3, y: center.y), ax: 0, font: style.font(style.base * 0.8), color: style.muted)
                }
            }
        }
        context?.restoreGState()
    }

    static func drawHistogram(_ spec: ChartSpec, _ area: CGRect, _ style: Style) {
        let values = ChartParse.numbers(spec.data)
        guard values.count >= 2 else { return placeholder(area, style) }
        let result = ChartGeometry.histogram(values)
        guard result.edges.count >= 2, let maxCount = result.counts.max(), let first = result.edges.first, let last = result.edges.last else { return placeholder(area, style) }
        let yTicks = ChartGeometry.niceTicks(min: 0, max: Double(maxCount), target: 4)
        // A label on every second edge when the classes are narrow.
        let step = result.edges.count > 12 ? 2 : 1
        let shown = result.edges.enumerated().filter { $0.offset % step == 0 }.map { $0.element }
        let axis = drawCartesian(area: area, style: style, x: (shown, first, last), y: yTicks, xTitle: spec.unit, yTitle: "Anzahl")
        for (index, count) in result.counts.enumerated() {
            let left = axis.x(result.edges[index]) + 1
            let right = axis.x(result.edges[index + 1]) - 1
            let top = axis.y(Double(count))
            let rect = CGRect(x: left, y: top, width: max(right - left, 1), height: max(axis.y(0) - top, count > 0 ? 1 : 0))
            fill(UIBezierPath(roundedRect: rect, byRoundingCorners: [.topLeft, .topRight], cornerRadii: CGSize(width: 2, height: 2)), style.accent)
            if spec.showValues, count > 0, rect.width > style.base * 1.3 {
                drawText(String(count), at: CGPoint(x: rect.midX, y: rect.minY - 2), ay: 1, font: style.font(style.base * 0.85, bold: true), color: style.text)
            }
        }
    }

    static func drawBoxes(_ spec: ChartSpec, _ area: CGRect, _ style: Style, violin: Bool) {
        let groups = ChartParse.groups(spec.data).filter { $0.values.count >= 2 }
        let all = groups.flatMap { $0.values }
        guard !groups.isEmpty, let low = all.min(), let high = all.max() else { return placeholder(area, style) }
        let padding = (high - low) * (violin ? 0.08 : 0.04)
        let ticks = ChartGeometry.niceTicks(min: low - padding, max: high + padding, target: 5)
        let axis = drawCartesian(area: area, style: style, x: ([], 0, 1), y: ticks, yTitle: spec.unit)
        let slot = axis.plot.width / CGFloat(groups.count)
        let boxWidth = min(slot * 0.5, style.base * 6)
        let font = style.font(style.base * 0.9)
        for (index, group) in groups.enumerated() {
            let center = axis.plot.minX + slot * (CGFloat(index) + 0.5)
            let color = style.color(index)
            drawText(group.name, at: CGPoint(x: center, y: axis.plot.maxY + 5), ay: 0, font: font, color: style.text, maxWidth: slot - 2)
            guard let stats = ChartGeometry.boxStats(group.values) else { continue }
            if violin {
                let curve = ChartGeometry.density(group.values, lower: max(ticks.lower, (group.values.min() ?? low) - padding), upper: min(ticks.upper, (group.values.max() ?? high) + padding))
                let peak = curve.map { $0.y }.max() ?? 1
                guard peak > 0, curve.count > 2 else { continue }
                let half = min(slot * 0.42, style.base * 5)
                let shape = UIBezierPath()
                for (step, sample) in curve.enumerated() {
                    let point = CGPoint(x: center + CGFloat(sample.y / peak) * half, y: axis.y(sample.x))
                    if step == 0 { shape.move(to: point) } else { shape.addLine(to: point) }
                }
                for sample in curve.reversed() {
                    shape.addLine(to: CGPoint(x: center - CGFloat(sample.y / peak) * half, y: axis.y(sample.x)))
                }
                shape.close()
                fill(shape, color, alpha: 0.42)
                stroke(shape, color, width: 1.6)
                let inner = CGRect(x: center - style.base * 0.17, y: axis.y(stats.q3), width: style.base * 0.34, height: max(axis.y(stats.q1) - axis.y(stats.q3), 1))
                fill(UIBezierPath(roundedRect: inner, cornerRadius: style.base * 0.1), style.text, alpha: 0.85)
                let dot = CGRect(x: center - style.base * 0.26, y: axis.y(stats.median) - style.base * 0.26, width: style.base * 0.52, height: style.base * 0.52)
                fill(UIBezierPath(ovalIn: dot), style.background)
            } else {
                line(from: CGPoint(x: center, y: axis.y(stats.lowWhisker)), to: CGPoint(x: center, y: axis.y(stats.q1)), color: color, width: 1.8)
                line(from: CGPoint(x: center, y: axis.y(stats.q3)), to: CGPoint(x: center, y: axis.y(stats.highWhisker)), color: color, width: 1.8)
                for whisker in [stats.lowWhisker, stats.highWhisker] {
                    line(from: CGPoint(x: center - boxWidth * 0.25, y: axis.y(whisker)), to: CGPoint(x: center + boxWidth * 0.25, y: axis.y(whisker)), color: color, width: 1.8)
                }
                let box = CGRect(x: center - boxWidth / 2, y: axis.y(stats.q3), width: boxWidth, height: max(axis.y(stats.q1) - axis.y(stats.q3), 1))
                fill(UIBezierPath(roundedRect: box, cornerRadius: 2), color, alpha: 0.35)
                stroke(UIBezierPath(roundedRect: box, cornerRadius: 2), color, width: 1.8)
                line(from: CGPoint(x: box.minX, y: axis.y(stats.median)), to: CGPoint(x: box.maxX, y: axis.y(stats.median)), color: style.text, width: 2.6)
                for outlier in stats.outliers {
                    let dot = CGRect(x: center - style.base * 0.22, y: axis.y(outlier) - style.base * 0.22, width: style.base * 0.44, height: style.base * 0.44)
                    stroke(UIBezierPath(ovalIn: dot), color, width: 1.5)
                }
                if spec.showValues {
                    drawText(number(stats.median, unit: spec.unit), at: CGPoint(x: box.maxX + 4, y: axis.y(stats.median)), ax: 0, font: style.font(style.base * 0.8), color: style.muted)
                }
            }
        }
    }

    static func drawRadar(_ spec: ChartSpec, _ area: CGRect, _ style: Style) {
        let table = ChartParse.table(spec.data)
        guard table.labels.count >= 3, let peak = table.allValues.max(), peak > 0 else {
            return placeholder(area, style, "Mindestens drei Achsen mit Werten")
        }
        var top: CGFloat = 0
        if table.seriesCount > 1 {
            top = drawLegend(table.seriesNames.enumerated().map { (name: $0.element, color: style.color($0.offset)) }, in: area, style: style) + style.base * 0.3
        }
        let upper = ChartGeometry.niceTicks(min: 0, max: peak, target: 4).upper
        let font = style.font(style.base * 0.95)
        let labelWidth = min(area.width * 0.24, (table.labels.map { measure($0, font).width }.max() ?? 0) + 6)
        let room = CGRect(x: area.minX, y: area.minY + top, width: area.width, height: area.height - top)
        let radius = max(10, min(room.width / 2 - labelWidth - 4, room.height / 2 - style.base * 1.3))
        let center = CGPoint(x: room.midX, y: room.midY)
        let count = table.labels.count
        func corner(_ index: Int, _ fraction: CGFloat) -> CGPoint {
            let angle = -CGFloat.pi / 2 + 2 * .pi * CGFloat(index) / CGFloat(count)
            return CGPoint(x: center.x + cos(angle) * radius * fraction, y: center.y + sin(angle) * radius * fraction)
        }
        for ring in 1...4 {
            let outline = UIBezierPath()
            for index in 0..<count {
                let point = corner(index, CGFloat(ring) / 4)
                if index == 0 { outline.move(to: point) } else { outline.addLine(to: point) }
            }
            outline.close()
            stroke(outline, style.muted, width: 0.9, alpha: ring == 4 ? 0.55 : 0.25)
        }
        drawText(number(upper, unit: spec.unit), at: CGPoint(x: center.x + 4, y: center.y - radius), ax: 0, ay: 1, font: style.font(style.base * 0.8), color: style.muted)
        for index in 0..<count {
            line(from: center, to: corner(index, 1), color: style.muted, width: 0.9, alpha: 0.3)
            let angle = -CGFloat.pi / 2 + 2 * .pi * CGFloat(index) / CGFloat(count)
            let place = corner(index, 1 + style.base * 0.7 / radius)
            let ax: CGFloat = cos(angle) > 0.3 ? 0 : (cos(angle) < -0.3 ? 1 : 0.5)
            let ay: CGFloat = sin(angle) > 0.3 ? 0 : (sin(angle) < -0.3 ? 1 : 0.5)
            drawText(table.labels[index], at: place, ax: ax, ay: ay, font: font, color: style.text, maxWidth: labelWidth)
        }
        for k in 0..<table.seriesCount {
            let color = style.color(k)
            let shape = UIBezierPath()
            var markers: [CGPoint] = []
            for index in 0..<count {
                let value = table.values[index][k] ?? 0
                let point = corner(index, CGFloat(min(max(value / upper, 0), 1)))
                markers.append(point)
                if index == 0 { shape.move(to: point) } else { shape.addLine(to: point) }
            }
            shape.close()
            fill(shape, color, alpha: 0.2)
            stroke(shape, color, width: max(2, style.base * 0.18))
            for point in markers {
                let dot = CGRect(x: point.x - style.base * 0.24, y: point.y - style.base * 0.24, width: style.base * 0.48, height: style.base * 0.48)
                fill(UIBezierPath(ovalIn: dot), color)
            }
        }
    }

    static func drawHeatmap(_ spec: ChartSpec, _ area: CGRect, _ style: Style) {
        let table = ChartParse.table(spec.data)
        let values = table.allValues
        guard !table.isEmpty, let low = values.min(), let high = values.max() else { return placeholder(area, style) }
        let rows = table.labels.count
        let columns = table.seriesCount
        let font = style.font(style.base * 0.9)
        let labelWidth = min(area.width * 0.26, (table.labels.map { measure($0, font).width }.max() ?? 0) + 8)
        let header = style.base * 1.7
        let legendRoom = style.base * 4
        let grid = CGRect(x: area.minX + labelWidth, y: area.minY + header, width: max(10, area.width - labelWidth - legendRoom), height: max(10, area.height - header))
        let cellWidth = grid.width / CGFloat(columns)
        let cellHeight = grid.height / CGFloat(rows)
        let lowColor = blend(style.surface, style.accent, 0.12)
        let highColor = blend(style.accent, style.text, 0.3)
        func color(_ value: Double) -> UIColor {
            let t = high > low ? CGFloat((value - low) / (high - low)) : 1
            return blend(lowColor, highColor, t)
        }
        for column in 0..<columns {
            drawText(table.seriesNames[column], at: CGPoint(x: grid.minX + cellWidth * (CGFloat(column) + 0.5), y: grid.minY - 4), ay: 1, font: font, color: style.text, maxWidth: cellWidth - 2)
        }
        for row in 0..<rows {
            drawText(table.labels[row], at: CGPoint(x: grid.minX - 6, y: grid.minY + cellHeight * (CGFloat(row) + 0.5)), ax: 1, font: font, color: style.text, maxWidth: labelWidth - 6)
            for column in 0..<columns {
                let rect = CGRect(x: grid.minX + cellWidth * CGFloat(column), y: grid.minY + cellHeight * CGFloat(row), width: cellWidth, height: cellHeight).insetBy(dx: 1.5, dy: 1.5)
                guard let value = table.values[row][column] else {
                    fill(UIBezierPath(roundedRect: rect, cornerRadius: 3), style.surface, alpha: 0.5)
                    continue
                }
                let shade = color(value)
                fill(UIBezierPath(roundedRect: rect, cornerRadius: 3), shade)
                if spec.showValues, cellHeight >= style.base * 1.3, cellWidth >= style.base * 2 {
                    drawText(number(value), at: CGPoint(x: rect.midX, y: rect.midY), font: style.font(min(style.base, cellHeight * 0.5), bold: true), color: contrast(shade), maxWidth: rect.width)
                }
            }
        }
        // The scale: dark on top
        let barX = grid.maxX + style.base * 0.8
        let barWidth = style.base * 0.8
        let barTop = grid.minY
        let barHeight = min(grid.height, style.base * 9)
        let steps = 24
        for step in 0..<steps {
            let t = Double(steps - 1 - step) / Double(steps - 1)
            let slice = CGRect(x: barX, y: barTop + barHeight * CGFloat(step) / CGFloat(steps), width: barWidth, height: barHeight / CGFloat(steps) + 0.5)
            fill(UIBezierPath(rect: slice), color(low + (high - low) * t))
        }
        drawText(number(high), at: CGPoint(x: barX + barWidth + 4, y: barTop), ax: 0, ay: 0, font: style.font(style.base * 0.8), color: style.muted)
        drawText(number(low), at: CGPoint(x: barX + barWidth + 4, y: barTop + barHeight), ax: 0, ay: 1, font: style.font(style.base * 0.8), color: style.muted)
    }
}
