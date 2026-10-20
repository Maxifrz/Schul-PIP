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

/** Unit 8: key signatures, the circle of fifths and relative minor keys. A port of MusicUnit8.swift. */
object MusicUnit8 {
    const val tag = "music.u08"
    private fun n(letter: Int, octave: Int, alteration: Int = 0): Pitch = MusicKit.note(letter, octave, alteration)

    val freshCounts: List<List<Int>> = listOf(listOf(0, 1, -1, 2, -2), listOf(3, -3, 4, -4), emptyList())
    fun upTo(level: Int): List<Int> = if (level >= 3) (-4..4).toList() else freshCounts.take(level).flatten()
    fun count(level: Int, random: LearnRandom): Int? =
        MusicKit.draw(if (level >= 4) (-4..4).toList() else freshCounts[level - 1], upTo(level), level, random)

    private fun other(count: Int, deltas: List<Int>): List<Int> =
        deltas.map { count + it }.filter { Math.abs(it) <= 5 && it != count }

    private fun restStaff(key: Int): ExerciseMedia =
        ExerciseMedia.Staff(StaffSpec(Clef.TREBLE, listOf(StaffNote(n(6, 4), NoteValue.WHOLE, true)), key, null, false))

    private fun noteStaff(key: Int, p: Pitch): ExerciseMedia =
        ExerciseMedia.Staff(StaffSpec(Clef.TREBLE, listOf(StaffNote(p)), key, null, false))

    fun readKey(random: LearnRandom, level: Int): LearnExercise? {
        val c = count(level, random) ?: return null
        val wrong = (other(c, listOf(1, -1)) + (if (c == 0) emptyList() else listOf(-c)) + other(c, listOf(2, -2))).map { MusicKey.majorName(it) } + listOf(MusicKey.minorName(c))
        return Exercises.choice(
            id = "$tag.read.$c", key = "music.key.$c", prompt = "Welche Dur-Tonart gehört zu dieser Vorzeichnung?", correct = MusicKey.majorName(c), wrong = wrong,
            explanation = "${MusicKey.majorName(c)} hat ${MusicKit.signCount(c)}.", media = restStaff(c), random = random,
        )
    }

    fun readMinor(random: LearnRandom, level: Int): LearnExercise? {
        val c = count(maxOf(level, 3), random) ?: return null
        val wrong = (other(c, listOf(1, -1)) + (if (c == 0) emptyList() else listOf(-c)) + other(c, listOf(2, -2))).map { MusicKey.minorName(it) } + listOf(MusicKey.majorName(c))
        return Exercises.choice(
            id = "$tag.readminor.$c", key = "music.key.$c", prompt = "Welche Molltonart gehört zu dieser Vorzeichnung?", correct = MusicKey.minorName(c), wrong = wrong,
            explanation = "${MusicKey.minorName(c)} hat ${MusicKit.signCount(c)}: dieselben wie ${MusicKey.majorName(c)}.", media = restStaff(c), random = random,
        )
    }

    /** A note between E4 and G5 whose sign comes from the key signature. */
    private fun keyedNote(c: Int, random: LearnRandom): Pitch? {
        var pool = listOf(2 to 4, 3 to 4, 4 to 4, 5 to 4, 6 to 4, 0 to 5, 1 to 5, 2 to 5, 3 to 5, 4 to 5)
        val affected = pool.filter { MusicKey.alteration(it.first, c) != 0 }
        if (affected.isNotEmpty() && random.int(0, 10) < 7) pool = affected
        val (letter, octave) = random.randomElement(pool) ?: return null
        return n(letter, octave, MusicKey.alteration(letter, c))
    }

    fun readNote(random: LearnRandom, level: Int): LearnExercise? {
        val c = count(level, random) ?: return null
        if (c == 0) return null
        val p = keyedNote(c, random) ?: return null
        val wrong = MusicKit.wrongNames(p, false, random)
        return Exercises.choice(
            id = "$tag.note.$c.${p.scientificName}", key = "music.key.note.$c", prompt = "Wie heißt diese Note? Beachte die Vorzeichen am Anfang.", correct = p.germanName,
            wrong = wrong, explanation = "Mit der Vorzeichnung gilt: ${p.germanName}.", media = noteStaff(c, p), random = random,
        )
    }

    fun readNoteType(random: LearnRandom, level: Int): LearnExercise? {
        val c = count(level, random) ?: return null
        if (c == 0) return null
        val p = keyedNote(c, random) ?: return null
        return MusicKit.typedNote(
            id = "$tag.notetype.$c.${p.scientificName}", key = "music.key.note.$c", prompt = "Schreibe den Namen dieser Note. Beachte die Vorzeichen am Anfang.", answer = p,
            explanation = "Mit der Vorzeichnung gilt: ${p.germanName}.", media = noteStaff(c, p),
        )
    }

    fun keyOfCount(random: LearnRandom, level: Int): LearnExercise? {
        val c = count(level, random) ?: return null
        if (c == 0) return null
        val wrong = (other(c, listOf(1, -1)) + listOf(-c) + other(c, listOf(2, -2))).map { MusicKey.majorName(it) }
        return Exercises.choice(
            id = "$tag.keyof.$c", key = "music.key.$c", prompt = "Welche Dur-Tonart hat ${MusicKit.signCount(c)}?", correct = MusicKey.majorName(c), wrong = wrong,
            explanation = "${MusicKey.majorName(c)} hat ${MusicKit.signCount(c)}.", random = random,
        )
    }

    fun keyOfCountType(random: LearnRandom, level: Int): LearnExercise? {
        val c = count(level, random) ?: return null
        if (c == 0) return null
        return Exercises.typed(
            id = "$tag.keyoftype.$c", key = "music.key.$c", prompt = "Welche Dur-Tonart hat ${MusicKit.signCount(c)}?", answer = MusicKey.majorName(c), mode = AnswerMode.EXACT,
            explanation = "Von C-Dur aus ${Math.abs(c)} Quinte" + (if (Math.abs(c) == 1) "" else "n") + (if (c > 0) " aufwärts." else " abwärts."),
        )
    }

    fun countOfKey(random: LearnRandom, level: Int): LearnExercise? {
        val c = count(level, random) ?: return null
        val wrong = (other(c, listOf(1, -1)) + (if (c == 0) emptyList() else listOf(-c)) + other(c, listOf(2, -2))).map { MusicKit.signCount(it) }
        return Exercises.choice(
            id = "$tag.count.$c", key = "music.key.$c", prompt = "Wie viele Vorzeichen hat ${MusicKey.majorName(c)}?", correct = MusicKit.signCount(c), wrong = wrong,
            explanation = if (c == 0) "C-Dur hat keine Vorzeichen." else "Es sind: ${MusicKit.signNames(c)}.", random = random,
        )
    }

    fun orderBank(random: LearnRandom, level: Int): LearnExercise? {
        val sharps = randomBool(random)
        val names = MusicKey.accidentals(if (sharps) 4 else -4).map { it.germanName }
        return Exercises.bank(
            id = "$tag.order.${if (sharps) "sharps" else "flats"}", key = "music.key.order.${if (sharps) "sharps" else "flats"}",
            prompt = "Lege die ersten vier ${if (sharps) "Kreuze" else "Be"} in der Reihenfolge der Vorzeichnung.", words = names,
            explanation = if (sharps) "Kreuze: Fis, Cis, Gis, Dis, Ais, Eis, His." else "Be: B, Es, As, Des, Ges, Ces, Fes.", random = random,
        )
    }

    fun relMinor(random: LearnRandom, level: Int): LearnExercise? {
        val c = count(maxOf(level, 3), random) ?: return null
        return Exercises.typed(
            id = "$tag.relminor.$c", key = "music.key.rel.$c", prompt = "Welche Molltonart ist die Paralleltonart von ${MusicKey.majorName(c)}?", answer = MusicKey.minorName(c), mode = AnswerMode.EXACT,
            explanation = "Der Grundton liegt eine kleine Terz tiefer; beide haben ${MusicKit.signCount(c)}.",
        )
    }

    fun relMinorChoice(random: LearnRandom, level: Int): LearnExercise? {
        val c = count(maxOf(level, 3), random) ?: return null
        val sameTonic = MusicKey.majorTonic(c).germanName + "-Moll"
        val wrong = listOf(sameTonic) + (other(c, listOf(1, -1)) + other(c, listOf(2, -2))).map { MusicKey.minorName(it) }
        return Exercises.choice(
            id = "$tag.relminorchoice.$c", key = "music.key.rel.$c", prompt = "Welche Molltonart ist die Paralleltonart von ${MusicKey.majorName(c)}?", correct = MusicKey.minorName(c),
            wrong = wrong, explanation = "Der Grundton liegt eine kleine Terz tiefer; beide haben ${MusicKit.signCount(c)}.", random = random,
        )
    }

    fun relMajor(random: LearnRandom, level: Int): LearnExercise? {
        val c = count(maxOf(level, 3), random) ?: return null
        return Exercises.typed(
            id = "$tag.relmajor.$c", key = "music.key.rel.$c", prompt = "Zu welcher Durtonart gehört ${MusicKey.minorName(c)} als Paralleltonart?", answer = MusicKey.majorName(c), mode = AnswerMode.EXACT,
            explanation = "Der Grundton der Durtonart liegt eine kleine Terz höher; beide haben ${MusicKit.signCount(c)}.",
        )
    }

    fun circle(random: LearnRandom, level: Int): LearnExercise? {
        val up = randomBool(random)
        val c = count(maxOf(level, 2), random) ?: return null
        if (Math.abs(c + (if (up) 1 else -1)) > 4) return null
        val answer = c + (if (up) 1 else -1)
        val wrong = listOf(c + (if (up) -1 else 1), c + (if (up) 2 else -2), c + (if (up) -2 else 2)).filter { Math.abs(it) <= 5 }.map { MusicKey.majorName(it) }
        return Exercises.choice(
            id = "$tag.circle.$c.${if (up) "up" else "down"}", key = "music.key.circle.$c",
            prompt = "Welche Tonart liegt im Quintenzirkel eine Quinte ${if (up) "über" else "unter"} ${MusicKey.majorName(c)}?", correct = MusicKey.majorName(answer), wrong = wrong,
            explanation = "Eine Quinte ${if (up) "aufwärts bringt ein Kreuz mehr" else "abwärts bringt ein Be mehr"}: ${MusicKey.majorName(answer)} hat ${MusicKit.signCount(answer)}.", random = random,
        )
    }

    fun circleBank(random: LearnRandom, level: Int): LearnExercise? {
        val up = randomBool(random)
        val words = (0..3).map { MusicKey.majorName(if (up) it else -it) }
        val extra = if (up) listOf(MusicKey.majorName(-1), MusicKey.majorName(-2)) else listOf(MusicKey.majorName(1), MusicKey.majorName(2))
        return Exercises.bank(
            id = "$tag.circlebank.${if (up) "up" else "down"}", key = "music.key.circle",
            prompt = "Lege die Tonarten in der Reihenfolge des Quintenzirkels, von C-Dur ${if (up) "aufwärts" else "abwärts"}.",
            words = words, extra = extra, explanation = "Jede Quinte ${if (up) "aufwärts bringt ein Kreuz mehr" else "abwärts bringt ein Be mehr"}.", random = random,
        )
    }

    fun pairsKeys(random: LearnRandom, level: Int): LearnExercise? {
        val pool = upTo(if (level == 3) 4 else level).filter { it != 0 || level >= 3 }
        val chosen = random.shuffled(pool).take(4)
        if (chosen.size != 4) return null
        return Exercises.pairs(
            id = "$tag.pairs." + chosen.sorted().joinToString("_"), prompt = "Welche Vorzeichen hat die Tonart?",
            items = chosen.map { PairItem("music.key.$it", MusicKey.majorName(it), MusicKit.signCount(it)) }, random = random,
        )
    }

    fun pairsRel(random: LearnRandom, level: Int): LearnExercise? {
        val chosen = random.shuffled((-4..4).toList()).take(4)
        return Exercises.pairs(
            id = "$tag.pairsrel." + chosen.sorted().joinToString("_"), prompt = "Welche Molltonart ist die Paralleltonart?",
            items = chosen.map { PairItem("music.key.rel.$it", MusicKey.majorName(it), MusicKey.minorName(it)) }, random = random,
        )
    }

    fun fact(random: LearnRandom, level: Int): LearnExercise? = MusicKit.fact(facts, level, tag, random)

    val facts: List<MusicFact> = listOf(
        MusicFact("what", 1, "Was zeigt die Vorzeichnung am Anfang eines Stücks?", "die Tonart", listOf("das Tempo", "die Taktart", "die Lautstärke"),
            "Die Vorzeichen am Anfang gelten für das ganze Stück."),
        MusicFact("firstSharp", 1, "Welches Kreuz steht in der Vorzeichnung zuerst?", "Fis", listOf("Cis", "Gis", "B"), "Die Kreuze folgen: Fis, Cis, Gis, Dis, Ais, Eis, His."),
        MusicFact("firstFlat", 1, "Welches Be steht in der Vorzeichnung zuerst?", "B", listOf("Es", "As", "Fis"), "Die Be folgen: B, Es, As, Des, Ges, Ces, Fes."),
        MusicFact("none", 1, "Welche Durtonart hat keine Vorzeichen?", "C-Dur", listOf("A-Dur", "G-Dur", "F-Dur"), "C-Dur nutzt nur weiße Tasten."),
        MusicFact("circleUp", 2, "Was ändert sich im Quintenzirkel bei jeder Quinte aufwärts?", "Ein Kreuz kommt dazu (oder ein Be fällt weg).",
            listOf("Ein Be kommt dazu (oder ein Kreuz fällt weg).", "Zwei Kreuze kommen dazu.", "Es ändert sich nichts."), "C-Dur, G-Dur (1 Kreuz), D-Dur (2 Kreuze) ..."),
        MusicFact("circleDown", 2, "Was ändert sich im Quintenzirkel bei jeder Quinte abwärts?", "Ein Be kommt dazu (oder ein Kreuz fällt weg).",
            listOf("Ein Kreuz kommt dazu (oder ein Be fällt weg).", "Zwei Be kommen dazu.", "Es ändert sich nichts."), "C-Dur, F-Dur (1 Be), B-Dur (2 Be) ..."),
        MusicFact("parallel", 3, "Was haben Paralleltonarten gemeinsam?", "dieselben Vorzeichen",
            listOf("denselben Grundton", "dieselbe Stufenfolge aus Ganz- und Halbtönen", "denselben Dreiklang"), "C-Dur und A-Moll haben beide keine Vorzeichen."),
        MusicFact("terz", 3, "Wo liegt der Grundton der Paralleltonart in Moll?", "eine kleine Terz unter dem Grundton der Dur-Tonart",
            listOf("eine große Terz unter dem Grundton der Dur-Tonart", "eine Quinte unter dem Grundton der Dur-Tonart", "eine kleine Terz über dem Grundton der Dur-Tonart"),
            "C–A ist eine kleine Terz abwärts."),
        MusicFact("aMinor", 3, "Welche Molltonart hat keine Vorzeichen?", "A-Moll", listOf("E-Moll", "D-Moll", "C-Moll"), "A-Moll ist die Paralleltonart von C-Dur."),
    )

    val def = MusicUnitDef(
        makers = mapOf<String, MusicMaker>(
            "fact" to ::fact, "readKey" to ::readKey, "readMinor" to ::readMinor, "readNote" to ::readNote, "readNoteType" to ::readNoteType,
            "keyOfCount" to ::keyOfCount, "keyOfCountType" to ::keyOfCountType, "countOfKey" to ::countOfKey, "orderBank" to ::orderBank,
            "relMinor" to ::relMinor, "relMinorChoice" to ::relMinorChoice, "relMajor" to ::relMajor, "circle" to ::circle,
            "circleBank" to ::circleBank, "pairsKeys" to ::pairsKeys, "pairsRel" to ::pairsRel,
        ),
        lessons = listOf(
            listOf("fact", "fact", "readKey", "readKey", "readKey", "readNote", "readNote", "countOfKey", "orderBank", "keyOfCountType", "readNoteType"),
            listOf("fact", "fact", "readKey", "readKey", "readNote", "countOfKey", "keyOfCount", "circle", "circleBank", "pairsKeys", "keyOfCountType", "readNoteType"),
            listOf("fact", "fact", "relMinorChoice", "relMinorChoice", "readMinor", "relMinor", "relMinor", "relMajor", "pairsRel", "circle", "readKey"),
        ),
        practice = listOf("fact", "readKey", "readMinor", "readNote", "countOfKey", "keyOfCountType", "relMinor", "circle", "circleBank", "pairsKeys", "~", "~"),
        checkpoint = listOf("fact", "fact", "readKey", "readKey", "readMinor", "readNote", "readNoteType", "countOfKey", "keyOfCountType", "relMinor", "relMajor", "circle", "pairsKeys", "pairsRel"),
        review = listOf("readKey", "countOfKey", "relMinorChoice", "circle"),
    )
}
