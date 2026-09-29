import Foundation

/// The document on screen, so a file shared from another app can go into it instead of into the library.
@MainActor
final class OpenDocument {
    static let shared = OpenDocument()

    private(set) var materialID: UUID?
    private(set) var title = ""
    private var insert: (@MainActor (URL) -> Bool)?

    func register(_ material: StudyMaterial, insert: @escaping @MainActor (URL) -> Bool) {
        materialID = material.id
        title = material.title
        self.insert = insert
    }

    /// Only the document that registered last may leave; a document opened on top of it has taken over already.
    func unregister(_ material: StudyMaterial) {
        guard materialID == material.id else { return }
        materialID = nil
        title = ""
        insert = nil
    }

    /// Puts the file's pages after the current page; false if no document is open or the file is unreadable.
    func insert(_ url: URL) -> Bool {
        insert?(url) ?? false
    }
}
