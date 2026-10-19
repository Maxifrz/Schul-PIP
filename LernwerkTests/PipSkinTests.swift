import XCTest
@testable import Lernwerk

final class PipSkinTests: XCTestCase {
    private func progress(gems: Int) -> LearnProgress {
        var progress = LearnProgress()
        progress.addGems(gems)
        return progress
    }

    func testCatalogHasUniqueIDsAndAFreeDefault() {
        XCTAssertEqual(PipSkin.all.count, 20)
        XCTAssertEqual(Set(PipSkin.all.map(\.id)).count, PipSkin.all.count)
        XCTAssertEqual(PipSkin.standard.id, PipSkin.defaultID)
        XCTAssertEqual(PipSkin.standard.price, 0)
        XCTAssertTrue(PipSkin.all.dropFirst().allSatisfy { $0.price > 0 })
    }

    func testEverySkinPaintsInsideTheSprite() {
        for skin in PipSkin.all {
            let pixels = skin.pixels(grid: PipSimulation.cat, tail: PipSimulation.tails[0], outline: skin.outlineColor(dark: false))
            XCTAssertFalse(pixels.isEmpty, skin.id)
            // Hats reach three rows above the head, nothing goes further.
            for pixel in pixels {
                XCTAssertTrue((0..<PipSimulation.gridWidth).contains(pixel.x), skin.id)
                XCTAssertTrue((-3..<13).contains(pixel.y), skin.id)
            }
        }
    }

    func testDefaultSkinPaintsTheOriginalCat() {
        let skin = PipSkin.standard
        let pixels = skin.pixels(grid: PipSimulation.cat, tail: [], outline: skin.outlineColor(dark: false))
        let bodyCells = PipSimulation.cat.joined().filter { $0 != "." }.count
        XCTAssertEqual(pixels.count, bodyCells)
        XCTAssertEqual(skin.outlineColor(dark: false), 0x23231F)
        XCTAssertEqual(skin.outlineColor(dark: true), 0x0A0A08)
    }

    func testOverlaysOutlineAndTintCorrectly() throws {
        let wizard = try XCTUnwrap(PipSkin.skin("zauberer"))
        let line: UInt32 = 0x111111
        let pixels = wizard.pixels(grid: PipSimulation.cat, tail: [], outline: line)
        XCTAssertTrue(pixels.contains { $0.x == 8 && $0.y == -2 && $0.rgb == 0x6B4FA0 }, "hat tip")
        XCTAssertTrue(pixels.contains { $0.x == 8 && $0.y == -3 && $0.rgb == line }, "outline above the tip")
        let astronaut = try XCTUnwrap(PipSkin.skin("astronaut"))
        let visor = astronaut.pixels(grid: PipSimulation.cat, tail: [], outline: 0).filter { $0.alpha < 1 }
        XCTAssertEqual(visor.count, 11 * 4)
        let rainbow = try XCTUnwrap(PipSkin.skin("regenbogen"))
        let rows = rainbow.pixels(grid: PipSimulation.cat, tail: [], outline: 0).filter { $0.y == 3 && $0.rgb == 0xE5484D }
        XCTAssertFalse(rows.isEmpty)
    }

    func testStartsWithDefaultSkinOnly() {
        let progress = LearnProgress()
        XCTAssertEqual(progress.currentSkin, PipSkin.standard)
        XCTAssertTrue(progress.owns(skin: PipSkin.defaultID))
        XCTAssertFalse(progress.owns(skin: "tiger"))
    }

    func testBuyingNeedsEnoughGemsAndSpendsThem() {
        var state = progress(gems: 39)
        XCTAssertEqual(state.buySkin("tiger"), .notEnoughGems)
        XCTAssertEqual(state.gems, 39)
        state.addGems(1)
        XCTAssertEqual(state.buySkin("tiger"), .bought)
        XCTAssertEqual(state.gems, 0)
        XCTAssertTrue(state.owns(skin: "tiger"))
        XCTAssertEqual(state.selectedSkin, PipSkin.defaultID)
    }

    func testBuyingTwiceOrUnknownCostsNothing() {
        var state = progress(gems: 100)
        XCTAssertEqual(state.buySkin("tiger"), .bought)
        XCTAssertEqual(state.buySkin("tiger"), .alreadyOwned)
        XCTAssertEqual(state.buySkin(PipSkin.defaultID), .alreadyOwned)
        XCTAssertEqual(state.buySkin("gibt-es-nicht"), .unknownSkin)
        XCTAssertEqual(state.gems, 60)
    }

    func testOnlyOwnedSkinsCanBeSelected() {
        var state = progress(gems: 100)
        XCTAssertFalse(state.selectSkin("tiger"))
        XCTAssertFalse(state.selectSkin("gibt-es-nicht"))
        _ = state.buySkin("tiger")
        XCTAssertTrue(state.selectSkin("tiger"))
        XCTAssertEqual(state.currentSkin.id, "tiger")
        XCTAssertTrue(state.selectSkin(PipSkin.defaultID))
        XCTAssertEqual(state.currentSkin, PipSkin.standard)
    }

    func testSkinsSurviveSavingAndOldDataLoads() throws {
        var state = progress(gems: 100)
        _ = state.buySkin("siam")
        _ = state.selectSkin("siam")
        let decoded = try JSONDecoder().decode(LearnProgress.self, from: JSONEncoder().encode(state))
        XCTAssertEqual(decoded, state)

        let old = try JSONDecoder().decode(LearnProgress.self, from: Data(#"{"gems":5}"#.utf8))
        XCTAssertEqual(old.gems, 5)
        XCTAssertEqual(old.selectedSkin, PipSkin.defaultID)
    }

    func testSavedSelectionOfAnUnownedOrRemovedSkinFallsBack() throws {
        let json = #"{"gems":5,"ownedSkins":["weg"],"selectedSkin":"tiger"}"#
        let state = try JSONDecoder().decode(LearnProgress.self, from: Data(json.utf8))
        XCTAssertEqual(state.selectedSkin, PipSkin.defaultID)
        XCTAssertFalse(state.owns(skin: "weg"))
    }

    func testStoreBuysAndSelectsThroughDefaults() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "pipskin.test"))
        defaults.removePersistentDomain(forName: "pipskin.test")
        defer { defaults.removePersistentDomain(forName: "pipskin.test") }
        let store = LearnProgressStore(defaults: defaults)
        store.addGems(50)
        XCTAssertEqual(store.buySkin("tiger"), .bought)
        XCTAssertTrue(store.selectSkin("tiger"))
        let reloaded = LearnProgressStore(defaults: defaults)
        XCTAssertEqual(reloaded.progress.currentSkin.id, "tiger")
        XCTAssertEqual(reloaded.progress.gems, 10)
    }
}
