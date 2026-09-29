import XCTest
@testable import Lernwerk

final class SlideDesignTests: XCTestCase {
    private func contrast(_ a: UInt32, _ b: UInt32) -> Double {
        func luminance(_ rgb: UInt32) -> Double {
            let channels = [16, 8, 0].map { Double((rgb >> UInt32($0)) & 0xFF) / 255 }
            let linear = channels.map { $0 <= 0.03928 ? $0 / 12.92 : pow(($0 + 0.055) / 1.055, 2.4) }
            return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
        }
        let (x, y) = (luminance(a), luminance(b))
        return (max(x, y) + 0.05) / (min(x, y) + 0.05)
    }

    private func intersects(_ element: SlideElement, _ x: Double, _ y: Double, _ width: Double, _ height: Double) -> Bool {
        element.x < x + width && element.x + element.width > x && element.y < y + height && element.y + element.height > y
    }

    func testMixMatchesTheAndroidApp() {
        XCTAssertEqual(SlideDesign.mix(0xFFFFFF, 0x000000, 50), 0x808080)
        XCTAssertEqual(SlideDesign.mix(0xF7F5F0, 0x155F99, 14), 0xD7E0E4)
        XCTAssertEqual(SlideDesign.mix(0x0B1A2E, 0x5B9BE6, 8), 0x11243D)
        XCTAssertEqual(SlideDesign.hex(0x0A0B0C), "#0A0B0C")
    }

    func testDesignsAreUniqueAndReadable() {
        let ids = SlideTheme.all.map(\.id)
        XCTAssertEqual(Set(ids).count, ids.count)
        XCTAssertEqual(SlideTheme.all.count, 25)
        for theme in SlideTheme.all {
            XCTAssertGreaterThanOrEqual(contrast(theme.text, theme.background), 7, theme.id)
            XCTAssertGreaterThanOrEqual(contrast(theme.text, theme.surface), 6.5, theme.id)
            XCTAssertFalse(theme.mood.isEmpty, theme.id)
        }
        // The new designs also use their accent for text and numbers; Quill's soft green predates that rule.
        for theme in SlideTheme.all.dropFirst(4) {
            XCTAssertGreaterThanOrEqual(contrast(theme.accent, theme.background), 4.5, theme.id)
        }
    }

    func testOriginalDesignsKeepTheirLook() {
        for theme in [SlideTheme.quill, .night, .chalk, .paper] {
            XCTAssertEqual(theme.heading, .workSans)
            XCTAssertEqual(theme.body, .workSans)
            XCTAssertTrue(SlideDesign.decor(theme, index: 0).isEmpty)
        }
    }

    func testDecorationsStayClearOfTheContent() {
        for theme in SlideTheme.all {
            for element in SlideDesign.decor(theme, index: 0) where element.fill == "accent" {
                XCTAssertFalse(intersects(element, 100, 140, 760, 290), "\(theme.id) title \(element.id)")
            }
            for element in SlideDesign.decor(theme, index: 3) {
                // Solid shapes keep to the edges; tinted ones may reach behind text but never cover the middle.
                if element.fill == "accent" { XCTAssertFalse(intersects(element, 64, 30, 832, 460), "\(theme.id) \(element.id)") }
                if element.fill != "none" { XCTAssertFalse(element.contains(480, 300), "\(theme.id) \(element.id)") }
            }
        }
        XCTAssertEqual(SlideDesign.decor(.editorial, index: 0).count, 3)
        XCTAssertEqual(SlideDesign.decor(.editorial, index: 5).count, 1)
        XCTAssertEqual(SlideDesign.decor(.editorial, index: 5)[0].stroke, SlideDesign.hex(SlideDesign.mix(0xF7F5F0, 0x155F99, 40)))
    }

    func testHeadingsUseTheHeadingFontAtAMatchingSize() {
        let title = SlideElement(kind: .text, x: 0, y: 0, width: 100, height: 50, text: "T", fontSize: 36, bold: true, font: "heading")
        let body = SlideElement(kind: .text, x: 0, y: 0, width: 100, height: 50, text: "B", fontSize: 24)
        let italic = SlideElement(kind: .text, x: 0, y: 0, width: 100, height: 50, text: "I", fontSize: 24, italic: true)
        let oldTitle = SlideElement(kind: .text, x: 0, y: 0, width: 100, height: 50, text: "T", fontSize: 40, bold: true)
        XCTAssertEqual(SlideDesign.fontName(title, theme: .editorial), "PlayfairDisplay-Bold")
        XCTAssertEqual(SlideDesign.fontSize(title, theme: .editorial), 33.48)
        XCTAssertEqual(SlideDesign.fontName(body, theme: .editorial), "DMSans-Regular")
        XCTAssertEqual(SlideDesign.fontSize(body, theme: .editorial), 22.8)
        XCTAssertEqual(SlideDesign.fontName(italic, theme: .editorial), "DMSans-Italic")
        XCTAssertEqual(SlideDesign.fontName(oldTitle, theme: .nova), "Montserrat-Bold")
        XCTAssertEqual(SlideDesign.fontName(title, theme: .quill), "WorkSans-SemiBold")
        XCTAssertEqual(SlideDesign.fontSize(body, theme: .quill), 24)
        XCTAssertTrue(SlideFont.files.contains("ArchivoBlack-Regular"))
        XCTAssertEqual(SlideFont.files.count, 12)
    }

    func testLayoutsMarkTitlesAsHeadings() {
        let slide = SlideLayouts.build(SlideDraft(layout: .bullets, title: "Titel", bullets: ["a", "b"]))
        XCTAssertEqual(slide.first { $0.kind == .text }?.font, "heading")
        XCTAssertEqual(slide.last { $0.kind == .text }?.font, "")
    }

    func testAutomaticDesignFollowsTheSubject() {
        XCTAssertEqual(SlideDesign.suggest("Photosynthese in der Biologie"), "verdant")
        XCTAssertEqual(SlideDesign.suggest("Schwarze Löcher – Astronomie und Physik"), "nova")
        XCTAssertEqual(SlideDesign.suggest("Irgendwas"), "quill")
        XCTAssertEqual(SlideDesign.resolve(" NOVA ", fallback: "Biologie"), "nova")
        XCTAssertEqual(SlideDesign.resolve("unbekannt", fallback: "Biologie"), "verdant")
        XCTAssertTrue(PresentationPrompt.designInstructions.contains("- verdant: Verdant – Biologie"))
        let outline = PresentationPrompt.parseOutline(#"{"title":"T","thesis":"X","design":"glut","slides":[{"role":"r","message":"m","layout":"TITLE","content":""}]}"#)
        XCTAssertEqual(outline?.design, "glut")
    }

    func testPptxUsesTheDesignFontsAndDecorations() {
        let presentation = Presentation(title: "T", themeId: SlideTheme.editorial.id, slides: [SlideLayouts.preset(.title), SlideLayouts.preset(.bullets)])
        let text = String(decoding: PptxWriter.write(presentation) { _ in nil }, as: UTF8.self)
        XCTAssertTrue(text.contains(#"typeface="Playfair Display""#))
        XCTAssertTrue(text.contains(#"typeface="DM Sans""#))
        XCTAssertTrue(text.contains("<a:lnSpc><a:spcPts"))
        let plain = String(decoding: PptxWriter.write(Presentation(title: "T", slides: [SlideLayouts.preset(.title)])) { _ in nil }, as: UTF8.self)
        XCTAssertFalse(plain.contains("<a:lnSpc>"))
        XCTAssertTrue(plain.contains(#"typeface="Work Sans""#))
    }
}
