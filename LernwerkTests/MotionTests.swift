import XCTest
@testable import Lernwerk

final class MotionTests: XCTestCase {
    // MARK: Fixtures

    private func cards() -> Slide {
        Slide(elements: SlideLayouts.build(SlideDraft(layout: .cards, title: "Drei Wege", items: [
            DraftItem(title: "Eins", text: "Erster Weg"), DraftItem(title: "Zwei", text: "Zweiter Weg"), DraftItem(title: "Drei", text: "Dritter Weg"),
        ]), image: nil), notes: "n")
    }

    private func allSlides() -> [Slide] {
        SlideLayout.allCases.map { SlideLayouts.preset($0) } + [cards()]
    }

    private func parts(_ data: Data) throws -> [String: Data] { try ZipArchive.files(data) }

    private func slideXML(_ deck: Presentation, _ number: Int = 1, includeMotion: Bool = true) throws -> OfficeXML.Element {
        let data = PptxWriter.write(deck, includeMotion: includeMotion) { _ in nil }
        let file = try XCTUnwrap(try parts(data)["ppt/slides/slide\(number).xml"])
        return try XCTUnwrap(OfficeXML.parse(file))
    }

    // MARK: Planner

    func testTimelineGroupsClicksAndFollowers() {
        var slide = cards()
        slide.elements[0].animation = ElementAnimation(kind: .fade, trigger: .click)
        slide.elements[1].animation = ElementAnimation(kind: .fly, trigger: .withPrevious)
        slide.elements[2].animation = ElementAnimation(kind: .fade, trigger: .click)
        let steps = MotionPlanner.timeline(slide)
        XCTAssertEqual(steps.count, 2)
        XCTAssertEqual(steps[0].entries.count, 2)
        XCTAssertFalse(steps[0].autoStart)
        XCTAssertEqual(MotionPlanner.clicks(slide), 2)
        XCTAssertEqual(MotionPlanner.initialSteps(slide), 0)
    }

    func testFirstWithPreviousStartsByItself() {
        var slide = cards()
        slide.elements[0].animation = ElementAnimation(kind: .fade, trigger: .withPrevious)
        slide.elements[1].animation = ElementAnimation(kind: .fade, trigger: .click)
        XCTAssertTrue(MotionPlanner.timeline(slide)[0].autoStart)
        XCTAssertEqual(MotionPlanner.clicks(slide), 1)
        XCTAssertEqual(MotionPlanner.initialSteps(slide), 1)
    }

    func testLayersKeepStackingOrderAndVisibilityFollowsSteps() {
        var slide = cards()
        slide.elements[2].animation = ElementAnimation(trigger: .click)
        slide.elements[4].animation = ElementAnimation(trigger: .click)
        let all = slide.elements.map(\.id)
        XCTAssertEqual(MotionPlanner.visibleElements(slide, steps: 2).map(\.id), all)
        let none = MotionPlanner.visibleElements(slide, steps: 0).map(\.id)
        XCTAssertFalse(none.contains(slide.elements[2].id))
        XCTAssertFalse(none.contains(slide.elements[4].id))
        let one = MotionPlanner.visibleElements(slide, steps: 1).map(\.id)
        XCTAssertTrue(one.contains(slide.elements[2].id))
        XCTAssertFalse(one.contains(slide.elements[4].id))
        XCTAssertEqual(one, all.filter { $0 != slide.elements[4].id })
    }

    func testSlideWithoutAnimationsIsUntouchedByPlanner() {
        let slide = cards()
        XCTAssertTrue(MotionPlanner.timeline(slide).isEmpty)
        XCTAssertEqual(MotionPlanner.slide(slide, steps: 0), slide)
    }

    func testGroupsFindCardsWithTheirContent() {
        let groups = MotionPlanner.groups(cards())
        XCTAssertGreaterThanOrEqual(groups.count, 3)
        for group in groups { XCTAssertFalse(group.members.isEmpty) }
        let members = groups.flatMap { $0.members.map(\.id) }
        XCTAssertEqual(members.count, Set(members).count, "an element belongs to one box only")
    }

    func testPresetsAreDeterministicAndOffClears() {
        for slide in allSlides() {
            for preset in MotionPreset.allCases {
                XCTAssertEqual(MotionPlanner.apply(preset, to: slide, index: 1), MotionPlanner.apply(preset, to: slide, index: 1))
            }
            let animated = MotionPlanner.apply(.dynamic, to: slide, index: 1)
            let cleared = MotionPlanner.apply(.off, to: animated, index: 1)
            XCTAssertNil(cleared.transition)
            XCTAssertTrue(cleared.elements.allSatisfy { $0.animation == nil })
            XCTAssertEqual(cleared.elements.map(\.id), slide.elements.map(\.id))
        }
    }

    func testPresetsNeverTouchGeometryOrText() {
        for slide in allSlides() {
            for preset in MotionPreset.allCases {
                var result = MotionPlanner.apply(preset, to: slide, index: 0)
                result.transition = nil
                for i in result.elements.indices { result.elements[i].animation = nil }
                XCTAssertEqual(result, slide)
            }
        }
    }

    func testStepwiseFallsBackToCalmWithoutBoxes() {
        let slide = SlideLayouts.preset(.title)
        let result = MotionPlanner.apply(.stepwise, to: slide, index: 0)
        XCTAssertEqual(result.transition?.kind, .fade)
        XCTAssertTrue(MotionPlanner.clicks(result) == 0)
    }

    func testStepwiseNeedsOneClickPerBox() {
        let result = MotionPlanner.apply(.stepwise, to: cards(), index: 1)
        XCTAssertEqual(MotionPlanner.clicks(result), MotionPlanner.groups(cards()).count)
    }

    func testDynamicOpensWithZoomThenPushes() {
        XCTAssertEqual(MotionPlanner.apply(.dynamic, to: cards(), index: 0).transition?.kind, .zoom)
        XCTAssertEqual(MotionPlanner.apply(.dynamic, to: cards(), index: 3).transition?.kind, .push)
    }

    func testHasMotion() {
        var deck = Presentation(title: "T", slides: [cards()])
        XCTAssertFalse(MotionPlanner.hasMotion(deck))
        deck = MotionPlanner.apply(.calm, to: deck)
        XCTAssertTrue(MotionPlanner.hasMotion(deck))
        XCTAssertFalse(MotionPlanner.hasMotion(MotionPlanner.apply(.off, to: deck)))
    }

    // MARK: Codable

    func testOldJSONHasNoMotionAndEncodesWithoutKeys() throws {
        let deck = Presentation(title: "T", slides: [cards()])
        let text = String(decoding: try JSONEncoder().encode(deck), as: UTF8.self)
        XCTAssertFalse(text.contains("transition"))
        XCTAssertFalse(text.contains("animation"))
        let back = try JSONDecoder().decode(Presentation.self, from: Data(text.utf8))
        XCTAssertEqual(back, deck)
    }

    func testMotionRoundTrips() throws {
        let deck = MotionPlanner.apply(.dynamic, to: Presentation(title: "T", slides: [cards(), SlideLayouts.preset(.bullets)]))
        let back = try JSONDecoder().decode(Presentation.self, from: try JSONEncoder().encode(deck))
        XCTAssertEqual(back, deck)
    }

    func testBrokenMotionValuesFallBack() throws {
        let json = #"{"kind":"SPIRAL","direction":"sideways","duration":"slow"}"#
        let transition = try JSONDecoder().decode(SlideTransition.self, from: Data(json.utf8))
        XCTAssertEqual(transition.kind, .none)
        XCTAssertEqual(transition.direction, .left)
        XCTAssertEqual(transition.duration, 0.5)
        let animation = try JSONDecoder().decode(ElementAnimation.self, from: Data("{}".utf8))
        XCTAssertEqual(animation, ElementAnimation())
        let lower = try JSONDecoder().decode(ElementAnimation.self, from: Data(#"{"kind":"fly","trigger":"click"}"#.utf8))
        XCTAssertEqual(lower.kind, .fly)
    }

    func testDeckWithBrokenAnimationStillLoads() throws {
        var deck = Presentation(title: "T", slides: [cards()])
        deck.slides[0].elements[0].animation = ElementAnimation(kind: .zoom)
        var text = String(decoding: try JSONEncoder().encode(deck), as: UTF8.self)
        text = text.replacingOccurrences(of: "\"ZOOM\"", with: "\"BOING\"")
        let back = try JSONDecoder().decode(Presentation.self, from: Data(text.utf8))
        XCTAssertEqual(back.slides[0].elements.count, deck.slides[0].elements.count)
        XCTAssertEqual(back.slides[0].elements[0].animation?.kind, .fade)
    }

    func testDurationsAreClamped() {
        XCTAssertEqual(SlideTransition(kind: .fade, duration: 99).seconds, 3)
        XCTAssertEqual(SlideTransition(kind: .fade, duration: -1).seconds, 0.1)
        XCTAssertEqual(ElementAnimation(delay: 99).delaySeconds, 5)
    }

    // MARK: PPTX

    func testNoMotionMeansIdenticalFile() {
        let deck = Presentation(title: "T", slides: allSlides())
        let a = PptxWriter.write(deck) { _ in nil }
        let b = PptxWriter.write(deck, includeMotion: false) { _ in nil }
        XCTAssertEqual(a, b)
    }

    func testIncludeMotionFalseDropsMotion() {
        let deck = MotionPlanner.apply(.dynamic, to: Presentation(title: "T", slides: allSlides()))
        let plain = Presentation(title: "T", slides: allSlides().map { var s = $0; s.transition = nil; for i in s.elements.indices { s.elements[i].animation = nil }; return s })
        let stripped = PptxWriter.write(deck, includeMotion: false) { _ in nil }
        XCTAssertEqual(stripped.count, PptxWriter.write(plain) { _ in nil }.count)
        XCTAssertNotEqual(stripped, PptxWriter.write(deck) { _ in nil })
    }

    func testEveryPresetProducesWellFormedXMLWithValidTargets() throws {
        for preset in MotionPreset.allCases {
            for (i, slide) in allSlides().enumerated() {
                let deck = MotionPlanner.apply(preset, to: Presentation(title: "T", themeId: SlideTheme.all[i % SlideTheme.all.count].id, slides: [slide]))
                let root = try slideXML(deck)
                let cTnIDs = root.all("cTn").compactMap { $0.attr("id") }
                XCTAssertEqual(cTnIDs.count, Set(cTnIDs).count, "unique cTn ids for \(preset)")
                let shapeIDs = Set(root.all("cNvPr").compactMap { $0.attr("id") })
                XCTAssertEqual(shapeIDs.count, root.all("cNvPr").count, "unique shape ids")
                for target in root.all("spTgt") {
                    XCTAssertTrue(shapeIDs.contains(target.attr("spid") ?? ""), "target exists")
                }
                for build in root.all("bldP") {
                    XCTAssertTrue(shapeIDs.contains(build.attr("spid") ?? ""))
                }
                if preset == .off { XCTAssertNil(root.first("timing")); XCTAssertNil(root.first("transition")) }
            }
        }
    }

    func testTimingStructureForClickAndWithEffect() throws {
        var slide = cards()
        slide.elements[0].animation = ElementAnimation(kind: .fade, trigger: .click)
        slide.elements[1].animation = ElementAnimation(kind: .fly, direction: .left, trigger: .withPrevious, delay: 0.3)
        slide.elements[2].animation = ElementAnimation(kind: .wipe, direction: .down, trigger: .click)
        let root = try slideXML(Presentation(title: "T", slides: [slide]))
        let nodes = root.all("cTn").compactMap { $0.attr("nodeType") }
        XCTAssertEqual(nodes.filter { $0 == "clickEffect" }.count, 2)
        XCTAssertEqual(nodes.filter { $0 == "withEffect" }.count, 1)
        XCTAssertEqual(root.all("cTn").filter { $0.attr("nodeType") == "mainSeq" }.count, 1)
        XCTAssertEqual(root.all("cond").filter { $0.attr("delay") == "300" }.count, 1)
        XCTAssertEqual(root.all("cTn").compactMap { $0.attr("presetID") }.sorted(), ["10", "2", "22"])
    }

    func testFirstAutoStepBeginsWithSlide() throws {
        var slide = cards()
        slide.elements[0].animation = ElementAnimation(kind: .fade, trigger: .withPrevious)
        let root = try slideXML(Presentation(title: "T", slides: [slide]))
        XCTAssertTrue(root.all("cond").contains { $0.attr("evt") == "onBegin" })
        XCTAssertFalse(root.all("cTn").contains { $0.attr("nodeType") == "clickEffect" })
    }

    func testTransitionsFollowTheSlideAndComeBeforeTiming() throws {
        for kind in TransitionKind.allCases {
            var slide = cards()
            slide.transition = SlideTransition(kind: kind, direction: .right, duration: 1.2)
            slide.elements[0].animation = ElementAnimation()
            let root = try slideXML(Presentation(title: "T", slides: [slide]))
            let names = root.children.map(\.localName)
            XCTAssertEqual(root.first("transition") != nil, kind != .none)
            if kind != .none {
                XCTAssertEqual(root.first("transition")?.attr("spd"), "slow")
                XCTAssertLessThan(names.firstIndex(of: "transition")!, names.firstIndex(of: "timing")!)
            }
            XCTAssertLessThan(names.firstIndex(of: "clrMapOvr")!, names.firstIndex(of: "timing")!)
        }
    }

    /// The mapping of "comes from" to the file's `dir`, as LibreOffice's PowerPoint import reads it. If PowerPoint plays it
    /// differently, this is the one table to change.
    func testTransitionDirectionsAreWrittenAsMapped() throws {
        let expected: [(MotionDirection, String)] = [(.left, "l"), (.right, "r"), (.up, "d"), (.down, "u")]
        for kind in [TransitionKind.push, .cover] {
            for (direction, dir) in expected {
                var slide = cards()
                slide.transition = SlideTransition(kind: kind, direction: direction)
                let root = try slideXML(Presentation(title: "T", slides: [slide]))
                let element = try XCTUnwrap(root.first(kind == .push ? "push" : "cover"))
                XCTAssertEqual(element.attr("dir"), dir, "\(kind) \(direction)")
            }
        }
    }

    func testAnimatedPictureWithMissingFileIsSkipped() throws {
        var slide = cards()
        slide.elements.append(SlideElement(kind: .image, x: 100, y: 100, width: 100, height: 100, image: "missing.png", animation: ElementAnimation()))
        let root = try slideXML(Presentation(title: "T", slides: [slide]))
        XCTAssertNil(root.first("timing"))
    }

    func testPictureIsNotBuiltAsParagraph() throws {
        var slide = SlideLayouts.preset(.bullets)
        slide.elements.append(SlideElement(kind: .image, x: 100, y: 100, width: 100, height: 100, image: "a.png", animation: ElementAnimation(kind: .zoom)))
        let png = Data([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        let data = PptxWriter.write(Presentation(title: "T", slides: [slide])) { $0 == "a.png" ? png : nil }
        let root = try XCTUnwrap(OfficeXML.parse(try XCTUnwrap(try parts(data)["ppt/slides/slide1.xml"])))
        XCTAssertNotNil(root.first("timing"))
        XCTAssertTrue(root.all("bldP").isEmpty)
    }

    func testAnimatedDeckStillReadsBack() throws {
        let deck = MotionPlanner.apply(.dynamic, to: Presentation(title: "T", slides: [SlideLayouts.preset(.bullets), cards()]))
        let back = try PptxReader.read(PptxWriter.write(deck) { _ in nil }, title: "T").presentation
        XCTAssertEqual(back.slides.count, 2)
        XCTAssertNil(back.slides[0].transition)
        XCTAssertTrue(back.slides.flatMap(\.elements).allSatisfy { $0.animation == nil })
        let source = deck.slides[0].elements.first { $0.bullets }!
        XCTAssertEqual(back.slides[0].elements.first { $0.bullets }?.text, source.text)
    }
}
