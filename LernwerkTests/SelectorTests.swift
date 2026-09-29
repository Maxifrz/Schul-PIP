import XCTest
@testable import Lernwerk

final class SelectorTests: XCTestCase {
    private final class Sequence: LLMClient, @unchecked Sendable {
        var replies: [String]
        var requests: [LLMRequest] = []
        init(_ replies: [String]) { self.replies = replies }
        var capabilities: LLMCapabilities { LLMCapabilities(acceptsImages: false, documentHandling: .textOnly) }
        func complete(_ request: LLMRequest) async throws -> LLMResponse {
            requests.append(request)
            guard !replies.isEmpty else { throw LLMError.invalidResponse }
            return LLMResponse(text: replies.removeFirst(), stopReason: nil, model: nil)
        }
    }

    // MARK: Form and candidates

    func testFormFromOutlineSlide() {
        let form = ComponentSelector.form(role: "core", layout: "cards", content: "3 Aspekte, 70 % Anteil")
        XCTAssertEqual(form.layout, .cards)
        XCTAssertTrue(form.tags.isSuperset(of: [.grid, .numbers]))
        XCTAssertFalse(form.hasImage)
        XCTAssertTrue(ComponentSelector.form(role: "", layout: "IMAGE_TEXT", content: "").hasImage)
        XCTAssertNil(ComponentSelector.form(role: "", layout: "gibtsnicht", content: "").layout)
        XCTAssertTrue(ComponentSelector.form(role: "", layout: "", content: "Vergleich von A und B").tags.contains(.comparison))
    }

    func testCandidatesAreFewDeterministicAndLedByTheHintedLayout() {
        for layout in SlideLayout.allCases where layout != .blank {
            let form = ComponentSelector.form(role: "", layout: layout.rawValue, content: "")
            let list = ComponentSelector.candidates(for: form)
            XCTAssertLessThanOrEqual(list.count, ComponentSelector.maxCandidates)
            XCTAssertFalse(list.isEmpty, layout.rawValue)
            XCTAssertEqual(list.map(\.id), ComponentSelector.candidates(for: form).map(\.id))
            if layout != .imageText && layout != .imageFull { XCTAssertEqual(list[0].id, layout.componentID, layout.rawValue) }
            XCTAssertEqual(Set(list.map(\.id)).count, list.count)
        }
    }

    func testCandidatesNeverOfferPictureComponentsWithoutPictureOrBlankUnasked() {
        let form = ComponentSelector.form(role: "", layout: "BULLETS", content: "Bild und Text")
        let ids = ComponentSelector.candidates(for: form).map(\.id)
        XCTAssertFalse(ids.contains("image-text") || ids.contains("image-full"))
        XCTAssertFalse(ids.contains("blank"))
        var withImage = form
        withImage.hasImage = true
        withImage.tags.insert(.image)
        XCTAssertTrue(ComponentSelector.candidates(for: withImage, limit: 15).map(\.id).contains("image-text"))
        XCTAssertTrue(ComponentSelector.candidates(for: form, limit: 0).isEmpty)
    }

    func testRecentComponentsRankLower() {
        let form = ContentForm(tags: [.list], layout: nil, role: "", hasImage: false)
        XCTAssertEqual(ComponentSelector.candidates(for: form, limit: 15).first?.id, "bullets")
        XCTAssertNotEqual(ComponentSelector.candidates(for: form, recent: ["bullets", "bullets"], limit: 15).first?.id, "bullets")
    }

    // MARK: Choice

    func testWithoutComponentTheLayoutDecidesSilently() {
        let choice = ComponentSelector.choose(SlideDraft(layout: .process, title: "T"), image: nil)
        XCTAssertEqual(choice, ComponentChoice(componentID: "process", params: [:], log: []))
        XCTAssertTrue(ComponentSelector.choose(SlideDraft(layout: .cards, component: "  "), image: nil).log.isEmpty)
    }

    func testAKnownFittingComponentIsUsed() {
        let draft = SlideDraft(layout: .bullets, title: "T", bullets: ["a"], component: "Bullets", params: ["x": "y"])
        let choice = ComponentSelector.choose(draft, image: nil)
        XCTAssertEqual(choice.componentID, "bullets")
        XCTAssertTrue(choice.log.isEmpty)
        XCTAssertEqual(choice.params, [:], "parameters the component does not have are dropped")
    }

    func testUnknownComponentFallsBackToTheBestLocalCandidateAndLogs() {
        let draft = SlideDraft(layout: .bullets, title: "T", bullets: ["a", "b"], component: "gibtsnicht")
        let choice = ComponentSelector.choose(draft, image: nil)
        XCTAssertEqual(choice.componentID, "bullets")
        XCTAssertEqual(choice.log.count, 2)
        XCTAssertTrue(choice.log[0].contains("gibtsnicht"))
    }

    func testAComponentThatCannotDrawTheContentIsNotUsed() {
        let quote = SlideDraft(layout: .bullets, title: "T", bullets: ["a", "b"], component: "quote")
        let choice = ComponentSelector.choose(quote, image: nil)
        XCTAssertNotEqual(choice.componentID, "quote")
        XCTAssertFalse(choice.log.isEmpty)
        let noPicture = SlideDraft(layout: .bullets, title: "T", bullets: ["a"], component: "image-text")
        XCTAssertNotEqual(ComponentSelector.choose(noPicture, image: nil).componentID, "image-text")
        XCTAssertEqual(ComponentSelector.choose(noPicture, image: PlacedImage(name: "p", aspect: 1.5)).componentID, "image-text")
    }

    func testFallbackChosenComponentDrawsAllContent() {
        for layout in SlideLayout.allCases {
            let draft = SlideDraft(layout: layout, title: "T", bullets: ["a"], items: [DraftItem(title: "x"), DraftItem(title: "y")], component: "unbekannt")
            let choice = ComponentSelector.choose(draft, image: nil)
            let component = ComponentRegistry.component(choice.componentID)!
            XCTAssertTrue(component.covers(draft) || choice.componentID == layout.componentID, layout.rawValue)
        }
    }

    // MARK: Prompt, schema, parsing

    func testSchemaOffersExactlyTheGivenIds() throws {
        let components = [ComponentRegistry.legacy(.cards), ComponentRegistry.legacy(.process)]
        let text = String(decoding: try JSONSerialization.data(withJSONObject: PresentationPrompt.deckSchema(components: components)), as: UTF8.self)
        XCTAssertTrue(text.contains("\"cards\"") && text.contains("\"process\""))
        XCTAssertFalse(text.contains("\"timeline\""))
        XCTAssertTrue(text.contains("component") && text.contains("params"))
    }

    func testInstructionsListTheCandidatesPerSlide() {
        let lists = [[ComponentRegistry.legacy(.cards), ComponentRegistry.legacy(.process)], [ComponentRegistry.legacy(.quote)]]
        let text = PresentationPrompt.componentInstructions(lists)
        XCTAssertTrue(text.contains("Slide 1:") && text.contains("Slide 2:"))
        XCTAssertTrue(text.contains("- cards (layout: CARDS)") && text.contains("- quote (layout: QUOTE)"))
    }

    func testParseSlideReadsComponentAndIgnoresBrokenValues() throws {
        let good = try XCTUnwrap(PresentationPrompt.parseSlideDraft(#"{"layout":"CARDS","title":"T","component":" cards ","params":{"a":"b","n":3,"o":{"x":1},"z":null},"notes":"n"}"#))
        XCTAssertEqual(good.component, "cards")
        XCTAssertEqual(good.params, ["a": "b", "n": "3"])
        let broken = try XCTUnwrap(PresentationPrompt.parseSlideDraft(#"{"layout":"CARDS","title":"T","component":5,"params":"x","notes":"n"}"#))
        XCTAssertNil(broken.component)
        XCTAssertEqual(broken.params, [:])
        let none = try XCTUnwrap(PresentationPrompt.parseSlideDraft(#"{"layout":"BULLETS","title":"T","notes":"n"}"#))
        XCTAssertNil(none.component)
    }

    // MARK: Pipeline

    private let outline = #"{"title":"Vortrag","thesis":"t","slides":[{"role":"hook","message":"Start","layout":"TITLE","content":""},{"role":"core","message":"Kern","layout":"BULLETS","content":""},{"role":"core","message":"Mehr","layout":"BULLETS","content":""},{"role":"core","message":"Noch mehr","layout":"BULLETS","content":""},{"role":"core","message":"Und mehr","layout":"BULLETS","content":""}]}"#

    private func generate(_ deck: String, log: @escaping (String) -> Void = { _ in }) async throws -> (Presentation, Sequence) {
        let client = Sequence([outline, deck])
        var assistant = PresentationAssistant(client: client)
        assistant.onLog = log
        let result = try await assistant.generate(
            content: [.text("Material")], materialIDs: ["m"], topic: "Vortrag", slideCount: 5, minutes: 5, themeID: "quill", review: false,
            pageImage: { _, _ in nil }
        )
        return (result, client)
    }

    private func slide(_ layout: String, _ title: String, extra: String = "") -> String {
        #"{"layout":"\#(layout)","title":"\#(title)","bullets":["a","b"],"notes":"n"\#(extra)}"#
    }

    private func titleSlide(_ title: String, extra: String = "") -> String {
        #"{"layout":"TITLE","title":"\#(title)","notes":"n"\#(extra)}"#
    }

    private func cardsSlide(_ title: String) -> String {
        #"{"layout":"CARDS","title":"\#(title)","items":[{"title":"A","text":"a"},{"title":"B","text":"b"},{"title":"C","text":"c"}],"notes":"n"}"#
    }

    func testGenerationOffersCandidatesAndUsesTheModelsChoice() async throws {
        let deck = #"{"title":"Vortrag","slides":[\#(titleSlide("Vortrag")),\#(slide("BULLETS", "Kern", extra: #","component":"bullets""#))]}"#
        let (presentation, client) = try await generate(deck)
        let prompt = client.requests[1].messages.last!.content.compactMap { content -> String? in
            if case let .text(text) = content { return text }
            return nil
        }.joined()
        XCTAssertTrue(prompt.contains("Slide 1:") && prompt.contains("Slide 5:"))
        XCTAssertNotNil(client.requests[1].jsonSchema)
        XCTAssertEqual(presentation.slides.count, 2)
        XCTAssertEqual(presentation.slides[1].origin?.componentID, "bullets")
        XCTAssertEqual(presentation.slides[0].origin?.componentID, "title")
    }

    func testGenerationSurvivesUnknownIdsAndBrokenParams() async throws {
        let deck = #"{"title":"Vortrag","slides":[\#(titleSlide("Vortrag", extra: #","component":"wolke","params":"kaputt""#)),\#(slide("BULLETS", "Kern", extra: #","component":42,"params":{"x":[1]}"#))]}"#
        var lines: [String] = []
        let (presentation, _) = try await generate(deck) { lines.append($0) }
        XCTAssertEqual(presentation.slides.count, 2)
        XCTAssertEqual(presentation.slides.map { $0.origin?.componentID }, ["title", "bullets"])
        XCTAssertTrue(lines.contains { $0.contains("wolke") })
        XCTAssertTrue(presentation.slides.allSatisfy { !$0.elements.isEmpty })
    }

    func testGenerationAddsATitleSlideAndBreaksUpRuns() async throws {
        let cards = (1...5).map { cardsSlide("Folie \($0)") }.joined(separator: ",")
        let (presentation, _) = try await generate(#"{"title":"Vortrag","slides":[\#(cards)]}"#)
        XCTAssertEqual(presentation.slides.first?.origin?.componentID, "title")
        XCTAssertEqual(presentation.slides.count, 6)
        let ids = presentation.slides.compactMap { $0.origin?.componentID }
        for i in 2..<ids.count { XCTAssertFalse(ids[i] == ids[i - 1] && ids[i] == ids[i - 2], "run at \(i): \(ids)") }
    }

    func testGenerationWithGarbageStillThrowsInsteadOfCrashing() async {
        let client = Sequence([outline, "kein json", "immer noch nicht"])
        do {
            _ = try await PresentationAssistant(client: client).generate(
                content: [.text("x")], materialIDs: ["m"], topic: "T", slideCount: 5, minutes: 5, themeID: "quill", review: false,
                pageImage: { _, _ in nil }
            )
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? LLMError, .invalidResponse)
        }
    }

    // MARK: Deck rhythm

    private func choice(_ layout: SlideLayout, id: String? = nil, bullets: [String] = ["a"]) -> SlideChoice {
        SlideChoice(draft: SlideDraft(layout: layout, title: "T", bullets: bullets), image: nil, componentID: id ?? layout.componentID, params: [:])
    }

    /// Content that cards, steps and timelines can all draw.
    private func entries(_ layout: SlideLayout) -> SlideChoice {
        SlideChoice(draft: SlideDraft(layout: layout, title: "T", items: [DraftItem(title: "A", text: "a"), DraftItem(title: "B", text: "b"), DraftItem(title: "C", text: "c")]),
                    image: nil, componentID: layout.componentID, params: [:])
    }

    func testRhythmStartsWithATitle() {
        let result = DeckRhythm.refine([choice(.bullets), choice(.cards)], deckTitle: " Mein Vortrag ")
        XCTAssertEqual(result.slides.map(\.componentID), ["title", "bullets", "cards"])
        XCTAssertEqual(result.slides[0].draft.title, "Mein Vortrag")
        XCTAssertFalse(result.log.isEmpty)
        let kept = DeckRhythm.refine([choice(.title), choice(.bullets)], deckTitle: "X")
        XCTAssertEqual(kept.slides.count, 2)
        XCTAssertTrue(kept.log.isEmpty)
        XCTAssertEqual(DeckRhythm.refine([], deckTitle: "X").slides, [])
    }

    func testRhythmBreaksThreeInARowAndOnlyThen() {
        let slides = [choice(.title), entries(.cards), entries(.cards), entries(.cards), entries(.cards)]
        let run = DeckRhythm.refine(slides, deckTitle: "X")
        let ids = run.slides.map(\.componentID)
        XCTAssertEqual(Array(ids[0...2]), ["title", "cards", "cards"])
        XCTAssertNotEqual(ids[3], "cards")
        XCTAssertEqual(run.slides.map(\.draft), slides.map(\.draft), "content is never touched")
        for i in 2..<ids.count { XCTAssertFalse(ids[i] == ids[i - 1] && ids[i] == ids[i - 2], "\(ids)") }
        let two = DeckRhythm.refine([choice(.title), entries(.cards), entries(.cards), entries(.process)], deckTitle: "X")
        XCTAssertEqual(two.slides.map(\.componentID), ["title", "cards", "cards", "process"])
    }

    func testRhythmKeepsARunItCannotBreakAndSaysSo() {
        // Bullets have no other component that draws them yet, so the run stays and is logged.
        let slides = [choice(.title)] + (0..<3).map { _ in choice(.bullets) }
        let result = DeckRhythm.refine(slides, deckTitle: "X")
        if result.slides.map(\.componentID) == slides.map(\.componentID) {
            XCTAssertTrue(result.log.contains { $0.contains("keine Alternative") })
        } else {
            XCTAssertTrue(result.slides.allSatisfy { ComponentRegistry.component($0.componentID)!.covers($0.draft) })
        }
    }

    func testRhythmSwapsOnlyForComponentsThatDrawTheContent() {
        let slides = [choice(.title)] + (0..<6).map { _ in entries(.process) }
        let result = DeckRhythm.refine(slides, deckTitle: "X")
        for slide in result.slides where slide.componentID != "title" {
            XCTAssertTrue(ComponentRegistry.component(slide.componentID)!.covers(slide.draft), slide.componentID)
        }
    }

    func testRhythmIsIdempotentAndFamilyFollowsTextAmount() {
        let slides = [choice(.title)] + (0..<6).map { _ in choice(.bullets) }
        let once = DeckRhythm.refine(slides, deckTitle: "X")
        XCTAssertEqual(DeckRhythm.refine(once.slides, deckTitle: "X").slides, once.slides)
        XCTAssertEqual(DeckRhythm.family([]), .airy)
        XCTAssertEqual(DeckRhythm.family([SlideDraft(layout: .bullets, bullets: ["kurz"])]), .airy)
        XCTAssertEqual(DeckRhythm.family([SlideDraft(layout: .bullets, bullets: [String(repeating: "x", count: 400)])]), .compact)
    }
}
