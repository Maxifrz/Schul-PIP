import XCTest
@testable import Lernwerk

final class LearnPathTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 1_800_000_000)
    private let materialA = UUID(uuidString: "00000000-0000-0000-0000-00000000000A")!
    private let materialB = UUID(uuidString: "00000000-0000-0000-0000-00000000000B")!

    private func cards(_ count: Int, material: UUID?, from first: Int = 0) -> [CardSnapshot] {
        (first..<first + count).map { index in
            CardSnapshot(
                front: "Frage \(index)", back: "Antwort \(index)", materialID: material,
                createdAt: start.addingTimeInterval(Double(index) * 60), dueDate: start
            )
        }
    }

    func testLessonsHoldUpToSixCardsAndASmallLastLessonJoinsTheOneBefore() {
        let sizes = { (count: Int) in LearnPath.chunk(self.cards(count, material: nil)).map(\.count) }
        XCTAssertEqual(sizes(0), [])
        XCTAssertEqual(sizes(3), [3])
        XCTAssertEqual(sizes(6), [6])
        XCTAssertEqual(sizes(7), [7])
        XCTAssertEqual(sizes(9), [9])
        XCTAssertEqual(sizes(10), [6, 4])
        XCTAssertEqual(sizes(12), [6, 6])
        XCTAssertEqual(sizes(13), [6, 7])
        XCTAssertEqual(sizes(16), [6, 6, 4])
    }

    func testUnitsGroupCardsByMaterialInCreationOrder() {
        let a = cards(3, material: materialA, from: 10)
        let b = cards(2, material: materialB, from: 0)
        let loose = cards(2, material: nil, from: 5)
        let units = LearnPath.units(from: Array((a + loose + b).reversed()), completed: [])
        XCTAssertEqual(units.map(\.id), [materialB.uuidString, LearnPath.otherUnitID, materialA.uuidString])
        XCTAssertEqual(units[2].cards.map(\.front), ["Frage 10", "Frage 11", "Frage 12"])
        XCTAssertNil(units[1].materialID)
    }

    func testALessonOpensOnceTheOneBeforeIsDone() {
        let deck = cards(18, material: materialA) + cards(6, material: materialB, from: 100)
        var units = LearnPath.units(from: deck, completed: [])
        XCTAssertEqual(units[0].lessons.map(\.state), [.open, .locked, .locked])
        XCTAssertEqual(units[1].lessons.map(\.state), [.open])

        let first = units[0].lessons[0].id
        units = LearnPath.units(from: deck, completed: [first])
        XCTAssertEqual(units[0].lessons.map(\.state), [.done, .open, .locked])
        XCTAssertEqual(LearnPath.nextOpenLesson(in: units)?.id, units[0].lessons[1].id)

        units = LearnPath.units(from: deck, completed: [first, units[0].lessons[1].id])
        XCTAssertEqual(units[0].lessons.map(\.state), [.done, .done, .open])
        XCTAssertEqual(LearnPath.lesson(withID: first, in: units)?.state, .done)
    }

    func testLessonIDsComeFromTheCardsSoAChangedLessonIsNew() {
        let deck = cards(5, material: nil)
        let id = LearnPath.units(from: deck, completed: [])[0].lessons[0].id
        XCTAssertEqual(LearnPath.units(from: Array(deck.reversed()), completed: [])[0].lessons[0].id, id)
        XCTAssertEqual(id, LearnPath.lessonID(for: deck.map(\.key)))

        let grown = LearnPath.units(from: deck + cards(1, material: nil, from: 5), completed: [id])[0].lessons[0]
        XCTAssertNotEqual(grown.id, id)
        XCTAssertEqual(grown.state, .open)

        var edited = deck
        let card = edited[0]
        edited[0] = CardSnapshot(front: card.front, back: "Neue Antwort", materialID: nil, createdAt: card.createdAt, dueDate: card.dueDate)
        XCTAssertNotEqual(LearnPath.units(from: edited, completed: [id])[0].lessons[0].id, id)
    }

    func testCardKeysAreStableAndDistinct() {
        let first = CardSnapshot(front: "A", back: "B", materialID: materialA, createdAt: start, dueDate: start)
        let again = CardSnapshot(front: "A", back: "B", materialID: materialA, createdAt: start, dueDate: start.addingTimeInterval(999))
        XCTAssertEqual(first.key, again.key)
        XCTAssertEqual(first.key, CardSnapshot.key(front: "A", back: "B", materialID: materialA, createdAt: start))
        XCTAssertEqual(first.key.count, 17)
        let keys = Set(cards(50, material: materialA).map(\.key))
        XCTAssertEqual(keys.count, 50)
        XCTAssertNotEqual(first.key, CardSnapshot(front: "A", back: "B", materialID: nil, createdAt: start, dueDate: start).key)
        XCTAssertEqual(StableHash.hex(""), "cbf29ce484222325")
    }

    func testTheSameCardTwiceAppearsOnce() {
        let deck = cards(4, material: nil)
        let units = LearnPath.units(from: deck + deck, completed: [])
        XCTAssertEqual(units[0].cards.count, 4)
    }

    func testDueKeys() {
        let due = CardSnapshot(front: "A", back: "B", materialID: nil, createdAt: start, dueDate: start)
        let later = CardSnapshot(front: "C", back: "D", materialID: nil, createdAt: start, dueDate: start.addingTimeInterval(60))
        XCTAssertEqual(LearnPath.dueKeys([due, later], at: start), [due.key])
        XCTAssertTrue(later.isDue(at: start.addingTimeInterval(60)))
    }
}
