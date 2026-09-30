import Foundation
#if canImport(CoreGraphics)
import CoreGraphics
#endif

/// The maths behind the diagrams, apart from any drawing: axes, statistics, and the layouts of treemaps, flows,
/// chords, networks, trees and word clouds.
enum ChartGeometry {
    // MARK: Axes

    /// Round tick values covering min…max, about `target` of them.
    static func niceTicks(min lower: Double, max upper: Double, target: Int = 5) -> (ticks: [Double], lower: Double, upper: Double) {
        var low = lower
        var high = upper
        if !(low.isFinite && high.isFinite) { return ([0, 1], 0, 1) }
        if high == low {
            high = low + (low == 0 ? 1 : abs(low) * 0.5)
            low = low - (lower == 0 ? 0 : abs(lower) * 0.5)
        }
        let rawStep = (high - low) / Double(Swift.max(target, 1))
        let magnitude = pow(10, floor(log10(rawStep)))
        let residual = rawStep / magnitude
        let factor: Double = residual <= 1 ? 1 : (residual <= 2 ? 2 : (residual <= 5 ? 5 : 10))
        let step = factor * magnitude
        let start = floor(low / step) * step
        let end = ceil(high / step) * step
        var ticks: [Double] = []
        var value = start
        var guardCount = 0
        while value <= end + step * 0.001, guardCount < 200 {
            ticks.append((value / step).rounded() * step)
            value += step
            guardCount += 1
        }
        return (ticks, start, end)
    }

    // MARK: Statistics

    /// The p-quantile of sorted values, interpolated linearly (the usual "type 7").
    static func quantile(_ sorted: [Double], _ p: Double) -> Double {
        guard !sorted.isEmpty else { return 0 }
        if sorted.count == 1 { return sorted[0] }
        let position = Swift.min(Swift.max(p, 0), 1) * Double(sorted.count - 1)
        let below = Int(floor(position))
        let above = Swift.min(below + 1, sorted.count - 1)
        return sorted[below] + (sorted[above] - sorted[below]) * (position - Double(below))
    }

    struct BoxStats: Equatable {
        var lowWhisker: Double
        var q1: Double
        var median: Double
        var q3: Double
        var highWhisker: Double
        var outliers: [Double]
    }

    /// Quartiles, whiskers reaching to the last value within 1.5 × IQR, and the outliers beyond them.
    static func boxStats(_ values: [Double]) -> BoxStats? {
        let sorted = values.sorted()
        guard sorted.count >= 2 else { return nil }
        let q1 = quantile(sorted, 0.25)
        let q3 = quantile(sorted, 0.75)
        let fence = 1.5 * (q3 - q1)
        let inside = sorted.filter { $0 >= q1 - fence && $0 <= q3 + fence }
        return BoxStats(
            lowWhisker: inside.first ?? q1,
            q1: q1,
            median: quantile(sorted, 0.5),
            q3: q3,
            highWhisker: inside.last ?? q3,
            outliers: sorted.filter { $0 < q1 - fence || $0 > q3 + fence }
        )
    }

    /// Equal-width classes over the data; `bins` defaults to Sturges' rule between 5 and 20.
    static func histogram(_ values: [Double], bins requested: Int? = nil) -> (edges: [Double], counts: [Int]) {
        guard let low = values.min(), let high = values.max() else { return ([], []) }
        let automatic = Int(ceil(log2(Double(values.count)))) + 1
        let count = Swift.min(Swift.max(requested ?? automatic, 5), 20)
        let ticks = niceTicks(min: low, max: high, target: count)
        var edges = ticks.ticks
        if edges.count < 2 { edges = [low, high + 1] }
        var counts = [Int](repeating: 0, count: edges.count - 1)
        for value in values {
            var index = edges.count - 2
            for i in 0..<(edges.count - 1) where value < edges[i + 1] {
                index = i
                break
            }
            counts[Swift.max(0, index)] += 1
        }
        return (edges, counts)
    }

    /// A smooth density curve of the values (Gaussian kernel, Silverman's bandwidth) on `points` steps over lower…upper.
    static func density(_ values: [Double], lower: Double, upper: Double, points: Int = 48) -> [(x: Double, y: Double)] {
        guard values.count >= 2, upper > lower else { return [] }
        let mean = values.reduce(0, +) / Double(values.count)
        let variance = values.map { ($0 - mean) * ($0 - mean) }.reduce(0, +) / Double(values.count - 1)
        var deviation = sqrt(variance)
        if deviation <= 0 { deviation = (upper - lower) / 10 }
        let bandwidth = Swift.max(1.06 * deviation * pow(Double(values.count), -0.2), (upper - lower) / 200)
        var curve: [(x: Double, y: Double)] = []
        for step in 0..<points {
            let x = lower + (upper - lower) * Double(step) / Double(points - 1)
            var sum = 0.0
            for value in values {
                let z = (x - value) / bandwidth
                sum += exp(-0.5 * z * z)
            }
            curve.append((x, sum / (Double(values.count) * bandwidth * 2.5066282746)))
        }
        return curve
    }

    /// The least-squares line through the points and their correlation coefficient r.
    static func regression(_ points: [(x: Double, y: Double)]) -> (slope: Double, intercept: Double, r: Double)? {
        guard points.count >= 3 else { return nil }
        let n = Double(points.count)
        let meanX = points.map { $0.x }.reduce(0, +) / n
        let meanY = points.map { $0.y }.reduce(0, +) / n
        var sxx = 0.0, syy = 0.0, sxy = 0.0
        for point in points {
            sxx += (point.x - meanX) * (point.x - meanX)
            syy += (point.y - meanY) * (point.y - meanY)
            sxy += (point.x - meanX) * (point.y - meanY)
        }
        guard sxx > 0, syy > 0 else { return nil }
        let slope = sxy / sxx
        return (slope, meanY - slope * meanX, sxy / sqrt(sxx * syy))
    }

    // MARK: Treemap

    /// Squarified treemap: rectangles of the areas proportional to `values` (largest first works best), filling `rect`.
    static func squarify(_ values: [Double], in rect: CGRect) -> [CGRect] {
        let total = values.reduce(0) { $0 + Swift.max($1, 0) }
        guard total > 0, rect.width > 0, rect.height > 0 else { return values.map { _ in .zero } }
        let scale = CGFloat(rect.width * rect.height) / CGFloat(total)
        let areas = values.map { CGFloat(Swift.max($0, 0)) * scale }
        var result = [CGRect](repeating: .zero, count: values.count)
        var remaining = rect
        var start = 0
        func worst(_ row: ArraySlice<CGFloat>, _ side: CGFloat) -> CGFloat {
            let sum = row.reduce(0, +)
            guard let biggest = row.max(), let smallest = row.min(), smallest > 0, side > 0 else { return .infinity }
            return Swift.max(side * side * biggest / (sum * sum), sum * sum / (side * side * smallest))
        }
        while start < areas.count {
            let side = Swift.min(remaining.width, remaining.height)
            var end = start + 1
            var best = worst(areas[start..<end], side)
            while end < areas.count {
                let candidate = worst(areas[start...end], side)
                if candidate <= best {
                    best = candidate
                    end += 1
                } else {
                    break
                }
            }
            let rowArea = areas[start..<end].reduce(0, +)
            if remaining.width >= remaining.height {
                let strip = remaining.height > 0 ? rowArea / remaining.height : 0
                var y = remaining.minY
                for i in start..<end {
                    let h = strip > 0 ? areas[i] / strip : 0
                    result[i] = CGRect(x: remaining.minX, y: y, width: strip, height: h)
                    y += h
                }
                remaining = CGRect(x: remaining.minX + strip, y: remaining.minY, width: Swift.max(0, remaining.width - strip), height: remaining.height)
            } else {
                let strip = remaining.width > 0 ? rowArea / remaining.width : 0
                var x = remaining.minX
                for i in start..<end {
                    let w = strip > 0 ? areas[i] / strip : 0
                    result[i] = CGRect(x: x, y: remaining.minY, width: w, height: strip)
                    x += w
                }
                remaining = CGRect(x: remaining.minX, y: remaining.minY + strip, width: remaining.width, height: Swift.max(0, remaining.height - strip))
            }
            start = end
        }
        return result
    }

    // MARK: Flows (Sankey and alluvial)

    struct FlowNode: Equatable {
        var name: String
        var column: Int
        var value: Double
        var y: CGFloat = 0
        var height: CGFloat = 0
    }

    struct FlowLink: Equatable {
        var source: Int
        var target: Int
        var value: Double
        /// Where the band starts on the source's right edge and ends on the target's left edge (top), and its width.
        var sourceY: CGFloat = 0
        var targetY: CGFloat = 0
        var thickness: CGFloat = 0
    }

    struct FlowLayout: Equatable {
        var nodes: [FlowNode]
        var links: [FlowLink]
        var columns: Int
    }

    /// Lays out nodes in columns with heights proportional to their flow, and links as bands stacked along the nodes.
    /// `column` gives a node's column when it is known (alluvial); otherwise it is the longest path from a source.
    static func flowLayout(
        _ flows: [(source: String, target: String, value: Double)], height: CGFloat, gap: CGFloat, column: ((String) -> Int?)? = nil
    ) -> FlowLayout {
        var names: [String] = []
        func index(_ name: String) -> Int {
            if let found = names.firstIndex(of: name) { return found }
            names.append(name)
            return names.count - 1
        }
        var links: [FlowLink] = flows.map { FlowLink(source: index($0.source), target: index($0.target), value: $0.value) }
        var nodes = names.map { FlowNode(name: $0, column: 0, value: 0) }
        guard !nodes.isEmpty else { return FlowLayout(nodes: [], links: [], columns: 0) }
        var out = [Double](repeating: 0, count: nodes.count)
        var into = [Double](repeating: 0, count: nodes.count)
        for link in links {
            out[link.source] += link.value
            into[link.target] += link.value
        }
        for i in nodes.indices { nodes[i].value = Swift.max(out[i], into[i]) }
        // Columns
        if let column, names.allSatisfy({ column($0) != nil }) {
            let raw = names.map { column($0) ?? 0 }
            let distinct = Array(Set(raw)).sorted()
            for i in nodes.indices { nodes[i].column = distinct.firstIndex(of: raw[i]) ?? 0 }
        } else {
            for _ in 0..<nodes.count {
                var changed = false
                for link in links where nodes[link.target].column < nodes[link.source].column + 1 && nodes[link.source].column < nodes.count {
                    nodes[link.target].column = nodes[link.source].column + 1
                    changed = true
                }
                if !changed { break }
            }
        }
        let columnCount = (nodes.map(\.column).max() ?? 0) + 1
        // Heights
        var scale = CGFloat.greatestFiniteMagnitude
        for c in 0..<columnCount {
            let members = nodes.indices.filter { nodes[$0].column == c }
            let sum = members.reduce(0.0) { $0 + nodes[$1].value }
            guard sum > 0 else { continue }
            let room = height - gap * CGFloat(Swift.max(members.count - 1, 0))
            scale = Swift.min(scale, Swift.max(room, 1) / CGFloat(sum))
        }
        if scale == .greatestFiniteMagnitude { scale = 1 }
        for c in 0..<columnCount {
            let members = nodes.indices.filter { nodes[$0].column == c }
            let total = members.reduce(CGFloat(0)) { $0 + CGFloat(nodes[$1].value) * scale } + gap * CGFloat(Swift.max(members.count - 1, 0))
            var y = (height - total) / 2
            for i in members {
                nodes[i].y = y
                nodes[i].height = CGFloat(nodes[i].value) * scale
                y += nodes[i].height + gap
            }
        }
        // Bands: outgoing ones ordered by the target's place, incoming ones by the source's place.
        var outOffset = [CGFloat](repeating: 0, count: nodes.count)
        var inOffset = [CGFloat](repeating: 0, count: nodes.count)
        let bySource = links.indices.sorted { a, b in
            if links[a].source != links[b].source { return links[a].source < links[b].source }
            return nodes[links[a].target].y < nodes[links[b].target].y
        }
        for i in bySource {
            let link = links[i]
            links[i].thickness = CGFloat(link.value) * scale
            links[i].sourceY = nodes[link.source].y + outOffset[link.source]
            outOffset[link.source] += links[i].thickness
        }
        let byTarget = links.indices.sorted { a, b in
            if links[a].target != links[b].target { return links[a].target < links[b].target }
            return nodes[links[a].source].y < nodes[links[b].source].y
        }
        for i in byTarget {
            let link = links[i]
            links[i].targetY = nodes[link.target].y + inOffset[link.target]
            inOffset[link.target] += links[i].thickness
        }
        return FlowLayout(nodes: nodes, links: links, columns: columnCount)
    }

    // MARK: Chord

    struct ChordGroup: Equatable {
        var index: Int
        var start: Double
        var end: Double
        var total: Double
    }

    struct ChordEnd: Equatable {
        var group: Int
        var start: Double
        var end: Double
    }

    struct ChordRibbon: Equatable {
        var source: ChordEnd
        var target: ChordEnd
        var value: Double
    }

    /// Group arcs sized by their row totals and ribbons between the parts of the arcs, like d3's chord layout.
    static func chord(_ matrix: [[Double]], gap: Double = 0.04) -> (groups: [ChordGroup], ribbons: [ChordRibbon]) {
        let n = matrix.count
        guard n > 0 else { return ([], []) }
        let rows = matrix.map { row in (0..<n).map { row.indices.contains($0) ? Swift.max(row[$0], 0) : 0 } }
        let rowSums = rows.map { $0.reduce(0, +) }
        let total = rowSums.reduce(0, +)
        guard total > 0 else { return ([], []) }
        let k = (2 * Double.pi - gap * Double(n)) / total
        var groups: [ChordGroup] = []
        var sub = [[(start: Double, end: Double)]](repeating: [(start: Double, end: Double)](repeating: (start: 0, end: 0), count: n), count: n)
        var angle = 0.0
        for i in 0..<n {
            let start = angle
            for j in 0..<n {
                let value = rows[i][j]
                sub[i][j] = (angle, angle + value * k)
                angle += value * k
            }
            groups.append(ChordGroup(index: i, start: start, end: angle, total: rowSums[i]))
            angle += gap
        }
        var ribbons: [ChordRibbon] = []
        for i in 0..<n {
            for j in i..<n where rows[i][j] > 0 || rows[j][i] > 0 {
                ribbons.append(ChordRibbon(
                    source: ChordEnd(group: i, start: sub[i][j].start, end: sub[i][j].end),
                    target: ChordEnd(group: j, start: sub[j][i].start, end: sub[j][i].end),
                    value: Swift.max(rows[i][j], rows[j][i])
                ))
            }
        }
        return (groups, ribbons)
    }

    // MARK: Networks

    /// Fruchterman–Reingold layout in the unit square; the start is a circle, so the same data gives the same picture.
    static func forceLayout(count: Int, edges: [(from: Int, to: Int, weight: Double)], iterations: Int = 220) -> [CGPoint] {
        guard count > 0 else { return [] }
        if count == 1 { return [CGPoint(x: 0.5, y: 0.5)] }
        var x = (0..<count).map { 0.5 + 0.35 * cos(2 * Double.pi * Double($0) / Double(count)) }
        var y = (0..<count).map { 0.5 + 0.35 * sin(2 * Double.pi * Double($0) / Double(count)) }
        let k = 0.75 / sqrt(Double(count))
        var temperature = 0.12
        for _ in 0..<iterations {
            var dx = [Double](repeating: 0, count: count)
            var dy = [Double](repeating: 0, count: count)
            for i in 0..<count {
                for j in (i + 1)..<count {
                    var deltaX = x[i] - x[j]
                    var deltaY = y[i] - y[j]
                    var distance = sqrt(deltaX * deltaX + deltaY * deltaY)
                    if distance < 0.001 {
                        deltaX = 0.001 * Double(i + 1)
                        deltaY = 0.001 * Double(j + 1)
                        distance = sqrt(deltaX * deltaX + deltaY * deltaY)
                    }
                    let force = k * k / distance
                    dx[i] += deltaX / distance * force
                    dy[i] += deltaY / distance * force
                    dx[j] -= deltaX / distance * force
                    dy[j] -= deltaY / distance * force
                }
            }
            for edge in edges {
                let deltaX = x[edge.from] - x[edge.to]
                let deltaY = y[edge.from] - y[edge.to]
                let distance = Swift.max(sqrt(deltaX * deltaX + deltaY * deltaY), 0.001)
                let force = distance * distance / k * Swift.min(edge.weight, 3)
                dx[edge.from] -= deltaX / distance * force
                dy[edge.from] -= deltaY / distance * force
                dx[edge.to] += deltaX / distance * force
                dy[edge.to] += deltaY / distance * force
            }
            for i in 0..<count {
                let length = Swift.max(sqrt(dx[i] * dx[i] + dy[i] * dy[i]), 0.0001)
                let move = Swift.min(length, temperature)
                x[i] += dx[i] / length * move
                y[i] += dy[i] / length * move
            }
            temperature *= 0.975
        }
        // Stretch to the whole square, keeping a margin.
        let minX = x.min() ?? 0, maxX = x.max() ?? 1, minY = y.min() ?? 0, maxY = y.max() ?? 1
        let spanX = Swift.max(maxX - minX, 0.0001), spanY = Swift.max(maxY - minY, 0.0001)
        return (0..<count).map { CGPoint(x: 0.04 + 0.92 * (x[$0] - minX) / spanX, y: 0.04 + 0.92 * (y[$0] - minY) / spanY) }
    }

    // MARK: Trees

    /// Places the boxes of a tree: x in units of one leaf (parents centered over their children), depth per level.
    static func treeLayout(_ tree: ChartParse.Tree) -> (x: [Double], depth: [Int], leaves: Int, levels: Int) {
        let count = tree.texts.count
        var x = [Double](repeating: 0, count: count)
        var depth = [Int](repeating: 0, count: count)
        var leaf = 0.0
        func place(_ node: Int, _ level: Int) {
            depth[node] = level
            let kids = tree.children[node]
            if kids.isEmpty {
                x[node] = leaf
                leaf += 1
            } else {
                for kid in kids { place(kid, level + 1) }
                x[node] = (x[kids[0]] + x[kids[kids.count - 1]]) / 2
            }
        }
        for root in tree.roots { place(root, 0) }
        return (x, depth, Int(leaf), (depth.max() ?? 0) + 1)
    }

    // MARK: Word cloud

    struct PlacedWord: Equatable {
        var word: String
        var frame: CGRect
        var size: CGFloat
        var rank: Int
    }

    /// Places words biggest first on a spiral from the middle, each where it overlaps none before it; a word that finds
    /// no place is made smaller until it does or is dropped.
    static func wordCloud(
        _ words: [(word: String, weight: Double)], in rect: CGRect, maxSize: CGFloat, minSize: CGFloat,
        measure: (String, CGFloat) -> CGSize
    ) -> [PlacedWord] {
        let sorted = words.sorted { $0.weight > $1.weight }.prefix(60)
        guard let heaviest = sorted.first?.weight, heaviest > 0 else { return [] }
        let lightest = sorted.last?.weight ?? heaviest
        var placed: [PlacedWord] = []
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let padding: CGFloat = 3
        for (rank, entry) in sorted.enumerated() {
            let share = heaviest > lightest ? (entry.weight - lightest) / (heaviest - lightest) : 1
            var size = minSize + (maxSize - minSize) * CGFloat(sqrt(share))
            var found: CGRect?
            while found == nil, size >= minSize * 0.6 {
                let box = measure(entry.word, size)
                let width = box.width + padding * 2
                let height = box.height + padding * 2
                var angle = 0.0
                var radius: CGFloat = 0
                while radius < Swift.max(rect.width, rect.height) {
                    let candidate = CGRect(
                        x: center.x + radius * CGFloat(cos(angle)) * 1.4 - width / 2,
                        y: center.y + radius * CGFloat(sin(angle)) - height / 2,
                        width: width, height: height
                    )
                    if rect.contains(candidate), !placed.contains(where: { $0.frame.intersects(candidate) }) {
                        found = candidate
                        break
                    }
                    angle += 0.35
                    radius += 0.9
                }
                if found == nil { size *= 0.88 }
            }
            if let found {
                placed.append(PlacedWord(word: entry.word, frame: found.insetBy(dx: padding, dy: padding), size: size, rank: rank))
            }
        }
        return placed
    }
}
