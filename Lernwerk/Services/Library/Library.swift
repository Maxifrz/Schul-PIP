import Foundation

/// What the library logic needs from a document; implemented by the SwiftData model and by plain test values.
protocol LibraryItem {
    var itemID: String { get }
    var title: String { get }
    var subject: String { get }
    var createdAt: Date { get }
    var lastOpenedAt: Date? { get }
    var folderKey: String? { get }
    var deletedAt: Date? { get }
}

/// What the library logic needs from a folder.
protocol LibraryFolder {
    var folderID: String { get }
    var name: String { get }
    var parentKey: String? { get }
}

/// A school subject with its color in the library.
struct Subject: Equatable {
    var name: String
    var color: UInt32
}

enum Subjects {
    static let all = [
        Subject(name: "Mathe", color: 0x3D6FB6),
        Subject(name: "Deutsch", color: 0xC46A55),
        Subject(name: "Englisch", color: 0x8E6BB8),
        Subject(name: "Französisch", color: 0x5A7FC4),
        Subject(name: "Latein", color: 0x9A7B5B),
        Subject(name: "Biologie", color: 0x5E9E6E),
        Subject(name: "Chemie", color: 0x2E9C9C),
        Subject(name: "Physik", color: 0x4F6D8F),
        Subject(name: "Geschichte", color: 0xA67C52),
        Subject(name: "Politik", color: 0xB8A04A),
        Subject(name: "Erdkunde", color: 0x6E8B3D),
        Subject(name: "Informatik", color: 0x5A5AA8),
        Subject(name: "Kunst", color: 0xD17A9E),
        Subject(name: "Musik", color: 0x9E6B8E),
        Subject(name: "Religion/Ethik", color: 0x8C8C6E),
        Subject(name: "Sport", color: 0xD9903A),
        Subject(name: "Sonstiges", color: 0x8A8680),
    ]

    static func color(_ name: String) -> UInt32? {
        all.first { $0.name == name }?.color
    }
}

enum LibrarySort: String, CaseIterable {
    case recent, name, added, subject

    var label: String {
        switch self {
        case .recent: return "Zuletzt geöffnet"
        case .name: return "Name"
        case .added: return "Hinzugefügt"
        case .subject: return "Fach"
        }
    }
}

/// A search result: the item and, for a match in its text, the page and the passage around it.
struct SearchHit<Item> {
    var item: Item
    var page: Int?
    var snippet: String?
}

/// Sorting, searching and folder structure of the library. Mirrors the Android app.
enum Library {
    static let trashDays = 30
    private static let day: TimeInterval = 24 * 60 * 60

    private static func compare(_ a: String, _ b: String) -> Bool {
        a.compare(b, options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "de_DE")) == .orderedAscending
    }

    static func sort<Item: LibraryItem>(_ items: [Item], by sort: LibrarySort) -> [Item] {
        switch sort {
        case .recent:
            return items.sorted { ($0.lastOpenedAt ?? $0.createdAt) > ($1.lastOpenedAt ?? $1.createdAt) }
        case .name:
            return items.sorted { compare($0.title, $1.title) }
        case .added:
            return items.sorted { $0.createdAt > $1.createdAt }
        case .subject:
            return items.sorted { a, b in
                if a.subject.isEmpty != b.subject.isEmpty { return !a.subject.isEmpty }
                if a.subject != b.subject { return compare(a.subject, b.subject) }
                return compare(a.title, b.title)
            }
        }
    }

    /// Lower case without accents and ß as ss, so "aussere" finds "Äußere".
    static func normalize(_ text: String) -> String {
        String(normalizeMapped(text).text)
    }

    /// The normalized text and, for each of its characters, the index of the original character it came from.
    private static func normalizeMapped(_ text: String) -> (text: [Character], origin: [Int]) {
        var out: [Character] = []
        var origin: [Int] = []
        for (index, character) in text.enumerated() {
            let piece: String
            if character == "ß" || character == "ẞ" {
                piece = "ss"
            } else {
                piece = String(character).lowercased().folding(options: .diacriticInsensitive, locale: Locale(identifier: "de_DE"))
            }
            for normalized in piece {
                out.append(normalized)
                origin.append(index)
            }
        }
        return (out, origin)
    }

    private static func terms(_ query: String) -> [String] {
        normalize(query).split(whereSeparator: \.isWhitespace).map(String.init)
    }

    /// Items whose title, subject or folder name contain every word of the query come first; then those whose text
    /// does, with the first matching page and the passage around the first word.
    static func search<Item: LibraryItem, Folder: LibraryFolder>(
        _ items: [Item],
        folders: [Folder],
        query: String,
        pageTexts: (Item) -> [String]?
    ) -> [SearchHit<Item>] {
        let words = terms(query)
        guard !words.isEmpty else { return [] }
        let folderNames = Dictionary(folders.map { ($0.folderID, $0.name) }, uniquingKeysWith: { first, _ in first })
        var byTitle: [SearchHit<Item>] = []
        var byText: [SearchHit<Item>] = []
        for item in items {
            let label = normalize("\(item.title) \(item.subject) \(item.folderKey.flatMap { folderNames[$0] } ?? "")")
            if words.allSatisfy({ label.contains($0) }) {
                byTitle.append(SearchHit(item: item))
                continue
            }
            guard let pages = pageTexts(item) else { continue }
            for (index, text) in pages.enumerated() {
                let normalized = normalize(text)
                if words.allSatisfy({ normalized.contains($0) }) {
                    byText.append(SearchHit(item: item, page: index + 1, snippet: snippet(text, word: words[0])))
                    break
                }
            }
        }
        return byTitle + byText
    }

    /// About 90 characters around the first match of `word` (normalized), cut at word boundaries.
    static func snippet(_ text: String, word: String) -> String {
        let flat = Array(text.split(whereSeparator: \.isWhitespace).joined(separator: " "))
        let (normalized, origin) = normalizeMapped(String(flat))
        let target = Array(word)
        var found: Int?
        if target.count <= normalized.count {
            for start in 0...(normalized.count - target.count) where Array(normalized[start..<(start + target.count)]) == target {
                found = start
                break
            }
        }
        let at = found.map { origin[$0] } ?? 0
        let matchEnd = found.map { origin[$0 + target.count - 1] + 1 } ?? 0
        var start = max(0, at - 40)
        var end = min(flat.count, matchEnd + 50)
        if start > 0, let space = flat[start..<at].firstIndex(of: " ") { start = space + 1 }
        if end < flat.count, let space = flat[matchEnd..<end].lastIndex(of: " ") { end = space }
        let body = String(flat[start..<end]).trimmingCharacters(in: .whitespaces)
        return (start > 0 ? "…" : "") + body + (end < flat.count ? "…" : "")
    }

    /// The folder and everything inside it, at any depth.
    static func descendants<Folder: LibraryFolder>(_ folders: [Folder], of id: String) -> Set<String> {
        var result: Set<String> = [id]
        var added = true
        while added {
            added = false
            for folder in folders {
                if let parent = folder.parentKey, result.contains(parent), result.insert(folder.folderID).inserted { added = true }
            }
        }
        return result
    }

    /// From the top level down to the folder, for the breadcrumb.
    static func path<Folder: LibraryFolder>(_ folders: [Folder], to id: String?) -> [Folder] {
        let byID = Dictionary(folders.map { ($0.folderID, $0) }, uniquingKeysWith: { first, _ in first })
        var result: [Folder] = []
        var seen: Set<String> = []
        var current = id.flatMap { byID[$0] }
        while let folder = current, seen.insert(folder.folderID).inserted {
            result.insert(folder, at: 0)
            current = folder.parentKey.flatMap { byID[$0] }
        }
        return result
    }

    /// Folders a folder may move into: not itself and nothing inside it.
    static func moveTargets<Folder: LibraryFolder>(_ folders: [Folder], moving: String?) -> [Folder] {
        let excluded = moving.map { descendants(folders, of: $0) } ?? []
        return folders.filter { !excluded.contains($0.folderID) }
    }

    static func isExpired(_ item: some LibraryItem, now: Date) -> Bool {
        guard let deleted = item.deletedAt else { return false }
        return now.timeIntervalSince(deleted) > Double(trashDays) * day
    }

    /// Days until a trashed item is deleted for good.
    static func daysLeft(_ item: some LibraryItem, now: Date) -> Int {
        guard let deleted = item.deletedAt else { return trashDays }
        return max(0, trashDays - Int(now.timeIntervalSince(deleted) / day))
    }
}
