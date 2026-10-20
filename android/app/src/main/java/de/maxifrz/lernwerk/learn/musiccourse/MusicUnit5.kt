package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.Clef
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.PairItem
import de.maxifrz.lernwerk.learn.Pitch

/** Unit 5: major scales built from whole and half steps, and the natural minor scale. A port of MusicUnit5.swift. */
object MusicUnit5 {
    const val tag = "music.u05"
    private fun n(letter: Int, octave: Int, alteration: Int = 0): Pitch = MusicKit.note(letter, octave, alteration)

    /** The scales of each lesson: C and G major; F and D major; B flat major and three natural minor scales. */
    val fresh: List<List<MusicScale>> = listOf(
        listOf(MusicScale(n(0, 4), MusicScaleKind.MAJOR), MusicScale(n(4, 4), MusicScaleKind.MAJOR)),
        listOf(MusicScale(n(3, 4), MusicScaleKind.MAJOR), MusicScale(n(1, 4), MusicScaleKind.MAJOR)),
        listOf(
            MusicScale(n(6, 4, -1), MusicScaleKind.MAJOR), MusicScale(n(5, 4), MusicScaleKind.NATURAL_MINOR),
            MusicScale(n(2, 4), MusicScaleKind.NATURAL_MINOR), MusicScale(n(1, 4), MusicScaleKind.NATURAL_MINOR),
        ),
    )
    val all: List<MusicScale> get() = fresh.flatten()
    fun upTo(level: Int): List<MusicScale> = if (level >= 4) all else fresh.take(level).flatten()
    fun scale(level: Int, random: LearnRandom): MusicScale? =
        MusicKit.draw(if (level >= 4) all else fresh[level - 1], upTo(level), level, random)

    private fun names(scale: MusicScale): List<String> = scale.notes.map { it.germanName }

    /** A degree (2 to 7) of the scale, most often one with a sign. */
    private fun degreeOf(scale: MusicScale, random: LearnRandom): Int? {
        val notes = scale.notes
        val signed = (1..6).filter { notes[it].alteration != 0 }
        if (signed.isNotEmpty() && random.int(0, 10) < 6) return random.randomElement(signed)
        return random.randomElement((1..6).toList())
    }

    fun missing(random: LearnRandom, level: Int): LearnExercise? {
        val s = scale(level, random) ?: return null
        val d = degreeOf(s, random) ?: return null
        val notes = s.notes
        val shown = notes.mapIndexed { i, p -> if (i == d) "?" else p.germanName }.joinToString(" – ")
        val wrong = MusicKit.wrongNames(notes[d], false, random)
        return Exercises.choice(
            id = "$tag.missing.${s.name}.$d", key = "music.scale.${s.name}", prompt = "${s.name}: $shown. Welcher Ton fehlt?", correct = notes[d].germanName, wrong = wrong,
            explanation = "In ${s.name} ist der ${d + 1}. Ton ${notes[d].germanName}: Jeder Buchstabe kommt einmal vor, und die Halbtonschritte sitzen richtig.", random = random,
        )
    }

    fun degreeType(random: LearnRandom, level: Int): LearnExercise? {
        val s = scale(level, random) ?: return null
        val d = degreeOf(s, random) ?: return null
        val answer = s.notes[d]
        return MusicKit.typedNote(
            id = "$tag.degree.${s.name}.$d", key = "music.scale.${s.name}", prompt = "Wie heißt der ${d + 1}. Ton der ${s.name}-Tonleiter?", answer = answer,
            explanation = "${s.name}: " + names(s).joinToString(" ") + ".",
        )
    }

    fun scaleStaff(random: LearnRandom, level: Int): LearnExercise? {
        val s = scale(level, random) ?: return null
        val others = random.shuffled(all.filter { it.name != s.name })
        val sameTonic = others.filter { it.tonic.letter == s.tonic.letter && it.tonic.alteration == s.tonic.alteration }
        val wrong = (sameTonic + others).map { it.name }
        return Exercises.choice(
            id = "$tag.staff.${s.name}", key = "music.scale.${s.name}", prompt = "Welche Tonleiter ist das?", correct = s.name, wrong = wrong,
            explanation = "Die Töne sind " + names(s).joinToString(" ") + ".", media = MusicKit.staff(Clef.TREBLE, s.notes), random = random,
        )
    }

    fun kind(random: LearnRandom, level: Int): LearnExercise? {
        val s = scale(level, random) ?: return null
        val isMajor = s.kind == MusicScaleKind.MAJOR
        return Exercises.choice(
            id = "$tag.kind.${s.name}", key = "music.scale.${s.name}", prompt = "Ist das eine Dur- oder eine Molltonleiter?", correct = if (isMajor) "Dur" else "Moll",
            wrong = listOf(if (isMajor) "Moll" else "Dur"),
            explanation = if (isMajor) "Der dritte Ton liegt eine große Terz über dem Grundton: Dur." else "Der dritte Ton liegt eine kleine Terz über dem Grundton: Moll.",
            media = MusicKit.staff(Clef.TREBLE, s.notes), random = random,
        )
    }

    fun scaleBank(random: LearnRandom, level: Int): LearnExercise? {
        val s = scale(level, random) ?: return null
        val notes = s.notes.dropLast(1)
        val extra = mutableListOf<String>()
        for (d in listOf(3, 6, 2)) extra += MusicKit.wrongNames(notes[d], false, random).take(2)
        return Exercises.bank(
            id = "$tag.bank.${s.name}", key = "music.scale.${s.name}", prompt = "Baue die ${s.name}-Tonleiter. Lege die Töne der Reihe nach.",
            words = notes.map { it.germanName }, extra = extra, explanation = "Das Muster der Ganz- und Halbtonschritte bestimmt die Vorzeichen.", random = random,
        )
    }

    fun accChoice(random: LearnRandom, level: Int): LearnExercise? {
        val s = scale(level, random) ?: return null
        val count = s.accidentalCount ?: return null
        val wrong = listOf(count + 1, count - 1, -count, count + 2).filter { it != count && Math.abs(it) <= 3 }.map { MusicKit.signNames(it) }
        return Exercises.choice(
            id = "$tag.acc.${s.name}", key = "music.scale.${s.name}", prompt = "Welche Vorzeichen hat ${s.name}?", correct = MusicKit.signNames(count), wrong = wrong,
            explanation = "${s.name} hat die Töne " + names(s).dropLast(1).joinToString(" ") + ".", random = random,
        )
    }

    fun pairsAcc(random: LearnRandom, level: Int): LearnExercise? {
        val majors = upTo(if (level == 3) 4 else level).filter { it.kind == MusicScaleKind.MAJOR }
        val chosen = random.shuffled(majors).take(4)
        if (chosen.size != 4) return null
        val items = chosen.mapNotNull { s ->
            val count = s.accidentalCount ?: return@mapNotNull null
            PairItem("music.scale.${s.name}", s.name, MusicKit.signNames(count))
        }
        return Exercises.pairs(id = "$tag.pairs." + chosen.map { it.name }.sorted().joinToString("-"), prompt = "Welche Vorzeichen gehören dazu?", items = items, random = random)
    }

    fun patternBank(random: LearnRandom, level: Int): LearnExercise? {
        val major = level < 3 || randomBool(random)
        val words = if (major) listOf("ganz", "ganz", "halb", "ganz", "ganz", "ganz", "halb") else listOf("ganz", "halb", "ganz", "ganz", "halb", "ganz", "ganz")
        return Exercises.bank(
            id = "$tag.pattern.${if (major) "dur" else "moll"}", key = "music.pattern.${if (major) "dur" else "moll"}",
            prompt = "Lege die Schritte der ${if (major) "Dur" else "natürlichen Moll"}tonleiter der Reihe nach.", words = words,
            explanation = if (major) "Dur: ganz, ganz, halb, ganz, ganz, ganz, halb." else "Natürliches Moll: ganz, halb, ganz, ganz, halb, ganz, ganz.", random = random,
        )
    }

    fun fact(random: LearnRandom, level: Int): LearnExercise? = MusicKit.fact(facts, level, tag, random)

    val facts: List<MusicFact> = listOf(
        MusicFact("pattern", 1, "Welches Stufenmuster hat jede Durtonleiter?", "ganz, ganz, halb, ganz, ganz, ganz, halb",
            listOf("ganz, halb, ganz, ganz, halb, ganz, ganz", "ganz, ganz, ganz, halb, ganz, ganz, halb", "halb, ganz, ganz, ganz, halb, ganz, ganz"),
            "Das ist das Muster von C-Dur auf den weißen Tasten."),
        MusicFact("halfSteps", 1, "Zwischen welchen Stufen liegen in Dur die Halbtonschritte?", "3.–4. und 7.–8. Stufe",
            listOf("2.–3. und 5.–6. Stufe", "1.–2. und 4.–5. Stufe", "4.–5. und 7.–8. Stufe"), "In C-Dur sind es E–F und H–C."),
        MusicFact("cdur", 1, "Welche Tasten braucht die C-Dur-Tonleiter?", "nur weiße Tasten",
            listOf("eine schwarze Taste", "zwei schwarze Tasten", "nur schwarze Tasten"), "C D E F G A H C haben keine Vorzeichen."),
        MusicFact("fis", 1, "Warum hat G-Dur ein Fis?", "Sonst läge zwischen 7. Ton und Grundton ein Ganzton.",
            listOf("Sonst wäre die Tonleiter zu tief.", "Weil G-Dur mit einem Be beginnt.", "Weil Dur immer ein Kreuz braucht."),
            "Vor dem Grundton muss ein Halbton liegen: Fis–G."),
        MusicFact("letters", 2, "Warum heißt der vierte Ton von F-Dur B und nicht Ais?", "Nach A kommt in der Tonleiter der Buchstabe H.",
            listOf("Weil B tiefer klingt als Ais.", "Weil F-Dur Kreuze braucht."), "Jeder Buchstabe kommt in einer Tonleiter genau einmal vor."),
        MusicFact("bflat", 2, "Welcher Ton ist in F-Dur anders als in C-Dur?", "B statt H", listOf("Fis statt F", "Es statt E", "Cis statt C"),
            "Damit der Halbton zwischen 3. und 4. Stufe liegt, wird H zu B."),
        MusicFact("dsharp", 2, "Welche Vorzeichen hat D-Dur?", "Fis und Cis", listOf("Fis", "B und Es", "Cis und Gis"), "D E Fis G A H Cis D."),
        MusicFact("minorPattern", 3, "Welches Stufenmuster hat die natürliche Molltonleiter?", "ganz, halb, ganz, ganz, halb, ganz, ganz",
            listOf("ganz, ganz, halb, ganz, ganz, ganz, halb", "ganz, halb, ganz, ganz, ganz, halb, ganz", "halb, ganz, ganz, halb, ganz, ganz, ganz"),
            "Das Muster entspricht den weißen Tasten von A nach A."),
        MusicFact("minorHalf", 3, "Zwischen welchen Stufen liegen in natürlichem Moll die Halbtonschritte?", "2.–3. und 5.–6. Stufe",
            listOf("3.–4. und 7.–8. Stufe", "1.–2. und 4.–5. Stufe", "2.–3. und 6.–7. Stufe"), "In A-Moll sind es H–C und E–F."),
        MusicFact("minorThird", 3, "Woran erkennt man Moll am schnellsten?", "an der kleinen Terz über dem Grundton",
            listOf("an der großen Terz über dem Grundton", "an der Quinte", "an dem Halbton am Ende"), "Der dritte Ton liegt in Moll nur drei Halbtöne über dem Grundton."),
        MusicFact("bdur", 3, "Welche Vorzeichen hat B-Dur?", "B und Es", listOf("nur B", "Fis und Cis", "B, Es und As"), "B C D Es F G A B."),
    )

    val def = MusicUnitDef(
        makers = mapOf<String, MusicMaker>(
            "fact" to ::fact, "missing" to ::missing, "degree" to ::degreeType, "scaleStaff" to ::scaleStaff, "kind" to ::kind,
            "scaleBank" to ::scaleBank, "accChoice" to ::accChoice, "pairsAcc" to ::pairsAcc, "patternBank" to ::patternBank,
        ),
        lessons = listOf(
            listOf("fact", "fact", "patternBank", "missing", "missing", "scaleStaff", "scaleStaff", "scaleBank", "degree", "degree"),
            listOf("fact", "missing", "missing", "missing", "scaleStaff", "scaleStaff", "scaleBank", "degree", "degree", "accChoice", "pairsAcc"),
            listOf("fact", "fact", "kind", "kind", "missing", "scaleStaff", "scaleStaff", "scaleBank", "degree", "degree", "patternBank"),
        ),
        practice = listOf("fact", "missing", "missing", "scaleStaff", "kind", "scaleBank", "degree", "degree", "accChoice", "pairsAcc", "~", "~"),
        checkpoint = listOf("fact", "fact", "missing", "missing", "scaleStaff", "scaleStaff", "kind", "scaleBank", "degree", "degree", "accChoice", "accChoice", "pairsAcc", "patternBank"),
        review = listOf("missing", "scaleStaff", "degree", "accChoice"),
    )
}
