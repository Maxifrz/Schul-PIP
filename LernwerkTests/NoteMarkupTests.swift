import XCTest
@testable import Lernwerk

final class NoteMarkupTests: XCTestCase {
    func testMarkersBecomeBlocks() {
        XCTAssertEqual(NoteMarkup.parseLine("# Titel").block, .heading1)
        XCTAssertEqual(NoteMarkup.parseLine("## Teil").block, .heading2)
        XCTAssertEqual(NoteMarkup.parseLine("- Punkt").block, .bullet)
        XCTAssertEqual(NoteMarkup.parseLine("12. Punkt").block, .numbered)
        XCTAssertEqual(NoteMarkup.parseLine("[ ] offen").block, .check(done: false))
        XCTAssertEqual(NoteMarkup.parseLine("[x] fertig").block, .check(done: true))
        XCTAssertEqual(NoteMarkup.parseLine("Text").content, "Text")
        // Without the space after the marker it is just text.
        XCTAssertEqual(NoteMarkup.parseLine("-5").block, .body)
        XCTAssertEqual(NoteMarkup.parseLine("#hashtag").block, .body)
        XCTAssertEqual(NoteMarkup.parseLine("3.14").block, .body)
        XCTAssertEqual(NoteMarkup.parseLine("## Teil").content, "Teil")
    }

    func testNumbersCountWithinEachRun() {
        let lines = NoteMarkup.lines(of: "1. a\n5. b\nText\n9. c")
        XCTAssertEqual(lines.map(\.number), [1, 2, 0, 1])
        XCTAssertEqual(NoteMarkup.renumbered("1. a\n5. b\nText\n9. c"), "1. a\n2. b\nText\n1. c")
        // Nothing to fix: the very same text comes back.
        XCTAssertEqual(NoteMarkup.renumbered("1. a\n2. b"), "1. a\n2. b")
    }

    func testChoosingABlockSetsItAndChoosingItAgainTakesItAway() {
        XCTAssertEqual(NoteMarkup.setBlock(.bullet, on: "Milch"), "- Milch")
        XCTAssertEqual(NoteMarkup.setBlock(.bullet, on: "- Milch"), "Milch")
        XCTAssertEqual(NoteMarkup.setBlock(.heading1, on: "- Milch"), "# Milch")
        XCTAssertEqual(NoteMarkup.setBlock(.numbered, on: "Milch"), "1. Milch")
        // A checklist ticks and unticks.
        XCTAssertEqual(NoteMarkup.setBlock(.check(done: false), on: "[ ] Milch"), "[x] Milch")
        XCTAssertEqual(NoteMarkup.setBlock(.check(done: false), on: "[x] Milch"), "[ ] Milch")
    }

    func testEnterContinuesAListAndEndsItOnAnEmptyItem() {
        XCTAssertEqual(NoteMarkup.continuation(afterLine: "- Milch"), .marker("- "))
        XCTAssertEqual(NoteMarkup.continuation(afterLine: "3. Milch"), .marker("4. "))
        XCTAssertEqual(NoteMarkup.continuation(afterLine: "[x] Milch"), .marker("[ ] "))
        XCTAssertEqual(NoteMarkup.continuation(afterLine: "- "), .endList)
        XCTAssertEqual(NoteMarkup.continuation(afterLine: "4. "), .endList)
        XCTAssertEqual(NoteMarkup.continuation(afterLine: "# Titel"), .none)
        XCTAssertEqual(NoteMarkup.continuation(afterLine: "Text"), .none)
    }

    func testPlainTextDropsTheMarkers() {
        XCTAssertEqual(NoteMarkup.plain("# Titel\n- a\n2. b\ntext"), "Titel\na\nb\ntext")
    }

    func testTableCommandsKeepTheGridRectangularAndInLimits() {
        var cells = NoteTable.blank(rows: 2, columns: 2)
        cells = NoteTable.applying(.addRow, to: cells)
        cells = NoteTable.applying(.addColumn, to: cells)
        XCTAssertEqual(cells.count, 3)
        XCTAssertTrue(cells.allSatisfy { $0.count == 3 })
        for _ in 0..<10 { cells = NoteTable.applying(.removeRow, to: cells) }
        for _ in 0..<10 { cells = NoteTable.applying(.removeColumn, to: cells) }
        XCTAssertEqual(cells.count, 1)
        XCTAssertEqual(cells[0].count, 1)
        for _ in 0..<20 { cells = NoteTable.applying(.addColumn, to: cells) }
        XCTAssertEqual(cells[0].count, NoteTable.maxColumns)
        // A ragged grid is filled up.
        XCTAssertEqual(NoteTable.applying(.addRow, to: [["a"], ["b", "c"]]), [["a", ""], ["b", "c"], ["", ""]])
    }

    func testTablesAndTextsKeepWorkingWithOldFiles() throws {
        // A note file from before tables: no cells, no header.
        let json = """
        {"id":"A","page":0,"kind":"text","x":1,"y":2,"width":3,"height":4,"text":"hi","style":"body","color":0,"align":"left","boxed":false}
        """
        let note = try JSONDecoder().decode(PageAnnotation.self, from: Data(json.utf8))
        XCTAssertEqual(note.kind, .text)
        XCTAssertNil(note.cells)
        XCTAssertTrue(note.hasHeader)
    }
}
