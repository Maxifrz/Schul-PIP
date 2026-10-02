import CoreText
import SwiftUI
import UIKit

/// Design tokens of the Quill design system: warm neutrals, one sage accent, light and dark.
enum Quill {
    static let bg = Color(QuillUIColor.bg)
    static let surface = Color(QuillUIColor.surface)
    static let ink = Color(QuillUIColor.ink)
    static let ink2 = Color(QuillUIColor.ink2)
    static let muted = Color(QuillUIColor.muted)
    static let faint = Color(QuillUIColor.faint)
    static let hint = Color(QuillUIColor.hint)
    static let line = Color(QuillUIColor.line)
    static let lineSoft = Color(QuillUIColor.lineSoft)
    static let line2 = Color(QuillUIColor.line2)
    static let line3 = Color(QuillUIColor.line3)
    static let hover = Color(QuillUIColor.hover)
    static let hoverSoft = Color(QuillUIColor.hoverSoft)
    static let scrim = Color(QuillUIColor.scrim)
    static let accent = Color(QuillUIColor.accent)
    static let warn = Color(QuillUIColor.warn)
    static let link = Color(QuillUIColor.link)
    static let canvas = Color(QuillUIColor.canvas)
    /// The second surface: table headers, segmented controls, hover rows.
    static let surface2 = Color(QuillUIColor.surface2)
    static let accentSoft = Color(QuillUIColor.accentSoft)
    /// The dark "today" rail of the Studio layout. It stays dark in both themes, a little deeper at night.
    static let rail = Color(QuillUIColor.rail)
    static let railInk = Color(QuillUIColor.hex(0xF1EFE7))
    static let railMuted = Color(QuillUIColor.hex(0x9B978D))
    static let railLine = Color(QuillUIColor.hex(0xF1EFE7, alpha: 0.13))
    static let railSurface = Color(QuillUIColor.hex(0xF1EFE7, alpha: 0.07))
    /// Printed material stays black on white in both themes.
    static let paper = Color.white
    static let paperInk = Color(QuillUIColor.hex(0x16150F))
    /// Dark text on the sage accent, independent of the theme.
    static let onAccent = Color(QuillUIColor.hex(0x16150F))
}

enum QuillUIColor {
    static let bg = dynamic(0xFAF9F6, 0x171714)
    static let surface = dynamic(0xFFFFFF, 0x212019)
    static let ink = dynamic(0x16150F, 0xF1EFE7)
    static let ink2 = dynamic(0x24231C, 0xDFDCD3)
    static let muted = dynamic(0x6E6B62, 0x9B978D)
    static let faint = dynamic(0x9A968B, 0x807C73)
    static let hint = dynamic(0xB0ABA0, 0x6C6961)
    static let line = dynamic(0x16150F, 0xF1EFE7, lightAlpha: 0.10, darkAlpha: 0.12)
    static let lineSoft = dynamic(0x16150F, 0xF1EFE7, lightAlpha: 0.08, darkAlpha: 0.09)
    static let line2 = dynamic(0x16150F, 0xF1EFE7, lightAlpha: 0.16, darkAlpha: 0.20)
    static let line3 = dynamic(0x16150F, 0xF1EFE7, lightAlpha: 0.20, darkAlpha: 0.26)
    static let hover = dynamic(0x16150F, 0xF1EFE7, lightAlpha: 0.05, darkAlpha: 0.07)
    static let hoverSoft = dynamic(0x16150F, 0xF1EFE7, lightAlpha: 0.03, darkAlpha: 0.05)
    static let scrim = dynamic(0x16150F, 0x000000, lightAlpha: 0.32, darkAlpha: 0.55)
    static let accent = dynamic(0x7FA98C, 0x8FBE9C)
    static let warn = dynamic(0xC9974F, 0xD6A762)
    static let link = dynamic(0x4F7A63, 0x8FBE9C)
    /// The page backdrop behind PDFs: `hover` flattened onto `bg`, since PDFKit needs an opaque color.
    static let canvas = dynamic(0xEEEDE9, 0x25241F)
    static let surface2 = dynamic(0xF4F2EC, 0x1C1C18)
    static let accentSoft = UIColor { traits in
        traits.userInterfaceStyle == .dark ? hex(0x8FBE9C, alpha: 0.20) : hex(0x7FA98C, alpha: 0.18)
    }
    static let rail = dynamic(0x1B1A14, 0x121210)

    static func hex(_ value: UInt32, alpha: CGFloat = 1) -> UIColor {
        UIColor(
            red: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: alpha
        )
    }

    private static func dynamic(_ light: UInt32, _ dark: UInt32, lightAlpha: CGFloat = 1, darkAlpha: CGFloat = 1) -> UIColor {
        UIColor { traits in
            traits.userInterfaceStyle == .dark ? hex(dark, alpha: darkAlpha) : hex(light, alpha: lightAlpha)
        }
    }
}

enum QuillFont {
    enum Weight {
        case light, regular, medium, semibold, bold, heavy

        /// Hanken Grotesk, the Studio layout's text face. It has no light cut, so light reads as regular.
        var postScriptName: String {
            switch self {
            case .light, .regular: return "HankenGrotesk-Regular"
            case .medium: return "HankenGrotesk-Medium"
            case .semibold: return "HankenGrotesk-SemiBold"
            case .bold: return "HankenGrotesk-Bold"
            case .heavy: return "HankenGrotesk-ExtraBold"
            }
        }

        /// IBM Plex Mono, used for captions, figures and metadata.
        var monoName: String {
            switch self {
            case .light, .regular: return "IBMPlexMono-Regular"
            case .medium: return "IBMPlexMono-Medium"
            case .semibold, .bold, .heavy: return "IBMPlexMono-SemiBold"
            }
        }
    }

    static let pixelName = "Silkscreen-Regular"
    private static let files = [
        "HankenGrotesk-Regular", "HankenGrotesk-Medium", "HankenGrotesk-SemiBold", "HankenGrotesk-Bold", "HankenGrotesk-ExtraBold",
        "IBMPlexMono-Regular", "IBMPlexMono-Medium", "IBMPlexMono-SemiBold",
        "WorkSans-Light", "WorkSans-Regular", "WorkSans-Medium", "WorkSans-SemiBold", "WorkSans-Italic", "Silkscreen-Regular",
    ]

    /// Registers the bundled fonts for this process; the generated Info.plist cannot list them.
    static func register() {
        // The slide designs' fonts come along; Work Sans is in both lists.
        for name in files + SlideFont.files.filter({ !files.contains($0) }) {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}

extension Font {
    static func work(_ size: CGFloat, _ weight: QuillFont.Weight = .regular) -> Font {
        .custom(weight.postScriptName, size: size)
    }

    static func workItalic(_ size: CGFloat) -> Font {
        .custom("WorkSans-Italic", size: size)
    }

    static func mono(_ size: CGFloat, _ weight: QuillFont.Weight = .medium) -> Font {
        .custom(weight.monoName, size: size)
    }

    static func pixel(_ size: CGFloat) -> Font {
        .custom(QuillFont.pixelName, size: size)
    }
}
