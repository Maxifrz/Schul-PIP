import Foundation

/// One slide on its way to being built: its content, its picture and the component chosen for it.
struct SlideChoice: Equatable {
    var draft: SlideDraft
    var image: PlacedImage?
    var componentID: String
    var params: ComponentParams
    var role = ""
}

/// How closely a deck is set: one family for all slides, chosen once from how much text the deck has.
enum DensityFamily: String, CaseIterable {
    case compact, airy

    var label: String { self == .compact ? "kompakt" : "luftig" }
}

/// Makes a run of chosen components a deck: it starts with a title, no component is used three times in a row, and
/// every component that has a `density` parameter gets the deck's family. Only swaps components, never content.
enum DeckRhythm {
    static let densityParameter = "density"
    /// Average characters of text per slide above which a deck is set compactly.
    static let compactFrom = 200.0

    static func characters(_ draft: SlideDraft) -> Int {
        var strings: [String] = [draft.subtitle, draft.leftTitle, draft.rightTitle, draft.quote, draft.value]
        strings += draft.bullets
        strings += draft.left
        strings += draft.right
        strings += draft.items.flatMap { [$0.title, $0.text] }
        strings += draft.table.flatMap { $0 }
        var total = 0
        for text in strings { total += text.trimmingCharacters(in: .whitespacesAndNewlines).count }
        return total
    }

    static func family(_ drafts: [SlideDraft]) -> DensityFamily {
        guard !drafts.isEmpty else { return .airy }
        let average = Double(drafts.reduce(0) { $0 + characters($1) }) / Double(drafts.count)
        return average >= compactFrom ? .compact : .airy
    }

    struct Result: Equatable {
        var slides: [SlideChoice]
        var family: DensityFamily
        var log: [String]
    }

    static func refine(_ choices: [SlideChoice], deckTitle: String) -> Result {
        var slides = choices
        var log: [String] = []
        let family = family(choices.map(\.draft))
        guard !slides.isEmpty else { return Result(slides: [], family: family, log: []) }

        // 1. The first slide is a title.
        let titleID = SlideLayout.title.componentID
        if slides[0].componentID != titleID {
            let title = deckTitle.isBlank ? slides[0].draft.title : deckTitle.trimmingCharacters(in: .whitespacesAndNewlines)
            slides.insert(SlideChoice(draft: SlideDraft(layout: .title, title: title), image: nil, componentID: titleID, params: [:], role: "title"), at: 0)
            log.append("Titelfolie vorangestellt.")
        }

        // 2. No component three times in a row: the third gets the next best candidate.
        var index = 2
        while index < slides.count {
            let id = slides[index].componentID
            if slides[index - 1].componentID == id && slides[index - 2].componentID == id {
                let slide = slides[index]
                let form = ComponentSelector.form(of: slide.draft, role: slide.role, hasImage: slide.image != nil)
                let recent = slides[max(0, index - 2)..<index].map(\.componentID)
                let following = index + 1 < slides.count ? slides[index + 1].componentID : nil
                let alternative = ComponentSelector.candidates(for: form, recent: recent, limit: ComponentRegistry.all.count).first {
                    $0.id != id && $0.id != following && $0.covers(slide.draft) && $0.fits(slide.draft, image: slide.image)
                }
                if let alternative {
                    slides[index].componentID = alternative.id
                    slides[index].params = [:]
                    log.append("Folie \(index + 1): „\(alternative.id)“ statt dreimal „\(id)“.")
                } else {
                    log.append("Folie \(index + 1): keine Alternative zu „\(id)“.")
                }
            }
            index += 1
        }

        // 3. One family for the whole deck.
        for i in slides.indices {
            guard let component = ComponentRegistry.component(slides[i].componentID),
                  component.parameters.contains(where: { $0.name == densityParameter && $0.values.contains(family.rawValue) })
            else { continue }
            slides[i].params[densityParameter] = family.rawValue
        }
        return Result(slides: slides, family: family, log: log)
    }
}
