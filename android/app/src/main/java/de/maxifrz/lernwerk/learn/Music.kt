package de.maxifrz.lernwerk.learn

// The vocabulary of notation shared by the staff drawing and the music course. A port of MusicTypes.swift.

enum class Clef(val raw: String) { TREBLE("treble"), BASS("bass"), ALTO("alto") }

/** Note and rest lengths. */
enum class NoteValue(val raw: String) {
    WHOLE("whole"), HALF("half"), QUARTER("quarter"), EIGHTH("eighth"), SIXTEENTH("sixteenth")
}

/** A pitch by letter, octave and accidental: no sound yet, just the name on the staff. */
data class Pitch(
    /** 0 = C, 1 = D, 2 = E, 3 = F, 4 = G, 5 = A, 6 = H (B in English). */
    val letter: Int,
    /** Scientific pitch notation: the middle C is C4. */
    val octave: Int,
    /** -2 double flat ... 2 double sharp. */
    val alteration: Int = 0,
) {
    /** Steps on the staff counted in lines and spaces from C0; the middle C is 28. */
    val diatonic: Int get() = octave * 7 + letter

    val midi: Int get() = 12 * (octave + 1) + SEMITONES[Math.floorMod(letter, 7)] + alteration

    private companion object {
        val SEMITONES = intArrayOf(0, 2, 4, 5, 7, 9, 11)
    }
}

data class StaffNote(val pitch: Pitch, val value: NoteValue = NoteValue.QUARTER, val isRest: Boolean = false)

/** One staff to draw. */
data class StaffSpec(
    val clef: Clef,
    val notes: List<StaffNote>,
    /** Sharps are positive, flats negative: 2 is D major, -3 is E-flat major. */
    val keySignature: Int = 0,
    /** "4/4", "3/4", or null for none. */
    val time: String? = null,
    /** Draw all notes on one stem as a chord instead of one after the other. */
    val chord: Boolean = false,
)
