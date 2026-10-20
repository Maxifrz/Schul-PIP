package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.Clef
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.NoteValue
import de.maxifrz.lernwerk.learn.Pitch
import de.maxifrz.lernwerk.learn.StaffNote
import de.maxifrz.lernwerk.learn.StaffSpec

// Helpers the units of the music course share: a maker is one kind of exercise for a lesson level.
// A port of MusicKit.swift.

/** Makes one exercise. `level` is 1 to 3 for the three lessons of a unit and 4 for everything the unit teaches. */
typealias MusicMaker = (LearnRandom, Int) -> LearnExercise?

/** What a unit asks: topic keys per node. A topic in the practice list that is "~" stands for a topic of an earlier unit. */
class MusicUnitDef(
    val makers: Map<String, MusicMaker>,
    val lessons: List<List<String>>,
    val practice: List<String>,
    val checkpoint: List<String>,
    /** Topics worth meeting again in later units. */
    val review: List<String>,
)

/** A question with fixed wording, shown at one lesson level. */
class MusicFact(
    val id: String,
    val level: Int,
    val prompt: String,
    val correct: String,
    val wrong: List<String>,
    val explanation: String,
    val media: ExerciseMedia? = null,
)

/** Swift's `Bool.random(using:)`: bit 17 of one generator word, clear means true. */
fun randomBool(random: LearnRandom): Boolean = ((random.next() shr 17) and 1uL) == 0uL

object MusicKit {
    fun note(letter: Int, octave: Int, alteration: Int = 0): Pitch = Pitch(letter, octave, alteration)

    fun staff(
        clef: Clef,
        pitches: List<Pitch>,
        key: Int = 0,
        time: String? = null,
        value: NoteValue = NoteValue.QUARTER,
        chord: Boolean = false,
    ): ExerciseMedia =
        ExerciseMedia.Staff(StaffSpec(clef, pitches.map { StaffNote(it, value) }, key, time, chord))

    fun <T> pick(items: List<T>, random: LearnRandom): T? = random.randomElement(items)

    /** An element of `fresh` most of the time on the lessons, anything taught so far otherwise; everything on level 4. */
    fun <T> draw(fresh: List<T>, all: List<T>, level: Int, random: LearnRandom): T? {
        if (level >= 4 || fresh.isEmpty()) return random.randomElement(all)
        val useFresh = random.int(0, 10) < 6
        return random.randomElement(if (useFresh) fresh else all)
    }

    /**
     * Wrong note names near the right one: the same letter with another sign, the neighbouring letters. Nothing that
     * sounds like the right answer is among them.
     */
    fun wrongNames(correct: Pitch, naturalsOnly: Boolean = false, random: LearnRandom): List<String> {
        val candidates = mutableListOf<Pitch>()
        val same = if (naturalsOnly) emptyList()
        else listOf(correct.alteration - 1, correct.alteration + 1, 0).filter { it != correct.alteration && Math.abs(it) <= 1 }
        for (alteration in same) candidates.add(note(correct.letter, correct.octave, alteration))
        for (step in listOf(1, -1, 2, -2)) {
            val letter = MusicMath.floorMod(correct.letter + step, 7)
            candidates.add(note(letter, correct.octave, if (naturalsOnly) 0 else correct.alteration))
        }
        val seen = hashSetOf(correct.germanName)
        val result = mutableListOf<Pitch>()
        for (candidate in candidates) {
            if (candidate.pitchClass != correct.pitchClass && seen.add(candidate.germanName)) result.add(candidate)
        }
        // The nearest ones first, but not always in the same order.
        val head = random.shuffled(result.take(3))
        return (head + result.drop(3)).map { it.germanName }
    }

    /** Wrong readings of a note on the staff: the name in the other clef first, then the neighbouring letters. */
    fun wrongReadings(
        pitch: Pitch,
        clef: Clef,
        otherClef: Clef?,
        naturalsOnly: Boolean = false,
        random: LearnRandom,
    ): List<String> {
        val result = mutableListOf<String>()
        if (otherClef != null) {
            val step = pitch.staffPosition(clef).step
            val other = pitchAtStep(step, otherClef)
            if (other.letter != pitch.letter) result.add(Pitch(other.letter, other.octave, pitch.alteration).germanName)
        }
        result += wrongNames(pitch, naturalsOnly, random)
        return result
    }

    /** "auf der 2. Linie", "im 1. Zwischenraum", "unter der 1. Linie" ... */
    fun phrase(step: Int): String = when (step) {
        0, 2, 4, 6, 8 -> "auf der ${step / 2 + 1}. Linie"
        1, 3, 5, 7 -> "im ${(step + 1) / 2}. Zwischenraum"
        -1 -> "unter der 1. Linie"
        -2 -> "auf der 1. Hilfslinie unter dem System"
        9 -> "über der 5. Linie"
        10 -> "auf der 1. Hilfslinie über dem System"
        else -> "außerhalb des Systems"
    }

    fun clefWord(clef: Clef): String = when (clef) {
        Clef.TREBLE -> "Violinschlüssel"
        Clef.BASS -> "Bassschlüssel"
        Clef.ALTO -> "Altschlüssel"
    }

    /** "Fis" or "Fis und Cis" or "Fis, Cis und Gis": the signs of a key signature. */
    fun signNames(count: Int): String {
        val names = MusicKey.accidentals(count).map { it.germanName }
        if (names.isEmpty()) return "keine Vorzeichen"
        if (names.size == 1) return names[0]
        return names.dropLast(1).joinToString(", ") + " und " + names[names.size - 1]
    }

    /** "3 Kreuze", "1 Be", "keine Vorzeichen". */
    fun signCount(count: Int): String {
        if (count == 0) return "keine Vorzeichen"
        if (count > 0) return if (count == 1) "1 Kreuz" else "$count Kreuze"
        return "${-count} Be"
    }

    /** The text of a beat count: "4", "1/2", "1/4". */
    fun beatText(fraction: Pair<Int, Int>): String =
        if (fraction.second == 1) "${fraction.first}" else "${fraction.first}/${fraction.second}"

    /** A choice from a list of fixed questions. */
    fun fact(facts: List<MusicFact>, level: Int, tag: String, random: LearnRandom): LearnExercise? {
        val pool = facts.filter { level >= 4 || it.level == level }
        val fact = random.randomElement(pool) ?: return null
        return Exercises.choice(
            id = "$tag.fact.${fact.id}", key = "$tag.fact.${fact.id}", prompt = fact.prompt, correct = fact.correct,
            wrong = fact.wrong, explanation = fact.explanation, media = fact.media, random = random,
        )
    }

    /** Notes of an octave range on the keyboard that have this name (every octave). */
    fun keys(pitch: Pitch): List<Int> = MusicNames.keys(pitch.pitchClass)

    /** "das eingestrichene c", "das große C": the note in its octave, as the keyboard questions name it. */
    fun octaveText(pitch: Pitch): String? {
        val name = pitch.germanName
        return when (pitch.octave) {
            2 -> "das große $name"
            3 -> "das kleine ${name.lowercase()}"
            4 -> "das eingestrichene ${name.lowercase()}"
            5 -> "das zweigestrichene ${name.lowercase()}"
            else -> null
        }
    }

    /** Typed note names: "Cis" and "cis" both count. The check is letter by letter, so "Cis" is never taken for "Dis". */
    fun typedNote(
        id: String,
        key: String,
        prompt: String,
        answer: Pitch,
        explanation: String = "",
        media: ExerciseMedia? = null,
    ): LearnExercise? =
        Exercises.typed(
            id = id, key = key, prompt = prompt, answer = answer.germanName, mode = AnswerMode.EXACT,
            explanation = explanation, media = media,
        )
}
