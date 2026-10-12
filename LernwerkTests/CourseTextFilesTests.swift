import XCTest
@testable import Lernwerk

/// The language courses live once, as the Swift strings; content/courses/<id>.txt are the copies the desktop and Android
/// apps read (scripts/export-courses.mjs writes them). This fails when a copy is not the string plus one newline.
final class CourseTextFilesTests: XCTestCase {
    private let folder = URL(fileURLWithPath: #filePath).resolvingSymlinksInPath()
        .deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("content/courses")

    private func check(_ id: String, _ source: String) throws {
        let file = folder.appendingPathComponent("\(id).txt")
        let text = try String(contentsOf: file, encoding: .utf8)
        XCTAssertEqual(text, source + "\n", "content/courses/\(id).txt differs from the Swift string; run node scripts/export-courses.mjs")
    }

    func testSpanish() throws { try check("es", SpanishCourse.source) }
    func testFrench() throws { try check("fr", FrenchCourse.source) }
    func testLatin() throws { try check("la", LatinCourse.source) }
    func testGermanForeign() throws { try check("daf", GermanForeignCourse.source) }
    func testGermanSchool() throws { try check("de", GermanSchoolCourse.source) }
}
