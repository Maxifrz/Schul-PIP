import PDFKit
import UIKit

/// Extracts page text locally so providers without PDF support still get page-accurate material.
enum PDFMaterialReader {
    /// Pages with less text than this are treated as scanned images.
    static let minimumTextLength = 20

    static func pageTexts(of document: PDFDocument) -> [String] {
        (0..<document.pageCount).map { index in
            (document.page(at: index)?.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        }
    }

    /// 1-based numbers of pages without a usable text layer.
    static func scannedPages(in texts: [String]) -> [Int] {
        texts.enumerated()
            .filter { $0.element.count < minimumTextLength }
            .map { $0.offset + 1 }
    }

    static func labeledText(materialIndex: Int, title: String, pages: [String], recognizedPages: Set<Int> = []) -> String {
        var lines = ["=== Material \(materialIndex): \(title) ==="]
        for (offset, text) in pages.enumerated() {
            let pageNumber = offset + 1
            lines.append(recognizedPages.contains(pageNumber)
                ? "--- Page \(pageNumber) (recognized from scan, may contain OCR errors) ---"
                : "--- Page \(pageNumber) ---")
            lines.append(text.count < minimumTextLength ? "(scanned page without text layer)" : text)
        }
        return lines.joined(separator: "\n")
    }

    static func pageImage(of document: PDFDocument, pageNumber: Int, maxDimension: CGFloat = 1400) -> Data? {
        guard let page = document.page(at: pageNumber - 1) else { return nil }
        let image = page.thumbnail(of: CGSize(width: maxDimension, height: maxDimension), for: .mediaBox)
        return image.jpegData(compressionQuality: 0.6)
    }
}
