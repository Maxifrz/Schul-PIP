import Foundation
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

    /// PDFs are copied as they are; images (photos of worksheets, screenshots) become a one-page PDF.
    static func importFile(from source: URL) throws -> StudyMaterial {
        let type = UTType(filenameExtension: source.pathExtension)
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
        return try save(pdfData: pdf(from: image), title: source.deletingPathExtension().lastPathComponent)
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
        let resized = UIGraphicsImageRenderer(size: size).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
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

    /// Removes a page with its ink and notes; the last page of a document stays.
    static func deletePage(in material: StudyMaterial, at index: Int) -> Bool {
        guard let document = PDFDocument(url: material.fileURL), document.pageCount > 1, index < document.pageCount else { return false }
        document.removePage(at: index)
        guard document.write(to: material.fileURL) else { return false }
        saveDrawings(PageShift.deleting(loadDrawings(for: material.fileName), at: index), for: material.fileName)
        var notes = loadNotes(for: material.fileName)
        for annotation in notes.annotations where annotation.page == index {
            if let image = annotation.image { try? FileManager.default.removeItem(at: noteImageURL(image)) }
        }
        notes.deletePage(at: index)
        saveNotes(notes, for: material.fileName)
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
