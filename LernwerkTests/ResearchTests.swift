import Foundation
import XCTest
@testable import Lernwerk

private final class ResearchScriptedClient: LLMClient {
    var replies: [String]
    var requests: [LLMRequest] = []
    let capabilities = LLMCapabilities(acceptsImages: true, documentHandling: .textOnly)

    init(_ replies: [String]) {
        self.replies = replies
    }

    func complete(_ request: LLMRequest) async throws -> LLMResponse {
        requests.append(request)
        return LLMResponse(text: replies.removeFirst(), stopReason: "stop", model: "m")
    }
}

/// Answers GET requests whose decoded URL contains a route's key; everything else finds nothing.
private final class FakeWeb {
    let routes: [String: String]
    var urls: [URL] = []
    var headers: [[String: String]] = []

    init(_ routes: [String: String]) {
        self.routes = routes
    }

    var client: WikipediaClient {
        WikipediaClient(fetch: { [self] url, headers in
            urls.append(url)
            self.headers.append(headers)
            let decoded = url.absoluteString.removingPercentEncoding ?? ""
            guard let body = routes.first(where: { decoded.contains($0.key) })?.value else {
                return (Data(#"{"batchcomplete":true}"#.utf8), 200)
            }
            return body == "500" ? (Data(), 500) : (Data(body.utf8), 200)
        })
    }
}

final class ResearchTests: XCTestCase {
    private let search = #"{"batchcomplete":true,"query":{"pages":[{"pageid":2,"ns":0,"title":"Chlorophyll a","index":2,"extract":"Chlorophyll a ist die häufigste Form.","fullurl":"https://de.wikipedia.org/wiki/Chlorophyll_a"},{"pageid":1,"ns":0,"title":"Chlorophyll","index":1,"extract":"Chlorophyll ist ein grüner Farbstoff.","fullurl":"https://de.wikipedia.org/wiki/Chlorophyll"},{"ns":0,"title":"Fehlt","missing":true}]}}"#
    private let article = #"{"query":{"pages":[{"pageid":1,"title":"Chlorophyll","extract":"Chlorophyll ist ein grüner Farbstoff. Es absorbiert vor allem rotes und blaues Licht.\n\n\n\nMehr.","fullurl":"https://de.wikipedia.org/wiki/Chlorophyll"}]}}"#
    private let date = DateComponents(calendar: Calendar(identifier: .gregorian), timeZone: TimeZone.current, year: 2026, month: 9, day: 24, hour: 12).date!

    func testSearchKeepsTheRankingAndSkipsMissingPages() async throws {
        let web = FakeWeb(["gsrsearch=Chlorophyll Farbstoff": search])
        let hits = try await web.client.search("Chlorophyll Farbstoff")
        XCTAssertEqual(hits.map(\.title), ["Chlorophyll", "Chlorophyll a"])
        XCTAssertEqual(hits[0].url, "https://de.wikipedia.org/wiki/Chlorophyll")
        XCTAssertTrue(web.urls[0].absoluteString.hasPrefix("https://de.wikipedia.org/w/api.php?action=query&generator=search"))
        XCTAssertTrue(web.urls[0].absoluteString.contains("gsrsearch=Chlorophyll%20Farbstoff"))
        XCTAssertTrue(web.urls[0].absoluteString.contains("prop=extracts%7Cinfo"))
        XCTAssertTrue(web.headers[0]["User-Agent"]?.hasPrefix("SchulPip/") ?? false)
    }

    func testGatheringFetchesTheBestArticleAndSkipsDuplicatesAndFailures() async throws {
        let web = FakeWeb(["gsrsearch=Chlorophyll": search, "titles=Chlorophyll": article, "gsrsearch=Kaputt": "500"])
        let existing = [WebSource(id: "W1", title: "Chlorophyll a", url: "https://de.wikipedia.org/wiki/Chlorophyll_a", text: "schon da")]
        let sources = try await Research.gather(web.client, queries: ["Kaputt", "Chlorophyll", "Chlorophyll", " "], existing: existing)
        XCTAssertEqual(sources.map(\.id), ["W1", "W2"])
        XCTAssertEqual(sources[1].title, "Chlorophyll")
        XCTAssertEqual(sources[1].text, "Chlorophyll ist ein grüner Farbstoff. Es absorbiert vor allem rotes und blaues Licht.\n\nMehr.")
        XCTAssertTrue(Research.prompt(sources).contains(#"<article id="W2" title="Chlorophyll" url="https://de.wikipedia.org/wiki/Chlorophyll">"#))
    }

    func testTextsAreShortenedAtASentence() {
        XCTAssertEqual(WikiText.shorten("Eins. Zwei. Drei vier fünf sechs.", maxChars: 20), "Eins. Zwei.")
        XCTAssertEqual(WikiText.shorten("Kurz.", maxChars: 20), "Kurz.")
        XCTAssertTrue(WikiText.shorten(String(repeating: "x", count: 50), maxChars: 20).hasSuffix("…"))
        XCTAssertEqual(
            Research.youtubeSearchURL(" Satz des Pythagoras erklärt ")?.absoluteString,
            "https://www.youtube.com/results?search_query=Satz+des+Pythagoras+erkl%C3%A4rt"
        )
    }

    func testSourcesAreCitedOnTheSlidesAndTheSourcesSlide() {
        let sources = [
            WebSource(id: "W1", title: "Chlorophyll", url: "https://de.wikipedia.org/wiki/Chlorophyll", text: "…"),
            WebSource(id: "W2", title: "Licht", url: "https://de.wikipedia.org/wiki/Licht", text: "…"),
        ]
        let drafts = [
            SlideDraft(layout: .bullets, title: "Grün", notes: "Hallo", webSources: ["W1", "W9"]),
            SlideDraft(layout: .twoColumns, title: "Quellen", left: ["Skript S. 2"], right: ["Wikipedia: Chlorophyll"]),
        ]
        let cited = PresentationPrompt.citingSources(drafts, sources: sources, materialTitles: ["Skript"], date: date)
        XCTAssertEqual(cited[0].notes, "Hallo\n\nQuelle: Wikipedia – „Chlorophyll“")
        XCTAssertEqual(cited[1].layout, .bullets)
        XCTAssertEqual(cited[1].bullets, ["Skript S. 2", "„Chlorophyll“, Wikipedia, de.wikipedia.org/wiki/Chlorophyll (abgerufen am 24.09.2026)"])

        let added = PresentationPrompt.citingSources([SlideDraft(layout: .bullets, title: "A")], sources: sources, materialTitles: ["Skript"], date: date)
        XCTAssertEqual(added.last?.title, "Quellen")
        XCTAssertEqual(added.last?.bullets.count, 3)
        XCTAssertEqual(added.last?.bullets.first, "Material: Skript")
    }

    func testGenerationResearchesWhatTheOutlineAsksFor() async throws {
        let outline = #"{"title":"Photosynthese","thesis":"t","research":["Chlorophyll"],"slides":[{"role":"core","message":"Blätter sind grün","layout":"BULLETS","content":""},{"role":"sources","message":"Quellen","layout":"BULLETS","content":""}]}"#
        let deck = #"{"title":"Photosynthese","slides":[{"layout":"BULLETS","title":"Blätter sind grün","bullets":["Chlorophyll"],"notes":"Laut Wikipedia …","webSources":["[w1]"]},{"layout":"BULLETS","title":"Quellen","bullets":["Skript"],"notes":"n"}]}"#
        let critique = #"{"verdict":"V","findings":[]}"#
        let client = ResearchScriptedClient([outline, deck, critique])
        let web = FakeWeb(["gsrsearch=Chlorophyll": search, "titles=Chlorophyll": article])
        var stages: [PresentationAssistant.Stage] = []
        let presentation = try await PresentationAssistant(client: client).generate(
            content: [.text("Pflanzen machen aus Licht Zucker."), .text(PresentationPrompt.deckInstructions(topic: "Photosynthese", slideCount: 6, minutes: 5, research: true))],
            materialIDs: ["m1"],
            materialTitles: ["Skript"],
            topic: "Photosynthese",
            slideCount: 6,
            minutes: 5,
            themeID: "quill",
            wikipedia: web.client,
            today: date,
            onStage: { stages.append($0) },
            pageImage: { _, _ in nil }
        )
        XCTAssertEqual(stages, PresentationAssistant.Stage.allCases)
        XCTAssertEqual(client.requests.map(\.purpose), [.presentationOutline, .presentation, .presentationCritique])
        XCTAssertTrue(client.requests.prefix(2).allSatisfy { $0.system.contains("webSources") })
        XCTAssertTrue(texts(client.requests[0].messages[0].content).contains("search terms in research"))
        let slidesTurn = client.requests[1].messages.last!.content
        XCTAssertTrue(texts(Array(slidesTurn.prefix(1))).contains(#"<article id="W1" title="Chlorophyll""#))
        XCTAssertTrue(texts(Array(slidesTurn.suffix(1))).contains("webSources"))
        let critic = texts(client.requests[2].messages[0].content)
        XCTAssertTrue(critic.contains("Pflanzen machen") && critic.contains(#"<article id="W1""#))

        XCTAssertTrue(presentation.slides[0].notes.hasSuffix("Quelle: Wikipedia – „Chlorophyll“"))
        let sourcesText = presentation.slides[1].elements.map(\.text).joined(separator: "\n")
        XCTAssertTrue(sourcesText.contains("Skript"))
        XCTAssertTrue(sourcesText.contains("„Chlorophyll“, Wikipedia, de.wikipedia.org/wiki/Chlorophyll (abgerufen am 24.09.2026)"))
        XCTAssertFalse(sourcesText.contains("Chlorophyll a"))
    }

    func testWithoutMaterialTheTopicIsResearchedFirst() async throws {
        let outline = #"{"title":"Chlorophyll","thesis":"t","slides":[{"role":"core","message":"Grün","layout":"BULLETS","content":""}]}"#
        let deck = #"{"title":"Chlorophyll","slides":[{"layout":"BULLETS","title":"Grün","bullets":["x"],"notes":"n","webSources":["W1"]}]}"#
        let client = ResearchScriptedClient([outline, deck])
        let web = FakeWeb(["gsrsearch=Chlorophyll": search, "titles=Chlorophyll": article])
        var stages: [PresentationAssistant.Stage] = []
        let instructions = PresentationPrompt.deckInstructions(topic: "Chlorophyll", slideCount: 5, minutes: 5, research: true, hasMaterial: false)
        let presentation = try await PresentationAssistant(client: client).generate(
            content: [.text(instructions)],
            materialIDs: [],
            topic: "Chlorophyll",
            slideCount: 5,
            minutes: 5,
            themeID: "quill",
            review: false,
            wikipedia: web.client,
            today: date,
            onStage: { stages.append($0) },
            pageImage: { _, _ in nil }
        )
        XCTAssertEqual(stages, [.research, .outline, .slides])
        let first = client.requests[0].messages[0].content
        XCTAssertTrue(texts(Array(first.prefix(1))).contains(#"<article id="W1" title="Chlorophyll""#))
        XCTAssertTrue(texts(Array(first.suffix(1))).contains("there is no material"))
        XCTAssertEqual(presentation.slides.count, 2)
        let sourcesText = presentation.slides[1].elements.map(\.text).joined(separator: "\n")
        XCTAssertTrue(sourcesText.contains("„Chlorophyll“, Wikipedia") && !sourcesText.contains("Material:"))

        let nothing = ResearchScriptedClient([])
        do {
            _ = try await PresentationAssistant(client: nothing).generate(
                content: [.text("x")], materialIDs: [], topic: "Xyzzy", slideCount: 5, minutes: 5, themeID: "quill",
                wikipedia: FakeWeb([:]).client, pageImage: { _, _ in nil }
            )
            XCTFail("expected nothingFound")
        } catch let error as ResearchError {
            XCTAssertEqual(error, .nothingFound("Xyzzy"))
        }
        XCTAssertTrue(nothing.requests.isEmpty)
    }

    private func texts(_ content: [LLMContent]) -> String {
        content.compactMap { item -> String? in
            if case let .text(text) = item { return text }
            return nil
        }.joined(separator: "\n")
    }
}
