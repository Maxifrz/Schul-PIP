import PDFKit
import UIKit
import XCTest
@testable import Lernwerk

final class ScanTests: XCTestCase {
    private func picture(_ width: CGFloat, _ height: CGFloat) -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: width, height: height)).image { context in
            UIColor.systemRed.setFill()
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        }
    }

    func testAScanBecomesOnePageOfA4WidthPerPicture() throws {
        let data = MaterialStore.pdf(fromScan: [picture(300, 400), picture(400, 300)])
        let document = try XCTUnwrap(PDFDocument(data: data))
        XCTAssertEqual(document.pageCount, 2)
        let first = try XCTUnwrap(document.page(at: 0)).bounds(for: .mediaBox)
        let second = try XCTUnwrap(document.page(at: 1)).bounds(for: .mediaBox)
        XCTAssertEqual(first.width, 595, accuracy: 1)
        XCTAssertEqual(first.height, 793, accuracy: 2)
        XCTAssertEqual(second.height, 446, accuracy: 2)
    }

    func testScannedPagesGoIntoADocumentAfterTheChosenPage() throws {
        let base = MaterialStore.pdf(fromScan: [picture(300, 400), picture(300, 400), picture(300, 400)])
        let material = try MaterialStore.save(pdfData: base, title: "Scan-Test")
        defer { MaterialStore.delete(fileName: material.fileName) }

        XCTAssertTrue(MaterialStore.insertImagePages([picture(200, 200), picture(200, 300)], in: material, after: 0))

        let document = try XCTUnwrap(PDFDocument(url: material.fileURL))
        XCTAssertEqual(document.pageCount, 5)
        XCTAssertFalse(MaterialStore.insertImagePages([], in: material, after: 0))
    }
}
