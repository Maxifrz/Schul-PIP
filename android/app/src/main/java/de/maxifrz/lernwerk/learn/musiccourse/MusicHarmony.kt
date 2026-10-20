package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.Pitch

// Scales, key signatures, the circle of fifths and triads, all spelled by letter distance. A port of MusicHarmony.swift.

enum class MusicScaleKind {
    MAJOR, NATURAL_MINOR, HARMONIC_MINOR;

    /** Half steps between neighbouring degrees. */
    val pattern: List<Int>
        get() = when (this) {
            MAJOR -> listOf(2, 2, 1, 2, 2, 2, 1)
            NATURAL_MINOR -> listOf(2, 1, 2, 2, 1, 2, 2)
            HARMONIC_MINOR -> listOf(2, 1, 2, 2, 1, 3, 1)
        }

    val suffix: String get() = if (this == MAJOR) "Dur" else "Moll"
}

data class MusicScale(val tonic: Pitch, val kind: MusicScaleKind) {
    /** The eight notes from the tonic to its octave. */
    val notes: List<Pitch>
        get() {
            val result = mutableListOf(tonic)
            for (step in kind.pattern) result.add(result[result.size - 1].shifted(1, step))
            return result
        }

    val name: String get() = "${tonic.germanName}-${kind.suffix}"

    /** The sharps (positive) or flats (negative) the scale needs; null when it needs signs of both kinds or more than seven. */
    val accidentalCount: Int?
        get() {
            val alterations = notes.dropLast(1).map { it.alteration }
            if (alterations.any { Math.abs(it) > 1 }) return null
            val sharps = alterations.count { it > 0 }
            val flats = alterations.count { it < 0 }
            if (sharps > 0 && flats > 0) return null
            return if (sharps > 0) sharps else -flats
        }
}

/** Key signatures: +n is n sharps, -n is n flats. */
object MusicKey {
    /** Letters of the sharps in the order they are written: F C G D A E H. */
    val sharpLetters = listOf(3, 0, 4, 1, 5, 2, 6)

    /** Letters of the flats: H E A D G C F, the sharps reversed. */
    val flatLetters = listOf(6, 2, 5, 1, 4, 0, 3)

    /** The signs of a key signature in writing order, as pitches in the fourth octave. */
    fun accidentals(count: Int): List<Pitch> {
        val n = minOf(7, Math.abs(count))
        if (count > 0) return sharpLetters.take(n).map { Pitch(letter = it, octave = 4, alteration = 1) }
        return flatLetters.take(n).map { Pitch(letter = it, octave = 4, alteration = -1) }
    }

    /** The major key with this signature: each fifth up from C adds a sharp, each fifth down a flat. */
    fun majorTonic(count: Int): Pitch {
        var tonic = Pitch(letter = 0, octave = 4)
        for (i in 0 until Math.abs(count)) {
            tonic = if (count > 0) tonic.shifted(4, 7) else tonic.shifted(-4, -7)
        }
        return tonic
    }

    /** The relative minor, a minor third below the major tonic. */
    fun minorTonic(count: Int): Pitch = majorTonic(count).shifted(-2, -3)

    fun majorName(count: Int): String = majorTonic(count).germanName + "-Dur"
    fun minorName(count: Int): String = minorTonic(count).germanName + "-Moll"

    /** The signature of the major key on this tonic, or null beyond seven signs. */
    fun countOfMajorTonic(tonic: Pitch): Int? =
        (-7..7).firstOrNull { val t = majorTonic(it); t.letter == tonic.letter && t.alteration == tonic.alteration }

    /** The signature of the minor key on this tonic. */
    fun countOfMinorTonic(tonic: Pitch): Int? =
        (-7..7).firstOrNull { val t = minorTonic(it); t.letter == tonic.letter && t.alteration == tonic.alteration }

    /** The alteration a key signature gives a letter. */
    fun alteration(letter: Int, count: Int): Int {
        val n = minOf(7, Math.abs(count))
        if (count > 0) return if (sharpLetters.take(n).contains(letter)) 1 else 0
        if (count < 0) return if (flatLetters.take(n).contains(letter)) -1 else 0
        return 0
    }
}

enum class MusicTriadQuality {
    MAJOR, MINOR, DIMINISHED, AUGMENTED;

    /** Half steps from the root to the third and from the third to the fifth. */
    val thirds: Pair<Int, Int>
        get() = when (this) {
            MAJOR -> 4 to 3
            MINOR -> 3 to 4
            DIMINISHED -> 3 to 3
            AUGMENTED -> 4 to 4
        }

    val word: String
        get() = when (this) {
            MAJOR -> "Dur"
            MINOR -> "Moll"
            DIMINISHED -> "vermindert"
            AUGMENTED -> "übermäßig"
        }
}

data class MusicTriad(val root: Pitch, val quality: MusicTriadQuality) {
    /** Root, third and fifth. */
    val notes: List<Pitch>
        get() {
            val (a, b) = quality.thirds
            val third = root.shifted(2, a)
            val fifth = third.shifted(2, b)
            return listOf(root, third, fifth)
        }

    val name: String get() = "${root.germanName}-${quality.word}"
}
