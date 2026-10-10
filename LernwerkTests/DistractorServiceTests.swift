import XCTest
@testable import Lernwerk

private final class DistractorScriptedClient: LLMClient {
    var replies: [String]
    var requests: [LLMRequest] = []
    let capabilities = LLMCapabilities(acceptsImages: false, documentHandling: .textOnly)

    init(_ replies: [String]) {
        self.replies = replies
    }

    func complete(_ request: LLMRequest) async throws -> LLMResponse {
        requests.append(request)
        guard !replies.isEmpty else { throw LLMError.invalidResponse }
        return LLMResponse(text: replies.removeFirst(), stopReason: "stop", model: "m")
    }
}

final class DistractorServiceTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 1_800_000_000)
    private var suites: [String] = []

    private func freshDefaults() -> UserDefaults {
        let suite = "DistractorServiceTests-\(UUID().uuidString)"
        suites.append(suite)
        return UserDefaults(suiteName: suite)!
    }

    override func tearDown() {
        for suite in suites { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        suites = []
        super.tearDown()
    }

    private var berlin: CardSnapshot {
        CardSnapshot(front: "Hauptstadt von Deutschland?", back: "Berlin", materialID: nil, createdAt: start, dueDate: start)
    }

    private var paris: CardSnapshot {
        CardSnapshot(front: "Hauptstadt von Frankreich?", back: "Paris", materialID: nil, createdAt: start.addingTimeInterval(1), dueDate: start)
    }

    func testAWrongAnswerTheCheckWouldAcceptIsDropped() {
        let written = ["Berlin.", "berlin", "Hamburg", "Berlin / Hauptstadt", "Berlinn", "München", String(repeating: "x", count: 300), "Köln", "Bonn"]
        XCTAssertEqual(DistractorService.validated(written, for: "Berlin"), ["Hamburg", "München", "Köln"])
        XCTAssertEqual(DistractorService.validated(["Hamburg", "hamburg", "Hamburg "], for: "Berlin"), ["Hamburg"])
        XCTAssertEqual(DistractorService.validated(["Produktregel"], for: "Kettenregel"), ["Produktregel"])
        XCTAssertEqual(DistractorService.validated(["Die Kettenregel", "Kettenregel: äußere mal innere"], for: "Kettenregel"), [])
    }

    func testParsingIsLenient() {
        let parsed = DistractorService.parse(#"{"cards":[{"id":"1","distractors":["A","B",3,"C"]},{"id":2,"distractors":["D"]},{"id":"x"},{"distractors":["E"]}]}"#)
        XCTAssertEqual(parsed?[1], ["A", "B", "C"])
        XCTAssertEqual(parsed?[2], ["D"])
        XCTAssertEqual(parsed?.count, 2)
        XCTAssertNil(DistractorService.parse("keine Ahnung"))
    }

    func testFetchAsksOnceForABatchAndCachesWhatPasses() async {
        let cache = DistractorCache(defaults: freshDefaults())
        let client = DistractorScriptedClient([
            #"Hier: {"cards":[{"id":"1","distractors":["Hamburg","Berlin.","München","Köln"]},{"id":"2","distractors":["Lyon","paris","Marseille"]}]}"#,
        ])
        let service = DistractorService(client: client, cache: cache)
        let cached = await service.fetch(for: [berlin, paris])

        XCTAssertEqual(Set(cached.keys), [berlin.key, paris.key])
        XCTAssertEqual(cached[paris.key], ["Lyon", "Marseille"])
        XCTAssertEqual(cache.distractors(for: berlin.key), ["Hamburg", "München", "Köln"])
        XCTAssertEqual(cache.distractors(for: paris.key), ["Lyon", "Marseille"])
        XCTAssertNil(cache.distractors(for: "unbekannt"))

        XCTAssertEqual(client.requests.count, 1)
        let request = client.requests[0]
        XCTAssertEqual(request.purpose, .distractors)
        XCTAssertNotNil(request.jsonSchema?["properties"])
        guard case let .text(prompt) = request.messages[0].content[0] else { return XCTFail("expected text") }
        XCTAssertTrue(prompt.contains("<card id=\"2\">") && prompt.contains("<back>Paris</back>") && prompt.contains("Hauptstadt von Deutschland?"))
        XCTAssertTrue(request.system.contains("German") && request.system.contains("clearly wrong"))
    }

    func testDemoAnswersAreReturnedButNotSaved() async {
        let cache = DistractorCache(defaults: freshDefaults())
        let client = DistractorScriptedClient([#"{"cards":[{"id":"1","distractors":["Hamburg","München","Köln"]}]}"#])
        let fetched = await DistractorService(client: client, cache: cache).fetch(for: [berlin], persist: false)
        XCTAssertEqual(fetched, [berlin.key: ["Hamburg", "München", "Köln"]])
        XCTAssertTrue(cache.all().isEmpty)
    }

    func testOfflineOrWithoutAKeyNothingIsCachedAndTheCardsAreTyped() async {
        let cache = DistractorCache(defaults: freshDefaults())
        let failing = DistractorService(client: FailingClient(error: .missingAPIKey(provider: "Test")), cache: cache)
        let cached = await failing.fetch(for: [berlin, paris])
        XCTAssertTrue(cached.isEmpty)
        XCTAssertTrue(cache.all().isEmpty)
        let exercises = ExerciseBuilder(lesson: [berlin], deck: [berlin, paris], cachedDistractors: cache.all()).build(seed: 1)
        XCTAssertFalse(exercises.contains { $0.kind == .multipleChoice })
        XCTAssertTrue(exercises.contains { $0.kind == .typeAnswer })
    }

    func testCachedAnswersTurnAThinDeckIntoMultipleChoice() async {
        let cache = DistractorCache(defaults: freshDefaults())
        let client = DistractorScriptedClient([#"{"cards":[{"id":"1","distractors":["Hamburg","München","Köln"]}]}"#])
        await DistractorService(client: client, cache: cache).fetch(for: [berlin])
        let exercises = ExerciseBuilder(lesson: [berlin], deck: [berlin, paris], cachedDistractors: cache.all()).build(seed: 1)
        let choice = exercises.first { $0.kind == .multipleChoice }
        XCTAssertNotNil(choice)
        XCTAssertEqual(Set(choice?.options ?? []), ["Berlin", "Paris", "Hamburg", "München"])
    }

    func testTheCacheMergesAndForgetsChangedCards() {
        let cache = DistractorCache(defaults: freshDefaults())
        XCTAssertTrue(cache.all().isEmpty)
        cache.store(["a": ["1", "2"], "b": ["3"]])
        cache.store(["b": ["4"], "c": []])
        XCTAssertEqual(cache.all(), ["a": ["1", "2"], "b": ["4"], "c": []])
        XCTAssertEqual(cache.distractors(for: "c"), [])
        cache.prune(keeping: ["a", "c"])
        XCTAssertEqual(cache.all(), ["a": ["1", "2"], "c": []])
    }

    func testTheDemoAnswersEveryCardWithThreeWrongAnswers() {
        let cards = [berlin, paris, CardSnapshot(front: "Kettenregel?", back: "äußere mal innere Ableitung", materialID: nil, createdAt: start, dueDate: start)]
        let reply = DistractorService.demo(DistractorService.request(for: cards))
        let parsed = DistractorService.parse(StructuredOutput.extractJSON(from: reply))
        XCTAssertEqual(parsed?.count, 3)
        XCTAssertTrue(parsed?.values.allSatisfy { $0.count == 4 } ?? false)
        XCTAssertEqual(DistractorService.validated(parsed?[3] ?? [], for: cards[2].back).count, 3)
        XCTAssertEqual(DistractorService.parse(DistractorService.demo(LLMRequest(purpose: .distractors, system: "", messages: [], maxTokens: 1)))?.count, 0)
    }

    func testEveryDemoHelpCardGetsThreeWrongAnswersThatPass() {
        // The demo's help card, as DemoContent.flashcardJSON makes it, several times over.
        let back = "Mit der Kettenregel: äußere Ableitung mal innere Ableitung. Hier 3(2x − 7)² · 2 = 6(2x − 7)²."
        let cards = (0..<9).map { index in
            CardSnapshot(front: "Wie leitest du (2x − 7)³ ab? \(index)", back: back, materialID: nil, createdAt: start.addingTimeInterval(Double(index)), dueDate: start)
        }
        let parsed = DistractorService.parse(DistractorService.demo(DistractorService.request(for: cards)))
        XCTAssertEqual(parsed?.count, 9)
        for index in 1...9 {
            XCTAssertEqual(DistractorService.validated(parsed?[index] ?? [], for: back).count, 3, "card \(index)")
        }
    }
}
