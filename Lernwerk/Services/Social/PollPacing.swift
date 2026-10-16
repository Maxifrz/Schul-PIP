import Foundation

/// How long to wait between two refreshes of an open chat or board: three seconds while things happen, then slower
/// the longer nothing changes, and back to three seconds with the first change. A class of students on one free
/// server would otherwise ask the same questions every three seconds for a room that is quiet.
struct PollPacing: Equatable {
    private(set) var quietRounds = 0

    /// The seconds to wait after a refresh that did or did not bring something new.
    mutating func next(changed: Bool) -> TimeInterval {
        quietRounds = changed ? 0 : quietRounds + 1
        switch quietRounds {
        case 0..<4: return 3
        case 4..<8: return 6
        default: return 12
        }
    }
}
