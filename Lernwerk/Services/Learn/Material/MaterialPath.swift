import Foundation

/// A stretch of a material's pages that is turned into cards in one request.
struct MaterialChunk: Equatable {
    /// Page numbers from 1.
    let pages: [Int]
    /// The pages' text, each page under "--- Page N ---", as the study plan's prompts label them.
    let text: String

    var firstPage: Int { pages.first ?? 1 }

    /// "S. 3" or "S. 3–5".
    var pagesLabel: String {
        guard let first = pages.first, let last = pages.last else { return "" }
        return first == last ? "S. \(first)" : "S. \(first)–\(last)"
    }
}

/// A card the model wrote for a page of a material; the app turns it into a `ReviewCard`.
struct GeneratedCard: Equatable {
    let front: String
    let back: String
    let page: Int
}

/// Writes flashcards for a stretch of a material; the study plan's `TopicAssistant` does.
protocol FlashcardWriting {
    func flashcards(title: String, summary: String, pagesLabel: String, pages: String) async throws -> [Flashcard]
}

/// The Lernpfad from a material: its pages are cut into stretches, the model writes cards for each, and the cards
/// become the units and lessons of the path. The student does not have to make a single card.
enum MaterialPath {
    /// The most characters of page text in one request: about three dense pages, which gives six to ten cards.
    static let maxChunkCharacters = 6000
    /// Stretches asked for in one run, so one tap costs a bounded number of requests.
    static let maxChunksPerRun = 10
    /// A page with less text than this is a picture or a scan and has nothing to ask about.
    static let minimumPageCharacters = 40

    static func chunks(of pageTexts: [String]) -> [MaterialChunk] {
        var chunks: [MaterialChunk] = []
        var pages: [Int] = []
        var parts: [String] = []
        var size = 0
        func close() {
            if !pages.isEmpty { chunks.append(MaterialChunk(pages: pages, text: parts.joined(separator: "\n"))) }
            pages = []
            parts = []
            size = 0
        }
        for (index, raw) in pageTexts.enumerated() {
            let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard text.count >= minimumPageCharacters else {
                // A picture page ends the stretch: what comes after it is another thought.
                close()
                continue
            }
            let clipped = String(text.prefix(maxChunkCharacters))
            if size > 0, size + clipped.count > maxChunkCharacters { close() }
            pages.append(index + 1)
            parts.append("--- Page \(index + 1) ---\n\(clipped)")
            size += clipped.count
        }
        close()
        return chunks
    }

    /// The stretches that have no card yet: a card made from a stretch is stored with the stretch's first page.
    static func stretchesWithoutCards(_ chunks: [MaterialChunk], cardPages: Set<Int>) -> [MaterialChunk] {
        chunks.filter { chunk in !chunk.pages.contains(where: cardPages.contains) }
    }

    /// The model's cards without empty ones and without one whose question the student already has.
    static func fresh(_ cards: [Flashcard], existingFronts: [String], page: Int) -> [GeneratedCard] {
        var seen = Set(existingFronts.map(LearnExercise.folded))
        var result: [GeneratedCard] = []
        for card in cards {
            let front = card.front.trimmingCharacters(in: .whitespacesAndNewlines)
            let back = card.back.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !front.isEmpty, !back.isEmpty, seen.insert(LearnExercise.folded(front)).inserted else { continue }
            result.append(GeneratedCard(front: front, back: back, page: page))
        }
        return result
    }

    struct Outcome: Equatable {
        var cards: [GeneratedCard] = []
        /// Stretches that were asked for without a problem.
        var done = 0
        /// Stretches that remain, because of the limit per run or an error.
        var remaining = 0
        /// The first error, if the run stopped on one; the cards before it are kept.
        var failure: String?
    }

    /// Asks for cards stretch by stretch. A stretch whose request fails stops the run; what came before is returned.
    static func generate(
        title: String,
        pageTexts: [String],
        cardPages: Set<Int>,
        existingFronts: [String],
        writer: any FlashcardWriting,
        progress: (Int, Int) -> Void = { _, _ in }
    ) async -> Outcome {
        let open = stretchesWithoutCards(chunks(of: pageTexts), cardPages: cardPages)
        let batch = Array(open.prefix(maxChunksPerRun))
        var outcome = Outcome(remaining: open.count)
        var fronts = existingFronts
        for (index, chunk) in batch.enumerated() {
            progress(index, batch.count)
            if Task.isCancelled {
                outcome.failure = "Abgebrochen."
                return outcome
            }
            do {
                let written = try await writer.flashcards(
                    title: title, summary: "", pagesLabel: chunk.pagesLabel, pages: "<pages \(chunk.pagesLabel)>\n\(chunk.text)\n</pages>"
                )
                let cards = fresh(written, existingFronts: fronts, page: chunk.firstPage)
                fronts += cards.map(\.front)
                outcome.cards += cards
                outcome.done += 1
                outcome.remaining -= 1
            } catch {
                outcome.failure = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                return outcome
            }
        }
        progress(batch.count, batch.count)
        return outcome
    }
}
