import XCTest
@testable import Lernwerk

final class PipSkinTests: XCTestCase {
    private func progress(gems: Int) -> LearnProgress {
        var progress = LearnProgress()
        progress.addGems(gems)
        return progress
    }

    func testCatalogHasUniqueIDsAndAFreeDefault() {
        XCTAssertEqual(Set(PipSkin.all.map(\.id)).count, PipSkin.all.count)
        XCTAssertEqual(PipSkin.standard.id, PipSkin.defaultID)
        XCTAssertEqual(PipSkin.standard.price, 0)
        XCTAssertTrue(PipSkin.all.dropFirst().allSatisfy { $0.price > 0 })
    }

    func testStartsWithDefaultSkinOnly() {
        let progress = LearnProgress()
        XCTAssertEqual(progress.currentSkin, PipSkin.standard)
        XCTAssertTrue(progress.owns(skin: PipSkin.defaultID))
        XCTAssertFalse(progress.owns(skin: "zimt"))
    }

    func testBuyingNeedsEnoughGemsAndSpendsThem() {
        var state = progress(gems: 39)
        XCTAssertEqual(state.buySkin("zimt"), .notEnoughGems)
        XCTAssertEqual(state.gems, 39)
        state.addGems(1)
        XCTAssertEqual(state.buySkin("zimt"), .bought)
        XCTAssertEqual(state.gems, 0)
        XCTAssertTrue(state.owns(skin: "zimt"))
        XCTAssertEqual(state.selectedSkin, PipSkin.defaultID)
    }

    func testBuyingTwiceOrUnknownCostsNothing() {
        var state = progress(gems: 100)
        XCTAssertEqual(state.buySkin("zimt"), .bought)
        XCTAssertEqual(state.buySkin("zimt"), .alreadyOwned)
        XCTAssertEqual(state.buySkin(PipSkin.defaultID), .alreadyOwned)
        XCTAssertEqual(state.buySkin("gibt-es-nicht"), .unknownSkin)
        XCTAssertEqual(state.gems, 60)
    }

    func testOnlyOwnedSkinsCanBeSelected() {
        var state = progress(gems: 100)
        XCTAssertFalse(state.selectSkin("zimt"))
        XCTAssertFalse(state.selectSkin("gibt-es-nicht"))
        _ = state.buySkin("zimt")
        XCTAssertTrue(state.selectSkin("zimt"))
        XCTAssertEqual(state.currentSkin.id, "zimt")
        XCTAssertTrue(state.selectSkin(PipSkin.defaultID))
        XCTAssertEqual(state.currentSkin, PipSkin.standard)
    }

    func testSkinsSurviveSavingAndOldDataLoads() throws {
        var state = progress(gems: 100)
        _ = state.buySkin("nebel")
        _ = state.selectSkin("nebel")
        let decoded = try JSONDecoder().decode(LearnProgress.self, from: JSONEncoder().encode(state))
        XCTAssertEqual(decoded, state)

        let old = try JSONDecoder().decode(LearnProgress.self, from: Data(#"{"gems":5}"#.utf8))
        XCTAssertEqual(old.gems, 5)
        XCTAssertEqual(old.selectedSkin, PipSkin.defaultID)
    }

    func testSavedSelectionOfAnUnownedOrRemovedSkinFallsBack() throws {
        let json = #"{"gems":5,"ownedSkins":["weg"],"selectedSkin":"zimt"}"#
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
        XCTAssertEqual(store.buySkin("zimt"), .bought)
        XCTAssertTrue(store.selectSkin("zimt"))
        let reloaded = LearnProgressStore(defaults: defaults)
        XCTAssertEqual(reloaded.progress.currentSkin.id, "zimt")
        XCTAssertEqual(reloaded.progress.gems, 10)
    }
}
