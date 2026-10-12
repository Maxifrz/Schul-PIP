import Foundation

// Note values, rests, time signatures and the place of a pitch on the staff.

extension NoteValue {
    static let ordered: [NoteValue] = [.whole, .half, .quarter, .eighth, .sixteenth]

    /// Length in sixteenth notes.
    var sixteenths: Int {
        switch self {
        case .whole: return 16
        case .half: return 8
        case .quarter: return 4
        case .eighth: return 2
        case .sixteenth: return 1
        }
    }

    var noteName: String {
        switch self {
        case .whole: return "Ganze Note"
        case .half: return "Halbe Note"
        case .quarter: return "Viertelnote"
        case .eighth: return "Achtelnote"
        case .sixteenth: return "Sechzehntelnote"
        }
    }

    var restName: String {
        switch self {
        case .whole: return "Ganze Pause"
        case .half: return "Halbe Pause"
        case .quarter: return "Viertelpause"
        case .eighth: return "Achtelpause"
        case .sixteenth: return "Sechzehntelpause"
        }
    }
}

/// A time signature like 4/4: the upper number counts the beats, the lower one says which note is one beat.
struct MusicMeter: Equatable {
    let beats: Int
    let unit: Int

    init(beats: Int, unit: Int) {
        self.beats = beats
        self.unit = unit
    }

    init?(_ text: String) {
        let parts = text.split(separator: "/").compactMap { Int($0) }
        guard parts.count == 2, parts[0] > 0, [1, 2, 4, 8, 16].contains(parts[1]) else { return nil }
        self.init(beats: parts[0], unit: parts[1])
    }

    var text: String { "\(beats)/\(unit)" }

    /// Length of one bar in sixteenth notes: 16 for 4/4, 12 for 3/4 and 6/8.
    var barSixteenths: Int { beats * 16 / unit }

    /// Length of the counting unit in sixteenths (4 for a quarter beat).
    var unitSixteenths: Int { 16 / unit }

    /// How many counting units a note lasts, as (numerator, denominator): an eighth in 4/4 is (1, 2).
    func beats(of value: NoteValue) -> (Int, Int) {
        let a = value.sixteenths, b = unitSixteenths
        var x = a, y = b
        while y != 0 { (x, y) = (y, x % y) }
        return (a / x, b / x)
    }

    /// Whether the notes (rests included) exactly fill one bar.
    func isFull(_ values: [NoteValue]) -> Bool { values.reduce(0) { $0 + $1.sixteenths } == barSixteenths }
}

/// Where a pitch sits on a five-line staff, counted in half spaces from the bottom line.
struct StaffPosition: Equatable {
    /// 0 is the bottom line, 1 the first space, 8 the top line, 10 the first ledger line above, -2 the first below.
    let step: Int

    var isLine: Bool { MusicMath.floorMod(step, 2) == 0 }
    var onStaff: Bool { (0...8).contains(step) }

    /// Number of ledger lines the note needs.
    var ledgerLines: Int {
        if step <= -1 { return (-step) / 2 }
        if step >= 9 { return (step - 8) / 2 }
        return 0
    }

    /// 1 to 5 from the bottom for a note on a line, 1 to 4 for a space; nil outside the staff.
    var index: Int? {
        guard onStaff else { return nil }
        return isLine ? step / 2 + 1 : (step + 1) / 2
    }

    /// A German description for the positions around the staff, nil further away.
    var description: String? {
        switch step {
        case 0, 2, 4, 6, 8: return "\(step / 2 + 1). Linie"
        case 1, 3, 5, 7: return "\((step + 1) / 2). Zwischenraum"
        case -1: return "unter der 1. Linie"
        case -2: return "1. Hilfslinie unten"
        case 9: return "über der 5. Linie"
        case 10: return "1. Hilfslinie oben"
        default: return nil
        }
    }
}

extension Clef {
    /// The pitch (as diatonic number) of the bottom line: E4 in the treble clef, G2 in the bass clef.
    var bottomLineDiatonic: Int {
        switch self {
        case .treble: return 4 * 7 + 2
        case .bass: return 2 * 7 + 4
        case .alto: return 3 * 7 + 3
        }
    }
}

extension Pitch {
    func staffPosition(clef: Clef) -> StaffPosition { StaffPosition(step: diatonic - clef.bottomLineDiatonic) }

    /// The natural pitch that sits at this staff position in the clef.
    static func atStep(_ step: Int, clef: Clef) -> Pitch {
        let number = clef.bottomLineDiatonic + step
        return Pitch(letter: MusicMath.floorMod(number, 7), octave: MusicMath.floorDiv(number, 7))
    }
}
