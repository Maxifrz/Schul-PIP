import PDFKit
import UIKit

/// Draws notebook paper as real PDF pages, so the lines stay with the page in exports and thumbnails.
enum PaperRenderer {
    static let a4 = CGSize(width: 595, height: 842)

    static func draw(_ style: PaperStyle, in bounds: CGRect, context: CGContext) {
        context.setFillColor(UIColor.white.cgColor)
        context.fill(bounds)
        let spacing = style.spacing
        guard spacing > 0 else { return }
        let line = QuillUIColor.hex(0xC4CFDD)
        let top = bounds.minY + 56
        switch style {
        case .blank:
            break
        case .lined:
            context.setStrokeColor(line.cgColor)
            context.setLineWidth(0.6)
            var y = top
            while y < bounds.maxY - 24 {
                context.move(to: CGPoint(x: bounds.minX, y: y))
                context.addLine(to: CGPoint(x: bounds.maxX, y: y))
                y += spacing
            }
            context.strokePath()
            // The margin line of German school paper.
            context.setStrokeColor(QuillUIColor.hex(0xE3A6A0).cgColor)
            context.move(to: CGPoint(x: bounds.minX + 56, y: bounds.minY))
            context.addLine(to: CGPoint(x: bounds.minX + 56, y: bounds.maxY))
            context.strokePath()
        case .grid:
            context.setStrokeColor(line.withAlphaComponent(0.8).cgColor)
            context.setLineWidth(0.4)
            var x = bounds.minX + (bounds.width.truncatingRemainder(dividingBy: spacing)) / 2
            while x <= bounds.maxX {
                context.move(to: CGPoint(x: x, y: bounds.minY))
                context.addLine(to: CGPoint(x: x, y: bounds.maxY))
                x += spacing
            }
            var y = bounds.minY + (bounds.height.truncatingRemainder(dividingBy: spacing)) / 2
            while y <= bounds.maxY {
                context.move(to: CGPoint(x: bounds.minX, y: y))
                context.addLine(to: CGPoint(x: bounds.maxX, y: y))
                y += spacing
            }
            context.strokePath()
        case .dotted:
            context.setFillColor(line.cgColor)
            var y = bounds.minY + spacing
            while y < bounds.maxY {
                var x = bounds.minX + spacing
                while x < bounds.maxX {
                    context.fillEllipse(in: CGRect(x: x - 0.8, y: y - 0.8, width: 1.6, height: 1.6))
                    x += spacing
                }
                y += spacing
            }
        }
    }

    /// A small picture of the paper, for choosing it.
    static func preview(_ style: PaperStyle, width: CGFloat) -> UIImage {
        let scale = width / a4.width
        return UIGraphicsImageRenderer(size: CGSize(width: width, height: a4.height * scale)).image { renderer in
            renderer.cgContext.scaleBy(x: scale, y: scale)
            draw(style, in: CGRect(origin: .zero, size: a4), context: renderer.cgContext)
        }
    }

    static func pdfData(_ style: PaperStyle, size: CGSize = a4, pages: Int = 1) -> Data {
        let bounds = CGRect(origin: .zero, size: size)
        return UIGraphicsPDFRenderer(bounds: bounds).pdfData { renderer in
            for _ in 0..<max(1, pages) {
                renderer.beginPage()
                draw(style, in: bounds, context: renderer.cgContext)
            }
        }
    }

    static func page(_ style: PaperStyle, size: CGSize) -> PDFPage? {
        PDFDocument(data: pdfData(style, size: size))?.page(at: 0)
    }
}
