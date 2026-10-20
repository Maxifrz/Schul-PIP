package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.Pitch

// Music theory in plain Kotlin: German note names, spelling by letter distance, MIDI numbers and intervals.
// Everything the music course teaches is computed here, so the exercises cannot teach a wrongly spelled note.
// A port of MusicTheory.swift.

object MusicMath {
    fun floorDiv(a: Int, b: Int): Int = Math.floorDiv(a, b)

    fun floorMod(a: Int, b: Int): Int = ((a % b) + b) % b
}

/** Semitones above C for the seven letters C D E F G A H. */
val naturalSemitones: List<Int> = listOf(0, 2, 4, 5, 7, 9, 11)
val letterNames: List<String> = listOf("C", "D", "E", "F", "G", "A", "H")

/** 0 = C ... 11 = H, whatever the spelling. */
val Pitch.pitchClass: Int get() = MusicMath.floorMod(midi, 12)

/** The German name without the octave: C, Cis, Des, Es, B (for H flat), H, His, Asas ... */
val Pitch.germanName: String
    get() {
        val base = letterNames[MusicMath.floorMod(letter, 7)]
        return when {
            alteration == 0 -> base
            alteration > 0 -> base + "is".repeat(alteration)
            alteration == -1 -> when (base) {
                "H" -> "B"
                "E" -> "Es"
                "A" -> "As"
                else -> base + "es"
            }
            alteration == -2 -> when (base) {
                "H" -> "Heses"
                "E" -> "Eses"
                "A" -> "Asas"
                else -> base + "eses"
            }
            else -> base + "es".repeat(-alteration)
        }
    }

/** The octave in the German way: "Kontraoktave" (octave 1) up to "viergestrichene Oktave". */
fun octaveName(octave: Int): String = when (octave) {
    0 -> "Subkontraoktave"
    1 -> "Kontraoktave"
    2 -> "große Oktave"
    3 -> "kleine Oktave"
    4 -> "eingestrichene Oktave"
    5 -> "zweigestrichene Oktave"
    6 -> "dreigestrichene Oktave"
    7 -> "viergestrichene Oktave"
    else -> "Oktave $octave"
}

/** The note with its octave in scientific notation, like "Fis4" or "B3". */
val Pitch.scientificName: String get() = germanName + octave.toString()

/**
 * The pitch `letterSteps` letters and `semitones` half steps away. Because the letters are counted, the result is
 * spelled correctly: a third above D with 4 semitones is F sharp, never G flat.
 */
fun Pitch.shifted(letterSteps: Int, semitones: Int): Pitch {
    val diatonicNumber = diatonic + letterSteps
    val newOctave = MusicMath.floorDiv(diatonicNumber, 7)
    val newLetter = MusicMath.floorMod(diatonicNumber, 7)
    val target = midi + semitones
    val natural = 12 * (newOctave + 1) + naturalSemitones[newLetter]
    return Pitch(letter = newLetter, octave = newOctave, alteration = target - natural)
}

/** Both notes sound the same, whatever their names. */
fun Pitch.isEnharmonic(other: Pitch): Boolean = midi == other.midi

/** A pitch for a MIDI number, spelled with sharps or with flats. */
fun spelled(midi: Int, preferFlats: Boolean = false): Pitch {
    val octave = MusicMath.floorDiv(midi, 12) - 1
    val pc = MusicMath.floorMod(midi, 12)
    val sharps = listOf(0 to 0, 0 to 1, 1 to 0, 1 to 1, 2 to 0, 3 to 0, 3 to 1, 4 to 0, 4 to 1, 5 to 0, 5 to 1, 6 to 0)
    val flats = listOf(0 to 0, 1 to -1, 1 to 0, 2 to -1, 2 to 0, 3 to 0, 4 to -1, 4 to 0, 5 to -1, 5 to 0, 6 to -1, 6 to 0)
    val entry = (if (preferFlats) flats else sharps)[pc]
    return Pitch(letter = entry.first, octave = octave, alteration = entry.second)
}

data class ParsedName(val letter: Int, val alteration: Int)

object MusicNames {
    /** The pitch class (letter and alteration) a German note name stands for, "cis" and "Cis" alike; null if it is no name. */
    fun parse(text: String): ParsedName? {
        val wanted = text.trim { it == ' ' || it == '\t' }.lowercase()
        if (wanted.isEmpty()) return null
        for (letter in 0 until 7) {
            for (alteration in -2..2) {
                val name = Pitch(letter = letter, octave = 4, alteration = alteration).germanName.lowercase()
                if (name == wanted || (alteration == -2 && letter == 5 && wanted == "ases")) return ParsedName(letter, alteration)
            }
        }
        return null
    }

    /** Every MIDI number of the piano range with this pitch class. */
    fun keys(pitchClass: Int, range: IntRange = 21..108): List<Int> = range.filter { MusicMath.floorMod(it, 12) == pitchClass }

    fun isBlackKey(midi: Int): Boolean = MusicMath.floorMod(midi, 12) in listOf(1, 3, 6, 8, 10)
}

enum class IntervalQuality { PERFECT, MAJOR, MINOR, AUGMENTED, DIMINISHED }

/** An interval counted upward: the letter distance and the half steps decide its name. */
data class MusicInterval(
    /** Letter distance: 0 is the Prim, 7 the Oktave. */
    val steps: Int,
    val semitones: Int,
) {
    /** The number as counted by students: 1 for the Prim ... 8 for the Oktave. */
    val number: Int get() = steps + 1

    val quality: IntervalQuality?
        get() {
            if (steps !in 0..7) return null
            val diff = semitones - majorSemitones[steps]
            if (isPerfectKind[steps]) {
                return when (diff) {
                    0 -> IntervalQuality.PERFECT
                    1 -> IntervalQuality.AUGMENTED
                    -1 -> IntervalQuality.DIMINISHED
                    else -> null
                }
            }
            return when (diff) {
                0 -> IntervalQuality.MAJOR
                -1 -> IntervalQuality.MINOR
                1 -> IntervalQuality.AUGMENTED
                -2 -> IntervalQuality.DIMINISHED
                else -> null
            }
        }

    val sizeName: String get() = if (steps in 0..7) sizeNames[steps] else ""

    /** "reine Quinte", "kleine Terz", "übermäßige Quarte" ... null for what school music does not name. */
    val name: String?
        get() {
            val q = quality ?: return null
            val word = when (q) {
                IntervalQuality.PERFECT -> "reine"
                IntervalQuality.MAJOR -> "große"
                IntervalQuality.MINOR -> "kleine"
                IntervalQuality.AUGMENTED -> "übermäßige"
                IntervalQuality.DIMINISHED -> "verminderte"
            }
            return "$word $sizeName"
        }

    /** The same interval turned upside down: a major third becomes a minor sixth. */
    val inverted: MusicInterval get() = MusicInterval(7 - steps, 12 - semitones)

    val isTritone: Boolean get() = semitones == 6 && (steps == 3 || steps == 4)

    /** The upper note when this interval is built above `pitch`. */
    fun above(pitch: Pitch): Pitch = pitch.shifted(steps, semitones)

    /** The lower note when this interval is built below `pitch`. */
    fun below(pitch: Pitch): Pitch = pitch.shifted(-steps, -semitones)

    companion object {
        private val majorSemitones = listOf(0, 2, 4, 5, 7, 9, 11, 12)
        private val isPerfectKind = listOf(true, false, false, true, true, false, false, true)
        val sizeNames = listOf("Prim", "Sekunde", "Terz", "Quarte", "Quinte", "Sexte", "Septime", "Oktave")

        /** The interval from `lower` up to `upper`. */
        fun between(lower: Pitch, upper: Pitch): MusicInterval =
            MusicInterval(upper.diatonic - lower.diatonic, upper.midi - lower.midi)

        /** The intervals a school course names, by letter distance and half steps. */
        val standard: List<MusicInterval> = listOf(
            MusicInterval(0, 0), MusicInterval(1, 1), MusicInterval(1, 2), MusicInterval(2, 3), MusicInterval(2, 4),
            MusicInterval(3, 5), MusicInterval(4, 7), MusicInterval(5, 8), MusicInterval(5, 9), MusicInterval(6, 10),
            MusicInterval(6, 11), MusicInterval(7, 12),
        )
    }
}
