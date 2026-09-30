import Foundation

/// The sections of the module library.
enum ModuleGroup: String, CaseIterable {
    case diagrams, distributions, flows, special, composite, structure, data, comparison, text

    var label: String {
        switch self {
        case .diagrams: return "Diagramme"
        case .distributions: return "Verteilung und Zusammenhang"
        case .flows: return "Flüsse und Hierarchien"
        case .special: return "Karten, Netze und Text"
        case .composite: return "Dashboard und Infografik"
        case .structure: return "Ablauf und Struktur"
        case .data: return "Zahlen und Daten"
        case .comparison: return "Vergleich"
        case .text: return "Text"
        }
    }

    /// The section a slide component goes to; opening and picture slides are no modules.
    init?(_ category: ComponentCategory) {
        switch category {
        case .structure: self = .structure
        case .data: self = .data
        case .comparison: self = .comparison
        case .text: self = .text
        case .opening, .visual: return nil
        }
    }
}

/// A building block of the library: diagrams, slide components without their title, and whole arrangements. Its parts
/// are ordinary shapes, texts and diagrams tied together by a group id, so a dropped module moves as one and every
/// part can still be edited.
struct SlideModule: Identifiable {
    let id: String
    let label: String
    let group: ModuleGroup
    /// What it shows, for the search.
    let summary: String
    /// The size it has when it lands on a slide; a little smaller when the slide has less room.
    var landing: (width: Double, height: Double) = SlideModules.landingSize
    /// The parts at their natural size and place; placing scales them.
    let build: (SlideTheme) -> [SlideElement]
}

enum SlideModules {
    /// Space above this line is a component's heading and its accent bar.
    private static let headingBottom: Double = 136
    /// The widest and highest an ordinary module is when it lands.
    static let landingSize = (width: 560.0, height: 340.0)

    /// Every module, in the order of the gallery: diagrams first, then the arrangements, then the slide components.
    static let all: [SlideModule] = diagramModules + compositeModules + componentModules

    static var groups: [ModuleGroup] {
        ModuleGroup.allCases.filter { group in all.contains { $0.group == group } }
    }

    static func modules(in group: ModuleGroup) -> [SlideModule] {
        all.filter { $0.group == group }
    }

    static func module(id: String) -> SlideModule? {
        all.first { $0.id == id }
    }

    // MARK: The modules

    private static var diagramModules: [SlideModule] {
        ChartType.allCases.map { type in
            SlideModule(
                id: "chart-" + type.rawValue, label: type.label, group: type.group, summary: type.summary,
                landing: type.naturalSize,
                build: { _ in
                    [SlideElement(kind: .chart, x: 0, y: 0, width: type.naturalSize.width, height: type.naturalSize.height, chart: ChartSpec(type: type))]
                }
            )
        }
    }

    private static var compositeModules: [SlideModule] {
        [
            SlideModule(id: "composite-dashboard", label: "Dashboard", group: .composite, summary: "Kennzahlen und mehrere Diagramme auf einen Blick", landing: (860, 440), build: { _ in dashboard() }),
            SlideModule(id: "composite-infographic", label: "Infografik", group: .composite, summary: "Aussage, Diagramm, Symbole und Zahlen zu einer Geschichte", landing: (860, 440), build: { _ in infographic() }),
        ]
    }

    /// The slide components that make sense without a slide of their own: no opening slides, no picture slides, no blank.
    private static var componentModules: [SlideModule] {
        ComponentRegistry.all.compactMap { component in
            guard let group = ModuleGroup(component.category), !component.accepts.needsImage,
                  component.id != "blank", component.id != "statement",
                  !body(of: component, theme: .quill).isEmpty
            else { return nil }
            return SlideModule(id: component.id, label: component.label, group: group, summary: component.summary, build: { theme in body(of: component, theme: theme) })
        }
    }

    /// The component's sample content without the heading and its accent bar.
    static func body(of component: SlideComponent, theme: SlideTheme) -> [SlideElement] {
        let draft = ComponentRegistry.sampleDraft(component)
        let built = ComponentRegistry.build(draft, componentID: component.id, image: nil, theme: theme, placeholder: true)
        return built.elements.filter { $0.y + $0.height > headingBottom }
    }

    // MARK: Arrangements

    private static func text(_ value: String, _ x: Double, _ y: Double, _ width: Double, _ height: Double, size: Double, bold: Bool = false, color: String = "text", align: SlideTextAlign = .left, anchor: TextAnchor = .top, font: String = "body") -> SlideElement {
        SlideElement(kind: .text, x: x, y: y, width: width, height: height, text: value, fontSize: size, bold: bold, align: align, anchor: anchor, textColor: color, font: font)
    }

    private static func chart(_ type: ChartType, _ x: Double, _ y: Double, _ width: Double, _ height: Double, title: String, data: String, unit: String = "") -> SlideElement {
        SlideElement(kind: .chart, x: x, y: y, width: width, height: height, chart: ChartSpec(type: type, data: data, unit: unit, title: title))
    }

    /// Three key figures over three diagrams, each on a card.
    static func dashboard() -> [SlideElement] {
        var parts: [SlideElement] = []
        let tile = 280.0
        let gap = 20.0
        let figures = [("128", "Teilnehmende"), ("4,6", "Zufriedenheit von 5"), ("+18 %", "zum Vorjahr")]
        for (index, figure) in figures.enumerated() {
            let x = Double(index) * (tile + gap)
            parts.append(SlideElement(kind: .shape, x: x, y: 0, width: tile, height: 104, shape: .rounded, fill: "surface"))
            parts.append(text(figure.0, x + 18, 8, tile - 36, 58, size: 40, bold: true, color: "accent", anchor: .middle, font: "heading"))
            parts.append(text(figure.1, x + 18, 66, tile - 36, 30, size: 16, color: "muted"))
        }
        let cards: [(ChartType, String, String, String)] = [
            (.column, "Teilnehmende je Tag", "Mo; 12\nDi; 18\nMi; 15\nDo; 24\nFr; 19", ""),
            (.donut, "Herkunft", "Schule; 52\nOnline; 31\nEmpfehlung; 17", ""),
            (.line, "Zufriedenheit", "Sep; 3,8\nOkt; 4,0\nNov; 4,2\nDez; 4,1\nJan; 4,6", ""),
        ]
        for (index, card) in cards.enumerated() {
            let x = Double(index) * (tile + gap)
            parts.append(SlideElement(kind: .shape, x: x, y: 124, width: tile, height: 316, shape: .rounded, fill: "surface"))
            parts.append(chart(card.0, x + 14, 136, tile - 28, 292, title: card.1, data: card.2, unit: card.3))
        }
        return group(parts)
    }

    /// A statement with a diagram, and three numbers with symbols: a small story.
    static func infographic() -> [SlideElement] {
        var parts: [SlideElement] = []
        parts.append(text("So lernen Jugendliche heute", 0, 0, 400, 112, size: 34, bold: true, anchor: .bottom, font: "heading"))
        parts.append(SlideElement(kind: .shape, x: 0, y: 122, width: 56, height: 5, shape: .rect, fill: "accent"))
        parts.append(chart(.donut, 0, 146, 400, 310, title: "Wo gelernt wird", data: "Zu Hause; 46\nIn der Schule; 28\nUnterwegs; 14\nBei Freunden; 12", unit: ""))
        let rows = [("📱", "72 %", "nutzen Lern-Apps mindestens einmal pro Woche"), ("📚", "3,4 h", "Hausaufgaben und Lernen pro Tag im Schnitt"), ("👥", "1 von 3", "lernt regelmäßig mit anderen zusammen")]
        for (index, row) in rows.enumerated() {
            let y = Double(index) * 152
            parts.append(SlideElement(kind: .shape, x: 450, y: y + 12, width: 76, height: 76, shape: .ellipse, fill: "accent"))
            parts.append(text(row.0, 450, y + 12, 76, 76, size: 34, align: .center, anchor: .middle))
            parts.append(text(row.1, 550, y, 330, 60, size: 44, bold: true, color: "accent", anchor: .middle, font: "heading"))
            parts.append(text(row.2, 550, y + 62, 330, 70, size: 18, color: "muted"))
        }
        return group(parts)
    }

    private static func group(_ parts: [SlideElement]) -> [SlideElement] {
        let id = UUID().uuidString
        return parts.map { element in
            var grouped = element
            grouped.group = id
            return grouped
        }
    }

    // MARK: Placing

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

    /// The module ready to be put on a slide: scaled to `size` at most (its own landing size by default), its middle at
    /// `center` but kept inside the slide, with fresh ids and one group id.
    static func elements(for module: SlideModule, theme: SlideTheme, center: (x: Double, y: Double)? = nil, size: (width: Double, height: Double)? = nil) -> [SlideElement] {
        place(module.build(theme), center: center, size: size ?? module.landing)
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
    static func preview(of module: SlideModule, theme: SlideTheme) -> Slide {
        let elements = place(module.build(theme), center: nil, size: (width: SlideSize.width - 96, height: SlideSize.height - 96))
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
