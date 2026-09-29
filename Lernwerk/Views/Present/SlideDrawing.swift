import SwiftUI
import UIKit

/// Draws slides with Core Graphics. The editor, thumbnails, presenting and the PDF export all use it, so what the
/// student edits is exactly what gets exported. Coordinates are slide points multiplied by `scale`.
enum SlideDrawing {
    static func uiColor(_ rgb: UInt32) -> UIColor {
        UIColor(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }

    /// `index` is the slide's place in the deck; the title slide (0) gets the design's bolder decorations.
    static func draw(
        _ slide: Slide, theme: SlideTheme, in context: CGContext, scale: CGFloat, images: [String: UIImage], skipping skipID: String? = nil,
        index: Int = 1
    ) {
        UIGraphicsPushContext(context)
        defer { UIGraphicsPopContext() }
        context.saveGState()
        context.scaleBy(x: scale, y: scale)
        context.setFillColor(uiColor(slide.backgroundColor(theme)).cgColor)
        context.fill(CGRect(x: 0, y: 0, width: SlideSize.width, height: SlideSize.height))
        for element in SlideDesign.decor(theme, index: index) + slide.elements where element.id != skipID {
            context.saveGState()
            if element.rotation != 0 {
                context.translateBy(x: element.centerX, y: element.centerY)
                context.rotate(by: element.rotation * .pi / 180)
                context.translateBy(x: -element.centerX, y: -element.centerY)
            }
            switch element.kind {
            case .shape: drawShape(element, theme: theme, in: context)
            case .image: drawImage(element, theme: theme, in: context, images: images)
            case .text: drawText(element, theme: theme)
            }
            context.restoreGState()
        }
        context.restoreGState()
    }

    private static func drawShape(_ element: SlideElement, theme: SlideTheme, in context: CGContext) {
        let rect = CGRect(x: element.x, y: element.y, width: element.width, height: element.height)
        if element.isLine {
            let color = uiColor(theme.color(element.fill) ?? theme.text)
            let width = max(element.strokeWidth, 3)
            let head = element.shape == .arrow ? width * 3 : 0
            let y = element.centerY
            let line = UIBezierPath()
            line.move(to: CGPoint(x: rect.minX, y: y))
            line.addLine(to: CGPoint(x: rect.maxX - head * 0.8, y: y))
            line.lineWidth = width
            color.setStroke()
            line.stroke()
            if head > 0 {
                let arrow = UIBezierPath()
                arrow.move(to: CGPoint(x: rect.maxX, y: y))
                arrow.addLine(to: CGPoint(x: rect.maxX - head, y: y - head / 2))
                arrow.addLine(to: CGPoint(x: rect.maxX - head, y: y + head / 2))
                arrow.close()
                color.setFill()
                arrow.fill()
            }
            return
        }
        func path(_ rect: CGRect) -> UIBezierPath {
            switch element.shape {
            case .ellipse: return UIBezierPath(ovalIn: rect)
            case .rounded:
                // The design's corners: square ones (scale 0) are plain rectangles.
                let radius = min(element.width, element.height) * theme.cornerFraction
                return radius > 0 ? UIBezierPath(roundedRect: rect, cornerRadius: radius) : UIBezierPath(rect: rect)
            default: return UIBezierPath(rect: rect)
            }
        }
        if let fill = theme.color(element.fill) {
            uiColor(fill).setFill()
            path(rect).fill()
        }
        if let stroke = theme.color(element.stroke), element.strokeWidth > 0 {
            let outline = path(rect.insetBy(dx: element.strokeWidth / 2, dy: element.strokeWidth / 2))
            outline.lineWidth = element.strokeWidth
            uiColor(stroke).setStroke()
            outline.stroke()
        }
    }

    private static func drawImage(_ element: SlideElement, theme: SlideTheme, in context: CGContext, images: [String: UIImage]) {
        let rect = CGRect(x: element.x, y: element.y, width: element.width, height: element.height)
        guard let name = element.image, let image = images[name] else {
            context.setFillColor(uiColor(theme.surface).cgColor)
            context.fill(rect)
            return
        }
        image.draw(in: rect)
    }

    /// The design's heading or body font for the element, at the size that takes as much room as Work Sans would.
    static func font(_ element: SlideElement, theme: SlideTheme) -> UIFont {
        let size = SlideDesign.fontSize(element, theme: theme)
        return UIFont(name: SlideDesign.fontName(element, theme: theme), size: size)
            ?? .systemFont(ofSize: size, weight: element.bold ? .semibold : .regular)
    }

    /// The element's text with bullets matching the PowerPoint export: text starts 1.1 × font size from the left.
    static func attributedText(_ element: SlideElement, theme: SlideTheme) -> NSAttributedString {
        let result = NSMutableAttributedString()
        let font = font(element, theme: theme)
        let color = uiColor(theme.color(element.textColor) ?? theme.text)
        let indent = element.fontSize * 1.1
        let alignment: NSTextAlignment = element.align == .left ? .left : (element.align == .center ? .center : .right)
        let lines = element.text.components(separatedBy: "\n")
        for (index, line) in lines.enumerated() {
            let style = NSMutableParagraphStyle()
            style.alignment = alignment
            let bullet = element.bullets && !line.isBlank
            if bullet {
                style.headIndent = indent
                style.tabStops = [NSTextTab(textAlignment: .left, location: indent)]
                style.defaultTabInterval = indent
            }
            var attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: style]
            // No bold italic cut: a thin outline thickens the italic. Heading-only fonts are bold already.
            let face = SlideDesign.font(element, theme: theme)
            if element.bold, element.italic, face.hasStyles, !face.hasBoldItalic { attributes[.strokeWidth] = -2 }
            if bullet {
                var bulletAttributes = attributes
                bulletAttributes[.foregroundColor] = uiColor(theme.accent)
                result.append(NSAttributedString(string: "•\t", attributes: bulletAttributes))
            }
            result.append(NSAttributedString(string: line + (index < lines.count - 1 ? "\n" : ""), attributes: attributes))
        }
        return result
    }

    private static func drawText(_ element: SlideElement, theme: SlideTheme) {
        guard !element.text.isEmpty else { return }
        let text = attributedText(element, theme: theme)
        let bounds = text.boundingRect(
            with: CGSize(width: element.width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            context: nil
        )
        let height = ceil(bounds.height)
        let top: Double
        switch element.anchor {
        case .top: top = element.y
        case .middle: top = element.y + (element.height - height) / 2
        case .bottom: top = element.y + element.height - height
        }
        text.draw(with: CGRect(x: element.x, y: top, width: element.width, height: height), options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
    }

    /// The whole deck as a PDF with one 960 × 540 pt page per slide.
    static func pdf(_ presentation: Presentation, images: [String: UIImage]) -> Data {
        let bounds = CGRect(x: 0, y: 0, width: SlideSize.width, height: SlideSize.height)
        return UIGraphicsPDFRenderer(bounds: bounds).pdfData { renderer in
            for (index, slide) in presentation.slides.enumerated() {
                renderer.beginPage()
                draw(slide, theme: presentation.theme, in: renderer.cgContext, scale: 1, images: images, index: index)
            }
        }
    }

    /// One slide as a PNG, `width` pixels wide.
    static func png(_ slide: Slide, theme: SlideTheme, index: Int, images: [String: UIImage], width: CGFloat = 1920) -> Data {
        let scale = width / SlideSize.width
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: SlideSize.height * scale), format: format)
        return renderer.pngData { context in
            draw(slide, theme: theme, in: context.cgContext, scale: scale, images: images, index: index)
        }
    }

    /// The deck as a PDF for handing out or rehearsing: A4 portrait, per slide the picture on top and its speaker notes
    /// below. Notes that do not fit the page continue on further pages, so nothing is cut.
    static func pdfWithNotes(_ presentation: Presentation, images: [String: UIImage]) -> Data {
        let page = CGRect(x: 0, y: 0, width: 595, height: 842)
        let margin: CGFloat = 40
        let contentWidth = page.width - 2 * margin
        let scale = contentWidth / SlideSize.width
        let slideHeight = SlideSize.height * scale
        let notesTop = margin + slideHeight + 30
        let firstHeight = page.height - margin - notesTop
        let fullHeight = page.height - 2 * margin
        let attributes: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 11), .foregroundColor: UIColor.black]
        let labelAttributes: [NSAttributedString.Key: Any] = [.font: UIFont.boldSystemFont(ofSize: 11), .foregroundColor: UIColor.darkGray]
        func height(_ text: String) -> CGFloat {
            ceil((text as NSString).boundingRect(
                with: CGSize(width: contentWidth, height: .greatestFiniteMagnitude),
                options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attributes, context: nil
            ).height)
        }
        let count = presentation.slides.count
        return UIGraphicsPDFRenderer(bounds: page).pdfData { renderer in
            for (index, slide) in presentation.slides.enumerated() {
                renderer.beginPage()
                let context = renderer.cgContext
                context.saveGState()
                context.translateBy(x: margin, y: margin)
                context.clip(to: CGRect(x: 0, y: 0, width: contentWidth, height: slideHeight))
                draw(slide, theme: presentation.theme, in: context, scale: scale, images: images, index: index)
                context.restoreGState()
                context.setStrokeColor(UIColor.lightGray.cgColor)
                context.setLineWidth(0.5)
                context.stroke(CGRect(x: margin, y: margin, width: contentWidth, height: slideHeight))
                ("Folie \(index + 1) von \(count)" as NSString).draw(at: CGPoint(x: margin, y: margin + slideHeight + 8), withAttributes: labelAttributes)
                let notes = slide.notes.trimmingCharacters(in: .whitespacesAndNewlines)
                let first = DeckExport.paginate(notes.isEmpty ? "Keine Notizen." : notes) { height($0) <= firstHeight }
                (first[0] as NSString).draw(in: CGRect(x: margin, y: notesTop, width: contentWidth, height: firstHeight), withAttributes: attributes)
                let rest = first.dropFirst().joined(separator: " ")
                guard !rest.isEmpty else { continue }
                for piece in DeckExport.paginate(rest, fits: { height($0) <= fullHeight }) {
                    renderer.beginPage()
                    (piece as NSString).draw(in: CGRect(x: margin, y: margin, width: contentWidth, height: fullHeight), withAttributes: attributes)
                }
            }
        }
    }
}

/// One slide drawn by `SlideDrawing`, always 16:9.
struct SlideCanvas: View {
    let slide: Slide
    let theme: SlideTheme
    let images: [String: UIImage]
    var skipping: String?
    /// The slide's place in the deck, for the title slide's decorations.
    var index = 1

    var body: some View {
        Canvas { context, size in
            context.withCGContext { cg in
                SlideDrawing.draw(slide, theme: theme, in: cg, scale: size.width / SlideSize.width, images: images, skipping: skipping, index: index)
            }
        }
        .aspectRatio(16 / 9, contentMode: .fit)
        .clipped()
    }
}

/// The system share sheet for an exported file.
struct ShareSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

struct ExportedFile: Identifiable {
    let url: URL
    var id: String { url.path }
}
