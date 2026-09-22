import Foundation
import SwiftData

@Model
final class StudyMaterial {
    var id: UUID
    var title: String
    var fileName: String
    var createdAt: Date
    var lastOpenedPage: Int

    init(title: String, fileName: String) {
        id = UUID()
        self.title = title
        self.fileName = fileName
        createdAt = .now
        lastOpenedPage = 0
    }

    var fileURL: URL {
        MaterialStore.url(for: fileName)
    }
}
