import Foundation

/// The drawing instruments of the notes: they lie on a page, move and rotate with two fingers, and pen strokes
/// along their edges come out straight.
enum InstrumentKind: String, CaseIterable, Identifiable {
    case ruler, setSquare, protractor, compass

    var id: String { rawValue }

    var label: String {
        switch self {
        case .ruler: return "Lineal"
        case .setSquare: return "Geodreieck"
        case .protractor: return "Winkelmesser"
        case .compass: return "Zirkel"
        }
    }

    var symbol: String {
        switch self {
        case .ruler: return "ruler"
        case .setSquare: return "triangle"
        case .protractor: return "angle"
        case .compass: return "circle.dashed"
        }
    }
}

/// Where an instrument lies on a page. Positions are in the page's canvas coordinates; `angle` turns it clockwise on
/// screen, in radians; `unitsPerCm` is how many canvas units one centimetre of the printed page has.
struct InstrumentPose: Equatable {
    var center: CGPoint
    var angle: Double = 0
    var unitsPerCm: Double
    /// The compass opening.
    var radiusCm: Double = 4
}

struct InstrumentSegment: Equatable {
    var start: CGPoint
    var end: CGPoint

    var length: Double { Instruments.distance(start, end) }
}

enum Instruments {
    /// PDF points in a centimetre: A4 is 595 points or 21 cm wide.
    static let pointsPerCm = 72 / 2.54

    /// Canvas units per centimetre for a page shown `canvasWidth` wide whose PDF page is `pageWidth` points wide.
    static func unitsPerCm(canvasWidth: Double, pageWidth: Double) -> Double {
        guard pageWidth > 0 else { return pointsPerCm }
        return canvasWidth / pageWidth * pointsPerCm
    }

    /// The PDF zoom at which a centimetre of the page is a centimetre on the glass: page points to screen points.
    static func trueScaleFactor(ppi: Double, screenScale: Double) -> Double {
        ppi / (72 * max(screenScale, 1))
    }

    // Shapes, in centimetres, with the instrument's own origin and axes

    /// A 17 cm ruler with a 16 cm scale.
    static let rulerHalfLength = 8.5
    static let rulerHalfHeight = 1.6
    /// A set square (Geodreieck): the long edge carries a millimetre scale from -7 to 7 cm with its zero at the origin.
    static let setSquareHalfLength = 8.4
    /// A half-circle protractor whose centre lies on its straight edge.
    static let protractorRadius = 6.2

    static func localOutline(_ kind: InstrumentKind) -> [CGPoint] {
        switch kind {
        case .ruler:
            let w = rulerHalfLength, h = rulerHalfHeight
            return [CGPoint(x: -w, y: -h), CGPoint(x: w, y: -h), CGPoint(x: w, y: h), CGPoint(x: -w, y: h)]
        case .setSquare:
            let w = setSquareHalfLength
            return [CGPoint(x: -w, y: 0), CGPoint(x: w, y: 0), CGPoint(x: 0, y: w)]
        case .protractor:
            let r = protractorRadius
            return (0...36).map { step in
                let angle = Double.pi * Double(step) / 36
                return CGPoint(x: r * cos(angle), y: -r * sin(angle))
            }
        case .compass:
            return []
        }
    }

    static func localEdges(_ kind: InstrumentKind) -> [InstrumentSegment] {
        switch kind {
        case .ruler:
            let w = rulerHalfLength, h = rulerHalfHeight
            return [
                InstrumentSegment(start: CGPoint(x: -w, y: -h), end: CGPoint(x: w, y: -h)),
                InstrumentSegment(start: CGPoint(x: -w, y: h), end: CGPoint(x: w, y: h)),
            ]
        case .setSquare:
            let w = setSquareHalfLength
            return [
                InstrumentSegment(start: CGPoint(x: -w, y: 0), end: CGPoint(x: w, y: 0)),
                InstrumentSegment(start: CGPoint(x: -w, y: 0), end: CGPoint(x: 0, y: w)),
                InstrumentSegment(start: CGPoint(x: w, y: 0), end: CGPoint(x: 0, y: w)),
            ]
        case .protractor:
            let r = protractorRadius
            return [InstrumentSegment(start: CGPoint(x: -r, y: 0), end: CGPoint(x: r, y: 0))]
        case .compass:
            return []
        }
    }

    /// The smallest rectangle around the shape, in centimetres.
    static func localBounds(_ kind: InstrumentKind) -> CGRect {
        let outline = localOutline(kind)
        guard let first = outline.first else { return .zero }
        var minX = first.x, maxX = first.x, minY = first.y, maxY = first.y
        for point in outline {
            minX = min(minX, point.x)
            maxX = max(maxX, point.x)
            minY = min(minY, point.y)
            maxY = max(maxY, point.y)
        }
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    // Page and instrument coordinates

    static func toPage(_ local: CGPoint, _ pose: InstrumentPose) -> CGPoint {
        let x = Double(local.x) * pose.unitsPerCm
        let y = Double(local.y) * pose.unitsPerCm
        let c = cos(pose.angle), s = sin(pose.angle)
        return CGPoint(x: Double(pose.center.x) + x * c - y * s, y: Double(pose.center.y) + x * s + y * c)
    }

    static func toLocal(_ page: CGPoint, _ pose: InstrumentPose) -> CGPoint {
        let dx = Double(page.x - pose.center.x)
        let dy = Double(page.y - pose.center.y)
        let c = cos(pose.angle), s = sin(pose.angle)
        let scale = max(pose.unitsPerCm, 0.0001)
        return CGPoint(x: (dx * c + dy * s) / scale, y: (-dx * s + dy * c) / scale)
    }

    static func edges(_ kind: InstrumentKind, _ pose: InstrumentPose) -> [InstrumentSegment] {
        localEdges(kind).map { InstrumentSegment(start: toPage($0.start, pose), end: toPage($0.end, pose)) }
    }

    static func contains(_ point: CGPoint, _ kind: InstrumentKind, _ pose: InstrumentPose) -> Bool {
        let polygon = localOutline(kind)
        guard polygon.count >= 3 else { return false }
        let p = toLocal(point, pose)
        var inside = false
        var j = polygon.count - 1
        for i in polygon.indices {
            let a = polygon[i], b = polygon[j]
            if (a.y > p.y) != (b.y > p.y), p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x {
                inside.toggle()
            }
            j = i
        }
        return inside
    }

    // Snapping

    /// The edge closest to `point` when it is no further than `band` canvas units away from it.
    static func nearestEdge(to point: CGPoint, _ kind: InstrumentKind, _ pose: InstrumentPose, band: Double) -> Int? {
        var best: (index: Int, distance: Double)?
        for (index, edge) in edges(kind, pose).enumerated() {
            let distance = distance(point, project(point, onto: edge))
            if distance <= band, distance < (best?.distance ?? .infinity) { best = (index, distance) }
        }
        return best?.index
    }

    /// The point of the edge closest to `point`.
    static func project(_ point: CGPoint, onto edge: InstrumentSegment) -> CGPoint {
        let dx = Double(edge.end.x - edge.start.x), dy = Double(edge.end.y - edge.start.y)
        let lengthSquared = dx * dx + dy * dy
        guard lengthSquared > 0 else { return edge.start }
        let t = ((Double(point.x - edge.start.x)) * dx + Double(point.y - edge.start.y) * dy) / lengthSquared
        let clamped = min(max(t, 0), 1)
        return CGPoint(x: Double(edge.start.x) + clamped * dx, y: Double(edge.start.y) + clamped * dy)
    }

    /// The unit vector from an edge away from the instrument, so a line drawn along it lies beside it.
    static func outwardNormal(of index: Int, _ kind: InstrumentKind, _ pose: InstrumentPose) -> CGPoint {
        let edge = edges(kind, pose)[index]
        let dx = Double(edge.end.x - edge.start.x), dy = Double(edge.end.y - edge.start.y)
        let length = max((dx * dx + dy * dy).squareRoot(), 0.0001)
        var normal = CGPoint(x: -dy / length, y: dx / length)
        let middle = CGPoint(x: (edge.start.x + edge.end.x) / 2, y: (edge.start.y + edge.end.y) / 2)
        let body = toPage(centroid(kind), pose)
        if Double(normal.x) * Double(body.x - middle.x) + Double(normal.y) * Double(body.y - middle.y) > 0 {
            normal = CGPoint(x: -normal.x, y: -normal.y)
        }
        return normal
    }

    /// The straight line a pen draws along an edge: from where it started to where it is now, both moved onto the
    /// edge and `offset` units outwards.
    static func snappedLine(from start: CGPoint, to current: CGPoint, edge index: Int, _ kind: InstrumentKind, _ pose: InstrumentPose, offset: Double) -> InstrumentSegment {
        let edge = edges(kind, pose)[index]
        let normal = outwardNormal(of: index, kind, pose)
        func place(_ point: CGPoint) -> CGPoint {
            let onEdge = project(point, onto: edge)
            return CGPoint(x: Double(onEdge.x) + Double(normal.x) * offset, y: Double(onEdge.y) + Double(normal.y) * offset)
        }
        return InstrumentSegment(start: place(start), end: place(current))
    }

    /// Straightens a freehand stroke to the edge it was drawn along, or nil when it was drawn elsewhere.
    static func snapStroke(_ points: [CGPoint], _ kind: InstrumentKind, _ pose: InstrumentPose, band: Double, offset: Double) -> InstrumentSegment? {
        guard let first = points.first, let last = points.last,
              let index = nearestEdge(to: first, kind, pose, band: band)
        else { return nil }
        return snappedLine(from: first, to: last, edge: index, kind, pose, offset: offset)
    }

    // Angles

    /// The angle of a line against the page's horizontal, counterclockwise like in maths, from 0 up to 180 degrees.
    static func lineDegrees(_ a: CGPoint, _ b: CGPoint) -> Double {
        let degrees = atan2(-Double(b.y - a.y), Double(b.x - a.x)) * 180 / .pi
        return normalized(degrees, period: 180)
    }

    /// How far the instrument's main edge is turned against the page's horizontal, like `lineDegrees`.
    static func rotationDegrees(_ pose: InstrumentPose) -> Double {
        normalized(-pose.angle * 180 / .pi, period: 180)
    }

    /// Rotation lands on whole degrees, and on multiples of 45 degrees when it is within 2 degrees of one.
    static func snapRotation(_ angle: Double) -> Double {
        let degrees = angle * 180 / .pi
        let nearest45 = (degrees / 45).rounded() * 45
        let snapped = abs(degrees - nearest45) <= 2 ? nearest45 : degrees.rounded()
        return snapped * .pi / 180
    }

    /// A ray from the protractor's centre towards `point`, at whole degrees measured from its straight edge, and
    /// the degrees; nil when the point is below the straight edge.
    static func protractorRay(to point: CGPoint, _ pose: InstrumentPose) -> (end: CGPoint, degrees: Int)? {
        let local = toLocal(point, pose)
        let length = (Double(local.x * local.x + local.y * local.y)).squareRoot()
        guard length > 0.05 else { return nil }
        var degrees = Int((atan2(-Double(local.y), Double(local.x)) * 180 / .pi).rounded())
        if degrees < 0 {
            // Just below the edge counts as the edge itself.
            guard degrees >= -10 || degrees <= -170 else { return nil }
            degrees = degrees >= -10 ? 0 : 180
        }
        let radians = Double(degrees) * .pi / 180
        let end = toPage(CGPoint(x: length * cos(radians), y: -length * sin(radians)), pose)
        return (end, degrees)
    }

    // Compass

    /// Where the compass pencil is: the pin at the pose's centre, opened `radiusCm` in the direction of `angle`.
    static func compassTip(_ pose: InstrumentPose) -> CGPoint {
        let radius = pose.radiusCm * pose.unitsPerCm
        return CGPoint(x: Double(pose.center.x) + radius * cos(pose.angle), y: Double(pose.center.y) + radius * sin(pose.angle))
    }

    /// The compass opening for a pencil at `point`, in whole millimetres, at least 2 mm.
    static func compassRadius(to point: CGPoint, _ pose: InstrumentPose) -> Double {
        let cm = distance(point, pose.center) / max(pose.unitsPerCm, 0.0001)
        return max(0.2, (cm * 10).rounded() / 10)
    }

    static func direction(from center: CGPoint, to point: CGPoint) -> Double {
        atan2(Double(point.y - center.y), Double(point.x - center.x))
    }

    /// The change from one direction to the next, taking the short way round, so sweeps add up past a full turn.
    static func angleStep(from previous: Double, to next: Double) -> Double {
        var step = next - previous
        while step > .pi { step -= 2 * .pi }
        while step <= -.pi { step += 2 * .pi }
        return step
    }

    /// Points along an arc around `center`, starting at `start` and turning by `sweep` radians (at most a full
    /// circle), about one point per degree.
    static func arc(center: CGPoint, radius: Double, start: Double, sweep: Double) -> [CGPoint] {
        let clamped = min(max(sweep, -2 * .pi), 2 * .pi)
        let steps = max(1, Int((abs(clamped) * 180 / .pi).rounded(.up)))
        return (0...steps).map { step in
            let angle = start + clamped * Double(step) / Double(steps)
            return CGPoint(x: Double(center.x) + radius * cos(angle), y: Double(center.y) + radius * sin(angle))
        }
    }

    // Lines

    /// Points along a segment about `spacing` apart, so the ink looks the same as a drawn stroke.
    static func sampled(_ segment: InstrumentSegment, spacing: Double) -> [CGPoint] {
        let steps = max(1, Int((segment.length / max(spacing, 0.1)).rounded(.up)))
        return (0...steps).map { step in
            let t = Double(step) / Double(steps)
            return CGPoint(
                x: Double(segment.start.x) + Double(segment.end.x - segment.start.x) * t,
                y: Double(segment.start.y) + Double(segment.end.y - segment.start.y) * t
            )
        }
    }

    static func centimetres(_ length: Double, _ pose: InstrumentPose) -> Double {
        length / max(pose.unitsPerCm, 0.0001)
    }

    /// "5,3 cm": one decimal with a comma, as written in German.
    static func formatCm(_ value: Double) -> String {
        String(format: "%.1f", value).replacingOccurrences(of: ".", with: ",") + " cm"
    }

    static func formatDegrees(_ value: Double) -> String {
        "\(Int(value.rounded()) % 360)°"
    }

    static func distance(_ a: CGPoint, _ b: CGPoint) -> Double {
        let dx = Double(a.x - b.x), dy = Double(a.y - b.y)
        return (dx * dx + dy * dy).squareRoot()
    }

    private static func centroid(_ kind: InstrumentKind) -> CGPoint {
        let outline = localOutline(kind)
        guard !outline.isEmpty else { return .zero }
        let x = outline.reduce(0.0) { $0 + Double($1.x) } / Double(outline.count)
        let y = outline.reduce(0.0) { $0 + Double($1.y) } / Double(outline.count)
        return CGPoint(x: x, y: y)
    }

    private static func normalized(_ degrees: Double, period: Double) -> Double {
        var value = degrees.truncatingRemainder(dividingBy: period)
        if value < 0 { value += period }
        if value >= period - 0.0001 { value = 0 }
        return value
    }
}
