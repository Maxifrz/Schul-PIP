import Foundation
import SwiftData

@Model
final class StudyMaterial {
    var id: UUID
    var title: String
    var fileName: String
    var createdAt: Date
    var lastOpenedPage: Int
    // Library organisation; the defaults let SwiftData migrate existing libraries on its own.
    /// The folder it lives in, nil for the top level of the library.
    var folderID: UUID? = nil
    /// One of `Subjects.all`, or empty.
    var subject: String = ""
    var isFavorite: Bool = false
    var lastOpenedAt: Date? = nil
    /// Set while it is in the trash; the trash empties itself after `Library.trashDays`.
    var deletedAt: Date? = nil
    /// The paper of a notebook made in the app (`PaperStyle`), empty for imported PDFs.
    var paper: String = ""

    init(title: String, fileName: String, folderID: UUID? = nil) {
        id = UUID()
        self.title = title
        self.fileName = fileName
        createdAt = .now
        lastOpenedPage = 0
        self.folderID = folderID
    }

    var fileURL: URL {
        MaterialStore.url(for: fileName)
    }

    var isTrashed: Bool { deletedAt != nil }
}

extension StudyMaterial: ShelfDocument {
    var itemID: String { id.uuidString }
    var folderKey: String? { folderID?.uuidString }
}

/// A folder in the library; folders nest through `parentID`.
@Model
final class MaterialFolder {
    var id: UUID
    var name: String
    var parentID: UUID?
    var createdAt: Date

    init(name: String, parentID: UUID? = nil) {
        id = UUID()
        self.name = name
        self.parentID = parentID
        createdAt = .now
    }
}

extension MaterialFolder: ShelfFolder {
    var folderID: String { id.uuidString }
    var parentKey: String? { parentID?.uuidString }
}
