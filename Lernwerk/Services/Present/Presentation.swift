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
    /// "heading" for titles, "body" for other text, empty to decide by size (older decks); see `SlideDesign`.
    var font = ""
    /// How the element comes in while presenting; nil for none. Previews, thumbnails and exports show it in place.
    var animation: ElementAnimation?
    /// Elements with the same group id, like the parts of a module dropped from the library, move together.
    var group: String?

    init(
        id: String = UUID().uuidString, kind: ElementKind, x: Double, y: Double, width: Double, height: Double,
        rotation: Double = 0, text: String = "", fontSize: Double = 24, bold: Bool = false, italic: Bool = false,
        align: SlideTextAlign = .left, anchor: TextAnchor = .top, bullets: Bool = false, textColor: String = "text",
        shape: ShapeType = .rect, fill: String = "accent", stroke: String = "none", strokeWidth: Double = 0, image: String? = nil,
        font: String = "", animation: ElementAnimation? = nil, group: String? = nil
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
        self.font = font
        self.animation = animation
        self.group = group
    }

    enum CodingKeys: String, CodingKey {
        case id, kind, x, y, width, height, rotation, text, fontSize, bold, italic, align, anchor, bullets, textColor
        case shape, fill, stroke, strokeWidth, image, font, animation, group
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
        font = try c.decodeIfPresent(String.self, forKey: .font) ?? ""
        // Newer than the first decks: a value this version cannot read is dropped, not a reason to lose the deck.
        animation = (try? c.decodeIfPresent(ElementAnimation.self, forKey: .animation)) ?? nil
        group = try c.decodeIfPresent(String.self, forKey: .group)
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
    /// Text on an imported picture slide (a PDF page), so the AI can read what the picture shows.
    var extractedText = ""
    /// "#RRGGBB", or empty for the theme's background.
    var background = ""
    /// How the slide comes in while presenting; nil keeps the short cross-fade.
    var transition: SlideTransition?
    /// The component, parameters and content the slide was built from; nil once a student edits an element or for
    /// slides that were not built by a component. Only slides with an origin can be redesigned.
    var origin: SlideOrigin?

    init(
        id: String = UUID().uuidString, elements: [SlideElement] = [], notes: String = "", sources: [SourceRef] = [],
        extractedText: String = "", background: String = "", transition: SlideTransition? = nil, origin: SlideOrigin? = nil
    ) {
        self.id = id
        self.elements = elements
        self.notes = notes
        self.sources = sources
        self.extractedText = extractedText
        self.background = background
        self.transition = transition
        self.origin = origin
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        elements = try c.decodeIfPresent([SlideElement].self, forKey: .elements) ?? []
        notes = try c.decodeIfPresent(String.self, forKey: .notes) ?? ""
        sources = try c.decodeIfPresent([SourceRef].self, forKey: .sources) ?? []
        extractedText = try c.decodeIfPresent(String.self, forKey: .extractedText) ?? ""
        background = try c.decodeIfPresent(String.self, forKey: .background) ?? ""
        transition = (try? c.decodeIfPresent(SlideTransition.self, forKey: .transition)) ?? nil
        origin = (try? c.decodeIfPresent(SlideOrigin.self, forKey: .origin)) ?? nil
    }

    /// The elements as the component drew them: an animation is a setting on top of the design, not part of it.
    private static func design(_ elements: [SlideElement]) -> [SlideElement] {
        elements.map { element in
            var copy = element
            copy.animation = nil
            return copy
        }
    }

    /// This slide after a change made to `old`: an edit of the elements the slide's component did not make drops the
    /// origin, because the slide no longer is what the component built. A change that sets a new origin keeps it.
    func editedFrom(_ old: Slide) -> Slide {
        guard origin != nil, origin == old.origin, Self.design(elements) != Self.design(old.elements) else { return self }
        var result = self
        result.origin = nil
        return result
    }

    func backgroundColor(_ theme: SlideTheme) -> UInt32 {
        theme.color(background) ?? theme.background
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

/// A slide design: colors for the tokens elements refer to, a heading and a body font, and decorations drawn behind
/// every slide (see `SlideDesign`). The first four are the original designs and look as they always did.
struct SlideTheme: Equatable, Identifiable {
    let id: String
    let name: String
    let background: UInt32
    let text: UInt32
    let muted: UInt32
    let accent: UInt32
    let surface: UInt32
    /// A second color for decorations.
    var accent2: UInt32? = nil
    var heading: SlideFont = .workSans
    var body: SlideFont = .workSans
    var decor: DecorStyle = .none
    /// How round the rounded shapes are: 1 is the usual corner, 0 makes them square.
    var cornerScale: Double = 1
    /// Subjects and moods the design suits, for the AI's suggestion.
    var mood = ""

    var secondAccent: UInt32 { accent2 ?? accent }

    /// How wide the heading and the body font set text compared to Work Sans, for fitting text into its box.
    var headingWidth: Double { heading.widthFactor }
    var bodyWidth: Double { body.widthFactor }

    /// The corner radius of a rounded shape of this size, as a fraction of its shorter side (PowerPoint's `adj`).
    var cornerFraction: Double { 0.16667 * cornerScale }

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

    static let quill = SlideTheme(
        id: "quill", name: "Quill", background: 0xFAF9F6, text: 0x16150F, muted: 0x6E6B62, accent: 0x7FA98C, surface: 0xEEEDE9,
        mood: "ruhig, neutral, passt zu allem"
    )
    static let night = SlideTheme(
        id: "nacht", name: "Nacht", background: 0x171714, text: 0xF1EFE7, muted: 0x9B978D, accent: 0x8FBE9C, surface: 0x2A2923,
        mood: "dunkel, für abgedunkelte Räume, neutral"
    )
    static let chalk = SlideTheme(
        id: "kreide", name: "Kreide", background: 0x2F4A3A, text: 0xF4F1E8, muted: 0xC9D3C4, accent: 0xE8C872, surface: 0x3B5A48,
        mood: "Tafel, Mathematik, Unterricht, Erklären"
    )
    static let paper = SlideTheme(
        id: "papier", name: "Papier", background: 0xFFFFFF, text: 0x1F2A44, muted: 0x5B6478, accent: 0x3D6FB6, surface: 0xEEF2F8,
        mood: "klassisch, schlicht, druckfreundlich"
    )
    static let editorial = SlideTheme(
        id: "editorial", name: "Editorial", background: 0xF7F5F0, text: 0x1B2530, muted: 0x5E6773, accent: 0x155F99,
        surface: 0xE4ECF3, accent2: 0x9DCAEA, heading: .playfair, body: .dmSans, decor: .frame,
        mood: "Deutsch, Literatur, Geschichte, Philosophie, Kunst, Referate mit Zitaten"
    )
    static let verdant = SlideTheme(
        id: "verdant", name: "Verdant", background: 0xFBFCF8, text: 0x03362D, muted: 0x4F6B60, accent: 0x285F20,
        surface: 0xE1EADA, accent2: 0xB4CFA2, heading: .lora, body: .dmSans, decor: .corners,
        mood: "Biologie, Umwelt, Erdkunde, Ernährung, Nachhaltigkeit"
    )
    static let nova = SlideTheme(
        id: "nova", name: "Nova", background: 0x0B1A2E, text: 0xF2F6FB, muted: 0x9FB2C8, accent: 0x5B9BE6,
        surface: 0x16294A, accent2: 0x8A63E0, heading: .montserrat, body: .dmSans, decor: .glow,
        mood: "Physik, Astronomie, Informatik, Technik, Zukunftsthemen"
    )
    static let momentum = SlideTheme(
        id: "momentum", name: "Momentum", background: 0xF6F7FC, text: 0x111633, muted: 0x5A6280, accent: 0x213EBB,
        surface: 0xDDE3F5, accent2: 0x7D92D8, heading: .archivoBlack, body: .dmSans, decor: .band,
        mood: "Wirtschaft, Politik, Sozialkunde, Statistik, Umfragen"
    )
    static let mosaik = SlideTheme(
        id: "mosaik", name: "Mosaik", background: 0xFFFFFF, text: 0x1A1919, muted: 0x5B5B66, accent: 0x6A57E8,
        surface: 0xEFEDFD, accent2: 0xBDE5A8, heading: .montserrat, body: .montserrat, decor: .blocks,
        mood: "Kunst, Musik, Medien, Projekte, jüngere Klassen"
    )
    static let signal = SlideTheme(
        id: "signal", name: "Signal", background: 0xFFFBF7, text: 0x1D1311, muted: 0x6D5955, accent: 0xA9531A,
        surface: 0xFBE9E1, accent2: 0xF4C9D6, heading: .archivoBlack, body: .workSans, decor: .band,
        mood: "Werbung, Debatte, Religion, Ethik, Meinungsthemen"
    )
    static let zivil = SlideTheme(
        id: "zivil", name: "Zivil", background: 0xECECEC, text: 0x111111, muted: 0x555555, accent: 0x111111,
        surface: 0xDADADA, accent2: 0x8E8E8E, heading: .montserrat, body: .workSans, decor: .railLeft,
        mood: "Politik, Recht, Gesellschaft, Geschichte des 20. Jahrhunderts, sachlich"
    )
    static let horizont = SlideTheme(
        id: "horizont", name: "Horizont", background: 0xFAF6F0, text: 0x321A00, muted: 0x7A5C3E, accent: 0xA65300,
        surface: 0xF0DFCC, accent2: 0xC49A6C, heading: .lora, body: .montserrat, decor: .circles,
        mood: "Geschichte, Antike, Reisen, Architektur, Länderporträts"
    )
    static let puls = SlideTheme(
        id: "puls", name: "Puls", background: 0xFFFFFF, text: 0x18324A, muted: 0x4B6175, accent: 0x2F6FD0,
        surface: 0xE6F0FF, accent2: 0xC6DDFF, heading: .dmSans, body: .dmSans, decor: .railRight,
        mood: "Chemie, Medizin, Gesundheit, Sport, Psychologie"
    )
    static let violett = SlideTheme(
        id: "violett", name: "Violett", background: 0xF8F7FB, text: 0x1B1530, muted: 0x5F587A, accent: 0x7A48E0,
        surface: 0xEEEAF9, accent2: 0xC9B8F5, heading: .montserrat, body: .dmSans, decor: .circles,
        mood: "Mathematik, Informatik, Logik, Ethik"
    )
    static let glut = SlideTheme(
        id: "glut", name: "Glut", background: 0x171717, text: 0xF5F5F5, muted: 0xA3A3A3, accent: 0xE26C2C,
        surface: 0x262626, accent2: 0x983608, heading: .archivoBlack, body: .montserrat, decor: .band,
        mood: "Sport, Revolutionen, Kriege, Dramatisches, starke Thesen"
    )
    static let frische = SlideTheme(
        id: "frische", name: "Frische", background: 0xF2FCFF, text: 0x111827, muted: 0x4B5563, accent: 0x0E7C90,
        surface: 0xD6F5FB, accent2: 0x9A9CF4, heading: .montserrat, body: .dmSans, decor: .blocks,
        mood: "Englisch, Französisch, Spanisch, Sprachen, locker"
    )
    static let wahrzeichen = SlideTheme(
        id: "wahrzeichen", name: "Wahrzeichen", background: 0xF7F5F3, text: 0x111111, muted: 0x5E5E5E, accent: 0xC8102E,
        surface: 0xECE7E3, accent2: 0xE86666, heading: .playfair, body: .workSans, decor: .railLeft,
        mood: "Geschichte, Architektur, Städte, Kultur, Denkmäler"
    )


    static let all = [quill, night, chalk, paper, editorial, verdant, nova, momentum, mosaik, signal, zivil, horizont, puls, violett, glut, frische, wahrzeichen]
        + DesignCatalog.additional

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
