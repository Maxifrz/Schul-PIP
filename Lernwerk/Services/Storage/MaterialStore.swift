import Foundation
import PencilKit

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

    static func save(pdfData: Data, title: String) throws -> StudyMaterial {
        let fileName = UUID().uuidString + ".pdf"
        try pdfData.write(to: url(for: fileName), options: .atomic)
        return StudyMaterial(title: title, fileName: fileName)
    }

    static func delete(fileName: String) {
        try? FileManager.default.removeItem(at: url(for: fileName))
        try? FileManager.default.removeItem(at: drawingsURL(for: fileName))
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
