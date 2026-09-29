import XCTest
@testable import Lernwerk

/// Writes protocol buffers the way GoodNotes does, to build notebooks for the tests.
private final class Pb {
    var out: [UInt8] = []

    private func varint(_ value: UInt64) {
        var v = value
        while v >= 0x80 {
            out.append(UInt8(v & 0x7f) | 0x80)
            v >>= 7
        }
        out.append(UInt8(v))
    }

    @discardableResult func int(_ field: Int, _ value: UInt64) -> Pb {
        varint(UInt64(field << 3))
        varint(value)
        return self
    }

    @discardableResult func bytes(_ field: Int, _ value: [UInt8]) -> Pb {
        varint(UInt64(field << 3 | 2))
        varint(UInt64(value.count))
        out += value
        return self
    }

    @discardableResult func string(_ field: Int, _ value: String) -> Pb { bytes(field, Array(value.utf8)) }

    @discardableResult func message(_ field: Int, _ build: (Pb) -> Void) -> Pb {
        let inner = Pb()
        build(inner)
        return bytes(field, inner.out)
    }

    @discardableResult func float(_ field: Int, _ value: Float) -> Pb {
        varint(UInt64(field << 3 | 5))
        out += le32(value.bitPattern)
        return self
    }
}

private func le32(_ v: UInt32) -> [UInt8] { (0 ..< 4).map { UInt8((v >> (8 * $0)) & 0xff) } }

private func delimited(_ records: [[UInt8]]) -> Data {
    var out: [UInt8] = []
    for r in records {
        var n = r.count
        while n >= 0x80 {
            out.append(UInt8(n & 0x7f) | 0x80)
            n >>= 7
        }
        out.append(UInt8(n))
        out += r
    }
    return Data(out)
}

/// A stroke's typed record, stored in an uncompressed Apple LZ4 frame: start point and quadratic segments.
private func strokeBlob(width: Float, start: (Float, Float), segments: [[Float]]) -> [UInt8] {
    var body: [UInt8] = []
    func u16(_ v: Int) { body += [UInt8(v & 0xff), UInt8((v >> 8) & 0xff)] }
    func u32(_ v: Int) { body += le32(UInt32(v)) }
    func f(_ v: Float) { body += le32(v.bitPattern) }
    u16(2)
    f(width)
    u32(segments.count + 1)
    for k in 0 ... segments.count { u16(k == 0 ? 0 : 1) }
    u32(1)
    f(start.0)
    f(start.1)
    u32(segments.count)
    for s in segments { s.forEach(f) }
    u16(1)
    u32(0)
    let types = Array("vuA(v)A(S(uu))A(S(uuuu))vA(f)".utf8)
    var record = Array("tpl".utf8) + [0]
    record += le32(UInt32(8 + types.count + 1 + body.count))
    record += types + [0] + body
    return Array("bv4-".utf8) + le32(UInt32(record.count)) + record + Array("bv4$".utf8)
}

private let page = "D0A2D550-1027-44BB-BF78-41B44663AFF9"
private let firstEntry = "F4A25C80-C62E-4EBC-B4F3-CA9F0A38B6FF"
private let secondEntry = "93630DBB-187C-4365-B162-8A932C658A3B"
private let goneEntry = "507B777A-E97F-42A8-93EB-7EE6153C3FE2"

/// A notebook of two pages on the same book page; a third page was deleted; the first has ink.
private func notebook() -> [String: Data] {
    func entry(_ id: String, _ position: String) -> [UInt8] {
        Pb().string(1, id).message(54) { m in
            m.string(2, id).message(3) { $0.string(1, page) }.message(4) { $0.string(1, position) }
        }.out
    }
    let events = delimited([
        Pb().string(1, page).message(2) { m in
            m.string(2, page).string(4, "BOOK").int(5, 1).message(8) { $0.float(1, 1091.64).float(2, 1543.08) }
        }.out,
        Pb().string(1, "BOOK").message(6) { $0.string(1, "BOOK").string(2, "BOOK-FILE") }.out,
        entry(firstEntry, "b"),
        entry(secondEntry, "a"),
        entry(goneEntry, "c"),
        Pb().string(1, goneEntry).message(56) { m in m.string(2, goneEntry).message(3) { $0.int(1, 1) } }.out,
    ])
    let ink = delimited([
        // A red stroke, moved by (11, 0)
        Pb().message(7) { m in
            m.string(1, "S1")
                .bytes(2, strokeBlob(width: 0.55, start: (110, 220), segments: [[165, 220, 220, 330]]))
                .message(4) { $0.float(1, 0.82).float(4, 1) }
                .message(6) { $0.float(1, 11) }
        }.out,
        // An erased stroke
        Pb().message(7) { m in m.string(1, "S2").bytes(2, strokeBlob(width: 0.55, start: (0, 0), segments: [])).int(14, 1) }.out,
        // A straight line
        Pb().message(7) { m in
            m.string(1, "S3").message(9) { shape in
                shape.message(1) { line in
                    line.message(1) { $0.float(1, 0).float(2, 110) }.message(1) { $0.float(1, 550).float(2, 110) }
                }.float(15, 0.52)
            }
        }.out,
    ])
    return [
        "index.events.pb": events,
        "attachments/BOOK-FILE": Data("%PDF-1.4\n".utf8),
        "notes/" + GoodNotes.nextUUID(firstEntry)!: ink,
    ]
}

final class GoodNotesTests: XCTestCase {
    func testReadsPagesInOrderWithoutDeletedOnes() throws {
        let book = try GoodNotes.read(files: notebook())
        XCTAssertEqual(book.pages.count, 2)
        // "a" before "b": the second entry comes first and has no ink
        XCTAssertTrue(book.pages[0].strokes.isEmpty)
        let page = book.pages[1]
        XCTAssertEqual(page.width, 595.44, accuracy: 0.01)
        guard case let .pdf(_, index)? = page.background else { return XCTFail("no PDF background") }
        XCTAssertEqual(index, 0)
        XCTAssertEqual(page.strokes.count, 2)
        let stroke = page.strokes[0]
        XCTAssertEqual(stroke.red, 0.82, accuracy: 1e-4)
        XCTAssertEqual(stroke.width, 0.3, accuracy: 1e-3)
        // (110 + 11) / (11/6) = 66
        XCTAssertEqual(stroke.start[0], 66, accuracy: 1e-3)
        XCTAssertEqual(stroke.start[1], 120, accuracy: 1e-3)
        for (a, b) in zip(stroke.segments, [96, 120, 126, 180] as [Float]) { XCTAssertEqual(a, b, accuracy: 1e-3) }
        let line = try XCTUnwrap(page.strokes[1].polyline)
        for (a, b) in zip(line, [0, 60, 300, 60] as [Float]) { XCTAssertEqual(a, b, accuracy: 1e-3) }
    }

    func testRejectsOtherArchives() {
        XCTAssertThrowsError(try GoodNotes.read(files: ["word/document.xml": Data()]))
    }

    func testUUIDsCountUpAcrossDigits() {
        XCTAssertEqual(GoodNotes.nextUUID("224F16A8-7FC5-4FDE-9D50-CEA29C0A36CF"), "224F16A8-7FC5-4FDE-9D50-CEA29C0A36D0")
        XCTAssertEqual(GoodNotes.nextUUID("00000000-0000-0000-FFFF-FFFFFFFFFFFF"), "00000000-0000-0001-0000-000000000000")
    }

    func testDecodesLZ4Blocks() throws {
        // "abc", then 6 bytes copied from 3 back: abcabcabc
        let block: [UInt8] = [0x32, 0x61, 0x62, 0x63, 3, 0]
        let frame = Array("bv41".utf8) + le32(9) + le32(UInt32(block.count)) + block + Array("bv4$".utf8)
        XCTAssertEqual(String(decoding: try AppleLZ4.decode(Data(frame)), as: UTF8.self), "abcabcabc")
    }

    /// A real notebook, when there is one on this machine (GOODNOTES_SAMPLE=path).
    func testReadsARealNotebook() throws {
        guard let path = ProcessInfo.processInfo.environment["GOODNOTES_SAMPLE"] else { return }
        let book = try GoodNotes.read(url: URL(fileURLWithPath: path))
        XCTAssertGreaterThan(book.pages.count, 1)
        XCTAssertGreaterThan(book.pages.reduce(0) { $0 + $1.strokes.count }, 100)
    }
}
