import Foundation

// Music theory in plain Foundation: German note names, spelling by letter distance, MIDI numbers and intervals.
// Everything the music course teaches is computed here, so the exercises cannot teach a wrongly spelled note.

enum MusicMath {
    static func floorDiv(_ a: Int, _ b: Int) -> Int {
        let q = a / b
        return (a % b != 0 && (a < 0) != (b < 0)) ? q - 1 : q
    }

    static func floorMod(_ a: Int, _ b: Int) -> Int { ((a % b) + b) % b }
}

extension Pitch {
    /// Semitones above C for the seven letters C D E F G A H.
    static let naturalSemitones = [0, 2, 4, 5, 7, 9, 11]
    static let letterNames = ["C", "D", "E", "F", "G", "A", "H"]

    /// 0 = C ... 11 = H, whatever the spelling.
    var pitchClass: Int { MusicMath.floorMod(midi, 12) }

    /// The German name without the octave: C, Cis, Des, Es, B (for H flat), H, His, Asas ...
    var germanName: String {
        let base = Pitch.letterNames[MusicMath.floorMod(letter, 7)]
        switch alteration {
        case 0: return base
        case let n where n > 0: return base + String(repeating: "is", count: n)
        case -1:
            switch base {
            case "H": return "B"
            case "E": return "Es"
            case "A": return "As"
            default: return base + "es"
            }
        case -2:
            switch base {
            case "H": return "Heses"
            case "E": return "Eses"
            case "A": return "Asas"
            default: return base + "eses"
            }
        default: return base + String(repeating: "es", count: -alteration)
        }
    }

    /// The octave in the German way: "Kontraoktave" (octave 1) up to "viergestrichene Oktave".
    static func octaveName(_ octave: Int) -> String {
        switch octave {
        case 0: return "Subkontraoktave"
        case 1: return "Kontraoktave"
        case 2: return "große Oktave"
        case 3: return "kleine Oktave"
        case 4: return "eingestrichene Oktave"
        case 5: return "zweigestrichene Oktave"
        case 6: return "dreigestrichene Oktave"
        case 7: return "viergestrichene Oktave"
        default: return "Oktave \(octave)"
        }
    }

    /// The note with its octave in scientific notation, like "Fis4" or "B3".
    var scientificName: String { germanName + String(octave) }

    /// The pitch `letterSteps` letters and `semitones` half steps away. Because the letters are counted, the result is
    /// spelled correctly: a third above D with 4 semitones is F sharp, never G flat.
    func shifted(letterSteps: Int, semitones: Int) -> Pitch {
        let diatonicNumber = diatonic + letterSteps
        let newOctave = MusicMath.floorDiv(diatonicNumber, 7)
        let newLetter = MusicMath.floorMod(diatonicNumber, 7)
        let target = midi + semitones
        let natural = 12 * (newOctave + 1) + Pitch.naturalSemitones[newLetter]
        return Pitch(letter: newLetter, octave: newOctave, alteration: target - natural)
    }

    /// A pitch for a MIDI number, spelled with sharps or with flats.
    static func spelled(midi: Int, preferFlats: Bool = false) -> Pitch {
        let octave = MusicMath.floorDiv(midi, 12) - 1
        let pc = MusicMath.floorMod(midi, 12)
        let sharps: [(Int, Int)] = [(0, 0), (0, 1), (1, 0), (1, 1), (2, 0), (3, 0), (3, 1), (4, 0), (4, 1), (5, 0), (5, 1), (6, 0)]
        let flats: [(Int, Int)] = [(0, 0), (1, -1), (1, 0), (2, -1), (2, 0), (3, 0), (4, -1), (4, 0), (5, -1), (5, 0), (6, -1), (6, 0)]
        let entry = (preferFlats ? flats : sharps)[pc]
        return Pitch(letter: entry.0, octave: octave, alteration: entry.1)
    }

    /// Both notes sound the same, whatever their names.
    func isEnharmonic(to other: Pitch) -> Bool { midi == other.midi }
}

enum MusicNames {
    /// The pitch class (letter and alteration) a German note name stands for, "cis" and "Cis" alike; nil if it is no name.
    static func parse(_ text: String) -> (letter: Int, alteration: Int)? {
        let wanted = text.trimmingCharacters(in: .whitespaces).lowercased()
        guard !wanted.isEmpty else { return nil }
        for letter in 0..<7 {
            for alteration in -2...2 {
                let name = Pitch(letter: letter, octave: 4, alteration: alteration).germanName.lowercased()
                if name == wanted || (alteration == -2 && letter == 5 && wanted == "ases") { return (letter, alteration) }
            }
        }
        return nil
    }

    /// Every MIDI number of the piano range with this pitch class.
    static func keys(pitchClass: Int, in range: ClosedRange<Int> = 21...108) -> [Int] {
        range.filter { MusicMath.floorMod($0, 12) == pitchClass }
    }

    static func isBlackKey(_ midi: Int) -> Bool { [1, 3, 6, 8, 10].contains(MusicMath.floorMod(midi, 12)) }
}

/// An interval counted upward: the letter distance and the half steps decide its name.
struct MusicInterval: Equatable, Hashable {
    enum Quality: Equatable {
        case perfect, major, minor, augmented, diminished
    }

    /// Letter distance: 0 is the Prim, 7 the Oktave.
    let steps: Int
    let semitones: Int

    init(steps: Int, semitones: Int) {
        self.steps = steps
        self.semitones = semitones
    }

    /// The interval from `lower` up to `upper`.
    init(from lower: Pitch, to upper: Pitch) {
        steps = upper.diatonic - lower.diatonic
        semitones = upper.midi - lower.midi
    }

    private static let majorSemitones = [0, 2, 4, 5, 7, 9, 11, 12]
    private static let isPerfectKind = [true, false, false, true, true, false, false, true]
    static let sizeNames = ["Prim", "Sekunde", "Terz", "Quarte", "Quinte", "Sexte", "Septime", "Oktave"]

    /// The number as counted by students: 1 for the Prim ... 8 for the Oktave.
    var number: Int { steps + 1 }

    var quality: Quality? {
        guard (0...7).contains(steps) else { return nil }
        let diff = semitones - MusicInterval.majorSemitones[steps]
        if MusicInterval.isPerfectKind[steps] {
            switch diff {
            case 0: return .perfect
            case 1: return .augmented
            case -1: return .diminished
            default: return nil
            }
        }
        switch diff {
        case 0: return .major
        case -1: return .minor
        case 1: return .augmented
        case -2: return .diminished
        default: return nil
        }
    }

    var sizeName: String { (0...7).contains(steps) ? MusicInterval.sizeNames[steps] : "" }

    /// "reine Quinte", "kleine Terz", "übermäßige Quarte" ... nil for what school music does not name.
    var name: String? {
        guard let quality else { return nil }
        let word: String
        switch quality {
        case .perfect: word = "reine"
        case .major: word = "große"
        case .minor: word = "kleine"
        case .augmented: word = "übermäßige"
        case .diminished: word = "verminderte"
        }
        return "\(word) \(sizeName)"
    }

    /// The same interval turned upside down: a major third becomes a minor sixth.
    var inverted: MusicInterval { MusicInterval(steps: 7 - steps, semitones: 12 - semitones) }

    var isTritone: Bool { semitones == 6 && (steps == 3 || steps == 4) }

    /// The upper note when this interval is built above `pitch`.
    func above(_ pitch: Pitch) -> Pitch { pitch.shifted(letterSteps: steps, semitones: semitones) }

    /// The lower note when this interval is built below `pitch`.
    func below(_ pitch: Pitch) -> Pitch { pitch.shifted(letterSteps: -steps, semitones: -semitones) }

    /// The intervals a school course names, by letter distance and half steps.
    static let standard: [MusicInterval] = [
        MusicInterval(steps: 0, semitones: 0), MusicInterval(steps: 1, semitones: 1), MusicInterval(steps: 1, semitones: 2),
        MusicInterval(steps: 2, semitones: 3), MusicInterval(steps: 2, semitones: 4), MusicInterval(steps: 3, semitones: 5),
        MusicInterval(steps: 4, semitones: 7), MusicInterval(steps: 5, semitones: 8), MusicInterval(steps: 5, semitones: 9),
        MusicInterval(steps: 6, semitones: 10), MusicInterval(steps: 6, semitones: 11), MusicInterval(steps: 7, semitones: 12),
    ]
}
