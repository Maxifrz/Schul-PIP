import PDFKit
import UIKit
import Vision

/// On-device OCR with Apple Vision: free, offline, and reads printed text and handwriting.
enum TextRecognizer {
    static let languages = ["de-DE", "en-US"]

    static func text(in image: CGImage) -> String {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = languages

        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return ""
        }
        // Vision's origin is bottom-left, so a larger y means higher up on the page.
        return (request.results ?? [])
            .sorted { $0.boundingBox.midY > $1.boundingBox.midY }
            .compactMap { $0.topCandidates(1).first?.string }
            .joined(separator: "\n")
    }

    static func text(inJPEG data: Data) -> String {
        guard let image = UIImage(data: data)?.cgImage else { return "" }
        return text(in: image)
    }

    static func text(of document: PDFDocument, pageNumber: Int) -> String {
        guard let page = document.page(at: pageNumber - 1),
              let image = page.thumbnail(of: CGSize(width: 2000, height: 2000), for: .mediaBox).cgImage
        else { return "" }
        return text(in: image)
    }

    static func recognize(_ jpeg: Data) async -> String {
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                continuation.resume(returning: text(inJPEG: jpeg))
            }
        }
    }
}
