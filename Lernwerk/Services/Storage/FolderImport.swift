import Foundation

/// A file found in an imported folder or ZIP archive.
struct FolderImportEntry: Equatable {
    /// Where it lies: a URL on disk, or the path inside the archive.
    var location: String
    /// The folders it sits in, from the import root down; the root's own name comes first.
    var folders: [String]
}

/// What a folder or archive holds: the files the library can take, and the names of those it cannot.
struct FolderScan: Equatable {
    var files: [FolderImportEntry] = []
    var skipped: [String] = []
}

/// Importing a whole folder, like a GoodNotes export: every PDF, picture and Word file below it, with the
/// subfolders recreated as library folders. Kept free of UIKit so it runs in the tests.
enum FolderImport {
    static let extensions: Set<String> = ["pdf", "docx", "png", "jpg", "jpeg", "heic", "heif", "webp", "gif", "tif", "tiff", "bmp"]

    /// Documents stored as folders; a folder named „Bio 11.2“ still has to count as a folder.
    static let packageExtensions: Set<String> = ["goodnotes", "note", "nbn", "pages", "key", "numbers", "app", "bundle", "rtfd"]

    /// Symbolic links can loop; no school folder is deeper than this.
    static let maxDepth = 24

    static func isImportable(_ name: String) -> Bool {
        guard !name.hasPrefix(".") else { return false }
        return extensions.contains((name as NSString).pathExtension.lowercased())
    }

    /// Files iCloud has not downloaded yet appear as `.Name.pdf.icloud`; this is the real name.
    static func iCloudPlaceholderName(_ name: String) -> String? {
        guard name.hasPrefix("."), name.hasSuffix(".icloud"), name.count > 8 else { return nil }
        return String(name.dropFirst().dropLast(7))
    }

    /// Finder's `._` copies, `.DS_Store` and the like; never shown as skipped.
    private static func isHidden(_ name: String) -> Bool {
        name.hasPrefix(".") || name == "__MACOSX" || name == "Thumbs.db" || name == "desktop.ini"
    }

    private static func ordered(_ a: String, _ b: String) -> Bool {
        a.compare(b, options: [.caseInsensitive, .numeric]) == .orderedAscending
    }

    /// Every importable file below `root`, folder by folder in name order.
    static func scan(_ root: URL) -> FolderScan {
        var result = FolderScan()
        let manager = FileManager.default
        func walk(_ directory: URL, _ folders: [String]) {
            guard folders.count <= maxDepth, let names = try? manager.contentsOfDirectory(atPath: directory.path) else { return }
            for name in names.sorted(by: ordered) {
                let url = directory.appendingPathComponent(name)
                var isDirectory: ObjCBool = false
                guard manager.fileExists(atPath: url.path, isDirectory: &isDirectory) else { continue }
                if isDirectory.boolValue {
                    // Packages such as `.goodnotes` documents look like folders but are one file to the user.
                    if isHidden(name) { continue }
                    if packageExtensions.contains((name as NSString).pathExtension.lowercased()) {
                        result.skipped.append(name)
                    } else {
                        walk(url, folders + [name])
                    }
                } else if let real = iCloudPlaceholderName(name) {
                    if isImportable(real) {
                        result.files.append(FolderImportEntry(location: directory.appendingPathComponent(real).path, folders: folders))
                    } else {
                        result.skipped.append(real)
                    }
                } else if isImportable(name) {
                    result.files.append(FolderImportEntry(location: url.path, folders: folders))
                } else if !isHidden(name) {
                    result.skipped.append(name)
                }
            }
        }
        walk(root, [root.lastPathComponent])
        return result
    }

    /// The entries of a ZIP archive. An archive that holds a single folder is imported as that folder; any other
    /// becomes a folder named after the archive.
    static func scanArchive(_ paths: [String], archiveName: String) -> FolderScan {
        let parts = paths
            .map { $0.replacingOccurrences(of: "\\", with: "/").split(separator: "/").map(String.init) }
            .filter { !$0.isEmpty && !$0.contains(where: isHidden) }
        let fileParts = parts.filter { part in
            // Directories are listed with a trailing slash, which `split` drops; a path that is the prefix of
            // another one is a directory.
            !parts.contains { $0.count > part.count && Array($0.prefix(part.count)) == part }
        }
        let tops = Set(fileParts.map(\.first!))
        let singleFolder = tops.count == 1 && fileParts.allSatisfy { $0.count > 1 }
        var result = FolderScan()
        for part in fileParts.sorted(by: { ordered($0.joined(separator: "/"), $1.joined(separator: "/")) }) {
            let name = part.last!
            guard isImportable(name) else {
                result.skipped.append(name)
                continue
            }
            let folders = singleFolder ? Array(part.dropLast()) : [archiveName] + part.dropLast()
            result.files.append(FolderImportEntry(location: part.joined(separator: "/"), folders: folders))
        }
        return result
    }

    /// The folders the files need, each parent before its children.
    static func folderPaths(_ entries: [[String]]) -> [[String]] {
        var seen: Set<[String]> = []
        var result: [[String]] = []
        for path in entries where !path.isEmpty {
            for depth in 1 ... path.count {
                let prefix = Array(path.prefix(depth))
                if seen.insert(prefix).inserted { result.append(prefix) }
            }
        }
        return result
    }

    /// The note after an import, when something was left out; nil when everything came in.
    static func summary(imported: Int, skipped: [String], failed: [String]) -> String? {
        guard !skipped.isEmpty || !failed.isEmpty else { return nil }
        var lines = [imported == 1 ? "1 Dokument importiert." : "\(imported) Dokumente importiert."]
        if !failed.isEmpty {
            lines.append("Nicht lesbar: " + list(failed))
        }
        if !skipped.isEmpty {
            lines.append("Übersprungen: " + list(skipped))
        }
        if skipped.contains(where: { ($0 as NSString).pathExtension.lowercased() == "goodnotes" }) {
            lines.append("GoodNotes-Dateien (.goodnotes) kann nur GoodNotes selbst lesen. Exportiere sie dort als PDF.")
        }
        return lines.joined(separator: "\n\n")
    }

    private static func list(_ names: [String]) -> String {
        let shown = names.prefix(5).joined(separator: ", ")
        return names.count > 5 ? shown + " und \(names.count - 5) weitere" : shown
    }
}
