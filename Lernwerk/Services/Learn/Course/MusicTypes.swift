import Foundation

// The vocabulary of notation shared by the staff drawing and the music course. The music course owns this file.

enum Clef: String, Equatable, Codable {
    case treble, bass, alto
}

/// Note and rest lengths.
enum NoteValue: String, Equatable, Codable {
    case whole, half, quarter, eighth, sixteenth
}

/// A pitch by letter, octave and accidental: no sound yet, just the name on the staff.
struct Pitch: Equatable, Hashable, Codable {
    /// 0 = C, 1 = D, 2 = E, 3 = F, 4 = G, 5 = A, 6 = H (B in English).
    var letter: Int
    /// Scientific pitch notation: the middle C is C4.
    var octave: Int
    /// -2 double flat ... 2 double sharp.
    var alteration = 0

    init(letter: Int, octave: Int, alteration: Int = 0) {
        self.letter = letter
        self.octave = octave
        self.alteration = alteration
    }

    /// Steps on the staff counted in lines and spaces from C0; the middle C is 28.
    var diatonic: Int { octave * 7 + letter }

    var midi: Int {
        let semitones = [0, 2, 4, 5, 7, 9, 11]
        return 12 * (octave + 1) + semitones[((letter % 7) + 7) % 7] + alteration
    }
}

struct StaffNote: Equatable {
    var pitch: Pitch
    var value: NoteValue = .quarter
    var isRest = false

    init(pitch: Pitch, value: NoteValue = .quarter, isRest: Bool = false) {
        self.pitch = pitch
        self.value = value
        self.isRest = isRest
    }
}

/// One staff to draw.
struct StaffSpec: Equatable {
    var clef: Clef
    /// Sharps are positive, flats negative: 2 is D major, -3 is E-flat major.
    var keySignature = 0
    /// "4/4", "3/4", or nil for none.
    var time: String?
    var notes: [StaffNote]
    /// Draw all notes on one stem as a chord instead of one after the other.
    var chord = false

    init(clef: Clef, keySignature: Int = 0, time: String? = nil, notes: [StaffNote], chord: Bool = false) {
        self.clef = clef
        self.keySignature = keySignature
        self.time = time
        self.notes = notes
        self.chord = chord
    }
}
