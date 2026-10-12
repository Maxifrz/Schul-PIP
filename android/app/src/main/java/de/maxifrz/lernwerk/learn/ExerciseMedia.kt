package de.maxifrz.lernwerk.learn

// What an exercise shows or plays above its question. The values are plain data; the screens draw and play them.
// A port of ExerciseMedia.swift.

/** A chess position to show. The pieces come from the FEN's first field; the side to move is its second. */
data class BoardSpec(
    val fen: String,
    /** White's side is at the bottom unless this is set. */
    val flipped: Boolean = false,
    /** Squares to mark, like "e4". */
    val marked: List<String> = emptyList(),
)

/** Notes to play: one after the other, or all at once as a chord. MIDI numbers, 60 is the middle C. */
data class ToneSpec(val midi: List<Int>, val together: Boolean = false)

sealed class ExerciseMedia {
    /** A word or sentence to hear by tapping a button; `language` is a BCP 47 tag like "es-ES". No tag, no button. */
    data class Speech(val text: String, val language: String) : ExerciseMedia()

    /** A chess position. */
    data class Board(val board: BoardSpec) : ExerciseMedia()

    /** Notes on a staff. */
    data class Staff(val staff: StaffSpec) : ExerciseMedia()

    /** Notes to hear. */
    data class Tones(val tones: ToneSpec) : ExerciseMedia()
}
