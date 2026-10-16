import Foundation

/// What to do when the database cannot be opened: the files are put aside under a new name, never deleted, so a
/// repair or a restore stays possible, and the app starts with an empty database.
enum StoreRecovery {
    /// The database file and the journal files SQLite keeps next to it.
    static func files(of store: URL) -> [URL] {
        ["", "-shm", "-wal"].map { URL(fileURLWithPath: store.path + $0) }
    }

    /// Renames each existing file to "<name>.unreadable-<time>". True if the database file itself was moved.
    @discardableResult
    static func setAside(_ store: URL, now: Date = Date(), manager: FileManager = .default) -> Bool {
        let stamp = Int(now.timeIntervalSince1970)
        var movedStore = false
        for file in files(of: store) where manager.fileExists(atPath: file.path) {
            let target = URL(fileURLWithPath: file.path + ".unreadable-\(stamp)")
            if (try? manager.moveItem(at: file, to: target)) != nil, file == files(of: store)[0] { movedStore = true }
        }
        return movedStore
    }
}
