package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.Clef
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.PairItem
import de.maxifrz.lernwerk.learn.Pitch
import de.maxifrz.lernwerk.learn.ToneSpec

/** Unit 4: sharps, flats, naturals, black keys, half and whole steps. A port of MusicUnit4.swift. */
object MusicUnit4 {
    const val tag = "music.u04"
    private fun n(letter: Int, octave: Int, alteration: Int = 0): Pitch = MusicKit.note(letter, octave, alteration)

    /** Letters that can be raised or lowered to a note with its own name (no Eis, His, Fes or Ces). */
    val raisable = listOf(0, 1, 3, 4, 5)
    val lowerable = listOf(6, 2, 5, 1, 4)

    fun accidental(random: LearnRandom): Pitch? {
        val sharp = random.randomElement(listOf(true, false)) ?: return null
        val octave = random.randomElement(listOf(4, 5)) ?: return null
        val letter = random.randomElement(if (sharp) raisable else lowerable) ?: return null
        return n(letter, octave, if (sharp) 1 else -1)
    }

    private fun sentence(p: Pitch): String {
        val base = letterNames[p.letter]
        return if (p.alteration > 0) "${p.germanName} ist $base mit Kreuz: einen Halbton höher."
        else "${p.germanName} ist $base mit Be: einen Halbton tiefer."
    }

    fun acc(random: LearnRandom, level: Int): LearnExercise? {
        val p = accidental(random) ?: return null
        val wrong = MusicKit.wrongNames(p, false, random)
        return Exercises.choice(
            id = "$tag.acc.${p.scientificName}", key = "music.acc.${p.germanName}", prompt = "Wie heißt diese Note?", correct = p.germanName, wrong = wrong,
            explanation = sentence(p), media = MusicKit.staff(Clef.TREBLE, listOf(p)), random = random,
        )
    }

    fun accType(random: LearnRandom, level: Int): LearnExercise? {
        val p = accidental(random) ?: return null
        return MusicKit.typedNote(
            id = "$tag.acctype.${p.scientificName}", key = "music.acc.${p.germanName}", prompt = "Schreibe den Namen dieser Note.", answer = p,
            explanation = sentence(p), media = MusicKit.staff(Clef.TREBLE, listOf(p)),
        )
    }

    /** Two notes a half or a whole step apart, as a lower and an upper pitch. */
    fun stepPair(random: LearnRandom): Pair<Pitch, Pitch>? {
        for (attempt in 0 until 20) {
            val letter = random.randomElement((0 until 7).toList()) ?: return null
            val kind = random.randomElement((0 until 4).toList()) ?: return null
            val octave = 4
            val lower: Pitch
            val upper: Pitch
            val nextLetter = (letter + 1) % 7
            val nextOctave = if (letter == 6) octave + 1 else octave
            when (kind) {
                0 -> { lower = n(letter, octave); upper = n(nextLetter, nextOctave) }
                1 -> { lower = n(letter, octave); upper = n(letter, octave, 1) }
                2 -> { lower = n(letter, octave); upper = n(nextLetter, nextOctave, -1) }
                else -> {
                    if (!raisable.contains(letter)) continue
                    lower = n(letter, octave, 1); upper = n(nextLetter, nextOctave)
                }
            }
            if (upper.midi - lower.midi in 1..2) return lower to upper
        }
        return null
    }

    fun stepKind(random: LearnRandom, level: Int): LearnExercise? {
        val (lower, upper) = stepPair(random) ?: return null
        val semis = upper.midi - lower.midi
        val answer = if (semis == 1) "Halbton" else "Ganzton"
        return Exercises.choice(
            id = "$tag.step.${lower.scientificName}.${upper.scientificName}", key = "music.step", prompt = "Wie groß ist der Schritt zwischen den beiden Noten?",
            correct = answer, wrong = listOf(if (semis == 1) "Ganzton" else "Halbton"),
            explanation = "Von ${lower.germanName} nach ${upper.germanName} sind es $semis Halbton" + (if (semis == 1) "." else "schritte."),
            media = MusicKit.staff(Clef.TREBLE, listOf(lower, upper)), random = random,
        )
    }

    fun hearStep(random: LearnRandom, level: Int): LearnExercise? {
        val start = random.randomElement((57..69).toList()) ?: return null
        val semis = random.randomElement(listOf(1, 2)) ?: return null
        val answer = if (semis == 1) "Halbton" else "Ganzton"
        return Exercises.choice(
            id = "$tag.hear.$start.$semis", key = "music.hearstep", prompt = "Hör hin: Ist der Schritt ein Halbton oder ein Ganzton?", correct = answer,
            wrong = listOf(if (semis == 1) "Ganzton" else "Halbton"), explanation = "Ein Halbton ist ein Schritt zur nächsten Taste, ein Ganzton sind zwei Tasten.",
            media = ExerciseMedia.Tones(ToneSpec(listOf(start, start + semis))), random = random,
        )
    }

    private fun place(p: Pitch): String {
        val base = letterNames[p.letter]
        if (p.alteration > 0) return "${p.germanName} liegt als schwarze Taste direkt rechts neben $base."
        return "${p.germanName} liegt als schwarze Taste direkt links neben $base."
    }

    fun keyBlack(random: LearnRandom, level: Int): LearnExercise? {
        val p = accidental(random) ?: return null
        val p4 = n(p.letter, 4, p.alteration)
        val coin = randomBool(random)
        val text = if (coin) MusicKit.octaveText(p4) else null
        if (text != null) {
            return Exercises.key(
                id = "$tag.key.${p4.scientificName}", key = "music.acc.${p.germanName}", prompt = "Tippe $text.", midi = listOf(p4.midi),
                solution = p.germanName, explanation = place(p),
            )
        }
        return Exercises.key(
            id = "$tag.key.any.${p.germanName}", key = "music.acc.${p.germanName}", prompt = "Tippe ein ${p.germanName}.", midi = MusicKit.keys(p),
            solution = p.germanName, explanation = place(p),
        )
    }

    private val enharmonic: List<Pair<String, String>> = listOf("Cis" to "Des", "Dis" to "Es", "Fis" to "Ges", "Gis" to "As", "Ais" to "B")

    fun enharmPairs(random: LearnRandom, level: Int): LearnExercise? {
        val chosen = random.shuffled(enharmonic).take(4)
        return Exercises.pairs(
            id = "$tag.enh." + chosen.map { it.first }.sorted().joinToString("-"), prompt = "Welche Namen gehören zur selben Taste?",
            items = chosen.map { PairItem("music.enh.${it.first}", it.first, it.second) }, random = random,
        )
    }

    fun enharmChoice(random: LearnRandom, level: Int): LearnExercise? {
        val pair = MusicKit.pick(enharmonic, random) ?: return null
        val asSharp = random.randomElement(listOf(true, false)) ?: return null
        val given = if (asSharp) pair.first else pair.second
        val answer = if (asSharp) pair.second else pair.first
        val parsed = MusicNames.parse(answer) ?: return null
        val wrong = MusicKit.wrongNames(n(parsed.letter, 4, parsed.alteration), false, random)
        return Exercises.choice(
            id = "$tag.enh.$given", key = "music.enh.${pair.first}", prompt = "Welcher Name gehört zur selben schwarzen Taste wie $given?", correct = answer,
            wrong = wrong, explanation = "${pair.first} und ${pair.second} sind dieselbe Taste.", random = random,
        )
    }

    fun raise(random: LearnRandom, level: Int): LearnExercise? {
        val letter = MusicKit.pick(raisable, random) ?: return null
        val base = n(letter, 4)
        val result = n(letter, 4, 1)
        return MusicKit.typedNote(
            id = "$tag.raise.${base.germanName}", key = "music.acc.${result.germanName}", prompt = "Erhöhe ${base.germanName} um einen Halbton. Wie heißt der neue Ton?",
            answer = result, explanation = "Erhöhte Töne bekommen die Endung -is.",
        )
    }

    fun lower(random: LearnRandom, level: Int): LearnExercise? {
        val letter = MusicKit.pick(lowerable, random) ?: return null
        val base = n(letter, 4)
        val result = n(letter, 4, -1)
        return MusicKit.typedNote(
            id = "$tag.lower.${base.germanName}", key = "music.acc.${result.germanName}", prompt = "Erniedrige ${base.germanName} um einen Halbton. Wie heißt der neue Ton?",
            answer = result, explanation = "Erniedrigte Töne bekommen die Endung -es; E wird Es, A wird As und H wird B.",
        )
    }

    fun terms(random: LearnRandom, level: Int): LearnExercise? =
        Exercises.pairs(
            id = "$tag.terms", prompt = "Was bedeutet das Wort?",
            items = listOf(
                PairItem("music.term.sharp", "Kreuz", "erhöht um einen Halbton"),
                PairItem("music.term.flat", "Be", "erniedrigt um einen Halbton"),
                PairItem("music.term.natural", "Auflösungszeichen", "hebt Kreuz oder Be wieder auf"),
                PairItem("music.term.semitone", "Halbton", "kleinster Abstand zwischen zwei Tasten"),
            ),
            random = random,
        )

    fun bank(random: LearnRandom, level: Int): LearnExercise? {
        val start = random.randomElement(listOf(0, 1, 3, 4, 5)) ?: return null
        val first = n(start, 4)
        val notes = (0 until 5).map { spelled(first.midi + it) }
        return Exercises.bank(
            id = "$tag.bank.${first.germanName}", key = "music.bank.chromatic", prompt = "Wie heißen die Noten? Lege sie der Reihe nach.",
            words = notes.map { it.germanName }, explanation = "Hier geht es in Halbtonschritten aufwärts.", media = MusicKit.staff(Clef.TREBLE, notes), random = random,
        )
    }

    fun fact(random: LearnRandom, level: Int): LearnExercise? = MusicKit.fact(facts, level, tag, random)

    val facts: List<MusicFact> = listOf(
        MusicFact("sharp", 1, "Was bewirkt ein Kreuz vor einer Note?", "Der Ton wird einen Halbton höher.",
            listOf("Der Ton wird einen Halbton tiefer.", "Der Ton wird einen Ganzton höher.", "Der Ton wird aufgehoben."),
            "Das Kreuz erhöht um einen Halbton."),
        MusicFact("flat", 1, "Welches Zeichen erniedrigt eine Note um einen Halbton?", "Be", listOf("Kreuz", "Auflösungszeichen"),
            "Das Be erniedrigt um einen Halbton."),
        MusicFact("natural", 1, "Welches Zeichen hebt ein Kreuz oder ein Be wieder auf?", "Auflösungszeichen", listOf("Kreuz", "Be"),
            "Das Auflösungszeichen macht den Ton wieder zur weißen Taste."),
        MusicFact("bar", 1, "Wie lange gilt ein Vorzeichen vor einer Note?", "bis zum Ende des Taktes",
            listOf("bis zum Ende des Stücks", "bis zur nächsten Pause", "nur für die nächste Note im nächsten Takt"),
            "Ein Vorzeichen gilt für denselben Ton bis zum Taktstrich."),
        MusicFact("cis", 1, "Was ist Cis?", "C, einen Halbton erhöht",
            listOf("C, einen Halbton erniedrigt", "D, einen Halbton erhöht", "C, einen Ganzton erhöht"), "Die Endung -is zeigt einen erhöhten Ton an."),
        MusicFact("des", 1, "Was ist Des?", "D, einen Halbton erniedrigt",
            listOf("D, einen Halbton erhöht", "C, einen Halbton erniedrigt", "D, einen Ganzton erniedrigt"), "Die Endung -es zeigt einen erniedrigten Ton an."),
        MusicFact("hb", 1, "Wie heißt H mit einem Be?", "B", listOf("Hes", "His", "Ces"), "H mit Be heißt B."),
        MusicFact("es", 1, "Wie heißt E mit einem Be?", "Es", listOf("Eis", "Fes", "Des"), "E mit Be heißt Es."),
        MusicFact("as", 1, "Wie heißt A mit einem Be?", "As", listOf("Ais", "Ges", "G"), "A mit Be heißt As."),
        MusicFact("whole", 2, "Wie viele Halbtöne sind ein Ganzton?", "2", listOf("1", "3", "4"), "Ein Ganzton besteht aus zwei Halbtönen."),
        MusicFact("semitone", 2, "Was ist ein Halbton?", "der Schritt zur nächsten Taste",
            listOf("der Schritt zur übernächsten Taste", "der Schritt von C nach D", "der Abstand einer Oktave"), "Der Halbton ist der kleinste Schritt auf dem Klavier."),
        MusicFact("hc", 2, "Zwischen welchen weißen Tasten liegt ein Halbton?", "H und C", listOf("C und D", "D und E", "G und A"),
            "Zwischen H und C gibt es keine schwarze Taste."),
        MusicFact("ef", 2, "Zwischen welchen weißen Tasten liegt ein Halbton?", "E und F", listOf("F und G", "A und H", "D und E"),
            "Zwischen E und F gibt es keine schwarze Taste."),
        MusicFact("black", 2, "Wie viele schwarze Tasten hat eine Oktave?", "5", listOf("7", "4", "12"), "Zwei und drei schwarze Tasten ergeben fünf."),
        MusicFact("twelve", 2, "Wie viele Halbtonschritte hat eine Oktave?", "12", listOf("7", "8", "10"), "Sieben weiße und fünf schwarze Tasten ergeben zwölf."),
        MusicFact("sameKey", 3, "Was gilt für Cis und Des?", "Sie sind dieselbe Taste mit zwei Namen.",
            listOf("Cis ist höher als Des.", "Cis ist tiefer als Des.", "Beide sind weiße Tasten."), "Das nennt man enharmonische Verwechslung."),
        MusicFact("enharmonic", 3, "Wie nennt man Töne mit gleicher Taste, aber verschiedenem Namen?", "enharmonisch verwechselt",
            listOf("chromatisch", "diatonisch", "parallel"), "Zum Beispiel Fis und Ges."),
    )

    val def = MusicUnitDef(
        makers = mapOf<String, MusicMaker>(
            "fact" to ::fact, "acc" to ::acc, "accType" to ::accType, "stepKind" to ::stepKind, "hearStep" to ::hearStep,
            "keyBlack" to ::keyBlack, "enharmPairs" to ::enharmPairs, "enharmChoice" to ::enharmChoice, "raise" to ::raise,
            "lower" to ::lower, "terms" to ::terms, "bank" to ::bank,
        ),
        lessons = listOf(
            listOf("fact", "fact", "fact", "acc", "acc", "acc", "terms", "accType", "accType", "accType"),
            listOf("fact", "fact", "stepKind", "stepKind", "hearStep", "hearStep", "keyBlack", "keyBlack", "keyBlack", "acc", "accType", "bank"),
            listOf("fact", "fact", "enharmChoice", "enharmChoice", "enharmPairs", "keyBlack", "raise", "raise", "lower", "lower", "accType", "acc"),
        ),
        practice = listOf("fact", "acc", "stepKind", "hearStep", "keyBlack", "enharmChoice", "enharmPairs", "raise", "lower", "bank", "~", "~"),
        checkpoint = listOf("fact", "fact", "acc", "acc", "accType", "accType", "stepKind", "hearStep", "keyBlack", "keyBlack", "enharmChoice", "enharmPairs", "raise", "lower"),
        review = listOf("acc", "accType", "keyBlack", "stepKind"),
    )
}
