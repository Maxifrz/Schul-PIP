package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.chess.ChessColor
import de.maxifrz.lernwerk.learn.chess.ChessExchange
import de.maxifrz.lernwerk.learn.chess.ChessGoal
import de.maxifrz.lernwerk.learn.chess.ChessKit
import de.maxifrz.lernwerk.learn.chess.ChessMove
import de.maxifrz.lernwerk.learn.chess.ChessNotation
import de.maxifrz.lernwerk.learn.chess.ChessPiece
import de.maxifrz.lernwerk.learn.chess.ChessPieceKind
import de.maxifrz.lernwerk.learn.chess.ChessPosition
import de.maxifrz.lernwerk.learn.randomElement
import de.maxifrz.lernwerk.learn.shuffled

// Unit 6, "Werte und Tausch": piece values, counting material, judging captures and exchanges.
// Port of ChessUnit6.swift.

internal object ChessUnit6 {
    private val valued = listOf(ChessPieceKind.PAWN, ChessPieceKind.KNIGHT, ChessPieceKind.BISHOP, ChessPieceKind.ROOK, ChessPieceKind.QUEEN)

    val review = listOf("u6.valueChoice", "u6.valueSum", "u6.captureBest", "u6.tradeJudge", "u6.materialCount")

    private val valueSentences = listOf(
        sentence("queen", listOf("Die", "Dame", "ist", "neun", "Bauern", "wert."), listOf("fünf", "Springer")),
        sentence("rook", listOf("Ein", "Turm", "ist", "fünf", "Bauern", "wert."), listOf("drei", "Läufer")),
        sentence("minor", listOf("Läufer", "und", "Springer", "sind", "gleich", "viel", "wert."), listOf("Turm", "mehr")),
    )

    private const val valueExplanation = "Bauer 1, Springer 3, Läufer 3, Turm 5, Dame 9. Der König hat keinen Wert, weil er nie verloren gehen darf."

    private fun valueChoice(draw: ChessDraw): LearnExercise? {
        val kind = draw.pick(valued, "u6.value") { it.germanName } ?: return null
        val others = valued.map { it.value }.filter { it != kind.value }
        val likely = shuffled(others, draw.random)
        return choice(
            id = "u6.valueChoice.${kind.germanName}", prompt = "Wie viele Bauern ist ${ChessKit.nominative(kind)} wert?", correct = kind.value.toString(),
            wrong = numberWrongs(kind.value, likely, draw.random, 1), explanation = valueExplanation, draw = draw,
        )
    }

    private fun valueNumber(draw: ChessDraw): LearnExercise? {
        val kind = draw.pick(valued, "u6.value") { it.germanName } ?: return null
        return number("u6.valueNumber.${kind.germanName}", "Wie viele Bauern ist ${ChessKit.nominative(kind)} wert?", kind.value, valueExplanation)
    }

    private fun valuePairs(draw: ChessDraw): LearnExercise? {
        val minor = if (draw.coin()) ChessPieceKind.KNIGHT else ChessPieceKind.BISHOP
        val kinds = listOf(ChessPieceKind.PAWN, minor, ChessPieceKind.ROOK, ChessPieceKind.QUEEN)
        return pairs(
            id = "u6.valuePairs", prompt = "Wie viele Bauern ist die Figur wert?",
            from = kinds.map { PairCandidate("u6.value.${it.germanName}", it.germanName, it.value.toString()) }, draw = draw,
        )
    }

    // Adding values

    private class Part(val kind: ChessPieceKind, val count: Int)
    private class Group(val parts: List<Part>)

    private fun groupSum(g: Group): Int = g.parts.fold(0) { total, p -> total + p.kind.value * p.count }
    private fun groupText(g: Group): String =
        g.parts.joinToString(" und ") { if (it.count == 1) ChessKit.indefinite(it.kind) else "zwei ${it.kind.germanPlural}" }

    private fun groupCalculation(g: Group): String {
        val values = g.parts.flatMap { p -> List(p.count) { p.kind.value.toString() } }
        return if (values.size == 1) values[0] else values.joinToString(" + ") + " = ${groupSum(g)}"
    }

    private fun groupKey(g: Group): String = g.parts.joinToString("-") { "${it.kind.rawValue}x${it.count}" }

    private fun capitalised(text: String): String = text.substring(0, 1).uppercase() + text.substring(1)

    private fun valueSum(draw: ChessDraw): LearnExercise? {
        for (i in 0 until 30) {
            val single = randomElement(valued, draw.random)
            val first = randomElement(valued, draw.random)
            val second = randomElement(valued, draw.random)
            if (single == null || first == null || second == null) return null
            val one = Group(listOf(Part(single, 1)))
            val two = if (first == second) Group(listOf(Part(first, 2))) else Group(listOf(Part(first, 1), Part(second, 1)))
            if (groupSum(one) == groupSum(two) || groupKey(one) == groupKey(two)) continue
            val (bigger, smaller) = if (groupSum(one) > groupSum(two)) one to two else two to one
            return choice(
                id = "u6.valueSum.${groupKey(one)}.${groupKey(two)}", prompt = "Was ist mehr wert?", correct = capitalised(groupText(bigger)),
                wrong = listOf(capitalised(groupText(smaller))),
                explanation = "${capitalised(groupText(bigger))}: ${groupCalculation(bigger)}. ${capitalised(groupText(smaller))}: ${groupCalculation(smaller)}.",
                draw = draw,
            )
        }
        return null
    }

    // Counting material

    /** "1 Turm (5) + 3 Bauern (3) = 8". */
    fun materialSum(color: ChessColor, position: ChessPosition): String {
        val parts = ArrayList<String>()
        for (kind in listOf(ChessPieceKind.QUEEN, ChessPieceKind.ROOK, ChessPieceKind.BISHOP, ChessPieceKind.KNIGHT, ChessPieceKind.PAWN)) {
            val count = position.count(ChessPiece(color, kind))
            if (count <= 0) continue
            parts.add("$count ${if (count == 1) kind.germanName else kind.germanPlural} (${count * kind.value})")
        }
        return if (parts.isEmpty()) "0" else parts.joinToString(" + ") + " = ${position.material(color)}"
    }

    private fun materialCount(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.materialCounts, "u6.materialCount") ?: return null
        val position = sample.position
        val color = randomElement(ChessColor.entries, draw.random)
        if (position == null || color == null) return null
        return number(
            id = "u6.materialCount.${sample.id}.${color.adjectiveStem}", prompt = "Wie viel Material hat ${color.germanName}? Zähle ohne den König.",
            answer = position.material(color), explanation = materialSum(color, position) + ".", media = boardMedia(position),
        )
    }

    private fun materialWho(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.materialCounts, "u6.materialWho") ?: return null
        val position = sample.position ?: return null
        val white = position.material(ChessColor.WHITE)
        val black = position.material(ChessColor.BLACK)
        val right = if (white > black) "Weiß" else if (black > white) "Schwarz" else "Beide gleich viel"
        return choice(
            id = "u6.materialWho.${sample.id}", prompt = "Wer hat mehr Material? Zähle ohne die Könige.", correct = right,
            wrong = listOf("Weiß", "Schwarz", "Beide gleich viel").filter { it != right }, explanation = "Weiß: $white, Schwarz: $black.",
            media = boardMedia(position), draw = draw,
        )
    }

    // Captures and exchanges

    private fun signed(n: Int): String = if (n > 0) "+$n" else if (n < 0) "−${-n}" else "0"

    private fun captureList(position: ChessPosition): String {
        val entries = ArrayList<String>()
        for (entry in ChessExchange.captures(position)) {
            val text = ChessNotation.san(entry.move, position)
            if (text != null) entries.add("$text ${signed(entry.gain)}")
        }
        return entries.joinToString(", ")
    }

    private fun captureBest(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.captureChoices, "u6.captureBest") ?: return null
        val position = sample.position ?: return null
        if (ChessExchange.bestCaptures(position).moves.isEmpty()) return null
        return moveExercise(
            id = "u6.captureBest.${sample.id}", prompt = "Schlage so, dass du am meisten gewinnst.", position = position, goal = ChessGoal.BestCapture,
            explanation = "Gewinn pro Schlag, nachdem beide Seiten auf dem Feld alles getauscht haben, was sich lohnt: ${captureList(position)}. Prüfe immer, ob die Figur gedeckt ist.",
        )
    }

    private fun judgement(gain: Int): String =
        if (gain > 0) "Das gewinnt Material" else if (gain < 0) "Das verliert Material" else "Das ist ausgeglichen"

    private fun judgeExercise(id: String, position: ChessPosition, m: ChessMove, draw: ChessDraw): LearnExercise? {
        val p = position[m.from]
        if (p == null || !position.isCapture(m)) return null
        val gain = ChessExchange.gain(m, position)
        val color = position.sideToMove
        val to = m.to.name
        val explanation = if (gain > 0) {
            "Nach allen Schlägen auf $to hat ${color.germanName} $gain ${if (gain == 1) "Punkt" else "Punkte"} mehr."
        } else if (gain < 0) {
            "Nach allen Schlägen auf $to hat ${color.germanName} ${-gain} ${if (gain == -1) "Punkt" else "Punkte"} weniger."
        } else {
            "Nach allen Schlägen auf $to ist das Material gleich geblieben."
        }
        val options = listOf(judgement(1), judgement(0), judgement(-1))
        return choice(
            id = id, prompt = "${color.germanName} schlägt mit ${ChessKit.dative(p.kind)} auf $to. Wie ist das für ${color.germanName}?",
            correct = judgement(gain), wrong = options.filter { it != judgement(gain) }, explanation = explanation,
            media = boardMedia(position, listOf(m.from.name, to)), draw = draw,
        )
    }

    private fun tradeJudge(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.trades, "u6.tradeJudge") ?: return null
        val position = sample.position
        val m = sample.detailMove
        if (position == null || m == null) return null
        return judgeExercise("u6.tradeJudge.${sample.id}", position, m, draw)
    }

    private fun tradeKinds(draw: ChessDraw): LearnExercise? {
        val attacker = randomElement(valued, draw.random)
        val victim = randomElement(valued, draw.random)
        if (attacker == null || victim == null) return null
        val difference = victim.value - attacker.value
        val options = listOf(judgement(1), judgement(0), judgement(-1))
        return choice(
            id = "u6.tradeKinds.${attacker.germanName}.${victim.germanName}",
            prompt = "Du schlägst mit ${ChessKit.dative(attacker)} ${ChessKit.indefiniteAccusative(victim)}. Dein Gegner schlägt sofort zurück. Wie ist das für dich?",
            correct = judgement(difference), wrong = options.filter { it != judgement(difference) },
            explanation = "Du bekommst ${victim.value} und gibst ${attacker.value} her: ${signed(difference)}.", draw = draw,
        )
    }

    // Several attackers

    private fun openContests(): List<ChessSample> = ChessSamples.contests.filter { sample ->
        val position = sample.position
        val sq = sample.focusSquare
        if (position == null || sq == null) false else !ChessKit.hasHiddenAttackers(sq, position)
    }

    private fun contestCount(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(openContests(), "u6.contestCount") ?: return null
        val position = sample.position
        val sq = sample.focusSquare
        if (position == null || sq == null) return null
        val p = position[sq]
        val color = randomElement(ChessColor.entries, draw.random)
        if (p == null || color == null) return null
        val attackers = position.attackers(sq, color)
        val count = attackers.size
        val attacking = color != p.color
        val name = sq.name
        val prompt = if (attacking) "Wie viele ${color.adjectiveStem}e Figuren greifen ${ChessKit.accusative(p.kind)} auf $name an?"
        else "Wie viele ${color.adjectiveStem}e Figuren decken ${ChessKit.accusative(p.kind)} auf $name?"
        val squares = attackers.map { it.name }
        return number(
            id = "u6.contestCount.${sample.id}.${color.adjectiveStem}", prompt = prompt, answer = count,
            explanation = if (count == 0) "Keine ${color.adjectiveStem}e Figur kann auf $name schlagen." else "Auf $name können schlagen: ${ChessKit.list(squares)}.",
            media = boardMedia(position, listOf(name)),
        )
    }

    private fun contestJudge(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.contests, "u6.contestJudge") ?: return null
        val position = sample.position
        val sq = sample.focusSquare
        if (position == null || sq == null) return null
        val captures = position.legalMoves().filter { it.to == sq && position.isCapture(it) }
        val m = randomElement(captures, draw.random) ?: return null
        return judgeExercise("u6.contestJudge.${sample.id}.${m.uci}", position, m, draw)
    }

    private fun contestBest(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.contests, "u6.contestBest") ?: return null
        val position = sample.position ?: return null
        return moveExercise(
            id = "u6.contestBest.${sample.id}", prompt = "Schlage so, dass du am meisten gewinnst.", position = position, goal = ChessGoal.BestCapture,
            explanation = "Zähle die Schläge der Reihe nach durch. Gewinn pro Schlag: ${captureList(position)}.",
        )
    }

    val makers: Map<String, ChessMaker> = linkedMapOf(
        "u6.valueChoice" to ::valueChoice,
        "u6.valueNumber" to ::valueNumber,
        "u6.valuePairs" to ::valuePairs,
        "u6.valueSum" to ::valueSum,
        "u6.sentence.values" to sentenceMaker("u6.sentence.values", valueSentences),
        "u6.materialCount" to ::materialCount,
        "u6.materialWho" to ::materialWho,
        "u6.captureBest" to ::captureBest,
        "u6.tradeJudge" to ::tradeJudge,
        "u6.tradeKinds" to ::tradeKinds,
        "u6.contestCount" to ::contestCount,
        "u6.contestJudge" to ::contestJudge,
        "u6.contestBest" to ::contestBest,
    )
}
