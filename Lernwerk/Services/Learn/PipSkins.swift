import Foundation

/// One painted cell of Pip's sprite, in the cat grid's coordinates (row 0 is the top of the head; hats use negative rows).
struct PipPixel: Equatable {
    let x: Int
    let y: Int
    let rgb: UInt32
    let alpha: Double
}

/// A block of cells drawn over the cat: a hat, glasses, stripes.
struct PipOverlay: Equatable {
    let x: Int
    let y: Int
    let width: Int
    let height: Int
    let rgb: UInt32
    /// Below 1 the block tints what lies under it, like a visor.
    let alpha: Double

    /// A single cell.
    init(_ x: Int, _ y: Int, _ rgb: UInt32) {
        self.init(x, y, 1, 1, rgb)
    }

    init(_ x: Int, _ y: Int, _ width: Int, _ height: Int, _ rgb: UInt32, alpha: Double = 1) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.rgb = rgb
        self.alpha = alpha
    }
}

/// A coat for Pip, the pixel cat: palette, optional per-row fur and overlays on top of the grid in `PipSimulation.cat`.
struct PipSkin: Equatable, Identifiable {
    let id: String
    /// German display name and one line about it.
    let name: String
    let note: String
    /// Price in gems; the default skin is free.
    let price: Int
    let fur: UInt32
    /// Inner ears and nose.
    let inner: UInt32
    /// Paws and belly stripe.
    let paws: UInt32
    /// Outline color; nil follows light and dark mode.
    let outline: UInt32?
    /// Eye color; nil is the outline color.
    let eye: UInt32?
    /// Tail color; nil is the fur.
    let tail: UInt32?
    /// Fur color per grid row, for skins with bands.
    let furRows: [Int: UInt32]
    let overlays: [PipOverlay]
    /// Draw a line around the overlays, as around the cat.
    let outlinesOverlays: Bool

    init(
        _ id: String, _ name: String, _ note: String, price: Int,
        fur: UInt32 = 0x7FA98C, inner: UInt32 = 0xE5A8A2, paws: UInt32 = 0xFFFDF6,
        outline: UInt32? = nil, eye: UInt32? = nil, tail: UInt32? = nil, furRows: [Int: UInt32] = [:],
        overlays: [PipOverlay] = [], outlinesOverlays: Bool = false
    ) {
        self.id = id
        self.name = name
        self.note = note
        self.price = price
        self.fur = fur
        self.inner = inner
        self.paws = paws
        self.outline = outline
        self.eye = eye
        self.tail = tail
        self.furRows = furRows
        self.overlays = overlays
        self.outlinesOverlays = outlinesOverlays
    }

    static let defaultID = "salbei"
    static let defaultOutline: (light: UInt32, dark: UInt32) = (0x23231F, 0x0A0A08)

    static func skin(_ id: String) -> PipSkin? { all.first { $0.id == id } }

    func outlineColor(dark: Bool) -> UInt32 {
        outline ?? (dark ? Self.defaultOutline.dark : Self.defaultOutline.light)
    }

    /// The sprite as painted cells, in paint order: outlines, then tail and body, then overlays.
    /// `grid` is the cat (its eyes may be changed for blinking), `tail` the tail's cells, `outline` the line color.
    func pixels(grid: [[Character]], tail: [(Int, Int)], outline line: UInt32) -> [PipPixel] {
        struct Cell: Hashable { let x: Int, y: Int }
        var cells: [Cell: UInt32] = [:]
        for (x, y) in tail { cells[Cell(x: x, y: y)] = self.tail ?? fur }
        for (y, row) in grid.enumerated() {
            for (x, value) in row.enumerated() where value != "." {
                let color: UInt32
                switch value {
                case "f": color = furRows[y] ?? fur
                case "p": color = inner
                case "w": color = paws
                case "e": color = eye ?? line
                default: color = line
                }
                cells[Cell(x: x, y: y)] = color
            }
        }
        var tinted: [PipPixel] = []
        var overlayCells: [Cell] = []
        for overlay in overlays {
            for x in overlay.x..<(overlay.x + overlay.width) {
                for y in overlay.y..<(overlay.y + overlay.height) {
                    if overlay.alpha < 1 {
                        tinted.append(PipPixel(x: x, y: y, rgb: overlay.rgb, alpha: overlay.alpha))
                    } else {
                        cells[Cell(x: x, y: y)] = overlay.rgb
                        overlayCells.append(Cell(x: x, y: y))
                    }
                }
            }
        }
        let edgeOf = outlinesOverlays ? overlayCells : []
        let tailCells = tail.map { Cell(x: $0.0, y: $0.1) }
        var edge: Set<Cell> = []
        for cell in edgeOf + tailCells {
            for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                let next = Cell(x: cell.x + dx, y: cell.y + dy)
                if cells[next] == nil { edge.insert(next) }
            }
        }
        func ordered(_ set: [Cell]) -> [Cell] { set.sorted { ($0.y, $0.x) < ($1.y, $1.x) } }
        return ordered(Array(edge)).map { PipPixel(x: $0.x, y: $0.y, rgb: line, alpha: 1) }
            + ordered(Array(cells.keys)).map { PipPixel(x: $0.x, y: $0.y, rgb: cells[$0] ?? line, alpha: 1) }
            + tinted
    }
}

/// What buying a skin came to.
enum PipSkinPurchase: Equatable {
    case bought
    case alreadyOwned
    case notEnoughGems
    case unknownSkin
}

extension PipSkin {
    static let standard = all[0]

    private static let ink: UInt32 = 0x23231F

    /// Cheap coats first, hats and gear in the middle, the showpieces last.
    static let all: [PipSkin] = [
        PipSkin(defaultID, "Salbei", "Das Original.", price: 0),
        PipSkin("karamell", "Karamell", "Warmes Braun mit hellem Bauch.", price: 30,
                fur: 0xC98A55, inner: 0xE8A89A, paws: 0xF3DDB8),
        PipSkin("tiger", "Tiger", "Orange mit dunklen Streifen.", price: 40,
                fur: 0xE08A3C, paws: 0xFFF5E0,
                overlays: [PipOverlay(5, 4, 0x5A2E14), PipOverlay(7, 4, 0x5A2E14), PipOverlay(6, 5, 0x5A2E14),
                           PipOverlay(2, 9, 2, 1, 0x5A2E14), PipOverlay(9, 9, 2, 1, 0x5A2E14),
                           PipOverlay(1, 7, 0x5A2E14), PipOverlay(11, 7, 0x5A2E14)]),
        PipSkin("kuh", "Kuh", "Weiß mit schwarzen Flecken.", price: 40,
                fur: 0xFFFDF6, paws: 0xE6E1D3,
                overlays: [PipOverlay(2, 4, 3, 2, ink), PipOverlay(8, 8, 3, 3, ink), PipOverlay(4, 9, 2, 2, ink)]),
        PipSkin("siam", "Siam", "Cremefarben, dunkle Maske und Pfoten.", price: 50,
                fur: 0xF0DDBF, inner: 0xB58A6E, paws: 0x7A5A44,
                overlays: [PipOverlay(6, 7, 0x7A5A44), PipOverlay(5, 8, 0x7A5A44), PipOverlay(7, 8, 0x7A5A44),
                           PipOverlay(5, 9, 3, 1, 0x7A5A44), PipOverlay(2, 3, 2, 1, 0x7A5A44), PipOverlay(9, 3, 2, 1, 0x7A5A44)]),
        PipSkin("bonbon", "Bonbon", "Rosa Fell mit Schleife.", price: 50,
                fur: 0xF2A6C0, inner: 0xD9577F, paws: 0xFFF3F7,
                overlays: [PipOverlay(7, 2, 2, 2, 0xD9577F), PipOverlay(10, 2, 2, 2, 0xD9577F), PipOverlay(9, 3, 0x9C2C55)]),
        PipSkin("bluete", "Blüte", "Blume am Ohr.", price: 60,
                fur: 0xA8C77A, paws: 0xFFFDF6,
                overlays: [PipOverlay(10, 2, 0xF6A1C0), PipOverlay(9, 3, 0xF6A1C0), PipOverlay(11, 3, 0xF6A1C0),
                           PipOverlay(10, 4, 0xF6A1C0), PipOverlay(10, 3, 0xF2C94C)]),
        PipSkin("schnee", "Schnee", "Weiß, blaue Augen, Eiskristalle.", price: 60,
                fur: 0xF4F7FA, inner: 0xF2B6C0, paws: 0xCFE3F5, outline: 0x7C93AB, eye: 0x3A7BD5,
                overlays: [PipOverlay(1, 0, 1, 3, 0x9FD3F0), PipOverlay(0, 1, 3, 1, 0x9FD3F0),
                           PipOverlay(12, 2, 1, 3, 0x9FD3F0), PipOverlay(11, 3, 3, 1, 0x9FD3F0)]),
        PipSkin("mitternacht", "Mitternacht", "Dunkles Fell, gelbe Augen, Mond auf der Stirn.", price: 80,
                fur: 0x3B3F55, inner: 0x9A8FC4, paws: 0x6A6F8C, outline: 0x14151F, eye: 0xFFD84A,
                overlays: [PipOverlay(6, 4, 0xFFD84A), PipOverlay(7, 4, 0xFFD84A), PipOverlay(6, 5, 0xFFD84A)]),
        PipSkin("streber", "Streber", "Orange Brille.", price: 80,
                overlays: [PipOverlay(2, 5, 4, 1, 0xD2693C), PipOverlay(2, 8, 4, 1, 0xD2693C), PipOverlay(2, 6, 1, 2, 0xD2693C),
                           PipOverlay(5, 6, 1, 2, 0xD2693C), PipOverlay(8, 5, 4, 1, 0xD2693C), PipOverlay(8, 8, 4, 1, 0xD2693C),
                           PipOverlay(8, 6, 1, 2, 0xD2693C), PipOverlay(11, 6, 1, 2, 0xD2693C), PipOverlay(6, 6, 2, 1, 0xD2693C)]),
        PipSkin("koch", "Koch", "Weiße Kochmütze.", price: 90,
                fur: 0xE8C79A, paws: 0xFFFDF6,
                overlays: [PipOverlay(3, 3, 7, 1, 0xFFFFFF), PipOverlay(2, 2, 9, 1, 0xFFFFFF),
                           PipOverlay(3, 1, 7, 1, 0xFFFFFF), PipOverlay(4, 0, 5, 1, 0xFFFFFF)],
                outlinesOverlays: true),
        PipSkin("schlafmuetze", "Schlafmütze", "Blaue Zipfelmütze.", price: 90,
                fur: 0xC9B8E8, paws: 0xF4EEFF,
                overlays: [PipOverlay(3, 3, 7, 1, 0x4A6FA5), PipOverlay(4, 2, 6, 1, 0x4A6FA5), PipOverlay(6, 1, 5, 1, 0x4A6FA5),
                           PipOverlay(9, 0, 3, 1, 0x4A6FA5), PipOverlay(11, 1, 1, 2, 0xFFFFFF), PipOverlay(12, 1, 1, 2, 0xFFFFFF)],
                outlinesOverlays: true),
        PipSkin("pirat", "Pirat", "Kopftuch und Augenklappe.", price: 100,
                overlays: [PipOverlay(2, 4, 9, 1, 0xC9453D), PipOverlay(3, 3, 7, 1, 0xC9453D), PipOverlay(11, 4, 2, 1, 0xC9453D),
                           PipOverlay(12, 5, 0xC9453D), PipOverlay(4, 3, 0xFFFDF6), PipOverlay(7, 3, 0xFFFDF6),
                           PipOverlay(5, 4, 0xFFFDF6), PipOverlay(2, 5, 4, 4, ink)]),
        PipSkin("zauberer", "Zauberer", "Spitzhut mit goldenem Band.", price: 120,
                overlays: [PipOverlay(4, 2, 5, 1, 0x6B4FA0), PipOverlay(5, 1, 3, 1, 0x6B4FA0), PipOverlay(6, 0, 2, 1, 0x6B4FA0),
                           PipOverlay(7, -1, 0x6B4FA0), PipOverlay(8, -2, 0x6B4FA0), PipOverlay(2, 3, 9, 1, 0x6B4FA0),
                           PipOverlay(6, 2, 0xE8B94A), PipOverlay(5, 3, 3, 1, 0xE8B94A)],
                outlinesOverlays: true),
        PipSkin("abschluss", "Abschluss", "Doktorhut mit Quaste.", price: 120,
                fur: 0x7FB0D8, paws: 0xF2F8FF,
                overlays: [PipOverlay(1, 1, 11, 1, 0x2B2B33), PipOverlay(3, 0, 7, 1, 0x2B2B33), PipOverlay(4, 2, 5, 1, 0x2B2B33),
                           PipOverlay(4, 3, 5, 1, 0x2B2B33), PipOverlay(11, 2, 1, 2, 0xE8B94A)],
                outlinesOverlays: true),
        PipSkin("roboter", "Roboter", "Grau, rote Augen, Antenne.", price: 140,
                fur: 0x9AA3AD, inner: 0x556070, paws: 0xD6DCE2, outline: 0x2E3640, eye: 0xE5484D,
                overlays: [PipOverlay(6, 1, 1, 3, 0x556070), PipOverlay(5, 0, 3, 1, 0xE5484D), PipOverlay(1, 9, 0x556070),
                           PipOverlay(11, 9, 0x556070), PipOverlay(5, 9, 0x2E3640), PipOverlay(7, 9, 0x2E3640)]),
        PipSkin("koenigin", "Königin", "Goldene Krone mit Rubin.", price: 160,
                fur: 0xE08A3C, paws: 0xFFF5E0,
                overlays: [PipOverlay(3, 3, 7, 1, 0xE8B94A), PipOverlay(3, 2, 0xE8B94A), PipOverlay(6, 2, 0xE8B94A),
                           PipOverlay(9, 2, 0xE8B94A), PipOverlay(6, 3, 0xE5484D)],
                outlinesOverlays: true),
        PipSkin("astronaut", "Astronaut", "Visier, Kragen und Antenne.", price: 180,
                fur: 0xD9DEE4, paws: 0xFFFFFF, outline: 0x4A5566,
                overlays: [PipOverlay(6, 1, 1, 3, 0x8A94A3), PipOverlay(6, 0, 0xE5484D), PipOverlay(1, 12, 11, 1, 0xF08A3C),
                           PipOverlay(1, 5, 11, 4, 0x5AA0E6, alpha: 0.5)]),
        PipSkin("neon", "Neon", "Dunkel mit Leuchtkanten.", price: 200,
                fur: 0x14161F, inner: 0xFF3EA5, paws: 0x38E8F0, outline: 0x38E8F0, eye: 0xFF3EA5, tail: 0x14161F,
                overlays: [PipOverlay(4, 4, 5, 1, 0x38E8F0), PipOverlay(2, 9, 2, 1, 0xFF3EA5), PipOverlay(9, 9, 2, 1, 0xFF3EA5)]),
        PipSkin("regenbogen", "Regenbogen", "Ein Streifen pro Zeile.", price: 240,
                furRows: [3: 0xE5484D, 4: 0xE5484D, 5: 0xF08A3C, 6: 0xF2C94C, 7: 0xF2C94C,
                          8: 0x6FBF73, 9: 0x6FBF73, 10: 0x4A9BE0, 11: 0x9A6FD6]),
    ]
}
