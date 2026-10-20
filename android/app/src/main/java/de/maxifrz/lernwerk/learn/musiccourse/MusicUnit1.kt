package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.Clef
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.PairItem
import de.maxifrz.lernwerk.learn.Pitch

/** Unit 1: the staff and the treble clef. A port of MusicUnit1.swift. */
object MusicUnit1 {
    const val tag = "music.u01"
    private fun n(letter: Int, octave: Int, alteration: Int = 0): Pitch = MusicKit.note(letter, octave, alteration)

    /** The new notes of each lesson: the lines, the spaces, the ledger lines and the notes just beyond the staff. */
    val freshNotes: List<List<Pitch>> = listOf(
        listOf(n(2, 4), n(4, 4), n(6, 4), n(1, 5), n(3, 5)),
        listOf(n(3, 4), n(5, 4), n(0, 5), n(2, 5)),
        listOf(n(0, 4), n(1, 4), n(4, 5), n(5, 5)),
    )
    val all: List<Pitch> get() = freshNotes.flatten()
    fun fresh(level: Int): List<Pitch> = if (level >= 4) all else freshNotes[level - 1]
    fun upTo(level: Int): List<Pitch> = if (level >= 4) all else freshNotes.take(level).flatten()

    fun pitch(level: Int, random: LearnRandom): Pitch? = MusicKit.draw(fresh(level), upTo(level), level, random)

    fun read(random: LearnRandom, level: Int): LearnExercise? {
        val p = pitch(level, random) ?: return null
        val step = p.staffPosition(Clef.TREBLE).step
        val wrong = MusicKit.wrongReadings(p, Clef.TREBLE, null, true, random)
        return Exercises.choice(
            id = "$tag.read.${p.scientificName}", key = "music.note.treble.${p.scientificName}", prompt = "Wie heißt diese Note?",
            correct = p.germanName, wrong = wrong,
            explanation = "${p.germanName} liegt im Violinschlüssel ${MusicKit.phrase(step)}.",
            media = MusicKit.staff(Clef.TREBLE, listOf(p)), random = random,
        )
    }

    fun readType(random: LearnRandom, level: Int): LearnExercise? {
        val p = pitch(level, random) ?: return null
        val step = p.staffPosition(Clef.TREBLE).step
        return MusicKit.typedNote(
            id = "$tag.type.${p.scientificName}", key = "music.note.treble.${p.scientificName}", prompt = "Schreibe den Namen dieser Note.",
            answer = p, explanation = "${p.germanName} liegt im Violinschlüssel ${MusicKit.phrase(step)}.",
            media = MusicKit.staff(Clef.TREBLE, listOf(p)),
        )
    }

    fun place(random: LearnRandom, level: Int): LearnExercise? {
        val p = pitch(level, random) ?: return null
        val step = p.staffPosition(Clef.TREBLE).step
        val wrong = listOf(1, -1, 2, -2).map { pitchAtStep(step + it, Clef.TREBLE).germanName }
        return Exercises.choice(
            id = "$tag.place.${p.scientificName}", key = "music.note.treble.${p.scientificName}",
            prompt = "Welche Note liegt im Violinschlüssel ${MusicKit.phrase(step)}?", correct = p.germanName, wrong = wrong,
            explanation = "${p.germanName} liegt im Violinschlüssel ${MusicKit.phrase(step)}.", random = random,
        )
    }

    /** Four notes of different names, taken from the pool. */
    fun distinctLetters(pool: List<Pitch>, count: Int, random: LearnRandom): List<Pitch> {
        val chosen = mutableListOf<Pitch>()
        for (p in random.shuffled(pool)) {
            if (chosen.any { it.letter == p.letter }) continue
            chosen.add(p)
            if (chosen.size == count) break
        }
        return chosen
    }

    fun pairs(random: LearnRandom, level: Int): LearnExercise? {
        val chosen = distinctLetters(upTo(level), 4, random)
        if (chosen.size != 4) return null
        val items = chosen.mapNotNull { p ->
            val text = p.staffPosition(Clef.TREBLE).description ?: return@mapNotNull null
            PairItem("music.note.treble.${p.scientificName}", p.germanName, text)
        }
        if (items.size != 4) return null
        val id = "$tag.pairs." + chosen.map { it.scientificName }.sorted().joinToString("")
        return Exercises.pairs(id = id, prompt = "Wo liegt die Note im Violinschlüssel?", items = items, random = random)
    }

    fun bank(random: LearnRandom, level: Int): LearnExercise? {
        val chosen = distinctLetters(upTo(level), 4, random)
        if (chosen.size != 4) return null
        val others = random.shuffled((0 until 7).filter { letter -> chosen.none { it.letter == letter } })
        val extra = others.take(2).map { letterNames[it] }
        val words = chosen.map { it.germanName }
        return Exercises.bank(
            id = "$tag.bank." + chosen.joinToString("-") { it.scientificName }, key = "music.bank.treble",
            prompt = "Wie heißen die Noten? Lege sie der Reihe nach.", words = words, extra = extra,
            media = MusicKit.staff(Clef.TREBLE, chosen), random = random,
        )
    }

    fun terms(random: LearnRandom, level: Int): LearnExercise? =
        Exercises.pairs(
            id = "$tag.terms", prompt = "Was bedeutet das Wort?",
            items = listOf(
                PairItem("music.term.system", "Notensystem", "fünf Linien"),
                PairItem("music.term.violin", "Violinschlüssel", "G-Schlüssel"),
                PairItem("music.term.ledger", "Hilfslinie", "kurzer Strich außerhalb des Systems"),
                PairItem("music.term.space", "Zwischenraum", "Platz zwischen zwei Linien"),
            ),
            random = random,
        )

    fun fact(random: LearnRandom, level: Int): LearnExercise? = MusicKit.fact(facts, level, tag, random)

    val facts: List<MusicFact> = listOf(
        MusicFact("lines", 1, "Wie viele Linien hat ein Notensystem?", "5", listOf("4", "6", "3"),
            "Ein Notensystem hat fünf Linien und vier Zwischenräume."),
        MusicFact("spaces", 1, "Wie viele Zwischenräume hat ein Notensystem?", "4", listOf("3", "5", "6"),
            "Vier Zwischenräume liegen zwischen den fünf Linien."),
        MusicFact("count", 1, "Von wo aus zählt man die Linien?", "von unten nach oben",
            listOf("von oben nach unten", "von der mittleren Linie aus"), "Die unterste Linie ist die 1. Linie."),
        MusicFact("gclef", 1, "Der Violinschlüssel heißt auch G-Schlüssel. Welche Linie markiert er?", "2. Linie",
            listOf("1. Linie", "3. Linie", "4. Linie"), "Die Schnecke des Violinschlüssels legt sich um die 2. Linie: dort liegt das G."),
        MusicFact("high", 2, "Eine Note steht höher im Notensystem. Wie klingt sie?", "höher",
            listOf("tiefer", "lauter", "länger"), "Je höher eine Note steht, desto höher ist der Ton."),
        MusicFact("between", 2, "Welche Note liegt im Violinschlüssel im Zwischenraum zwischen den Linien E und G?", "F",
            listOf("D", "A", "H"), "Zwischen E und G liegt F: Die Buchstaben folgen aufeinander."),
        MusicFact("ledger", 3, "Was ist eine Hilfslinie?", "ein kurzer Strich über oder unter dem System",
            listOf("der Strich zwischen zwei Takten", "der Bogen, der zwei Noten verbindet"),
            "Hilfslinien verlängern das Notensystem nach oben oder unten."),
        MusicFact("middlec", 3, "Wo liegt das eingestrichene C im Violinschlüssel?", "auf der 1. Hilfslinie unter dem System",
            listOf("auf der 1. Linie", "im 1. Zwischenraum", "unter der 1. Linie"),
            "Das eingestrichene C sitzt auf einer kurzen Hilfslinie unter den fünf Linien.",
            MusicKit.staff(Clef.TREBLE, listOf(n(0, 4)))),
    )

    val def = MusicUnitDef(
        makers = mapOf<String, MusicMaker>(
            "fact" to ::fact, "read" to ::read, "readType" to ::readType, "place" to ::place, "pairs" to ::pairs,
            "bank" to ::bank, "terms" to ::terms,
        ),
        lessons = listOf(
            listOf("fact", "fact", "read", "read", "read", "place", "pairs", "bank", "readType", "readType"),
            listOf("fact", "read", "read", "read", "place", "place", "pairs", "bank", "readType", "readType", "readType"),
            listOf("fact", "fact", "read", "read", "read", "place", "terms", "bank", "readType", "readType"),
        ),
        practice = listOf("fact", "read", "read", "read", "place", "pairs", "terms", "bank", "readType", "readType", "readType", "readType"),
        checkpoint = listOf("fact", "fact", "read", "read", "read", "read", "place", "place", "pairs", "bank", "readType", "readType", "readType", "readType"),
        review = listOf("read", "readType", "place", "pairs"),
    )
}
