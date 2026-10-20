package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.Clef
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.PairItem
import de.maxifrz.lernwerk.learn.Pitch

/** Unit 2: the bass clef and the keyboard. A port of MusicUnit2.swift. */
object MusicUnit2 {
    const val tag = "music.u02"
    private fun n(letter: Int, octave: Int, alteration: Int = 0): Pitch = MusicKit.note(letter, octave, alteration)

    /** The lines of the bass clef, then its spaces and the notes beyond the staff. */
    val freshBass: List<List<Pitch>> = listOf(
        listOf(n(4, 2), n(6, 2), n(1, 3), n(3, 3), n(5, 3)),
        listOf(n(5, 2), n(0, 3), n(2, 3), n(4, 3), n(3, 2), n(6, 3), n(0, 4)),
        emptyList(),
    )
    val allBass: List<Pitch> get() = freshBass.flatten()
    fun upTo(level: Int): List<Pitch> = if (level >= 3) allBass else freshBass.take(level).flatten()

    fun bass(level: Int, random: LearnRandom): Pitch? {
        val fresh = if (level >= 4) allBass else freshBass[level - 1]
        return MusicKit.draw(fresh, upTo(level), level, random)
    }

    private fun sentence(p: Pitch, clef: Clef): String =
        "${p.germanName} liegt im ${MusicKit.clefWord(clef)} ${MusicKit.phrase(p.staffPosition(clef).step)}."

    fun read(random: LearnRandom, level: Int): LearnExercise? {
        val p = bass(level, random) ?: return null
        val wrong = MusicKit.wrongReadings(p, Clef.BASS, Clef.TREBLE, true, random)
        return Exercises.choice(
            id = "$tag.read.${p.scientificName}", key = "music.note.bass.${p.scientificName}", prompt = "Wie heißt diese Note im Bassschlüssel?",
            correct = p.germanName, wrong = wrong, explanation = sentence(p, Clef.BASS), media = MusicKit.staff(Clef.BASS, listOf(p)), random = random,
        )
    }

    fun readType(random: LearnRandom, level: Int): LearnExercise? {
        val p = bass(level, random) ?: return null
        return MusicKit.typedNote(
            id = "$tag.type.${p.scientificName}", key = "music.note.bass.${p.scientificName}", prompt = "Schreibe den Namen dieser Note.",
            answer = p, explanation = sentence(p, Clef.BASS), media = MusicKit.staff(Clef.BASS, listOf(p)),
        )
    }

    /** A note in either clef. */
    fun readMixed(random: LearnRandom, level: Int): LearnExercise? {
        val useBass = randomBool(random)
        val clef = if (useBass) Clef.BASS else Clef.TREBLE
        val p = (if (useBass) bass(4, random) else MusicKit.pick(MusicUnit1.all, random)) ?: return null
        val wrong = MusicKit.wrongReadings(p, clef, if (useBass) Clef.TREBLE else Clef.BASS, true, random)
        return Exercises.choice(
            id = "$tag.mixed.${clef.raw}.${p.scientificName}", key = "music.note.${clef.raw}.${p.scientificName}",
            prompt = "Wie heißt diese Note im ${MusicKit.clefWord(clef)}?", correct = p.germanName, wrong = wrong,
            explanation = sentence(p, clef), media = MusicKit.staff(clef, listOf(p)), random = random,
        )
    }

    fun compare(random: LearnRandom, level: Int): LearnExercise? {
        val step = random.randomElement((0..8).toList()) ?: return null
        val treble = pitchAtStep(step, Clef.TREBLE)
        val low = pitchAtStep(step, Clef.BASS)
        val wrong = listOf(treble.germanName) + listOf(1, -1, 2).map { pitchAtStep(step + it, Clef.BASS).germanName }
        return Exercises.choice(
            id = "$tag.compare.$step", key = "music.compare.$step",
            prompt = "Eine Note liegt ${MusicKit.phrase(step)}. Im Violinschlüssel heißt sie ${treble.germanName}. Wie heißt sie im Bassschlüssel?",
            correct = low.germanName, wrong = wrong,
            explanation = "Die Linien und Zwischenräume bleiben gleich, aber der Bassschlüssel hat andere Namen: hier ${low.germanName}.",
            random = random,
        )
    }

    fun place(random: LearnRandom, level: Int): LearnExercise? {
        val p = bass(level, random) ?: return null
        val step = p.staffPosition(Clef.BASS).step
        val wrong = listOf(1, -1, 2, -2).map { pitchAtStep(step + it, Clef.BASS).germanName }
        return Exercises.choice(
            id = "$tag.place.${p.scientificName}", key = "music.note.bass.${p.scientificName}",
            prompt = "Welche Note liegt im Bassschlüssel ${MusicKit.phrase(step)}?", correct = p.germanName, wrong = wrong,
            explanation = sentence(p, Clef.BASS), random = random,
        )
    }

    fun pairs(random: LearnRandom, level: Int): LearnExercise? {
        val chosen = MusicUnit1.distinctLetters(upTo(level), 4, random)
        if (chosen.size != 4) return null
        val items = chosen.mapNotNull { p ->
            val text = p.staffPosition(Clef.BASS).description ?: return@mapNotNull null
            PairItem("music.note.bass.${p.scientificName}", p.germanName, text)
        }
        if (items.size != 4) return null
        return Exercises.pairs(
            id = "$tag.pairs." + chosen.map { it.scientificName }.sorted().joinToString(""), prompt = "Wo liegt die Note im Bassschlüssel?",
            items = items, random = random,
        )
    }

    fun bank(random: LearnRandom, level: Int): LearnExercise? {
        val chosen = MusicUnit1.distinctLetters(upTo(level), 4, random)
        if (chosen.size != 4) return null
        val others = random.shuffled((0 until 7).filter { letter -> chosen.none { it.letter == letter } })
        return Exercises.bank(
            id = "$tag.bank." + chosen.joinToString("-") { it.scientificName }, key = "music.bank.bass",
            prompt = "Wie heißen die Noten im Bassschlüssel? Lege sie der Reihe nach.", words = chosen.map { it.germanName },
            extra = others.take(2).map { letterNames[it] }, media = MusicKit.staff(Clef.BASS, chosen), random = random,
        )
    }

    private val keyHints = listOf(
        "Das C liegt links neben der Gruppe aus zwei schwarzen Tasten.",
        "Das D liegt zwischen den zwei schwarzen Tasten.",
        "Das E liegt rechts neben der Gruppe aus zwei schwarzen Tasten.",
        "Das F liegt links neben der Gruppe aus drei schwarzen Tasten.",
        "Das G liegt zwischen der ersten und der zweiten schwarzen Taste der Dreiergruppe.",
        "Das A liegt zwischen der zweiten und der dritten schwarzen Taste der Dreiergruppe.",
        "Das H liegt rechts neben der Gruppe aus drei schwarzen Tasten.",
    )

    /** Tap a key by name, in one octave when the question names it, in any octave otherwise. */
    fun key(random: LearnRandom, level: Int): LearnExercise? {
        val letter = random.randomElement((0 until 7).toList()) ?: return null
        val octave = random.randomElement(listOf(3, 4, 4, 5)) ?: return null
        val p = n(letter, octave)
        val hint = keyHints[letter]
        val coin = randomBool(random)
        val text = if (coin) MusicKit.octaveText(p) else null
        if (text != null) {
            return Exercises.key(
                id = "$tag.key.${p.scientificName}", key = "music.key.${p.germanName}", prompt = "Tippe $text.", midi = listOf(p.midi),
                solution = "${p.germanName}$octave", explanation = hint,
            )
        }
        return Exercises.key(
            id = "$tag.key.any.${p.germanName}", key = "music.key.${p.germanName}", prompt = "Tippe ein ${p.germanName}.", midi = MusicKit.keys(p),
            solution = p.germanName, explanation = hint,
        )
    }

    fun keyStaff(random: LearnRandom, level: Int): LearnExercise? {
        val useBass = randomBool(random)
        val p = (if (useBass) MusicKit.pick(allBass, random) else MusicKit.pick(MusicUnit1.all, random)) ?: return null
        val clef = if (useBass) Clef.BASS else Clef.TREBLE
        return Exercises.key(
            id = "$tag.keystaff.${clef.raw}.${p.scientificName}", key = "music.note.${clef.raw}.${p.scientificName}",
            prompt = "Tippe diese Note auf der Klaviatur.", midi = listOf(p.midi), solution = p.germanName,
            explanation = sentence(p, clef), media = MusicKit.staff(clef, listOf(p)),
        )
    }

    fun terms(random: LearnRandom, level: Int): LearnExercise? =
        Exercises.pairs(
            id = "$tag.terms", prompt = "Was gehört zusammen?",
            items = listOf(
                PairItem("music.term.violin", "Violinschlüssel", "G-Schlüssel"),
                PairItem("music.term.bass", "Bassschlüssel", "F-Schlüssel"),
                PairItem("music.term.middlec", "Das eingestrichene c", "liegt etwa in der Mitte der Klaviatur"),
                PairItem("music.term.black", "Schwarze Tasten", "stehen in Gruppen zu zwei und drei"),
            ),
            random = random,
        )

    fun fact(random: LearnRandom, level: Int): LearnExercise? = MusicKit.fact(facts, level, tag, random)

    val facts: List<MusicFact> = listOf(
        MusicFact("fclef", 1, "Welcher Buchstabe gehört zum Bassschlüssel?", "F", listOf("G", "C", "A"),
            "Der Bassschlüssel heißt auch F-Schlüssel."),
        MusicFact("dots", 1, "Zwischen den zwei Punkten des Bassschlüssels liegt eine Linie. Welche?", "4. Linie",
            listOf("2. Linie", "3. Linie", "5. Linie"), "Die Punkte umfassen die 4. Linie, auf der das F liegt."),
        MusicFact("low", 1, "Wofür wird der Bassschlüssel meistens gebraucht?", "für tiefe Töne",
            listOf("für hohe Töne", "für laute Töne", "für kurze Töne"), "Tiefe Instrumente und die linke Hand am Klavier lesen oft im Bassschlüssel."),
        MusicFact("c4bass", 2, "Wo liegt das eingestrichene C im Bassschlüssel?", "auf der 1. Hilfslinie über dem System",
            listOf("auf der 1. Hilfslinie unter dem System", "im 4. Zwischenraum", "auf der 5. Linie"),
            "Über der obersten Linie A folgen H und dann C auf der Hilfslinie.", MusicKit.staff(Clef.BASS, listOf(n(0, 4)))),
        MusicFact("blackgroups", 3, "Wie sind die schwarzen Tasten angeordnet?", "abwechselnd zu zwei und zu drei",
            listOf("alle einzeln", "immer zu dritt", "immer zu zweit"), "Zwei und drei schwarze Tasten wechseln sich ab; so findet man sich zurecht."),
        MusicFact("cleft", 3, "Welche weiße Taste liegt links neben den zwei schwarzen Tasten?", "C", listOf("D", "E", "F"),
            "Das C liegt direkt links von der Zweiergruppe."),
        MusicFact("fleft", 3, "Welche weiße Taste liegt links neben den drei schwarzen Tasten?", "F", listOf("C", "G", "H"),
            "Das F liegt direkt links von der Dreiergruppe."),
        MusicFact("octaveName", 3, "Wie heißt die Oktave, in der das mittlere C liegt?", "eingestrichene Oktave",
            listOf("kleine Oktave", "große Oktave", "zweigestrichene Oktave"), "Das mittlere C ist das eingestrichene c."),
        MusicFact("smallc", 3, "Wie heißt das C eine Oktave unter dem eingestrichenen c?", "kleines c",
            listOf("großes C", "zweigestrichenes c", "eingestrichenes c"), "Eine Oktave tiefer beginnt die kleine Oktave mit dem kleinen c."),
    )

    val def = MusicUnitDef(
        makers = mapOf<String, MusicMaker>(
            "fact" to ::fact, "read" to ::read, "readType" to ::readType, "readMixed" to ::readMixed, "compare" to ::compare,
            "place" to ::place, "pairs" to ::pairs, "bank" to ::bank, "key" to ::key, "keyStaff" to ::keyStaff, "terms" to ::terms,
        ),
        lessons = listOf(
            listOf("fact", "fact", "read", "read", "read", "place", "compare", "pairs", "bank", "readType", "readType"),
            listOf("fact", "read", "read", "readMixed", "place", "compare", "keyStaff", "pairs", "bank", "readType", "readType"),
            listOf("fact", "fact", "key", "key", "key", "keyStaff", "keyStaff", "terms", "readMixed", "bank", "readType", "readType"),
        ),
        practice = listOf("fact", "read", "readMixed", "key", "keyStaff", "compare", "readType", "readType", "~", "~", "~", "~"),
        checkpoint = listOf("fact", "fact", "read", "readMixed", "readMixed", "place", "compare", "pairs", "terms", "key", "key", "keyStaff", "readType", "readType"),
        review = listOf("read", "readType", "key", "keyStaff"),
    )
}
