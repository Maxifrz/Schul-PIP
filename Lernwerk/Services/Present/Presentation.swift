import Foundation

/// Slides are 960 × 540 points: 16:9 and exactly PowerPoint's widescreen size (13.333 × 7.5 in).
enum SlideSize {
    static let width: Double = 960
    static let height: Double = 540
}

enum ElementKind: String, Codable {
    case text = "TEXT"
    case shape = "SHAPE"
    case image = "IMAGE"
}

enum ShapeType: String, Codable, CaseIterable {
    case rect = "RECT"
    case rounded = "ROUNDED"
    case ellipse = "ELLIPSE"
    case line = "LINE"
    case arrow = "ARROW"
}

enum SlideTextAlign: String, Codable, CaseIterable {
    case left = "LEFT"
    case center = "CENTER"
    case right = "RIGHT"
}

enum TextAnchor: String, Codable {
    case top = "TOP"
    case middle = "MIDDLE"
    case bottom = "BOTTOM"
}

/// One freely placed object on a slide. Frames are in slide points, rotation in degrees clockwise around the
/// frame's center. Colors are theme tokens ("text", "muted", "accent", "surface", "background"), "#RRGGBB" or "none".
/// The JSON matches the Android app.
struct SlideElement: Codable, Equatable, Identifiable {
    var id = UUID().uuidString
    var kind: ElementKind
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var rotation: Double = 0
    var text = ""
    var fontSize: Double = 24
    var bold = false
    var italic = false
    var align: SlideTextAlign = .left
    var anchor: TextAnchor = .top
    var bullets = false
    var textColor = "text"
    var shape: ShapeType = .rect
    var fill = "accent"
    var stroke = "none"
    var strokeWidth: Double = 0
    var image: String?

    init(
        id: String = UUID().uuidString, kind: ElementKind, x: Double, y: Double, width: Double, height: Double,
        rotation: Double = 0, text: String = "", fontSize: Double = 24, bold: Bool = false, italic: Bool = false,
        align: SlideTextAlign = .left, anchor: TextAnchor = .top, bullets: Bool = false, textColor: String = "text",
        shape: ShapeType = .rect, fill: String = "accent", stroke: String = "none", strokeWidth: Double = 0, image: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.rotation = rotation
        self.text = text
        self.fontSize = fontSize
        self.bold = bold
        self.italic = italic
        self.align = align
        self.anchor = anchor
        self.bullets = bullets
        self.textColor = textColor
        self.shape = shape
        self.fill = fill
        self.stroke = stroke
        self.strokeWidth = strokeWidth
        self.image = image
    }

    enum CodingKeys: String, CodingKey {
        case id, kind, x, y, width, height, rotation, text, fontSize, bold, italic, align, anchor, bullets, textColor
        case shape, fill, stroke, strokeWidth, image
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        kind = try c.decode(ElementKind.self, forKey: .kind)
        x = try c.decodeIfPresent(Double.self, forKey: .x) ?? 0
        y = try c.decodeIfPresent(Double.self, forKey: .y) ?? 0
        width = try c.decodeIfPresent(Double.self, forKey: .width) ?? 100
        height = try c.decodeIfPresent(Double.self, forKey: .height) ?? 100
        rotation = try c.decodeIfPresent(Double.self, forKey: .rotation) ?? 0
        text = try c.decodeIfPresent(String.self, forKey: .text) ?? ""
        fontSize = try c.decodeIfPresent(Double.self, forKey: .fontSize) ?? 24
        bold = try c.decodeIfPresent(Bool.self, forKey: .bold) ?? false
        italic = try c.decodeIfPresent(Bool.self, forKey: .italic) ?? false
        align = (try? c.decodeIfPresent(SlideTextAlign.self, forKey: .align)) ?? .left
        anchor = (try? c.decodeIfPresent(TextAnchor.self, forKey: .anchor)) ?? .top
        bullets = try c.decodeIfPresent(Bool.self, forKey: .bullets) ?? false
        textColor = try c.decodeIfPresent(String.self, forKey: .textColor) ?? "text"
        shape = (try? c.decodeIfPresent(ShapeType.self, forKey: .shape)) ?? .rect
        fill = try c.decodeIfPresent(String.self, forKey: .fill) ?? "accent"
        stroke = try c.decodeIfPresent(String.self, forKey: .stroke) ?? "none"
        strokeWidth = try c.decodeIfPresent(Double.self, forKey: .strokeWidth) ?? 0
        image = try c.decodeIfPresent(String.self, forKey: .image)
    }

    var centerX: Double { x + width / 2 }
    var centerY: Double { y + height / 2 }

    var isLine: Bool { kind == .shape && (shape == .line || shape == .arrow) }

    /// Whether a slide point lies inside the frame, taking rotation into account.
    func contains(_ px: Double, _ py: Double, slop: Double = 0) -> Bool {
        let (lx, ly) = toLocal(px, py)
        let extra = isLine ? max(slop, 10) : slop
        return lx >= -extra && lx <= width + extra && ly >= -extra && ly <= height + extra
    }

    /// Converts a slide point into the element's unrotated coordinates, origin at its top left.
    func toLocal(_ px: Double, _ py: Double) -> (Double, Double) {
        let radians = -rotation * .pi / 180
        let dx = px - centerX
        let dy = py - centerY
        return (dx * cos(radians) - dy * sin(radians) + width / 2, dx * sin(radians) + dy * cos(radians) + height / 2)
    }

    /// Converts a point in the element's unrotated coordinates back to slide coordinates.
    func toSlide(_ lx: Double, _ ly: Double) -> (Double, Double) {
        let radians = rotation * .pi / 180
        let dx = lx - width / 2
        let dy = ly - height / 2
        return (dx * cos(radians) - dy * sin(radians) + centerX, dx * sin(radians) + dy * cos(radians) + centerY)
    }
}

struct SourceRef: Codable, Equatable {
    var materialId: String?
    var page: Int
}

struct Slide: Codable, Equatable, Identifiable {
    var id = UUID().uuidString
    var elements: [SlideElement] = []
    var notes = ""
    var sources: [SourceRef] = []

    init(id: String = UUID().uuidString, elements: [SlideElement] = [], notes: String = "", sources: [SourceRef] = []) {
        self.id = id
        self.elements = elements
        self.notes = notes
        self.sources = sources
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        elements = try c.decodeIfPresent([SlideElement].self, forKey: .elements) ?? []
        notes = try c.decodeIfPresent(String.self, forKey: .notes) ?? ""
        sources = try c.decodeIfPresent([SourceRef].self, forKey: .sources) ?? []
    }
}

struct Presentation: Codable, Equatable, Identifiable {
    var id = UUID().uuidString
    var title: String
    var themeId = SlideTheme.quill.id
    /// Milliseconds since 1970, like the Android app.
    var createdAt = Int64(Date().timeIntervalSince1970 * 1000)
    var updatedAt = Int64(Date().timeIntervalSince1970 * 1000)
    var slides: [Slide] = []
    var materialIds: [String] = []
    /// Planned talk length, used for speaker notes.
    var minutes = 10

    init(id: String = UUID().uuidString, title: String, themeId: String = SlideTheme.quill.id, slides: [Slide] = [], materialIds: [String] = [], minutes: Int = 10) {
        self.id = id
        self.title = title
        self.themeId = themeId
        self.slides = slides
        self.materialIds = materialIds
        self.minutes = minutes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Präsentation"
        themeId = try c.decodeIfPresent(String.self, forKey: .themeId) ?? SlideTheme.quill.id
        createdAt = try c.decodeIfPresent(Int64.self, forKey: .createdAt) ?? 0
        updatedAt = try c.decodeIfPresent(Int64.self, forKey: .updatedAt) ?? createdAt
        slides = try c.decodeIfPresent([Slide].self, forKey: .slides) ?? []
        materialIds = try c.decodeIfPresent([String].self, forKey: .materialIds) ?? []
        minutes = try c.decodeIfPresent(Int.self, forKey: .minutes) ?? 10
    }

    var theme: SlideTheme { SlideTheme.byID(themeId) }
    var updatedDate: Date { Date(timeIntervalSince1970: Double(updatedAt) / 1000) }
}

/// A slide design: colors for the tokens elements refer to.
struct SlideTheme: Equatable, Identifiable {
    let id: String
    let name: String
    let background: UInt32
    let text: UInt32
    let muted: UInt32
    let accent: UInt32
    let surface: UInt32

    /// Resolves a token or "#RRGGBB" to 0xRRGGBB, or nil for "none".
    func color(_ value: String) -> UInt32? {
        switch value {
        case "none", "": return nil
        case "text": return text
        case "muted": return muted
        case "accent": return accent
        case "surface": return surface
        case "background": return background
        default:
            return UInt32(value.hasPrefix("#") ? String(value.dropFirst()) : value, radix: 16)
        }
    }

    static let quill = SlideTheme(id: "quill", name: "Quill", background: 0xFAF9F6, text: 0x16150F, muted: 0x6E6B62, accent: 0x7FA98C, surface: 0xEEEDE9)
    static let night = SlideTheme(id: "nacht", name: "Nacht", background: 0x171714, text: 0xF1EFE7, muted: 0x9B978D, accent: 0x8FBE9C, surface: 0x2A2923)
    static let chalk = SlideTheme(id: "kreide", name: "Kreide", background: 0x2F4A3A, text: 0xF4F1E8, muted: 0xC9D3C4, accent: 0xE8C872, surface: 0x3B5A48)
    static let paper = SlideTheme(id: "papier", name: "Papier", background: 0xFFFFFF, text: 0x1F2A44, muted: 0x5B6478, accent: 0x3D6FB6, surface: 0xEEF2F8)
    static let all = [quill, night, chalk, paper]

    static func byID(_ id: String) -> SlideTheme {
        all.first { $0.id == id } ?? quill
    }
}

/// Fixed colors offered in the editor besides the theme tokens.
let swatchColors = ["text", "muted", "accent", "surface", "background", "#C46A55", "#C9974F", "#3D6FB6", "#FFFFFF", "#000000"]

/// Geometry for the editor's handles and guides.
enum SlideGeometry {
    static let minSize: Double = 16

    enum Corner: Int, CaseIterable {
        case topLeft, topRight, bottomRight, bottomLeft

        var fx: Double { self == .topRight || self == .bottomRight ? 1 : 0 }
        var fy: Double { self == .bottomLeft || self == .bottomRight ? 1 : 0 }
        var opposite: Corner { Corner(rawValue: (rawValue + 2) % 4)! }
    }

    static func corner(_ element: SlideElement, _ corner: Corner) -> (Double, Double) {
        element.toSlide(corner.fx * element.width, corner.fy * element.height)
    }

    /// Moves `corner` of `base` to (px, py) while the opposite corner stays put.
    static func resize(_ base: SlideElement, corner: Corner, to px: Double, _ py: Double, keepAspect: Bool) -> SlideElement {
        let anchorX = corner.opposite.fx * base.width
        let anchorY = corner.opposite.fy * base.height
        let (lx, ly) = base.toLocal(px, py)
        let growsRight = corner.fx > corner.opposite.fx
        let growsDown = corner.fy > corner.opposite.fy
        var width = max(minSize, growsRight ? lx - anchorX : anchorX - lx)
        var height = max(minSize, growsDown ? ly - anchorY : anchorY - ly)
        if keepAspect, base.height > 0 {
            let aspect = base.width / base.height
            if width / height > aspect { height = width / aspect } else { width = height * aspect }
        }
        let centerLocalX = anchorX + (growsRight ? width : -width) / 2
        let centerLocalY = anchorY + (growsDown ? height : -height) / 2
        let (cx, cy) = base.toSlide(centerLocalX, centerLocalY)
        var result = base
        result.x = cx - width / 2
        result.y = cy - height / 2
        result.width = width
        result.height = height
        return result
    }

    /// Moves one end of a line; the other end stays where it is.
    static func moveLineEnd(_ base: SlideElement, start: Bool, to px: Double, _ py: Double) -> SlideElement {
        let (fixedX, fixedY) = base.toSlide(start ? base.width : 0, base.height / 2)
        let (sx, sy) = start ? (px, py) : (fixedX, fixedY)
        let (ex, ey) = start ? (fixedX, fixedY) : (px, py)
        let length = max(minSize, hypot(ex - sx, ey - sy))
        var result = base
        result.rotation = atan2(ey - sy, ex - sx) * 180 / .pi
        result.width = length
        result.x = (sx + ex) / 2 - length / 2
        result.y = (sy + ey) / 2 - base.height / 2
        return result
    }

    /// Rotation so that the handle above the element points at (px, py); snaps to 15° steps nearby.
    static func rotation(_ base: SlideElement, towards px: Double, _ py: Double) -> Double {
        let angle = atan2(py - base.centerY, px - base.centerX) * 180 / .pi + 90
        let normalized = (angle.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        let snapped = (normalized / 15).rounded() * 15
        return (abs(snapped - normalized) < 4 ? snapped : normalized).truncatingRemainder(dividingBy: 360)
    }

    struct Snap: Equatable {
        var dx: Double
        var dy: Double
        var verticalGuides: [Double]
        var horizontalGuides: [Double]
    }

    /// Snaps a moved element's edges and center to the slide's edges and center and to the other elements.
    static func snap(_ moved: SlideElement, others: [SlideElement], threshold: Double) -> Snap {
        let xs: [Double] = [0, SlideSize.width / 2, SlideSize.width] + others.flatMap { element -> [Double] in
            [element.x, element.centerX, element.x + element.width]
        }
        let ys: [Double] = [0, SlideSize.height / 2, SlideSize.height] + others.flatMap { element -> [Double] in
            [element.y, element.centerY, element.y + element.height]
        }
        func best(_ values: [Double], _ targets: [Double]) -> (Double, Double)? {
            values.flatMap { value in targets.map { ($0 - value, $0) } }
                .filter { abs($0.0) <= threshold }
                .min { abs($0.0) < abs($1.0) }
        }
        let bx = best([moved.x, moved.centerX, moved.x + moved.width], xs)
        let by = best([moved.y, moved.centerY, moved.y + moved.height], ys)
        return Snap(dx: bx?.0 ?? 0, dy: by?.0 ?? 0, verticalGuides: bx.map { [$0.1] } ?? [], horizontalGuides: by.map { [$0.1] } ?? [])
    }

    /// A frame for a picture of the given size, fitted into the box and centered.
    static func fit(width: Double, height: Double, into box: (x: Double, y: Double, width: Double, height: Double)) -> (x: Double, y: Double, width: Double, height: Double) {
        let scale = min(box.width / width, box.height / height)
        let w = width * scale
        let h = height * scale
        return (box.x + (box.width - w) / 2, box.y + (box.height - h) / 2, w, h)
    }
}
