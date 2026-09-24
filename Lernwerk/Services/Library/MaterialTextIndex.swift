import Foundation
import PDFKit

/// The text of every PDF, read once and cached on disk, so the library search can look inside documents.
actor MaterialTextIndex {
    static let shared = MaterialTextIndex()

    private var texts: [String: [String]] = [:]

    private static var directory: URL {
        let url = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("MaterialText", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    private static func cacheURL(for fileName: String) -> URL {
        directory.appendingPathComponent(fileName + ".json")
    }

    /// Page texts by file name for all given materials; reads the ones not seen yet.
    func index(_ fileNames: [String]) -> [String: [String]] {
        for fileName in fileNames where texts[fileName] == nil {
            if let data = try? Data(contentsOf: Self.cacheURL(for: fileName)),
               let cached = try? JSONDecoder().decode([String].self, from: data) {
                texts[fileName] = cached
                continue
            }
            let pages = PDFDocument(url: MaterialStore.url(for: fileName)).map(PDFMaterialReader.pageTexts) ?? []
            texts[fileName] = pages
            if let data = try? JSONEncoder().encode(pages) {
                try? data.write(to: Self.cacheURL(for: fileName), options: .atomic)
            }
        }
        return texts.filter { fileNames.contains($0.key) }
    }

    nonisolated static func remove(fileName: String) {
        try? FileManager.default.removeItem(at: cacheURL(for: fileName))
    }
}
