import Foundation
#if canImport(CoreGraphics)
import CoreGraphics
#endif

/// The maths of the selection lasso: which points and rectangles lie inside a hand-drawn loop.
enum LassoGeometry {
    /// Whether a point lies inside a closed polygon (ray casting; the last point joins the first).
    static func contains(_ polygon: [CGPoint], _ point: CGPoint) -> Bool {
        guard polygon.count >= 3 else { return false }
        var inside = false
        var previous = polygon[polygon.count - 1]
        for current in polygon {
            if (current.y > point.y) != (previous.y > point.y) {
                let crossing = (previous.x - current.x) * (point.y - current.y) / (previous.y - current.y) + current.x
                if point.x < crossing { inside.toggle() }
            }
            previous = current
        }
        return inside
    }

    /// The share of `points` inside the polygon, 0 for none.
    static func share(of points: [CGPoint], inside polygon: [CGPoint]) -> Double {
        guard !points.isEmpty else { return 0 }
        return Double(points.filter { contains(polygon, $0) }.count) / Double(points.count)
    }

    /// Nine points spread over a rectangle: its corners, edge middles and center.
    static func samples(of rect: CGRect) -> [CGPoint] {
        var points: [CGPoint] = []
        for row in 0..<3 {
            for column in 0..<3 {
                points.append(CGPoint(x: rect.minX + rect.width * CGFloat(column) / 2, y: rect.minY + rect.height * CGFloat(row) / 2))
            }
        }
        return points
    }

    /// Whether the loop takes in a rectangle: at least half of its sample points lie inside.
    static func selects(_ polygon: [CGPoint], rect: CGRect) -> Bool {
        share(of: samples(of: rect), inside: polygon) >= 0.5
    }

    static func bounds(of points: [CGPoint]) -> CGRect {
        guard let first = points.first else { return .null }
        var minX = first.x, maxX = first.x, minY = first.y, maxY = first.y
        for point in points {
            minX = min(minX, point.x)
            maxX = max(maxX, point.x)
            minY = min(minY, point.y)
            maxY = max(maxY, point.y)
        }
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    /// A rectangle grown by `margin` and kept inside `limit`.
    static func padded(_ rect: CGRect, by margin: CGFloat, within limit: CGRect) -> CGRect {
        rect.insetBy(dx: -margin, dy: -margin).intersection(limit)
    }
}
