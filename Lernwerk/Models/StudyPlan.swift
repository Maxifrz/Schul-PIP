import Foundation
import SwiftData

@Model
final class StudyPlan {
    var title: String
    var examDate: Date
    var minutesPerDay: Int
    var isOverbooked: Bool
    var createdAt: Date
    @Relationship(deleteRule: .cascade, inverse: \PlanTopic.plan)
    var topics: [PlanTopic] = []

    init(title: String, examDate: Date, minutesPerDay: Int, isOverbooked: Bool) {
        self.title = title
        self.examDate = examDate
        self.minutesPerDay = minutesPerDay
        self.isOverbooked = isOverbooked
        createdAt = .now
    }
}

@Model
final class PlanTopic {
    var title: String
    var summary: String
    var materialID: UUID?
    var sourcePages: [Int]
    var estimatedMinutes: Int
    var order: Int
    var scheduledDate: Date
    var isDone: Bool
    var plan: StudyPlan?

    init(
        title: String,
        summary: String,
        materialID: UUID?,
        sourcePages: [Int],
        estimatedMinutes: Int,
        order: Int,
        scheduledDate: Date
    ) {
        self.title = title
        self.summary = summary
        self.materialID = materialID
        self.sourcePages = sourcePages
        self.estimatedMinutes = estimatedMinutes
        self.order = order
        self.scheduledDate = scheduledDate
        isDone = false
    }

    var pagesLabel: String {
        let pages = sourcePages.sorted()
        guard let first = pages.first, let last = pages.last else { return "" }
        return first == last ? "S. \(first)" : "S. \(first)–\(last)"
    }
}
