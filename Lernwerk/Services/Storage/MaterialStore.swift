import Foundation
import PDFKit
import PencilKit
import UIKit
import UniformTypeIdentifiers

enum MaterialStore {
    static var directory: URL {
        let base = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let directory = base.appendingPathComponent("Materials", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    static func url(for fileName: String) -> URL {
        directory.appendingPathComponent(fileName)
    }

    static func drawingsURL(for fileName: String) -> URL {
        directory.appendingPathComponent(fileName + ".drawings")
    }

    /// A file copied into the library, before it becomes a `StudyMaterial`; plain values, so a folder import can
    /// copy on a background thread and create the models on the main one.
    struct StoredFile: Sendable {
        let title: String
        let fileName: String
    }

    /// Results of importing a folder or ZIP archive: each file with the folders it sits in.
    struct FolderResult: Sendable {
        var files: [(folders: [String], file: StoredFile)] = []
        var skipped: [String] = []
        var failed: [String] = []
    }

    /// The type Word actually writes for a `.docx` file; `UTType(filenameExtension:)` alone also resolves it, but
    /// only once the system knows the extension, which a file shared from another app does not always guarantee.
    static let docxType = UTType("org.openxmlformats.wordprocessingml.document") ?? UTType(filenameExtension: "docx") ?? .data

    /// GoodNotes notebooks, declared in the app's Info.plist; a ZIP file in GoodNotes 6, a package before.
    static let goodNotesType = UTType("com.goodnotes.document") ?? UTType(filenameExtension: "goodnotes") ?? .data

    /// PDFs are copied as they are; images (photos of worksheets, screenshots) become a one-page PDF; Word
    /// documents are read into a PDF with the same headings, paragraphs, lists, tables and pictures; GoodNotes
    /// notebooks become a PDF with their backgrounds and handwriting.
    static func importFile(from source: URL) throws -> StudyMaterial {
        let stored = try store(from: source)
        return StudyMaterial(title: stored.title, fileName: stored.fileName)
    }

    static func store(from source: URL) throws -> StoredFile {
        let isScoped = source.startAccessingSecurityScopedResource()
        defer {
            if isScoped { source.stopAccessingSecurityScopedResource() }
        }
        return try coordinatedRead(source) { url in
            let type = UTType(filenameExtension: url.pathExtension)
            let title = source.deletingPathExtension().lastPathComponent
            if GoodNotes.isGoodNotes(url) {
                return try store(pdfData: GoodNotesRenderer.pdfData(GoodNotes.read(url: url)), title: title)
            }
            if type?.conforms(to: docxType) == true || url.pathExtension.lowercased() == "docx" {
                let data = try Data(contentsOf: url)
                let document = try DocxReader.open(data)
                return try store(pdfData: DocxRenderer.pdfData(document), title: title)
            }
            guard let type, type.conforms(to: .image), !type.conforms(to: .pdf) else {
                let fileName = UUID().uuidString + ".pdf"
                try FileManager.default.copyItem(at: url, to: self.url(for: fileName))
                return StoredFile(title: title, fileName: fileName)
            }
            let data = try Data(contentsOf: url)
            guard let image = UIImage(data: data) else {
                throw CocoaError(.fileReadCorruptFile)
            }
            return try store(pdfData: pdf(from: image), title: title)
        }
    }

    /// Reads through a file coordinator, which also downloads a file iCloud has only listed so far; a GoodNotes
    /// folder in iCloud Drive is often just that.
    private static func coordinatedRead<T>(_ url: URL, _ body: (URL) throws -> T) throws -> T {
        var coordinatorError: NSError?
        var result: Result<T, Error>?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinatorError) { readURL in
            result = Result { try body(readURL) }
        }
        if let result { return try result.get() }
        throw coordinatorError ?? CocoaError(.fileReadUnknown)
    }

    /// Every PDF, picture and Word file in the folder and its subfolders. Slow for big folders; call it off the
    /// main thread.
    static func importFolder(at root: URL) -> FolderResult {
        let isScoped = root.startAccessingSecurityScopedResource()
        defer {
            if isScoped { root.stopAccessingSecurityScopedResource() }
        }
        let scan = FolderImport.scan(root)
        var result = FolderResult(skipped: scan.skipped)
        for entry in scan.files {
            let url = URL(fileURLWithPath: entry.location)
            do {
                let stored = try store(from: url)
                result.files.append((entry.folders, stored))
            } catch {
                result.failed.append(url.lastPathComponent)
            }
        }
        return result
    }

    /// A ZIP archive, as GoodNotes and the Files app write them for several documents, imported like a folder.
    static func importArchive(at source: URL) throws -> FolderResult {
        let isScoped = source.startAccessingSecurityScopedResource()
        defer {
            if isScoped { source.stopAccessingSecurityScopedResource() }
        }
        let entries = try coordinatedRead(source) { try ZipArchive.files(Data(contentsOf: $0)) }
        let scan = FolderImport.scanArchive(Array(entries.keys), archiveName: source.deletingPathExtension().lastPathComponent)
        var result = FolderResult(skipped: scan.skipped)
        let staging = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: staging) }
        // Keyed the way `scanArchive` writes locations: slashes only, no empty parts.
        let byPath = Dictionary(entries.map { entry in
            (entry.key.replacingOccurrences(of: "\\", with: "/").split(separator: "/").joined(separator: "/"), entry.value)
        }, uniquingKeysWith: { first, _ in first })
        for entry in scan.files {
            let name = (entry.location as NSString).lastPathComponent
            do {
                guard let data = byPath[entry.location] else { throw CocoaError(.fileReadNoSuchFile) }
                let url = staging.appendingPathComponent(UUID().uuidString, isDirectory: true).appendingPathComponent(name)
                try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                try data.write(to: url)
                let stored = try store(from: url)
                result.files.append((entry.folders, stored))
            } catch {
                result.failed.append(name)
            }
        }
        return result
    }

    /// One page as wide as A4, as tall as the image needs.
    static func pdf(from image: UIImage) -> Data {
        let width: CGFloat = 595
        let height = max(1, (width * image.size.height / max(image.size.width, 1)).rounded())
        let bounds = CGRect(x: 0, y: 0, width: width, height: height)
        return UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
            context.beginPage()
            image.draw(in: bounds)
        }
    }

    /// A scan as a PDF with one page per picture, each as wide as A4 and as tall as the picture needs. The pictures are
    /// recompressed as JPEG first, so a ten-page scan is a few megabytes and not a few hundred.
    static func pdf(fromScan images: [UIImage]) -> Data {
        let width: CGFloat = 595
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: width, height: 842))
        return renderer.pdfData { context in
            for image in images {
                let height = max(1, (width * image.size.height / max(image.size.width, 1)).rounded())
                let bounds = CGRect(x: 0, y: 0, width: width, height: height)
                context.beginPage(withBounds: bounds, pageInfo: [:])
                let compact = image.jpegData(compressionQuality: 0.7).flatMap { UIImage(data: $0) } ?? image
                compact.draw(in: bounds)
            }
        }
    }

    static func save(pdfData: Data, title: String) throws -> StudyMaterial {
        let stored = try store(pdfData: pdfData, title: title)
        return StudyMaterial(title: stored.title, fileName: stored.fileName)
    }

    static func store(pdfData: Data, title: String) throws -> StoredFile {
        let fileName = UUID().uuidString + ".pdf"
        try pdfData.write(to: url(for: fileName), options: .atomic)
        return StoredFile(title: title, fileName: fileName)
    }

    /// An empty notebook: one page of the chosen paper, more are added in the document.
    static func createNotebook(title: String, paper: PaperStyle) throws -> StudyMaterial {
        let material = try save(pdfData: PaperRenderer.pdfData(paper), title: title)
        material.paper = paper.rawValue
        return material
    }

    static func delete(fileName: String) {
        MaterialTextIndex.remove(fileName: fileName)
        for annotation in loadNotes(for: fileName).annotations {
            if let image = annotation.image { try? FileManager.default.removeItem(at: noteImageURL(image)) }
        }
        try? FileManager.default.removeItem(at: url(for: fileName))
        try? FileManager.default.removeItem(at: drawingsURL(for: fileName))
        try? FileManager.default.removeItem(at: notesURL(for: fileName))
    }

    // Notes besides ink: typed text, pictures, stickers, bookmarks

    static func notesURL(for fileName: String) -> URL {
        directory.appendingPathComponent(fileName + ".notes.json")
    }

    static func loadNotes(for fileName: String) -> DocumentNotes {
        let url = notesURL(for: fileName)
        guard let data = try? Data(contentsOf: url) else { return DocumentNotes() }
        guard let notes = try? JSONDecoder().decode(DocumentNotes.self, from: data) else {
            // A file that exists but cannot be read is not "no notes": keep it, or the next save would replace it.
            setAside(url)
            return DocumentNotes()
        }
        return notes
    }

    /// False when the notes could not be written, so the editor can say so instead of losing them silently.
    @discardableResult
    static func saveNotes(_ notes: DocumentNotes, for fileName: String) -> Bool {
        guard let data = try? JSONEncoder().encode(notes) else { return false }
        return (try? data.write(to: notesURL(for: fileName), options: .atomic)) != nil
    }

    /// Renames an unreadable file to "<name>.unreadable-<time>", so it stays on the device for a repair.
    static func setAside(_ url: URL) {
        let stamp = Int(Date().timeIntervalSince1970)
        let target = url.deletingLastPathComponent().appendingPathComponent(url.lastPathComponent + ".unreadable-\(stamp)")
        try? FileManager.default.moveItem(at: url, to: target)
    }

    private static var noteImagesDirectory: URL {
        let url = directory.appendingPathComponent("NoteImages", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func noteImageURL(_ name: String) -> URL {
        noteImagesDirectory.appendingPathComponent(name)
    }

    /// Stores a picture placed on a page; long sides are limited to 2000 px.
    static func saveNoteImage(_ image: UIImage) -> String? {
        let longest = max(image.size.width, image.size.height)
        let scale = min(1, 2000 / max(longest, 1))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        guard let data = resized.jpegData(compressionQuality: 0.85) else { return nil }
        let name = UUID().uuidString + ".jpg"
        do {
            try data.write(to: noteImageURL(name), options: .atomic)
            return name
        } catch {
            return nil
        }
    }

    static func noteImage(_ name: String) -> UIImage? {
        UIImage(contentsOfFile: noteImageURL(name).path)
    }

    // Pages

    /// Inserts a page of paper after `index`, moving ink, notes and bookmarks of later pages along.
    static func insertPage(in material: StudyMaterial, after index: Int, paper: PaperStyle) -> Bool {
        guard let document = PDFDocument(url: material.fileURL) else { return false }
        let reference = document.page(at: min(max(index, 0), document.pageCount - 1))
        let size = reference?.bounds(for: .cropBox).size ?? PaperRenderer.a4
        guard let page = PaperRenderer.page(paper, size: size) else { return false }
        let position = min(index + 1, document.pageCount)
        document.insert(page, at: position)
        var notes = loadNotes(for: material.fileName)
        notes.insertPage(at: position)
        guard commit(document, to: material, drawings: PageShift.inserting(loadDrawings(for: material.fileName), at: position), notes: notes) else { return false }
        MaterialTextIndex.remove(fileName: material.fileName)
        return true
    }

    /// Inserts every page of `document` after `index`, moving ink, notes and bookmarks of later pages along.
    private static func insertPages(_ document: PDFDocument, in material: StudyMaterial, after index: Int) -> Bool {
        guard document.pageCount > 0, let target = PDFDocument(url: material.fileURL) else { return false }
        let position = min(max(index, -1) + 1, target.pageCount)
        for offset in 0..<document.pageCount {
            guard let page = document.page(at: offset)?.copy() as? PDFPage else { return false }
            target.insert(page, at: position + offset)
        }
        let count = document.pageCount
        var notes = loadNotes(for: material.fileName)
        notes.insertPage(at: position, count: count)
        let shifted = PageShift.inserting(loadDrawings(for: material.fileName), at: position, count: count)
        guard commit(target, to: material, drawings: shifted, notes: notes) else { return false }
        MaterialTextIndex.remove(fileName: material.fileName)
        return true
    }

    /// Inserts every page of a PDF file after `index`.
    static func insertPDF(from source: URL, in material: StudyMaterial, after index: Int) -> Bool {
        let isScoped = source.startAccessingSecurityScopedResource()
        defer {
            if isScoped { source.stopAccessingSecurityScopedResource() }
        }
        guard let document = PDFDocument(url: source) else { return false }
        return insertPages(document, in: material, after: index)
    }

    /// One picture as a new page after `index`, fit to the size of the document's other pages.
    static func insertImagePage(_ image: UIImage, in material: StudyMaterial, after index: Int) -> Bool {
        insertImagePages([image], in: material, after: index)
    }

    /// Several pictures (a scan) as new pages after `index`, each fit to the size of the document's other pages.
    static func insertImagePages(_ images: [UIImage], in material: StudyMaterial, after index: Int) -> Bool {
        guard !images.isEmpty, let target = PDFDocument(url: material.fileURL) else { return false }
        let reference = target.page(at: min(max(index, 0), target.pageCount - 1))
        let size = reference?.bounds(for: .cropBox).size ?? PaperRenderer.a4
        let bounds = CGRect(origin: .zero, size: size)
        let data = UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
            for image in images {
                context.beginPage()
                UIColor.white.setFill()
                context.cgContext.fill(bounds)
                let scale = min(size.width / max(image.size.width, 1), size.height / max(image.size.height, 1))
                let fitted = CGSize(width: image.size.width * scale, height: image.size.height * scale)
                let origin = CGPoint(x: (size.width - fitted.width) / 2, y: (size.height - fitted.height) / 2)
                image.draw(in: CGRect(origin: origin, size: fitted))
            }
        }
        guard let document = PDFDocument(data: data) else { return false }
        return insertPages(document, in: material, after: index)
    }

    /// Puts every page of `source` into `target`, after page `index` or at the end. The source's ink, texts,
    /// pictures and bookmarks come along and stay editable; the target's own later pages move back.
    static func merge(_ source: StudyMaterial, into target: StudyMaterial, after index: Int? = nil) -> Bool {
        guard source.fileName != target.fileName,
              let incoming = PDFDocument(url: source.fileURL), incoming.pageCount > 0,
              let combined = PDFDocument(url: target.fileURL)
        else { return false }
        let position = index.map { min(max($0, -1) + 1, combined.pageCount) } ?? combined.pageCount
        let count = incoming.pageCount
        for offset in 0..<count {
            guard let page = incoming.page(at: offset)?.copy() as? PDFPage else { return false }
            combined.insert(page, at: position + offset)
        }
        var drawings = PageShift.inserting(loadDrawings(for: target.fileName), at: position, count: count)
        for (page, drawing) in loadDrawings(for: source.fileName) where page < count {
            drawings[position + page] = drawing
        }

        var notes = loadNotes(for: target.fileName)
        notes.insertPage(at: position, count: count)
        let carried = loadNotes(for: source.fileName)
        for var annotation in carried.annotations where annotation.page < count {
            annotation.id = UUID().uuidString
            annotation.page += position
            notes.annotations.append(annotation)
        }
        for (page, size) in carried.canvasSizes where page < count {
            notes.canvasSizes[position + page] = size
        }
        for bookmark in carried.bookmarks where bookmark < count {
            notes.bookmarks.insert(position + bookmark)
        }
        guard commit(combined, to: target, drawings: drawings, notes: notes) else { return false }
        MaterialTextIndex.remove(fileName: target.fileName)
        return true
    }

    /// Removes a page with its ink and notes; the last page of a document stays.
    static func deletePage(in material: StudyMaterial, at index: Int) -> Bool {
        guard let document = PDFDocument(url: material.fileURL), document.pageCount > 1, index < document.pageCount else { return false }
        document.removePage(at: index)
        var notes = loadNotes(for: material.fileName)
        let before = Set(notes.annotations.compactMap(\.image))
        notes.deletePage(at: index)
        guard commit(document, to: material, drawings: PageShift.deleting(loadDrawings(for: material.fileName), at: index), notes: notes) else { return false }
        // Pictures only the deleted page showed; a duplicate elsewhere keeps its file.
        for image in before.subtracting(notes.annotations.compactMap(\.image)) {
            try? FileManager.default.removeItem(at: noteImageURL(image))
        }
        MaterialTextIndex.remove(fileName: material.fileName)
        return true
    }

    /// Pages whose ink could not be read (made by a newer version, say): kept as raw data and written back with
    /// the others, so a save does not delete them.
    private static var unreadableInk: [String: [String: Data]] = [:]
    /// The data of each page as it was last written or read, so a save encodes only the pages that changed.
    private static var encodedInk: [String: [Int: Data]] = [:]
    private static let unreadableLock = NSLock()

    static func loadDrawings(for fileName: String) -> [Int: PKDrawing] {
        let url = drawingsURL(for: fileName)
        guard let data = try? Data(contentsOf: url) else { return [:] }
        guard let raw = try? PropertyListDecoder().decode([String: Data].self, from: data) else {
            setAside(url)
            return [:]
        }
        var drawings: [Int: PKDrawing] = [:]
        var unreadable: [String: Data] = [:]
        for (key, value) in raw {
            if let index = Int(key), let drawing = try? PKDrawing(data: value) {
                drawings[index] = drawing
            } else {
                unreadable[key] = value
            }
        }
        unreadableLock.lock()
        unreadableInk[fileName] = unreadable
        encodedInk[fileName] = Dictionary(uniqueKeysWithValues: raw.compactMap { key, value in
            Int(key).flatMap { drawings[$0] != nil ? ($0, value) : nil }
        })
        unreadableLock.unlock()
        return drawings
    }

    /// False when the ink could not be written, so the editor can say so instead of losing it silently.
    /// The ink file's data for `drawings`, and what each page encoded to. `changed` names the pages whose ink is
    /// different from the last save; the others are taken from what was encoded before. Without it every page is
    /// encoded again (after pages were inserted, say).
    private static func encodeInk(_ drawings: [Int: PKDrawing], for fileName: String, changed: Set<Int>?) -> (file: Data, pages: [Int: Data])? {
        var raw: [String: Data] = [:]
        unreadableLock.lock()
        let carried = unreadableInk[fileName] ?? [:]
        let known = changed == nil ? [:] : (encodedInk[fileName] ?? [:])
        unreadableLock.unlock()
        for (key, value) in carried where Int(key).map({ drawings[$0] == nil }) ?? true { raw[key] = value }
        var encoded: [Int: Data] = [:]
        for (index, drawing) in drawings where !drawing.strokes.isEmpty {
            let data: Data
            if let cached = known[index], changed?.contains(index) == false {
                data = cached
            } else {
                data = drawing.dataRepresentation()
            }
            encoded[index] = data
            raw[String(index)] = data
        }
        guard let file = try? PropertyListEncoder().encode(raw) else { return nil }
        return (file, encoded)
    }

    private static func remember(_ pages: [Int: Data], for fileName: String) {
        unreadableLock.lock()
        encodedInk[fileName] = pages
        unreadableLock.unlock()
    }

    /// False when the ink could not be written, so the editor can say so instead of losing it silently.
    @discardableResult
    static func saveDrawings(_ drawings: [Int: PKDrawing], for fileName: String, changed: Set<Int>? = nil) -> Bool {
        guard let ink = encodeInk(drawings, for: fileName, changed: changed),
              (try? ink.file.write(to: drawingsURL(for: fileName), options: .atomic)) != nil
        else { return false }
        remember(ink.pages, for: fileName)
        return true
    }

    /// Replaces the PDF, the ink file and the notes file of a document together. Each is written under a temporary
    /// name first, so a failure or a crash while writing leaves the old, matching set in place; only the three quick
    /// renames come at the end.
    private static func commit(_ document: PDFDocument, to material: StudyMaterial, drawings: [Int: PKDrawing], notes: DocumentNotes) -> Bool {
        let manager = FileManager.default
        let targets = [material.fileURL, drawingsURL(for: material.fileName), notesURL(for: material.fileName)]
        let temporaries = targets.map { $0.appendingPathExtension("new") }
        func discard() { for file in temporaries { try? manager.removeItem(at: file) } }
        guard let ink = encodeInk(drawings, for: material.fileName, changed: nil),
              let notesData = try? JSONEncoder().encode(notes),
              document.write(to: temporaries[0]),
              (try? ink.file.write(to: temporaries[1], options: .atomic)) != nil,
              (try? notesData.write(to: temporaries[2], options: .atomic)) != nil
        else {
            discard()
            return false
        }
        for (target, temporary) in zip(targets, temporaries) {
            do {
                if manager.fileExists(atPath: target.path) {
                    _ = try manager.replaceItemAt(target, withItemAt: temporary)
                } else {
                    try manager.moveItem(at: temporary, to: target)
                }
            } catch {
                discard()
                return false
            }
        }
        remember(ink.pages, for: material.fileName)
        return true
    }
}
