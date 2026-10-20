package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.Clef
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.NoteValue
import de.maxifrz.lernwerk.learn.PairItem
import de.maxifrz.lernwerk.learn.Pitch
import de.maxifrz.lernwerk.learn.StaffNote
import de.maxifrz.lernwerk.learn.StaffSpec

/** Unit 3: note values, rests and counting beats in a bar. A port of MusicUnit3.swift. */
object MusicUnit3 {
    const val tag = "music.u03"
    private fun n(letter: Int, octave: Int, alteration: Int = 0): Pitch = MusicKit.note(letter, octave, alteration)

    val freshValues: List<List<NoteValue>> =
        listOf(listOf(NoteValue.WHOLE, NoteValue.HALF, NoteValue.QUARTER), listOf(NoteValue.EIGHTH, NoteValue.SIXTEENTH), emptyList())
    val allValues: List<NoteValue> = orderedNoteValues
    private val pitches = listOf(n(0, 5), n(1, 5), n(2, 5), n(4, 4), n(5, 4), n(6, 4))

    fun valuesUpTo(level: Int): List<NoteValue> = if (level >= 2) allValues else freshValues[0]

    fun value(level: Int, random: LearnRandom): NoteValue? {
        val fresh = if (level >= 4) allValues else freshValues[level - 1]
        return MusicKit.draw(fresh, valuesUpTo(level), level, random)
    }

    private fun plural(value: NoteValue): String = when (value) {
        NoteValue.WHOLE -> "Ganze Noten"
        NoteValue.HALF -> "Halbe Noten"
        NoteValue.QUARTER -> "Viertelnoten"
        NoteValue.EIGHTH -> "Achtelnoten"
        NoteValue.SIXTEENTH -> "Sechzehntelnoten"
    }

    private fun shortName(value: NoteValue): String = when (value) {
        NoteValue.WHOLE -> "Ganze"
        NoteValue.HALF -> "Halbe"
        NoteValue.QUARTER -> "Viertel"
        NoteValue.EIGHTH -> "Achtel"
        NoteValue.SIXTEENTH -> "Sechzehntel"
    }

    private fun acceptedNames(value: NoteValue): List<String> = when (value) {
        NoteValue.WHOLE -> listOf("Ganze", "Ganznote", "Ganzenote")
        NoteValue.HALF -> listOf("Halbe", "Halbnote")
        else -> listOf(shortName(value))
    }

    private fun beats(value: NoteValue): String = MusicKit.beatText(MusicMeter(4, 4).beats(value))

    /** The other values, the nearest in length first. */
    private fun others(value: NoteValue): List<NoteValue> {
        val index = maxOf(allValues.indexOf(value), 0)
        return allValues.filter { it != value }.sortedBy { Math.abs(maxOf(allValues.indexOf(it), 0) - index) }
    }

    private fun single(value: NoteValue, rest: Boolean, pitch: Pitch, time: String? = null): ExerciseMedia =
        ExerciseMedia.Staff(StaffSpec(Clef.TREBLE, listOf(StaffNote(pitch, value, rest)), 0, time, false))

    fun name(random: LearnRandom, level: Int): LearnExercise? {
        val v = value(level, random) ?: return null
        val p = MusicKit.pick(pitches, random) ?: return null
        return Exercises.choice(
            id = "$tag.name.${v.raw}.${p.scientificName}", key = "music.value.${v.raw}", prompt = "Wie heißt dieser Notenwert?",
            correct = v.noteName, wrong = others(v).map { it.noteName },
            explanation = "${v.noteName}: ${beats(v)} Schlag(e) im 4/4-Takt.", media = single(v, false, p), random = random,
        )
    }

    fun nameRest(random: LearnRandom, level: Int): LearnExercise? {
        val v = MusicKit.pick(allValues, random) ?: return null
        return Exercises.choice(
            id = "$tag.rest.${v.raw}", key = "music.rest.${v.raw}", prompt = "Wie heißt diese Pause?", correct = v.restName,
            wrong = others(v).map { it.restName }, explanation = "${v.restName}: sie dauert so lang wie die ${v.noteName}.",
            media = single(v, true, n(6, 4)), random = random,
        )
    }

    fun valueType(random: LearnRandom, level: Int): LearnExercise? {
        val v = value(level, random) ?: return null
        val p = MusicKit.pick(pitches, random) ?: return null
        return Exercises.typed(
            id = "$tag.valuetype.${v.raw}.${p.scientificName}", key = "music.value.${v.raw}", prompt = "Wie heißt dieser Notenwert?",
            answer = v.noteName, alternatives = acceptedNames(v), mode = AnswerMode.EXACT,
            explanation = "${v.noteName}: ${beats(v)} Schlag(e) im 4/4-Takt.", media = single(v, false, p),
        )
    }

    fun restType(random: LearnRandom, level: Int): LearnExercise? {
        val v = MusicKit.pick(allValues, random) ?: return null
        val alternatives = when (v) {
            NoteValue.WHOLE -> listOf("Ganzpause", "Ganze")
            NoteValue.HALF -> listOf("Halbpause", "Halbe")
            else -> listOf(shortName(v))
        }
        return Exercises.typed(
            id = "$tag.resttype.${v.raw}", key = "music.rest.${v.raw}", prompt = "Wie heißt die Pause, die so lang ist wie eine ${v.noteName}?",
            answer = v.restName, alternatives = alternatives, mode = AnswerMode.EXACT,
            explanation = "Zu jedem Notenwert gibt es eine Pause gleicher Länge.",
        )
    }

    fun beatsChoice(random: LearnRandom, level: Int): LearnExercise? {
        val v = value(level, random) ?: return null
        val p = MusicKit.pick(pitches, random) ?: return null
        val wrong = others(v).map { beats(it) }
        return Exercises.choice(
            id = "$tag.beats.${v.raw}.${p.scientificName}", key = "music.value.${v.raw}", prompt = "Wie viele Schläge dauert diese Note im 4/4-Takt?",
            correct = beats(v), wrong = wrong, explanation = "Im 4/4-Takt ist eine Viertelnote ein Schlag; die ${v.noteName} dauert ${beats(v)}.",
            media = single(v, false, p, "4/4"), random = random,
        )
    }

    fun beatsType(random: LearnRandom, level: Int): LearnExercise? {
        val v = value(level, random) ?: return null
        val text = beats(v)
        return Exercises.typed(
            id = "$tag.beatstype.${v.raw}", key = "music.value.${v.raw}",
            prompt = "Wie viele Schläge dauert eine ${v.noteName} im 4/4-Takt? Schreibe eine Zahl.", answer = text, mode = AnswerMode.NUMBER,
            solution = "$text Schlag" + (if (text == "1") "" else "e"),
            explanation = "Eine Viertelnote ist ein Schlag; eine ${v.noteName} dauert $text.",
        )
    }

    private class Ratio(val big: NoteValue, val small: NoteValue, val count: Int)

    private fun ratios(level: Int): List<Ratio> {
        val pool = valuesUpTo(level)
        val result = mutableListOf<Ratio>()
        for (big in pool) {
            for (small in pool) {
                if (small.sixteenths < big.sixteenths) result.add(Ratio(big, small, big.sixteenths / small.sixteenths))
            }
        }
        return result
    }

    fun ratio(random: LearnRandom, level: Int): LearnExercise? {
        val r = MusicKit.pick(ratios(level), random) ?: return null
        return Exercises.typed(
            id = "$tag.ratio.${r.big.raw}.${r.small.raw}", key = "music.ratio.${r.big.raw}.${r.small.raw}",
            prompt = "Wie viele ${plural(r.small)} dauern so lang wie eine ${r.big.noteName}? Schreibe eine Zahl.", answer = "${r.count}",
            mode = AnswerMode.NUMBER, explanation = "Jeder Notenwert ist halb so lang wie der vorige.",
        )
    }

    fun ratioChoice(random: LearnRandom, level: Int): LearnExercise? {
        val r = MusicKit.pick(ratios(level), random) ?: return null
        val wrong = listOf(r.count * 2, r.count / 2, r.count + 1, r.count - 1, 3).filter { it > 0 && it != r.count }.map { it.toString() }
        return Exercises.choice(
            id = "$tag.ratiochoice.${r.big.raw}.${r.small.raw}", key = "music.ratio.${r.big.raw}.${r.small.raw}",
            prompt = "Wie viele ${plural(r.small)} passen in eine ${r.big.noteName}?", correct = "${r.count}", wrong = wrong,
            explanation = "Jeder Notenwert ist halb so lang wie der vorige.", random = random,
        )
    }

    fun pairs(random: LearnRandom, level: Int): LearnExercise? = pairing(false, level, random)
    fun pairsRest(random: LearnRandom, level: Int): LearnExercise? = pairing(true, level, random)

    private fun pairing(rest: Boolean, level: Int, random: LearnRandom): LearnExercise? {
        val chosen = random.shuffled(allValues).take(4)
        val items = chosen.map { v ->
            val text = beats(v)
            PairItem("music.value.${v.raw}", if (rest) v.restName else v.noteName, if (text == "1") "1 Schlag" else "$text Schläge")
        }
        val fixed = items.map { item ->
            when (item.back) {
                "1/2 Schläge" -> PairItem(item.key, item.front, "1/2 Schlag")
                "1/4 Schläge" -> PairItem(item.key, item.front, "1/4 Schlag")
                else -> item
            }
        }
        val id = "$tag.pairs${if (rest) "rest" else ""}." + chosen.map { it.raw }.sorted().joinToString("-")
        return Exercises.pairs(id = id, prompt = "Wie lange dauert es im 4/4-Takt?", items = fixed, random = random)
    }

    fun order(random: LearnRandom, level: Int): LearnExercise? {
        val pool = valuesUpTo(level)
        val count = minOf(4, pool.size)
        val chosen = random.shuffled(pool).take(count).sortedByDescending { it.sixteenths }
        return Exercises.bank(
            id = "$tag.order." + chosen.joinToString("-") { it.raw }, key = "music.order",
            prompt = "Ordne die Notenwerte vom längsten zum kürzesten.", words = chosen.map { shortName(it) },
            explanation = "Ganze, Halbe, Viertel, Achtel, Sechzehntel: jede Note ist halb so lang wie die davor.", random = random,
        )
    }

    /** A bar of notes and rests that needs exactly `missing` to be full. */
    fun bar(meter: MusicMeter, missing: NoteValue, random: LearnRandom): List<StaffNote>? {
        val choices = listOf(NoteValue.HALF, NoteValue.QUARTER, NoteValue.QUARTER, NoteValue.EIGHTH)
        for (attempt in 0 until 30) {
            var remaining = meter.barSixteenths - missing.sixteenths
            val notes = mutableListOf<StaffNote>()
            while (remaining > 0 && notes.size <= 5) {
                val usable = choices.filter { it.sixteenths <= remaining }
                val value = random.randomElement(usable) ?: break
                val pitch = MusicKit.pick(pitches, random) ?: break
                val isRest = random.int(0, 4) == 0
                notes.add(StaffNote(if (isRest) n(6, 4) else pitch, value, isRest))
                remaining -= value.sixteenths
            }
            if (remaining == 0 && notes.size in 1..5) return notes
        }
        return null
    }

    private class BarSetup(val meter: MusicMeter, val missing: NoteValue, val notes: List<StaffNote>)

    private fun barSetup(random: LearnRandom, wholeBeatsOnly: Boolean): BarSetup? {
        val meters = listOf(MusicMeter(4, 4), MusicMeter(3, 4))
        val missings = if (wholeBeatsOnly) listOf(NoteValue.HALF, NoteValue.QUARTER) else listOf(NoteValue.HALF, NoteValue.QUARTER, NoteValue.EIGHTH)
        val meter = MusicKit.pick(meters, random) ?: return null
        val missing = MusicKit.pick(missings, random) ?: return null
        val notes = bar(meter, missing, random) ?: return null
        return BarSetup(meter, missing, notes)
    }

    private fun signature(notes: List<StaffNote>): String =
        notes.joinToString("-") { (if (it.isRest) "r" else "n") + it.value.raw.take(2) }

    fun fill(random: LearnRandom, level: Int): LearnExercise? {
        val setup = barSetup(random, false) ?: return null
        val media = ExerciseMedia.Staff(StaffSpec(Clef.TREBLE, setup.notes, 0, setup.meter.text, false))
        return Exercises.choice(
            id = "$tag.fill.${setup.meter.beats}.${setup.missing.raw}.${signature(setup.notes)}", key = "music.fill",
            prompt = "Im ${setup.meter.text}-Takt fehlt noch eine Note. Welcher Notenwert macht den Takt voll?",
            correct = setup.missing.noteName, wrong = others(setup.missing).map { it.noteName },
            explanation = "Der ${setup.meter.text}-Takt hat ${setup.meter.beats} Viertel; mit der ${setup.missing.noteName} wird er genau voll.",
            media = media, random = random,
        )
    }

    fun fillType(random: LearnRandom, level: Int): LearnExercise? {
        val setup = barSetup(random, false) ?: return null
        val media = ExerciseMedia.Staff(StaffSpec(Clef.TREBLE, setup.notes, 0, setup.meter.text, false))
        return Exercises.typed(
            id = "$tag.filltype.${setup.meter.beats}.${setup.missing.raw}.${signature(setup.notes)}", key = "music.fill",
            prompt = "Welcher Notenwert fehlt, damit der ${setup.meter.text}-Takt voll ist?", answer = setup.missing.noteName,
            alternatives = acceptedNames(setup.missing), mode = AnswerMode.EXACT,
            explanation = "Der ${setup.meter.text}-Takt hat ${setup.meter.beats} Viertel; mit der ${setup.missing.noteName} wird er genau voll.",
            media = media,
        )
    }

    fun beatsInBar(random: LearnRandom, level: Int): LearnExercise? {
        val setup = barSetup(random, true) ?: return null
        val total = (setup.meter.barSixteenths - setup.missing.sixteenths) / 4
        val media = ExerciseMedia.Staff(StaffSpec(Clef.TREBLE, setup.notes, 0, setup.meter.text, false))
        return Exercises.typed(
            id = "$tag.barbeats.${setup.meter.beats}.${setup.missing.raw}.${signature(setup.notes)}", key = "music.fill",
            prompt = "Wie viele Schläge dauern diese Noten und Pausen zusammen? Schreibe eine Zahl.", answer = "$total", mode = AnswerMode.NUMBER,
            explanation = "Zähle Noten und Pausen zusammen: eine Viertel ist ein Schlag.", media = media,
        )
    }

    fun fact(random: LearnRandom, level: Int): LearnExercise? = MusicKit.fact(facts, level, tag, random)

    val facts: List<MusicFact> = listOf(
        MusicFact("valueWord", 1, "Wie nennt man die Länge eines Tons in der Notenschrift?", "Notenwert",
            listOf("Tonhöhe", "Lautstärke", "Tonart"), "Der Notenwert sagt, wie lange ein Ton dauert."),
        MusicFact("whole", 1, "Welche Note dauert im 4/4-Takt einen ganzen Takt?", "Ganze Note",
            listOf("Halbe Note", "Viertelnote", "Achtelnote"), "Die Ganze Note dauert vier Schläge: so viele, wie der 4/4-Takt hat."),
        MusicFact("half", 2, "Welche Note ist halb so lang wie eine Viertelnote?", "Achtelnote",
            listOf("Halbe Note", "Sechzehntelnote", "Ganze Note"), "Zwei Achtel dauern so lang wie eine Viertelnote."),
        MusicFact("restMeaning", 2, "Was bedeutet eine Pause?", "Stille für die Länge des Notenwerts",
            listOf("Der Ton wird länger gehalten", "Der Ton wird lauter", "Das Stück ist zu Ende"), "In der Pause klingt nichts, aber sie wird mitgezählt."),
        MusicFact("beats44", 3, "Wie viele Viertel hat ein 4/4-Takt?", "4", listOf("3", "2", "8"),
            "Die obere Zahl 4 zählt die Schläge, die untere 4 meint Viertel."),
        MusicFact("beats34", 3, "Wie viele Schläge hat ein 3/4-Takt?", "3", listOf("4", "2", "6"), "Die obere Zahl nennt die Schläge pro Takt."),
        MusicFact("lower", 3, "Was sagt die untere Zahl der Taktangabe 3/4?", "Ein Schlag ist eine Viertelnote.",
            listOf("Ein Schlag ist eine Halbe Note.", "Ein Schlag ist eine Achtelnote.", "Der Takt hat vier Schläge."),
            "Die untere 4 steht für Viertel."),
        MusicFact("upper", 3, "Was sagt die obere Zahl der Taktangabe 4/4?", "Der Takt hat vier Schläge.",
            listOf("Der Takt hat zwei Schläge.", "Das Stück hat vier Teile.", "Ein Schlag ist eine Halbe Note."),
            "Die obere Zahl zählt die Schläge pro Takt."),
        MusicFact("eighths34", 3, "Wie viele Achtelnoten passen in einen 3/4-Takt?", "6", listOf("3", "4", "8"), "Drei Viertel sind sechs Achtel."),
        MusicFact("barline", 3, "Was trennt zwei Takte voneinander?", "der Taktstrich", listOf("die Hilfslinie", "der Bogen", "der Schlüssel"),
            "Der Taktstrich steht senkrecht im Notensystem."),
    )

    val def = MusicUnitDef(
        makers = mapOf<String, MusicMaker>(
            "fact" to ::fact, "name" to ::name, "nameRest" to ::nameRest, "valueType" to ::valueType, "restType" to ::restType,
            "beats" to ::beatsChoice, "beatsType" to ::beatsType, "ratio" to ::ratio, "ratioChoice" to ::ratioChoice,
            "pairs" to ::pairs, "pairsRest" to ::pairsRest, "order" to ::order, "fill" to ::fill, "fillType" to ::fillType,
            "beatsInBar" to ::beatsInBar,
        ),
        lessons = listOf(
            listOf("fact", "name", "name", "beats", "beatsType", "beatsType", "ratio", "ratio", "order", "valueType"),
            listOf("fact", "name", "nameRest", "nameRest", "ratioChoice", "ratio", "pairs", "pairsRest", "order", "restType", "valueType"),
            listOf("fact", "fact", "fill", "fill", "fill", "beatsInBar", "beatsInBar", "fillType", "fillType", "order"),
        ),
        practice = listOf("fact", "name", "nameRest", "beats", "ratio", "ratioChoice", "pairs", "order", "fill", "beatsInBar", "~", "~"),
        checkpoint = listOf("fact", "name", "nameRest", "beats", "beatsType", "ratio", "ratioChoice", "pairs", "pairsRest", "order", "fill", "fill", "beatsInBar", "fillType"),
        review = listOf("name", "beats", "ratio", "pairs"),
    )
}
