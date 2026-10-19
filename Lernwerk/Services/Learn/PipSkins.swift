import Foundation

/// A coat for Pip, the pixel cat: the three palette colors the grid in `PipSimulation.cat` is drawn with.
/// The outline and the eyes stay the same, so every skin reads as Pip.
struct PipSkin: Equatable, Identifiable {
    let id: String
    /// German display name.
    let name: String
    /// Price in gems; the default skin is free.
    let price: Int
    /// Fur ("f" in the grid), RGB.
    let fur: UInt32
    /// Inner ears and nose ("p").
    let inner: UInt32
    /// Paws and belly stripe ("w").
    let paws: UInt32

    static let defaultID = "salbei"

    static let all: [PipSkin] = [
        PipSkin(id: defaultID, name: "Salbei", price: 0, fur: 0x7FA98C, inner: 0xE5A8A2, paws: 0xFFFDF6),
        PipSkin(id: "zimt", name: "Zimt", price: 40, fur: 0xD9925B, inner: 0xF0C4A0, paws: 0xFFF1DC),
        PipSkin(id: "nebel", name: "Nebel", price: 60, fur: 0x9AA5B5, inner: 0xE5A8A2, paws: 0xF4F6FA),
        PipSkin(id: "kirsche", name: "Kirsche", price: 80, fur: 0xD97B8F, inner: 0xF6C9D2, paws: 0xFFF3F5),
        PipSkin(id: "nacht", name: "Nacht", price: 120, fur: 0x4F5B7A, inner: 0xB88AA8, paws: 0xDCE1EE),
    ]

    static let standard = all[0]

    static func skin(_ id: String) -> PipSkin? { all.first { $0.id == id } }
}

/// What buying a skin came to.
enum PipSkinPurchase: Equatable {
    case bought
    case alreadyOwned
    case notEnoughGems
    case unknownSkin
}
