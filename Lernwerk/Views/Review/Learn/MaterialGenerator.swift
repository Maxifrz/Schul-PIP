import SwiftData
import SwiftUI

extension TopicAssistant: FlashcardWriting {}

/// Makes the cards of a material by asking the model, stretch by stretch, and puts them into the library of cards, so
/// the material's lessons appear on the path. It runs one material at a time and shows how far it is.
@MainActor
final class MaterialGenerator: ObservableObject {
    enum State: Equatable {
        case idle
        case running(done: Int, total: Int)
        case failed(String)
        case finished(String)
    }

    @Published private(set) var state = State.idle
    /// The material being worked on.
    @Published private(set) var busyID: UUID?

    var isBusy: Bool { busyID != nil }

    func dismissMessage() {
        if case .running = state { return }
        state = .idle
    }

    func generate(material: StudyMaterial, cards: [ReviewCard], context: ModelContext, settings: AppSettings) async {
        guard busyID == nil else { return }
        busyID = material.id
        state = .running(done: 0, total: 1)
        let texts = await MaterialTextIndex.shared.index([material.fileName])[material.fileName] ?? []
        let mine = cards.filter { $0.materialID == material.id }
        let writer = TopicAssistant(client: settings.makeClient(for: .plan))
        let outcome = await MaterialPath.generate(
            title: material.title,
            pageTexts: texts,
            cardPages: Set(mine.compactMap(\.page)),
            existingFronts: mine.map(\.front),
            writer: writer,
            progress: { done, total in
                Task { @MainActor in self.state = .running(done: done, total: max(1, total)) }
            }
        )
        for card in outcome.cards {
            context.insert(ReviewCard(front: card.front, back: card.back, materialID: material.id, page: card.page))
        }
        busyID = nil
        if let failure = outcome.failure, outcome.cards.isEmpty {
            state = .failed(failure)
        } else if outcome.cards.isEmpty {
            state = .failed(
                texts.isEmpty ? "In diesem Material steckt kein lesbarer Text, es ist wohl ein Scan." : "Hier gibt es nichts Neues zu lernen."
            )
        } else if let failure = outcome.failure {
            state = .finished("\(outcome.cards.count) Karten sind entstanden, dann ging es nicht weiter: \(failure)")
        } else if outcome.remaining > 0 {
            state = .finished("\(outcome.cards.count) Karten sind entstanden. Tippe noch einmal, für die restlichen Seiten.")
        } else {
            state = .finished("\(outcome.cards.count) Karten sind entstanden.")
        }
    }
}
