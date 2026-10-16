import Compression
import XCTest
@testable import Lernwerk

final class ZipArchiveLimitsTests: XCTestCase {
    private func le(_ value: UInt32, _ bytes: Int) -> [UInt8] {
        (0..<bytes).map { UInt8((value >> (8 * UInt32($0))) & 0xFF) }
    }

    /// One entry as a ZIP, with the sizes and method the test wants the central directory to claim.
    private func zip(name: String = "a.bin", method: UInt32, claimedSize: UInt32, body: [UInt8]) -> Data {
        let nameBytes = Array(name.utf8)
        var local: [UInt8] = le(0x0403_4B50, 4) + le(20, 2) + le(0, 2) + le(method, 2) + le(0, 2) + le(0, 2) + le(0, 4)
        local += le(UInt32(body.count), 4) + le(claimedSize, 4) + le(UInt32(nameBytes.count), 2) + le(0, 2) + nameBytes + body
        var central: [UInt8] = le(0x0201_4B50, 4) + le(20, 2) + le(20, 2) + le(0, 2) + le(method, 2) + le(0, 2) + le(0, 2) + le(0, 4)
        central += le(UInt32(body.count), 4) + le(claimedSize, 4) + le(UInt32(nameBytes.count), 2) + le(0, 2) + le(0, 2)
        central += le(0, 2) + le(0, 2) + le(0, 4) + le(0, 4) + nameBytes
        let end: [UInt8] = le(0x0605_4B50, 4) + le(0, 2) + le(0, 2) + le(1, 2) + le(1, 2) + le(UInt32(central.count), 4) + le(UInt32(local.count), 4) + le(0, 2)
        return Data(local + central + end)
    }

    func testAnArchiveClaimingFourGigabytesIsRefusedBeforeAnyMemoryIsReserved() {
        let data = zip(method: 8, claimedSize: 0xF000_0000, body: [0x03, 0x00])
        XCTAssertThrowsError(try ZipArchive.files(data)) { error in
            XCTAssertEqual(error as? ZipArchive.ZipError, .tooLarge)
        }
    }

    func testAStoredFileIsStillRead() throws {
        let body = Array("Hallo".utf8)
        let files = try ZipArchive.files(zip(method: 0, claimedSize: UInt32(body.count), body: body))
        XCTAssertEqual(files["a.bin"], Data(body))
    }

    func testAStreamThatGrowsPastItsDeclaredSizeStops() throws {
        let zeros = Data(count: 5_000_000)
        let packed = try (zeros as NSData).compressed(using: .zlib) as Data
        XCTAssertThrowsError(try Inflate.inflate([UInt8](packed), expectedSize: 1000, limit: 1000))
        // The same stream within its real size is fine.
        XCTAssertEqual(try Inflate.inflate([UInt8](packed), expectedSize: zeros.count, limit: zeros.count).count, zeros.count)
    }
}
