package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.chess.ChessColor
import de.maxifrz.lernwerk.learn.chess.ChessEscape
import de.maxifrz.lernwerk.learn.chess.ChessGoal
import de.maxifrz.lernwerk.learn.chess.ChessGoals
import de.maxifrz.lernwerk.learn.chess.ChessKit
import de.maxifrz.lernwerk.learn.chess.ChessMove
import de.maxifrz.lernwerk.learn.chess.ChessMoveFilter
import de.maxifrz.lernwerk.learn.chess.ChessNotation
import de.maxifrz.lernwerk.learn.chess.ChessPieceKind
import de.maxifrz.lernwerk.learn.chess.ChessPosition
import de.maxifrz.lernwerk.learn.randomElement
import de.maxifrz.lernwerk.learn.shuffled

// Unit 4, "Schach und Matt": check, getting out of check, mate, stalemate and drawn material. Port of ChessUnit4.swift.

internal object ChessUnit4 {
    val review = listOf("u4.isCheck", "u4.escape.any", "u4.state", "u4.mateMove", "u4.escape.which")

    private val checkSentences = listOf(
        sentence("must", listOf("Im", "Schach", "musst", "du", "das", "Schach", "sofort", "aufheben."), listOf("ignorieren.", "später")),
        sentence("never", listOf("Der", "König", "wird", "nie", "geschlagen,", "sondern", "matt", "gesetzt."), listOf("immer", "getauscht")),
    )

    private val endSentences = listOf(
        sentence("stalemate", listOf("Ein", "Patt", "ist", "ein", "Remis."), listOf("Sieg.", "Matt.")),
        sentence("mate", listOf("Nach", "dem", "Matt", "ist", "die", "Partie", "zu", "Ende."), listOf("beginnt", "Patt")),
    )

    /** Positions in which the side to move is in check, with one of the three kinds of answer at least. */
    private fun checked(): List<ChessSample> =
        (ChessSamples.inCheck + ChessSamples.singleAnswer).filter { it.position?.isCheck == true }

    private fun markedOf(sample: ChessSample): List<String> = if (sample.focus == null) emptyList() else listOf(sample.focus)

    private fun isCheck(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.inCheck + ChessSamples.notInCheck + ChessSamples.goesOn
        val sample = draw.pickSample(pool, "u4.isCheck") ?: return null
        val position = sample.position
        val king = sample.focusSquare
        if (position == null || king == null) return null
        val color = position.sideToMove
        val explanation = if (position.isCheck) {
            val attackers = position.attackers(king, color.opposite).map { it.name }
            "Das Feld ${king.name} wird von der Figur auf ${ChessKit.list(attackers)} angegriffen: Der König steht im Schach."
        } else {
            "Keine gegnerische Figur greift das Feld ${king.name} an, also steht der König nicht im Schach."
        }
        return yesNo(
            id = "u4.isCheck.${sample.id}", prompt = "Steht der ${color.adjectiveStem}e König im Schach?", answer = position.isCheck,
            explanation = explanation, media = boardMedia(position, listOf(king.name)), draw = draw,
        )
    }

    private fun whichChecks(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.inCheck, "u4.whichChecks") ?: return null
        val position = sample.position
        val king = sample.focusSquare
        val from = sample.detailSquare
        if (position == null || king == null || from == null) return null
        val checker = position[from] ?: return null
        val wrong = shuffled(ChessPieceKind.entries.filter { it != checker.kind }.map { it.germanName }, draw.random)
        return choice(
            id = "u4.whichChecks.${sample.id}", prompt = "Welche Figur gibt dem ${position.sideToMove.adjectiveStem}en König Schach?",
            correct = checker.kind.germanName, wrong = wrong,
            explanation = "Die Figur auf ${from.name} ist ${ChessKit.indefinite(checker.kind)} und greift den König auf ${king.name} an.",
            media = boardMedia(position, listOf(king.name)), draw = draw,
        )
    }

    private fun giveCheck(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.mates.filter { it.theme in listOf("rook", "queen", "backRank") }
        val sample = draw.pickSample(pool, "u4.giveCheck") ?: return null
        val position = sample.position ?: return null
        return moveExercise(
            id = "u4.giveCheck.${sample.id}", prompt = "Gib dem gegnerischen König Schach.", position = position,
            goal = ChessGoal.Moves(ChessMoveFilter(check = true)),
            explanation = "Schach gibst du, wenn eine deiner Figuren den gegnerischen König angreift.", withSquares = false,
        )
    }

    private fun terms(draw: ChessDraw): LearnExercise? = pairs(
        id = "u4.terms", prompt = "Ordne die Begriffe zu.",
        from = listOf(
            PairCandidate("u4.term.check", "Schach", "Der König wird angegriffen"),
            PairCandidate("u4.term.mate", "Matt", "Schach ohne Ausweg"),
            PairCandidate("u4.term.stalemate", "Patt", "Kein Schach, aber kein erlaubter Zug"),
            PairCandidate("u4.term.draw", "Remis", "Unentschieden"),
        ),
        draw = draw,
    )

    // Getting out of check

    private fun escape(topic: String, kind: ChessEscape, prompt: String, explanation: String): ChessMaker = maker@{ draw ->
        val pool = checked().filter { sample ->
            val position = sample.position
            if (position != null) ChessGoals.accepted(ChessGoal.Escape(kind), position).isNotEmpty() else false
        }
        val sample = draw.pickSample(pool, topic) ?: return@maker null
        val position = sample.position ?: return@maker null
        moveExercise(
            id = "$topic.${sample.id}", prompt = prompt, position = position, goal = ChessGoal.Escape(kind),
            marked = markedOf(sample), explanation = explanation,
        )
    }

    /** The kinds of answer a check has: king moves, capturing the checker, interposing. */
    fun escapeKinds(position: ChessPosition): List<ChessEscape> =
        listOf(ChessEscape.KING_MOVES, ChessEscape.CAPTURE_CHECKER, ChessEscape.INTERPOSE)
            .filter { ChessGoals.accepted(ChessGoal.Escape(it), position).isNotEmpty() }

    private fun escapeWhich(draw: ChessDraw): LearnExercise? {
        val pool = checked().filter { sample ->
            val position = sample.position
            if (position != null) escapeKinds(position).size == 1 else false
        }
        val sample = draw.pickSample(pool, "u4.escape.which") ?: return null
        val position = sample.position ?: return null
        val only = escapeKinds(position).firstOrNull() ?: return null
        val texts = linkedMapOf(
            ChessEscape.KING_MOVES to "Den König ziehen",
            ChessEscape.CAPTURE_CHECKER to "Die Figur schlagen, die Schach gibt",
            ChessEscape.INTERPOSE to "Eine Figur dazwischenstellen",
        )
        val reasons = mapOf(
            ChessEscape.KING_MOVES to "Nichts kann die Figur schlagen oder dazwischenziehen, also muss der König ausweichen.",
            ChessEscape.CAPTURE_CHECKER to "Der König kann nicht ausweichen, und nichts lässt sich dazwischenstellen: Nur das Schlagen der Figur hilft.",
            ChessEscape.INTERPOSE to "Der König kann nicht ausweichen, und die Figur lässt sich nicht schlagen: Nur ein Dazwischenstellen hilft.",
        )
        val right = texts.getValue(only)
        val reason = reasons.getValue(only)
        val wrong = texts.keys.filter { it != only }.map { texts.getValue(it) }.sorted() + listOf("Gar nicht, es ist Matt")
        return choice(
            id = "u4.escape.which.${sample.id}", prompt = "Wie kannst du dieses Schach aufheben? Es gibt nur eine Möglichkeit.", correct = right, wrong = wrong,
            explanation = reason, media = boardMedia(position, markedOf(sample)), draw = draw,
        )
    }

    // Mate, stalemate, draws

    private enum class Outcome { MATE, STALEMATE, CHECK, QUIET }

    private fun outcomeOf(position: ChessPosition): Outcome = when {
        position.isCheckmate -> Outcome.MATE
        position.isStalemate -> Outcome.STALEMATE
        position.isCheck -> Outcome.CHECK
        else -> Outcome.QUIET
    }

    private fun outcomeText(outcome: Outcome): String = when (outcome) {
        Outcome.MATE -> "Matt: Die Partie ist zu Ende"
        Outcome.STALEMATE -> "Patt: Die Partie ist unentschieden"
        Outcome.CHECK -> "Schach, aber kein Matt"
        Outcome.QUIET -> "Kein Schach, die Partie geht weiter"
    }

    private val allOutcomeTexts = listOf(Outcome.MATE, Outcome.STALEMATE, Outcome.CHECK, Outcome.QUIET).map { outcomeText(it) }

    private fun outcomeExplanation(outcome: Outcome, color: ChessColor): String {
        val name = color.germanName
        return when (outcome) {
            Outcome.MATE -> "$name steht im Schach und hat keinen Ausweg: kein freies Feld, nichts zum Schlagen oder Dazwischenstellen. Das ist Schachmatt."
            Outcome.STALEMATE -> "Der König steht nicht im Schach, aber $name hat keinen erlaubten Zug. Das ist Patt, und die Partie ist remis."
            Outcome.CHECK -> "Der König steht im Schach, kann es aber aufheben. Die Partie geht weiter."
            Outcome.QUIET -> "Der König steht nicht im Schach, und $name hat erlaubte Züge. Die Partie geht weiter."
        }
    }

    private fun state(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.mated + ChessSamples.stalemates + ChessSamples.goesOn + ChessSamples.inCheck + ChessSamples.notInCheck
        val sample = draw.pickSample(pool, "u4.state") ?: return null
        val position = sample.position ?: return null
        val outcome = outcomeOf(position)
        val color = position.sideToMove
        return choice(
            id = "u4.state.${sample.id}", prompt = "${color.germanName} ist am Zug. Welche Aussage stimmt?", correct = outcomeText(outcome),
            wrong = allOutcomeTexts.filter { it != outcomeText(outcome) }, explanation = outcomeExplanation(outcome, color),
            media = boardMedia(position, markedOf(sample)), draw = draw,
        )
    }

    private fun mateMove(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.mates.filter { it.theme in listOf("rook", "queen", "backRank") }
        val sample = draw.pickSample(pool, "u4.mateMove") ?: return null
        val position = sample.position ?: return null
        return moveExercise(
            id = "u4.mateMove.${sample.id}", prompt = "Setze mit einem Zug matt.", position = position, goal = ChessGoal.MateInOne,
            explanation = "Matt ist Schach, bei dem der König kein Feld hat, die Figur nicht zu schlagen ist und nichts dazwischengestellt werden kann.",
            withSquares = false,
        )
    }

    private class Result(val move: ChessMove, val outcome: Outcome)

    /**
     * "Weiß spielt Df7. Was ist das Ergebnis?": a move of a king-and-queen or king-and-rook position that mates,
     * stalemates or only checks, whichever the draw picks among those that exist.
     */
    private fun mateOrStale(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.mates.filter { it.theme in listOf("rook", "queen") }
        val sample = draw.pickSample(pool, "u4.mateOrStale") ?: return null
        val position = sample.position ?: return null
        val results = position.legalMoves().map { Result(it, outcomeOf(position.applying(it))) }
        val classes = listOf(Outcome.MATE, Outcome.STALEMATE, Outcome.CHECK).filter { kind -> results.any { it.outcome == kind } }
        val outcome = randomElement(classes, draw.random) ?: return null
        val chosen = randomElement(results.filter { it.outcome == outcome }, draw.random) ?: return null
        val text = ChessNotation.san(chosen.move, position) ?: return null
        val color = position.sideToMove
        return choice(
            id = "u4.mateOrStale.${sample.id}.${chosen.move.uci}", prompt = "${color.germanName} spielt ${ChessKit.sanWithoutSign(text)}. Was ist das Ergebnis?",
            correct = outcomeText(outcome), wrong = allOutcomeTexts.filter { it != outcomeText(outcome) },
            explanation = outcomeExplanation(outcome, color.opposite), media = boardMedia(position), draw = draw,
        )
    }

    private fun dead(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.materialEnds, "u4.dead") ?: return null
        val position = sample.position ?: return null
        val possible = !position.hasInsufficientMaterial
        val kinds = position.pieces.map { it.second.kind }.filter { it != ChessPieceKind.KING }
        val strongest = kinds.maxByOrNull { it.rawValue }
        val explanation = if (!possible) {
            "König gegen König, oder König und ein einzelner Läufer oder Springer gegen König: Das reicht nie zum Matt. Die Partie ist sofort remis."
        } else if (strongest == ChessPieceKind.PAWN) {
            "Ein Bauer kann sich in eine Dame umwandeln, und mit einer Dame ist Matt möglich."
        } else {
            "Mit Dame oder Turm und König lässt sich der gegnerische König mattsetzen."
        }
        return yesNo(
            id = "u4.dead.${sample.id}", prompt = "Reicht das Material, damit überhaupt noch jemand Matt setzen kann?", answer = possible,
            explanation = explanation, media = boardMedia(position), draw = draw,
        )
    }

    val makers: Map<String, ChessMaker> = linkedMapOf(
        "u4.isCheck" to ::isCheck,
        "u4.whichChecks" to ::whichChecks,
        "u4.giveCheck" to ::giveCheck,
        "u4.terms" to ::terms,
        "u4.sentence.check" to sentenceMaker("u4.sentence.check", checkSentences),
        "u4.sentence.end" to sentenceMaker("u4.sentence.end", endSentences),
        "u4.escape.any" to escape(
            "u4.escape.any", ChessEscape.ANY, "Dein König steht im Schach. Hebe das Schach auf.",
            "Es gibt drei Wege: den König ziehen, die Figur schlagen, die Schach gibt, oder eine Figur dazwischenstellen.",
        ),
        "u4.escape.capture" to escape(
            "u4.escape.capture", ChessEscape.CAPTURE_CHECKER, "Schlage die Figur, die Schach gibt.", "Schlägst du die Figur, die Schach gibt, ist das Schach vorbei.",
        ),
        "u4.escape.block" to escape(
            "u4.escape.block", ChessEscape.INTERPOSE, "Stelle eine Figur zwischen deinen König und die Figur, die Schach gibt.",
            "Eine Figur auf einem Feld dazwischen fängt den Angriff ab. Gegen Springer und Bauern geht das nicht.",
        ),
        "u4.escape.king" to escape("u4.escape.king", ChessEscape.KING_MOVES, "Ziehe deinen König aus dem Schach.", "Der König muss auf ein Feld, das kein Gegner angreift."),
        "u4.escape.which" to ::escapeWhich,
        "u4.state" to ::state,
        "u4.mateMove" to ::mateMove,
        "u4.mateOrStale" to ::mateOrStale,
        "u4.dead" to ::dead,
    )
}
