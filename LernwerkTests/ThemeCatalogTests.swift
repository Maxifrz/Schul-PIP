import XCTest
@testable import Lernwerk

final class ThemeCatalogTests: XCTestCase {
    private func contrast(_ a: UInt32, _ b: UInt32) -> Double {
        func luminance(_ rgb: UInt32) -> Double {
            let channels = [16, 8, 0].map { Double((rgb >> UInt32($0)) & 0xFF) / 255 }
            let linear = channels.map { $0 <= 0.03928 ? $0 / 12.92 : pow(($0 + 0.055) / 1.055, 2.4) }
            return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
        }
        let (x, y) = (luminance(a), luminance(b))
        return (max(x, y) + 0.05) / (min(x, y) + 0.05)
    }

    func testCatalogHasEightMoreDesignsWithUniqueIDs() {
        XCTAssertEqual(DesignCatalog.additional.map(\.id), ["pergament", "ozean", "terminal", "koralle", "lavendel", "kontrast", "zeitung", "minze"])
        let ids = SlideTheme.all.map(\.id)
        XCTAssertEqual(Set(ids).count, ids.count)
        XCTAssertEqual(SlideTheme.all.suffix(8).map(\.id), DesignCatalog.additional.map(\.id))
    }

    func testEveryDesignIsReadable() {
        // The first seventeen keep their colors; text on their surface has always needed only 6.5 (SlideDesignTests).
        for theme in SlideTheme.all { XCTAssertGreaterThanOrEqual(contrast(theme.text, theme.background), 7, "\(theme.id) text") }
        // The catalog's own rule is stricter: text on both grounds, muted text and the accent hold up too.
        for theme in DesignCatalog.additional {
            XCTAssertGreaterThanOrEqual(contrast(theme.text, theme.surface), 7, "\(theme.id) text on surface")
            for ground in [theme.background, theme.surface] {
                XCTAssertGreaterThanOrEqual(contrast(theme.muted, ground), 4.5, "\(theme.id) muted")
            }
            XCTAssertGreaterThanOrEqual(contrast(theme.accent, theme.background), 4.5, "\(theme.id) accent")
        }
    }

    func testFontsCornersAndColorsAsSpecified() {
        XCTAssertEqual(SlideTheme.byID("pergament").heading, .georgia)
        XCTAssertEqual(SlideTheme.byID("pergament").cornerScale, 0.5)
        XCTAssertEqual(SlideTheme.byID("terminal").body, .courier)
        XCTAssertEqual(SlideTheme.byID("terminal").cornerScale, 0)
        XCTAssertEqual(SlideTheme.byID("lavendel").cornerScale, 1.4)
        XCTAssertEqual(SlideTheme.byID("zeitung").body, .georgia)
        XCTAssertEqual(SlideTheme.byID("minze").muted, 0x4A6B65)
        XCTAssertEqual(SlideTheme.byID("kontrast").accent, 0xFFD400)
        // The original designs keep their corners.
        for theme in SlideTheme.all.prefix(17) { XCTAssertEqual(theme.cornerScale, 1, theme.id) }
    }

    func testSystemFontsAreNotBundledAndHaveRealBoldItalicCuts() {
        XCTAssertEqual(SlideFont.files.count, 12)
        XCTAssertFalse(SlideFont.files.contains("Georgia"))
        XCTAssertEqual(SlideFont.georgia.boldItalic, "Georgia-BoldItalic")
        XCTAssertEqual(SlideFont.courier.bold, "CourierNewPS-BoldMT")
        XCTAssertEqual(SlideFont.courier.regular, "CourierNewPSMT")
        XCTAssertTrue(SlideFont.georgia.hasBoldItalic)
        XCTAssertFalse(SlideFont.montserrat.hasBoldItalic)
        XCTAssertEqual(SlideFont.georgia.pptxName, "Georgia")
        XCTAssertEqual(SlideFont.courier.pptxName, "Courier New")
        let text = SlideElement(kind: .text, x: 0, y: 0, width: 100, height: 40, text: "x", fontSize: 20, bold: true, italic: true)
        XCTAssertEqual(SlideDesign.fontName(text, theme: SlideTheme.byID("zeitung")), "Georgia-BoldItalic")
        XCTAssertEqual(SlideDesign.fontName(text, theme: .nova), "DMSans-Italic")
        XCTAssertEqual(SlideDesign.fontSize(text, theme: SlideTheme.byID("terminal")), 20)
    }

    func testWidthFactorMakesTextFitSmaller() {
        let text = String(repeating: "Wortwahl ", count: 30)
        let plain = SlideLayouts.fitSize(text, 400, 120, 30, 10)
        XCTAssertEqual(plain, SlideLayouts.fitSize(text, 400, 120, 30, 10, widthFactor: 1))
        XCTAssertLessThan(SlideLayouts.fitSize(text, 400, 120, 30, 10, widthFactor: 1.12), plain)
        XCTAssertEqual(SlideTheme.byID("terminal").bodyWidth, 1.12)
        XCTAssertEqual(SlideTheme.quill.bodyWidth, 1)
        XCTAssertGreaterThan(SlideLayouts.lineCount(text, 400, 20, bold: false, widthFactor: 1.12), SlideLayouts.lineCount(text, 400, 20, bold: false))
    }

    func testPptxWritesTheDesignsFontsAndCorners() {
        let cards = SlideLayouts.preset(.cards)
        func xml(_ theme: SlideTheme) -> String {
            String(decoding: PptxWriter.write(Presentation(title: "T", themeId: theme.id, slides: [cards])) { _ in nil }, as: UTF8.self)
        }
        let terminal = xml(SlideTheme.byID("terminal"))
        XCTAssertTrue(terminal.contains(#"typeface="Courier New""#))
        XCTAssertFalse(terminal.contains("roundRect"))
        let lavender = xml(SlideTheme.byID("lavendel"))
        XCTAssertTrue(lavender.contains(#"<a:gd name="adj" fmla="val 23334"/>"#))
        let parchment = xml(SlideTheme.byID("pergament"))
        XCTAssertTrue(parchment.contains(#"typeface="Georgia""#))
        XCTAssertTrue(parchment.contains(#"fmla="val 8334""#))
        // The usual corner is written as before.
        let plain = xml(.quill)
        XCTAssertTrue(plain.contains(#"<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>"#))
        XCTAssertEqual(SlideTheme.byID("lavendel").cornerFraction, 0.16667 * 1.4, accuracy: 1e-9)
    }

    func testEditsSchemaAndRulesListEveryDesign() {
        XCTAssertTrue(PresentationEdits.chatSystem.contains("kreide"))
        XCTAssertTrue(PresentationEdits.chatSystem.contains("zeitung"))
        XCTAssertTrue(String(describing: PresentationEdits.chatSchema).contains("minze"))
        let change = SlideChange(action: .setTheme, theme: "ozean")
        let result = PresentationEdits.apply(Presentation(title: "T", slides: [Slide()]), [change])
        XCTAssertEqual(result.presentation.themeId, "ozean")
    }

    func testAutomaticDesignStillFollowsTheOldSubjects() {
        XCTAssertEqual(SlideDesign.suggest("Photosynthese in der Biologie"), "verdant")
        XCTAssertEqual(SlideDesign.suggest("Programmieren und IT-Sicherheit"), "terminal")
        XCTAssertEqual(SlideDesign.suggest("Meeresbiologie im Ozean: Klima und Wasser"), "ozean")
    }
}
