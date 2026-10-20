package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.chess.ChessColor
import de.maxifrz.lernwerk.learn.chess.ChessGoal
import de.maxifrz.lernwerk.learn.chess.ChessKit
import de.maxifrz.lernwerk.learn.chess.ChessMove
import de.maxifrz.lernwerk.learn.chess.ChessMoveFilter
import de.maxifrz.lernwerk.learn.chess.ChessPieceKind
import de.maxifrz.lernwerk.learn.chess.ChessPosition
import de.maxifrz.lernwerk.learn.chess.ChessSquare
import de.maxifrz.lernwerk.learn.chess.attackedSquares
import de.maxifrz.lernwerk.learn.randomElement
import de.maxifrz.lernwerk.learn.shuffled
import kotlin.math.abs

// Unit 3, "Der Bauer": step and double step, capturing, en passant, promotion. Port of ChessUnit3.swift.

internal object ChessUnit3 {
    val review = listOf("u3.moveTwo", "u3.stepCount.all", "u3.capture", "u3.attackedSquare", "u3.epYesNo", "u3.promoMove")

    private val moveSentences = listOf(
        sentence("forward", listOf("Ein", "Bauer", "zieht", "vorwärts", "und", "schlägt", "schräg."), listOf("rückwärts", "gerade.")),
        sentence("never", listOf("Ein", "Bauer", "darf", "nie", "rückwärts", "ziehen."), listOf("immer", "seitwärts")),
        sentence("double", listOf("Den", "Doppelschritt", "gibt", "es", "nur", "vom", "Start", "aus."), listOf("jedem", "Ende")),
    )

    private val specialSentences = listOf(
        sentence("ep", listOf("En", "passant", "geht", "nur", "im", "nächsten", "Zug."), listOf("jederzeit", "Läufer")),
        sentence("promotion", listOf("Auf", "der", "letzten", "Reihe", "wird", "der", "Bauer", "umgewandelt."), listOf("ersten", "Dame")),
    )

    private fun pawnSamples(pool: List<ChessSample>, themes: Set<String>?): List<ChessSample> =
        pool.filter { themes == null || it.theme in themes }

    private fun direction(draw: ChessDraw): LearnExercise? {
        val color = draw.pick(ChessColor.entries, "u3.direction") { it.germanName } ?: return null
        val up = "nach oben, zur 8. Reihe"
        val down = "nach unten, zur 1. Reihe"
        return choice(
            id = "u3.direction.${color.adjectiveStem}", prompt = "In welche Richtung ziehen die ${color.adjectiveStem}en Bauern?",
            correct = if (color == ChessColor.WHITE) up else down, wrong = listOf(if (color == ChessColor.WHITE) down else up, "zur Seite", "in jede Richtung"),
            explanation = "Bauern ziehen nur vorwärts: die weißen nach oben, die schwarzen nach unten.", draw = draw,
        )
    }

    private class StepItem(val sample: ChessSample, val position: ChessPosition, val focus: ChessSquare, val target: ChessSquare)

    private fun stepSample(draw: ChessDraw, topic: String, steps: Int): StepItem? {
        val usable = ChessSamples.pawns.filter { sample ->
            val position = sample.position
            val focus = sample.focusSquare
            if (position == null || focus == null) return@filter false
            val p = position[focus]
            if (p == null || p.kind != ChessPieceKind.PAWN) return@filter false
            val target = focus.offset(0, steps * p.color.pawnDirection)
            target != null && position.isLegal(ChessMove(focus, target))
        }
        val sample = draw.pickSample(usable, topic) ?: return null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return null
        val p = position[focus] ?: return null
        val target = focus.offset(0, steps * p.color.pawnDirection) ?: return null
        return StepItem(sample, position, focus, target)
    }

    private fun moveOne(draw: ChessDraw): LearnExercise? {
        val item = stepSample(draw, "u3.moveOne", 1) ?: return null
        return moveExercise(
            id = "u3.moveOne.${item.sample.id}", prompt = "Ziehe den Bauern von ${item.focus.name} ein Feld vor.", position = item.position,
            goal = ChessGoal.Moves(ChessMoveFilter(from = item.focus, to = item.target)), explanation = "Der Bauer zieht ein Feld geradeaus vorwärts.",
        )
    }

    private fun moveTwo(draw: ChessDraw): LearnExercise? {
        val item = stepSample(draw, "u3.moveTwo", 2) ?: return null
        return moveExercise(
            id = "u3.moveTwo.${item.sample.id}", prompt = "Ziehe den Bauern von ${item.focus.name} zwei Felder vor.", position = item.position,
            goal = ChessGoal.Moves(ChessMoveFilter(from = item.focus, to = item.target)),
            explanation = "Aus der Ausgangsstellung darf der Bauer zwei Felder ziehen, wenn beide Felder frei sind.",
        )
    }

    private fun stepCount(topic: String, themes: Set<String>?): ChessMaker = maker@{ draw ->
        val sample = draw.pickSample(pawnSamples(ChessSamples.pawns, themes), topic) ?: return@maker null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return@maker null
        val moves = position.legalMoves().filter { it.from == focus }
        val straight = moves.count { it.from.file == it.to.file }
        val captures = moves.count { position.isCapture(it) }
        var explanation = "Geradeaus ${if (straight == 1) "1 Zug" else "$straight Züge"}, schräg schlagen ${if (captures == 1) "1 Mal" else "$captures Mal"}."
        if (moves.isEmpty()) explanation = "Direkt vor dem Bauern steht eine Figur, und es gibt nichts zu schlagen: Er kann nicht ziehen."
        choice(
            id = "$topic.${sample.id}", prompt = "Wie viele Züge hat der Bauer auf ${focus.name}?", correct = moves.size.toString(),
            wrong = numberWrongs(moves.size, listOf(2), draw.random), explanation = explanation, media = boardMedia(position, listOf(focus.name)), draw = draw,
        )
    }

    private fun doubleStep(draw: ChessDraw): LearnExercise? {
        val themes = listOf("start", "moved", "blocked", "blockedFar")
        val pool = ChessSamples.pawns.filter { it.theme in themes }
        val sample = draw.pickSample(pool, "u3.doubleStep") ?: return null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return null
        val p = position[focus] ?: return null
        val one = focus.offset(0, p.color.pawnDirection)
        val two = focus.offset(0, 2 * p.color.pawnDirection)
        if (one == null || two == null) return null
        val allowed = position.isLegal(ChessMove(focus, two))
        val reason = if (focus.rank != p.color.pawnStartRank) {
            "Der Bauer ist schon gezogen: zwei Felder darf er nur aus der Ausgangsstellung."
        } else if (position[one] != null) {
            "Direkt vor dem Bauern steht eine Figur: Er kommt nicht vorbei."
        } else if (position[two] != null) {
            "Das zweite Feld ${two.name} ist besetzt: Der Doppelschritt braucht zwei freie Felder."
        } else {
            "Der Bauer steht noch auf seiner Ausgangsreihe, und beide Felder sind frei."
        }
        return yesNo(
            id = "u3.doubleStep.${sample.id}", prompt = "Darf der Bauer auf ${focus.name} jetzt zwei Felder ziehen?", answer = allowed,
            explanation = reason, media = boardMedia(position, listOf(focus.name)), draw = draw,
        )
    }

    private fun capture(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.pawns.filter { sample ->
            val position = sample.position
            val focus = sample.focusSquare
            if (position == null || focus == null) false
            else position.legalMoves().any { it.from == focus && position.isCapture(it) }
        }
        val sample = draw.pickSample(pool, "u3.capture") ?: return null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return null
        return moveExercise(
            id = "u3.capture.${sample.id}", prompt = "Schlage mit dem Bauern auf ${focus.name} eine gegnerische Figur.", position = position,
            goal = ChessGoal.Moves(ChessMoveFilter(from = focus, capture = true)), explanation = "Der Bauer schlägt schräg vorwärts, nie geradeaus.",
        )
    }

    private fun captureDir(draw: ChessDraw): LearnExercise? = choice(
        id = "u3.captureDir", prompt = "In welche Richtung schlägt ein Bauer?", correct = "schräg vorwärts",
        wrong = listOf("geradeaus vorwärts", "zur Seite", "schräg rückwärts"),
        explanation = "Der Bauer zieht geradeaus, schlägt aber schräg vorwärts. Eine Figur direkt vor ihm blockiert ihn nur.", draw = draw,
    )

    private fun attackedSquare(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.pawns, "u3.attackedSquare") ?: return null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return null
        val p = position[focus] ?: return null
        val attacked = position.attackedSquares(focus)
        val right = randomElement(attacked, draw.random) ?: return null
        val step = p.color.pawnDirection
        val candidates = listOf(
            focus.offset(0, step), focus.offset(1, 0), focus.offset(-1, 0),
            focus.offset(1, -step), focus.offset(-1, -step), focus.offset(0, -step),
        )
        val wrong = candidates.filterNotNull().filter { it !in attacked }.map { it.name }
        return choice(
            id = "u3.attackedSquare.${sample.id}", prompt = "Welches Feld greift der markierte Bauer an?", correct = right.name,
            wrong = shuffled(wrong, draw.random),
            explanation = "Ein ${p.color.adjectiveStem}er Bauer greift die Felder schräg vor sich an: ${ChessKit.list(attacked.map { it.name })}.",
            media = boardMedia(position, listOf(focus.name)), draw = draw,
        )
    }

    private fun pairsMaker(draw: ChessDraw): LearnExercise? = pairs(
        id = "u3.pairs", prompt = "Was ist was beim Bauern?",
        from = listOf(
            PairCandidate("u3.pair.step", "Schritt", "ein Feld geradeaus"),
            PairCandidate("u3.pair.double", "Doppelschritt", "zwei Felder, nur vom Start"),
            PairCandidate("u3.pair.capture", "Schlagen", "ein Feld schräg vorwärts"),
            PairCandidate("u3.pair.promotion", "Umwandlung", "auf der letzten Reihe"),
        ),
        draw = draw,
    )

    // En passant

    /** The story that goes with an en passant position: where the pawn that just moved came from and went to. */
    fun doubleStepStory(position: ChessPosition): String? {
        val target = position.enPassant ?: return null
        val mover = position.sideToMove.opposite
        val from = ChessSquare.of(target.file, mover.pawnStartRank) ?: return null
        val to = ChessSquare.of(target.file, mover.pawnStartRank + 2 * mover.pawnDirection) ?: return null
        return "${mover.germanName} hat gerade den Bauern von ${from.name} nach ${to.name} gezogen."
    }

    private fun epMove(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.enPassant.filter { it.theme == "available" }
        val sample = draw.pickSample(pool, "u3.epMove") ?: return null
        val position = sample.position ?: return null
        val story = doubleStepStory(position)
        val target = position.enPassant
        if (story == null || target == null) return null
        return moveExercise(
            id = "u3.epMove.${sample.id}", prompt = "$story Schlage ihn en passant.", position = position,
            goal = ChessGoal.Moves(ChessMoveFilter(enPassant = true)),
            explanation = "Du schlägst den Bauern, als wäre er nur ein Feld gezogen: Dein Bauer landet auf ${target.name}, und der gegnerische Bauer verschwindet.",
        )
    }

    /** "Darf der Bauer en passant schlagen?": the story tells what the last move was, the engine says whether it is legal. */
    fun epYesNo(topic: String, themes: Set<String>): ChessMaker = maker@{ draw ->
        val pool = ChessSamples.enPassant.filter { it.theme in themes }
        val sample = draw.pickSample(pool, topic) ?: return@maker null
        val position = sample.position
        val focus = sample.focusSquare
        val neighbour = sample.detailSquare
        if (position == null || focus == null || neighbour == null) return@maker null
        val neighbourPiece = position[neighbour] ?: return@maker null
        val allowed = position.legalMoves().any { it.from == focus && position.isEnPassant(it) }
        val opponent = position.sideToMove.opposite
        val story = when (sample.theme) {
            "late" -> "Der ${opponent.adjectiveStem}e Bauer steht schon länger auf ${neighbour.name}."
            "single" -> {
                val from = ChessSquare.of(neighbour.file, neighbour.rank - neighbourPiece.color.pawnDirection)
                "${opponent.germanName} hat den Bauern gerade von ${from?.name ?: ""} nach ${neighbour.name} gezogen, nur ein Feld."
            }
            else -> doubleStepStory(position) ?: ""
        }
        val explanation = if (allowed) {
            "Der Bauer ist im letzten Zug zwei Felder gezogen und steht neben deinem: Du darfst jetzt, aber nur jetzt, en passant schlagen."
        } else if (sample.theme == "pinned") {
            "Nach dem Schlagen wären beide Bauern von der Reihe verschwunden, und der gegnerische Turm griffe deinen König an. Ein Zug, der den eigenen König ins Schach stellt, ist verboten."
        } else {
            "En passant gibt es nur direkt nach einem Doppelschritt des gegnerischen Bauern."
        }
        yesNo(
            id = "$topic.${sample.id}",
            prompt = "$story Darf der Bauer auf ${focus.name} den Bauern auf ${neighbour.name} en passant schlagen?",
            answer = allowed, explanation = explanation, media = boardMedia(position, listOf(focus.name, neighbour.name)), draw = draw,
        )
    }

    // Promotion

    private fun promoMove(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.promotions.filter { it.theme in listOf("step", "capture") }
        val sample = draw.pickSample(pool, "u3.promoMove") ?: return null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return null
        return moveExercise(
            id = "u3.promoMove.${sample.id}", prompt = "Dein Bauer erreicht die letzte Reihe. Ziehe ihn und wandle ihn in eine Dame um.", position = position,
            goal = ChessGoal.Moves(ChessMoveFilter(from = focus, promotionTo = ChessPieceKind.QUEEN)),
            explanation = "Auf der letzten Reihe muss sich der Bauer umwandeln, und die Dame ist meist die stärkste Wahl.",
        )
    }

    private fun promoWhich(draw: ChessDraw): LearnExercise? = choice(
        id = "u3.promoWhich", prompt = "In welche Figuren darf sich ein Bauer umwandeln?", correct = "Dame, Turm, Läufer oder Springer",
        wrong = listOf("nur in eine Dame", "Dame, Turm, Läufer, Springer oder König", "nur in eine Figur, die schon geschlagen wurde"),
        explanation = "Erlaubt sind Dame, Turm, Läufer und Springer, auch wenn diese Figur noch auf dem Brett steht. König oder Bauer gibt es nicht.", draw = draw,
    )

    private fun promoRank(draw: ChessDraw): LearnExercise? {
        val color = draw.pick(ChessColor.entries, "u3.promoRank") { it.germanName } ?: return null
        val right = color.promotionRank + 1
        return choice(
            id = "u3.promoRank.${color.adjectiveStem}", prompt = "Auf welcher Reihe wandelt sich ein ${color.adjectiveStem}er Bauer um?", correct = right.toString(),
            wrong = numberWrongs(right, listOf(9 - right, if (color == ChessColor.WHITE) 7 else 2, 4), draw.random, 1),
            explanation = "Ein Bauer wandelt sich auf der letzten Reihe um, die er erreichen kann: bei Weiß die 8., bei Schwarz die 1. Reihe.", draw = draw,
        )
    }

    private fun promoSteps(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.promotions.filter { it.theme in listOf("step", "far") }
        val sample = draw.pickSample(pool, "u3.promoSteps") ?: return null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return null
        val p = position[focus] ?: return null
        val steps = abs(p.color.promotionRank - focus.rank)
        return number(
            id = "u3.promoSteps.${sample.id}", prompt = "Wie viele Züge braucht der Bauer auf ${focus.name} mindestens bis zur Umwandlung?", answer = steps,
            explanation = "Der Bauer muss von Reihe ${focus.rank + 1} bis Reihe ${p.color.promotionRank + 1}: $steps ${if (steps == 1) "Schritt" else "Schritte"}, der letzte ist die Umwandlung.",
            media = boardMedia(position, listOf(focus.name)),
        )
    }

    val makers: Map<String, ChessMaker> = linkedMapOf(
        "u3.direction" to ::direction,
        "u3.moveOne" to ::moveOne,
        "u3.moveTwo" to ::moveTwo,
        "u3.stepCount.simple" to stepCount("u3.stepCount.simple", setOf("start", "moved", "blocked", "blockedFar")),
        "u3.stepCount.all" to stepCount("u3.stepCount.all", null),
        "u3.doubleStep" to ::doubleStep,
        "u3.capture" to ::capture,
        "u3.captureDir" to ::captureDir,
        "u3.attackedSquare" to ::attackedSquare,
        "u3.pairs" to ::pairsMaker,
        "u3.sentence.move" to sentenceMaker("u3.sentence.move", moveSentences),
        "u3.sentence.special" to sentenceMaker("u3.sentence.special", specialSentences),
        "u3.epMove" to ::epMove,
        "u3.epYesNo" to epYesNo("u3.epYesNo", setOf("available", "late", "single")),
        "u3.promoMove" to ::promoMove,
        "u3.promoWhich" to ::promoWhich,
        "u3.promoRank" to ::promoRank,
        "u3.promoSteps" to ::promoSteps,
    )
}
