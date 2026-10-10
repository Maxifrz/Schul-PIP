import Foundation

// Scales, key signatures, the circle of fifths and triads, all spelled by letter distance.

enum MusicScaleKind: Equatable {
    case major, naturalMinor, harmonicMinor

    /// Half steps between neighbouring degrees.
    var pattern: [Int] {
        switch self {
        case .major: return [2, 2, 1, 2, 2, 2, 1]
        case .naturalMinor: return [2, 1, 2, 2, 1, 2, 2]
        case .harmonicMinor: return [2, 1, 2, 2, 1, 3, 1]
        }
    }

    var suffix: String { self == .major ? "Dur" : "Moll" }
}

struct MusicScale: Equatable {
    let tonic: Pitch
    let kind: MusicScaleKind

    /// The eight notes from the tonic to its octave.
    var notes: [Pitch] {
        var result = [tonic]
        for step in kind.pattern {
            result.append(result[result.count - 1].shifted(letterSteps: 1, semitones: step))
        }
        return result
    }

    var name: String { "\(tonic.germanName)-\(kind.suffix)" }

    /// The sharps (positive) or flats (negative) the scale needs; nil when it needs signs of both kinds or more than seven.
    var accidentalCount: Int? {
        let alterations = notes.dropLast().map(\.alteration)
        if alterations.contains(where: { abs($0) > 1 }) { return nil }
        let sharps = alterations.filter { $0 > 0 }.count
        let flats = alterations.filter { $0 < 0 }.count
        if sharps > 0 && flats > 0 { return nil }
        return sharps > 0 ? sharps : -flats
    }
}

/// Key signatures: +n is n sharps, -n is n flats.
enum MusicKey {
    /// Letters of the sharps in the order they are written: F C G D A E H.
    static let sharpLetters = [3, 0, 4, 1, 5, 2, 6]
    /// Letters of the flats: H E A D G C F, the sharps reversed.
    static let flatLetters = [6, 2, 5, 1, 4, 0, 3]

    /// The signs of a key signature in writing order, as pitches in the fourth octave.
    static func accidentals(_ count: Int) -> [Pitch] {
        let n = min(7, abs(count))
        if count > 0 { return sharpLetters.prefix(n).map { Pitch(letter: $0, octave: 4, alteration: 1) } }
        return flatLetters.prefix(n).map { Pitch(letter: $0, octave: 4, alteration: -1) }
    }

    /// The major key with this signature: each fifth up from C adds a sharp, each fifth down a flat.
    static func majorTonic(_ count: Int) -> Pitch {
        var tonic = Pitch(letter: 0, octave: 4)
        for _ in 0..<abs(count) {
            tonic = count > 0 ? tonic.shifted(letterSteps: 4, semitones: 7) : tonic.shifted(letterSteps: -4, semitones: -7)
        }
        return tonic
    }

    /// The relative minor, a minor third below the major tonic.
    static func minorTonic(_ count: Int) -> Pitch {
        majorTonic(count).shifted(letterSteps: -2, semitones: -3)
    }

    static func majorName(_ count: Int) -> String { majorTonic(count).germanName + "-Dur" }
    static func minorName(_ count: Int) -> String { minorTonic(count).germanName + "-Moll" }

    /// The signature of the major key on this tonic, or nil beyond seven signs.
    static func count(ofMajorTonic tonic: Pitch) -> Int? {
        (-7...7).first { let t = majorTonic($0); return t.letter == tonic.letter && t.alteration == tonic.alteration }
    }

    /// The signature of the minor key on this tonic.
    static func count(ofMinorTonic tonic: Pitch) -> Int? {
        (-7...7).first { let t = minorTonic($0); return t.letter == tonic.letter && t.alteration == tonic.alteration }
    }

    /// The alteration a key signature gives a letter.
    static func alteration(letter: Int, count: Int) -> Int {
        let n = min(7, abs(count))
        if count > 0 { return sharpLetters.prefix(n).contains(letter) ? 1 : 0 }
        if count < 0 { return flatLetters.prefix(n).contains(letter) ? -1 : 0 }
        return 0
    }
}

enum MusicTriadQuality: Equatable {
    case major, minor, diminished, augmented

    /// Half steps from the root to the third and from the third to the fifth.
    var thirds: (Int, Int) {
        switch self {
        case .major: return (4, 3)
        case .minor: return (3, 4)
        case .diminished: return (3, 3)
        case .augmented: return (4, 4)
        }
    }

    var word: String {
        switch self {
        case .major: return "Dur"
        case .minor: return "Moll"
        case .diminished: return "vermindert"
        case .augmented: return "übermäßig"
        }
    }
}

struct MusicTriad: Equatable {
    let root: Pitch
    let quality: MusicTriadQuality

    /// Root, third and fifth.
    var notes: [Pitch] {
        let (a, b) = quality.thirds
        let third = root.shifted(letterSteps: 2, semitones: a)
        let fifth = third.shifted(letterSteps: 2, semitones: b)
        return [root, third, fifth]
    }

    var name: String { "\(root.germanName)-\(quality.word)" }
}
