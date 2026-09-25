import XCTest
@testable import Lernwerk

final class InstrumentsTests: XCTestCase {
    private let a4 = InstrumentPose(center: CGPoint(x: 300, y: 400), unitsPerCm: Instruments.pointsPerCm)

    func testUnitsPerCmFollowsTheDisplayedPageWidth() {
        XCTAssertEqual(Instruments.unitsPerCm(canvasWidth: 595, pageWidth: 595), 28.3465, accuracy: 0.001)
        XCTAssertEqual(Instruments.unitsPerCm(canvasWidth: 1190, pageWidth: 595), 56.693, accuracy: 0.001)
        // 21 cm of A4 fill the canvas, whatever its width.
        XCTAssertEqual(800 / Instruments.unitsPerCm(canvasWidth: 800, pageWidth: 595.28), 21, accuracy: 0.01)
    }

    func testTrueScaleFactorMakesACentimetreACentimetre() {
        // An iPad with 264 pixels per inch at 2x: a page point must be 1.83 screen points.
        let factor = Instruments.trueScaleFactor(ppi: 264, screenScale: 2)
        XCTAssertEqual(factor, 1.8333, accuracy: 0.001)
        let screenPointsPerCm = Instruments.pointsPerCm * factor
        let pixelsPerCm = screenPointsPerCm * 2
        XCTAssertEqual(pixelsPerCm, 264 / 2.54, accuracy: 0.01)
    }

    func testPageAndLocalCoordinatesRoundTrip() {
        var pose = a4
        pose.angle = 0.7
        let local = CGPoint(x: 3.2, y: -1.1)
        let back = Instruments.toLocal(Instruments.toPage(local, pose), pose)
        XCTAssertEqual(back.x, local.x, accuracy: 0.0001)
        XCTAssertEqual(back.y, local.y, accuracy: 0.0001)
    }

    func testRotationTurnsClockwiseOnScreen() {
        var pose = a4
        pose.angle = .pi / 2
        let point = Instruments.toPage(CGPoint(x: 1, y: 0), pose)
        XCTAssertEqual(point.x, 300, accuracy: 0.001)
        XCTAssertEqual(point.y, 400 + Instruments.pointsPerCm, accuracy: 0.001)
    }

    func testContainsFollowsTheShape() {
        XCTAssertTrue(Instruments.contains(CGPoint(x: 300, y: 400), .ruler, a4))
        XCTAssertFalse(Instruments.contains(CGPoint(x: 300, y: 400 + 2 * Instruments.pointsPerCm), .ruler, a4))
        // The set square lies below its long edge.
        XCTAssertTrue(Instruments.contains(CGPoint(x: 300, y: 400 + 3 * Instruments.pointsPerCm), .setSquare, a4))
        XCTAssertFalse(Instruments.contains(CGPoint(x: 300, y: 400 - 1 * Instruments.pointsPerCm), .setSquare, a4))
        XCTAssertFalse(Instruments.contains(CGPoint(x: 300 + 7 * Instruments.pointsPerCm, y: 400 + 3 * Instruments.pointsPerCm), .setSquare, a4))
        // The protractor lies above its straight edge.
        XCTAssertTrue(Instruments.contains(CGPoint(x: 300, y: 400 - 3 * Instruments.pointsPerCm), .protractor, a4))
        XCTAssertFalse(Instruments.contains(CGPoint(x: 300, y: 400 + 1 * Instruments.pointsPerCm), .protractor, a4))
        XCTAssertFalse(Instruments.contains(CGPoint(x: 300, y: 400), .compass, a4))
    }

    func testNearestEdgeWithinBand() {
        let cm = Instruments.pointsPerCm
        let aboveTop = CGPoint(x: 320, y: 400 - 1.6 * cm - 10)
        XCTAssertEqual(Instruments.nearestEdge(to: aboveTop, .ruler, a4, band: 20), 0)
        let belowBottom = CGPoint(x: 320, y: 400 + 1.6 * cm + 10)
        XCTAssertEqual(Instruments.nearestEdge(to: belowBottom, .ruler, a4, band: 20), 1)
        XCTAssertNil(Instruments.nearestEdge(to: CGPoint(x: 320, y: 400 - 1.6 * cm - 40), .ruler, a4, band: 20))
        XCTAssertNil(Instruments.nearestEdge(to: .zero, .compass, a4, band: 1000))
    }

    func testSnappedLineRunsAlongTheEdgeOutside() {
        let cm = Instruments.pointsPerCm
        let line = Instruments.snappedLine(
            from: CGPoint(x: 250, y: 400 - 1.6 * cm - 8),
            to: CGPoint(x: 350, y: 400 - 1.6 * cm - 15),
            edge: 0, .ruler, a4, offset: 2
        )
        XCTAssertEqual(line.start.y, 400 - 1.6 * cm - 2, accuracy: 0.001)
        XCTAssertEqual(line.end.y, line.start.y, accuracy: 0.001)
        XCTAssertEqual(line.start.x, 250, accuracy: 0.001)
        XCTAssertEqual(line.end.x, 350, accuracy: 0.001)
    }

    func testSnappedLineIsClampedToTheEdge() {
        let line = Instruments.snappedLine(from: CGPoint(x: 300, y: 350), to: CGPoint(x: 2000, y: 350), edge: 0, .ruler, a4, offset: 0)
        XCTAssertEqual(line.end.x, 300 + 8.5 * Instruments.pointsPerCm, accuracy: 0.001)
    }

    func testSetSquareLegsAreAt45Degrees() {
        let edges = Instruments.edges(.setSquare, a4)
        XCTAssertEqual(edges.count, 3)
        XCTAssertEqual(Instruments.lineDegrees(edges[0].start, edges[0].end), 0, accuracy: 0.001)
        XCTAssertEqual(Instruments.lineDegrees(edges[1].start, edges[1].end), 135, accuracy: 0.001)
        XCTAssertEqual(Instruments.lineDegrees(edges[2].start, edges[2].end), 45, accuracy: 0.001)
    }

    func testOutwardNormalPointsAwayFromTheBody() {
        let top = Instruments.outwardNormal(of: 0, .ruler, a4)
        XCTAssertEqual(top.y, -1, accuracy: 0.001)
        let bottom = Instruments.outwardNormal(of: 1, .ruler, a4)
        XCTAssertEqual(bottom.y, 1, accuracy: 0.001)
        let hypotenuse = Instruments.outwardNormal(of: 0, .setSquare, a4)
        XCTAssertEqual(hypotenuse.y, -1, accuracy: 0.001)
    }

    func testSnapStrokeStraightensAWobblyLine() {
        let cm = Instruments.pointsPerCm
        let y = 400 + 1.6 * cm + 6
        let wobbly = stride(from: 200.0, through: 380, by: 10).map { CGPoint(x: $0, y: y + ($0.truncatingRemainder(dividingBy: 20) == 0 ? 3 : -3)) }
        let line = Instruments.snapStroke(wobbly, .ruler, a4, band: 20, offset: 1.5)
        XCTAssertNotNil(line)
        XCTAssertEqual(line?.start.y ?? 0, 400 + 1.6 * cm + 1.5, accuracy: 0.001)
        XCTAssertEqual(line?.end.y ?? 0, 400 + 1.6 * cm + 1.5, accuracy: 0.001)
        XCTAssertNil(Instruments.snapStroke([CGPoint(x: 10, y: 10), CGPoint(x: 50, y: 50)], .ruler, a4, band: 20, offset: 0))
    }

    func testLineDegreesAreCounterclockwise() {
        XCTAssertEqual(Instruments.lineDegrees(.zero, CGPoint(x: 10, y: -10)), 45, accuracy: 0.001)
        XCTAssertEqual(Instruments.lineDegrees(.zero, CGPoint(x: 10, y: 10)), 135, accuracy: 0.001)
        XCTAssertEqual(Instruments.lineDegrees(.zero, CGPoint(x: -10, y: 0)), 0, accuracy: 0.001)
        XCTAssertEqual(Instruments.lineDegrees(.zero, CGPoint(x: 0, y: 10)), 90, accuracy: 0.001)
    }

    func testRotationDegreesAndSnapping() {
        var pose = a4
        pose.angle = -30 * .pi / 180
        XCTAssertEqual(Instruments.rotationDegrees(pose), 30, accuracy: 0.001)
        XCTAssertEqual(Instruments.snapRotation(31.4 * .pi / 180) * 180 / .pi, 31, accuracy: 0.0001)
        XCTAssertEqual(Instruments.snapRotation(43.5 * .pi / 180) * 180 / .pi, 45, accuracy: 0.0001)
        XCTAssertEqual(Instruments.snapRotation(-88.6 * .pi / 180) * 180 / .pi, -90, accuracy: 0.0001)
        XCTAssertEqual(Instruments.snapRotation(0.4 * .pi / 180), 0, accuracy: 0.0001)
    }

    func testProtractorRayUsesWholeDegrees() {
        let cm = Instruments.pointsPerCm
        let target = CGPoint(x: 300 + 4 * cm * cos(0.52), y: 400 - 4 * cm * sin(0.52))
        let ray = Instruments.protractorRay(to: target, a4)
        XCTAssertEqual(ray?.degrees, 30)
        XCTAssertEqual(Instruments.distance(ray?.end ?? .zero, a4.center), 4 * cm, accuracy: 0.01)
        XCTAssertEqual(Instruments.lineDegrees(a4.center, ray?.end ?? .zero), 30, accuracy: 0.001)
        // A little below the edge is still the edge; far below is no angle.
        XCTAssertEqual(Instruments.protractorRay(to: CGPoint(x: 300 + 4 * cm, y: 400 + 0.2 * cm), a4)?.degrees, 0)
        XCTAssertEqual(Instruments.protractorRay(to: CGPoint(x: 300 - 4 * cm, y: 400 + 0.2 * cm), a4)?.degrees, 180)
        XCTAssertNil(Instruments.protractorRay(to: CGPoint(x: 300, y: 400 + 3 * cm), a4))
    }

    func testCompassRadiusIsInMillimetres() {
        let cm = Instruments.pointsPerCm
        XCTAssertEqual(Instruments.compassRadius(to: CGPoint(x: 300 + 3.04 * cm, y: 400), a4), 3.0, accuracy: 0.0001)
        XCTAssertEqual(Instruments.compassRadius(to: CGPoint(x: 300, y: 400 + 5.26 * cm), a4), 5.3, accuracy: 0.0001)
        XCTAssertEqual(Instruments.compassRadius(to: CGPoint(x: 300, y: 400), a4), 0.2, accuracy: 0.0001)
        var pose = a4
        pose.radiusCm = 2
        pose.angle = .pi
        let tip = Instruments.compassTip(pose)
        XCTAssertEqual(tip.x, 300 - 2 * cm, accuracy: 0.001)
        XCTAssertEqual(tip.y, 400, accuracy: 0.001)
    }

    func testAngleStepTakesTheShortWayAndSweepsAddUp() {
        XCTAssertEqual(Instruments.angleStep(from: 3.0, to: -3.0), 2 * .pi - 6, accuracy: 0.0001)
        XCTAssertEqual(Instruments.angleStep(from: -3.0, to: 3.0), -(2 * .pi - 6), accuracy: 0.0001)
        var sweep = 0.0
        var previous = 0.0
        for step in 1...40 {
            let next = Instruments.direction(from: .zero, to: CGPoint(x: cos(Double(step) * 0.2), y: sin(Double(step) * 0.2)))
            sweep += Instruments.angleStep(from: previous, to: next)
            previous = next
        }
        XCTAssertEqual(sweep, 8, accuracy: 0.0001)
    }

    func testArcStaysOnTheCircleAndStopsAtAFullTurn() {
        let points = Instruments.arc(center: CGPoint(x: 10, y: 10), radius: 50, start: 0, sweep: 10)
        XCTAssertEqual(points.count, 361)
        for point in points {
            XCTAssertEqual(Instruments.distance(point, CGPoint(x: 10, y: 10)), 50, accuracy: 0.0001)
        }
        XCTAssertEqual(points.first?.x ?? 0, points.last?.x ?? 1, accuracy: 0.0001)
        let quarter = Instruments.arc(center: .zero, radius: 10, start: 0, sweep: -.pi / 2)
        XCTAssertEqual(quarter.last?.y ?? 0, -10, accuracy: 0.0001)
    }

    func testSampledLineAndFormatting() {
        let points = Instruments.sampled(InstrumentSegment(start: .zero, end: CGPoint(x: 10, y: 0)), spacing: 3)
        XCTAssertEqual(points.count, 5)
        XCTAssertEqual(points.last?.x ?? 0, 10, accuracy: 0.0001)
        XCTAssertEqual(Instruments.formatCm(5.26), "5,3 cm")
        XCTAssertEqual(Instruments.formatDegrees(44.6), "45°")
        XCTAssertEqual(Instruments.centimetres(56.693, a4), 2, accuracy: 0.001)
    }

    func testLocalBoundsCoverTheShapes() {
        XCTAssertEqual(Instruments.localBounds(.ruler).width, 17, accuracy: 0.0001)
        XCTAssertEqual(Instruments.localBounds(.setSquare).height, 8.4, accuracy: 0.0001)
        XCTAssertEqual(Instruments.localBounds(.protractor).minY, -6.2, accuracy: 0.0001)
        XCTAssertEqual(Instruments.localBounds(.compass), .zero)
    }
}
