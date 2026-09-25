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

    private static func drawingsURL(for fileName: String) -> URL {
        directory.appendingPathComponent(fileName + ".drawings")
    }

    static func importPDF(from source: URL) throws -> StudyMaterial {
        let isScoped = source.startAccessingSecurityScopedResource()
        defer {
            if isScoped { source.stopAccessingSecurityScopedResource() }
        }
        let fileName = UUID().uuidString + ".pdf"
        try FileManager.default.copyItem(at: source, to: url(for: fileName))
        return StudyMaterial(title: source.deletingPathExtension().lastPathComponent, fileName: fileName)
    }

    /// The type Word actually writes for a `.docx` file; `UTType(filenameExtension:)` alone also resolves it, but
    /// only once the system knows the extension, which a file shared from another app does not always guarantee.
    static let docxType = UTType("org.openxmlformats.wordprocessingml.document") ?? UTType(filenameExtension: "docx") ?? .data

    /// PDFs are copied as they are; images (photos of worksheets, screenshots) become a one-page PDF; Word
    /// documents are read into a PDF with the same headings, paragraphs, lists, tables and pictures.
    static func importFile(from source: URL) throws -> StudyMaterial {
        let type = UTType(filenameExtension: source.pathExtension)
        let title = source.deletingPathExtension().lastPathComponent
        if type?.conforms(to: docxType) == true || source.pathExtension.lowercased() == "docx" {
            return try importDocx(from: source, title: title)
        }
        guard let type, type.conforms(to: .image), !type.conforms(to: .pdf) else {
            return try importPDF(from: source)
        }
        let isScoped = source.startAccessingSecurityScopedResource()
        defer {
            if isScoped { source.stopAccessingSecurityScopedResource() }
        }
        let data = try Data(contentsOf: source)
        guard let image = UIImage(data: data) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        return try save(pdfData: pdf(from: image), title: title)
    }

    private static func importDocx(from source: URL, title: String) throws -> StudyMaterial {
        let isScoped = source.startAccessingSecurityScopedResource()
        defer {
            if isScoped { source.stopAccessingSecurityScopedResource() }
        }
        let data = try Data(contentsOf: source)
        let document = try DocxReader.open(data)
        return try save(pdfData: DocxRenderer.pdfData(document), title: title)
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

    static func save(pdfData: Data, title: String) throws -> StudyMaterial {
        let fileName = UUID().uuidString + ".pdf"
        try pdfData.write(to: url(for: fileName), options: .atomic)
        return StudyMaterial(title: title, fileName: fileName)
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

    private static func notesURL(for fileName: String) -> URL {
        directory.appendingPathComponent(fileName + ".notes.json")
    }

    static func loadNotes(for fileName: String) -> DocumentNotes {
        guard let data = try? Data(contentsOf: notesURL(for: fileName)),
              let notes = try? JSONDecoder().decode(DocumentNotes.self, from: data)
        else { return DocumentNotes() }
        return notes
    }

    static func saveNotes(_ notes: DocumentNotes, for fileName: String) {
        guard let data = try? JSONEncoder().encode(notes) else { return }
        try? data.write(to: notesURL(for: fileName), options: .atomic)
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
        guard document.write(to: material.fileURL) else { return false }
        saveDrawings(PageShift.inserting(loadDrawings(for: material.fileName), at: position), for: material.fileName)
        var notes = loadNotes(for: material.fileName)
        notes.insertPage(at: position)
        saveNotes(notes, for: material.fileName)
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
        guard target.write(to: material.fileURL) else { return false }
        let count = document.pageCount
        saveDrawings(PageShift.inserting(loadDrawings(for: material.fileName), at: position, count: count), for: material.fileName)
        var notes = loadNotes(for: material.fileName)
        notes.insertPage(at: position, count: count)
        saveNotes(notes, for: material.fileName)
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
        guard let target = PDFDocument(url: material.fileURL) else { return false }
        let reference = target.page(at: min(max(index, 0), target.pageCount - 1))
        let size = reference?.bounds(for: .cropBox).size ?? PaperRenderer.a4
        let bounds = CGRect(origin: .zero, size: size)
        let data = UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
            context.beginPage()
            UIColor.white.setFill()
            context.cgContext.fill(bounds)
            let scale = min(size.width / max(image.size.width, 1), size.height / max(image.size.height, 1))
            let fitted = CGSize(width: image.size.width * scale, height: image.size.height * scale)
            let origin = CGPoint(x: (size.width - fitted.width) / 2, y: (size.height - fitted.height) / 2)
            image.draw(in: CGRect(origin: origin, size: fitted))
        }
        guard let document = PDFDocument(data: data) else { return false }
        return insertPages(document, in: material, after: index)
    }

    /// Removes a page with its ink and notes; the last page of a document stays.
    static func deletePage(in material: StudyMaterial, at index: Int) -> Bool {
        guard let document = PDFDocument(url: material.fileURL), document.pageCount > 1, index < document.pageCount else { return false }
        document.removePage(at: index)
        guard document.write(to: material.fileURL) else { return false }
        saveDrawings(PageShift.deleting(loadDrawings(for: material.fileName), at: index), for: material.fileName)
        var notes = loadNotes(for: material.fileName)
        let before = Set(notes.annotations.compactMap(\.image))
        notes.deletePage(at: index)
        saveNotes(notes, for: material.fileName)
        // Pictures only the deleted page showed; a duplicate elsewhere keeps its file.
        for image in before.subtracting(notes.annotations.compactMap(\.image)) {
            try? FileManager.default.removeItem(at: noteImageURL(image))
        }
        MaterialTextIndex.remove(fileName: material.fileName)
        return true
    }

    static func loadDrawings(for fileName: String) -> [Int: PKDrawing] {
        guard let data = try? Data(contentsOf: drawingsURL(for: fileName)),
              let raw = try? PropertyListDecoder().decode([String: Data].self, from: data)
        else {
            return [:]
        }
        var drawings: [Int: PKDrawing] = [:]
        for (key, value) in raw {
            if let index = Int(key), let drawing = try? PKDrawing(data: value) {
                drawings[index] = drawing
            }
        }
        return drawings
    }

    static func saveDrawings(_ drawings: [Int: PKDrawing], for fileName: String) {
        var raw: [String: Data] = [:]
        for (index, drawing) in drawings where !drawing.strokes.isEmpty {
            raw[String(index)] = drawing.dataRepresentation()
        }
        guard let data = try? PropertyListEncoder().encode(raw) else { return }
        try? data.write(to: drawingsURL(for: fileName), options: .atomic)
    }
}
