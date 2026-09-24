import PDFKit
import UIKit
import UniformTypeIdentifiers

/// Turns a PowerPoint file or a PDF into a presentation in the store. A PDF becomes one picture slide per page,
/// with the page text kept for the AI.
enum PresentationImport {
    static let pptxType = UTType("org.openxmlformats.presentationml.presentation") ?? UTType(filenameExtension: "pptx") ?? .data
    static let contentTypes: [UTType] = [pptxType, .pdf]

    enum ImportError: LocalizedError {
        case unreadable
        case legacyPowerPoint
        case unreadablePDF

        var errorDescription: String? {
            switch self {
            case .unreadable: return "Die Datei lässt sich nicht öffnen."
            case .legacyPowerPoint: return "Alte PowerPoint-Dateien (.ppt) gehen nicht. Speichere sie in PowerPoint oder Keynote als .pptx und importiere sie dann."
            case .unreadablePDF: return "Die PDF lässt sich nicht öffnen."
            }
        }
    }

    struct Result {
        var presentation: Presentation
        /// Objects that could not be taken over (charts, SmartArt, vector pictures).
        var skipped: Int
    }

    @MainActor
    static func run(_ url: URL, store: PresentationStore) async throws -> Result {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { throw ImportError.unreadable }
        let title = url.deletingPathExtension().lastPathComponent
        let ext = url.pathExtension.lowercased()
        if ext == "ppt" { throw ImportError.legacyPowerPoint }

        let result: Result
        if ext == "pdf" || data.starts(with: Data("%PDF".utf8)) {
            result = try pdf(data, title: title, store: store)
        } else {
            let imported: PptxReader.Imported
            do {
                imported = try await Task.detached(priority: .userInitiated) { try PptxReader.read(data, title: title) }.value
            } catch {
                throw ImportError.unreadable
            }
            for (name, bytes) in imported.media { try store.saveMedia(bytes, named: name) }
            result = Result(presentation: imported.presentation, skipped: imported.skipped)
        }
        store.add(result.presentation)
        return result
    }

    @MainActor
    private static func pdf(_ data: Data, title: String, store: PresentationStore) throws -> Result {
        guard let document = PDFDocument(data: data), document.pageCount > 0 else { throw ImportError.unreadablePDF }
        let texts = PDFMaterialReader.pageTexts(of: document)
        var slides: [Slide] = []
        for index in 0..<document.pageCount {
            guard let page = document.page(at: index) else { continue }
            let image = page.thumbnail(of: CGSize(width: 1920, height: 1920), for: .cropBox)
            guard let jpeg = image.jpegData(compressionQuality: 0.85) else { continue }
            let name = try store.saveMedia(jpeg, fileExtension: "jpg")
            let frame = SlideGeometry.fit(width: image.size.width, height: image.size.height, into: (0, 0, SlideSize.width, SlideSize.height))
            slides.append(Slide(
                elements: [SlideElement(kind: .image, x: frame.x, y: frame.y, width: frame.width, height: frame.height, image: name)],
                extractedText: index < texts.count ? texts[index] : "",
                background: "#FFFFFF"
            ))
        }
        guard !slides.isEmpty else { throw ImportError.unreadablePDF }
        return Result(presentation: Presentation(title: title, themeId: SlideTheme.paper.id, slides: slides), skipped: 0)
    }
}
