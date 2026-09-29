import Foundation

/// The formats a deck can be exported as, next to PPTX and the plain PDF: the PDF with speaker notes, one PNG per
/// slide in a ZIP file and the outline as Markdown. Drawing the pages needs UIKit and lives in `SlideDrawing`; what
/// can be decided without it (names, the outline, ZIP packing, paging notes) lives here so it can be tested.
enum ExportFormat: String, CaseIterable, Identifiable {
    case pptx, pdf, pdfNotes, pngZip, markdown

    var id: String { rawValue }

    var label: String {
        switch self {
        case .pptx: return "PowerPoint (.pptx)"
        case .pdf: return "PDF"
        case .pdfNotes: return "PDF mit Notizen"
        case .pngZip: return "Bilder (PNG in ZIP)"
        case .markdown: return "Gliederung (Markdown)"
        }
    }

    var fileExtension: String {
        switch self {
        case .pptx: return "pptx"
        case .pdf, .pdfNotes: return "pdf"
        case .pngZip: return "zip"
        case .markdown: return "md"
        }
    }

    /// Added to the title so the formats of one deck never overwrite each other.
    var suffix: String {
        switch self {
        case .pptx, .pdf: return ""
        case .pdfNotes: return "-Notizen"
        case .pngZip: return "-Folien"
        case .markdown: return "-Gliederung"
        }
    }
}

enum DeckExport {
    private static let forbidden = CharacterSet(charactersIn: "/\\:?*\"<>|").union(.controlCharacters).union(.newlines)
    private static let reserved: Set<String> = ["con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "lpt1", "lpt2", "lpt3"]
    private static let maxNameLength = 80

    /// A file name for the deck's title: no characters file systems refuse, no dots or spaces at the ends, at most 80
    /// characters, "Präsentation" for an empty title, plus the format's suffix and extension.
    static func fileName(_ title: String, format: ExportFormat) -> String {
        var name = title.components(separatedBy: forbidden).joined(separator: " ")
        name = name.components(separatedBy: .whitespaces).filter { !$0.isEmpty }.joined(separator: " ")
        name = String(name.prefix(maxNameLength)).trimmingCharacters(in: CharacterSet(charactersIn: ". "))
        if name.isEmpty { name = "Präsentation" }
        if reserved.contains(name.lowercased()) { name += "_" }
        return name + format.suffix + "." + format.fileExtension
    }

    // MARK: Outline

    private static func heading(_ slide: Slide) -> SlideElement? {
        slide.elements.first { $0.kind == .text && SlideDesign.isHeading($0) && !$0.text.isBlank }
    }

    /// The deck as a Markdown outline: the title, then a section per slide with its heading, its other texts from top
    /// to bottom (bullet boxes as lists) and the speaker notes as a quote.
    static func markdown(_ presentation: Presentation) -> String {
        var out = ["# \(presentation.title.isBlank ? "Präsentation" : presentation.title.trimmingCharacters(in: .whitespacesAndNewlines))", ""]
        for (index, slide) in presentation.slides.enumerated() {
            let title = heading(slide)
            out.append("## \(index + 1). \(title.map { oneLine($0.text) } ?? "Folie \(index + 1)")")
            out.append("")
            let body = slide.elements.filter { $0.kind == .text && $0.id != title?.id && $0.text.trimmingCharacters(in: .whitespacesAndNewlines).count > 1 }
                .enumerated().sorted { a, b in
                    if abs(a.element.y - b.element.y) > 1 { return a.element.y < b.element.y }
                    return a.element.x != b.element.x ? a.element.x < b.element.x : a.offset < b.offset
                }.map(\.element)
            for element in body {
                let lines = element.text.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                if element.bullets {
                    out += lines.map { "- \($0)" }
                } else {
                    out.append(lines.joined(separator: " "))
                }
                out.append("")
            }
            let notes = slide.notes.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            if !notes.isEmpty {
                out.append("> **Notizen**")
                out += notes.map { "> \($0)" }
                out.append("")
            }
        }
        while out.last == "" { out.removeLast() }
        return out.joined(separator: "\n") + "\n"
    }

    private static func oneLine(_ text: String) -> String {
        text.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
    }

    // MARK: PNG archive

    /// File names of the slide images: folie-01.png, folie-02.png … with enough digits for the deck.
    static func imageNames(count: Int) -> [String] {
        let digits = max(2, String(max(count, 1)).count)
        return (0..<count).map { "folie-" + String(format: "%0\(digits)d", $0 + 1) + ".png" }
    }

    static func pngArchive(_ pages: [Data]) -> Data {
        ZipWriter.archive(Array(zip(imageNames(count: pages.count), pages)).map { ($0.0, $0.1) })
    }

    // MARK: Notes paging

    /// Splits `text` into the fewest consecutive pieces, cut between words, that each satisfy `fits`. A single word
    /// that does not fit alone stays on a page of its own rather than being cut. Nothing is dropped:
    /// joining the pieces with a space gives the words back.
    static func paginate(_ text: String, fits: (String) -> Bool) -> [String] {
        let words = text.components(separatedBy: " ")
        guard words.count > 1, !fits(text) else { return [text] }
        var pages: [String] = []
        var start = 0
        while start < words.count {
            var low = start + 1
            var high = words.count
            while low < high {
                let middle = (low + high + 1) / 2
                if fits(words[start..<middle].joined(separator: " ")) { low = middle } else { high = middle - 1 }
            }
            pages.append(words[start..<low].joined(separator: " "))
            start = low
        }
        return pages
    }
}
