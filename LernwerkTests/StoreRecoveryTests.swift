import XCTest
@testable import Lernwerk

final class StoreRecoveryTests: XCTestCase {
    func testTheDatabaseAndItsJournalFilesAreRenamedNotDeleted() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = folder.appendingPathComponent("default.store")
        for file in StoreRecovery.files(of: store) { try Data("x".utf8).write(to: file) }

        let moved = StoreRecovery.setAside(store, now: Date(timeIntervalSince1970: 1_800_000_000))

        XCTAssertTrue(moved)
        let names = try FileManager.default.contentsOfDirectory(atPath: folder.path).sorted()
        XCTAssertEqual(names, [
            "default.store.unreadable-1800000000", "default.store-shm.unreadable-1800000000", "default.store-wal.unreadable-1800000000",
        ].sorted())
    }

    func testNothingToPutAsideIsNotAnError() {
        let store = FileManager.default.temporaryDirectory.appendingPathComponent("none-\(UUID().uuidString).store")
        XCTAssertFalse(StoreRecovery.setAside(store))
    }
}
