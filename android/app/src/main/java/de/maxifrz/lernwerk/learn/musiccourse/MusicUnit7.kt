package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.Clef
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.PairItem
import de.maxifrz.lernwerk.learn.Pitch
import de.maxifrz.lernwerk.learn.ToneSpec

/** Unit 7: major and minor triads, built, read and heard. A port of MusicUnit7.swift. */
object MusicUnit7 {
    const val tag = "music.u07"
    private fun n(letter: Int, octave: Int, alteration: Int = 0): Pitch = MusicKit.note(letter, octave, alteration)

    private val MAJ = MusicTriadQuality.MAJOR
    private val MIN = MusicTriadQuality.MINOR

    /** The triads of each lesson: major on C, G, F, D; minor on A, E, D; then flats and a few more. */
    val fresh: List<List<MusicTriad>> = listOf(
        listOf(MusicTriad(n(0, 4), MAJ), MusicTriad(n(4, 4), MAJ), MusicTriad(n(3, 4), MAJ), MusicTriad(n(1, 4), MAJ)),
        listOf(MusicTriad(n(5, 4), MIN), MusicTriad(n(2, 4), MIN), MusicTriad(n(1, 4), MIN)),
        listOf(
            MusicTriad(n(2, 4, -1), MAJ), MusicTriad(n(6, 4, -1), MAJ), MusicTriad(n(5, 4, -1), MAJ),
            MusicTriad(n(4, 4), MIN), MusicTriad(n(0, 4), MIN), MusicTriad(n(3, 4), MIN),
        ),
    )
    val all: List<MusicTriad> get() = fresh.flatten()
    fun upTo(level: Int): List<MusicTriad> = if (level >= 4) all else fresh.take(level).flatten()
    fun triad(level: Int, random: LearnRandom): MusicTriad? =
        MusicKit.draw(if (level >= 4) all else fresh[level - 1], upTo(level), level, random)

    private fun tones(t: MusicTriad): String = t.notes.joinToString(" – ") { it.germanName }

    private fun kindWord(t: MusicTriad): String = if (t.quality == MAJ) "Dur" else "Moll"

    fun staffName(random: LearnRandom, level: Int): LearnExercise? {
        val t = triad(level, random) ?: return null
        val wrong = mutableListOf<String>()
        if (level >= 2) wrong.add(MusicTriad(t.root, if (t.quality == MAJ) MIN else MAJ).name)
        val pool = random.shuffled((if (level >= 2) all else fresh[0]).filter { it.name != t.name })
        wrong += pool.map { it.name }
        return Exercises.choice(
            id = "$tag.staff.${t.name}", key = "music.triad.${t.name}", prompt = "Welcher Dreiklang ist das?", correct = t.name, wrong = wrong,
            explanation = "Die Töne sind ${tones(t)}.", media = MusicKit.staff(Clef.TREBLE, t.notes, chord = true), random = random,
        )
    }

    fun staffKind(random: LearnRandom, level: Int): LearnExercise? {
        val t = triad(level, random) ?: return null
        val third = t.notes[1].midi - t.notes[0].midi
        return Exercises.choice(
            id = "$tag.kind.${t.name}", key = "music.triad.${t.name}", prompt = "Ist das ein Dur- oder ein Moll-Dreiklang?", correct = kindWord(t),
            wrong = listOf(if (t.quality == MAJ) "Moll" else "Dur"),
            explanation = "Die Terz liegt $third Halbtöne über dem Grundton: " + (if (t.quality == MAJ) "große Terz, Dur." else "kleine Terz, Moll."),
            media = MusicKit.staff(Clef.TREBLE, t.notes, chord = true), random = random,
        )
    }

    fun hearKind(random: LearnRandom, level: Int): LearnExercise? {
        val t = triad(maxOf(level, 2), random) ?: return null
        val octave = random.randomElement(listOf(3, 4)) ?: return null
        val root = n(t.root.letter, octave, t.root.alteration)
        val notes = MusicTriad(root, t.quality).notes
        return Exercises.choice(
            id = "$tag.hear.${t.name}.$octave", key = "music.triad.${t.name}", prompt = "Hör hin: Dur oder Moll?", correct = kindWord(t),
            wrong = listOf(if (t.quality == MAJ) "Moll" else "Dur"),
            explanation = if (t.quality == MAJ) "Dur klingt hell: Die Terz ist groß." else "Moll klingt dunkler: Die Terz ist klein.",
            media = ExerciseMedia.Tones(ToneSpec(notes.map { it.midi }, true)), random = random,
        )
    }

    fun missing(random: LearnRandom, level: Int): LearnExercise? {
        val t = triad(level, random) ?: return null
        val hidden = random.randomElement(listOf(0, 1, 2)) ?: return null
        val notes = t.notes
        val shown = notes.mapIndexed { i, p -> if (i == hidden) "?" else p.germanName }.joinToString(" – ")
        val wrong = MusicKit.wrongNames(notes[hidden], false, random)
        return Exercises.choice(
            id = "$tag.missing.${t.name}.$hidden", key = "music.triad.${t.name}", prompt = "${t.name}: $shown. Welcher Ton fehlt?", correct = notes[hidden].germanName,
            wrong = wrong, explanation = "${t.name} besteht aus ${tones(t)}.", random = random,
        )
    }

    fun typedPart(random: LearnRandom, level: Int): LearnExercise? {
        val t = triad(level, random) ?: return null
        val part = random.randomElement(listOf(1, 2)) ?: return null
        val word = if (part == 1) "Terz" else "Quinte"
        return MusicKit.typedNote(
            id = "$tag.part.${t.name}.$part", key = "music.triad.${t.name}", prompt = "Wie heißt die $word des ${t.name}-Dreiklangs?", answer = t.notes[part],
            explanation = "${t.name} besteht aus ${tones(t)}.",
        )
    }

    fun buildBank(random: LearnRandom, level: Int): LearnExercise? {
        val t = triad(level, random) ?: return null
        val notes = t.notes
        val otherThird = MusicTriad(t.root, if (t.quality == MAJ) MIN else MAJ).notes[1]
        val extra = listOf(otherThird.germanName) + MusicKit.wrongNames(notes[2], false, random).take(1)
        return Exercises.bank(
            id = "$tag.bank.${t.name}", key = "music.triad.${t.name}", prompt = "Baue den ${t.name}-Dreiklang. Lege Grundton, Terz und Quinte der Reihe nach.",
            words = notes.map { it.germanName }, extra = extra, explanation = "Dur: große Terz und kleine Terz. Moll: kleine Terz und große Terz.", random = random,
        )
    }

    fun pairs(random: LearnRandom, level: Int): LearnExercise? {
        val pool = upTo(if (level == 3) 3 else level)
        val chosen = random.shuffled(pool).take(4)
        if (chosen.size != 4) return null
        return Exercises.pairs(
            id = "$tag.pairs." + chosen.map { it.name }.sorted().joinToString("-"), prompt = "Welche Töne gehören zum Dreiklang?",
            items = chosen.map { PairItem("music.triad.${it.name}", it.name, tones(it)) }, random = random,
        )
    }

    fun key(random: LearnRandom, level: Int): LearnExercise? {
        val t = triad(level, random) ?: return null
        val part = random.randomElement(listOf(0, 1, 2)) ?: return null
        val word = listOf("den Grundton", "die Terz", "die Quinte")[part]
        return Exercises.key(
            id = "$tag.key.${t.name}.$part", key = "music.triad.${t.name}", prompt = "Tippe $word des ${t.name}-Dreiklangs.", midi = MusicKit.keys(t.notes[part]),
            solution = t.notes[part].germanName, explanation = "${t.name} besteht aus ${tones(t)}.",
        )
    }

    fun fact(random: LearnRandom, level: Int): LearnExercise? = MusicKit.fact(facts, level, tag, random)

    val facts: List<MusicFact> = listOf(
        MusicFact("names", 1, "Wie heißen die drei Töne eines Dreiklangs?", "Grundton, Terz, Quinte",
            listOf("Prim, Sekunde, Terz", "Grundton, Quarte, Sexte", "Terz, Quinte, Septime"), "Die Töne stehen im Abstand von Terzen übereinander."),
        MusicFact("major", 1, "Wie ist ein Dur-Dreiklang aufgebaut?", "große Terz und darüber kleine Terz",
            listOf("kleine Terz und darüber große Terz", "zwei große Terzen", "zwei kleine Terzen"), "C–E ist eine große Terz, E–G eine kleine."),
        MusicFact("cmajor", 1, "Welche Töne hat der C-Dur-Dreiklang?", "C, E, G", listOf("C, Es, G", "C, F, G", "C, E, A"), "Jeder zweite Buchstabe: C E G."),
        MusicFact("minor", 2, "Wie ist ein Moll-Dreiklang aufgebaut?", "kleine Terz und darüber große Terz",
            listOf("große Terz und darüber kleine Terz", "zwei große Terzen", "zwei kleine Terzen"), "A–C ist eine kleine Terz, C–E eine große."),
        MusicFact("change", 2, "Wie wird aus einem Dur-Dreiklang ein Moll-Dreiklang?", "Die Terz wird einen Halbton tiefer.",
            listOf("Die Quinte wird einen Halbton tiefer.", "Der Grundton wird einen Halbton höher.", "Die Terz wird einen Halbton höher."), "C E G wird zu C Es G."),
        MusicFact("fifth", 2, "Wie viele Halbtöne liegen in einem Dur- oder Moll-Dreiklang zwischen Grundton und Quinte?", "7", listOf("5", "6", "8"),
            "Die Quinte ist rein und hat sieben Halbtöne."),
        MusicFact("esdur", 3, "Welche Töne hat der Es-Dur-Dreiklang?", "Es, G, B", listOf("Es, G, H", "Es, Ges, B", "E, G, B"), "Es–G ist eine große Terz, G–B eine kleine."),
        MusicFact("fminor", 3, "Welche Töne hat der F-Moll-Dreiklang?", "F, As, C", listOf("F, A, C", "F, As, Ces", "F, G, C"), "F–As ist eine kleine Terz, As–C eine große."),
        MusicFact("gminor", 3, "Welche Töne hat der G-Moll-Dreiklang?", "G, B, D", listOf("G, H, D", "G, B, Des", "G, A, D"), "G–B ist eine kleine Terz, B–D eine große."),
    )

    val def = MusicUnitDef(
        makers = mapOf<String, MusicMaker>(
            "fact" to ::fact, "staffName" to ::staffName, "staffKind" to ::staffKind, "hearKind" to ::hearKind, "missing" to ::missing,
            "typed" to ::typedPart, "buildBank" to ::buildBank, "pairs" to ::pairs, "key" to ::key,
        ),
        lessons = listOf(
            listOf("fact", "fact", "staffName", "staffName", "missing", "missing", "buildBank", "buildBank", "typed", "typed", "pairs"),
            listOf("fact", "fact", "staffKind", "staffKind", "hearKind", "hearKind", "hearKind", "staffName", "missing", "buildBank", "typed", "key"),
            listOf("fact", "staffName", "staffName", "staffKind", "hearKind", "hearKind", "missing", "missing", "buildBank", "buildBank", "typed", "typed"),
        ),
        practice = listOf("fact", "staffName", "staffKind", "hearKind", "hearKind", "missing", "buildBank", "typed", "pairs", "key", "~", "~"),
        checkpoint = listOf("fact", "fact", "staffName", "staffName", "staffKind", "hearKind", "hearKind", "hearKind", "missing", "buildBank", "typed", "typed", "pairs", "key"),
        review = listOf("staffName", "hearKind", "missing", "typed"),
    )
}
