package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.chess.ChessGoal
import de.maxifrz.lernwerk.learn.chess.ChessGoals
import de.maxifrz.lernwerk.learn.chess.ChessKit
import de.maxifrz.lernwerk.learn.chess.ChessMove
import de.maxifrz.lernwerk.learn.chess.ChessNotation
import de.maxifrz.lernwerk.learn.chess.ChessPieceKind
import de.maxifrz.lernwerk.learn.chess.ChessPosition
import de.maxifrz.lernwerk.learn.chess.ChessSquare
import de.maxifrz.lernwerk.learn.chess.ChessTactics
import de.maxifrz.lernwerk.learn.chess.attackedEnemies
import de.maxifrz.lernwerk.learn.shuffled

// Unit 8, "Taktik-Grundlagen": hanging pieces, forks, pins, skewers and discovered attacks. The accepted moves are the
// ones the material search proves best, never an author's guess. Port of ChessUnit8.swift.

internal object ChessUnit8 {
    /** How deep the search looks, in half moves: the move, the answer and the follow-up capture. */
    private const val DEPTH = 3

    private val motifNames = linkedMapOf(
        "fork" to "Gabel", "pin" to "Fesselung", "skewer" to "Spieß", "discovered" to "Abzugsangriff", "hang" to "Hängende Figur",
    )

    private val THEMES = listOf("fork", "pin", "skewer", "discovered", "hang")

    private fun pools(): Map<String, List<ChessSample>> = mapOf(
        "fork" to ChessSamples.forks, "pin" to ChessSamples.pins, "skewer" to ChessSamples.skewers,
        "discovered" to ChessSamples.discovered, "hang" to ChessSamples.hanging,
    )

    val review = listOf("u8.mixed.find", "u8.mixed.choose", "u8.motif", "u8.hang.which", "u8.pin.which")

    private val forkSentences = listOf(
        sentence("fork", listOf("Eine", "Gabel", "greift", "zwei", "Figuren", "gleichzeitig", "an."), listOf("drei", "Turm")),
        sentence("hang", listOf("Eine", "hängende", "Figur", "ist", "angegriffen", "und", "ungedeckt."), listOf("gefesselt", "gedeckt.")),
    )

    private val lineSentences = listOf(
        sentence("pin", listOf("Eine", "am", "König", "gefesselte", "Figur", "darf", "ihre", "Linie", "nicht", "verlassen."), listOf("immer", "Dame")),
        sentence("skewer", listOf("Beim", "Spieß", "muss", "die", "vordere", "Figur", "ausweichen."), listOf("hintere", "Bauer")),
        sentence("discovered", listOf("Beim", "Abzugsangriff", "gibt", "die", "ziehende", "Figur", "eine", "Linie", "frei."), listOf("gesperrte", "Dame")),
    )

    private fun terms(draw: ChessDraw): LearnExercise? = pairs(
        id = "u8.terms", prompt = "Ordne die Begriffe zu.",
        from = listOf(
            PairCandidate("u8.term.fork", "Gabel", "greift zwei Figuren zugleich an"),
            PairCandidate("u8.term.pin", "Fesselung", "Figur kann nicht ziehen, dahinter steht Wertvolleres"),
            PairCandidate("u8.term.skewer", "Spieß", "vordere Figur weicht, hintere fällt"),
            PairCandidate("u8.term.discovered", "Abzugsangriff", "Figur zieht weg und gibt eine Linie frei"),
        ),
        draw = draw,
    )

    private fun goalFor(theme: String): ChessGoal = if (theme == "hang") ChessGoal.BestCapture else ChessGoal.BestMove(DEPTH)

    private fun nameList(squares: List<ChessSquare>, position: ChessPosition): String = ChessKit.list(
        squares.map { sq ->
            val p = position[sq]
            "${p?.kind?.germanName ?: "Figur"} auf ${sq.name}"
        },
    )

    /** The sentence that says what the best move does, built from what the board shows after it. */
    private fun explanation(theme: String, sample: ChessSample, position: ChessPosition, m: ChessMove): String {
        val text = ChessNotation.san(m, position) ?: m.uci
        val after = position.applying(m)
        val mover = position.sideToMove
        when (theme) {
            "fork" -> {
                val targets = ChessTactics.forkTargets(m.to, after)
                val kind = after[m.to]?.kind ?: ChessPieceKind.PAWN
                return "Nach $text greift ${ChessKit.nominative(kind)} auf ${m.to.name} gleichzeitig an: ${nameList(targets, after)}. Der Gegner kann nur eine Figur retten. Das ist eine Gabel."
            }
            "pin" -> {
                val attacked = after.attackedEnemies(m.to)
                val pinned = ChessTactics.absolutePins(mover.opposite, position).map { it.pinned }.filter { it in attacked }
                return "$text greift die gefesselte Figur an: ${nameList(pinned, position)}. Sie darf ihre Linie nicht verlassen, weil dahinter der König steht, und kann sich deshalb nicht retten."
            }
            "skewer" -> {
                val line = ChessTactics.lineUps(mover, after).firstOrNull { it.attacker == m.to && ChessTactics.isSkewer(it, after) }
                if (line != null) {
                    return "$text greift ${nameList(listOf(line.front), after)} an. Sie muss ausweichen, und dahinter steht auf derselben Linie ${nameList(listOf(line.back), after)}. Das ist ein Spieß."
                }
                return "$text greift eine wertvolle Figur an, hinter der auf derselben Linie eine weitere steht. Das ist ein Spieß."
            }
            "discovered" -> {
                val king = after.kingSquare(mover.opposite)
                val checkers = if (king == null) emptyList() else after.attackers(king, mover)
                val captured = position.capturedPiece(m)
                val loss = if (captured != null) " und ${ChessKit.nominative(captured.kind)} ist nicht mehr zu retten" else ""
                val who = if (checkers.isNotEmpty()) "durch die Figur auf ${checkers[0].name}" else ""
                return "Die ziehende Figur macht eine Linie frei: Es entsteht Schach $who. Der Gegner muss das Schach aufheben$loss. Das ist ein Abzugsangriff."
            }
            else -> {
                val target = sample.focusSquare ?: m.to
                return "Die Figur auf ${target.name} war angegriffen, und nichts deckt sie. Du schlägst sie, ohne etwas zu verlieren."
            }
        }
    }

    private class Item(val theme: String, val sample: ChessSample)

    private fun poolItems(themes: List<String>): List<Item> {
        val all = pools()
        return themes.flatMap { theme -> (all[theme] ?: emptyList()).map { Item(theme, it) } }
    }

    private fun find(topic: String, themes: List<String>, hint: Boolean): ChessMaker = maker@{ draw ->
        val item = draw.pick(poolItems(themes), topic) { it.sample.id } ?: return@maker null
        val position = item.sample.position ?: return@maker null
        val goal = goalFor(item.theme)
        val m = ChessGoals.accepted(goal, position).firstOrNull() ?: return@maker null
        var prompt = if (item.theme == "hang") "Schlage so, dass du am meisten gewinnst." else "Finde den Zug, der am meisten Material gewinnt."
        if (hint) prompt += if (item.theme == "hang") " Eine Figur hängt." else " Tipp: ${motifNames[item.theme] ?: ""}."
        moveExercise(
            id = "$topic.${item.sample.id}", prompt = prompt, position = position, goal = goal,
            explanation = explanation(item.theme, item.sample, position, m), withSquares = false,
        )
    }

    /** Four moves to choose from: the best one and three that are proven worse. */
    private fun choose(topic: String, themes: List<String>): ChessMaker = maker@{ draw ->
        val item = draw.pick(poolItems(themes), topic) { it.sample.id } ?: return@maker null
        val position = item.sample.position ?: return@maker null
        val best = ChessGoals.accepted(goalFor(item.theme), position)
        val right = best.firstOrNull() ?: return@maker null
        val rightText = ChessNotation.san(right, position) ?: return@maker null
        // Wrong moves: the best move's own piece first, then checks and captures, then the rest.
        val mover = position[right.from]?.kind
        val others = shuffled(position.legalMoves().filter { it !in best }, draw.random)
        val sameKind = others.filter { position[it.from]?.kind == mover }
        val loud = others.filter { position.givesCheck(it) || position.isCapture(it) }
        val wrong = ArrayList<String>()
        for (m in sameKind + loud + others) {
            if (wrong.size >= 3) break
            val text = ChessNotation.san(m, position) ?: continue
            val plain = ChessKit.sanWithoutSign(text)
            if (plain != ChessKit.sanWithoutSign(rightText) && plain !in wrong) wrong.add(plain)
        }
        choice(
            id = "$topic.${item.sample.id}", prompt = "Welcher Zug gewinnt hier am meisten Material?", correct = ChessKit.sanWithoutSign(rightText), wrong = wrong,
            explanation = explanation(item.theme, item.sample, position, right), media = boardMedia(position), draw = draw,
        )
    }

    /** "Welche zwei Figuren greift die Gabel an?" */
    private fun forkAfter(draw: ChessDraw): LearnExercise? {
        fun best(position: ChessPosition): ChessMove? = ChessGoals.accepted(ChessGoal.BestMove(DEPTH), position).firstOrNull()
        val pool = ChessSamples.forks.filter { sample ->
            val position = sample.position
            if (position == null) false
            else {
                val m = best(position)
                m != null && position.applying(m).attackedEnemies(m.to).size == 2
            }
        }
        val sample = draw.pickSample(pool, "u8.fork.after") ?: return null
        val position = sample.position ?: return null
        val m = best(position) ?: return null
        val text = ChessNotation.san(m, position) ?: return null
        val after = position.applying(m)
        fun pairText(kinds: List<ChessPieceKind>): String =
            kinds.sortedByDescending { it.rawValue }.joinToString(" und ") { it.germanName }
        val actual = after.attackedEnemies(m.to).mapNotNull { after[it]?.kind }
        val right = pairText(actual)
        val present = after.squaresOf(position.sideToMove.opposite).mapNotNull { after[it]?.kind }.toSet().sortedBy { it.rawValue }
        val all = ChessPieceKind.entries.toList()
        val wrong = ArrayList<String>()
        for (pool2 in listOf(present, all)) {
            for (first in shuffled(pool2, draw.random)) {
                for (second in shuffled(pool2, draw.random)) {
                    if (first.rawValue < second.rawValue) {
                        val t = pairText(listOf(first, second))
                        if (t != right && t !in wrong && wrong.size < 3) wrong.add(t)
                    }
                }
            }
        }
        return choice(
            id = "u8.fork.after.${sample.id}",
            prompt = "${position.sideToMove.germanName} spielt ${ChessKit.sanWithoutSign(text)}. Welche zwei Figuren greift die gezogene Figur dann an?",
            correct = right, wrong = wrong, explanation = explanation("fork", sample, position, m), media = boardMedia(position), draw = draw,
        )
    }

    /** "Welche schwarze Figur ist gefesselt?" */
    private fun pinWhich(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.pins.filter { sample ->
            val position = sample.position
            if (position != null) ChessTactics.absolutePins(position.sideToMove.opposite, position).size == 1 else false
        }
        val sample = draw.pickSample(pool, "u8.pin.which") ?: return null
        val position = sample.position ?: return null
        val color = position.sideToMove.opposite
        val pin = ChessTactics.absolutePins(color, position).firstOrNull()
        val king = position.kingSquare(color)
        if (pin == null || king == null) return null
        val wrong = shuffled(position.squaresOf(color).filter { it != pin.pinned && it != king }, draw.random).map { it.name }
        return choice(
            id = "u8.pin.which.${sample.id}", prompt = "Welche ${color.adjectiveStem}e Figur ist gefesselt?", correct = pin.pinned.name, wrong = wrong,
            explanation = "Die Figur auf ${pin.pinned.name} steht zwischen der Figur auf ${pin.pinner.name} und dem König auf ${king.name}. Sie darf ihre Linie nicht verlassen.",
            media = boardMedia(position), draw = draw,
        )
    }

    /** "Welche schwarze Figur hängt?" */
    private fun hangWhich(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.hanging.filter { sample ->
            val position = sample.position
            if (position != null) ChessTactics.hangingPieces(position.sideToMove.opposite, position).size == 1 else false
        }
        val sample = draw.pickSample(pool, "u8.hang.which") ?: return null
        val position = sample.position ?: return null
        val color = position.sideToMove.opposite
        val hang = ChessTactics.hangingPieces(color, position).firstOrNull()
        val king = position.kingSquare(color)
        if (hang == null || king == null) return null
        val wrong = shuffled(position.squaresOf(color).filter { it != hang && it != king }, draw.random).map { it.name }
        return choice(
            id = "u8.hang.which.${sample.id}", prompt = "Welche ${color.adjectiveStem}e Figur hängt?", correct = hang.name, wrong = wrong,
            explanation = "Die Figur auf ${hang.name} ist angegriffen und nicht gedeckt: Du kannst sie ohne Verlust schlagen.",
            media = boardMedia(position), draw = draw,
        )
    }

    /** "Welches Motiv steckt in diesem Zug?" */
    private fun motif(draw: ChessDraw): LearnExercise? {
        val pool = poolItems(THEMES).sortedBy { it.sample.id }
        val item = draw.pick(pool, "u8.motif") { it.sample.id } ?: return null
        val position = item.sample.position ?: return null
        val m = ChessGoals.accepted(goalFor(item.theme), position).firstOrNull() ?: return null
        val text = ChessNotation.san(m, position)
        val right = motifNames[item.theme]
        if (text == null || right == null) return null
        val wrong = motifNames.keys.filter { it != item.theme && it != "hang" }.map { motifNames.getValue(it) }.sorted()
        return choice(
            id = "u8.motif.${item.sample.id}", prompt = "${position.sideToMove.germanName} spielt $text. Welches Motiv steckt darin?", correct = right,
            wrong = if (item.theme == "hang") wrong else wrong.filter { it != right } + listOf("Hängende Figur"),
            explanation = explanation(item.theme, item.sample, position, m), media = boardMedia(position), draw = draw,
        )
    }

    private fun buildMakers(): Map<String, ChessMaker> {
        val table = linkedMapOf<String, ChessMaker>(
            "u8.terms" to ::terms,
            "u8.fork.after" to ::forkAfter,
            "u8.pin.which" to ::pinWhich,
            "u8.hang.which" to ::hangWhich,
            "u8.sentence.fork" to sentenceMaker("u8.sentence.fork", forkSentences),
            "u8.sentence.line" to sentenceMaker("u8.sentence.line", lineSentences),
            "u8.motif" to ::motif,
        )
        for (theme in THEMES) {
            table["u8.$theme.find"] = find("u8.$theme.find", listOf(theme), true)
            table["u8.$theme.choose"] = choose("u8.$theme.choose", listOf(theme))
        }
        table["u8.mixed.find"] = find("u8.mixed.find", THEMES, false)
        table["u8.mixed.choose"] = choose("u8.mixed.choose", THEMES)
        return table
    }

    val makers: Map<String, ChessMaker> = buildMakers()
}
