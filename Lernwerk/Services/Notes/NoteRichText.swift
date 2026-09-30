import UIKit

/// How typed notes look: headings, bullets, numbers and boxes from the markers in the text, and tables. The same
/// drawing serves the page, the editor and the export.
enum NoteRichText {
    /// What a text needs to be drawn.
    struct Look {
        var style: NoteTextStyle
        var size: CGFloat
        var color: UIColor
        var alignment: NSTextAlignment

        init(_ annotation: PageAnnotation) {
            style = annotation.style
            size = annotation.textSize
            color = QuillUIColor.hex(annotation.color)
            alignment = annotation.align.textAlignment
        }
    }

    static func font(for block: NoteBlock, look: Look) -> UIFont {
        switch block {
        case .heading1: return NoteTextStyle.title.font(size: max(NoteTextStyle.title.size, look.size * 1.7))
        case .heading2: return NoteTextStyle.heading.font(size: max(NoteTextStyle.heading.size, look.size * 1.3))
        default: return look.style.font(size: look.size)
        }
    }

    /// Room for a list marker at the left, in points.
    static func indent(for look: Look) -> CGFloat { max(20, look.size * 1.5) }

    private static func paragraph(for block: NoteBlock, look: Look, editing: Bool) -> NSParagraphStyle {
        let style = NSMutableParagraphStyle()
        style.alignment = look.alignment
        style.paragraphSpacing = block == .heading1 ? 4 : 2
        if block.isList, !editing {
            let indent = indent(for: look)
            style.firstLineHeadIndent = 0
            style.headIndent = indent
            style.tabStops = [NSTextTab(textAlignment: .left, location: indent)]
            style.defaultTabInterval = indent
        }
        return style
    }

    /// The marker as the page shows it.
    private static func shownMarker(_ line: NoteMarkup.Line) -> String {
        switch line.block {
        case .bullet: return "•\t"
        case .numbered: return "\(line.number).\t"
        case let .check(done): return done ? "☑\t" : "☐\t"
        default: return ""
        }
    }

    /// The text as it is drawn on the page: markers turned into bullets, numbers and boxes.
    static func display(_ text: String, look: Look) -> NSAttributedString {
        let result = NSMutableAttributedString()
        let lines = NoteMarkup.lines(of: text)
        for (index, line) in lines.enumerated() {
            let attributes: [NSAttributedString.Key: Any] = [
                .font: font(for: line.block, look: look),
                .foregroundColor: look.color,
                .paragraphStyle: paragraph(for: line.block, look: look, editing: false),
            ]
            var doneColor = look.color
            if case .check(true) = line.block { doneColor = look.color.withAlphaComponent(0.55) }
            var body = attributes
            body[.foregroundColor] = doneColor
            result.append(NSAttributedString(string: shownMarker(line), attributes: attributes))
            result.append(NSAttributedString(string: line.content, attributes: body))
            if index < lines.count - 1 { result.append(NSAttributedString(string: "\n", attributes: attributes)) }
        }
        return result
    }

    /// The text as it is while typing: the markers stay, in a fainter color, so what is typed is what is stored.
    static func editing(_ text: String, look: Look) -> NSAttributedString {
        let storage = NSTextStorage(string: text)
        restyle(storage, look: look)
        return storage
    }

    /// Sets fonts and colors of every line of a text being typed, without touching the text or the caret.
    static func restyle(_ storage: NSTextStorage, look: Look) {
        let string = storage.string as NSString
        let lines = NoteMarkup.lines(of: storage.string)
        var location = 0
        storage.beginEditing()
        for line in lines {
            let raw = line.prefix + line.content
            let length = (raw as NSString).length
            let range = NSRange(location: location, length: min(length + 1, string.length - location))
            let attributes: [NSAttributedString.Key: Any] = [
                .font: font(for: line.block, look: look),
                .foregroundColor: look.color,
                .paragraphStyle: paragraph(for: line.block, look: look, editing: true),
            ]
            if range.length > 0 { storage.setAttributes(attributes, range: range) }
            let prefixLength = (line.prefix as NSString).length
            if prefixLength > 0, location + prefixLength <= string.length {
                storage.addAttribute(.foregroundColor, value: look.color.withAlphaComponent(0.38), range: NSRange(location: location, length: prefixLength))
            }
            location += length + 1
        }
        storage.endEditing()
    }

    /// Attributes for the text typed next: the look of the line the caret is in.
    static func typingAttributes(for line: NoteMarkup.Line, look: Look) -> [NSAttributedString.Key: Any] {
        [
            .font: font(for: line.block, look: look),
            .foregroundColor: look.color,
            .paragraphStyle: paragraph(for: line.block, look: look, editing: true),
        ]
    }

    /// The height a text needs at a width.
    static func height(of text: String, look: Look, width: CGFloat) -> CGFloat {
        let attributed = display(text, look: look)
        let box = attributed.boundingRect(with: CGSize(width: width, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
        return ceil(box.height)
    }
}

/// The measures of a table: equal columns, rows as high as their tallest cell.
enum NoteTableLayout {
    static let padding: CGFloat = 6
    static let minimumRow: CGFloat = 32

    static func font(look: NoteRichText.Look, bold: Bool) -> UIFont {
        let base = look.style == .handwriting ? look.style.font(size: look.size) : NoteTextStyle.body.font(size: min(look.size, 18))
        guard bold, look.style != .handwriting else { return base }
        return NoteTextStyle.title.font(size: base.pointSize)
    }

    static func rowHeights(_ cells: [[String]], width: CGFloat, header: Bool, look: NoteRichText.Look) -> [CGFloat] {
        let columns = max(1, cells.map(\.count).max() ?? 1)
        let columnWidth = max(20, width / CGFloat(columns) - 2 * padding)
        return cells.enumerated().map { rowIndex, row in
            let cellFont = font(look: look, bold: header && rowIndex == 0)
            let tallest = row.map { cell -> CGFloat in
                guard !cell.isEmpty else { return 0 }
                let box = (cell as NSString).boundingRect(
                    with: CGSize(width: columnWidth, height: .greatestFiniteMagnitude),
                    options: [.usesLineFragmentOrigin, .usesFontLeading],
                    attributes: [.font: cellFont],
                    context: nil
                )
                return ceil(box.height)
            }.max() ?? 0
            return max(minimumRow, tallest + 2 * padding)
        }
    }

    static func totalHeight(_ cells: [[String]], width: CGFloat, header: Bool, look: NoteRichText.Look) -> CGFloat {
        rowHeights(cells, width: width, header: header, look: look).reduce(0, +)
    }

    /// Draws a table into `frame`: header tint, grid lines and the cell texts.
    static func draw(_ annotation: PageAnnotation, in frame: CGRect) {
        let cells = annotation.cells ?? []
        guard !cells.isEmpty else { return }
        let look = NoteRichText.Look(annotation)
        let columns = max(1, cells.map(\.count).max() ?? 1)
        let columnWidth = frame.width / CGFloat(columns)
        let heights = rowHeights(cells, width: frame.width, header: annotation.hasHeader, look: look)
        let line = QuillUIColor.hex(0x9A968B)
        var y = frame.minY
        for (rowIndex, row) in cells.enumerated() {
            let height = heights[rowIndex]
            if annotation.hasHeader, rowIndex == 0 {
                QuillUIColor.hex(0xEEEDE9).setFill()
                UIBezierPath(rect: CGRect(x: frame.minX, y: y, width: frame.width, height: height)).fill()
            }
            for column in 0..<columns {
                let rect = CGRect(x: frame.minX + CGFloat(column) * columnWidth, y: y, width: columnWidth, height: height)
                let cell = column < row.count ? row[column] : ""
                let style = NSMutableParagraphStyle()
                style.alignment = look.alignment
                (cell as NSString).draw(
                    in: rect.insetBy(dx: padding, dy: padding),
                    withAttributes: [
                        .font: font(look: look, bold: annotation.hasHeader && rowIndex == 0),
                        .foregroundColor: look.color,
                        .paragraphStyle: style,
                    ]
                )
                line.setStroke()
                let border = UIBezierPath(rect: rect)
                border.lineWidth = 1
                border.stroke()
            }
            y += height
        }
    }
}
