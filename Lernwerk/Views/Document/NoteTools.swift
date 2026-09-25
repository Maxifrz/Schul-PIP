import PencilKit
import UIKit

/// The tools of the document toolbar, like in GoodNotes.
enum NoteTool: Equatable {
    case read, pen, highlighter, eraser, shapes, lasso, typing, textBox, laser, mark, math

    /// Tools that draw a frame around a region: for the tutor, or to calculate what is written there.
    var marksRegion: Bool { self == .mark || self == .math }

    /// Tools that work on the PencilKit canvas of each page.
    var usesCanvas: Bool {
        switch self {
        case .pen, .highlighter, .eraser, .shapes, .lasso: return true
        default: return false
        }
    }

    /// Tools in which text, pictures and stickers can be moved, resized and edited.
    var editsAnnotations: Bool {
        self == .lasso || self == .typing || self == .textBox
    }

    /// Tools the zoom window writes with.
    var writesInZoom: Bool {
        self == .pen || self == .highlighter || self == .shapes
    }
}

enum PenKind: String, CaseIterable, Identifiable {
    case ballpoint, fountain, pencil, monoline

    var id: String { rawValue }

    var label: String {
        switch self {
        case .ballpoint: return "Kugelschreiber"
        case .fountain: return "Füller"
        case .pencil: return "Bleistift"
        case .monoline: return "Fineliner"
        }
    }

    var inkType: PKInkingTool.InkType {
        switch self {
        case .ballpoint: return .pen
        case .fountain: return .fountainPen
        case .pencil: return .pencil
        case .monoline: return .monoline
        }
    }
}

/// Everything the toolbar sets for the tools.
struct InkSettings: Equatable {
    static let penColors: [UInt32] = [0x16150F, 0x1F4E9C, 0xC23B3B, 0x2E7D4F, 0xE0892B, 0x7B4BB7]
    static let penWidths: [CGFloat] = [1.5, 3, 5.5]
    static let highlighterColors: [UInt32] = [0xFFE066, 0xA7E08F, 0x8FD3F4, 0xF7A8C8, 0xFFB86B]
    static let highlighterWidths: [CGFloat] = [12, 20, 30]
    static let eraserWidths: [CGFloat] = [8, 20, 40]

    var penKind: PenKind = .ballpoint
    var penColor: UInt32 = 0x16150F
    var penWidth: CGFloat = 3
    var highlighterColor: UInt32 = 0xFFE066
    var highlighterWidth: CGFloat = 20
    /// Pixel erasing removes only what the eraser touches; otherwise whole strokes go.
    var eraserPixel = false
    var eraserWidth: CGFloat = 20
    /// A written "=" offers the result, like in Apple's Notes.
    var mathPreview = true
    var textStyle: NoteTextStyle = .body
    var textColor: UInt32 = 0x16150F
    var textAlign: NoteTextAlign = .left

    func pkTool(for tool: NoteTool) -> (any PKTool)? {
        switch tool {
        case .pen, .shapes:
            return PKInkingTool(penKind.inkType, color: QuillUIColor.hex(penColor), width: penWidth)
        case .highlighter:
            return PKInkingTool(.marker, color: QuillUIColor.hex(highlighterColor), width: highlighterWidth)
        case .eraser:
            return eraserPixel ? PKEraserTool(.bitmap, width: eraserWidth) : PKEraserTool(.vector)
        case .lasso:
            return PKLassoTool()
        default:
            return nil
        }
    }
}

/// Stickers for pages: emoji and small labels.
enum Stickers {
    static let symbols = ["⭐️", "✅", "❌", "❗️", "❓", "💡", "📌", "🔥", "👉", "⚠️", "🧠", "📝", "🎯", "⏰", "❤️", "👍"]
    static let labels: [(text: String, color: UInt32)] = [
        ("Wichtig!", 0xC23B3B), ("Prüfung", 0x7B4BB7), ("Lernen", 0x1F4E9C), ("Nachfragen", 0xE0892B), ("Verstanden", 0x2E7D4F), ("Formel", 0x16150F),
    ]

    static func color(for text: String) -> UInt32? {
        labels.first { $0.text == text }?.color
    }
}

extension NoteTextStyle {
    var font: UIFont { font(size: size) }

    func font(size: CGFloat) -> UIFont {
        if self == .handwriting {
            // Noteworthy ships with iOS and looks written by hand; calculated results use it.
            return UIFont(name: "Noteworthy-Light", size: size) ?? .italicSystemFont(ofSize: size)
        }
        let name = isBold ? QuillFont.Weight.semibold.postScriptName : QuillFont.Weight.regular.postScriptName
        return UIFont(name: name, size: size) ?? .systemFont(ofSize: size, weight: isBold ? .semibold : .regular)
    }
}

extension PageAnnotation {
    var textFont: UIFont { style.font(size: textSize) }
}

extension NoteTextAlign {
    var textAlignment: NSTextAlignment {
        switch self {
        case .left: return .left
        case .center: return .center
        case .right: return .right
        }
    }
}
