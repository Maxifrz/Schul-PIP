import Foundation

struct TopicDraft: Codable, Equatable {
    var title: String
    var summary: String
    var prerequisites: [String]
    var materialIndex: Int
    var sourcePages: [Int]
    var estimatedMinutes: Int
}

struct ScheduledTopic: Equatable {
    var draft: TopicDraft
    var order: Int
    var date: Date
}

struct PlanSchedule: Equatable {
    var topics: [ScheduledTopic]
    var isOverbooked: Bool
}

/// Orders topics so prerequisites come first and spreads them over days until the exam.
enum PlanScheduler {
    static func order(_ drafts: [TopicDraft]) -> [TopicDraft] {
        var indexByTitle: [String: Int] = [:]
        for (index, draft) in drafts.enumerated() where indexByTitle[normalize(draft.title)] == nil {
            indexByTitle[normalize(draft.title)] = index
        }
        let prerequisites: [Set<Int>] = drafts.enumerated().map { index, draft in
            Set(draft.prerequisites.compactMap { indexByTitle[normalize($0)] }.filter { $0 != index })
        }

        var placed = Set<Int>()
        var result: [TopicDraft] = []
        while placed.count < drafts.count {
            let ready = drafts.indices.first { !placed.contains($0) && prerequisites[$0].isSubset(of: placed) }
            // A dependency cycle leaves nothing ready; break it by taking the earliest remaining topic.
            guard let next = ready ?? drafts.indices.first(where: { !placed.contains($0) }) else { break }
            placed.insert(next)
            result.append(drafts[next])
        }
        return result
    }

    static func assignDates(minutes: [Int], start: Date, minutesPerDay: Int, calendar: Calendar = .current) -> [Date] {
        let capacity = max(1, minutesPerDay)
        var day = calendar.startOfDay(for: start)
        var used = 0
        var dates: [Date] = []
        for value in minutes {
            let needed = max(1, value)
            if used > 0, used + needed > capacity {
                day = calendar.date(byAdding: .day, value: 1, to: day) ?? day
                used = 0
            }
            dates.append(day)
            used += needed
        }
        return dates
    }

    static func schedule(
        _ drafts: [TopicDraft],
        start: Date,
        examDate: Date,
        minutesPerDay: Int,
        calendar: Calendar = .current
    ) -> PlanSchedule {
        let ordered = order(drafts)
        let dates = assignDates(
            minutes: ordered.map(\.estimatedMinutes),
            start: start,
            minutesPerDay: minutesPerDay,
            calendar: calendar
        )
        let topics = zip(ordered, dates).enumerated().map { index, pair in
            ScheduledTopic(draft: pair.0, order: index, date: pair.1)
        }
        return PlanSchedule(
            topics: topics,
            isOverbooked: isOverbooked(dates: dates, examDate: examDate, calendar: calendar)
        )
    }

    static func isOverbooked(dates: [Date], examDate: Date, calendar: Calendar = .current) -> Bool {
        guard let last = dates.last else { return false }
        return last >= calendar.startOfDay(for: examDate)
    }

    private static func normalize(_ title: String) -> String {
        title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
