import SwiftUI

/// Wrong answers from the tutor model for the cards of a material, fetched in the background while its path is open and
/// never during a lesson. Without a key, offline or on any error the cards are simply typed. The demo's answers are
/// about the chain rule, so they stay in memory for this launch and never reach the cache of the student's own cards.
@MainActor
final class DistractorFetcher: ObservableObject {
    @Published private(set) var distractors: [String: [String]] = [:]

    /// Cards asked about since launch, so the model is asked about a card at most once per launch.
    private static var askedThisLaunch: Set<String> = []
    /// Wrong answers the demo wrote this launch, kept out of the persistent cache.
    private static var demoDistractors: [String: [String]] = [:]

    func refresh(deck: [CardSnapshot], settings: AppSettings) async {
        let cache = DistractorCache()
        let demo = settings.demoMode
        distractors = known(cache, demo: demo)
        guard deck.count >= LearnPath.minimumCards, demo || settings.hasKey(for: settings.tutor.provider) else { return }
        let asked = { (key: String) in demo ? "demo:" + key : key }
        // Comparing every card with the others takes a moment on a big deck; it runs off the main thread.
        let needing = await Task.detached(priority: .utility) { ExerciseBuilder.cardsNeedingDistractors(in: deck) }.value
        guard !Task.isCancelled else { return }
        let wanted = needing.filter { distractors[$0.key] == nil && !DistractorFetcher.askedThisLaunch.contains(asked($0.key)) }
        guard !wanted.isEmpty else { return }
        let keys = Set(wanted.map { asked($0.key) })
        DistractorFetcher.askedThisLaunch.formUnion(keys)
        let service = DistractorService(client: settings.makeClient(for: .tutor), cache: cache)
        let fetched = await service.fetch(for: wanted, persist: !demo)
        if demo { DistractorFetcher.demoDistractors.merge(fetched) { _, new in new } }
        if Task.isCancelled {
            // Leaving the path cancels the request; the cards it got no answer for may be asked again next time.
            DistractorFetcher.askedThisLaunch.subtract(keys.subtracting(fetched.keys.map(asked)))
            return
        }
        cache.prune(keeping: Set(deck.map(\.key)))
        distractors = known(cache, demo: demo)
    }

    private func known(_ cache: DistractorCache, demo: Bool) -> [String: [String]] {
        demo ? cache.all().merging(DistractorFetcher.demoDistractors) { own, _ in own } : cache.all()
    }
}
