import Foundation

/// One flashcard as the Lernpfad sees it: plain values, so the path, the exercises and the tests need no SwiftData.
struct CardSnapshot: Equatable, Hashable {
    /// Stays the same as long as the card's text, material and creation time do.
    let key: String
    let front: String
    let back: String
    let materialID: UUID?
    let createdAt: Date
    let dueDate: Date

    init(key: String, front: String, back: String, materialID: UUID?, createdAt: Date, dueDate: Date) {
        self.key = key
        self.front = front
        self.back = back
        self.materialID = materialID
        self.createdAt = createdAt
        self.dueDate = dueDate
    }

    /// Derives the key from the card's own data.
    init(front: String, back: String, materialID: UUID?, createdAt: Date, dueDate: Date) {
        self.init(
            key: CardSnapshot.key(front: front, back: back, materialID: materialID, createdAt: createdAt),
            front: front, back: back, materialID: materialID, createdAt: createdAt, dueDate: dueDate
        )
    }

    func isDue(at now: Date) -> Bool {
        dueDate <= now
    }

    /// A card whose text changes gets a new key, so its lesson counts as new and its cached wrong answers are asked
    /// for again.
    static func key(front: String, back: String, materialID: UUID?, createdAt: Date) -> String {
        let millis = Int64((createdAt.timeIntervalSince1970 * 1000).rounded())
        let parts = [String(millis), materialID?.uuidString ?? "-", front, back]
        return "c" + StableHash.hex(parts.joined(separator: "\u{1F}"))
    }
}

/// FNV-1a with 64 bits: the same text gives the same id on every launch, unlike `hashValue`.
enum StableHash {
    static func hex(_ text: String) -> String {
        var hash: UInt64 = 0xCBF2_9CE4_8422_2325
        for byte in text.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01B3
        }
        let digits = String(hash, radix: 16)
        return String(repeating: "0", count: max(0, 16 - digits.count)) + digits
    }
}

enum LessonState: String, Equatable {
    case locked, open, done
}

struct LearnLesson: Identifiable, Equatable {
    let id: String
    /// Position in its unit, from 0.
    let index: Int
    let cards: [CardSnapshot]
    let state: LessonState

    var cardKeys: [String] { cards.map(\.key) }
}

/// The cards of one material (or the ones without a material) as a row of lessons.
struct LearnUnit: Identifiable, Equatable {
    /// The material's id, or `LearnPath.otherUnitID` for cards without one.
    let id: String
    let materialID: UUID?
    let lessons: [LearnLesson]

    var cards: [CardSnapshot] { lessons.flatMap(\.cards) }
}

/// The Lernpfad: the flashcards grouped into units by material and cut into short lessons that open one after the
/// other. Which lessons are done comes from outside, so the path itself holds no state.
enum LearnPath {
    static let lessonSize = 6
    /// A last lesson with fewer cards than this joins the one before it.
    static let smallestLastLesson = 4
    /// With fewer cards in total the path explains where cards come from instead.
    static let minimumCards = 4
    static let otherUnitID = "sonstiges"
    static let otherUnitTitle = "Sonstiges"

    static func units(from cards: [CardSnapshot], completed: Set<String>) -> [LearnUnit] {
        var seen = Set<String>()
        let unique = cards.filter { seen.insert($0.key).inserted }
        let groups = Dictionary(grouping: unique, by: \.materialID)
            .map { (materialID: $0.key, cards: $0.value.sorted(by: cardOrder)) }
            .sorted { a, b in
                let first = a.cards[0], second = b.cards[0]
                if first.createdAt != second.createdAt { return first.createdAt < second.createdAt }
                return unitID(a.materialID) < unitID(b.materialID)
            }
        return groups.map { group in
            var lessons: [LearnLesson] = []
            var previousDone = true
            for (index, chunk) in chunk(group.cards).enumerated() {
                let id = lessonID(for: chunk.map(\.key))
                let state: LessonState = completed.contains(id) ? .done : (previousDone ? .open : .locked)
                lessons.append(LearnLesson(id: id, index: index, cards: chunk, state: state))
                previousDone = state == .done
            }
            return LearnUnit(id: unitID(group.materialID), materialID: group.materialID, lessons: lessons)
        }
    }

    /// Up to six cards in a row; a last lesson of one to three cards is added to the one before.
    static func chunk(_ cards: [CardSnapshot]) -> [[CardSnapshot]] {
        var chunks = stride(from: 0, to: cards.count, by: lessonSize).map {
            Array(cards[$0..<min($0 + lessonSize, cards.count)])
        }
        if chunks.count > 1, let last = chunks.last, last.count < smallestLastLesson {
            chunks.removeLast()
            chunks[chunks.count - 1] += last
        }
        return chunks
    }

    /// Derived from the cards, so a lesson whose cards change is a new lesson.
    static func lessonID(for cardKeys: [String]) -> String {
        "L" + StableHash.hex(cardKeys.joined(separator: ","))
    }

    static func unitID(_ materialID: UUID?) -> String {
        materialID?.uuidString ?? otherUnitID
    }

    static func lesson(withID id: String, in units: [LearnUnit]) -> LearnLesson? {
        for unit in units {
            if let lesson = unit.lessons.first(where: { $0.id == id }) { return lesson }
        }
        return nil
    }

    /// The first lesson the student can start, for the path to scroll to.
    static func nextOpenLesson(in units: [LearnUnit]) -> LearnLesson? {
        units.lazy.flatMap(\.lessons).first { $0.state == .open }
    }

    static func dueKeys(_ cards: [CardSnapshot], at now: Date) -> Set<String> {
        Set(cards.filter { $0.isDue(at: now) }.map(\.key))
    }

    private static func cardOrder(_ a: CardSnapshot, _ b: CardSnapshot) -> Bool {
        a.createdAt != b.createdAt ? a.createdAt < b.createdAt : a.key < b.key
    }
}
