import UIKit

/// A GoodNotes notebook as a PDF: each page with its background (a page of an imported PDF, or a photo), the pictures
/// placed on it and the handwriting as vector paths in its colours. Mirrors `GoodNotesPdf.kt`.
enum GoodNotesRenderer {
    static func pdfData(_ notebook: GoodNotes.Notebook) throws -> Data {
        guard let first = notebook.pages.first else { throw GoodNotes.GoodNotesError.noPages }
        // The same paper under many pages is opened once.
        var documents: [Data: CGPDFDocument] = [:]
        let bounds = CGRect(x: 0, y: 0, width: CGFloat(first.width), height: CGFloat(first.height))
        return UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
            for page in notebook.pages {
                let rect = CGRect(x: 0, y: 0, width: CGFloat(page.width), height: CGFloat(page.height))
                context.beginPage(withBounds: rect, pageInfo: [:])
                let cg = context.cgContext
                switch page.background {
                case let .pdf(data, pageIndex)?:
                    let document = documents[data] ?? CGDataProvider(data: data as CFData).flatMap(CGPDFDocument.init)
                    documents[data] = document
                    if let document, document.numberOfPages > 0,
                       let source = document.page(at: min(max(pageIndex, 0), document.numberOfPages - 1) + 1) {
                        let box = source.getBoxRect(.mediaBox)
                        cg.saveGState()
                        // PDF pages count from the bottom left; the renderer's context from the top left.
                        cg.translateBy(x: 0, y: rect.height)
                        cg.scaleBy(x: rect.width / max(box.width, 1), y: -rect.height / max(box.height, 1))
                        cg.translateBy(x: -box.minX, y: -box.minY)
                        cg.drawPDFPage(source)
                        cg.restoreGState()
                    }
                case let .image(data)?:
                    UIImage(data: data)?.draw(in: rect)
                case nil:
                    break
                }
                for image in page.images {
                    UIImage(data: image.data)?.draw(in: CGRect(
                        x: CGFloat(image.x), y: CGFloat(image.y), width: CGFloat(image.width), height: CGFloat(image.height)
                    ))
                }
                ink(page.strokes, in: cg)
            }
        }
    }

    private static func ink(_ strokes: [GoodNotes.Stroke], in cg: CGContext) {
        cg.setLineCap(.round)
        cg.setLineJoin(.round)
        for stroke in strokes {
            let path = CGMutablePath()
            if let line = stroke.polyline {
                path.move(to: CGPoint(x: CGFloat(line[0]), y: CGFloat(line[1])))
                var i = 2
                while i + 1 < line.count {
                    path.addLine(to: CGPoint(x: CGFloat(line[i]), y: CGFloat(line[i + 1])))
                    i += 2
                }
            } else {
                let start = CGPoint(x: CGFloat(stroke.start[0]), y: CGFloat(stroke.start[1]))
                path.move(to: start)
                let s = stroke.segments
                if s.isEmpty { path.addLine(to: CGPoint(x: start.x + 0.01, y: start.y)) }
                var i = 0
                while i + 3 < s.count {
                    path.addQuadCurve(
                        to: CGPoint(x: CGFloat(s[i + 2]), y: CGFloat(s[i + 3])),
                        control: CGPoint(x: CGFloat(s[i]), y: CGFloat(s[i + 1]))
                    )
                    i += 4
                }
            }
            cg.setStrokeColor(red: CGFloat(stroke.red), green: CGFloat(stroke.green), blue: CGFloat(stroke.blue), alpha: CGFloat(stroke.alpha))
            cg.setLineWidth(CGFloat(stroke.width))
            cg.addPath(path)
            cg.strokePath()
        }
    }
}
