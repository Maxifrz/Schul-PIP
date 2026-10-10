import XCTest
@testable import Lernwerk

private struct ScriptedWriter: FlashcardWriting {
    var replies: [Result<[Flashcard], LLMError>]
    var seen = Box()

    final class Box {
        var requests: [(pagesLabel: String, pages: String)] = []
        var index = 0
    }

    func flashcards(title: String, summary: String, pagesLabel: String, pages: String) async throws -> [Flashcard] {
        seen.requests.append((pagesLabel, pages))
        defer { seen.index += 1 }
        let reply = replies[min(seen.index, replies.count - 1)]
        return try reply.get()
    }
}

final class MaterialPathTests: XCTestCase {
    private func page(_ n: Int, _ length: Int = 200) -> String {
        "Seite \(n): " + String(repeating: "Text über die Zelle. ", count: length / 21 + 1)
    }

    func testPagesAreCutIntoStretchesOfAboutThreePages() {
        let pages = (1...8).map { page($0, 1900) }
        let chunks = MaterialPath.chunks(of: pages)
        XCTAssertEqual(chunks.map(\.pages), [[1, 2, 3], [4, 5, 6], [7, 8]])
        XCTAssertEqual(chunks[0].pagesLabel, "S. 1–3")
        XCTAssertEqual(chunks[2].firstPage, 7)
        XCTAssertTrue(chunks[0].text.hasPrefix("--- Page 1 ---\nSeite 1"))
        XCTAssertTrue(chunks[0].text.contains("--- Page 3 ---"))
        XCTAssertTrue(chunks.allSatisfy { $0.text.count <= MaterialPath.maxChunkCharacters + 200 })
    }

    func testPicturePagesEndAStretchAndAreSkipped() {
        let pages = [page(1), page(2), "", "Abb. 3", page(5), page(6)]
        let chunks = MaterialPath.chunks(of: pages)
        XCTAssertEqual(chunks.map(\.pages), [[1, 2], [5, 6]])
        XCTAssertEqual(chunks[1].pagesLabel, "S. 5–6")
        XCTAssertTrue(MaterialPath.chunks(of: []).isEmpty)
        XCTAssertTrue(MaterialPath.chunks(of: ["", " ", "x"]).isEmpty)
    }

    func testAHugePageIsClippedNotDropped() {
        let chunks = MaterialPath.chunks(of: [String(repeating: "a ", count: 20_000), page(2)])
        XCTAssertEqual(chunks.map(\.pages), [[1], [2]])
        XCTAssertLessThanOrEqual(chunks[0].text.count, MaterialPath.maxChunkCharacters + 40)
    }

    func testOnlyStretchesWithoutCardsAreAskedFor() {
        let chunks = MaterialPath.chunks(of: (1...6).map { page($0, 1900) })
        XCTAssertEqual(MaterialPath.stretchesWithoutCards(chunks, cardPages: [1]).map(\.firstPage), [4])
        XCTAssertEqual(MaterialPath.stretchesWithoutCards(chunks, cardPages: []).count, 2)
        XCTAssertTrue(MaterialPath.stretchesWithoutCards(chunks, cardPages: [3, 4]).isEmpty)
    }

    func testFreshCardsDropEmptyAndKnownQuestions() {
        let written = [
            Flashcard(front: "Was ist die Zelle?", back: "Die kleinste Einheit des Lebens."),
            Flashcard(front: "was ist die zelle", back: "Doppelt."),
            Flashcard(front: "  ", back: "leer"),
            Flashcard(front: "Was ist der Zellkern?", back: " "),
            Flashcard(front: "Wo sitzt die DNA?", back: "Im Zellkern."),
        ]
        let fresh = MaterialPath.fresh(written, existingFronts: ["Wo sitzt die DNA?"], page: 4)
        XCTAssertEqual(fresh, [GeneratedCard(front: "Was ist die Zelle?", back: "Die kleinste Einheit des Lebens.", page: 4)])
    }

    func testARunAsksStretchByStretchAndKeepsWhatCameBeforeAnError() async {
        let pages = (1...12).map { page($0, 1900) }
        let writer = ScriptedWriter(replies: [
            .success([Flashcard(front: "A?", back: "a"), Flashcard(front: "B?", back: "b")]),
            .success([Flashcard(front: "A?", back: "again"), Flashcard(front: "C?", back: "c")]),
            .failure(.rateLimited("zu viele Anfragen")),
        ])
        var steps: [Int] = []
        let outcome = await MaterialPath.generate(
            title: "Biologie", pageTexts: pages, cardPages: [], existingFronts: ["Z?"], writer: writer, progress: { done, _ in steps.append(done) }
        )
        XCTAssertEqual(outcome.cards.map(\.front), ["A?", "B?", "C?"], "the repeated question is dropped")
        XCTAssertEqual(outcome.cards.map(\.page), [1, 1, 4])
        XCTAssertEqual(outcome.done, 2)
        XCTAssertEqual(outcome.remaining, 2)
        XCTAssertNotNil(outcome.failure)
        XCTAssertEqual(steps, [0, 1, 2])
        XCTAssertEqual(writer.seen.requests.count, 3)
        XCTAssertEqual(writer.seen.requests[0].pagesLabel, "S. 1–3")
        XCTAssertTrue(writer.seen.requests[0].pages.hasPrefix("<pages S. 1–3>\n--- Page 1 ---"))
    }

    func testARunStopsAtTheLimitAndSaysHowMuchIsLeft() async {
        let pages = (1...60).map { page($0, 1900) }
        let writer = ScriptedWriter(replies: [.success([Flashcard(front: "Frage?", back: "Antwort")])])
        let outcome = await MaterialPath.generate(title: "Lang", pageTexts: pages, cardPages: [], existingFronts: [], writer: writer)
        XCTAssertEqual(outcome.done, MaterialPath.maxChunksPerRun)
        XCTAssertEqual(outcome.remaining, 20 - MaterialPath.maxChunksPerRun)
        XCTAssertNil(outcome.failure)
        XCTAssertEqual(outcome.cards.count, 1, "the same question is kept once")
    }

    func testNothingToDoWithoutText() async {
        let writer = ScriptedWriter(replies: [.failure(.missingAPIKey(provider: "x"))])
        let outcome = await MaterialPath.generate(title: "Scan", pageTexts: ["", ""], cardPages: [], existingFronts: [], writer: writer)
        XCTAssertEqual(outcome, MaterialPath.Outcome())
        XCTAssertEqual(writer.seen.requests.count, 0)
    }
}
