import Foundation
import SwiftData

@Model
final class StudyPlan {
    var title: String
    var examDate: Date
    var minutesPerDay: Int
    var isOverbooked: Bool
    var createdAt: Date
    /// Minute of the day for the daily reminder, nil when it is off.
    var reminderMinute: Int?
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
    /// A German YouTube search the model suggested for explainer videos; empty for older plans.
    var videoQuery: String = ""
    /// Practice exercises with worked solutions, as JSON.
    var exercisesJSON: String = ""
    /// The Wikipedia introduction to the topic, once looked up.
    var wikiTitle: String = ""
    var wikiURL: String = ""
    var wikiText: String = ""
    /// How many flashcards were made from this topic.
    var cardCount: Int = 0

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
        StudyAids.pagesLabel(sourcePages)
    }

    var exercises: [Exercise] {
        get { (try? JSONDecoder().decode([Exercise].self, from: Data(exercisesJSON.utf8))) ?? [] }
        set { exercisesJSON = (try? JSONEncoder().encode(newValue)).map { String(decoding: $0, as: UTF8.self) } ?? "" }
    }

    /// What the reminder and the calendar need to know about the topic.
    var reminderItem: PlanReminder.Item {
        PlanReminder.Item(title: title, summary: summary, pagesLabel: pagesLabel, minutes: estimatedMinutes, order: order, date: scheduledDate, isDone: isDone, videoQuery: videoQuery)
    }
}
