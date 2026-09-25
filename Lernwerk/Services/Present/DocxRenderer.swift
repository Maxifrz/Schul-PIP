import UIKit

/// Draws a parsed Word document onto A4 PDF pages: headings, paragraphs, lists, tables and pictures, paginated to
/// fit. Bold and italic are kept; other run formatting (color, underline, font, exact spacing) is not, and headers,
/// footers and footnotes are left out. Mirrors the Android app.
enum DocxRenderer {
    private static let pageSize = PaperRenderer.a4
    private static let margin: CGFloat = 48
    private static var contentWidth: CGFloat { pageSize.width - margin * 2 }

    static func pdfData(_ document: DocxDocument) -> Data {
        UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize)).pdfData { context in
            var y = margin
            context.beginPage()
            for block in document.blocks {
                draw(block, context: context, y: &y)
            }
        }
    }

    private static func draw(_ block: DocxBlock, context: UIGraphicsPDFRendererContext, y: inout CGFloat) {
        switch block {
        case let .heading(level, runs):
            drawText(attributed(runs, style: .heading(level)), spacingBefore: level <= 1 ? 20 : 14, context: context, y: &y)
        case let .paragraph(runs):
            guard !runs.isEmpty else {
                ensureSpace(12, context: context, y: &y)
                y += 12
                return
            }
            drawText(attributed(runs, style: .body), spacingBefore: 4, context: context, y: &y)
        case let .listItem(level, ordered, index, runs):
            let prefix = ordered ? "\(index).\t" : "•\t"
            drawText(attributed(runs, style: .body, prefix: prefix), spacingBefore: 3, leftInset: 14 + CGFloat(min(level, 4)) * 16, context: context, y: &y)
        case let .table(rows, columnWidths):
            drawTable(rows, columnWidths: columnWidths, context: context, y: &y)
        case let .image(data, aspect):
            drawImage(data, aspect: aspect, context: context, y: &y)
        }
    }

    /// Starts a new page when `height` no longer fits, unless the page is still empty (an oversized block is
    /// drawn as well as it can be rather than looping forever).
    private static func ensureSpace(_ height: CGFloat, context: UIGraphicsPDFRendererContext, y: inout CGFloat) {
        if y > margin, y + height > pageSize.height - margin {
            context.beginPage()
            y = margin
        }
    }

    private static func drawText(_ text: NSAttributedString, spacingBefore: CGFloat, leftInset: CGFloat = 0, context: UIGraphicsPDFRendererContext, y: inout CGFloat) {
        let width = contentWidth - leftInset
        guard width > 20 else { return }
        let bounds = text.boundingRect(with: CGSize(width: width, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
        let height = ceil(bounds.height)
        ensureSpace(height, context: context, y: &y)
        y += spacingBefore
        text.draw(with: CGRect(x: margin + leftInset, y: y, width: width, height: max(height, pageSize.height)), options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
        y += height + 3
    }

    private static func drawImage(_ data: Data, aspect: Double, context: UIGraphicsPDFRendererContext, y: inout CGFloat) {
        guard let image = UIImage(data: data) else { return }
        let aspect = aspect > 0 ? CGFloat(aspect) : image.size.width / max(image.size.height, 1)
        var width = min(contentWidth, image.size.width > 0 ? image.size.width : contentWidth)
        var height = width / max(aspect, 0.01)
        let maxHeight = pageSize.height - margin * 2
        if height > maxHeight {
            height = maxHeight
            width = height * aspect
        }
        ensureSpace(height, context: context, y: &y)
        y += 6
        image.draw(in: CGRect(x: margin, y: y, width: width, height: height))
        y += height + 6
    }

    private static func drawTable(_ rows: [[DocxCell]], columnWidths: [Double], context: UIGraphicsPDFRendererContext, y: inout CGFloat) {
        let columnCount = rows.map(\.count).max() ?? 0
        guard columnCount > 0 else { return }
        var widths = columnWidths.map { CGFloat($0) }
        let total = widths.reduce(0, +)
        if widths.count != columnCount || total <= 0 {
            widths = Array(repeating: contentWidth / CGFloat(columnCount), count: columnCount)
        } else if total != contentWidth {
            let scale = contentWidth / total
            widths = widths.map { $0 * scale }
        }
        let padding: CGFloat = 5
        y += 6
        for row in rows {
            var cellTexts: [(text: NSAttributedString, width: CGFloat)] = []
            var rowHeight: CGFloat = 20
            for (index, cell) in row.enumerated() {
                let width = widths.indices.contains(index) ? widths[index] : (widths.last ?? contentWidth / CGFloat(columnCount))
                let text = cellText(cell)
                let bounds = text.boundingRect(with: CGSize(width: width - padding * 2, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], context: nil)
                rowHeight = max(rowHeight, ceil(bounds.height) + padding * 2)
                cellTexts.append((text, width))
            }
            ensureSpace(rowHeight, context: context, y: &y)
            var x = margin
            for (text, width) in cellTexts {
                let rect = CGRect(x: x, y: y, width: width, height: rowHeight)
                UIColor(white: 0.65, alpha: 1).setStroke()
                UIBezierPath(rect: rect).stroke()
                text.draw(with: rect.insetBy(dx: padding, dy: padding), options: [.usesLineFragmentOrigin], context: nil)
                x += width
            }
            y += rowHeight
        }
        y += 8
    }

    private static func cellText(_ paragraphs: DocxCell) -> NSAttributedString {
        let result = NSMutableAttributedString()
        for (index, runs) in paragraphs.enumerated() {
            if index > 0 { result.append(NSAttributedString(string: "\n")) }
            result.append(attributed(runs, style: .body))
        }
        if result.length == 0 { result.append(placeholder) }
        return result
    }

    // MARK: - Text attributes

    private enum Style {
        case heading(Int)
        case body
    }

    private static let placeholder = NSAttributedString(string: " ", attributes: [.font: font(bold: false, italic: false, style: .body)])

    private static func attributed(_ runs: [DocxRun], style: Style, prefix: String = "") -> NSAttributedString {
        let result = NSMutableAttributedString()
        if !prefix.isEmpty {
            result.append(NSAttributedString(string: prefix, attributes: [.font: font(bold: true, italic: false, style: style)]))
        }
        if runs.isEmpty, prefix.isEmpty {
            result.append(placeholder)
        }
        for run in runs {
            result.append(NSAttributedString(
                string: run.text,
                attributes: [.font: font(bold: run.bold, italic: run.italic, style: style), .foregroundColor: UIColor.black]
            ))
        }
        return result
    }

    private static func font(bold: Bool, italic: Bool, style: Style) -> UIFont {
        let size: CGFloat
        let base: UIFont
        switch style {
        case let .heading(level):
            size = level <= 1 ? 22 : (level == 2 ? 18 : 15)
            base = UIFont(name: QuillFont.Weight.semibold.postScriptName, size: size) ?? .boldSystemFont(ofSize: size)
        case .body:
            size = 11
            let weight: QuillFont.Weight = bold ? .semibold : .regular
            base = UIFont(name: weight.postScriptName, size: size) ?? .systemFont(ofSize: size)
        }
        guard italic else { return base }
        let traits = base.fontDescriptor.symbolicTraits.union(.traitItalic)
        guard let descriptor = base.fontDescriptor.withSymbolicTraits(traits) else { return base }
        return UIFont(descriptor: descriptor, size: size)
    }
}
