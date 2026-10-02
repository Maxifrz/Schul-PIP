import SwiftUI
import UIKit
import XCTest
@testable import Lernwerk

final class ThemeTests: XCTestCase {
    func testBundledFontsRegister() {
        QuillFont.register()
        for name in ["WorkSans-Light", "WorkSans-Regular", "WorkSans-Medium", "WorkSans-SemiBold", "WorkSans-Italic", QuillFont.pixelName,
                     "HankenGrotesk-Regular", "HankenGrotesk-Medium", "HankenGrotesk-SemiBold", "HankenGrotesk-Bold", "HankenGrotesk-ExtraBold",
                     "IBMPlexMono-Regular", "IBMPlexMono-Medium", "IBMPlexMono-SemiBold"] {
            XCTAssertNotNil(UIFont(name: name, size: 12), "\(name) is not available")
        }
    }

    func testEveryWeightResolvesToABundledFont() {
        QuillFont.register()
        for weight in [QuillFont.Weight.light, .regular, .medium, .semibold, .bold, .heavy] {
            XCTAssertNotNil(UIFont(name: weight.postScriptName, size: 12), "\(weight.postScriptName) is not available")
            XCTAssertNotNil(UIFont(name: weight.monoName, size: 12), "\(weight.monoName) is not available")
        }
    }

    func testLibraryLayoutFollowsRailAndWidth() {
        let phone = LibraryLayout(railOn: false, width: 390)
        XCTAssertFalse(phone.table)
        XCTAssertFalse(phone.preview)
        let portrait = LibraryLayout(railOn: false, width: 768)
        XCTAssertTrue(portrait.table)
        XCTAssertFalse(portrait.preview)
        let landscape = LibraryLayout(railOn: true, width: 894)
        XCTAssertTrue(landscape.table)
        XCTAssertTrue(landscape.preview)
        XCTAssertFalse(LibraryLayout(railOn: true, width: 700).preview)
    }

    func testColorsAdaptToDarkMode() {
        let light = QuillUIColor.bg.resolvedColor(with: UITraitCollection(userInterfaceStyle: .light))
        let dark = QuillUIColor.bg.resolvedColor(with: UITraitCollection(userInterfaceStyle: .dark))
        XCTAssertNotEqual(light, dark)
        XCTAssertEqual(light, QuillUIColor.hex(0xFAF9F6))
    }

    func testPipWalksAndReactsToAPoke() {
        let pip = PipSimulation()
        let start = Date(timeIntervalSinceReferenceDate: 0)
        pip.advance(to: start, lane: 300, thinking: false)
        for step in 1...12 {
            pip.advance(to: start.addingTimeInterval(Double(step) * 0.25), lane: 300, thinking: false)
        }
        XCTAssertNotEqual(pip.x, 10, "Pip should have walked after its initial pause")

        pip.drag(by: .zero, lane: 300)
        pip.release()
        XCTAssertNotNil(pip.saying)
    }

    func testPipStandsStillWhileThinking() {
        let pip = PipSimulation()
        let start = Date(timeIntervalSinceReferenceDate: 0)
        pip.advance(to: start, lane: 300, thinking: true)
        for step in 1...20 {
            pip.advance(to: start.addingTimeInterval(Double(step) * 0.25), lane: 300, thinking: true)
        }
        XCTAssertEqual(pip.x, 10)
    }

    func testDroppedPipFallsBackOntoTheBar() {
        let pip = PipSimulation()
        let start = Date(timeIntervalSinceReferenceDate: 0)
        pip.advance(to: start, lane: 300, thinking: true)
        pip.drag(by: CGSize(width: 0, height: -120), lane: 300)
        pip.release()
        XCTAssertEqual(pip.saying, "wheee")
        for step in 1...8 {
            pip.advance(to: start.addingTimeInterval(Double(step) * 0.25), lane: 300, thinking: true)
        }
        XCTAssertEqual(pip.y, 0)
    }
}
