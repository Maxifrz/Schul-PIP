import XCTest
@testable import Lernwerk

final class PollPacingTests: XCTestCase {
    func testAQuietRoomIsAskedLessAndLessOften() {
        var pacing = PollPacing()
        let waits = (0..<10).map { _ in pacing.next(changed: false) }
        XCTAssertEqual(waits, [3, 3, 3, 6, 6, 6, 6, 12, 12, 12])
    }

    func testTheFirstChangeBringsBackTheShortWait() {
        var pacing = PollPacing()
        for _ in 0..<9 { _ = pacing.next(changed: false) }
        XCTAssertEqual(pacing.next(changed: true), 3)
        XCTAssertEqual(pacing.next(changed: false), 3)
    }
}
