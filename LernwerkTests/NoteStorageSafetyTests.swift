import PDFKit
import PencilKit
import XCTest
@testable import Lernwerk

final class NoteStorageSafetyTests: XCTestCase {
    private func unreadableFiles(next url: URL) -> [String] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: url.deletingLastPathComponent().path)) ?? []
        return names.filter { $0.hasPrefix(url.lastPathComponent + ".unreadable-") }
    }

    func testNotesThatCannotBeReadAreKeptAndNotOverwritten() throws {
        let name = "safety-\(UUID().uuidString).pdf"
        let url = MaterialStore.notesURL(for: name)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("not json".utf8).write(to: url)
        defer {
            try? FileManager.default.removeItem(at: url)
            for file in unreadableFiles(next: url) { try? FileManager.default.removeItem(at: url.deletingLastPathComponent().appendingPathComponent(file)) }
        }
        XCTAssertEqual(MaterialStore.loadNotes(for: name), DocumentNotes())
        XCTAssertEqual(unreadableFiles(next: url).count, 1, "the unreadable file is set aside")
        XCTAssertTrue(MaterialStore.saveNotes(DocumentNotes(), for: name))
    }

    func testInkOfAPageThatCannotBeReadSurvivesASave() throws {
        let name = "safety-\(UUID().uuidString).pdf"
        let url = MaterialStore.drawingsURL(for: name)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: url) }
        var stroke = PKDrawing()
        let ink = PKInk(.pen, color: .black)
        let path = PKStrokePath(controlPoints: [
            PKStrokePoint(location: .zero, timeOffset: 0, size: CGSize(width: 2, height: 2), opacity: 1, force: 1, azimuth: 0, altitude: 0),
            PKStrokePoint(location: CGPoint(x: 20, y: 20), timeOffset: 0.1, size: CGSize(width: 2, height: 2), opacity: 1, force: 1, azimuth: 0, altitude: 0),
        ], creationDate: Date())
        stroke.strokes.append(PKStroke(ink: ink, path: path))
        let raw: [String: Data] = ["0": stroke.dataRepresentation(), "1": Data("from a newer version".utf8)]
        try PropertyListEncoder().encode(raw).write(to: url)

        let loaded = MaterialStore.loadDrawings(for: name)
        XCTAssertEqual(Set(loaded.keys), [0])
        XCTAssertTrue(MaterialStore.saveDrawings(loaded, for: name))

        let saved = try PropertyListDecoder().decode([String: Data].self, from: Data(contentsOf: url))
        XCTAssertEqual(Set(saved.keys), ["0", "1"], "the unreadable page is written back with the others")
        XCTAssertEqual(saved["1"], Data("from a newer version".utf8))
    }

    func testASaveThatCannotBeWrittenSaysSo() {
        // A file name with a folder that does not exist: the write fails.
        XCTAssertFalse(MaterialStore.saveNotes(DocumentNotes(), for: "no-such-folder-\(UUID().uuidString)/x.pdf"))
    }

    private func oneStroke() -> PKDrawing {
        var drawing = PKDrawing()
        let point = { (x: CGFloat) in PKStrokePoint(location: CGPoint(x: x, y: x), timeOffset: 0, size: CGSize(width: 2, height: 2), opacity: 1, force: 1, azimuth: 0, altitude: 0) }
        let path = PKStrokePath(controlPoints: [point(0), point(20)], creationDate: Date())
        drawing.strokes.append(PKStroke(ink: PKInk(.pen, color: .black), path: path))
        return drawing
    }

    private func picture() -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: 100, height: 100)).image { $0.fill(CGRect(x: 0, y: 0, width: 100, height: 100)) }
    }

    func testInsertingAPageMovesTheInkAndLeavesNoTemporaryFiles() throws {
        let material = try MaterialStore.save(pdfData: MaterialStore.pdf(fromScan: [picture(), picture()]), title: "Commit-Test")
        defer { MaterialStore.delete(fileName: material.fileName) }
        XCTAssertTrue(MaterialStore.saveDrawings([1: oneStroke()], for: material.fileName))

        XCTAssertTrue(MaterialStore.insertPage(in: material, after: 0, paper: .blank))

        XCTAssertEqual(PDFDocument(url: material.fileURL)?.pageCount, 3)
        XCTAssertEqual(Set(MaterialStore.loadDrawings(for: material.fileName).keys), [2], "the ink of page 2 moved to page 3")
        let folder = material.fileURL.deletingLastPathComponent()
        let leftovers = ((try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []).filter { $0.hasSuffix(".new") }
        XCTAssertTrue(leftovers.isEmpty, "\(leftovers)")
    }

    func testOnlyChangedPagesAreEncodedAgain() throws {
        let name = "cache-\(UUID().uuidString).pdf"
        let url = MaterialStore.drawingsURL(for: name)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: url) }
        let one = oneStroke()
        var two = one
        two.strokes.append(contentsOf: one.strokes)
        XCTAssertTrue(MaterialStore.saveDrawings([0: one, 1: one], for: name))
        // Page 1 now holds two strokes but is not named as changed: its stored data is reused. Page 0 is re-encoded.
        XCTAssertTrue(MaterialStore.saveDrawings([0: two, 1: two], for: name, changed: [0]))
        let saved = try PropertyListDecoder().decode([String: Data].self, from: Data(contentsOf: url))
        XCTAssertEqual(try PKDrawing(data: XCTUnwrap(saved["0"])).strokes.count, 2)
        XCTAssertEqual(try PKDrawing(data: XCTUnwrap(saved["1"])).strokes.count, 1)
    }
}
