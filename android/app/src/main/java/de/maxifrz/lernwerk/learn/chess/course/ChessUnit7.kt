package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.Exercises
import de.maxifrz.lernwerk.learn.chess.ChessGoal
import de.maxifrz.lernwerk.learn.chess.ChessGoals
import de.maxifrz.lernwerk.learn.chess.ChessKit
import de.maxifrz.lernwerk.learn.chess.ChessMove
import de.maxifrz.lernwerk.learn.chess.ChessNotation
import de.maxifrz.lernwerk.learn.chess.ChessPosition
import de.maxifrz.lernwerk.learn.randomElement
import de.maxifrz.lernwerk.learn.shuffled

// Unit 7, "Matt in einem Zug": the mating patterns and finding every mate in one. Port of ChessUnit7.swift.

internal object ChessUnit7 {
    private val groupA = listOf("backRank", "smothered")
    private val groupB = listOf("scholar", "fool", "ladder")
    private val groupC = listOf("queen", "rook")

    private class Group(val suffix: String, val themes: Set<String>)

    private val groups = listOf(
        Group("a", groupA.toSet()),
        Group("b", groupB.toSet()),
        Group("c", groupC.toSet()),
        Group("all", (groupA + groupB + groupC).toSet()),
    )

    /** The German name of each named pattern, in the order of the Swift dictionary literal. */
    private val patternNames = linkedMapOf(
        "backRank" to "Grundreihenmatt", "smothered" to "Erstickungsmatt", "scholar" to "Schäfermatt", "ladder" to "Leitermatt",
        "fool" to "Narrenmatt",
    )

    val review = listOf("u7.find.all", "u7.choose.all", "u7.isMate.all", "u7.pattern.all")

    private val backSentences = listOf(
        sentence("back", listOf("Beim", "Grundreihenmatt", "sperren", "die", "eigenen", "Bauern", "den", "König", "ein."), listOf("Läufer", "Springer")),
        sentence("knight", listOf("Beim", "Erstickungsmatt", "setzt", "ein", "Springer", "matt."), listOf("Turm", "Läufer")),
    )

    private val ruleSentences = listOf(
        sentence("three", listOf("Ein", "Matt", "ist", "ein", "Schach", "ohne", "Ausweg."), listOf("Remis", "Patt")),
        sentence("all", listOf("Gesucht", "sind", "alle", "Züge,", "die", "sofort", "matt", "setzen."), listOf("keine", "später")),
    )

    private fun poolOf(themes: Set<String>): List<ChessSample> = ChessSamples.mates.filter { it.theme in themes }

    /** The sentence that explains the pattern a mate shows, for the feedback. */
    fun patternText(theme: String, m: ChessMove): String = when (theme) {
        "backRank" -> "Der König steht auf der Grundreihe, und seine eigenen Bauern nehmen ihm die Felder davor: Grundreihenmatt."
        "smothered" -> "Eigene Figuren nehmen dem König alle Felder, und ein Springer gibt Schach: Erstickungsmatt."
        "scholar" -> "Dame und Läufer zielen auf ${m.to.name}. Die Dame schlägt dort mit Schach, und der Läufer deckt sie: Schäfermatt."
        "ladder" -> "Zwei Türme setzen Reihe um Reihe ab: Der eine sperrt die Reihe davor, der andere gibt Schach. Das ist ein Leitermatt."
        "fool" -> "Das schnellste mögliche Matt: Nach nur zwei Zügen jeder Seite ist die Partie vorbei (Narrenmatt)."
        "queen" -> "Die Dame gibt Schach, und der eigene König deckt sie und nimmt die Fluchtfelder: Matt am Rand."
        else -> "Der Turm gibt Schach auf der Randreihe, und der eigene König nimmt die Fluchtfelder: Matt am Rand."
    }

    private fun mateMoves(position: ChessPosition): List<ChessMove> = ChessGoals.accepted(ChessGoal.MateInOne, position)

    private fun find(topic: String, themes: Set<String>): ChessMaker = maker@{ draw ->
        val sample = draw.pickSample(poolOf(themes), topic) ?: return@maker null
        val position = sample.position ?: return@maker null
        val mate = mateMoves(position).firstOrNull() ?: return@maker null
        moveExercise(
            id = "$topic.${sample.id}", prompt = "Setze in einem Zug matt.", position = position, goal = ChessGoal.MateInOne,
            explanation = patternText(sample.theme, mate), withSquares = false,
        )
    }

    private fun choose(topic: String, themes: Set<String>): ChessMaker = maker@{ draw ->
        val sample = draw.pickSample(poolOf(themes), topic) ?: return@maker null
        val position = sample.position ?: return@maker null
        val mateList = mateMoves(position)
        val right = randomElement(mateList, draw.random) ?: return@maker null
        val rightText = ChessNotation.san(right, position) ?: return@maker null
        val others = position.legalMoves().filter { it !in mateList }
        // Moves that give check first: they look like mates but are not.
        val checks = shuffled(others.filter { position.givesCheck(it) }, draw.random)
        val captures = shuffled(others.filter { position.isCapture(it) && !position.givesCheck(it) }, draw.random)
        val quiet = shuffled(others.filter { !position.isCapture(it) && !position.givesCheck(it) }, draw.random)
        val wrong = ArrayList<String>()
        for (m in checks + captures + quiet) {
            if (wrong.size >= 3) break
            val text = ChessNotation.san(m, position) ?: continue
            val plain = ChessKit.sanWithoutSign(text)
            if (plain != ChessKit.sanWithoutSign(rightText) && plain !in wrong) wrong.add(plain)
        }
        choice(
            id = "$topic.${sample.id}", prompt = "Welcher Zug setzt matt?", correct = ChessKit.sanWithoutSign(rightText), wrong = wrong,
            explanation = patternText(sample.theme, right), media = boardMedia(position), draw = draw,
        )
    }

    private fun count(topic: String, themes: Set<String>): ChessMaker = maker@{ draw ->
        val sample = draw.pickSample(poolOf(themes), topic) ?: return@maker null
        val position = sample.position ?: return@maker null
        val mateList = mateMoves(position)
        val texts = mateList.mapNotNull { ChessNotation.san(it, position) }
        number(
            id = "$topic.${sample.id}", prompt = "Wie viele Züge setzen hier sofort matt?", answer = mateList.size,
            explanation = "Matt setzen: ${texts.joinToString(", ")}.", media = boardMedia(position),
        )
    }

    private fun isMate(topic: String, themes: Set<String>): ChessMaker = maker@{ draw ->
        val sample = draw.pickSample(poolOf(themes), topic) ?: return@maker null
        val position = sample.position ?: return@maker null
        val checks = position.legalMoves().filter { position.givesCheck(it) }
        val wantMate = draw.coin()
        val candidates = checks.filter { position.applying(it).isCheckmate == wantMate }
        val m = randomElement(if (candidates.isEmpty()) checks else candidates, draw.random) ?: return@maker null
        val text = ChessNotation.san(m, position) ?: return@maker null
        val after = position.applying(m)
        val mate = after.isCheckmate
        val explanation = if (mate) {
            "Der König hat kein Feld, die Figur ist nicht zu schlagen, und nichts kann dazwischen: Matt."
        } else {
            val first = after.legalMoves().firstOrNull()
            val reply = if (first == null) null else ChessNotation.san(first, after)
            "${after.sideToMove.germanName} kann das Schach aufheben, zum Beispiel mit ${reply ?: "einem Zug"}. Es ist also nicht Matt."
        }
        yesNo(
            id = "$topic.${sample.id}.${m.uci}",
            prompt = "${position.sideToMove.germanName} spielt ${ChessKit.sanWithoutSign(text)} und gibt damit Schach. Ist das Matt?", answer = mate,
            explanation = explanation, media = boardMedia(position), draw = draw,
        )
    }

    /** Typing the mating move in notation; every mating move is accepted, with or without the signs. */
    private fun write(topic: String, themes: Set<String>): ChessMaker = maker@{ draw ->
        val sample = draw.pickSample(poolOf(themes), topic) ?: return@maker null
        val position = sample.position ?: return@maker null
        val mateList = mateMoves(position)
        val texts = mateList.mapNotNull { ChessNotation.san(it, position) }
        val first = texts.firstOrNull() ?: return@maker null
        val forms = texts.flatMap { ChessKit.typedVariants(it) }
        Exercises.typed(
            id = "$topic.${sample.id}",
            prompt = "Setze matt und schreibe den Zug auf: Buchstabe der Figur und Zielfeld, zum Beispiel Sf3.", answer = first,
            alternatives = forms, mode = AnswerMode.EXACT, solution = texts.joinToString(" oder "),
            explanation = patternText(sample.theme, mateList[0]), media = boardMedia(position),
        )
    }

    /** "Wie heißt dieses Mattbild?": the position after the mate, and the four names. */
    private fun pattern(topic: String, themes: Set<String>): ChessMaker = maker@{ draw ->
        val sample = draw.pickSample(poolOf(themes), topic) ?: return@maker null
        val position = sample.position ?: return@maker null
        val mate = mateMoves(position).firstOrNull()
        val name = patternNames[sample.theme]
        if (mate == null || name == null) return@maker null
        val wrong = patternNames.keys.filter { it != sample.theme }.map { patternNames.getValue(it) }.sorted()
        choice(
            id = "$topic.${sample.id}", prompt = "Wie heißt dieses Mattbild?", correct = name, wrong = shuffled(wrong, draw.random),
            explanation = patternText(sample.theme, mate), media = boardMedia(position.applying(mate)), draw = draw,
        )
    }

    private fun pairsMaker(draw: ChessDraw): LearnExercise? = pairs(
        id = "u7.pairs", prompt = "Ordne die Mattbilder zu.",
        from = listOf(
            PairCandidate("u7.pair.back", "Grundreihenmatt", "Eigene Bauern sperren den König ein"),
            PairCandidate("u7.pair.smothered", "Erstickungsmatt", "Ein Springer setzt matt"),
            PairCandidate("u7.pair.ladder", "Leitermatt", "Zwei Türme gehen Reihe um Reihe vor"),
            PairCandidate("u7.pair.scholar", "Schäfermatt", "Dame und Läufer zielen auf den Bauern f7"),
        ),
        draw = draw,
    )

    private fun buildMakers(): Map<String, ChessMaker> {
        val table = linkedMapOf<String, ChessMaker>(
            "u7.pairs" to ::pairsMaker,
            "u7.sentence.back" to sentenceMaker("u7.sentence.back", backSentences),
            "u7.sentence.rule" to sentenceMaker("u7.sentence.rule", ruleSentences),
        )
        val patternThemes = patternNames.keys
        for (g in groups) {
            val s = g.suffix
            table["u7.find.$s"] = find("u7.find.$s", g.themes)
            table["u7.choose.$s"] = choose("u7.choose.$s", g.themes)
            table["u7.count.$s"] = count("u7.count.$s", g.themes)
            table["u7.isMate.$s"] = isMate("u7.isMate.$s", g.themes)
            table["u7.write.$s"] = write("u7.write.$s", g.themes)
            if (s != "c") table["u7.pattern.$s"] = pattern("u7.pattern.$s", g.themes.filter { it in patternThemes }.toSet())
        }
        return table
    }

    val makers: Map<String, ChessMaker> = buildMakers()
}
