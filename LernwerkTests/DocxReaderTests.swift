import Foundation
import XCTest
@testable import Lernwerk

final class DocxReaderTests: XCTestCase {
    /// Faithful to what python-docx and real Word actually write: headings via `outlineLvl` in the style, bold
    /// and italic as direct formatting, a bullet list with `numPr` on the paragraph itself, a numbered list whose
    /// numbering only the "List Number" style carries, a table with column widths in dxa, and an inline picture.
    private let documentXML = """
    <?xml version="1.0"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
    <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Überschrift Eins</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Normaler Text mit </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>fett</w:t></w:r><w:r><w:t xml:space="preserve"> und </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>kursiv</w:t></w:r><w:r><w:t xml:space="preserve">. Ä Ö Ü ä ö ü ß.</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Erstens</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Zweitens</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="ListNumber"/></w:pPr><w:r><w:t>Schritt eins</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="ListNumber"/></w:pPr><w:r><w:t>Schritt zwei</w:t></w:r></w:p>
    <w:p/>
    <w:tbl><w:tblGrid><w:gridCol w:w="4320"/><w:gridCol w:w="4320"/></w:tblGrid>
    <w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>C</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>D</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
    <w:p><w:r><w:t xml:space="preserve">Vor dem Bild. </w:t></w:r><w:r><w:drawing><wp:inline><wp:extent cx="1828800" cy="1219200"/><a:graphic><a:graphicData><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId9"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
    </w:body>
    </w:document>
    """

    private let stylesXML = """
    <?xml version="1.0"?>
    <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:pPr><w:numPr><w:numId w:val="5"/></w:numPr></w:pPr></w:style>
    </w:styles>
    """

    private let numberingXML = """
    <?xml version="1.0"?>
    <w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:abstractNum w:abstractNumId="8"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
    <w:abstractNum w:abstractNumId="7"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
    <w:num w:numId="1"><w:abstractNumId w:val="8"/></w:num>
    <w:num w:numId="5"><w:abstractNumId w:val="7"/></w:num>
    </w:numbering>
    """

    private let relsXML = """
    <?xml version="1.0"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
    </Relationships>
    """

    private func files(withImage: Bool = true) -> [String: Data] {
        var files: [String: Data] = [
            "word/document.xml": Data(documentXML.utf8),
            "word/styles.xml": Data(stylesXML.utf8),
            "word/numbering.xml": Data(numberingXML.utf8),
            "word/_rels/document.xml.rels": Data(relsXML.utf8),
        ]
        if withImage { files["word/media/image1.png"] = Data([0x89, 0x50, 0x4E, 0x47]) }
        return files
    }

    func testHeadingsComeFromTheStylesOutlineLevel() throws {
        let document = try DocxReader.parse(files: files())
        guard case let .heading(level, runs) = document.blocks[0] else { return XCTFail("expected a heading") }
        XCTAssertEqual(level, 1)
        XCTAssertEqual(runs, [DocxRun(text: "Überschrift Eins")])
    }

    func testBoldAndItalicAreKeptPerRunWithGermanCharacters() throws {
        let document = try DocxReader.parse(files: files())
        guard case let .paragraph(runs) = document.blocks[1] else { return XCTFail("expected a paragraph") }
        XCTAssertEqual(runs, [
            DocxRun(text: "Normaler Text mit "),
            DocxRun(text: "fett", bold: true),
            DocxRun(text: " und "),
            DocxRun(text: "kursiv", italic: true),
            DocxRun(text: ". Ä Ö Ü ä ö ü ß."),
        ])
    }

    func testBulletListsComeFromDirectNumPrAndNumberEachItem() throws {
        let document = try DocxReader.parse(files: files())
        guard case let .listItem(level1, ordered1, index1, runs1) = document.blocks[2],
              case let .listItem(_, _, index2, runs2) = document.blocks[3]
        else { return XCTFail("expected two list items") }
        XCTAssertEqual(level1, 0)
        XCTAssertFalse(ordered1)
        XCTAssertEqual(index1, 1)
        XCTAssertEqual(runs1.first?.text, "Erstens")
        XCTAssertEqual(index2, 2)
        XCTAssertEqual(runs2.first?.text, "Zweitens")
    }

    func testNumberedListsFallBackToTheParagraphStylesNumbering() throws {
        let document = try DocxReader.parse(files: files())
        guard case let .listItem(_, ordered1, index1, _) = document.blocks[4],
              case let .listItem(_, ordered2, index2, _) = document.blocks[5]
        else { return XCTFail("expected two numbered items") }
        XCTAssertTrue(ordered1)
        XCTAssertEqual(index1, 1)
        XCTAssertTrue(ordered2)
        XCTAssertEqual(index2, 2)
    }

    func testAnEmptyParagraphStaysAsABlankLine() throws {
        let document = try DocxReader.parse(files: files())
        guard case let .paragraph(runs) = document.blocks[6] else { return XCTFail("expected an empty paragraph") }
        XCTAssertTrue(runs.isEmpty)
    }

    func testTableRowsKeepTheirCellsAndColumnWidthsInPoints() throws {
        let document = try DocxReader.parse(files: files())
        guard case let .table(rows, widths) = document.blocks[7] else { return XCTFail("expected a table") }
        XCTAssertEqual(widths, [216, 216])
        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows[0][0], [[DocxRun(text: "A")]])
        XCTAssertEqual(rows[0][1], [[DocxRun(text: "B")]])
        XCTAssertEqual(rows[1][1], [[DocxRun(text: "D")]])
    }

    func testAnInlinePictureIsResolvedThroughTheRelationshipsAndItsTextKeptSeparately() throws {
        let document = try DocxReader.parse(files: files())
        guard case let .paragraph(runs) = document.blocks[8], case let .image(data, aspect) = document.blocks[9] else {
            return XCTFail("expected a paragraph followed by an image")
        }
        XCTAssertEqual(runs.first?.text, "Vor dem Bild. ")
        XCTAssertEqual(data, Data([0x89, 0x50, 0x4E, 0x47]))
        XCTAssertEqual(aspect, 1828800.0 / 1219200.0, accuracy: 0.001)
    }

    func testAMissingImageFileIsSkippedWithoutFailing() throws {
        let document = try DocxReader.parse(files: files(withImage: false))
        XCTAssertFalse(document.blocks.contains { if case .image = $0 { return true } else { return false } })
    }

    func testOpeningSomethingThatIsNotADocxThrows() {
        XCTAssertThrowsError(try DocxReader.open(Data("not a zip".utf8)))
    }

    func testOpeningARealZipWithoutADocumentPartThrows() {
        // A ZIP the shared ZipArchive reader can open, but with no word/document.xml inside.
        XCTAssertThrowsError(try DocxReader.parse(files: ["readme.txt": Data("hi".utf8)]))
    }
}
