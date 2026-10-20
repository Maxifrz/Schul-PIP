package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.Clef
import de.maxifrz.lernwerk.learn.NoteValue
import de.maxifrz.lernwerk.learn.Pitch

// Note values, rests, time signatures and the place of a pitch on the staff. A port of MusicRhythm.swift.

val orderedNoteValues: List<NoteValue> =
    listOf(NoteValue.WHOLE, NoteValue.HALF, NoteValue.QUARTER, NoteValue.EIGHTH, NoteValue.SIXTEENTH)

/** Length in sixteenth notes. */
val NoteValue.sixteenths: Int
    get() = when (this) {
        NoteValue.WHOLE -> 16
        NoteValue.HALF -> 8
        NoteValue.QUARTER -> 4
        NoteValue.EIGHTH -> 2
        NoteValue.SIXTEENTH -> 1
    }

val NoteValue.noteName: String
    get() = when (this) {
        NoteValue.WHOLE -> "Ganze Note"
        NoteValue.HALF -> "Halbe Note"
        NoteValue.QUARTER -> "Viertelnote"
        NoteValue.EIGHTH -> "Achtelnote"
        NoteValue.SIXTEENTH -> "Sechzehntelnote"
    }

val NoteValue.restName: String
    get() = when (this) {
        NoteValue.WHOLE -> "Ganze Pause"
        NoteValue.HALF -> "Halbe Pause"
        NoteValue.QUARTER -> "Viertelpause"
        NoteValue.EIGHTH -> "Achtelpause"
        NoteValue.SIXTEENTH -> "Sechzehntelpause"
    }

/** A time signature like 4/4: the upper number counts the beats, the lower one says which note is one beat. */
data class MusicMeter(val beats: Int, val unit: Int) {
    val text: String get() = "$beats/$unit"

    /** Length of one bar in sixteenth notes: 16 for 4/4, 12 for 3/4 and 6/8. */
    val barSixteenths: Int get() = beats * 16 / unit

    /** Length of the counting unit in sixteenths (4 for a quarter beat). */
    val unitSixteenths: Int get() = 16 / unit

    /** How many counting units a note lasts, as (numerator, denominator): an eighth in 4/4 is (1, 2). */
    fun beats(value: NoteValue): Pair<Int, Int> {
        val a = value.sixteenths
        val b = unitSixteenths
        var x = a
        var y = b
        while (y != 0) {
            val t = x % y
            x = y
            y = t
        }
        return (a / x) to (b / x)
    }

    /** Whether the notes (rests included) exactly fill one bar. */
    fun isFull(values: List<NoteValue>): Boolean = values.fold(0) { acc, v -> acc + v.sixteenths } == barSixteenths

    companion object {
        fun parse(text: String): MusicMeter? {
            val parts = text.split("/").filter { it.isNotEmpty() }.mapNotNull { it.toIntOrNull() }
            if (parts.size != 2 || parts[0] <= 0 || parts[1] !in listOf(1, 2, 4, 8, 16)) return null
            return MusicMeter(parts[0], parts[1])
        }
    }
}

/** Where a pitch sits on a five-line staff, counted in half spaces from the bottom line. */
data class StaffPosition(
    /** 0 is the bottom line, 1 the first space, 8 the top line, 10 the first ledger line above, -2 the first below. */
    val step: Int,
) {
    val isLine: Boolean get() = MusicMath.floorMod(step, 2) == 0
    val onStaff: Boolean get() = step in 0..8

    /** Number of ledger lines the note needs. */
    val ledgerLines: Int
        get() {
            if (step <= -1) return (-step) / 2
            if (step >= 9) return (step - 8) / 2
            return 0
        }

    /** 1 to 5 from the bottom for a note on a line, 1 to 4 for a space; null outside the staff. */
    val index: Int?
        get() {
            if (!onStaff) return null
            return if (isLine) step / 2 + 1 else (step + 1) / 2
        }

    /** A German description for the positions around the staff, null further away. */
    val description: String?
        get() = when (step) {
            0, 2, 4, 6, 8 -> "${step / 2 + 1}. Linie"
            1, 3, 5, 7 -> "${(step + 1) / 2}. Zwischenraum"
            -1 -> "unter der 1. Linie"
            -2 -> "1. Hilfslinie unten"
            9 -> "über der 5. Linie"
            10 -> "1. Hilfslinie oben"
            else -> null
        }
}

/** The pitch (as diatonic number) of the bottom line: E4 in the treble clef, G2 in the bass clef. */
val Clef.bottomLineDiatonic: Int
    get() = when (this) {
        Clef.TREBLE -> 4 * 7 + 2
        Clef.BASS -> 2 * 7 + 4
        Clef.ALTO -> 3 * 7 + 3
    }

fun Pitch.staffPosition(clef: Clef): StaffPosition = StaffPosition(diatonic - clef.bottomLineDiatonic)

/** The natural pitch that sits at this staff position in the clef. */
fun pitchAtStep(step: Int, clef: Clef): Pitch {
    val number = clef.bottomLineDiatonic + step
    return Pitch(letter = MusicMath.floorMod(number, 7), octave = MusicMath.floorDiv(number, 7))
}
