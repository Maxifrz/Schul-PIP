import XCTest
@testable import Lernwerk

final class ChartParseTests: XCTestCase {
    func testNumbersInGermanAndEnglishForms() {
        XCTAssertEqual(ChartParse.number("3,5"), 3.5)
        XCTAssertEqual(ChartParse.number("3.5"), 3.5)
        XCTAssertEqual(ChartParse.number("1.234,5"), 1234.5)
        XCTAssertEqual(ChartParse.number("12 %"), 12)
        XCTAssertEqual(ChartParse.number("4 €"), 4)
        XCTAssertEqual(ChartParse.number(" -7 "), -7)
        XCTAssertNil(ChartParse.number("abc"))
        XCTAssertNil(ChartParse.number(""))
        // Too large to be a number of a school talk: no overflow further on.
        XCTAssertNil(ChartParse.number("1e300"))
    }

    func testATableWithHeaderAndSeries() {
        let table = ChartParse.table("; 2023; 2024\nQ1; 12; 15\nQ2; 18; 21")
        XCTAssertEqual(table.seriesNames, ["2023", "2024"])
        XCTAssertEqual(table.labels, ["Q1", "Q2"])
        XCTAssertEqual(table.values, [[12, 15], [18, 21]])
        let named = ChartParse.table("Kategorie; Umsatz\nA; 5,5\nB; 7")
        XCTAssertEqual(named.seriesNames, ["Umsatz"])
        XCTAssertEqual(named.values, [[5.5], [7]])
    }

    func testATableWithoutHeaderIsOneSeries() {
        let table = ChartParse.table("Solar; 38\nWind; 31\nWasser; x")
        XCTAssertEqual(table.seriesNames, ["Wert"])
        XCTAssertEqual(table.labels, ["Solar", "Wind", "Wasser"])
        XCTAssertEqual(table.values[0], [38])
        XCTAssertEqual(table.values[2], [nil])
        XCTAssertTrue(ChartParse.table("").isEmpty)
        // Comments and colons as separators
        XCTAssertEqual(ChartParse.table("# Quelle: Amt\nA: 3").values, [[3]])
    }

    func testGroupsOfSamplesAndPlainNumbers() {
        let groups = ChartParse.groups("Klasse A; 45; 52; 58\nKlasse B; 50; 55; 60")
        XCTAssertEqual(groups.map { $0.name }, ["Klasse A", "Klasse B"])
        XCTAssertEqual(groups[1].values, [50, 55, 60])
        let plain = ChartParse.groups("1 2 3 4")
        XCTAssertEqual(plain.count, 1)
        XCTAssertEqual(plain[0].values, [1, 2, 3, 4])
        XCTAssertEqual(ChartParse.numbers("1,5; 2\n3\t4 x"), [1.5, 2, 3, 4])
    }

    func testFlows() {
        let flows = ChartParse.flows("A -> B; 5\nB → C; 3\nD; E; 4\nA -> A; 3\nA -> B; 0\nA -> C; x")
        XCTAssertEqual(flows.count, 3)
        XCTAssertEqual(flows[0].source, "A")
        XCTAssertEqual(flows[0].target, "B")
        XCTAssertEqual(flows[0].value, 5)
        XCTAssertEqual(flows[2].source, "D")
        XCTAssertEqual(flows[2].value, 4)
    }

    func testEdgesAndLoneNodes() {
        let parsed = ChartParse.edges("Anna - Ben\nBen - Clara; 2\nDora")
        XCTAssertEqual(parsed.nodes, ["Anna", "Ben", "Clara", "Dora"])
        XCTAssertEqual(parsed.edges.count, 2)
        XCTAssertEqual(parsed.edges[1].from, 1)
        XCTAssertEqual(parsed.edges[1].to, 2)
        XCTAssertEqual(parsed.edges[1].weight, 2)
    }

    func testWordsFromWeightsOrFromText() {
        let weighted = ChartParse.words("Klima; 5\nWald; 3")
        XCTAssertEqual(weighted.map { $0.word }, ["Klima", "Wald"])
        XCTAssertEqual(weighted.map { $0.weight }, [5, 3])
        let counted = ChartParse.words("Wald Wald Baum")
        XCTAssertEqual(counted.map { $0.word }, ["wald", "baum"])
        XCTAssertEqual(counted.map { $0.weight }, [2, 1])
    }

    func testAnIndentedTextIsATree() {
        let tree = ChartParse.tree("A\n  B\n    C\n  D\nE")
        XCTAssertEqual(tree.texts, ["A", "B", "C", "D", "E"])
        XCTAssertEqual(tree.parents, [-1, 0, 1, 0, -1])
        XCTAssertEqual(tree.roots, [0, 4])
        XCTAssertEqual(tree.children[0], [1, 3])
    }

    func testTheMapKnowsAllSixteenStates() {
        XCTAssertEqual(GermanyTiles.all.count, 16)
        XCTAssertEqual(Set(GermanyTiles.all.map { $0.column * 10 + $0.row }).count, 16)
        XCTAssertTrue(GermanyTiles.all.allSatisfy { $0.column < GermanyTiles.columns && $0.row < GermanyTiles.rows })
        XCTAssertEqual(GermanyTiles.tile(named: "Baden-Württemberg")?.code, "BW")
        XCTAssertEqual(GermanyTiles.tile(named: "bayern")?.code, "BY")
        XCTAssertEqual(GermanyTiles.tile(named: "NW")?.code, "NW")
        XCTAssertEqual(GermanyTiles.tile(named: "Nordrhein Westfalen")?.code, "NW")
        XCTAssertNil(GermanyTiles.tile(named: "Atlantis"))
        let values = GermanyTiles.values("Bayern; 13,4\nBE; 3,9\nAtlantis; 1")
        XCTAssertEqual(values, ["BY": 13.4, "BE": 3.9])
    }

    func testEveryTypeComesWithSampleDataThatParses() {
        for type in ChartType.allCases {
            XCTAssertFalse(type.sample.isEmpty, type.rawValue)
            XCTAssertFalse(type.hint.isEmpty, type.rawValue)
            XCTAssertFalse(type.label.isEmpty, type.rawValue)
        }
        XCTAssertFalse(ChartParse.table(ChartType.column.sample).isEmpty)
        XCTAssertGreaterThan(ChartParse.flows(ChartType.sankey.sample).count, 5)
        XCTAssertGreaterThan(ChartParse.flows(ChartType.alluvial.sample).count, 5)
        XCTAssertGreaterThan(ChartParse.numbers(ChartType.histogram.sample).count, 20)
        XCTAssertEqual(ChartParse.groups(ChartType.boxplot.sample).count, 3)
        XCTAssertEqual(GermanyTiles.values(ChartType.geo.sample).count, 16)
        XCTAssertGreaterThan(ChartParse.edges(ChartType.network.sample).edges.count, 5)
        XCTAssertGreaterThan(ChartParse.words(ChartType.wordcloud.sample).count, 10)
        XCTAssertGreaterThan(ChartParse.tree(ChartType.orgchart.sample).texts.count, 5)
    }
}

final class ChartGeometryTests: XCTestCase {
    func testTicksAreRoundAndCoverTheRange() {
        let a = ChartGeometry.niceTicks(min: 0, max: 97, target: 5)
        XCTAssertEqual(a.ticks, [0, 20, 40, 60, 80, 100])
        XCTAssertEqual(a.lower, 0)
        XCTAssertEqual(a.upper, 100)
        let b = ChartGeometry.niceTicks(min: -3, max: 8, target: 5)
        XCTAssertEqual(b.lower, -5)
        XCTAssertEqual(b.upper, 10)
        // A single value still gets an axis.
        let c = ChartGeometry.niceTicks(min: 5, max: 5)
        XCTAssertLessThan(c.lower, c.upper)
        XCTAssertGreaterThanOrEqual(c.ticks.count, 2)
    }

    func testQuartilesWhiskersAndOutliers() {
        let sorted = [1.0, 2, 3, 4, 5]
        XCTAssertEqual(ChartGeometry.quantile(sorted, 0.5), 3)
        XCTAssertEqual(ChartGeometry.quantile(sorted, 0.25), 2)
        XCTAssertEqual(ChartGeometry.quantile(sorted, 0.75), 4)
        let stats = ChartGeometry.boxStats([1, 2, 3, 4, 5, 100])!
        XCTAssertEqual(stats.median, 3.5, accuracy: 1e-9)
        XCTAssertEqual(stats.outliers, [100])
        XCTAssertEqual(stats.lowWhisker, 1)
        XCTAssertEqual(stats.highWhisker, 5)
        XCTAssertNil(ChartGeometry.boxStats([1]))
    }

    func testHistogramCountsEveryValueOnce() {
        let values = [1.0, 2, 2, 3, 3, 3, 4, 4, 4, 4]
        let result = ChartGeometry.histogram(values)
        XCTAssertEqual(result.counts.reduce(0, +), values.count)
        XCTAssertEqual(result.edges.count, result.counts.count + 1)
        XCTAssertEqual(result.edges, result.edges.sorted())
        // All the same value: one filled class
        let same = ChartGeometry.histogram([2, 2, 2])
        XCTAssertEqual(same.counts.reduce(0, +), 3)
    }

    func testDensityIsPositiveAndEnclosesAboutOne() {
        let values = [48.0, 50, 52, 55, 60, 61, 62, 70]
        let curve = ChartGeometry.density(values, lower: 20, upper: 100, points: 200)
        XCTAssertEqual(curve.count, 200)
        XCTAssertTrue(curve.allSatisfy { $0.y >= 0 })
        let step = 80.0 / 199
        let area = curve.reduce(0) { $0 + $1.y * step }
        XCTAssertEqual(area, 1, accuracy: 0.05)
    }

    func testRegressionFindsALine() {
        let points = (0..<6).map { (x: Double($0), y: 2 * Double($0) + 1) }
        let fit = ChartGeometry.regression(points)!
        XCTAssertEqual(fit.slope, 2, accuracy: 1e-9)
        XCTAssertEqual(fit.intercept, 1, accuracy: 1e-9)
        XCTAssertEqual(fit.r, 1, accuracy: 1e-9)
        XCTAssertNil(ChartGeometry.regression([(x: 1, y: 1), (x: 2, y: 2)]))
    }

    func testTreemapFillsTheRectangleInProportion() {
        let values = [6.0, 6, 4, 3, 2, 2, 1]
        let frame = CGRect(x: 10, y: 20, width: 600, height: 400)
        let rects = ChartGeometry.squarify(values, in: frame)
        XCTAssertEqual(rects.count, values.count)
        XCTAssertEqual(rects.reduce(0) { $0 + $1.width * $1.height }, frame.width * frame.height, accuracy: 1)
        for rect in rects {
            XCTAssertGreaterThanOrEqual(rect.minX, frame.minX - 0.01)
            XCTAssertGreaterThanOrEqual(rect.minY, frame.minY - 0.01)
            XCTAssertLessThanOrEqual(rect.maxX, frame.maxX + 0.01)
            XCTAssertLessThanOrEqual(rect.maxY, frame.maxY + 0.01)
        }
        XCTAssertEqual((rects[0].width * rects[0].height) / (rects[2].width * rects[2].height), 6.0 / 4.0, accuracy: 0.01)
        XCTAssertEqual(ChartGeometry.squarify([0, 0], in: frame), [.zero, .zero])
    }

    func testFlowsKeepTheirAmountsAsBandWidths() {
        let flows: [(source: String, target: String, value: Double)] = [("A", "B", 10), ("A", "C", 5), ("B", "D", 10), ("C", "D", 5)]
        let layout = ChartGeometry.flowLayout(flows, height: 300, gap: 10)
        XCTAssertEqual(layout.columns, 3)
        let index = Dictionary(uniqueKeysWithValues: layout.nodes.enumerated().map { ($1.name, $0) })
        XCTAssertEqual(layout.nodes[index["A"]!].column, 0)
        XCTAssertEqual(layout.nodes[index["B"]!].column, 1)
        XCTAssertEqual(layout.nodes[index["D"]!].column, 2)
        // The bands leaving a node fill its height exactly.
        let leavingA = layout.links.filter { $0.source == index["A"]! }.reduce(0) { $0 + $1.thickness }
        XCTAssertEqual(leavingA, layout.nodes[index["A"]!].height, accuracy: 0.001)
        // Nodes of one column do not overlap and stay inside.
        let b = layout.nodes[index["B"]!]
        let c = layout.nodes[index["C"]!]
        XCTAssertLessThanOrEqual(b.y + b.height + 10, c.y + 0.001)
        XCTAssertGreaterThanOrEqual(b.y, 0)
        XCTAssertLessThanOrEqual(c.y + c.height, 300.001)
        // Stages decided by the caller
        let staged = ChartGeometry.flowLayout(flows, height: 300, gap: 10) { $0 == "A" ? 0 : 1 }
        XCTAssertEqual(staged.columns, 2)
        // Cycles do not hang
        let cycle = ChartGeometry.flowLayout([("A", "B", 1), ("B", "A", 1)], height: 100, gap: 4)
        XCTAssertEqual(cycle.nodes.count, 2)
    }

    func testChordArcsFillTheCircle() {
        let result = ChartGeometry.chord([[0, 10], [10, 0]])
        XCTAssertEqual(result.groups.count, 2)
        XCTAssertEqual(result.ribbons.count, 1)
        XCTAssertEqual(result.groups[0].start, 0, accuracy: 1e-9)
        XCTAssertEqual(result.groups[1].end, 2 * Double.pi - 0.04, accuracy: 1e-9)
        XCTAssertTrue(ChartGeometry.chord([[0, 0], [0, 0]]).groups.isEmpty)
    }

    func testTheNetworkLayoutRepeatsAndStaysInTheSquare() {
        let edges: [(from: Int, to: Int, weight: Double)] = [(0, 1, 1), (1, 2, 1), (2, 3, 1), (3, 0, 1), (3, 4, 2)]
        let first = ChartGeometry.forceLayout(count: 5, edges: edges)
        let second = ChartGeometry.forceLayout(count: 5, edges: edges)
        XCTAssertEqual(first, second)
        XCTAssertTrue(first.allSatisfy { $0.x >= 0 && $0.x <= 1 && $0.y >= 0 && $0.y <= 1 })
        // No two nodes on top of each other
        for i in 0..<5 {
            for j in (i + 1)..<5 { XCTAssertGreaterThan(hypot(first[i].x - first[j].x, first[i].y - first[j].y), 0.02) }
        }
        XCTAssertEqual(ChartGeometry.forceLayout(count: 1, edges: []), [CGPoint(x: 0.5, y: 0.5)])
        XCTAssertTrue(ChartGeometry.forceLayout(count: 0, edges: []).isEmpty)
    }

    func testATreeHasParentsOverTheirChildren() {
        let layout = ChartGeometry.treeLayout(ChartParse.tree("A\n  B\n  C"))
        XCTAssertEqual(layout.leaves, 2)
        XCTAssertEqual(layout.levels, 2)
        XCTAssertEqual(layout.x, [0.5, 0, 1])
        XCTAssertEqual(layout.depth, [0, 1, 1])
    }

    func testWordsDoNotOverlapAndStayInside() {
        let words = (1...14).map { (word: "Wort\($0)", weight: Double(15 - $0)) }
        let frame = CGRect(x: 0, y: 0, width: 600, height: 400)
        let placed = ChartGeometry.wordCloud(words, in: frame, maxSize: 60, minSize: 12) { word, size in
            CGSize(width: CGFloat(word.count) * size * 0.6, height: size * 1.2)
        }
        XCTAssertGreaterThan(placed.count, 8)
        for (index, item) in placed.enumerated() {
            XCTAssertTrue(frame.contains(item.frame))
            for other in placed[(index + 1)...] { XCTAssertFalse(item.frame.intersects(other.frame), "\(item.word) / \(other.word)") }
        }
        XCTAssertGreaterThan(placed[0].size, placed[placed.count - 1].size)
    }
}

/// Draws every diagram for real, so a wrong index or a division by zero shows up here and not on the student's iPad.
final class ChartDrawingTests: XCTestCase {
    private func inkedPixels(_ spec: ChartSpec, size: CGSize = CGSize(width: 560, height: 340), theme: SlideTheme = .quill) -> Int {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = false
        let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            ChartDrawing.draw(spec, in: CGRect(origin: .zero, size: size), theme: theme)
        }
        guard let cg = image.cgImage else { return 0 }
        let width = cg.width
        let height = cg.height
        var data = [UInt8](repeating: 0, count: width * height * 4)
        guard let context = CGContext(
            data: &data, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return 0 }
        context.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
        var count = 0
        for index in stride(from: 3, to: data.count, by: 4) where data[index] > 0 { count += 1 }
        return count
    }

    func testEveryTypeDrawsItsSampleData() {
        for type in ChartType.allCases {
            XCTAssertGreaterThan(inkedPixels(ChartSpec(type: type)), 800, type.rawValue)
        }
    }

    func testEveryTypeDrawsInEveryDesign() {
        for theme in [SlideTheme.quill, .night, .chalk] {
            for type in ChartType.allCases {
                XCTAssertGreaterThan(inkedPixels(ChartSpec(type: type, title: "Titel", unit: "%"), theme: theme), 800, "\(type.rawValue) \(theme.id)")
            }
        }
    }

    func testEveryTypeSurvivesBadData() {
        let inputs = [
            "", " ", "abc", ";;;;", "1", "-5; -5\n-5; -5", "a; 1e300\nb; -1e300", "x -> y; 1e300", "\n\n\n", "a; ; ; ;\n;;;",
            "A -> B; 1\nB -> A; 1\nA -> A; 1", String(repeating: "a; 1\n", count: 300), "  \n    \n  x\n        y",
            "; a; b\nc; 1; 2\nd", "0; 0\n0; 0\n0; 0", "1; 2; 3; 4; 5; 6; 7; 8; 9; 10; 11; 12; 13; 14; 15",
        ]
        for type in ChartType.allCases {
            for input in inputs {
                _ = inkedPixels(ChartSpec(type: type, data: input, title: "T", unit: "kg"))
                _ = inkedPixels(ChartSpec(type: type, data: input, showValues: false))
            }
        }
    }

    func testEveryTypeSurvivesTinyAndHugeFrames() {
        for type in ChartType.allCases {
            for size in [CGSize(width: 14, height: 14), CGSize(width: 40, height: 300), CGSize(width: 900, height: 60), CGSize(width: 1600, height: 900)] {
                _ = inkedPixels(ChartSpec(type: type), size: size)
            }
        }
    }

    func testNumbersAreFormattedLikeTheRestOfTheApp() {
        XCTAssertEqual(ChartDrawing.number(12.5), "12,5")
        XCTAssertEqual(ChartDrawing.number(1234), "1.234")
        XCTAssertEqual(ChartDrawing.number(3, unit: "%"), "3 %")
        XCTAssertEqual(ChartDrawing.number(.infinity), "–")
        XCTAssertFalse(ChartDrawing.number(1e20).isEmpty)
    }
}
