import Foundation
#if canImport(CoreGraphics)
import CoreGraphics
#endif

/// The paper of a notebook page or of a page added to a PDF.
enum PaperStyle: String, CaseIterable, Codable, Identifiable {
    case blank, lined, grid, dotted

    var id: String { rawValue }

    var label: String {
        switch self {
        case .blank: return "Blanko"
        case .lined: return "Liniert"
        case .grid: return "Kariert"
        case .dotted: return "Punkte"
        }
    }

    /// Line distance in points on an A4 page: school ruling is 8 mm lines and 5 mm squares.
    var spacing: CGFloat {
        switch self {
        case .lined: return 22.7
        case .grid, .dotted: return 14.2
        case .blank: return 0
        }
    }
}

enum NoteTextStyle: String, CaseIterable, Codable {
    case title, heading, body, small, handwriting

    var label: String {
        switch self {
        case .title: return "Überschrift 1"
        case .heading: return "Überschrift 2"
        case .body: return "Text"
        case .small: return "Klein"
        case .handwriting: return "Handschrift"
        }
    }

    var size: CGFloat {
        switch self {
        case .title: return 26
        case .heading: return 20
        case .body: return 15
        case .small: return 12
        case .handwriting: return 20
        }
    }

    var isBold: Bool { self == .title || self == .heading }
}

enum NoteTextAlign: String, CaseIterable, Codable {
    case left, center, right
}

/// Something placed on a page besides ink: typed text, a picture or a sticker. Frames are in the coordinates of
/// the page's drawing canvas, like the ink.
struct PageAnnotation: Codable, Equatable, Identifiable {
    enum Kind: String, Codable {
        case text, image, sticker
    }

    var id = UUID().uuidString
    var page: Int
    var kind: Kind
    var x: CGFloat
    var y: CGFloat
    var width: CGFloat
    var height: CGFloat
    var text = ""
    var style: NoteTextStyle = .body
    var color: UInt32 = 0x16150F
    var align: NoteTextAlign = .left
    /// A text box shows its frame; typed text flows like a paragraph.
    var boxed = false
    /// File name of a picture in the note images folder.
    var image: String?
    /// A size of its own instead of the style's, like a calculated result written as large as the line before it.
    var fontSize: CGFloat?

    var textSize: CGFloat { fontSize ?? style.size }

    var frame: CGRect {
        get { CGRect(x: x, y: y, width: width, height: height) }
        set {
            x = newValue.minX
            y = newValue.minY
            width = newValue.width
            height = newValue.height
        }
    }
}

/// Everything besides ink that belongs to a document: annotations, bookmarks and the canvas size of each page,
/// which maps canvas coordinates to the PDF page for export and thumbnails.
struct DocumentNotes: Codable, Equatable {
    var annotations: [PageAnnotation] = []
    var bookmarks: Set<Int> = []
    var canvasSizes: [Int: CGSize] = [:]

    /// Pages from `index` on move `count` back: that many pages were inserted at `index`.
    mutating func insertPage(at index: Int, count: Int = 1) {
        for i in annotations.indices where annotations[i].page >= index { annotations[i].page += count }
        bookmarks = Set(bookmarks.map { $0 >= index ? $0 + count : $0 })
        canvasSizes = PageShift.inserting(canvasSizes, at: index, count: count)
    }

    /// The page at `index` is gone with its annotations; later pages move forward.
    mutating func deletePage(at index: Int) {
        annotations.removeAll { $0.page == index }
        for i in annotations.indices where annotations[i].page > index { annotations[i].page -= 1 }
        bookmarks = Set(bookmarks.compactMap { $0 == index ? nil : ($0 > index ? $0 - 1 : $0) })
        canvasSizes = PageShift.deleting(canvasSizes, at: index)
    }

    func annotations(on page: Int) -> [PageAnnotation] {
        annotations.filter { $0.page == page }
    }
}

/// Moving page-keyed data when pages are inserted or deleted; also used for the ink.
enum PageShift {
    static func inserting<Value>(_ values: [Int: Value], at index: Int, count: Int = 1) -> [Int: Value] {
        Dictionary(uniqueKeysWithValues: values.map { ($0.key >= index ? $0.key + count : $0.key, $0.value) })
    }

    static func deleting<Value>(_ values: [Int: Value], at index: Int) -> [Int: Value] {
        Dictionary(uniqueKeysWithValues: values.compactMap { key, value in
            key == index ? nil : (key > index ? key - 1 : key, value)
        })
    }
}

/// Turns a hand-drawn stroke into a clean line, triangle, rectangle, polygon or ellipse, as the shape tool does.
enum ShapeRecognizer {
    enum Shape: Equatable {
        case line(CGPoint, CGPoint)
        case polygon([CGPoint])
        case ellipse(CGRect)

        /// Points close enough together that the ink follows straight edges and sharp corners.
        func outline(step: CGFloat = 4) -> [CGPoint] {
            switch self {
            case let .line(a, b):
                return densify([a, b], step: step)
            case let .polygon(corners):
                return densify(corners + [corners[0]], step: step)
            case let .ellipse(rect):
                let count = 96
                return (0...count).map { index in
                    let angle = Double(index) / Double(count) * 2 * .pi
                    return CGPoint(x: rect.midX + rect.width / 2 * CGFloat(cos(angle)), y: rect.midY + rect.height / 2 * CGFloat(sin(angle)))
                }
            }
        }

        private func densify(_ points: [CGPoint], step: CGFloat) -> [CGPoint] {
            var result: [CGPoint] = []
            for (a, b) in zip(points, points.dropFirst()) {
                let count = max(1, Int(distance(a, b) / step))
                for index in 0..<count {
                    let t = CGFloat(index) / CGFloat(count)
                    result.append(CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t))
                }
                // The corner twice, so the curve through the points does not round it off.
                result.append(b)
            }
            if let last = points.last { result.append(last) }
            return result
        }
    }

    static func recognize(_ points: [CGPoint]) -> Shape? {
        guard points.count >= 2, let first = points.first, let last = points.last else { return nil }
        let bounds = boundingBox(points)
        let diagonal = hypot(bounds.width, bounds.height)
        guard diagonal > 12 else { return nil }
        let length = zip(points, points.dropFirst()).reduce(0) { $0 + distance($1.0, $1.1) }

        // Open strokes: a straight line if every point stays close to the chord.
        let closed = distance(first, last) < max(18, diagonal * 0.2) && length > diagonal * 1.6
        if !closed {
            let chord = distance(first, last)
            guard chord > 12 else { return nil }
            let deviation = points.map { distanceToSegment($0, first, last) }.max() ?? 0
            return deviation < max(6, chord * 0.08) ? .line(first, last) : nil
        }

        // Closed strokes: corners from a simplified outline decide between polygon and ellipse.
        let corners = mergeClose(simplify(points, epsilon: diagonal * 0.07), minimum: diagonal * 0.12)
        let ellipseError = ellipseFit(points, in: bounds)
        if corners.count == 3 {
            return .polygon(corners)
        }
        if corners.count == 4 {
            if isAxisAligned(corners) { return .polygon(rectangleCorners(bounds)) }
            return ellipseError < 0.06 ? .ellipse(bounds) : .polygon(corners)
        }
        if ellipseError < 0.16 {
            // Nearly round becomes a circle.
            let ratio = bounds.width / max(bounds.height, 1)
            if ratio > 0.88, ratio < 1.14 {
                let side = (bounds.width + bounds.height) / 2
                return .ellipse(CGRect(x: bounds.midX - side / 2, y: bounds.midY - side / 2, width: side, height: side))
            }
            return .ellipse(bounds)
        }
        if (5...6).contains(corners.count) { return .polygon(corners) }
        return nil
    }

    // Geometry

    static func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        hypot(a.x - b.x, a.y - b.y)
    }

    static func boundingBox(_ points: [CGPoint]) -> CGRect {
        let xs = points.map(\.x)
        let ys = points.map(\.y)
        let minX = xs.min() ?? 0
        let minY = ys.min() ?? 0
        return CGRect(x: minX, y: minY, width: (xs.max() ?? 0) - minX, height: (ys.max() ?? 0) - minY)
    }

    static func distanceToSegment(_ p: CGPoint, _ a: CGPoint, _ b: CGPoint) -> CGFloat {
        let dx = b.x - a.x
        let dy = b.y - a.y
        let lengthSquared = dx * dx + dy * dy
        guard lengthSquared > 0 else { return distance(p, a) }
        let t = max(0, min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
        return distance(p, CGPoint(x: a.x + t * dx, y: a.y + t * dy))
    }

    /// Ramer–Douglas–Peucker on a closed outline: the far point from the start splits it into two open halves.
    static func simplify(_ points: [CGPoint], epsilon: CGFloat) -> [CGPoint] {
        guard points.count > 3, let start = points.first else { return points }
        let farIndex = points.indices.max { distance(points[$0], start) < distance(points[$1], start) } ?? 0
        let firstHalf = openSimplify(Array(points[0...farIndex]), epsilon: epsilon)
        let secondHalf = openSimplify(Array(points[farIndex...]) + [start], epsilon: epsilon)
        return Array(firstHalf.dropLast()) + Array(secondHalf.dropLast())
    }

    private static func openSimplify(_ points: [CGPoint], epsilon: CGFloat) -> [CGPoint] {
        guard points.count > 2, let first = points.first, let last = points.last else { return points }
        var farIndex = 0
        var farDistance: CGFloat = 0
        for index in 1..<(points.count - 1) {
            let d = distanceToSegment(points[index], first, last)
            if d > farDistance {
                farDistance = d
                farIndex = index
            }
        }
        guard farDistance > epsilon else { return [first, last] }
        let left = openSimplify(Array(points[0...farIndex]), epsilon: epsilon)
        let right = openSimplify(Array(points[farIndex...]), epsilon: epsilon)
        return Array(left.dropLast()) + right
    }

    /// Corners closer than `minimum` are one corner (a stroke that overlaps where it started).
    private static func mergeClose(_ corners: [CGPoint], minimum: CGFloat) -> [CGPoint] {
        var result: [CGPoint] = []
        for corner in corners where !result.contains(where: { distance($0, corner) < minimum }) {
            result.append(corner)
        }
        return result
    }

    /// Mean deviation of the points from the ellipse inscribed in their bounding box, relative to its radius.
    static func ellipseFit(_ points: [CGPoint], in bounds: CGRect) -> CGFloat {
        let a = max(bounds.width / 2, 1)
        let b = max(bounds.height / 2, 1)
        let errors = points.map { point -> CGFloat in
            let nx = (point.x - bounds.midX) / a
            let ny = (point.y - bounds.midY) / b
            return abs(sqrt(nx * nx + ny * ny) - 1)
        }
        return errors.reduce(0, +) / CGFloat(max(errors.count, 1))
    }

    private static func isAxisAligned(_ corners: [CGPoint]) -> Bool {
        zip(corners, corners.dropFirst() + [corners[0]]).allSatisfy { a, b in
            let angle = abs(atan2(b.y - a.y, b.x - a.x) * 180 / .pi).truncatingRemainder(dividingBy: 90)
            return angle < 14 || angle > 76
        }
    }

    private static func rectangleCorners(_ rect: CGRect) -> [CGPoint] {
        [CGPoint(x: rect.minX, y: rect.minY), CGPoint(x: rect.maxX, y: rect.minY), CGPoint(x: rect.maxX, y: rect.maxY), CGPoint(x: rect.minX, y: rect.maxY)]
    }
}
