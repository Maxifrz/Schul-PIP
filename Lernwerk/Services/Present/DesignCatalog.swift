import Foundation

/// Designs added after the first seventeen: system fonts (Georgia, Courier New), square or very round corners, and a
/// high-contrast one. Colors are background / text / muted / accent / surface; each design passes the same contrast
/// rules as the others (text 7:1, muted and accent 4.5:1), which `ThemeCatalogTests` checks.
enum DesignCatalog {
    static let pergament = SlideTheme(
        id: "pergament", name: "Pergament", background: 0xF4ECD8, text: 0x2B2118, muted: 0x6B5B45, accent: 0x9C4A2F,
        surface: 0xE8DDC2, accent2: 0xC9A66B, heading: .georgia, body: .georgia, decor: .frame, cornerScale: 0.5,
        mood: "Mittelalter, Latein, Chroniken, Sagen, Quellenarbeit"
    )
    static let ozean = SlideTheme(
        id: "ozean", name: "Ozean", background: 0x0F2438, text: 0xE8F1F8, muted: 0x9FB6C8, accent: 0x4FB3D9,
        surface: 0x183550, accent2: 0x2C7DA0, heading: .montserrat, body: .dmSans, decor: .glow,
        mood: "Meer, Ozeane, Klima, Wasser, Meeresbiologie"
    )
    static let terminal = SlideTheme(
        id: "terminal", name: "Terminal", background: 0x0D1117, text: 0xC9D1D9, muted: 0x8B949E, accent: 0x3FB950,
        surface: 0x161B22, heading: .courier, body: .courier, decor: .none, cornerScale: 0,
        mood: "Programmieren, IT-Sicherheit, Netzwerke, Kommandozeile, Hacker"
    )
    static let koralle = SlideTheme(
        id: "koralle", name: "Koralle", background: 0xFFF7F0, text: 0x2A1810, muted: 0x7A5C4E, accent: 0xC2411A,
        surface: 0xFCE5D8, accent2: 0xF2A65A, heading: .montserrat, body: .workSans, decor: .blocks,
        mood: "Jugendkultur, Lebensstil, Soziales, Tiere, Gemeinschaft"
    )
    static let lavendel = SlideTheme(
        id: "lavendel", name: "Lavendel", background: 0xF6F3FB, text: 0x241B3A, muted: 0x6A5F86, accent: 0x6B4BE0,
        surface: 0xE9E3F7, accent2: 0xC4B5F0, heading: .dmSans, body: .dmSans, decor: .circles, cornerScale: 1.4,
        mood: "Musik, Träume, Kreativität, Märchen, Poesie"
    )
    static let kontrast = SlideTheme(
        id: "kontrast", name: "Kontrast", background: 0x000000, text: 0xFFFFFF, muted: 0xD0D0D0, accent: 0xFFD400,
        surface: 0x1F1F1F, heading: .workSans, body: .workSans, decor: .none, cornerScale: 0.5,
        mood: "hoher Kontrast, Lesbarkeit, Sehschwäche, große Räume, Barrierefreiheit"
    )
    static let zeitung = SlideTheme(
        id: "zeitung", name: "Zeitung", background: 0xF2F2EE, text: 0x111111, muted: 0x555555, accent: 0xB3261E,
        surface: 0xE2E2DC, accent2: 0xB8B8B0, heading: .georgia, body: .georgia, decor: .band, cornerScale: 0,
        mood: "Journalismus, Nachrichten, Presse, Zeitgeschichte, Medienkritik"
    )
    static let minze = SlideTheme(
        id: "minze", name: "Minze", background: 0xF3FAF8, text: 0x0E2B27, muted: 0x4A6B65, accent: 0x0B7F72,
        surface: 0xDDF0EC, accent2: 0x7CCFC0, heading: .dmSans, body: .dmSans, decor: .corners,
        mood: "Wellness, Kräuter, Hygiene, Alltag, Haushalt"
    )

    static let additional = [pergament, ozean, terminal, koralle, lavendel, kontrast, zeitung, minze]
}
