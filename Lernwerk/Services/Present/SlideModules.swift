import Foundation

/// The module library: the slide components as building blocks that are dropped onto a slide, without their title,
/// at any place and size. A module is the component's sample drawn as ordinary shapes and texts, tied together by a
/// group id so it moves as one; everything in it can still be edited.
enum SlideModules {
    /// Space above this line is the component's heading and its accent bar.
    private static let headingBottom: Double = 136
    /// The widest and highest a module is when it lands.
    static let landingSize = (width: 560.0, height: 340.0)

    /// The components that make sense without a slide of their own: no opening slides, no picture slides and no blank.
    static var all: [SlideComponent] {
        ComponentRegistry.all.filter { component in
            !component.accepts.needsImage
                && component.category != .opening
                && component.id != "blank"
                && component.id != "statement"
                && !body(of: component, theme: .quill).isEmpty
        }
    }

    static var categories: [ComponentCategory] {
        ComponentCategory.allCases.filter { category in all.contains { $0.category == category } }
    }

    static func modules(in category: ComponentCategory) -> [SlideComponent] {
        all.filter { $0.category == category }
    }

    /// The component's sample content without the heading and its accent bar.
    static func body(of component: SlideComponent, theme: SlideTheme) -> [SlideElement] {
        let draft = ComponentRegistry.sampleDraft(component)
        let built = ComponentRegistry.build(draft, componentID: component.id, image: nil, theme: theme, placeholder: true)
        return built.elements.filter { $0.y + $0.height > headingBottom }
    }

    /// The frame around a set of elements.
    static func bounds(of elements: [SlideElement]) -> (x: Double, y: Double, width: Double, height: Double)? {
        guard let first = elements.first else { return nil }
        var minX = first.x, minY = first.y, maxX = first.x + first.width, maxY = first.y + first.height
        for element in elements {
            minX = min(minX, element.x)
            minY = min(minY, element.y)
            maxX = max(maxX, element.x + element.width)
            maxY = max(maxY, element.y + element.height)
        }
        return (minX, minY, maxX - minX, maxY - minY)
    }

    /// The module ready to be put on a slide: scaled to `size` at most, its middle at `center` but kept inside the
    /// slide, with fresh ids and one group id.
    static func elements(
        for component: SlideComponent, theme: SlideTheme, center: (x: Double, y: Double)? = nil,
        size: (width: Double, height: Double) = landingSize
    ) -> [SlideElement] {
        place(body(of: component, theme: theme), center: center, size: size)
    }

    static func place(_ source: [SlideElement], center: (x: Double, y: Double)?, size: (width: Double, height: Double)) -> [SlideElement] {
        guard let box = bounds(of: source), box.width > 0, box.height > 0 else { return [] }
        let scale = min(size.width / box.width, size.height / box.height)
        let width = box.width * scale
        let height = box.height * scale
        let middle = center ?? (x: SlideSize.width / 2, y: SlideSize.height / 2)
        let left = min(max(middle.x - width / 2, 16), max(16, SlideSize.width - width - 16))
        let top = min(max(middle.y - height / 2, 16), max(16, SlideSize.height - height - 16))
        let group = UUID().uuidString
        return source.map { element in
            var placed = element
            placed.id = UUID().uuidString
            placed.group = group
            placed.x = left + (element.x - box.x) * scale
            placed.y = top + (element.y - box.y) * scale
            placed.width = element.width * scale
            placed.height = element.height * scale
            if element.kind == .text { placed.fontSize = max(8, element.fontSize * scale) }
            placed.strokeWidth = element.strokeWidth * scale
            placed.animation = nil
            return placed
        }
    }

    /// A slide showing the module as large as it fits, for the gallery's preview.
    static func preview(of component: SlideComponent, theme: SlideTheme) -> Slide {
        let elements = place(body(of: component, theme: theme), center: nil, size: (width: SlideSize.width - 96, height: SlideSize.height - 96))
        return Slide(elements: elements)
    }

    /// The same elements bigger or smaller around their middle, for the "Modul größer/kleiner" buttons.
    static func scaled(_ elements: [SlideElement], by factor: Double) -> [SlideElement] {
        guard let box = bounds(of: elements), factor > 0 else { return elements }
        let cx = box.x + box.width / 2
        let cy = box.y + box.height / 2
        // Never smaller than a thumbnail or larger than the slide.
        let limited = min(max(factor, 40 / max(box.width, 1)), (SlideSize.width * 1.2) / max(box.width, 1))
        return elements.map { element in
            var moved = element
            moved.x = cx + (element.x - cx) * limited
            moved.y = cy + (element.y - cy) * limited
            moved.width = element.width * limited
            moved.height = element.height * limited
            if element.kind == .text { moved.fontSize = max(6, element.fontSize * limited) }
            moved.strokeWidth = element.strokeWidth * limited
            return moved
        }
    }
}
