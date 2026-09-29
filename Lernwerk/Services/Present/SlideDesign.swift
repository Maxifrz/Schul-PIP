import Foundation

/// A typeface for slides, bundled with the app and named the same in the PowerPoint export. Fonts meant only for
/// headings have a single bold cut that stands in for every style.
enum SlideFont: String, CaseIterable {
    case workSans, dmSans, montserrat, playfair, lora, archivoBlack
    /// System fonts of iOS and of PowerPoint; not bundled with the app.
    case georgia, courier

    /// The family name PowerPoint looks for.
    var pptxName: String {
        switch self {
        case .workSans: return "Work Sans"
        case .dmSans: return "DM Sans"
        case .montserrat: return "Montserrat"
        case .playfair: return "Playfair Display"
        case .lora: return "Lora"
        case .archivoBlack: return "Archivo Black"
        case .georgia: return "Georgia"
        case .courier: return "Courier New"
        }
    }

    /// PostScript names, which are also the bundled file names (for the system fonts: the names iOS knows them by).
    var regular: String {
        switch self {
        case .workSans: return "WorkSans-Regular"
        case .dmSans: return "DMSans-Regular"
        case .montserrat: return "Montserrat-Regular"
        case .playfair: return "PlayfairDisplay-Bold"
        case .lora: return "Lora-Bold"
        case .archivoBlack: return "ArchivoBlack-Regular"
        case .georgia: return "Georgia"
        case .courier: return "CourierNewPSMT"
        }
    }

    var bold: String {
        switch self {
        case .workSans: return "WorkSans-SemiBold"
        case .dmSans: return "DMSans-Bold"
        case .montserrat: return "Montserrat-Bold"
        case .georgia: return "Georgia-Bold"
        case .courier: return "CourierNewPS-BoldMT"
        default: return regular
        }
    }

    var italic: String {
        switch self {
        case .workSans: return "WorkSans-Italic"
        case .dmSans: return "DMSans-Italic"
        case .montserrat: return "Montserrat-Italic"
        case .georgia: return "Georgia-Italic"
        case .courier: return "CourierNewPS-ItalicMT"
        default: return regular
        }
    }

    /// The bold italic cut, for the fonts that have one; the others draw italic with a thin outline on top.
    var boldItalic: String {
        switch self {
        case .georgia: return "Georgia-BoldItalic"
        case .courier: return "CourierNewPS-BoldItalicMT"
        default: return italic
        }
    }

    var hasBoldItalic: Bool { boldItalic != italic }

    /// Fonts the system provides; they are neither bundled nor registered.
    var isSystem: Bool { self == .georgia || self == .courier }

    /// How much wider than Work Sans the font sets German text, for the estimates that size text to fit its box.
    /// The bundled fonts are already scaled to Work Sans' width (see `scale`), so their factor is 1; the system
    /// fonts are drawn at their real size and sized to fit instead.
    var widthFactor: Double {
        switch self {
        case .georgia: return 1.06
        case .courier: return 1.12
        default: return 1
        }
    }

    /// Whether the font has real bold and italic cuts; heading fonts are bold throughout.
    var hasStyles: Bool { bold != regular }

    /// Keeps text as wide and as tall as Work Sans, for which the layouts size text to fit its box: measured from
    /// each font's average glyph width on German text and its line height, never above 1.
    var scale: Double {
        switch self {
        case .workSans, .montserrat, .archivoBlack, .georgia, .courier: return 1
        case .dmSans: return 0.95
        case .playfair: return 0.93
        case .lora: return 0.96
        }
    }

    /// Every bundled file, for registering them.
    static var files: [String] {
        var names: [String] = []
        for font in allCases where !font.isSystem {
            for name in [font.regular, font.bold, font.italic] where !names.contains(name) { names.append(name) }
        }
        return names
    }
}

/// Shapes a design draws behind every slide: frames, corner circles, glows, bands, rails, color blocks.
enum DecorStyle: String {
    case none, frame, corners, glow, band, railLeft, railRight, blocks, circles
}

/// The parts of a design that are not colors: which font a text uses and the decorations. Both are worked out when
/// drawing, so switching the design restyles every slide, and editing a slide never touches them. Mirrors the
/// Android app; the PowerPoint export writes the decorations as ordinary shapes.
enum SlideDesign {
    /// The theme id for "let the AI choose" while creating a deck.
    static let auto = "auto"

    /// Every design with the subjects it suits, for the AI to choose from.
    static var catalog: String {
        SlideTheme.all.map { "- \($0.id): \($0.name) – \($0.mood)" }.joined(separator: "\n")
    }

    /// The designs whose subjects the text mentions, most mentions first and in catalog order on a tie; designs the
    /// text does not touch are left out.
    static func ranked(_ text: String) -> [String] {
        let haystack = text.lowercased()
        let scored: [(id: String, score: Int)] = SlideTheme.all.map { theme in
            let keywords = theme.mood.lowercased().components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
            return (theme.id, keywords.filter { !$0.isEmpty && haystack.contains($0) }.count)
        }
        return scored.enumerated().filter { $0.element.score > 0 }
            .sorted { $0.element.score != $1.element.score ? $0.element.score > $1.element.score : $0.offset < $1.offset }
            .map(\.element.id)
    }

    /// The design for a topic without the AI's choice: the one whose subjects the text mentions most often, the
    /// first on a tie, Quill if none fits.
    static func suggest(_ text: String) -> String {
        ranked(text).first ?? SlideTheme.quill.id
    }

    /// The AI's choice if it named a design, otherwise `suggest` on the topic.
    static func resolve(_ chosen: String, fallback text: String) -> String {
        let id = chosen.trimmingCharacters(in: .whitespaces).lowercased()
        return SlideTheme.all.contains { $0.id == id } ? id : suggest(text)
    }

    /// Titles are marked as headings by the layouts; in decks from before designs had fonts, bold text of 28 pt and
    /// more counts as one.
    static func isHeading(_ element: SlideElement) -> Bool {
        switch element.font {
        case "heading": return true
        case "body": return false
        default: return element.bold && element.fontSize >= 28
        }
    }

    static func font(_ element: SlideElement, theme: SlideTheme) -> SlideFont {
        isHeading(element) ? theme.heading : theme.body
    }

    /// The PostScript name of the cut to draw with.
    static func fontName(_ element: SlideElement, theme: SlideTheme) -> String {
        let font = font(element, theme: theme)
        if element.italic { return element.bold && font.hasBoldItalic ? font.boldItalic : font.italic }
        return element.bold ? font.bold : font.regular
    }

    /// The size to draw at: the element's size, scaled so the design's font takes as much room as Work Sans.
    static func fontSize(_ element: SlideElement, theme: SlideTheme) -> Double {
        (element.fontSize * font(element, theme: theme).scale * 100).rounded() / 100
    }

    /// `percent` of the way from `a` to `b`, per channel and rounded half up, so both apps get the same colors.
    static func mix(_ a: UInt32, _ b: UInt32, _ percent: Int) -> UInt32 {
        func channel(_ shift: UInt32) -> UInt32 {
            let from = Int((a >> shift) & 0xFF)
            let to = Int((b >> shift) & 0xFF)
            return UInt32((from * (100 - percent) + to * percent + 50) / 100) << shift
        }
        return channel(16) | channel(8) | channel(0)
    }

    static func hex(_ rgb: UInt32) -> String {
        String(format: "#%06X", rgb)
    }

    /// The decorations of slide `index`: bolder on the title slide (index 0), quiet on the others so they stay at
    /// the edges or behind text in a faint tint.
    static func decor(_ theme: SlideTheme, index: Int) -> [SlideElement] {
        let background = theme.background
        let soft = hex(mix(background, theme.accent, 14))
        let softer = hex(mix(background, theme.accent, 8))
        let soft2 = hex(mix(background, theme.secondAccent, 22))
        let mid = hex(mix(background, theme.accent, 40))
        let accent = "accent"
        var count = 0
        func shape(_ shape: ShapeType, _ x: Double, _ y: Double, _ w: Double, _ h: Double, _ fill: String, stroke: String = "none", strokeWidth: Double = 0) -> SlideElement {
            count += 1
            return SlideElement(
                id: "decor-\(count)", kind: .shape, x: x, y: y, width: w, height: h, shape: shape, fill: fill, stroke: stroke,
                strokeWidth: strokeWidth
            )
        }
        let title = index == 0
        switch theme.decor {
        case .none:
            return []
        case .frame:
            return title
                ? [
                    shape(.ellipse, 690, -150, 420, 420, softer),
                    shape(.ellipse, -120, 380, 300, 300, soft2),
                    shape(.rect, 18, 18, 924, 504, "none", stroke: mid, strokeWidth: 1.5),
                ]
                : [shape(.rect, 18, 18, 924, 504, "none", stroke: mid, strokeWidth: 1)]
        case .corners:
            return title
                ? [
                    shape(.ellipse, -140, -140, 340, 340, soft),
                    shape(.ellipse, 740, 330, 340, 340, soft2),
                    shape(.ellipse, 52, 470, 22, 22, accent),
                ]
                : [shape(.ellipse, -80, -80, 150, 150, soft), shape(.ellipse, 870, 450, 160, 160, soft2)]
        case .glow:
            return title
                ? [shape(.ellipse, 130, -80, 700, 700, softer), shape(.ellipse, 280, 70, 400, 400, soft)]
                : [shape(.ellipse, 640, -300, 560, 560, softer), shape(.ellipse, 760, -190, 340, 340, soft)]
        case .band:
            return title
                ? [shape(.rect, 0, 0, 960, 16, accent), shape(.rect, 0, 470, 960, 70, soft), shape(.rect, 64, 494, 90, 6, accent)]
                : [shape(.rect, 0, 0, 960, 8, accent), shape(.rect, 0, 532, 960, 8, soft2)]
        case .railLeft:
            return title
                ? [shape(.rect, 0, 0, 36, 540, accent), shape(.rect, 36, 0, 10, 540, soft)]
                : [shape(.rect, 0, 0, 14, 540, accent)]
        case .railRight:
            return title
                ? [shape(.rect, 924, 0, 36, 540, accent), shape(.rect, 914, 0, 10, 540, soft)]
                : [shape(.rect, 946, 0, 14, 540, accent)]
        case .blocks:
            return title
                ? [
                    shape(.rounded, 790, -60, 230, 200, soft),
                    shape(.rounded, -70, 400, 240, 200, soft2),
                    shape(.rounded, 880, 64, 40, 40, accent),
                ]
                : [
                    shape(.rounded, 890, -50, 110, 110, soft),
                    shape(.rounded, -50, 480, 110, 110, soft2),
                    shape(.rounded, 912, 500, 22, 22, accent),
                ]
        case .circles:
            return title
                ? [
                    shape(.ellipse, 620, 160, 460, 460, softer),
                    shape(.ellipse, 700, 240, 140, 140, soft),
                    shape(.ellipse, -60, -60, 160, 160, soft2),
                ]
                : [shape(.ellipse, 780, 360, 320, 320, softer)]
        }
    }
}
