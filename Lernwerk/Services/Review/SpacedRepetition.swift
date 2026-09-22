import Foundation

enum ReviewGrade: Int, CaseIterable {
    case again = 0
    case hard = 3
    case good = 4
    case easy = 5

    var label: String {
        switch self {
        case .again: return "Nochmal"
        case .hard: return "Schwer"
        case .good: return "Gut"
        case .easy: return "Leicht"
        }
    }
}

struct SchedulingState: Equatable {
    static let initialEase = 2.5
    static let minimumEase = 1.3
    static let new = SchedulingState(intervalDays: 0, easeFactor: initialEase, repetitions: 0, lapses: 0)

    var intervalDays: Int
    var easeFactor: Double
    var repetitions: Int
    var lapses: Int
}

/// SM-2 scheduling; a failed card comes back after a short relearning delay instead of the next day.
enum SpacedRepetition {
    static let relearnDelay: TimeInterval = 10 * 60

    static func next(_ state: SchedulingState, grade: ReviewGrade) -> SchedulingState {
        var result = state
        let quality = Double(grade.rawValue)
        let easeChange = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
        result.easeFactor = max(SchedulingState.minimumEase, state.easeFactor + easeChange)

        if grade == .again {
            result.repetitions = 0
            result.intervalDays = 0
            result.lapses += 1
            return result
        }

        result.repetitions += 1
        switch result.repetitions {
        case 1:
            result.intervalDays = 1
        case 2:
            result.intervalDays = 6
        default:
            result.intervalDays = max(1, Int((Double(state.intervalDays) * result.easeFactor).rounded()))
        }
        return result
    }

    static func dueDate(for state: SchedulingState, reviewedAt date: Date, calendar: Calendar = .current) -> Date {
        guard state.intervalDays > 0 else {
            return date.addingTimeInterval(relearnDelay)
        }
        let startOfDay = calendar.startOfDay(for: date)
        return calendar.date(byAdding: .day, value: state.intervalDays, to: startOfDay) ?? date
    }
}
