import XCTest
@testable import Lernwerk

final class DesignAdvisorTests: XCTestCase {
    private struct Scripted: LLMClient {
        var reply: String?
        var capabilities: LLMCapabilities { LLMCapabilities(acceptsImages: false, documentHandling: .textOnly) }
        func complete(_ request: LLMRequest) async throws -> LLMResponse {
            guard let reply else { throw LLMError.invalidResponse }
            return LLMResponse(text: reply, stopReason: nil, model: nil)
        }
    }

    private func deck(_ title: String = "Mathematik: Ableitungen", text: String = "Die Ableitung beschreibt die Steigung.") -> Presentation {
        Presentation(title: title, themeId: "quill", slides: [
            Slide(elements: SlideLayouts.build(SlideDraft(layout: .bullets, title: title, bullets: [text]))),
        ])
    }

    // MARK: parse

    func testParseKeepsKnownAndDropsUnknownThemes() throws {
        let json = #"{"suggestions":[{"theme":"ozean","motion":"DYNAMIC","reason":"Passt."},{"theme":"gibtsnicht","motion":"CALM","reason":"x"}]}"#
        let result = try XCTUnwrap(DesignAdvisor.parse(json, current: "quill"))
        XCTAssertEqual(result, [DesignSuggestion(themeID: "ozean", motion: .dynamic, reason: "Passt.")])
    }

    func testParseRemovesCurrentThemeAndDuplicates() throws {
        let json = #"[{"theme":"quill","motion":"OFF","reason":"a"},{"theme":"ozean","motion":"OFF","reason":"b"},{"theme":"OZEAN","motion":"CALM","reason":"c"}]"#
        let result = try XCTUnwrap(DesignAdvisor.parse(json, current: "Quill"))
        XCTAssertEqual(result.map(\.themeID), ["ozean"])
        XCTAssertEqual(result[0].reason, "b")
    }

    func testParseIsTolerant() throws {
        let json = #"{"suggestions":[{"theme":" Ozean ","motion":"sideways","reason":""},{"design":"terminal","motion":"stepwise","reason":"  viel\n Platz  "},{"theme":5},"text",null]}"#
        let result = try XCTUnwrap(DesignAdvisor.parse(json, current: "quill"))
        XCTAssertEqual(result.map(\.themeID), ["ozean", "terminal"])
        XCTAssertEqual(result[0].motion, .calm)
        XCTAssertEqual(result[0].reason, "Vorschlag der KI")
        XCTAssertEqual(result[1].motion, .stepwise)
        XCTAssertEqual(result[1].reason, "viel Platz")
    }

    func testParseRejectsNonJSONAndAcceptsEmpty() {
        XCTAssertNil(DesignAdvisor.parse("Nimm Ozean!", current: "quill"))
        XCTAssertNil(DesignAdvisor.parse("42", current: "quill"))
        XCTAssertEqual(DesignAdvisor.parse("{}", current: "quill"), [])
        XCTAssertEqual(DesignAdvisor.parse("[]", current: "quill"), [])
    }

    func testParseCapsCountAndReasonLength() throws {
        let rows = SlideTheme.all.map { #"{"theme":"\#($0.id)","motion":"CALM","reason":"\#(String(repeating: "lang ", count: 60))"}"# }
        let result = try XCTUnwrap(DesignAdvisor.parse("[" + rows.joined(separator: ",") + "]", current: "none"))
        XCTAssertEqual(result.count, DesignAdvisor.limit)
        XCTAssertTrue(result.allSatisfy { $0.reason.count <= 140 })
    }

    func testSchemaListsEveryThemeAndMotion() throws {
        let text = String(decoding: try JSONSerialization.data(withJSONObject: DesignAdvisor.schema), as: UTF8.self)
        for theme in SlideTheme.all { XCTAssertTrue(text.contains("\"\(theme.id)\""), theme.id) }
        for motion in MotionPreset.allCases { XCTAssertTrue(text.contains(motion.rawValue)) }
    }

    // MARK: heuristic

    func testHeuristicIsFullUniqueDeterministicAndSkipsCurrent() {
        let presentation = deck()
        let a = DesignAdvisor.heuristic(presentation)
        XCTAssertEqual(a, DesignAdvisor.heuristic(presentation))
        XCTAssertEqual(a.count, DesignAdvisor.limit)
        XCTAssertEqual(Set(a.map(\.themeID)).count, a.count)
        XCTAssertFalse(a.map(\.themeID).contains("quill"))
        XCTAssertTrue(a.allSatisfy { !$0.reason.isEmpty })
        let known = Set(SlideTheme.all.map(\.id))
        XCTAssertTrue(a.allSatisfy { known.contains($0.themeID) })
    }

    func testHeuristicFollowsTheTopic() throws {
        let math = try XCTUnwrap(SlideTheme.all.first { $0.mood.contains("Mathematik") && $0.id != "quill" })
        let result = DesignAdvisor.heuristic(deck())
        XCTAssertTrue(result.map(\.themeID).contains(math.id))
        XCTAssertTrue(result[0].reason.hasPrefix("Passt zum Thema"))
        XCTAssertEqual(result[0].themeID, SlideDesign.ranked(DesignAdvisor.profile(deck()).text).first { $0 != "quill" })
    }

    func testHeuristicMotionFollowsDensityAndPictures() {
        XCTAssertEqual(DesignAdvisor.motion(for: .init(text: "", density: 500, pictureShare: 0.9, boxSlides: 5)), .calm)
        XCTAssertEqual(DesignAdvisor.motion(for: .init(text: "", density: 100, pictureShare: 0.5, boxSlides: 0)), .dynamic)
        XCTAssertEqual(DesignAdvisor.motion(for: .init(text: "", density: 100, pictureShare: 0, boxSlides: 3)), .stepwise)
        XCTAssertEqual(DesignAdvisor.motion(for: .init(text: "", density: 100, pictureShare: 0, boxSlides: 0)), .calm)
    }

    func testHeuristicWorksOnAnEmptyDeck() {
        let empty = Presentation(title: "", slides: [])
        XCTAssertEqual(DesignAdvisor.heuristic(empty).count, DesignAdvisor.limit)
    }

    // MARK: entry point

    func testModelAnswerIsUsedAndFilledUp() async {
        let reply = #"{"suggestions":[{"theme":"ozean","motion":"DYNAMIC","reason":"Wasser, Meer."}]}"#
        let result = await DesignAdvisor.suggestions(for: deck(), client: Scripted(reply: reply))
        XCTAssertEqual(result.first, DesignSuggestion(themeID: "ozean", motion: .dynamic, reason: "Wasser, Meer."))
        XCTAssertEqual(result.count, DesignAdvisor.limit)
        XCTAssertEqual(Set(result.map(\.themeID)).count, result.count)
    }

    func testFailingClientFallsBackToHeuristic() async {
        let presentation = deck()
        let result = await DesignAdvisor.suggestions(for: presentation, client: Scripted(reply: nil))
        XCTAssertEqual(result, DesignAdvisor.heuristic(presentation))
    }

    func testGarbageAndUnusableAnswersFallBack() async {
        let presentation = deck()
        for reply in ["Ich empfehle Ozean.", "{\"suggestions\":[{\"theme\":\"nix\"}]}", "", "[[["] {
            let result = await DesignAdvisor.suggestions(for: presentation, client: Scripted(reply: reply))
            XCTAssertEqual(result, DesignAdvisor.heuristic(presentation), reply)
        }
    }
}
