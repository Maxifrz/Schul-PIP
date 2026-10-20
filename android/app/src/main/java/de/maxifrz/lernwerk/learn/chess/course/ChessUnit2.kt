package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.chess.ChessColor
import de.maxifrz.lernwerk.learn.chess.ChessGeometry
import de.maxifrz.lernwerk.learn.chess.ChessGoal
import de.maxifrz.lernwerk.learn.chess.ChessKit
import de.maxifrz.lernwerk.learn.chess.ChessMoveFilter
import de.maxifrz.lernwerk.learn.chess.ChessPiece
import de.maxifrz.lernwerk.learn.chess.ChessPieceKind
import de.maxifrz.lernwerk.learn.chess.ChessPosition
import de.maxifrz.lernwerk.learn.chess.ChessSquare
import de.maxifrz.lernwerk.learn.chess.attackedEnemies
import de.maxifrz.lernwerk.learn.randomElement
import de.maxifrz.lernwerk.learn.shuffled
import kotlin.math.abs
import kotlin.math.max

// Unit 2, "Die Figuren und ihre Züge": the starting position, how each piece moves and captures.
// Port of ChessUnit2.swift.

internal object ChessUnit2 {
    private val sliders = setOf("rook", "bishop", "queen")
    private val steppers = setOf("king", "knight")
    private val allPieces = sliders + steppers

    val review = listOf("u2.identify", "u2.moveTo.all", "u2.count.all", "u2.whichPiece", "u2.reach.all", "u2.captureMove")

    private val slideSentences = listOf(
        sentence("bishop", listOf("Der", "Läufer", "zieht", "nur", "schräg."), listOf("gerade.", "springt")),
        sentence("rook", listOf("Der", "Turm", "zieht", "nur", "gerade."), listOf("schräg.", "L-förmig.")),
        sentence("queen", listOf("Die", "Dame", "zieht", "wie", "Turm", "und", "Läufer", "zusammen."), listOf("König", "Springer")),
    )

    private val stepSentences = listOf(
        sentence("knight", listOf("Nur", "der", "Springer", "darf", "über", "Figuren", "springen."), listOf("Läufer", "Turm")),
        sentence("king", listOf("Der", "König", "zieht", "nur", "ein", "Feld", "weit."), listOf("zwei", "Springer")),
        sentence("attacked", listOf("Der", "König", "darf", "nicht", "auf", "angegriffene", "Felder", "ziehen."), listOf("immer", "Bauern")),
    )

    // The starting position

    private fun identify(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.crowded, "u2.identify") ?: return null
        val position = sample.position ?: return null
        val found = randomElement(position.pieces, draw.random) ?: return null
        val square = found.first
        val p = found.second
        val wrong = shuffled(ChessPieceKind.entries.filter { it != p.kind }.map { it.germanName }, draw.random)
        return choice(
            id = "u2.identify.${sample.id}.${square.name}", prompt = "Welche Figur steht auf dem markierten Feld?", correct = p.kind.germanName,
            wrong = wrong, explanation = "Auf ${square.name} steht ${ChessKit.indefinite(p.kind)}.",
            media = fenBoard(position.fen, listOf(square.name)), draw = draw,
        )
    }

    private fun startSquare(draw: ChessDraw): LearnExercise? {
        val pieces = listOf(
            ChessPiece(ChessColor.WHITE, ChessPieceKind.KING), ChessPiece(ChessColor.BLACK, ChessPieceKind.KING),
            ChessPiece(ChessColor.WHITE, ChessPieceKind.QUEEN), ChessPiece(ChessColor.BLACK, ChessPieceKind.QUEEN),
        )
        val p = draw.pick(pieces, "u2.startSquare") { it.phrase() } ?: return null
        val start = ChessPosition.start
        val sq = start.squaresOf(p).firstOrNull() ?: return null
        val partner = ChessPiece(p.color, if (p.kind == ChessPieceKind.KING) ChessPieceKind.QUEEN else ChessPieceKind.KING)
        val partnerSquare = start.squaresOf(partner).firstOrNull()
        val opposite = ChessSquare.of(sq.file, 7 - sq.rank)
        val side = ChessSquare.of(sq.file + (if (p.kind == ChessPieceKind.KING) 1 else -1), sq.rank)
        if (partnerSquare == null || opposite == null || side == null) return null
        return choice(
            id = "u2.startSquare.${p.color.adjectiveStem}.${p.kind.germanName}",
            prompt = "Auf welchem Feld steht am Anfang ${p.phrase()}?", correct = sq.name,
            wrong = listOf(partnerSquare.name, opposite.name, side.name),
            explanation = "Die Dame steht auf d1 und d8, der König daneben auf e1 und e8.",
            media = fenBoard(start.fen), draw = draw,
        )
    }

    private fun queenColor(draw: ChessDraw): LearnExercise? {
        val color = draw.pick(ChessColor.entries, "u2.queenColor") { it.germanName } ?: return null
        val start = ChessPosition.start
        val sq = start.squaresOf(ChessPiece(color, ChessPieceKind.QUEEN)).firstOrNull() ?: return null
        val word = if (sq.isDark) "dunkel" else "hell"
        return choice(
            id = "u2.queenColor.${color.adjectiveStem}", prompt = "Welche Farbe hat das Startfeld der ${color.adjectiveStem}en Dame?", correct = word,
            wrong = listOf(if (sq.isDark) "hell" else "dunkel"),
            explanation = "Die Dame steht am Anfang auf ihrer eigenen Farbe: Weiß auf d1 (hell), Schwarz auf d8 (dunkel).",
            media = fenBoard(start.fen), draw = draw,
        )
    }

    private class StartCount(val key: String, val prompt: String, val answer: Int, val likely: List<Int>, val explanation: String)

    private fun startCounts(): List<StartCount> {
        val start = ChessPosition.start
        fun count(kind: ChessPieceKind) = start.count(ChessPiece(ChessColor.WHITE, kind))
        return listOf(
            StartCount("pawns", "Wie viele Bauern hat jede Seite am Anfang?", count(ChessPieceKind.PAWN), listOf(6, 10, 16), "Auf der 2. Reihe stehen die 8 weißen Bauern, auf der 7. Reihe die 8 schwarzen."),
            StartCount("rooks", "Wie viele Türme hat jede Seite am Anfang?", count(ChessPieceKind.ROOK), listOf(1, 3, 4), "Die Türme stehen in den Ecken, auf a1 und h1 (Schwarz: a8 und h8)."),
            StartCount("knights", "Wie viele Springer hat jede Seite am Anfang?", count(ChessPieceKind.KNIGHT), listOf(1, 3, 4), "Die Springer stehen auf b1 und g1 (Schwarz: b8 und g8)."),
            StartCount("bishops", "Wie viele Läufer hat jede Seite am Anfang?", count(ChessPieceKind.BISHOP), listOf(1, 3, 4), "Die Läufer stehen auf c1 und f1 (Schwarz: c8 und f8)."),
            StartCount("all", "Wie viele Figuren stehen am Anfang auf dem Brett, die Bauern mitgezählt?", start.pieces.size, listOf(16, 24, 40), "Jede Seite hat 16: einen König, eine Dame, zwei Türme, zwei Läufer, zwei Springer und acht Bauern."),
        )
    }

    private fun startCountChoice(draw: ChessDraw): LearnExercise? {
        val item = draw.pick(startCounts(), "u2.startCount") { it.key } ?: return null
        return choice(
            id = "u2.startCountChoice.${item.key}", prompt = item.prompt, correct = item.answer.toString(),
            wrong = numberWrongs(item.answer, item.likely, draw.random), explanation = item.explanation,
            media = fenBoard(ChessPosition.START_FEN), draw = draw,
        )
    }

    private fun startCountNumber(draw: ChessDraw): LearnExercise? {
        val item = draw.pick(startCounts(), "u2.startCount") { it.key } ?: return null
        return number("u2.startCountNumber.${item.key}", item.prompt, item.answer, item.explanation, fenBoard(ChessPosition.START_FEN))
    }

    private fun letters(draw: ChessDraw): LearnExercise? {
        val kinds = listOf(ChessPieceKind.KING, ChessPieceKind.QUEEN, ChessPieceKind.ROOK, ChessPieceKind.BISHOP, ChessPieceKind.KNIGHT)
        return pairs(
            id = "u2.letters", prompt = "Welcher Buchstabe gehört zu welcher Figur?",
            from = kinds.map { PairCandidate("u2.letter.${it.germanName}", it.germanName, it.letter) }, draw = draw,
        )
    }

    private fun movePairs(draw: ChessDraw): LearnExercise? = pairs(
        id = "u2.movePairs", prompt = "Wie zieht welche Figur?",
        from = listOf(
            PairCandidate("u2.move.king", "König", "ein Feld in jede Richtung"),
            PairCandidate("u2.move.queen", "Dame", "gerade und schräg, beliebig weit"),
            PairCandidate("u2.move.rook", "Turm", "gerade, beliebig weit"),
            PairCandidate("u2.move.bishop", "Läufer", "schräg, beliebig weit"),
            PairCandidate("u2.move.knight", "Springer", "L-Sprung über Figuren"),
        ),
        draw = draw,
    )

    // Counting and moving

    /** The sentence that follows a count: the piece's rule, and why fewer squares than on an empty board. */
    private fun countExplanation(kind: ChessPieceKind, count: Int, onEmptyBoard: Int): String {
        var text = ChessKit.rule(kind)
        if (count < onEmptyBoard) {
            text += when (kind) {
                ChessPieceKind.KING -> " Er darf nicht auf angegriffene Felder und nicht neben den gegnerischen König."
                ChessPieceKind.KNIGHT -> " Auf Felder mit eigenen Figuren darf er nicht."
                else -> " Eigene Figuren versperren den Weg, gegnerische darf er schlagen, dahinter geht es nicht weiter."
            }
        }
        return text + " Möglich sind $count ${if (count == 1) "Feld" else "Felder"}."
    }

    private class CountItem(val sample: ChessSample, val position: ChessPosition, val focus: ChessSquare, val piece: ChessPiece, val count: Int, val empty: Int)

    private fun countSample(draw: ChessDraw, topic: String, kinds: Set<String>): CountItem? {
        val sample = draw.pickSample(ChessSamples.pieceMovesOf(kinds), topic) ?: return null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return null
        val p = position[focus] ?: return null
        val count = destinationsOf(focus, position).size
        return CountItem(sample, position, focus, p, count, ChessGeometry.reach(p.kind, focus).size)
    }

    private fun countChoice(topic: String, kinds: Set<String>): ChessMaker = { draw ->
        val item = countSample(draw, topic, kinds)
        if (item == null) null else choice(
            id = "$topic.${item.sample.id}",
            prompt = "Auf wie viele Felder kann ${ChessKit.nominative(item.piece.kind)} auf ${item.focus.name} ziehen?",
            correct = item.count.toString(),
            wrong = numberWrongs(item.count, listOf(item.empty), draw.random),
            explanation = countExplanation(item.piece.kind, item.count, item.empty),
            media = boardMedia(item.position, listOf(item.focus.name)), draw = draw,
        )
    }

    private fun countNumber(topic: String, kinds: Set<String>): ChessMaker = { draw ->
        val item = countSample(draw, topic, kinds)
        if (item == null) null else number(
            id = "$topic.${item.sample.id}",
            prompt = "Auf wie viele Felder kann ${ChessKit.nominative(item.piece.kind)} auf ${item.focus.name} ziehen? (Schlagen zählt mit.)",
            answer = item.count, explanation = countExplanation(item.piece.kind, item.count, item.empty),
            media = boardMedia(item.position, listOf(item.focus.name)),
        )
    }

    private fun moveTo(topic: String, kinds: Set<String>): ChessMaker = maker@{ draw ->
        val sample = draw.pickSample(ChessSamples.pieceMovesOf(kinds), topic) ?: return@maker null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return@maker null
        val p = position[focus] ?: return@maker null
        val targets = destinationsOf(focus, position)
        val target = randomElement(targets, draw.random) ?: return@maker null
        moveExercise(
            id = "$topic.${sample.id}.${target.name}",
            prompt = "Ziehe ${ChessKit.accusative(p.kind)} von ${focus.name} nach ${target.name}.", position = position,
            goal = ChessGoal.Moves(ChessMoveFilter(from = focus, to = target)), explanation = ChessKit.rule(p.kind),
        )
    }

    private fun reach(topic: String, kinds: Set<String>): ChessMaker = maker@{ draw ->
        val sample = draw.pickSample(ChessSamples.pieceMovesOf(kinds), topic) ?: return@maker null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return@maker null
        val p = position[focus] ?: return@maker null
        val targets = destinationsOf(focus, position)
        val right = randomElement(targets, draw.random) ?: return@maker null
        // Wrong squares: first those the piece would reach on an empty board but not here, then the squares of other
        // pieces' paths, then any square close by.
        val blocked = ChessGeometry.reach(p.kind, focus).filter { it !in targets }
        val others = ChessPieceKind.entries.filter { it != p.kind && it != ChessPieceKind.PAWN }
            .flatMap { ChessGeometry.reach(it, focus) }
            .filter { it !in targets && it !in blocked }
        val close = ChessSquare.all.filter {
            it != focus && it !in targets && it !in blocked && it !in others &&
                max(abs(it.file - focus.file), abs(it.rank - focus.rank)) <= 3
        }
        val wrong = mutableListOf<String>()
        for (group in listOf(shuffled(blocked, draw.random), shuffled(others, draw.random), shuffled(close, draw.random))) {
            for (s in group) if (wrong.size < 3 && s.name !in wrong) wrong.add(s.name)
        }
        choice(
            id = "$topic.${sample.id}", prompt = "Welches Feld kann ${ChessKit.nominative(p.kind)} auf ${focus.name} mit einem Zug erreichen?",
            correct = right.name, wrong = wrong, explanation = ChessKit.rule(p.kind), media = boardMedia(position, listOf(focus.name)), draw = draw,
        )
    }

    /** "Which piece can go from d4 to e6?" on an empty board; only squares for which one or two kinds can do it. */
    private fun whichPiece(draw: ChessDraw): LearnExercise? {
        val kinds = listOf(ChessPieceKind.KING, ChessPieceKind.QUEEN, ChessPieceKind.ROOK, ChessPieceKind.BISHOP, ChessPieceKind.KNIGHT)
        for (i in 0 until 60) {
            val from = randomElement(ChessSquare.all, draw.random) ?: return null
            val to = randomElement(ChessSquare.all, draw.random) ?: return null
            val able = kinds.filter { ChessGeometry.canReach(it, from, to) }
            if (able.isEmpty() || able.size > 2) continue
            val right = randomElement(able, draw.random) ?: continue
            val wrong = kinds.filter { it !in able }.map { it.germanName }
            return choice(
                id = "u2.whichPiece.${from.name}${to.name}",
                prompt = "Welche Figur kann auf einem leeren Brett in einem Zug von ${from.name} nach ${to.name} ziehen?", correct = right.germanName,
                wrong = wrong, explanation = "${ChessKit.rule(right)} Von ${from.name} nach ${to.name} geht das mit: ${ChessKit.list(able.map { it.germanName })}.",
                media = emptyBoard(listOf(from.name, to.name)), draw = draw,
            )
        }
        return null
    }

    // Capturing

    private fun captureMove(draw: ChessDraw): LearnExercise? {
        val withCaptures = ChessSamples.pieceMoves.filter { sample ->
            val position = sample.position
            val focus = sample.focusSquare
            if (position == null || focus == null) false
            else position.legalMoves().any { it.from == focus && position.isCapture(it) }
        }
        val sample = draw.pickSample(withCaptures, "u2.captureMove") ?: return null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return null
        val p = position[focus] ?: return null
        val captures = position.legalMoves().filter { it.from == focus && position.isCapture(it) }
        val targets = captures.map { it.to.name }
        return moveExercise(
            id = "u2.captureMove.${sample.id}", prompt = "Schlage mit ${ChessKit.dative(p.kind)} eine gegnerische Figur.", position = position,
            goal = ChessGoal.Moves(ChessMoveFilter(from = focus, capture = true)),
            explanation = "${ChessKit.rule(p.kind)} Schlagen kannst du hier auf ${ChessKit.list(targets)}.",
        )
    }

    private fun attackCount(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.pieceMoves, "u2.attackCount") ?: return null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return null
        val p = position[focus] ?: return null
        val attacked = position.attackedEnemies(focus)
        val places = if (attacked.isEmpty()) "Auf keinem Feld, das er erreichen kann, steht eine gegnerische Figur."
        else "Angegriffen werden die Figuren auf ${ChessKit.list(attacked.map { it.name })}."
        return number(
            id = "u2.attackCount.${sample.id}",
            prompt = "Wie viele gegnerische Figuren greift ${ChessKit.nominative(p.kind)} auf ${focus.name} an?", answer = attacked.size,
            explanation = "Angreifen heißt: Die Figur könnte im nächsten Zug schlagen. $places", media = boardMedia(position, listOf(focus.name)),
        )
    }

    val makers: Map<String, ChessMaker> = linkedMapOf(
        "u2.identify" to ::identify,
        "u2.startSquare" to ::startSquare,
        "u2.queenColor" to ::queenColor,
        "u2.startCountChoice" to ::startCountChoice,
        "u2.startCountNumber" to ::startCountNumber,
        "u2.letters" to ::letters,
        "u2.movePairs" to ::movePairs,
        "u2.sentence.slide" to sentenceMaker("u2.sentence.slide", slideSentences),
        "u2.sentence.step" to sentenceMaker("u2.sentence.step", stepSentences),
        "u2.count.slider" to countChoice("u2.count.slider", sliders),
        "u2.count.step" to countChoice("u2.count.step", steppers),
        "u2.count.all" to countChoice("u2.count.all", allPieces),
        "u2.countNumber.slider" to countNumber("u2.countNumber.slider", sliders),
        "u2.countNumber.step" to countNumber("u2.countNumber.step", steppers),
        "u2.countNumber.all" to countNumber("u2.countNumber.all", allPieces),
        "u2.moveTo.slider" to moveTo("u2.moveTo.slider", sliders),
        "u2.moveTo.step" to moveTo("u2.moveTo.step", steppers),
        "u2.moveTo.all" to moveTo("u2.moveTo.all", allPieces),
        "u2.reach.step" to reach("u2.reach.step", steppers),
        "u2.reach.all" to reach("u2.reach.all", allPieces),
        "u2.whichPiece" to ::whichPiece,
        "u2.captureMove" to ::captureMove,
        "u2.attackCount" to ::attackCount,
    )
}
