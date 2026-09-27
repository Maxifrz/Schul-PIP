import XCTest
@testable import Lernwerk

final class FolderImportTests: XCTestCase {
    private var root: URL!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathComponent("GoodNotes Export", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root.deletingLastPathComponent())
    }

    private func touch(_ path: String) throws {
        let url = root.appendingPathComponent(path)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("x".utf8).write(to: url)
    }

    func testScanFindsFilesInSubfoldersWithTheirPath() throws {
        try touch("Mathe/Analysis 10.pdf")
        try touch("Mathe/Analysis 2.pdf")
        try touch("Bio 11.2/Zelle.PDF")
        try touch("Tafelbild.jpg")
        try touch("Bio 11.2/.DS_Store")
        try touch("Mathe/notizen.txt")

        let scan = FolderImport.scan(root)
        let found = scan.files.map { ($0.folders, URL(fileURLWithPath: $0.location).lastPathComponent) }

        XCTAssertEqual(found.map(\.1), ["Zelle.PDF", "Analysis 2.pdf", "Analysis 10.pdf", "Tafelbild.jpg"])
        XCTAssertEqual(found.map(\.0), [
            ["GoodNotes Export", "Bio 11.2"],
            ["GoodNotes Export", "Mathe"],
            ["GoodNotes Export", "Mathe"],
            ["GoodNotes Export"],
        ])
        XCTAssertEqual(scan.skipped, ["notizen.txt"])
    }

    func testScanMapsICloudPlaceholdersToTheRealFile() throws {
        try touch("Physik/.Optik.pdf.icloud")
        let scan = FolderImport.scan(root)
        XCTAssertEqual(scan.files.count, 1)
        XCTAssertEqual(URL(fileURLWithPath: scan.files[0].location).lastPathComponent, "Optik.pdf")
        XCTAssertEqual(scan.files[0].folders, ["GoodNotes Export", "Physik"])
    }

    func testScanSkipsGoodNotesPackages() throws {
        try touch("Chemie.goodnotes/index.pdf")
        try touch("Chemie.pdf")
        let scan = FolderImport.scan(root)
        XCTAssertEqual(scan.files.map { URL(fileURLWithPath: $0.location).lastPathComponent }, ["Chemie.pdf"])
        XCTAssertEqual(scan.skipped, ["Chemie.goodnotes"])
    }

    func testArchiveWithOneFolderImportsThatFolder() {
        let scan = FolderImport.scanArchive(
            ["Deutsch/", "Deutsch/Faust.pdf", "Deutsch/Lyrik/Rilke.pdf", "__MACOSX/Deutsch/._Faust.pdf"],
            archiveName: "Export"
        )
        XCTAssertEqual(scan.files, [
            FolderImportEntry(location: "Deutsch/Faust.pdf", folders: ["Deutsch"]),
            FolderImportEntry(location: "Deutsch/Lyrik/Rilke.pdf", folders: ["Deutsch", "Lyrik"]),
        ])
        XCTAssertEqual(scan.skipped, [])
    }

    func testArchiveWithLooseFilesBecomesAFolderNamedAfterIt() {
        let scan = FolderImport.scanArchive(["a.pdf", "Englisch/b.pdf", "c.goodnotes"], archiveName: "Notizen")
        XCTAssertEqual(scan.files.map(\.folders), [["Notizen"], ["Notizen", "Englisch"]])
        XCTAssertEqual(scan.skipped, ["c.goodnotes"])
    }

    func testFolderPathsListParentsFirstAndOnce() {
        let paths = FolderImport.folderPaths([["A", "B", "C"], ["A"], ["A", "D"], ["A", "B"]])
        XCTAssertEqual(paths, [["A"], ["A", "B"], ["A", "B", "C"], ["A", "D"]])
    }

    func testSummaryExplainsGoodNotesFiles() {
        XCTAssertNil(FolderImport.summary(imported: 3, skipped: [], failed: []))
        let text = FolderImport.summary(imported: 1, skipped: ["Bio.goodnotes"], failed: [])
        XCTAssertTrue(text?.contains("1 Dokument importiert") == true)
        XCTAssertTrue(text?.contains("als PDF") == true)
    }
}
