import XCTest
@testable import Lernwerk

final class LassoGeometryTests: XCTestCase {
    private let square = [CGPoint(x: 0, y: 0), CGPoint(x: 100, y: 0), CGPoint(x: 100, y: 100), CGPoint(x: 0, y: 100)]

    func testPointsInsideAndOutsideALoop() {
        XCTAssertTrue(LassoGeometry.contains(square, CGPoint(x: 50, y: 50)))
        XCTAssertFalse(LassoGeometry.contains(square, CGPoint(x: 150, y: 50)))
        XCTAssertFalse(LassoGeometry.contains(square, CGPoint(x: 50, y: -1)))
        // A loop with fewer than three points takes in nothing.
        XCTAssertFalse(LassoGeometry.contains([CGPoint(x: 0, y: 0), CGPoint(x: 10, y: 10)], CGPoint(x: 5, y: 5)))
    }

    func testARectangleIsSelectedWhenMostOfItIsInside() {
        XCTAssertTrue(LassoGeometry.selects(square, rect: CGRect(x: 10, y: 10, width: 50, height: 50)))
        // Half in, half out: selected; a sliver in: not.
        XCTAssertTrue(LassoGeometry.selects(square, rect: CGRect(x: 50, y: 10, width: 80, height: 40)))
        XCTAssertFalse(LassoGeometry.selects(square, rect: CGRect(x: 90, y: 10, width: 200, height: 40)))
        XCTAssertFalse(LassoGeometry.selects(square, rect: CGRect(x: 200, y: 200, width: 20, height: 20)))
    }

    func testBoundsAndPadding() {
        let box = LassoGeometry.bounds(of: square)
        XCTAssertEqual(box, CGRect(x: 0, y: 0, width: 100, height: 100))
        XCTAssertEqual(LassoGeometry.padded(box, by: 6, within: CGRect(x: 0, y: 0, width: 300, height: 300)), CGRect(x: 0, y: 0, width: 106, height: 106))
        XCTAssertTrue(LassoGeometry.bounds(of: []).isNull)
    }

    func testShareOfPointsInside() {
        let points = [CGPoint(x: 10, y: 10), CGPoint(x: 20, y: 20), CGPoint(x: 200, y: 200), CGPoint(x: 300, y: 300)]
        XCTAssertEqual(LassoGeometry.share(of: points, inside: square), 0.5, accuracy: 0.001)
        XCTAssertEqual(LassoGeometry.share(of: [], inside: square), 0)
    }
}
