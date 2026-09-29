import Foundation

/// Shrinks text that overflows its box, and nothing else. Text that fits is never touched, so a slide that was fine
/// stays byte-for-byte the same. Never goes below `minimumSize`; text that still overflows there is left for the
/// student to see rather than cut.
enum SlideAutoFit {
    static let minimumSize: Double = 10

    static func overflows(_ element: SlideElement, theme: SlideTheme) -> Bool {
        guard element.kind == .text, !element.text.isBlank else { return false }
        return !SlideLayouts.fits(
            element.text, element.width, element.height, element.fontSize, bold: element.bold || element.italic,
            bullets: element.bullets, widthFactor: widthFactor(element, theme: theme)
        )
    }

    private static func widthFactor(_ element: SlideElement, theme: SlideTheme) -> Double {
        SlideDesign.isHeading(element) ? theme.headingWidth : theme.bodyWidth
    }

    static func fit(_ element: SlideElement, theme: SlideTheme) -> SlideElement {
        guard overflows(element, theme: theme) else { return element }
        var result = element
        while result.fontSize > minimumSize && overflows(result, theme: theme) { result.fontSize -= 1 }
        result.fontSize = max(minimumSize, result.fontSize)
        return result
    }

    static func fit(_ slide: Slide, theme: SlideTheme) -> Slide {
        var result = slide
        result.elements = slide.elements.map { fit($0, theme: theme) }
        return result
    }

    static func fit(_ presentation: Presentation) -> Presentation {
        let theme = presentation.theme
        var result = presentation
        result.slides = presentation.slides.map { fit($0, theme: theme) }
        return result
    }
}
