import Foundation

/// One way the same content could look, for "Folie neu gestalten".
struct SlideVariant: Identifiable {
    var componentID: String
    var params: ComponentParams
    var label: String
    /// The slide as it would be after choosing this variant (elements and origin; the rest is the slide's own).
    var slide: Slide

    var id: String { componentID + "|" + params.sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value)" }.joined(separator: ",") }
}

/// Builds other looks for a slide that still has its origin, from the content the origin kept. Every variant is drawn by
/// a component that draws all of that content, so switching never loses text.
enum SlideVariants {
    static let maxVariants = 5
    /// How many other looks of the current component come before other components.
    private static let sameComponent = 2

    /// A comparable form of the elements, without their random ids.
    static func signature(_ elements: [SlideElement]) -> String {
        elements.map { e in
            [
                "\(e.kind)", "\(e.shape)", String(format: "%.2f", e.x), String(format: "%.2f", e.y), String(format: "%.2f", e.width), String(format: "%.2f", e.height),
                String(format: "%.2f", e.fontSize), e.text, e.fill, e.stroke, e.textColor, e.image ?? "", "\(e.bold)", "\(e.italic)", "\(e.align)", "\(e.anchor)",
            ].joined(separator: "|")
        }.joined(separator: "\n")
    }

    static func placedImage(_ slide: Slide) -> PlacedImage? {
        slide.elements.first { $0.kind == .image && $0.image != nil }.map { PlacedImage(name: $0.image ?? "", aspect: $0.width / max(1, $0.height)) }
    }

    /// Every combination of the component's parameter values.
    private static func combinations(_ component: SlideComponent) -> [ComponentParams] {
        var result: [ComponentParams] = [[:]]
        for parameter in component.parameters {
            result = result.flatMap { partial in
                parameter.values.map { value -> ComponentParams in
                    var copy = partial
                    copy[parameter.name] = value
                    return copy
                }
            }
        }
        return result
    }

    /// The name of the first parameter that differs from the slide's own, for the label.
    private static func label(_ component: SlideComponent, _ params: ComponentParams, from own: ComponentParams, changed: Bool) -> String {
        guard changed else { return component.label }
        let differing = component.parameters.first { $0.name != DeckRhythm.densityParameter && params[$0.name] != nil && params[$0.name] != own[$0.name] }
            ?? component.parameters.first { params[$0.name] != nil && params[$0.name] != own[$0.name] }
        guard let differing, let value = params[differing.name] else { return component.label }
        return component.label + " · " + ComponentParameter.valueLabel(value)
    }

    static func variants(for slide: Slide, theme: SlideTheme, limit: Int = maxVariants) -> [SlideVariant] {
        guard let origin = slide.origin else { return [] }
        let draft = origin.draft
        let image = placedImage(slide)
        let density = origin.params[DeckRhythm.densityParameter]
        var seen: Set<String> = [signature(slide.elements)]
        var options: [(component: SlideComponent, params: ComponentParams, changed: Bool)] = []

        if let current = ComponentRegistry.component(origin.componentID) {
            let own = current.resolvedParams(origin.params)
            // Other looks of the same component: those that change its own parameter first, then the density.
            let others = combinations(current).filter { $0 != own }.sorted { a, b in
                func rank(_ params: ComponentParams) -> (Int, Int) {
                    let changed = params.filter { own[$0.key] != $0.value }
                    return (changed.keys.contains(DeckRhythm.densityParameter) ? 1 : 0, changed.count)
                }
                return rank(a) < rank(b)
            }
            options += others.prefix(sameComponent).map { (current, $0, true) }
        }
        let form = ComponentSelector.form(of: draft, hasImage: image != nil)
        for component in ComponentSelector.candidates(for: form, limit: ComponentRegistry.all.count) where component.id != origin.componentID {
            options.append((component, [:], false))
        }

        var result: [SlideVariant] = []
        for option in options {
            guard result.count < limit, option.component.covers(draft), option.component.fits(draft, image: image) else { continue }
            var params = option.params
            // Another component takes over the deck's density; the same component's looks set their own.
            if !option.changed, let density, option.component.parameters.contains(where: { $0.name == DeckRhythm.densityParameter }) {
                params[DeckRhythm.densityParameter] = density
            }
            let built = ComponentRegistry.build(draft, componentID: option.component.id, params: params, image: image, theme: theme)
            guard built.componentID == option.component.id, built.log.isEmpty else { continue }
            guard seen.insert(signature(built.elements)).inserted else { continue }
            var varied = slide
            varied.elements = built.elements
            varied.origin = SlideOrigin(componentID: built.componentID, params: built.params, draft: built.draft)
            result.append(SlideVariant(componentID: built.componentID, params: built.params, label: label(option.component, built.params, from: origin.params, changed: option.changed), slide: varied))
        }
        return result
    }

    /// The slide with the variant's look: its elements and origin, and everything else of the slide kept.
    static func applying(_ variant: SlideVariant, to slide: Slide) -> Slide {
        var result = slide
        result.elements = variant.slide.elements
        result.origin = variant.slide.origin
        return result
    }
}
