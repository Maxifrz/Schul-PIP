import Foundation

/// Monday through Sunday, numbered like `CalendarDay.weekday` so the two line up without conversion.
enum Weekday: Int, CaseIterable, Identifiable, Comparable, Codable, Hashable {
    case monday = 1, tuesday, wednesday, thursday, friday, saturday, sunday

    var id: Int { rawValue }

    var shortLabel: String {
        ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][rawValue - 1]
    }

    var label: String {
        ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"][rawValue - 1]
    }

    static func < (a: Weekday, b: Weekday) -> Bool { a.rawValue < b.rawValue }
}

/// "07:45", minutes since midnight either way.
enum ClockTime {
    static func minutes(hour: Int, minute: Int) -> Int { hour * 60 + minute }

    static func label(_ minutes: Int) -> String {
        String(format: "%02d:%02d", minutes / 60, minutes % 60)
    }
}

/// Positions overlapping lessons side by side, the way a calendar app lays out a day view, without needing a full
/// calendar UI library: entries that never overlap in time each get the full width; entries that do share a column
/// count and get their own column within it.
enum TimetableLayout {
    struct Entry: Equatable {
        var weekday: Int
        var start: Int
        var end: Int
    }

    struct Placement: Equatable {
        var index: Int
        var column: Int
        var columns: Int
    }

    /// One placement per entry, in the same order they were passed in.
    static func placements(for entries: [Entry]) -> [Placement] {
        var result = entries.indices.map { Placement(index: $0, column: 0, columns: 1) }
        let weekdays = Set(entries.map(\.weekday))
        for weekday in weekdays {
            let dayIndices = entries.indices
                .filter { entries[$0].weekday == weekday }
                .sorted { a, b in
                    entries[a].start != entries[b].start ? entries[a].start < entries[b].start : entries[a].end < entries[b].end
                }
            for cluster in overlapClusters(dayIndices, entries: entries) {
                assignColumns(cluster, entries: entries, into: &result)
            }
        }
        return result
    }

    /// Splits time-sorted indices into runs where each entry starts before the cluster's running latest end —
    /// the connected components of the overlap graph, even when not every pair in the group directly overlaps.
    private static func overlapClusters(_ sorted: [Int], entries: [Entry]) -> [[Int]] {
        var clusters: [[Int]] = []
        var current: [Int] = []
        var runningEnd = Int.min
        for index in sorted {
            let entry = entries[index]
            if current.isEmpty || entry.start < runningEnd {
                current.append(index)
                runningEnd = max(runningEnd, entry.end)
            } else {
                clusters.append(current)
                current = [index]
                runningEnd = entry.end
            }
        }
        if !current.isEmpty { clusters.append(current) }
        return clusters
    }

    /// Greedy column reuse: an entry takes the first column whose last entry has already ended.
    private static func assignColumns(_ cluster: [Int], entries: [Entry], into result: inout [Placement]) {
        var columnEnds: [Int] = []
        var assigned: [Int: Int] = [:]
        for index in cluster {
            let entry = entries[index]
            if let free = columnEnds.firstIndex(where: { $0 <= entry.start }) {
                columnEnds[free] = entry.end
                assigned[index] = free
            } else {
                columnEnds.append(entry.end)
                assigned[index] = columnEnds.count - 1
            }
        }
        let columns = columnEnds.count
        for index in cluster {
            result[index] = Placement(index: index, column: assigned[index] ?? 0, columns: columns)
        }
    }

    /// The time span the grid should show, rounded to full hours, with a sensible default for an empty timetable.
    static func dayRange(for entries: [Entry]) -> (start: Int, end: Int) {
        guard !entries.isEmpty else { return (ClockTime.minutes(hour: 8, minute: 0), ClockTime.minutes(hour: 16, minute: 0)) }
        let start = (entries.map(\.start).min()! / 60) * 60
        let latestEnd = entries.map(\.end).max()!
        let end = latestEnd % 60 == 0 ? latestEnd : (latestEnd / 60 + 1) * 60
        return (start, max(end, start + 60))
    }
}
