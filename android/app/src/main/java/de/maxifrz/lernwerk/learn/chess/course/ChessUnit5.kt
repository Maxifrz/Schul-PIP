package de.maxifrz.lernwerk.learn.chess.course

import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.chess.ChessCastleSide
import de.maxifrz.lernwerk.learn.chess.ChessCastling
import de.maxifrz.lernwerk.learn.chess.ChessCastlingProblem
import de.maxifrz.lernwerk.learn.chess.ChessColor
import de.maxifrz.lernwerk.learn.chess.ChessGoal
import de.maxifrz.lernwerk.learn.chess.ChessGoals
import de.maxifrz.lernwerk.learn.chess.ChessKit
import de.maxifrz.lernwerk.learn.chess.ChessMoveFilter
import de.maxifrz.lernwerk.learn.chess.ChessPiece
import de.maxifrz.lernwerk.learn.chess.ChessPieceKind
import de.maxifrz.lernwerk.learn.chess.ChessPosition
import de.maxifrz.lernwerk.learn.chess.ChessSquare
import de.maxifrz.lernwerk.learn.shuffled
import kotlin.math.abs

// Unit 5, "Sonderzüge": castling and when it is not allowed, en passant and promotion in detail.
// Port of ChessUnit5.swift.

internal object ChessUnit5 {
    val review = listOf("u5.castleMove", "u5.castleCan", "u5.classify", "u5.epYesNo", "u5.castleReason")

    private val castleSentences = listOf(
        sentence("king", listOf("Bei", "der", "Rochade", "zieht", "der", "König", "zwei", "Felder", "zum", "Turm."), listOf("drei", "ein")),
        sentence("both", listOf("Die", "Rochade", "ist", "ein", "Zug", "mit", "König", "und", "Turm."), listOf("Dame", "zwei")),
    )

    private val castleRules = listOf(
        statement(
            "check", "Welcher Satz über die Rochade stimmt?", "Der König darf dabei nicht im Schach stehen.",
            listOf("Der Turm darf dabei nicht angegriffen sein.", "Zwischen König und Turm darf eine Figur stehen.", "Die Rochade ist auch erlaubt, wenn der König schon gezogen hat."),
            "Aus dem Schach heraus rochiert man nicht. Der Turm darf angegriffen sein, und zwischen beiden muss alles frei sein.",
        ),
        statement(
            "path", "Welcher Satz über die Rochade stimmt?", "Der König darf nicht über ein angegriffenes Feld ziehen.",
            listOf("Die lange Rochade ist verboten, wenn das Feld b1 angegriffen wird.", "Die Rochade ist verboten, wenn der Turm angegriffen wird.", "Mit einem Turm, der schon gezogen hat und zurückgekehrt ist, darf man rochieren."),
            "Es zählen nur die Felder, über die der König zieht, und das Feld, auf dem er landet. Der Turm und das Feld b1 spielen keine Rolle.",
        ),
        statement(
            "count", "Welcher Satz über die Rochade stimmt?", "Die Rochade zählt als ein Zug.",
            listOf("Die Rochade zählt als zwei Züge.", "Mit der Rochade darf man eine Figur schlagen.", "Nach der Rochade darf man gleich noch einmal ziehen."),
            "König und Turm ziehen zusammen in einem einzigen Zug, und dabei wird nichts geschlagen.",
        ),
        statement(
            "rook", "Welcher Satz über die Rochade stimmt?", "Hat sich ein Turm schon bewegt, geht die Rochade mit diesem Turm nicht mehr.",
            listOf("Die Rochade bleibt erlaubt, wenn der Turm auf sein Feld zurückkehrt.", "Dann geht die Rochade auch mit dem anderen Turm nicht mehr.", "Nur der König muss sich noch nie bewegt haben."),
            "Der König und der Turm, mit dem man rochiert, dürfen sich noch nie bewegt haben. Der andere Turm ist davon nicht betroffen.",
        ),
    )

    private val epRules = listOf(
        statement(
            "moment", "Welcher Satz über en passant stimmt?", "En passant ist nur im Zug direkt nach dem Doppelschritt erlaubt.",
            listOf("En passant ist jederzeit erlaubt, solange die Bauern nebeneinander stehen.", "Auch ein Springer darf en passant schlagen.", "En passant schlägt man einen Bauern, der nur ein Feld gezogen ist."),
            "Nur ein Bauer schlägt en passant, nur einen Bauern, der gerade zwei Felder gezogen ist, und nur sofort.",
        ),
        statement(
            "landing", "Welcher Satz über en passant stimmt?", "Der schlagende Bauer landet auf dem Feld, das der gegnerische Bauer übersprungen hat.",
            listOf("Der schlagende Bauer landet auf dem Feld des gegnerischen Bauern.", "Der schlagende Bauer bleibt auf seinem Feld.", "Der schlagende Bauer landet zwei Felder weiter."),
            "Man schlägt, als wäre der gegnerische Bauer nur ein Feld gezogen. Der Bauer geht also auf das übersprungene Feld.",
        ),
    )

    private val promoRules = listOf(
        statement(
            "must", "Welcher Satz über die Umwandlung stimmt?", "Ein Bauer auf der letzten Reihe muss sich umwandeln.",
            listOf("Ein Bauer darf auf der letzten Reihe bleiben.", "Ein Bauer darf sich nur in eine schon geschlagene Figur umwandeln.", "Ein Bauer darf sich auch in einen König umwandeln."),
            "Der Bauer wird im selben Zug zu Dame, Turm, Läufer oder Springer, ganz gleich, welche Figuren schon geschlagen wurden.",
        ),
        statement(
            "queens", "Welcher Satz über die Umwandlung stimmt?", "Man darf mehrere Damen gleichzeitig haben.",
            listOf("Man darf höchstens eine Dame haben.", "Eine zweite Dame gibt es nur, wenn die erste geschlagen wurde.", "Ein Bauer wird auf der letzten Reihe immer zu einer Dame."),
            "Die Wahl ist nicht auf geschlagene Figuren beschränkt. Auch eine zweite oder dritte Dame ist erlaubt.",
        ),
    )

    private fun castleSide(sample: ChessSample): ChessCastleSide =
        if (sample.detail == "kurz") ChessCastleSide.KINGSIDE else ChessCastleSide.QUEENSIDE

    private fun sideWord(side: ChessCastleSide): String = if (side == ChessCastleSide.KINGSIDE) "kurz" else "lang"

    private fun expectedIs(sample: ChessSample, word: String): Boolean = sample.expected.size == 1 && sample.expected[0] == word

    private class Way(val cross: ChessSquare, val land: ChessSquare)

    /** The squares of the king's way: the one it crosses and the one it lands on. */
    private fun kingWay(side: ChessCastleSide, color: ChessColor): Way {
        val rank = color.homeRank
        return Way(
            ChessSquare.of(if (side == ChessCastleSide.KINGSIDE) 5 else 3, rank)!!,
            ChessSquare.of(if (side == ChessCastleSide.KINGSIDE) 6 else 2, rank)!!,
        )
    }

    private fun castleMove(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.castling.filter { expectedIs(it, "ja") }
        val sample = draw.pickSample(pool, "u5.castleMove") ?: return null
        val position = sample.position ?: return null
        val side = castleSide(sample)
        val way = kingWay(side, position.sideToMove)
        return moveExercise(
            id = "u5.castleMove.${sample.id}", prompt = "Rochiere ${sideWord(side)}.", position = position,
            goal = ChessGoal.Moves(ChessMoveFilter(castling = side)),
            explanation = "Der König zieht zwei Felder zum Turm hin, nach ${way.land.name}. Der Turm springt auf die andere Seite des Königs, nach ${way.cross.name}. Du führst den Zug mit dem König aus.",
        )
    }

    private class SquareCase(val color: ChessColor, val side: ChessCastleSide, val king: Boolean)

    private fun castleSquares(draw: ChessDraw): LearnExercise? {
        val cases = ArrayList<SquareCase>()
        for (color in ChessColor.entries) {
            for (side in listOf(ChessCastleSide.KINGSIDE, ChessCastleSide.QUEENSIDE)) {
                for (king in listOf(true, false)) cases.add(SquareCase(color, side, king))
            }
        }
        val item = draw.pick(cases, "u5.castleSquares") { "${it.color.adjectiveStem}.${sideWord(it.side)}.${it.king}" } ?: return null
        val fen = if (item.color == ChessColor.WHITE) "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" else "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1"
        val position = ChessPosition.fromFen(fen) ?: return null
        val rank = item.color.homeRank
        val kingFrom = ChessSquare.of(4, rank)!!
        val rookFrom = ChessSquare.of(if (item.side == ChessCastleSide.KINGSIDE) 7 else 0, rank)!!
        val way = kingWay(item.side, item.color)
        // The king lands on the far square of its way, the rook on the near one.
        val right = if (item.king) way.land else way.cross
        val other = if (item.king) way.cross else way.land
        val subject = if (item.king) "der König" else "der Turm"
        val castle = ChessGoals.accepted(ChessGoal.Moves(ChessMoveFilter(castling = item.side)), position).firstOrNull() ?: return null
        val after = position.applying(castle)
        if (after[right] != ChessPiece(item.color, if (item.king) ChessPieceKind.KING else ChessPieceKind.ROOK)) return null
        return choice(
            id = "u5.castleSquares.${item.color.adjectiveStem}.${sideWord(item.side)}.${if (item.king) "king" else "rook"}",
            prompt = "Auf welchem Feld steht $subject nach der ${item.side.germanName}n Rochade von ${item.color.germanName}?",
            correct = right.name, wrong = listOf(rookFrom.name, kingFrom.name, other.name),
            explanation = "Der König zieht zwei Felder zum Turm hin und steht auf ${way.land.name}. Der Turm springt über ihn hinweg auf ${way.cross.name}.",
            media = boardMedia(position), draw = draw,
        )
    }

    private fun castlePairs(draw: ChessDraw): LearnExercise? = pairs(
        id = "u5.castlePairs", prompt = "Ordne die Schreibweisen zu.",
        from = listOf(
            PairCandidate("u5.pair.short", "O-O", "kurze Rochade"),
            PairCandidate("u5.pair.long", "O-O-O", "lange Rochade"),
            PairCandidate("u5.pair.whiteShort", "Weiß kurz", "König g1, Turm f1"),
            PairCandidate("u5.pair.whiteLong", "Weiß lang", "König c1, Turm d1"),
        ),
        draw = draw,
    )

    // When castling is not allowed

    private fun story(sample: ChessSample, color: ChessColor, side: ChessCastleSide): String {
        val rank = color.homeRank + 1
        return when (sample.theme) {
            "kingMoved" -> "Der ${color.adjectiveStem}e König hat früher schon einmal gezogen und steht wieder auf e$rank."
            "rookMoved" -> "Der Turm auf ${if (side == ChessCastleSide.KINGSIDE) "h" else "a"}$rank hat früher schon einmal gezogen und steht wieder dort."
            "otherRook" -> "Der Turm auf ${if (side == ChessCastleSide.KINGSIDE) "a" else "h"}$rank hat früher schon einmal gezogen."
            else -> "König und Türme haben sich noch nie bewegt."
        }
    }

    private fun castleCan(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.castling, "u5.castleCan") ?: return null
        val position = sample.position ?: return null
        val side = castleSide(sample)
        val color = position.sideToMove
        val way = kingWay(side, color)
        val allowed = ChessGoals.accepted(ChessGoal.Moves(ChessMoveFilter(castling = side)), position).isNotEmpty()
        val rank = color.homeRank + 1
        val explanation = when (sample.theme) {
            "between" -> "Zwischen König und Turm steht noch eine Figur. Es muss alles frei sein."
            "check" -> "Der König steht im Schach. Aus dem Schach heraus darf man nicht rochieren."
            "cross" -> "Der König müsste über ${way.cross.name} ziehen, und dieses Feld greift der Gegner an."
            "land" -> "Auf dem Zielfeld ${way.land.name} stünde der König im Schach."
            "kingMoved" -> "Hat sich der König einmal bewegt, gibt es die Rochade für den Rest der Partie nicht mehr, auch wenn er zurückkehrt."
            "rookMoved" -> "Mit einem Turm, der sich schon bewegt hat, gibt es keine Rochade mehr."
            "otherRook" -> "Die ${side.germanName} Rochade braucht nur den König und den Turm auf ${if (side == ChessCastleSide.KINGSIDE) "h" else "a"}$rank. Der andere Turm ist egal."
            "b1" -> "Es zählen nur die Felder des Königs. Dass das Feld b$rank angegriffen wird, stört nicht."
            "rookAttacked" -> "Der Turm darf angegriffen sein. Nur die Felder, die der König betritt, müssen sicher sein."
            else -> "Alles ist frei, der König steht nicht im Schach und zieht weder über noch auf ein angegriffenes Feld: Die Rochade ist erlaubt."
        }
        return yesNo(
            id = "u5.castleCan.${sample.id}", prompt = "${story(sample, color, side)} Darf ${color.germanName} jetzt ${sideWord(side)} rochieren?",
            answer = allowed, explanation = explanation, media = boardMedia(position), draw = draw,
        )
    }

    private val reasonTexts = listOf(
        ChessCastlingProblem.PIECES_BETWEEN to "Zwischen König und Turm steht eine Figur.",
        ChessCastlingProblem.IN_CHECK to "Der König steht im Schach.",
        ChessCastlingProblem.CROSSES_ATTACKED_SQUARE to "Der König müsste über ein angegriffenes Feld ziehen.",
        ChessCastlingProblem.LANDS_ON_ATTACKED_SQUARE to "Das Zielfeld des Königs wird angegriffen.",
    )

    /** Reasons that never apply: the rook may be attacked, and the prompt says the king has not moved. */
    private val falseReasons = listOf("Der Turm wird angegriffen.", "Der König hat sich schon bewegt.")

    private fun castleReason(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.castling.filter { sample ->
            val position = sample.position
            if (!expectedIs(sample, "nein") || position == null) return@filter false
            val problems = ChessCastling.problems(castleSide(sample), position)
            problems.size == 1 && problems[0] != ChessCastlingProblem.RIGHT_LOST
        }
        val sample = draw.pickSample(pool, "u5.castleReason") ?: return null
        val position = sample.position ?: return null
        val side = castleSide(sample)
        val problems = ChessCastling.problems(side, position)
        val only = problems.firstOrNull() ?: return null
        val right = reasonTexts.firstOrNull { it.first == only }?.second ?: return null
        val absent = reasonTexts.filter { it.first !in problems }.map { it.second }.sorted() + falseReasons
        val color = position.sideToMove
        val way = kingWay(side, color)
        val detail = when (only) {
            ChessCastlingProblem.CROSSES_ATTACKED_SQUARE -> " Das Feld ${way.cross.name} greift der Gegner an."
            ChessCastlingProblem.LANDS_ON_ATTACKED_SQUARE -> " Das Feld ${way.land.name} greift der Gegner an."
            else -> ""
        }
        return choice(
            id = "u5.castleReason.${sample.id}",
            prompt = "König und Türme haben sich noch nie bewegt. Warum darf ${color.germanName} nicht ${sideWord(side)} rochieren?", correct = right,
            wrong = shuffled(absent, draw.random), explanation = right + detail, media = boardMedia(position), draw = draw,
        )
    }

    // Special moves recognised

    private fun classifyMaker(draw: ChessDraw): LearnExercise? {
        val sample = draw.pickSample(ChessSamples.classify, "u5.classify") ?: return null
        val position = sample.position
        val m = sample.detailMove
        if (position == null || m == null || !position.isLegal(m)) return null
        val p = position[m.from] ?: return null
        val names = listOf("Rochade", "En passant", "Bauernumwandlung", "Doppelschritt")
        val right: String
        val explanation: String
        if (position.isCastling(m)) {
            right = names[0]
            explanation = "Der König zieht zwei Felder, und der Turm zieht mit: Das ist die Rochade."
        } else if (position.isEnPassant(m)) {
            right = names[1]
            explanation = "Der Bauer schlägt schräg auf ein leeres Feld und nimmt den Bauern daneben vom Brett: en passant."
        } else if (m.promotion != null) {
            right = names[2]
            explanation = "Der Bauer erreicht die letzte Reihe und wird zu einer anderen Figur: Bauernumwandlung."
        } else if (p.kind == ChessPieceKind.PAWN && abs(m.to.rank - m.from.rank) == 2) {
            right = names[3]
            explanation = "Der Bauer zieht aus der Ausgangsstellung zwei Felder: Doppelschritt."
        } else {
            return null
        }
        return choice(
            id = "u5.classify.${sample.id}",
            prompt = "${position.sideToMove.germanName} zieht ${ChessKit.accusative(p.kind)} von ${m.from.name} nach ${m.to.name}. Wie heißt dieser Zug?",
            correct = right, wrong = names.filter { it != right }, explanation = explanation,
            media = boardMedia(position, listOf(m.from.name, m.to.name)), draw = draw,
        )
    }

    /** A promotion to a queen that gives check. */
    private fun promoCheck(draw: ChessDraw): LearnExercise? {
        val pool = ChessSamples.promotions.filter { it.theme in listOf("step", "capture") }
        val sample = draw.pickSample(pool, "u5.promoCheck") ?: return null
        val position = sample.position
        val focus = sample.focusSquare
        if (position == null || focus == null) return null
        return moveExercise(
            id = "u5.promoCheck.${sample.id}", prompt = "Wandle den Bauern in eine Dame um und gib damit Schach.", position = position,
            goal = ChessGoal.Moves(ChessMoveFilter(from = focus, promotionTo = ChessPieceKind.QUEEN, check = true)),
            explanation = "Die neue Dame steht auf der letzten Reihe und greift den gegnerischen König auf derselben Reihe an.",
        )
    }

    private fun promoPiece(draw: ChessDraw): LearnExercise? {
        val allowed = ChessPieceKind.entries.filter { it in listOf(ChessPieceKind.QUEEN, ChessPieceKind.ROOK, ChessPieceKind.BISHOP, ChessPieceKind.KNIGHT) }
        val shown = shuffled(allowed, draw.random).take(3).map { it.germanName }
        return choice(
            id = "u5.promoPiece", prompt = "Welche Figur kann ein Bauer bei der Umwandlung nicht werden?", correct = ChessPieceKind.KING.germanName, wrong = shown,
            explanation = "Erlaubt sind Dame, Turm, Läufer und Springer. Zum König wird ein Bauer nie.", draw = draw,
        )
    }

    val makers: Map<String, ChessMaker> = linkedMapOf(
        "u5.castleMove" to ::castleMove,
        "u5.castleSquares" to ::castleSquares,
        "u5.castlePairs" to ::castlePairs,
        "u5.sentence.castle" to sentenceMaker("u5.sentence.castle", castleSentences),
        "u5.castleCan" to ::castleCan,
        "u5.castleReason" to ::castleReason,
        "u5.castleRules" to statementMaker("u5.castleRules", castleRules),
        "u5.classify" to ::classifyMaker,
        "u5.epYesNo" to ChessUnit3.epYesNo("u5.epYesNo", setOf("available", "late", "single", "pinned")),
        "u5.epRules" to statementMaker("u5.epRules", epRules),
        "u5.promoCheck" to ::promoCheck,
        "u5.promoPiece" to ::promoPiece,
        "u5.promoRules" to statementMaker("u5.promoRules", promoRules),
    )
}
