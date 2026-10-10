import Foundation

/// What an exercise shows or plays above its question. The values are plain data; the screens draw and play them.
enum ExerciseMedia: Equatable {
    /// A word or sentence to hear by tapping a button; `language` is a BCP 47 tag like "es-ES". No tag, no button.
    case speech(text: String, language: String)
    /// A chess position.
    case board(BoardSpec)
    /// Notes on a staff.
    case staff(StaffSpec)
    /// Notes to hear.
    case tones(ToneSpec)
}

/// A chess position to show. The pieces come from the FEN's first field; the side to move is its second.
struct BoardSpec: Equatable {
    var fen: String
    /// White's side is at the bottom unless this is set.
    var flipped = false
    /// Squares to mark, like "e4".
    var marked: [String] = []

    init(fen: String, flipped: Bool = false, marked: [String] = []) {
        self.fen = fen
        self.flipped = flipped
        self.marked = marked
    }
}

/// Notes to play: one after the other, or all at once as a chord. MIDI numbers, 60 is the middle C.
struct ToneSpec: Equatable {
    var midi: [Int]
    var together = false

    init(midi: [Int], together: Bool = false) {
        self.midi = midi
        self.together = together
    }
}
