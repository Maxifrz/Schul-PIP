import Foundation

/// Building blocks of the components added after the first fifteen. They size text with the theme's font widths, so
/// what is drawn fits in the theme it is drawn for.
extension LayoutKit {
    /// A text box whose size is the largest from `max` down to `min` that fits, for the theme's heading or body font.
    /// The font is always set explicitly, so drawing and export agree on which one is meant.
    static func fitted(
        _ value: String, _ x: Double, _ y: Double, _ width: Double, _ height: Double, max: Double, min: Double, theme: SlideTheme,
        heading: Bool = false, bold: Bool = false, italic: Bool = false, bullets: Bool = false,
        align: SlideTextAlign = .left, anchor: TextAnchor = .top, color: String = "text"
    ) -> SlideElement {
        let factor = heading ? theme.headingWidth : theme.bodyWidth
        let size = fitSize(value, width, height, max, min, bold: bold, bullets: bullets, italic: italic, widthFactor: factor)
        return text(value, x, y, width, height, size, bold: bold, italic: italic, align: align, anchor: anchor, bullets: bullets, color: color, font: heading ? "heading" : "body")
    }

    /// The slide heading with the accent rule below, sized for the theme.
    static func heading(_ title: String, theme: SlideTheme) -> [SlideElement] {
        [
            fitted(title, margin, 30, contentWidth, 90, max: 36, min: 24, theme: theme, heading: true, bold: true, anchor: .bottom),
            SlideElement(kind: .shape, x: margin, y: 128, width: 56, height: 5, shape: .rect, fill: "accent"),
        ]
    }

    /// A numbered circle, like the cards' and steps' badges but sized freely.
    static func numberBadge(_ label: String, _ x: Double, _ y: Double, size: Double, theme: SlideTheme) -> [SlideElement] {
        [
            SlideElement(kind: .shape, x: x, y: y, width: size, height: size, shape: .ellipse, fill: "accent"),
            fitted(label, x, y, size, size, max: 20, min: 10, theme: theme, bold: true, align: .center, anchor: .middle, color: "background"),
        ]
    }

    /// Spacing of a density family: compact sets things closer together.
    struct Metrics {
        let gap: Double
        let pad: Double

        init(_ params: ComponentParams) {
            let compact = params[DeckRhythm.densityParameter] == DensityFamily.compact.rawValue
            gap = compact ? 16 : 32
            pad = compact ? 14 : 22
        }
    }

    static let densityParameter = ComponentParameter(
        name: DeckRhythm.densityParameter, label: "Dichte", values: DensityFamily.allCases.map(\.rawValue), defaultValue: DensityFamily.airy.rawValue
    )
}
