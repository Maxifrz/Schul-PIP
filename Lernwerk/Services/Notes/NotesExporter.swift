import PDFKit
import PencilKit
import UIKit

/// Puts ink, texts, pictures and stickers onto the PDF pages: for sharing and for the page overview.
enum NotesExporter {
    /// The document with everything written on it, one PDF page per page.
    static func flattenedPDF(document: PDFDocument, fileName: String) -> Data {
        let drawings = MaterialStore.loadDrawings(for: fileName)
        let notes = MaterialStore.loadNotes(for: fileName)
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: PaperRenderer.a4))
        return renderer.pdfData { context in
            for index in 0..<document.pageCount {
                guard let page = document.page(at: index) else { continue }
                let box = page.bounds(for: .cropBox)
                context.beginPage(withBounds: CGRect(origin: .zero, size: box.size), pageInfo: [:])
                draw(page: page, index: index, drawing: drawings[index], notes: notes, in: context.cgContext, size: box.size)
            }
        }
    }

    /// A page with its notes, `width` points wide, for the page overview.
    static func thumbnail(document: PDFDocument, index: Int, drawings: [Int: PKDrawing], notes: DocumentNotes, width: CGFloat) -> UIImage? {
        guard let page = document.page(at: index) else { return nil }
        let box = page.bounds(for: .cropBox)
        let size = CGSize(width: width, height: width * box.height / max(box.width, 1))
        return UIGraphicsImageRenderer(size: size).image { context in
            draw(page: page, index: index, drawing: drawings[index], notes: notes, in: context.cgContext, size: size)
        }
    }

    private static func draw(page: PDFPage, index: Int, drawing: PKDrawing?, notes: DocumentNotes, in cg: CGContext, size: CGSize) {
        let box = page.bounds(for: .cropBox)
        UIColor.white.setFill()
        cg.fill(CGRect(origin: .zero, size: size))
        cg.saveGState()
        cg.scaleBy(x: size.width / box.width, y: size.height / box.height)
        cg.translateBy(x: 0, y: box.height)
        cg.scaleBy(x: 1, y: -1)
        page.draw(with: .cropBox, to: cg)
        cg.restoreGState()

        // Ink and notes are stored in the coordinates of the page's canvas on screen.
        let canvas = notes.canvasSizes[index] ?? box.size
        guard canvas.width > 0, canvas.height > 0 else { return }
        cg.saveGState()
        cg.scaleBy(x: size.width / canvas.width, y: size.height / canvas.height)
        UIGraphicsPushContext(cg)
        drawAnnotations(notes.annotations(on: index))
        if let drawing, !drawing.strokes.isEmpty {
            UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
                let bounds = CGRect(origin: .zero, size: canvas)
                drawing.image(from: bounds, scale: max(1, 2 * size.width / canvas.width)).draw(in: bounds)
            }
        }
        UIGraphicsPopContext()
        cg.restoreGState()
    }

    private static func drawAnnotations(_ annotations: [PageAnnotation]) {
        for annotation in annotations {
            let frame = annotation.frame
            switch annotation.kind {
            case .text:
                let paragraph = NSMutableParagraphStyle()
                paragraph.alignment = annotation.align.textAlignment
                let attributes: [NSAttributedString.Key: Any] = [
                    .font: annotation.style.font,
                    .foregroundColor: QuillUIColor.hex(annotation.color),
                    .paragraphStyle: paragraph,
                ]
                NSAttributedString(string: annotation.text, attributes: attributes).draw(in: frame.insetBy(dx: 4, dy: 4))
                if annotation.boxed {
                    QuillUIColor.hex(0x9A968B).setStroke()
                    let border = UIBezierPath(roundedRect: frame, cornerRadius: 4)
                    border.lineWidth = 1
                    border.stroke()
                }
            case .image:
                guard let name = annotation.image, let image = MaterialStore.noteImage(name) else { continue }
                image.draw(in: frame)
            case .sticker:
                let paragraph = NSMutableParagraphStyle()
                paragraph.alignment = .center
                if let color = Stickers.color(for: annotation.text) {
                    QuillUIColor.hex(color).setFill()
                    UIBezierPath(roundedRect: frame, cornerRadius: 8).fill()
                    let font = UIFont(name: QuillFont.Weight.semibold.postScriptName, size: min(20, frame.height * 0.5)) ?? .boldSystemFont(ofSize: 18)
                    let text = NSAttributedString(string: annotation.text, attributes: [.font: font, .foregroundColor: UIColor.white, .paragraphStyle: paragraph])
                    let height = text.boundingRect(with: frame.size, options: .usesLineFragmentOrigin, context: nil).height
                    text.draw(in: CGRect(x: frame.minX, y: frame.midY - height / 2, width: frame.width, height: height))
                } else {
                    let text = NSAttributedString(string: annotation.text, attributes: [.font: UIFont.systemFont(ofSize: frame.height * 0.8), .paragraphStyle: paragraph])
                    let height = text.boundingRect(with: frame.size, options: .usesLineFragmentOrigin, context: nil).height
                    text.draw(in: CGRect(x: frame.minX, y: frame.midY - height / 2, width: frame.width, height: height))
                }
            }
        }
    }
}
