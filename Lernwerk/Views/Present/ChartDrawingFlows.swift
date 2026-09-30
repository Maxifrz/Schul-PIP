import UIKit

/// The diagrams of flows, hierarchies, places, networks and words.
extension ChartDrawing {
    // MARK: Sankey and alluvial

    static func drawFlow(_ spec: ChartSpec, _ area: CGRect, _ style: Style, alluvial: Bool) {
        let flows = ChartParse.flows(spec.data)
        guard !flows.isEmpty else { return placeholder(area, style) }

        // Alluvial names are "Stufe|Gruppe"; the stage decides the column, the group the color.
        func stage(_ name: String) -> String? {
            guard alluvial, let bar = name.firstIndex(of: "|") else { return nil }
            return String(name[..<bar]).trimmingCharacters(in: .whitespaces)
        }
        func category(_ name: String) -> String {
            guard alluvial, let bar = name.firstIndex(of: "|") else { return name }
            return String(name[name.index(after: bar)...]).trimmingCharacters(in: .whitespaces)
        }
        var stages: [String] = []
        var categories: [String] = []
        for flow in flows {
            for name in [flow.source, flow.target] {
                if let found = stage(name), !stages.contains(found) { stages.append(found) }
                if !categories.contains(category(name)) { categories.append(category(name)) }
            }
        }
        if stages.allSatisfy({ ChartParse.number($0) != nil }) {
            stages.sort { (ChartParse.number($0) ?? 0) < (ChartParse.number($1) ?? 0) }
        }
        var columnOf: ((String) -> Int?)?
        if alluvial, !stages.isEmpty {
            columnOf = { name in stage(name).flatMap { stages.firstIndex(of: $0) } }
        }

        let font = style.font(style.base * 0.95)
        let header = alluvial ? style.base * 1.8 : 0
        let height = area.height - header
        let layout = ChartGeometry.flowLayout(flows, height: height, gap: max(4, height * 0.025), column: columnOf)
        guard !layout.nodes.isEmpty else { return placeholder(area, style) }
        let last = layout.columns - 1
        func label(_ node: ChartGeometry.FlowNode) -> String { category(node.name) }
        let firstWidth = layout.nodes.filter { $0.column == 0 }.map { measure(label($0), font).width }.max() ?? 0
        let lastWidth = layout.nodes.filter { $0.column == last }.map { measure(label($0), font).width }.max() ?? 0
        let leftRoom = min(firstWidth + 8, area.width * 0.22)
        let rightRoom = layout.columns > 1 ? min(lastWidth + 8, area.width * 0.22) : 0
        let nodeWidth = max(8, style.base * 0.75)
        let left = area.minX + leftRoom
        let right = area.maxX - rightRoom - nodeWidth
        let top = area.minY + header
        func columnX(_ column: Int) -> CGFloat {
            layout.columns > 1 ? left + (right - left) * CGFloat(column) / CGFloat(layout.columns - 1) : left
        }
        func color(_ nodeIndex: Int) -> UIColor {
            alluvial ? style.color(categories.firstIndex(of: category(layout.nodes[nodeIndex].name)) ?? nodeIndex) : style.color(nodeIndex)
        }

        if alluvial {
            for (index, name) in stages.enumerated() where index < layout.columns {
                drawText(name, at: CGPoint(x: columnX(index) + nodeWidth / 2, y: area.minY + header / 2), font: style.font(style.base, bold: true), color: style.muted)
            }
        }
        for link in layout.links {
            let source = layout.nodes[link.source]
            let target = layout.nodes[link.target]
            let startX = columnX(source.column) + nodeWidth
            let endX = columnX(target.column)
            let middle = (startX + endX) / 2
            let ribbon = UIBezierPath()
            ribbon.move(to: CGPoint(x: startX, y: top + link.sourceY))
            ribbon.addCurve(to: CGPoint(x: endX, y: top + link.targetY), controlPoint1: CGPoint(x: middle, y: top + link.sourceY), controlPoint2: CGPoint(x: middle, y: top + link.targetY))
            ribbon.addLine(to: CGPoint(x: endX, y: top + link.targetY + link.thickness))
            ribbon.addCurve(to: CGPoint(x: startX, y: top + link.sourceY + link.thickness), controlPoint1: CGPoint(x: middle, y: top + link.targetY + link.thickness), controlPoint2: CGPoint(x: middle, y: top + link.sourceY + link.thickness))
            ribbon.close()
            fill(ribbon, color(link.source), alpha: 0.36)
        }
        for (index, node) in layout.nodes.enumerated() {
            let rect = CGRect(x: columnX(node.column), y: top + node.y, width: nodeWidth, height: max(node.height, 1.5))
            fill(UIBezierPath(roundedRect: rect, cornerRadius: 2), color(index))
            let showsValue = spec.showValues && node.height >= style.base * 2.6
            let shift = showsValue ? style.base * 0.55 : 0
            let valueText = number(node.value, unit: spec.unit)
            if node.column == 0 && layout.columns > 1 {
                drawText(label(node), at: CGPoint(x: rect.minX - 6, y: rect.midY - shift), ax: 1, font: font, color: style.text, maxWidth: leftRoom - 8)
                if showsValue { drawText(valueText, at: CGPoint(x: rect.minX - 6, y: rect.midY + shift), ax: 1, font: style.font(style.base * 0.8), color: style.muted, maxWidth: leftRoom - 8) }
            } else if node.column == last {
                drawText(label(node), at: CGPoint(x: rect.maxX + 6, y: rect.midY - shift), ax: 0, font: font, color: style.text, maxWidth: max(20, rightRoom - 8))
                if showsValue { drawText(valueText, at: CGPoint(x: rect.maxX + 6, y: rect.midY + shift), ax: 0, font: style.font(style.base * 0.8), color: style.muted, maxWidth: max(20, rightRoom - 8)) }
            } else {
                let text = label(node)
                let width = min(measure(text, font).width, area.width * 0.18)
                let backing = CGRect(x: rect.maxX + 3, y: rect.midY - style.base * 0.75, width: width + 8, height: style.base * 1.5)
                fill(UIBezierPath(roundedRect: backing, cornerRadius: 3), style.background, alpha: 0.78)
                drawText(text, at: CGPoint(x: backing.minX + 4, y: backing.midY), ax: 0, font: font, color: style.text, maxWidth: width)
            }
        }
    }

    // MARK: Funnel

    static func drawFunnel(_ spec: ChartSpec, _ area: CGRect, _ style: Style) {
        let table = ChartParse.table(spec.data)
        var stages: [(name: String, value: Double)] = []
        for row in 0..<table.labels.count {
            if let value = table.values[row].first ?? nil, value > 0 { stages.append((table.labels[row], value)) }
        }
        guard let peak = stages.map({ $0.value }).max() else { return placeholder(area, style) }
        let count = stages.count
        let gap: CGFloat = 4
        let stageHeight = (area.height - gap * CGFloat(count - 1)) / CGFloat(count)
        let rightRoom = count > 1 ? style.base * 4.4 : 0
        let widest = area.width - rightRoom
        let centerX = area.minX + widest / 2
        for (index, stage) in stages.enumerated() {
            let top = area.minY + CGFloat(index) * (stageHeight + gap)
            let width = widest * CGFloat(stage.value / peak)
            let nextWidth = index + 1 < count ? widest * CGFloat(stages[index + 1].value / peak) : width * 0.82
            let shape = UIBezierPath()
            shape.move(to: CGPoint(x: centerX - width / 2, y: top))
            shape.addLine(to: CGPoint(x: centerX + width / 2, y: top))
            shape.addLine(to: CGPoint(x: centerX + nextWidth / 2, y: top + stageHeight))
            shape.addLine(to: CGPoint(x: centerX - nextWidth / 2, y: top + stageHeight))
            shape.close()
            let shade = blend(style.accent, style.background, CGFloat(index) / CGFloat(max(count, 2)) * 0.5)
            fill(shape, shade)
            let textColor = contrast(shade)
            let inner = min(width, nextWidth) * 0.92
            let nameFont = style.font(min(style.base * 1.05, stageHeight * 0.36), bold: true)
            if stageHeight >= style.base * 3 {
                drawText(stage.name, at: CGPoint(x: centerX, y: top + stageHeight / 2 - style.base * 0.5), font: nameFont, color: textColor, maxWidth: inner)
                drawText(number(stage.value, unit: spec.unit), at: CGPoint(x: centerX, y: top + stageHeight / 2 + style.base * 0.6), font: style.font(min(style.base, stageHeight * 0.32)), color: textColor, maxWidth: inner)
            } else {
                drawText(stage.name + " · " + number(stage.value, unit: spec.unit), at: CGPoint(x: centerX, y: top + stageHeight / 2), font: nameFont, color: textColor, maxWidth: inner)
            }
            if index > 0, spec.showValues {
                let percent = number((stage.value / stages[index - 1].value * 1000).rounded() / 10) + " %"
                drawText("↓ " + percent, at: CGPoint(x: area.maxX, y: top - gap / 2), ax: 1, font: style.font(style.base * 0.9, bold: true), color: style.muted)
            }
        }
    }

    // MARK: Treemap

    static func drawTreemap(_ spec: ChartSpec, _ area: CGRect, _ style: Style) {
        var entries: [(group: String, name: String, value: Double)] = []
        for row in ChartParse.rows(spec.data) where row.count >= 2 {
            guard let value = ChartParse.number(row[1]), value > 0 else { continue }
            if let slash = row[0].firstIndex(of: "/") {
                entries.append((String(row[0][..<slash]).trimmingCharacters(in: .whitespaces), String(row[0][row[0].index(after: slash)...]).trimmingCharacters(in: .whitespaces), value))
            } else {
                entries.append(("", row[0], value))
            }
        }
        guard !entries.isEmpty else { return placeholder(area, style) }

        func leaf(_ rect: CGRect, _ name: String, _ value: Double, _ color: UIColor) {
            let tile = rect.insetBy(dx: 1.5, dy: 1.5)
            guard tile.width > 2, tile.height > 2 else { return }
            fill(UIBezierPath(roundedRect: tile, cornerRadius: 3), color)
            let text = spec.showValues ? name + "\n" + number(value, unit: spec.unit) : name
            drawFitted(text, in: tile.insetBy(dx: 4, dy: 3), style: style, maxSize: style.base * 1.25, minSize: 7, bold: true, color: contrast(color))
        }

        if !entries.contains(where: { !$0.group.isEmpty }) {
            let sorted = entries.sorted { $0.value > $1.value }
            let rects = ChartGeometry.squarify(sorted.map { $0.value }, in: area)
            for (index, entry) in sorted.enumerated() {
                let shade = blend(style.accent, style.background, CGFloat(index) / CGFloat(max(sorted.count, 2)) * 0.6)
                leaf(rects[index], entry.name, entry.value, shade)
            }
            return
        }
        var names: [String] = []
        for entry in entries where !names.contains(entry.group) { names.append(entry.group) }
        let sums = names.map { name in entries.filter { $0.group == name }.reduce(0) { $0 + $1.value } }
        let order = names.indices.sorted { sums[$0] > sums[$1] }
        let groupRects = ChartGeometry.squarify(order.map { sums[$0] }, in: area)
        for (position, groupIndex) in order.enumerated() {
            let rect = groupRects[position]
            let color = style.color(groupIndex)
            let header = rect.height > style.base * 4 && !names[groupIndex].isEmpty ? style.base * 1.4 : 0
            let inner = CGRect(x: rect.minX, y: rect.minY + header, width: rect.width, height: rect.height - header)
            if header > 0 {
                drawText(names[groupIndex], at: CGPoint(x: rect.minX + 3, y: rect.minY + header / 2), ax: 0, font: style.font(style.base * 0.95, bold: true), color: style.text, maxWidth: rect.width - 6)
            }
            let members = entries.filter { $0.group == names[groupIndex] }.sorted { $0.value > $1.value }
            let rects = ChartGeometry.squarify(members.map { $0.value }, in: inner)
            for (index, member) in members.enumerated() {
                leaf(rects[index], member.name, member.value, blend(color, style.background, CGFloat(index) / CGFloat(max(members.count, 2)) * 0.45))
            }
        }
    }

    // MARK: Organisation chart

    static func drawOrgChart(_ spec: ChartSpec, _ area: CGRect, _ style: Style) {
        let tree = ChartParse.tree(spec.data)
        guard !tree.texts.isEmpty else { return placeholder(area, style) }
        let layout = ChartGeometry.treeLayout(tree)
        let unit = area.width / CGFloat(max(layout.leaves, 1))
        let boxWidth = min(unit * 0.88, style.base * 12)
        let boxHeight = min(style.base * 3.2, area.height / CGFloat(layout.levels) * 0.6)
        let levelGap = layout.levels > 1 ? (area.height - boxHeight * CGFloat(layout.levels)) / CGFloat(layout.levels - 1) : 0
        func box(_ node: Int) -> CGRect {
            CGRect(
                x: area.minX + (CGFloat(layout.x[node]) + 0.5) * unit - boxWidth / 2,
                y: area.minY + CGFloat(layout.depth[node]) * (boxHeight + levelGap),
                width: boxWidth, height: boxHeight
            )
        }
        for node in tree.texts.indices {
            let parent = box(node)
            for child in tree.children[node] {
                let target = box(child)
                let path = UIBezierPath()
                let midY = (parent.maxY + target.minY) / 2
                path.move(to: CGPoint(x: parent.midX, y: parent.maxY))
                path.addLine(to: CGPoint(x: parent.midX, y: midY))
                path.addLine(to: CGPoint(x: target.midX, y: midY))
                path.addLine(to: CGPoint(x: target.midX, y: target.minY))
                stroke(path, style.muted, width: 1.6, alpha: 0.7)
            }
        }
        for node in tree.texts.indices {
            let rect = box(node)
            let isRoot = tree.parents[node] < 0
            let fillColor = isRoot ? style.accent : style.surface
            let shape = UIBezierPath(roundedRect: rect, cornerRadius: min(rect.height * 0.22, 8))
            fill(shape, fillColor)
            if !isRoot { stroke(shape, style.accent, width: 1.4, alpha: 0.7) }
            drawFitted(tree.texts[node], in: rect.insetBy(dx: 5, dy: 3), style: style, maxSize: style.base * 1.05, minSize: 7, bold: isRoot, color: isRoot ? contrast(style.accent) : style.text)
        }
    }

    // MARK: Map of Germany

    static func drawGeo(_ spec: ChartSpec, _ area: CGRect, _ style: Style) {
        let values = GermanyTiles.values(spec.data)
        guard let low = values.values.min(), let high = values.values.max() else { return placeholder(area, style, "Keine Bundesländer erkannt") }
        let legendRoom = style.base * 4.5
        let side = max(20, min(area.height, area.width - legendRoom))
        let cell = side / CGFloat(GermanyTiles.columns)
        let originX = area.minX + max(0, (area.width - legendRoom - side) / 2)
        let originY = area.minY + (area.height - cell * CGFloat(GermanyTiles.rows)) / 2
        let lowColor = blend(style.surface, style.accent, 0.14)
        let highColor = blend(style.accent, style.text, 0.3)
        func shade(_ value: Double) -> UIColor {
            blend(lowColor, highColor, high > low ? CGFloat((value - low) / (high - low)) : 1)
        }
        for tile in GermanyTiles.all {
            let rect = CGRect(x: originX + CGFloat(tile.column) * cell, y: originY + CGFloat(tile.row) * cell, width: cell, height: cell).insetBy(dx: cell * 0.04, dy: cell * 0.04)
            let shape = UIBezierPath(roundedRect: rect, cornerRadius: cell * 0.12)
            if let value = values[tile.code] {
                let color = shade(value)
                fill(shape, color)
                drawText(tile.code, at: CGPoint(x: rect.midX, y: rect.midY - (spec.showValues ? cell * 0.12 : 0)), font: style.font(min(style.base * 1.1, cell * 0.3), bold: true), color: contrast(color))
                if spec.showValues {
                    drawText(number(value), at: CGPoint(x: rect.midX, y: rect.midY + cell * 0.2), font: style.font(min(style.base * 0.85, cell * 0.22)), color: contrast(color), maxWidth: rect.width - 2)
                }
            } else {
                fill(shape, style.surface, alpha: 0.6)
                drawText(tile.code, at: CGPoint(x: rect.midX, y: rect.midY), font: style.font(min(style.base, cell * 0.28)), color: style.muted)
            }
        }
        let barX = originX + side + style.base
        let barWidth = style.base * 0.8
        let barHeight = min(cell * 3, area.height * 0.7)
        let barTop = area.midY - barHeight / 2
        let steps = 20
        for step in 0..<steps {
            let t = Double(steps - 1 - step) / Double(steps - 1)
            let slice = CGRect(x: barX, y: barTop + barHeight * CGFloat(step) / CGFloat(steps), width: barWidth, height: barHeight / CGFloat(steps) + 0.5)
            fill(UIBezierPath(rect: slice), shade(low + (high - low) * t))
        }
        drawText(number(high, unit: spec.unit), at: CGPoint(x: barX + barWidth + 4, y: barTop), ax: 0, ay: 0, font: style.font(style.base * 0.8), color: style.muted)
        drawText(number(low, unit: spec.unit), at: CGPoint(x: barX + barWidth + 4, y: barTop + barHeight), ax: 0, ay: 1, font: style.font(style.base * 0.8), color: style.muted)
    }

    // MARK: Network

    static func drawNetwork(_ spec: ChartSpec, _ area: CGRect, _ style: Style) {
        let parsed = ChartParse.edges(spec.data)
        guard !parsed.nodes.isEmpty else { return placeholder(area, style) }
        let points = ChartGeometry.forceLayout(count: parsed.nodes.count, edges: parsed.edges)
        let inset = style.base * 2.2
        let frame = area.insetBy(dx: inset, dy: inset * 0.8)
        func place(_ index: Int) -> CGPoint {
            CGPoint(x: frame.minX + points[index].x * frame.width, y: frame.minY + points[index].y * frame.height)
        }
        var degree = [Int](repeating: 0, count: parsed.nodes.count)
        for edge in parsed.edges {
            degree[edge.from] += 1
            degree[edge.to] += 1
        }
        for edge in parsed.edges {
            line(from: place(edge.from), to: place(edge.to), color: style.muted, width: min(1.4 + CGFloat(edge.weight) * 0.9, style.base * 0.7), alpha: 0.55)
        }
        let font = style.font(style.base * 0.95, bold: true)
        for index in parsed.nodes.indices {
            let center = place(index)
            let radius = min(style.base * 0.55 + CGFloat(degree[index]) * style.base * 0.16, style.base * 1.5)
            let circle = UIBezierPath(ovalIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
            fill(circle, style.color(index))
            stroke(circle, style.background, width: 2)
            drawText(parsed.nodes[index], at: CGPoint(x: center.x, y: center.y + radius + 3), ay: 0, font: font, color: style.text, maxWidth: style.base * 9)
        }
    }

    // MARK: Chord

    static func drawChord(_ spec: ChartSpec, _ area: CGRect, _ style: Style) {
        let table = ChartParse.table(spec.data)
        let size = table.labels.count
        guard size >= 2 else { return placeholder(area, style) }
        let matrix: [[Double]] = (0..<size).map { row in
            (0..<size).map { column in
                column < table.values[row].count ? (table.values[row][column] ?? 0) : 0
            }
        }
        let result = ChartGeometry.chord(matrix)
        guard !result.groups.isEmpty else { return placeholder(area, style) }
        let font = style.font(style.base * 0.95, bold: true)
        let labelRoom = min(area.width * 0.2, (table.labels.map { measure($0, font).width }.max() ?? 0) + 8)
        let center = CGPoint(x: area.midX, y: area.midY)
        let outer = max(20, min(area.width / 2 - labelRoom, area.height / 2 - style.base * 1.4))
        let thickness = style.base * 0.9
        let inner = outer - thickness
        let offset = -CGFloat.pi / 2
        func point(_ angle: Double, _ radius: CGFloat) -> CGPoint {
            CGPoint(x: center.x + cos(CGFloat(angle) + offset) * radius, y: center.y + sin(CGFloat(angle) + offset) * radius)
        }
        for ribbon in result.ribbons {
            let path = UIBezierPath()
            path.addArc(withCenter: center, radius: inner - 2, startAngle: CGFloat(ribbon.source.start) + offset, endAngle: CGFloat(ribbon.source.end) + offset, clockwise: true)
            path.addQuadCurve(to: point(ribbon.target.start, inner - 2), controlPoint: center)
            path.addArc(withCenter: center, radius: inner - 2, startAngle: CGFloat(ribbon.target.start) + offset, endAngle: CGFloat(ribbon.target.end) + offset, clockwise: true)
            path.addQuadCurve(to: point(ribbon.source.start, inner - 2), controlPoint: center)
            path.close()
            fill(path, style.color(ribbon.source.group), alpha: 0.5)
            stroke(path, style.color(ribbon.source.group), width: 0.8, alpha: 0.9)
        }
        for group in result.groups {
            let arc = UIBezierPath(arcCenter: center, radius: outer - thickness / 2, startAngle: CGFloat(group.start) + offset, endAngle: CGFloat(group.end) + offset, clockwise: true)
            arc.lineWidth = thickness
            arc.lineCapStyle = .butt
            style.color(group.index).setStroke()
            arc.stroke()
            let middle = (group.start + group.end) / 2
            let place = point(middle, outer + style.base * 0.6)
            let direction = cos(CGFloat(middle) + offset)
            let ax: CGFloat = direction > 0.3 ? 0 : (direction < -0.3 ? 1 : 0.5)
            let vertical = sin(CGFloat(middle) + offset)
            let ay: CGFloat = vertical > 0.3 ? 0 : (vertical < -0.3 ? 1 : 0.5)
            drawText(table.labels[group.index], at: place, ax: ax, ay: ay, font: font, color: style.text, maxWidth: labelRoom)
        }
    }

    // MARK: Word cloud

    static func drawWordCloud(_ spec: ChartSpec, _ area: CGRect, _ style: Style) {
        let words = ChartParse.words(spec.data)
        guard !words.isEmpty else { return placeholder(area, style) }
        let frame = area.insetBy(dx: style.base * 0.4, dy: style.base * 0.4)
        let placed = ChartGeometry.wordCloud(
            words, in: frame, maxSize: min(frame.height * 0.26, frame.width * 0.16), minSize: max(9, frame.height * 0.05),
            measure: { word, size in measure(word, style.font(size, bold: true)) }
        )
        guard !placed.isEmpty else { return placeholder(area, style) }
        for item in placed {
            let color = item.rank < 3 ? style.accent : style.color(item.rank % (style.palette.count - 1) + 1)
            drawText(item.word, at: CGPoint(x: item.frame.midX, y: item.frame.midY), font: style.font(item.size, bold: true), color: color, maxWidth: item.frame.width + 4)
        }
    }
}
