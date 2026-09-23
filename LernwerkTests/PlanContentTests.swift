import PDFKit
import UIKit
import XCTest
@testable import Lernwerk

final class PlanContentTests: XCTestCase {
    private let textPDF = PlanGenerator.Input(title: "Kettenregel", pdf: DemoContent.makePDF())

    /// Page 1 has text, page 2 is only a drawing, like a scanned worksheet.
    private var mixedPDF: PlanGenerator.Input {
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 595, height: 842))
        let data = renderer.pdfData { context in
            context.beginPage()
            NSAttributedString(string: "Integralrechnung: Stammfunktionen und Flächen unter Kurven")
                .draw(at: CGPoint(x: 40, y: 40))
            context.beginPage()
            UIColor.darkGray.setFill()
            UIBezierPath(rect: CGRect(x: 60, y: 60, width: 400, height: 300)).fill()
        }
        return PlanGenerator.Input(title: "Scan", pdf: data)
    }

    private func texts(_ content: [LLMContent]) -> [String] {
        content.compactMap { (item: LLMContent) -> String? in
            if case let .text(text) = item { return text }
            return nil
        }
    }

    private func count(_ content: [LLMContent], where matches: (LLMContent) -> Bool) -> Int {
        content.filter(matches).count
    }

    private func isPDF(_ content: LLMContent) -> Bool {
        if case .pdf = content { return true } else { return false }
    }

    private func isImage(_ content: LLMContent) -> Bool {
        if case .image = content { return true } else { return false }
    }

    func testNativeProvidersGetThePDF() throws {
        let content = try PlanGenerator.content(
            for: [textPDF],
            capabilities: LLMCapabilities(acceptsImages: true, documentHandling: .nativePDF)
        )
        XCTAssertEqual(count(content, where: isPDF), 1)
        XCTAssertEqual(texts(content).last, PlanGenerator.instructions)
    }

    func testTextPDFsAreExtractedLocallyWithPageMarkers() throws {
        for handling in [DocumentHandling.textOnly, .providerOCR] {
            let content = try PlanGenerator.content(
                for: [textPDF],
                capabilities: LLMCapabilities(acceptsImages: false, documentHandling: handling)
            )
            XCTAssertEqual(count(content, where: isPDF), 0)
            let material = texts(content).first ?? ""
            XCTAssertTrue(material.hasPrefix("=== Material 0: Kettenregel ==="))
            XCTAssertTrue(material.contains("--- Page 1 ---"))
            XCTAssertTrue(material.contains("--- Page 2 ---"))
            XCTAssertTrue(material.contains("Kettenregel"))
        }
    }

    func testDetectsScannedPages() throws {
        let document = try XCTUnwrap(PDFDocument(data: mixedPDF.pdf))
        XCTAssertEqual(PDFMaterialReader.scannedPages(in: PDFMaterialReader.pageTexts(of: document)), [2])
    }

    func testScannedPagesGoToOpenRouterOCR() throws {
        let content = try PlanGenerator.content(
            for: [mixedPDF],
            capabilities: LLMCapabilities(acceptsImages: false, documentHandling: .providerOCR)
        )
        XCTAssertEqual(count(content, where: isPDF), 1)
    }

    func testScannedPagesBecomeImagesForVisionModels() throws {
        let content = try PlanGenerator.content(
            for: [mixedPDF],
            capabilities: LLMCapabilities(acceptsImages: true, documentHandling: .textOnly)
        )
        XCTAssertEqual(count(content, where: isImage), 1)
        XCTAssertTrue(texts(content).contains("Material 0, page 2 (scanned):"))
    }

    func testScannedPagesFailClearlyWithoutVision() {
        XCTAssertThrowsError(try PlanGenerator.content(
            for: [mixedPDF],
            capabilities: LLMCapabilities(acceptsImages: false, documentHandling: .textOnly)
        )) { error in
            XCTAssertEqual(error as? LLMError, .scannedPDF(title: "Scan", pages: 1))
        }
    }

    func testImageCompressorMeetsNVIDIALimit() throws {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: CGSize(width: 1600, height: 1600), format: format).image { context in
            var seed: UInt32 = 7
            for x in stride(from: 0, to: 1600, by: 8) {
                for y in stride(from: 0, to: 1600, by: 8) {
                    seed = seed &* 1_664_525 &+ 1_013_904_223
                    UIColor(
                        red: CGFloat(seed & 0xFF) / 255,
                        green: CGFloat((seed >> 8) & 0xFF) / 255,
                        blue: CGFloat((seed >> 16) & 0xFF) / 255,
                        alpha: 1
                    ).setFill()
                    context.fill(CGRect(x: x, y: y, width: 8, height: 8))
                }
            }
        }
        let original = try XCTUnwrap(image.jpegData(compressionQuality: 0.95))
        let limit = try XCTUnwrap(LLMProvider.nvidia.maxImageBytes)
        XCTAssertGreaterThan(original.count, limit)

        let compressed = ImageCompressor.jpeg(original, maxBytes: limit)
        XCTAssertLessThanOrEqual(compressed.count, limit)
        XCTAssertNotNil(UIImage(data: compressed))
    }

    func testEveryProviderDefaultIsInItsModelList() {
        for provider in LLMProvider.allCases {
            for task in [LLMTask.tutor, .plan] {
                let selection = ModelSelection.defaultSelection(for: task, provider: provider)
                XCTAssertNotNil(provider.option(for: selection.model))
            }
        }
        XCTAssertFalse(ModelSelection.defaultSelection(for: .plan, provider: .openRouter).sendsImages)
        XCTAssertTrue(ModelSelection.defaultSelection(for: .tutor, provider: .nvidia).sendsImages)
    }
}
