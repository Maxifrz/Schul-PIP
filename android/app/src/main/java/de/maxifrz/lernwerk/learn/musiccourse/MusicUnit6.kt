package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.Clef
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.LearnRandom
import de.maxifrz.lernwerk.learn.PairItem
import de.maxifrz.lernwerk.learn.Pitch
import de.maxifrz.lernwerk.learn.ToneSpec

/** Unit 6: intervals, counted, named, built and heard. A port of MusicUnit6.swift. */
object MusicUnit6 {
    const val tag = "music.u06"
    private fun n(letter: Int, octave: Int, alteration: Int = 0): Pitch = MusicKit.note(letter, octave, alteration)

    /** The interval of the standard table with this many half steps. */
    fun interval(semitones: Int): MusicInterval? = MusicInterval.standard.firstOrNull { it.semitones == semitones }

    val freshSemis: List<List<Int>> = listOf(listOf(0, 2, 3, 4, 5, 7), listOf(1, 2, 3, 4, 5, 7, 12), listOf(8, 9, 10, 11))
    val upToSemis: List<List<Int>> = listOf(
        listOf(0, 1, 2, 3, 4, 5, 7), listOf(0, 1, 2, 3, 4, 5, 7, 12), listOf(0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12),
    )

    /** What the ear exercises of each lesson may play: only intervals the lessons so far have named. */
    val hearSemis: List<List<Int>> = listOf(emptyList(), listOf(2, 3, 4, 5, 7, 12), listOf(3, 4, 5, 7, 8, 9, 10, 12))
    val hearAll = listOf(1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12)

    fun pickInterval(level: Int, random: LearnRandom): MusicInterval? {
        val fresh = if (level >= 4) upToSemis[2] else freshSemis[level - 1]
        val all = if (level >= 4) upToSemis[2] else upToSemis[level - 1]
        val semis = MusicKit.draw(fresh, all, level, random) ?: return null
        return interval(semis)
    }

    /** Two natural notes with this interval between them, the lower in the fourth octave. */
    fun naturalPair(interval: MusicInterval, random: LearnRandom): Pair<Pitch, Pitch>? {
        for (letter in random.shuffled((0 until 7).toList())) {
            val lower = n(letter, 4)
            val upper = interval.above(lower)
            if (upper.alteration == 0) return lower to upper
        }
        return null
    }

    private fun sentence(i: MusicInterval, lower: Pitch, upper: Pitch): String =
        "${lower.germanName} bis ${upper.germanName}: ${i.number} Töne gezählt, ${i.semitones} Halbtöne, also ${i.name ?: i.sizeName}."

    /** Wrong answers for an interval: the same number with the other size, the neighbouring numbers and the inversion. */
    fun wrongIntervals(i: MusicInterval, taught: List<Int>): List<MusicInterval> {
        val near = MusicInterval.standard.filter { other ->
            other != i && (other.steps == i.steps ||
                (Math.abs(other.steps - i.steps) == 1 && Math.abs(other.semitones - i.semitones) <= 2) || other == i.inverted)
        }
        // Taught intervals first, otherwise the order stays (a stable sort).
        return near.sortedBy { if (taught.contains(it.semitones)) 0 else 1 }
    }

    fun num(random: LearnRandom, level: Int): LearnExercise? {
        val i = pickInterval(level, random) ?: return null
        if (i.steps > 6) return null
        val (lower, upper) = naturalPair(i, random) ?: return null
        val wrong = mutableListOf<String>()
        for (d in listOf(1, -1, 2, -2)) if (i.steps + d in 0..7) wrong.add(MusicInterval.sizeNames[i.steps + d])
        wrong.add(MusicInterval.sizeNames[7 - i.steps])
        return Exercises.choice(
            id = "$tag.num.${lower.scientificName}.${upper.scientificName}", key = "music.interval.size.${i.steps}",
            prompt = "Wie heißt dieses Intervall? Zähle beide Töne mit.", correct = i.sizeName, wrong = wrong,
            explanation = "Von ${lower.germanName} bis ${upper.germanName} sind es ${i.number} Töne: ${i.sizeName}.",
            media = MusicKit.staff(Clef.TREBLE, listOf(lower, upper)), random = random,
        )
    }

    fun numType(random: LearnRandom, level: Int): LearnExercise? {
        val i = pickInterval(level, random) ?: return null
        if (i.steps > 6) return null
        val (lower, upper) = naturalPair(i, random) ?: return null
        return Exercises.typed(
            id = "$tag.numtype.${lower.scientificName}.${upper.scientificName}", key = "music.interval.size.${i.steps}",
            prompt = "Wie heißt das Intervall von ${lower.germanName} nach ${upper.germanName}? Zähle beide Töne mit.", answer = i.sizeName, mode = AnswerMode.EXACT,
            explanation = "${i.number} Töne gezählt: ${i.sizeName}.", media = MusicKit.staff(Clef.TREBLE, listOf(lower, upper)),
        )
    }

    fun pairsNum(random: LearnRandom, level: Int): LearnExercise? {
        val chosen = random.shuffled((1..6).toList()).take(4)
        val items = chosen.map { steps ->
            val upper = n(steps, 4)
            PairItem("music.interval.size.$steps", MusicInterval.sizeNames[steps], "C – ${upper.germanName}")
        }
        return Exercises.pairs(id = "$tag.pairsnum." + chosen.sorted().joinToString(""), prompt = "Welches Intervall liegt über C?", items = items, random = random)
    }

    fun name(random: LearnRandom, level: Int): LearnExercise? {
        val i = pickInterval(level, random) ?: return null
        val name = i.name ?: return null
        val (lower, upper) = naturalPair(i, random) ?: return null
        val taught = if (level >= 3) upToSemis[2] else upToSemis[1]
        val wrong = wrongIntervals(i, taught).mapNotNull { it.name }
        return Exercises.choice(
            id = "$tag.name.${lower.scientificName}.${upper.scientificName}", key = "music.interval.${i.semitones}", prompt = "Wie heißt dieses Intervall?",
            correct = name, wrong = wrong, explanation = sentence(i, lower, upper), media = MusicKit.staff(Clef.TREBLE, listOf(lower, upper)), random = random,
        )
    }

    fun nameType(random: LearnRandom, level: Int): LearnExercise? {
        val i = pickInterval(level, random) ?: return null
        val name = i.name ?: return null
        val (lower, upper) = naturalPair(i, random) ?: return null
        val alternatives = if (name.startsWith("reine ")) listOf(i.sizeName) else emptyList()
        return Exercises.typed(
            id = "$tag.nametype.${lower.scientificName}.${upper.scientificName}", key = "music.interval.${i.semitones}",
            prompt = "Wie heißt dieses Intervall? Schreibe den ganzen Namen.", answer = name, alternatives = alternatives, mode = AnswerMode.EXACT,
            explanation = sentence(i, lower, upper), media = MusicKit.staff(Clef.TREBLE, listOf(lower, upper)),
        )
    }

    fun semis(random: LearnRandom, level: Int): LearnExercise? {
        val i = pickInterval(level, random) ?: return null
        val name = i.name ?: return null
        val wrong = listOf(i.semitones + 1, i.semitones - 1, i.semitones + 2, i.semitones - 2).filter { it >= 0 }.map { it.toString() }
        return Exercises.choice(
            id = "$tag.semis.${i.semitones}", key = "music.interval.${i.semitones}", prompt = "Wie viele Halbtöne hat die $name?", correct = "${i.semitones}", wrong = wrong,
            explanation = "Die $name umfasst ${i.semitones} Halbtöne.", random = random,
        )
    }

    fun semisType(random: LearnRandom, level: Int): LearnExercise? {
        val i = pickInterval(level, random) ?: return null
        val name = i.name ?: return null
        return Exercises.typed(
            id = "$tag.semistype.${i.semitones}", key = "music.interval.${i.semitones}", prompt = "Wie viele Halbtöne hat die $name? Schreibe eine Zahl.",
            answer = "${i.semitones}", mode = AnswerMode.NUMBER, explanation = "Die $name umfasst ${i.semitones} Halbtöne.",
        )
    }

    fun pairsSemis(random: LearnRandom, level: Int): LearnExercise? {
        val pool = (if (level >= 3) upToSemis[2] else upToSemis[1]).filter { it > 0 }
        val chosen = random.shuffled(pool).take(4).sorted()
        val items = chosen.mapNotNull { s ->
            val name = interval(s)?.name ?: return@mapNotNull null
            PairItem("music.interval.$s", name, if (s == 1) "1 Halbton" else "$s Halbtöne")
        }
        return Exercises.pairs(id = "$tag.pairssemis." + chosen.joinToString("-"), prompt = "Wie viele Halbtöne hat das Intervall?", items = items, random = random)
    }

    private val weird = setOf("Fes", "Ces", "Eis", "His")

    private class BuildSetup(val base: Pitch, val interval: MusicInterval, val upper: Pitch)

    /** A base note and an interval above it whose upper note has a plain name. */
    private fun buildSetup(level: Int, random: LearnRandom): BuildSetup? {
        val naturals = (0 until 7).map { n(it, 4) }
        val signs = listOf(n(2, 4, -1), n(6, 4, -1), n(5, 4, -1), n(3, 4, 1))
        for (attempt in 0 until 30) {
            val base = MusicKit.pick(if (level >= 3) naturals + signs else naturals, random) ?: continue
            val semis = MusicKit.draw(
                if (level >= 4) upToSemis[2] else freshSemis[level - 1], if (level >= 4) upToSemis[2] else upToSemis[level - 1], level, random,
            ) ?: continue
            if (semis <= 0) continue
            val i = interval(semis) ?: continue
            if (i.name == null) continue
            val upper = i.above(base)
            if (Math.abs(upper.alteration) <= 1 && !weird.contains(upper.germanName)) return BuildSetup(base, i, upper)
        }
        return null
    }

    fun build(random: LearnRandom, level: Int): LearnExercise? {
        val s = buildSetup(maxOf(level, 2), random) ?: return null
        val name = s.interval.name ?: return null
        return MusicKit.typedNote(
            id = "$tag.build.${s.base.germanName}.${s.interval.semitones}", key = "music.interval.${s.interval.semitones}",
            prompt = "Baue eine $name über ${s.base.germanName}. Welcher Ton ist das?", answer = s.upper,
            explanation = "Erst die Buchstaben zählen (${s.interval.number} Töne), dann die Halbtöne anpassen: ${s.upper.germanName}.",
            media = MusicKit.staff(Clef.TREBLE, listOf(s.base)),
        )
    }

    fun buildChoice(random: LearnRandom, level: Int): LearnExercise? {
        val s = buildSetup(maxOf(level, 2), random) ?: return null
        val name = s.interval.name ?: return null
        val wrong = MusicKit.wrongNames(s.upper, false, random)
        return Exercises.choice(
            id = "$tag.buildchoice.${s.base.germanName}.${s.interval.semitones}", key = "music.interval.${s.interval.semitones}",
            prompt = "Welcher Ton liegt eine $name über ${s.base.germanName}?", correct = s.upper.germanName, wrong = wrong,
            explanation = "Erst die Buchstaben zählen (${s.interval.number} Töne), dann die Halbtöne anpassen: ${s.upper.germanName}.",
            media = MusicKit.staff(Clef.TREBLE, listOf(s.base)), random = random,
        )
    }

    fun keyTap(random: LearnRandom, level: Int): LearnExercise? {
        val s = buildSetup(2, random) ?: return null
        val name = s.interval.name ?: return null
        return Exercises.key(
            id = "$tag.key.${s.base.germanName}.${s.interval.semitones}", key = "music.interval.${s.interval.semitones}",
            prompt = "Tippe den Ton, der eine $name über ${s.base.germanName} liegt.", midi = MusicKit.keys(s.upper), solution = s.upper.germanName,
            explanation = "${s.interval.semitones} Halbtöne über ${s.base.germanName} liegt ${s.upper.germanName}.", media = MusicKit.staff(Clef.TREBLE, listOf(s.base)),
        )
    }

    fun hear(random: LearnRandom, level: Int): LearnExercise? {
        val pool = if (level >= 4) hearAll else hearSemis[minOf(maxOf(level, 2), 3) - 1]
        val semis = MusicKit.pick(pool, random) ?: return null
        val start = random.randomElement((55..67).toList()) ?: return null
        val i = interval(semis) ?: return null
        val name = i.name ?: return null
        val wrong = random.shuffled(pool.filter { it != semis }).mapNotNull { interval(it)?.name }
        return Exercises.choice(
            id = "$tag.hear.$start.$semis", key = "music.interval.$semis", prompt = "Hör hin: Welches Intervall erklingt?", correct = name, wrong = wrong,
            explanation = "Der zweite Ton liegt $semis Halbtöne über dem ersten: $name.", media = ExerciseMedia.Tones(ToneSpec(listOf(start, start + semis))), random = random,
        )
    }

    fun invert(random: LearnRandom, level: Int): LearnExercise? {
        val pool = upToSemis[2].filter { it in 1..11 && it != 6 }
        val semis = MusicKit.pick(pool, random) ?: return null
        val i = interval(semis) ?: return null
        val name = i.name ?: return null
        val inverted = i.inverted.name ?: return null
        val wrong = wrongIntervals(i.inverted, upToSemis[2]).mapNotNull { it.name }.toMutableList()
        i.name?.let { wrong.add(0, it) }
        return Exercises.choice(
            id = "$tag.invert.$semis", key = "music.interval.invert.$semis", prompt = "Welches Intervall entsteht, wenn man die $name umkehrt?",
            correct = inverted, wrong = wrong, explanation = "Intervall und Umkehrung ergeben zusammen eine Oktave: ${i.number} + ${i.inverted.number} = 9 gezählt, 12 Halbtöne.",
            random = random,
        )
    }

    fun order(random: LearnRandom, level: Int): LearnExercise? {
        val pool = (if (level >= 3) upToSemis[2] else upToSemis[1]).filter { it > 0 }
        val chosen = random.shuffled(pool).take(4).sorted()
        val words = chosen.mapNotNull { interval(it)?.name }
        return Exercises.bank(
            id = "$tag.order." + chosen.joinToString("-"), key = "music.interval.order", prompt = "Ordne die Intervalle vom kleinsten zum größten.",
            words = words, explanation = "Je mehr Halbtöne, desto größer das Intervall.", random = random,
        )
    }

    fun fact(random: LearnRandom, level: Int): LearnExercise? = MusicKit.fact(facts, level, tag, random)

    val facts: List<MusicFact> = listOf(
        MusicFact("count", 1, "Wie zählt man ein Intervall?", "Beide Töne zählen mit.",
            listOf("Nur die Töne dazwischen zählen.", "Nur den oberen Ton zählen.", "Die Halbtöne zählen."), "C bis E: C, D, E sind drei Töne, also eine Terz."),
        MusicFact("prim", 1, "Wie heißt der Abstand zwischen zwei gleichen Tönen?", "Prim", listOf("Sekunde", "Oktave", "Quinte"), "Ein einziger Ton ergibt gezählt die 1: die Prim."),
        MusicFact("octave", 1, "Wie viele Töne umfasst eine Oktave, wenn man beide Töne mitzählt?", "8", listOf("7", "6", "12"), "Okto bedeutet acht: C D E F G A H C."),
        MusicFact("pure", 2, "Welche Intervalle heißen rein?", "Prim, Quarte, Quinte und Oktave",
            listOf("Sekunde, Terz, Sexte und Septime", "Terz und Sexte", "nur die Oktave"), "Sekunde, Terz, Sexte und Septime gibt es dagegen klein und groß."),
        MusicFact("majorMinor", 2, "Was unterscheidet eine große von einer kleinen Terz?", "Die große Terz ist einen Halbton weiter.",
            listOf("Die große Terz ist einen Ganzton weiter.", "Die große Terz hat einen Ton mehr.", "Die kleine Terz ist rein."), "Große Terz: 4 Halbtöne, kleine Terz: 3 Halbtöne."),
        MusicFact("tritone", 3, "Wie viele Halbtöne hat der Tritonus?", "6", listOf("5", "7", "4"), "Der Tritonus besteht aus drei Ganztönen, also sechs Halbtönen."),
        MusicFact("tritoneWhole", 3, "Aus wie vielen Ganztönen besteht der Tritonus?", "3", listOf("2", "4", "6"), "Tri bedeutet drei."),
        MusicFact("inversion", 3, "Wozu ergänzen sich ein Intervall und seine Umkehrung?", "zu einer Oktave", listOf("zu einer Quinte", "zu einer Septime", "zu einer Prim"),
            "Die große Terz und die kleine Sexte ergeben zusammen eine Oktave."),
    )

    val def = MusicUnitDef(
        makers = mapOf<String, MusicMaker>(
            "fact" to ::fact, "num" to ::num, "numType" to ::numType, "pairsNum" to ::pairsNum, "name" to ::name, "nameType" to ::nameType,
            "semis" to ::semis, "semisType" to ::semisType, "pairsSemis" to ::pairsSemis, "build" to ::build, "buildChoice" to ::buildChoice,
            "keyTap" to ::keyTap, "hear" to ::hear, "invert" to ::invert, "order" to ::order,
        ),
        lessons = listOf(
            listOf("fact", "fact", "num", "num", "num", "num", "numType", "numType", "pairsNum", "fact"),
            listOf("fact", "name", "name", "name", "nameType", "semis", "semisType", "hear", "hear", "hear", "pairsSemis", "keyTap"),
            listOf("fact", "fact", "name", "name", "build", "build", "buildChoice", "hear", "hear", "invert", "order", "nameType"),
        ),
        practice = listOf("fact", "num", "name", "nameType", "semis", "build", "buildChoice", "hear", "hear", "pairsSemis", "~", "~"),
        checkpoint = listOf("fact", "num", "name", "name", "nameType", "semis", "semisType", "build", "buildChoice", "hear", "hear", "invert", "order", "pairsSemis"),
        review = listOf("name", "nameType", "build", "hear"),
    )
}
