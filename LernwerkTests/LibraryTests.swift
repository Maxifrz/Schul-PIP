import XCTest
@testable import Lernwerk

private struct Item: LibraryItem {
    var itemID: String
    var title: String
    var subject = ""
    var createdAt: Date
    var lastOpenedAt: Date?
    var folderKey: String?
    var deletedAt: Date?
}

private struct Folder: LibraryFolder {
    var folderID: String
    var name: String
    var parentKey: String?
}

final class LibraryTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 0)
    private lazy var bio = Item(itemID: "bio", title: "Zellbiologie", subject: "Biologie", createdAt: start.addingTimeInterval(3), lastOpenedAt: start.addingTimeInterval(10))
    private lazy var math = Item(itemID: "math", title: "Ableitungen", subject: "Mathe", createdAt: start.addingTimeInterval(2), folderKey: "f")
    private lazy var history = Item(itemID: "hist", title: "Ägypten", createdAt: start.addingTimeInterval(1), lastOpenedAt: start.addingTimeInterval(20))

    func testSortsByEveryCriterion() {
        let all = [bio, math, history]
        XCTAssertEqual(Library.sort(all, by: .recent).map(\.itemID), ["hist", "bio", "math"])
        // German collation: Ä sorts with A.
        XCTAssertEqual(Library.sort(all, by: .name).map(\.itemID), ["math", "hist", "bio"])
        XCTAssertEqual(Library.sort(all, by: .added).map(\.itemID), ["bio", "math", "hist"])
        // Documents without a subject come last.
        XCTAssertEqual(Library.sort(all, by: .subject).map(\.itemID), ["bio", "math", "hist"])
    }

    func testSearchFindsTitlesFirstThenText() {
        let folders = [Folder(folderID: "f", name: "Klausur Q2")]
        let texts = [
            "bio": ["Einleitung", "Die Mitochondrien sind die Kraftwerke der Zelle und bilden ATP aus Glucose."],
            "math": ["Die Kettenregel: äußere mal innere Ableitung."],
        ]
        let all = [bio, math, history]
        let hits = Library.search(all, folders: folders, query: "kraftwerke zelle") { texts[$0.itemID] }
        XCTAssertEqual(hits.map(\.item.itemID), ["bio"])
        XCTAssertEqual(hits.first?.page, 2)
        XCTAssertTrue(hits.first?.snippet?.contains("Kraftwerke der Zelle") ?? false)
        // Without accents and in any case; ß matches ss; folder names count as title matches.
        XCTAssertEqual(Library.search(all, folders: folders, query: "agypten") { texts[$0.itemID] }.map(\.item.itemID), ["hist"])
        let sharp = Library.search(all, folders: folders, query: "AUSSERE ableitung") { texts[$0.itemID] }
        XCTAssertEqual(sharp.first?.snippet, "Die Kettenregel: äußere mal innere Ableitung.")
        XCTAssertEqual(Library.search(all, folders: folders, query: "klausur") { texts[$0.itemID] }.map(\.item.itemID), ["math"])
        XCTAssertTrue(Library.search(all, folders: folders, query: "  ") { texts[$0.itemID] }.isEmpty)
    }

    func testSnippetsAreCutAtWords() {
        let text = "Anfang " + String(repeating: "wort ", count: 30) + "Treffer hier " + String(repeating: "ende ", count: 30)
        let snippet = Library.snippet(text, word: "treffer")
        XCTAssertTrue(snippet.hasPrefix("…") && snippet.hasSuffix("…"))
        XCTAssertTrue(snippet.contains("Treffer hier"))
        XCTAssertLessThan(snippet.count, 110)
    }

    func testFolderTreeHelpers() {
        let folders = [
            Folder(folderID: "a", name: "Bio"),
            Folder(folderID: "b", name: "Genetik", parentKey: "a"),
            Folder(folderID: "c", name: "Klausur", parentKey: "b"),
            Folder(folderID: "d", name: "Mathe"),
        ]
        XCTAssertEqual(Library.descendants(folders, of: "a"), ["a", "b", "c"])
        XCTAssertEqual(Library.path(folders, to: "c").map(\.name), ["Bio", "Genetik", "Klausur"])
        XCTAssertTrue(Library.path(folders, to: nil).isEmpty)
        // A folder cannot move into itself or anything inside it.
        XCTAssertEqual(Library.moveTargets(folders, moving: "a").map(\.folderID), ["d"])
    }

    func testTrashExpiresAfterThirtyDays() {
        let now = start.addingTimeInterval(100 * 86400)
        let fresh = Item(itemID: "x", title: "", createdAt: start, deletedAt: now.addingTimeInterval(-2 * 86400))
        let old = Item(itemID: "y", title: "", createdAt: start, deletedAt: now.addingTimeInterval(-31 * 86400))
        XCTAssertFalse(Library.isExpired(fresh, now: now))
        XCTAssertTrue(Library.isExpired(old, now: now))
        XCTAssertFalse(Library.isExpired(bio, now: now))
        XCTAssertEqual(Library.daysLeft(fresh, now: now), 28)
    }
}
