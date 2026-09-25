import Foundation

/// A run of text with its formatting, as it appears inside a paragraph, heading, list item or table cell.
struct DocxRun: Equatable {
    var text: String
    var bold = false
    var italic = false
}

/// One block of a Word document, in reading order, for laying out onto PDF pages. Character formatting besides
/// bold and italic (color, underline, font) is not read; headers, footers and footnotes are left out.
enum DocxBlock: Equatable {
    case heading(level: Int, runs: [DocxRun])
    case paragraph(runs: [DocxRun])
    /// `ordered` numbers list items themselves; `index` is the 1-based number within its level when it does.
    case listItem(level: Int, ordered: Bool, index: Int, runs: [DocxRun])
    /// Rows of cells; a cell is its own paragraphs, each a run list. `columnWidths` are in points, empty if the
    /// document does not give them.
    case table(rows: [[DocxCell]], columnWidths: [Double])
    case image(data: Data, aspect: Double)
}

/// A table cell: its own paragraphs, each a run list.
typealias DocxCell = [[DocxRun]]

struct DocxDocument: Equatable {
    var blocks: [DocxBlock]
}

/// Reads a .docx file's body into free blocks for `DocxRenderer` to draw onto PDF pages. Reuses the ZIP reader and
/// XML tree already written for PowerPoint import. Mirrors the Android app.
enum DocxReader {
    enum DocxError: Error {
        case notADocx
    }

    static func open(_ data: Data) throws -> DocxDocument {
        let files = try ZipArchive.files(data)
        return try parse(files: files)
    }

    /// The pure parse, given the archive's files by path; separated from `open` so it can be tested without a real
    /// ZIP file.
    static func parse(files: [String: Data]) throws -> DocxDocument {
        guard let documentData = files["word/document.xml"], let document = OfficeXML.parse(documentData),
              let body = document.child("body")
        else { throw DocxError.notADocx }

        let styles = parseStyles(files["word/styles.xml"])
        let numbering = NumberingFormats(files["word/numbering.xml"])
        let relationships = OfficeXML.relationships(files, part: "word/document.xml")

        var blocks: [DocxBlock] = []
        var counters = ListCounters()
        for child in body.children {
            switch child.localName {
            case "p":
                blocks += paragraphBlocks(child, styles: styles, numbering: numbering, counters: &counters, files: files, relationships: relationships)
            case "tbl":
                blocks.append(tableBlock(child))
            default:
                break
            }
        }
        return DocxDocument(blocks: blocks)
    }

    // MARK: - Paragraphs

    private static func paragraphBlocks(
        _ p: OfficeXML.Element,
        styles: StyleInfo,
        numbering: NumberingFormats,
        counters: inout ListCounters,
        files: [String: Data],
        relationships: [String: String]
    ) -> [DocxBlock] {
        let images = p.all("drawing").compactMap { drawingImage($0, files: files, relationships: relationships) }
        let runs = textRuns(p)

        if !images.isEmpty {
            var blocks: [DocxBlock] = []
            if !runs.isEmpty { blocks.append(.paragraph(runs: runs)) }
            blocks += images.map { .image(data: $0.data, aspect: $0.aspect) }
            return blocks
        }

        let pPr = p.child("pPr")
        let styleId = pPr?.child("pStyle")?.attr("w:val")

        // A direct override on the paragraph wins over the style; both are 0-based like the file format.
        let rawHeadingLevel = pPr?.child("outlineLvl")?.attr("w:val").flatMap(Int.init) ?? styleId.flatMap { styles.headingLevels[$0] }
        if let rawHeadingLevel {
            return [.heading(level: min(max(rawHeadingLevel + 1, 1), 9), runs: runs)]
        }

        var listNumId: String?
        var listLevel = 0
        if let numPr = pPr?.child("numPr") {
            listNumId = numPr.child("numId")?.attr("w:val")
            listLevel = numPr.child("ilvl")?.attr("w:val").flatMap(Int.init) ?? 0
        } else if let styleId, let info = styles.listNumbering[styleId] {
            listNumId = info.numId
            listLevel = info.level
        }
        if let listNumId, !listNumId.isEmpty {
            let ordered = numbering.isOrdered(numId: listNumId, level: listLevel)
            let index = counters.next(numId: listNumId, level: listLevel)
            return [.listItem(level: listLevel, ordered: ordered, index: index, runs: runs)]
        }

        return [.paragraph(runs: runs)]
    }

    /// The paragraph's text runs, in order; a run that only carries a picture is left out.
    private static func textRuns(_ p: OfficeXML.Element) -> [DocxRun] {
        p.all("r").compactMap { run in
            guard run.all("drawing").isEmpty else { return nil }
            let text = runText(run)
            guard !text.isEmpty else { return nil }
            let rPr = run.child("rPr")
            return DocxRun(text: text, bold: isSet(rPr?.child("b")), italic: isSet(rPr?.child("i")))
        }
    }

    /// A run's visible text: `w:t` verbatim, a tab for `w:tab`, a line break for `w:br`/`w:cr`.
    private static func runText(_ run: OfficeXML.Element) -> String {
        var text = ""
        for child in run.children {
            switch child.localName {
            case "t": text += child.textContent
            case "tab": text += "\t"
            case "br", "cr": text += "\n"
            default: break
            }
        }
        return text
    }

    /// A toggle property like `w:b` or `w:i` is on unless it explicitly says otherwise.
    private static func isSet(_ element: OfficeXML.Element?) -> Bool {
        guard let element else { return false }
        guard let value = element.attr("w:val") else { return true }
        return !["0", "false", "off"].contains(value.lowercased())
    }

    private static func drawingImage(_ drawing: OfficeXML.Element, files: [String: Data], relationships: [String: String]) -> (data: Data, aspect: Double)? {
        guard let blip = drawing.first("blip"), let relId = blip.attrNS("embed"), let path = relationships[relId], let data = files[path] else { return nil }
        let extent = drawing.first("extent")
        let width = extent?.attr("cx").flatMap(Double.init) ?? 0
        let height = extent?.attr("cy").flatMap(Double.init) ?? 0
        return (data, height > 0 ? width / height : 1)
    }

    // MARK: - Tables

    private static func tableBlock(_ tbl: OfficeXML.Element) -> DocxBlock {
        // Widths are in twentieths of a point (dxa).
        let widths = (tbl.first("tblGrid")?.children("gridCol") ?? []).map { ($0.attr("w:w").flatMap(Double.init) ?? 0) / 20 }
        let rows = tbl.children("tr").map { row in
            row.children("tc").map { cell in
                cell.children("p").map(textRuns)
            }
        }
        return .table(rows: rows, columnWidths: widths)
    }

    // MARK: - Styles and numbering

    /// What a paragraph style itself sets: a heading's outline level, or the numbering it puts every paragraph
    /// using it into (both are usually set on the built-in "Heading n" and "List Bullet"/"List Number" styles
    /// rather than repeated on each paragraph).
    private struct StyleInfo {
        var headingLevels: [String: Int] = [:]
        var listNumbering: [String: (numId: String, level: Int)] = [:]
    }

    private static func parseStyles(_ data: Data?) -> StyleInfo {
        var info = StyleInfo()
        guard let data, let root = OfficeXML.parse(data) else { return info }
        for style in root.all("style") {
            guard style.attr("w:type") == "paragraph", let id = style.attr("w:styleId") else { continue }
            let pPr = style.child("pPr")
            if let level = pPr?.child("outlineLvl")?.attr("w:val").flatMap(Int.init) {
                info.headingLevels[id] = level
            }
            if let numPr = pPr?.child("numPr"), let numId = numPr.child("numId")?.attr("w:val"), !numId.isEmpty {
                info.listNumbering[id] = (numId, numPr.child("ilvl")?.attr("w:val").flatMap(Int.init) ?? 0)
            }
        }
        return info
    }

    /// Whether a list numbers its items or only bullets them, from `word/numbering.xml`'s abstract formats.
    private struct NumberingFormats {
        private var byNumId: [String: [Int: Bool]] = [:]

        init(_ data: Data?) {
            guard let data, let root = OfficeXML.parse(data) else { return }
            var byAbstractId: [String: [Int: Bool]] = [:]
            for abstractNum in root.all("abstractNum") {
                guard let id = abstractNum.attr("w:abstractNumId") else { continue }
                var levels: [Int: Bool] = [:]
                for lvl in abstractNum.children("lvl") {
                    guard let level = lvl.attr("w:ilvl").flatMap(Int.init) else { continue }
                    let format = lvl.child("numFmt")?.attr("w:val") ?? "bullet"
                    levels[level] = format != "bullet" && format != "none"
                }
                byAbstractId[id] = levels
            }
            for num in root.all("num") {
                guard let numId = num.attr("w:numId"), let abstractId = num.child("abstractNumId")?.attr("w:val") else { continue }
                byNumId[numId] = byAbstractId[abstractId]
            }
        }

        func isOrdered(numId: String, level: Int) -> Bool {
            byNumId[numId]?[level] ?? byNumId[numId]?[0] ?? false
        }
    }

    /// The running number of each numbered list; a level starting again resets the levels below it, like Word's
    /// own nested lists.
    private struct ListCounters {
        private var counts: [String: [Int: Int]] = [:]

        mutating func next(numId: String, level: Int) -> Int {
            var levels = counts[numId] ?? [:]
            let value = (levels[level] ?? 0) + 1
            levels[level] = value
            for key in levels.keys where key > level { levels[key] = 0 }
            counts[numId] = levels
            return value
        }
    }
}
