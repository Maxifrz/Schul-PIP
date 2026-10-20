package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.chess.ChessGoal
import de.maxifrz.lernwerk.learn.chess.ChessMoveFilter
import de.maxifrz.lernwerk.learn.chess.ChessPosition
import de.maxifrz.lernwerk.learn.chess.ChessSquare
import de.maxifrz.lernwerk.learn.randomElement
import de.maxifrz.lernwerk.learn.shuffled
import kotlin.math.abs

// Unit 1, "Das Brett": files, ranks, square names and the colors of the squares. Port of ChessUnit1.swift.

internal object ChessUnit1 {
    val review = listOf("u1.nameSquare", "u1.colorOfSquare", "u1.tapMove", "u1.typeName", "u1.sameDiagonal")

    private val nameSentences = listOf(
        sentence("linien", listOf("Die", "senkrechten", "Felderreihen", "heißen", "Linien."), listOf("waagerechten", "Reihen.")),
        sentence("reihen", listOf("Die", "waagerechten", "Felderreihen", "heißen", "Reihen."), listOf("senkrechten", "Linien.")),
        sentence("order", listOf("Zuerst", "kommt", "die", "Linie,", "dann", "die", "Reihe."), listOf("Diagonale.", "zuletzt")),
    )

    private val colorSentences = listOf(
        sentence("corner", listOf("Unten", "rechts", "liegt", "ein", "helles", "Feld."), listOf("dunkles", "links")),
        sentence("a1", listOf("Das", "Feld", "a1", "ist", "dunkel."), listOf("hell.", "h1")),
        sentence("diagonal", listOf("Auf", "einer", "Diagonale", "haben", "alle", "Felder", "dieselbe", "Farbe."), listOf("verschiedene", "Linie")),
    )

    private val letters: List<String> = ChessSquare.FILE_LETTERS.map { it.toString() }

    /** "Wie heißt das markierte Feld?" with the four names a student could mix up. */
    private fun nameSquare(draw: ChessDraw): LearnExercise? {
        val square = draw.pickSquare("u1.nameSquare") ?: return null
        val withPieces = draw.coin()
        val marked = listOf(square.name)
        val media = if (withPieces) fenBoard(ChessPosition.START_FEN, marked) else emptyBoard(marked)
        val name = square.name
        return choice(
            id = "u1.nameSquare.$name", prompt = "Wie heißt das markierte Feld?", correct = name,
            wrong = squareDistractors(square, draw.random),
            explanation = "Erst die Linie, dann die Reihe: Das Feld liegt auf der ${square.fileLetter}-Linie in der ${square.rank + 1}. Reihe, also $name.",
            media = media, draw = draw,
        )
    }

    private fun markedFile(draw: ChessDraw): LearnExercise? {
        val file = draw.pick((0..7).toList(), "u1.markedFile") { it.toString() } ?: return null
        val marked = (1..8).map { letters[file] + it }
        var wrong = listOf(letters[7 - file])
        val near = listOf(file - 1, file + 1).filter { it in 0..7 }.map { letters[it] }.toMutableList()
        draw.random.shuffle(near)
        wrong = wrong + near
        wrong = wrong + shuffled(letters.filter { it !in wrong && it != letters[file] }, draw.random)
        return choice(
            id = "u1.markedFile.${letters[file]}", prompt = "Welche Linie ist markiert?", correct = letters[file], wrong = wrong,
            explanation = "Die Linien heißen von links nach rechts a bis h. Die markierte ist die ${letters[file]}-Linie.",
            media = emptyBoard(marked), draw = draw,
        )
    }

    private fun markedRank(draw: ChessDraw): LearnExercise? {
        val rank = draw.pick((1..8).toList(), "u1.markedRank") { it.toString() } ?: return null
        val marked = letters.map { it + rank }
        var wrong = listOf((9 - rank).toString())
        val near = listOf(rank - 1, rank + 1).filter { it in 1..8 }.map { it.toString() }.toMutableList()
        draw.random.shuffle(near)
        wrong = wrong + near
        wrong = wrong + shuffled((1..8).map { it.toString() }.filter { it !in wrong && it != rank.toString() }, draw.random)
        return choice(
            id = "u1.markedRank.$rank", prompt = "Welche Reihe ist markiert?", correct = rank.toString(), wrong = wrong,
            explanation = "Die Reihen sind von unten nach oben von 1 bis 8 nummeriert. Die markierte ist die $rank. Reihe.",
            media = emptyBoard(marked), draw = draw,
        )
    }

    private fun terms(draw: ChessDraw): LearnExercise? = pairs(
        id = "u1.terms", prompt = "Was ist was?",
        from = listOf(
            PairCandidate("u1.term.linie", "Linie", "senkrecht, a bis h"),
            PairCandidate("u1.term.reihe", "Reihe", "waagerecht, 1 bis 8"),
            PairCandidate("u1.term.diagonale", "Diagonale", "schräg"),
            PairCandidate("u1.term.feld", "Feld", "ein Quadrat des Brettes"),
            PairCandidate("u1.term.brett", "Schachbrett", "8 mal 8 Felder"),
        ),
        draw = draw,
    )

    private fun corners(draw: ChessDraw): LearnExercise? = pairs(
        id = "u1.corners", prompt = "Wo liegen die Eckfelder? Du schaust von Weiß aus auf das Brett.",
        from = listOf(
            PairCandidate("u1.corner.a1", "a1", "unten links"),
            PairCandidate("u1.corner.h1", "h1", "unten rechts"),
            PairCandidate("u1.corner.a8", "a8", "oben links"),
            PairCandidate("u1.corner.h8", "h8", "oben rechts"),
        ),
        draw = draw,
    )

    private fun colorName(square: ChessSquare) = if (square.isDark) "dunkel" else "hell"

    private fun colorOfSquare(draw: ChessDraw): LearnExercise? {
        val square = draw.pickSquare("u1.colorOfSquare") ?: return null
        val name = square.name
        val letterNo = square.file + 1
        val sum = letterNo + square.rank + 1
        val explanation = "a1 ist dunkel, danach wechselt die Farbe von Feld zu Feld. Rechne: ${square.fileLetter} ist der $letterNo. Buchstabe, " +
            "$letterNo + ${square.rank + 1} = $sum. ${if (sum % 2 == 0) "Gerade Summe: dunkel." else "Ungerade Summe: hell."}"
        return choice(
            id = "u1.colorOfSquare.$name", prompt = "Welche Farbe hat das Feld $name?", correct = colorName(square),
            wrong = listOf(if (square.isDark) "hell" else "dunkel"), explanation = explanation, media = emptyBoard(listOf(name)), draw = draw,
        )
    }

    private fun cornerColor(draw: ChessDraw): LearnExercise? {
        val name = draw.pick(listOf("a1", "h1", "a8", "h8"), "u1.cornerColor") { it } ?: return null
        val square = ChessSquare.fromName(name) ?: return null
        return choice(
            id = "u1.cornerColor.$name", prompt = "Welche Farbe hat das Eckfeld $name?", correct = colorName(square),
            wrong = listOf(if (square.isDark) "hell" else "dunkel"),
            explanation = "Unten links (a1) und oben rechts (h8) sind dunkel, unten rechts (h1) und oben links (a8) sind hell.",
            media = emptyBoard(listOf(name)), draw = draw,
        )
    }

    private class Fact(val key: String, val prompt: String, val answer: Int, val likely: List<Int>, val explanation: String)

    /** Counts of the board, taken from the squares themselves. */
    private fun facts(): List<Fact> {
        val all = ChessSquare.all
        return listOf(
            Fact("squares", "Wie viele Felder hat ein Schachbrett?", all.size, listOf(32, 56, 81), "8 Linien mal 8 Reihen sind ${all.size} Felder."),
            Fact("dark", "Wie viele dunkle Felder hat das Schachbrett?", all.count { it.isDark }, listOf(16, 30, 64), "Hell und dunkel wechseln sich ab, jede Farbe hat die Hälfte der 64 Felder."),
            Fact("files", "Wie viele Linien hat das Schachbrett?", letters.size, listOf(6, 7, 9), "Die Linien heißen a, b, c, d, e, f, g und h."),
            Fact("ranks", "Wie viele Reihen hat das Schachbrett?", 8, listOf(6, 7, 9), "Die Reihen sind von 1 bis 8 nummeriert."),
            Fact("diagonal", "Aus wie vielen Feldern besteht die lange Diagonale von a1 nach h8?", all.count { it.file == it.rank }, listOf(7, 9, 16), "Sie berührt jede Linie und jede Reihe genau einmal."),
            Fact("perFile", "Wie viele Felder hat eine Linie?", all.count { it.file == 0 }, listOf(6, 7, 64), "Eine Linie läuft durch alle 8 Reihen."),
        )
    }

    private fun factChoice(draw: ChessDraw): LearnExercise? {
        val fact = draw.pick(facts(), "u1.fact") { it.key } ?: return null
        return choice(
            id = "u1.factChoice.${fact.key}", prompt = fact.prompt, correct = fact.answer.toString(),
            wrong = numberWrongs(fact.answer, fact.likely, draw.random), explanation = fact.explanation, draw = draw,
        )
    }

    private fun factNumber(draw: ChessDraw): LearnExercise? {
        val fact = draw.pick(facts(), "u1.fact") { it.key } ?: return null
        return number("u1.factNumber.${fact.key}", fact.prompt, fact.answer, fact.explanation)
    }

    private fun sameDiagonal(draw: ChessDraw): LearnExercise? {
        val base = draw.pickSquare("u1.sameDiagonal") ?: return null
        val bf = base.file
        val br = base.rank
        val all = ChessSquare.all
        val onDiagonal = all.filter { abs(it.file - bf) == abs(it.rank - br) && it != base }
        val sameLine = all.filter { (it.file == bf || it.rank == br) && it != base }
        val elsewhere = all.filter { abs(it.file - bf) != abs(it.rank - br) && it.file != bf && it.rank != br }
        val right = randomElement(onDiagonal, draw.random)
        val line = randomElement(sameLine, draw.random)
        if (right == null || line == null) return null
        val wrong = mutableListOf(line.name)
        for (square in shuffled(elsewhere, draw.random)) {
            if (wrong.size < 3 && square.name !in wrong) wrong.add(square.name)
        }
        val steps = abs(right.file - bf)
        val baseName = base.name
        return choice(
            id = "u1.sameDiagonal.$baseName", prompt = "Welches Feld liegt mit $baseName auf einer Diagonale?", correct = right.name, wrong = wrong,
            explanation = "Von $baseName nach ${right.name} geht es $steps ${if (steps == 1) "Linie" else "Linien"} und $steps ${if (steps == 1) "Reihe" else "Reihen"} weit: Das ist eine Diagonale.",
            media = emptyBoard(listOf(baseName)), draw = draw,
        )
    }

    /** "Ziehe von g1 nach f3.": the student only has to find the two squares. */
    private fun tapMove(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.nameMoves, "u1.tapMove") ?: return null
        val position = sample.position
        val m = sample.detailMove
        if (position == null || m == null) return null
        val from = m.from.name
        val to = m.to.name
        return moveExercise(
            id = "u1.tapMove.${sample.id}", prompt = "Ziehe von $from nach $to.", position = position,
            goal = ChessGoal.Moves(ChessMoveFilter(from = m.from, to = m.to)),
            explanation = "Suche erst die Linie, dann die Reihe: von $from nach $to.",
        )
    }

    private fun typeName(draw: ChessDraw): LearnExercise? {
        val square = draw.pickSquare("u1.typeName") ?: return null
        val name = square.name
        return typedSquare(
            id = "u1.typeName.$name", prompt = "Tippe den Namen des markierten Feldes.", answer = name,
            explanation = "Erst die Linie, dann die Reihe: ${square.fileLetter}-Linie, ${square.rank + 1}. Reihe, also $name.",
            media = emptyBoard(listOf(name)),
        )
    }

    private fun typeCorner(draw: ChessDraw): LearnExercise? {
        val cornerList = listOf("a1" to "unten links", "h1" to "unten rechts", "a8" to "oben links", "h8" to "oben rechts")
        val corner = draw.pick(cornerList, "u1.typeCorner") { it.first } ?: return null
        return typedSquare(
            id = "u1.typeCorner.${corner.first}", prompt = "Wie heißt das Eckfeld ${corner.second}? Du schaust von Weiß aus auf das Brett.", answer = corner.first,
            explanation = "Die Ecken sind a1 (unten links), h1 (unten rechts), a8 (oben links) und h8 (oben rechts).",
            media = emptyBoard(),
        )
    }

    val makers: Map<String, ChessMaker> = linkedMapOf(
        "u1.nameSquare" to ::nameSquare,
        "u1.markedFile" to ::markedFile,
        "u1.markedRank" to ::markedRank,
        "u1.terms" to ::terms,
        "u1.corners" to ::corners,
        "u1.colorOfSquare" to ::colorOfSquare,
        "u1.cornerColor" to ::cornerColor,
        "u1.factChoice" to ::factChoice,
        "u1.factNumber" to ::factNumber,
        "u1.sameDiagonal" to ::sameDiagonal,
        "u1.tapMove" to ::tapMove,
        "u1.typeName" to ::typeName,
        "u1.typeCorner" to ::typeCorner,
        "u1.sentence.names" to sentenceMaker("u1.sentence.names", nameSentences),
        "u1.sentence.colors" to sentenceMaker("u1.sentence.colors", colorSentences),
    )
}
