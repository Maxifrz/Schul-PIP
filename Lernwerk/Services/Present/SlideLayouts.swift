import Foundation

enum SlideLayout: String, CaseIterable, Codable {
    case title = "TITLE"
    case section = "SECTION"
    case bullets = "BULLETS"
    case imageText = "IMAGE_TEXT"
    case twoColumns = "TWO_COLUMNS"
    case quote = "QUOTE"
    case blank = "BLANK"

    var label: String {
        switch self {
        case .title: return "Titel"
        case .section: return "Abschnitt"
        case .bullets: return "Stichpunkte"
        case .imageText: return "Bild und Text"
        case .twoColumns: return "Zwei Spalten"
        case .quote: return "Zitat"
        case .blank: return "Leer"
        }
    }
}

/// The content of a slide before it becomes free elements; what the AI writes and what "new slide" presets use.
struct SlideDraft: Equatable {
    var layout: SlideLayout
    var title = ""
    var subtitle = ""
    var bullets: [String] = []
    var leftTitle = ""
    var left: [String] = []
    var rightTitle = ""
    var right: [String] = []
    var quote = ""
    var attribution = ""
    /// 0-based index into the chosen materials and 1-based page for a picture of that page, if any.
    var imageMaterial: Int?
    var imagePage: Int?
    var notes = ""
    var sourceMaterial: Int?
    var sourcePages: [Int] = []
}

/// A picture for a layout: its media file name and width / height.
struct PlacedImage: Equatable {
    var name: String
    var aspect: Double
}

/// Turns layouts into freely editable elements; after this a slide is just a list of objects.
enum SlideLayouts {
    private static let margin: Double = 64
    private static let contentWidth = SlideSize.width - 2 * margin

    static func build(_ draft: SlideDraft, image: PlacedImage? = nil) -> [SlideElement] {
        switch draft.layout {
        case .title:
            var elements = [
                text(draft.title, 80, 150, 800, 150, 52, bold: true, align: .center, anchor: .bottom),
                SlideElement(kind: .shape, x: 450, y: 322, width: 60, height: 6, shape: .rect, fill: "accent"),
            ]
            if !draft.subtitle.isBlank {
                elements.append(text(draft.subtitle, 80, 348, 800, 80, 24, align: .center, color: "muted"))
            }
            return elements
        case .section:
            var elements = [
                SlideElement(kind: .shape, x: 0, y: 0, width: 24, height: SlideSize.height, shape: .rect, fill: "accent"),
                text(draft.title, 96, 170, 800, 130, 46, bold: true, anchor: .bottom),
            ]
            if !draft.subtitle.isBlank {
                elements.append(text(draft.subtitle, 96, 310, 800, 80, 24, color: "muted"))
            }
            return elements
        case .bullets:
            return heading(draft.title) + [text(draft.bullets.joined(separator: "\n"), margin, 150, contentWidth, 340, 26, bullets: true)]
        case .imageText:
            return heading(draft.title) + [
                imageOrPlaceholder(image, margin, 150, 400, 340),
                text(draft.bullets.joined(separator: "\n"), 496, 150, 400, 340, 22, bullets: true),
            ]
        case .twoColumns:
            var elements = heading(draft.title)
            if !draft.leftTitle.isBlank { elements.append(text(draft.leftTitle, margin, 150, 400, 40, 22, bold: true, color: "accent")) }
            elements.append(text(draft.left.joined(separator: "\n"), margin, 198, 400, 300, 20, bullets: true))
            if !draft.rightTitle.isBlank { elements.append(text(draft.rightTitle, 496, 150, 400, 40, 22, bold: true, color: "accent")) }
            elements.append(text(draft.right.joined(separator: "\n"), 496, 198, 400, 300, 20, bullets: true))
            return elements
        case .quote:
            var elements = [
                text("„", 80, 40, 120, 150, 130, bold: true, color: "accent"),
                text(draft.quote.isBlank ? draft.title : draft.quote, 150, 150, 680, 220, 34, italic: true, anchor: .middle),
            ]
            if !draft.attribution.isBlank {
                elements.append(text("– \(draft.attribution)", 150, 390, 680, 40, 20, align: .right, color: "muted"))
            }
            return elements
        case .blank:
            return []
        }
    }

    private static func heading(_ title: String) -> [SlideElement] {
        [
            text(title, margin, 36, contentWidth, 84, 36, bold: true, anchor: .bottom),
            SlideElement(kind: .shape, x: margin, y: 128, width: 56, height: 5, shape: .rect, fill: "accent"),
        ]
    }

    private static func imageOrPlaceholder(_ image: PlacedImage?, _ x: Double, _ y: Double, _ w: Double, _ h: Double) -> SlideElement {
        guard let image else {
            return SlideElement(kind: .shape, x: x, y: y, width: w, height: h, shape: .rounded, fill: "surface")
        }
        // Pictures keep their aspect ratio: fitted into the box and centered.
        let fw = min(w, h * image.aspect)
        let fh = fw / image.aspect
        return SlideElement(kind: .image, x: x + (w - fw) / 2, y: y + (h - fh) / 2, width: fw, height: fh, image: image.name)
    }

    static func text(
        _ value: String, _ x: Double, _ y: Double, _ width: Double, _ height: Double, _ size: Double,
        bold: Bool = false, italic: Bool = false, align: SlideTextAlign = .left, anchor: TextAnchor = .top,
        bullets: Bool = false, color: String = "text"
    ) -> SlideElement {
        SlideElement(
            kind: .text, x: x, y: y, width: width, height: height, text: value, fontSize: size, bold: bold, italic: italic,
            align: align, anchor: anchor, bullets: bullets, textColor: color
        )
    }

    /// A slide as the editor's "new slide" menu offers it, with placeholder text to overwrite.
    static func preset(_ layout: SlideLayout) -> Slide {
        let draft: SlideDraft
        switch layout {
        case .title: draft = SlideDraft(layout: layout, title: "Titel der Präsentation", subtitle: "Name · Fach · Datum")
        case .section: draft = SlideDraft(layout: layout, title: "Neuer Abschnitt")
        case .bullets: draft = SlideDraft(layout: layout, title: "Überschrift", bullets: ["Erster Punkt", "Zweiter Punkt", "Dritter Punkt"])
        case .imageText: draft = SlideDraft(layout: layout, title: "Überschrift", bullets: ["Was das Bild zeigt", "Warum es wichtig ist"])
        case .twoColumns:
            draft = SlideDraft(layout: layout, title: "Vergleich", leftTitle: "Links", left: ["Punkt"], rightTitle: "Rechts", right: ["Punkt"])
        case .quote: draft = SlideDraft(layout: layout, quote: "Ein Zitat, das den Kern trifft.", attribution: "Quelle")
        case .blank: draft = SlideDraft(layout: layout)
        }
        return Slide(elements: build(draft))
    }
}

extension String {
    var isBlank: Bool { trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}
