import Foundation
import SwiftData

@Model
final class ReviewCard {
    var front: String
    var back: String
    var materialID: UUID?
    var page: Int?
    var createdAt: Date
    var dueDate: Date
    var intervalDays: Int
    var easeFactor: Double
    var repetitions: Int
    var lapses: Int

    init(front: String, back: String, materialID: UUID?, page: Int?, now: Date = .now) {
        self.front = front
        self.back = back
        self.materialID = materialID
        self.page = page
        createdAt = now
        dueDate = now
        intervalDays = SchedulingState.new.intervalDays
        easeFactor = SchedulingState.new.easeFactor
        repetitions = SchedulingState.new.repetitions
        lapses = SchedulingState.new.lapses
    }

    var schedulingState: SchedulingState {
        SchedulingState(intervalDays: intervalDays, easeFactor: easeFactor, repetitions: repetitions, lapses: lapses)
    }

    func apply(_ grade: ReviewGrade, at date: Date = .now) {
        let next = SpacedRepetition.next(schedulingState, grade: grade)
        intervalDays = next.intervalDays
        easeFactor = next.easeFactor
        repetitions = next.repetitions
        lapses = next.lapses
        dueDate = SpacedRepetition.dueDate(for: next, reviewedAt: date)
    }
}
