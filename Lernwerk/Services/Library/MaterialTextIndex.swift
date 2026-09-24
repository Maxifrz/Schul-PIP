import Foundation
import PDFKit

/// The text of every PDF, read once and cached on disk, so the library search can look inside documents.
actor MaterialTextIndex {
    static let shared = MaterialTextIndex()

    private var texts: [String: (modified: Date, pages: [String])] = [:]

    private static var directory: URL {
        let url = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("MaterialText", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    private static func cacheURL(for fileName: String) -> URL {
        directory.appendingPathComponent(fileName + ".json")
    }

    private static func modified(_ url: URL) -> Date {
        ((try? FileManager.default.attributesOfItem(atPath: url.path))?[.modificationDate] as? Date) ?? .distantPast
    }

    /// Page texts by file name for all given materials; reads the ones not seen yet or changed since.
    func index(_ fileNames: [String]) -> [String: [String]] {
        for fileName in fileNames {
            let pdf = MaterialStore.url(for: fileName)
            let modified = Self.modified(pdf)
            if let known = texts[fileName], known.modified == modified { continue }
            let cache = Self.cacheURL(for: fileName)
            if Self.modified(cache) >= modified,
               let data = try? Data(contentsOf: cache),
               let cached = try? JSONDecoder().decode([String].self, from: data) {
                texts[fileName] = (modified, cached)
                continue
            }
            let pages = PDFDocument(url: pdf).map(PDFMaterialReader.pageTexts) ?? []
            texts[fileName] = (modified, pages)
            if let data = try? JSONEncoder().encode(pages) {
                try? data.write(to: cache, options: .atomic)
            }
        }
        return texts.filter { fileNames.contains($0.key) }.mapValues { $0.pages }
    }

    nonisolated static func remove(fileName: String) {
        try? FileManager.default.removeItem(at: cacheURL(for: fileName))
    }
}
