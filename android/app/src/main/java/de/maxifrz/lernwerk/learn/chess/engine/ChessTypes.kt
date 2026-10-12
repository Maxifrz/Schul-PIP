package de.maxifrz.lernwerk.learn.chess

// The building blocks of the chess rules engine: colors, pieces, squares, moves. Port of ChessTypes.swift. Pure Kotlin.

enum class ChessColor {
    WHITE, BLACK;

    val opposite: ChessColor get() = if (this == WHITE) BLACK else WHITE

    /** "Weiß" or "Schwarz". */
    val germanName: String get() = if (this == WHITE) "Weiß" else "Schwarz"

    /** The lower-case adjective stem: "weiß" or "schwarz". */
    val adjectiveStem: String get() = if (this == WHITE) "weiß" else "schwarz"

    /** Pawns move up the board (towards rank 8) for White and down for Black. */
    val pawnDirection: Int get() = if (this == WHITE) 1 else -1

    /** The rank (0 based) a side's pieces start on. */
    val homeRank: Int get() = if (this == WHITE) 0 else 7

    /** The rank (0 based) a side's pawns start on. */
    val pawnStartRank: Int get() = if (this == WHITE) 1 else 6

    /** The rank (0 based) on which a pawn of this side promotes. */
    val promotionRank: Int get() = if (this == WHITE) 7 else 0
}

/** The grammatical case a German piece phrase is put in. */
enum class ChessCase { NOMINATIVE, ACCUSATIVE, DATIVE }

enum class ChessPieceKind(val rawValue: Int) {
    PAWN(1), KNIGHT(2), BISHOP(3), ROOK(4), QUEEN(5), KING(6);

    /** The usual exchange values 1, 3, 3, 5, 9. The king has none: it cannot be captured, only mated. */
    val value: Int
        get() = when (this) {
            PAWN -> 1
            KNIGHT, BISHOP -> 3
            ROOK -> 5
            QUEEN -> 9
            KING -> 0
        }

    /** The letter of German notation: K König, D Dame, T Turm, L Läufer, S Springer; none for a pawn. */
    val letter: String
        get() = when (this) {
            PAWN -> ""
            KNIGHT -> "S"
            BISHOP -> "L"
            ROOK -> "T"
            QUEEN -> "D"
            KING -> "K"
        }

    /** The lower-case letter FEN uses for a black piece (and the one coordinate notation uses for a promotion). */
    val fenLetter: Char
        get() = when (this) {
            PAWN -> 'p'
            KNIGHT -> 'n'
            BISHOP -> 'b'
            ROOK -> 'r'
            QUEEN -> 'q'
            KING -> 'k'
        }

    /** "Bauer", "Springer", "Läufer", "Turm", "Dame", "König". */
    val germanName: String
        get() = when (this) {
            PAWN -> "Bauer"
            KNIGHT -> "Springer"
            BISHOP -> "Läufer"
            ROOK -> "Turm"
            QUEEN -> "Dame"
            KING -> "König"
        }

    /** The plural: "Bauern", "Springer", "Läufer", "Türme", "Damen", "Könige". */
    val germanPlural: String
        get() = when (this) {
            PAWN -> "Bauern"
            KNIGHT -> "Springer"
            BISHOP -> "Läufer"
            ROOK -> "Türme"
            QUEEN -> "Damen"
            KING -> "Könige"
        }

    val isFeminine: Boolean get() = this == QUEEN

    /** The noun in a case; the pawn is a weak noun ("den Bauern"). */
    fun noun(grammaticalCase: ChessCase): String =
        if (this == PAWN && grammaticalCase != ChessCase.NOMINATIVE) "Bauern" else germanName

    /** Definite article: "der Turm", "die Dame", "den Turm", "dem Turm", "der Dame". */
    fun article(grammaticalCase: ChessCase): String = when (grammaticalCase) {
        ChessCase.NOMINATIVE -> if (isFeminine) "die" else "der"
        ChessCase.ACCUSATIVE -> if (isFeminine) "die" else "den"
        ChessCase.DATIVE -> if (isFeminine) "der" else "dem"
    }

    /** Bishop, rook and queen move any number of squares along a line; knight, king and pawn do not. */
    val slides: Boolean get() = this == BISHOP || this == ROOK || this == QUEEN

    companion object {
        /** The kind a FEN letter names (either case), or null. */
        fun fromFenLetter(letter: Char): ChessPieceKind? {
            val lower = letter.lowercaseChar()
            return entries.firstOrNull { it.fenLetter == lower }
        }

        fun fromRawValue(raw: Int): ChessPieceKind? = entries.firstOrNull { it.rawValue == raw }
    }
}

data class ChessPiece(val color: ChessColor, val kind: ChessPieceKind) {
    /** FEN letter: upper case for White. */
    val fenCharacter: Char
        get() = if (color == ChessColor.WHITE) kind.fenLetter.uppercaseChar() else kind.fenLetter

    /** "der weiße Springer", "die schwarze Dame", "den weißen Bauern", "dem schwarzen Turm". */
    fun phrase(grammaticalCase: ChessCase = ChessCase.NOMINATIVE): String {
        val ending = when (grammaticalCase) {
            ChessCase.NOMINATIVE -> "e"
            ChessCase.ACCUSATIVE -> if (kind.isFeminine) "e" else "en"
            ChessCase.DATIVE -> "en"
        }
        return "${kind.article(grammaticalCase)} ${color.adjectiveStem}$ending ${kind.noun(grammaticalCase)}"
    }

    /** The plain name without a color: "Springer". */
    val germanName: String get() = kind.germanName

    companion object {
        fun fromFenCharacter(character: Char): ChessPiece? {
            val kind = ChessPieceKind.fromFenLetter(character) ?: return null
            return ChessPiece(if (character.isUpperCase()) ChessColor.WHITE else ChessColor.BLACK, kind)
        }
    }
}

/** A square is its index 0 to 63: 0 is a1, 1 is b1, 8 is a2, 63 is h8. */
@JvmInline
value class ChessSquare(val index: Int) : Comparable<ChessSquare> {
    init {
        require(index in 0..63) { "A square index is 0 to 63." }
    }

    /** 0 for the a-file to 7 for the h-file. */
    val file: Int get() = index and 7

    /** 0 for rank 1 to 7 for rank 8. */
    val rank: Int get() = index shr 3
    val fileLetter: String get() = FILE_LETTERS[file].toString()
    val rankDigit: String get() = RANK_DIGITS[rank].toString()
    val name: String get() = fileLetter + rankDigit

    /** a1 is a dark square, and the colors alternate from there. */
    val isDark: Boolean get() = (file + rank) % 2 == 0
    val isLight: Boolean get() = !isDark

    override fun compareTo(other: ChessSquare): Int = index.compareTo(other.index)

    /** The square a step away, null off the board. */
    fun offset(file: Int, rank: Int): ChessSquare? = of(this.file + file, this.rank + rank)

    override fun toString(): String = name

    companion object {
        const val FILE_LETTERS = "abcdefgh"
        const val RANK_DIGITS = "12345678"

        val all: List<ChessSquare> = (0 until 64).map { ChessSquare(it) }

        fun of(file: Int, rank: Int): ChessSquare? =
            if (file in 0..7 && rank in 0..7) ChessSquare(rank * 8 + file) else null

        /** "e4"; null for anything else. */
        fun fromName(name: String): ChessSquare? {
            val text = name.lowercase()
            if (text.length != 2) return null
            val file = FILE_LETTERS.indexOf(text[0])
            val rank = RANK_DIGITS.indexOf(text[1])
            if (file < 0 || rank < 0) return null
            return ChessSquare(rank * 8 + file)
        }
    }
}

data class ChessMove(val from: ChessSquare, val to: ChessSquare, val promotion: ChessPieceKind? = null) {
    /** Coordinate notation: "e2e4", "e7e8q"; castling is the king's move, "e1g1". */
    val uci: String get() = from.name + to.name + (promotion?.fenLetter?.toString() ?: "")

    override fun toString(): String = uci

    companion object {
        /** Parses "e2e4" or "e7e8q"; null when malformed. */
        fun fromUci(uci: String): ChessMove? {
            val text = uci.lowercase()
            if (text.length != 4 && text.length != 5) return null
            val from = ChessSquare.fromName(text.substring(0, 2)) ?: return null
            val to = ChessSquare.fromName(text.substring(2, 4)) ?: return null
            var promotion: ChessPieceKind? = null
            if (text.length == 5) {
                val kind = ChessPieceKind.fromFenLetter(text[4]) ?: return null
                if (kind !in PROMOTION_KINDS) return null
                promotion = kind
            }
            return ChessMove(from, to, promotion)
        }

        val PROMOTION_KINDS = listOf(ChessPieceKind.QUEEN, ChessPieceKind.ROOK, ChessPieceKind.BISHOP, ChessPieceKind.KNIGHT)
    }
}

/** The four castling rights as a bit set (1 K, 2 Q, 4 k, 8 q). */
@JvmInline
value class ChessCastlingRights(val rawValue: Int) {
    fun contains(other: ChessCastlingRights): Boolean = rawValue and other.rawValue == other.rawValue
    operator fun plus(other: ChessCastlingRights) = ChessCastlingRights(rawValue or other.rawValue)
    fun subtracting(other: ChessCastlingRights) = ChessCastlingRights(rawValue and other.rawValue.inv())
    val isEmpty: Boolean get() = rawValue == 0

    /** The FEN field: "KQkq", "Kq", or "-". */
    val fen: String
        get() {
            val text = buildString {
                if (contains(WHITE_KINGSIDE)) append('K')
                if (contains(WHITE_QUEENSIDE)) append('Q')
                if (contains(BLACK_KINGSIDE)) append('k')
                if (contains(BLACK_QUEENSIDE)) append('q')
            }
            return text.ifEmpty { "-" }
        }

    companion object {
        val NONE = ChessCastlingRights(0)
        val WHITE_KINGSIDE = ChessCastlingRights(1)
        val WHITE_QUEENSIDE = ChessCastlingRights(2)
        val BLACK_KINGSIDE = ChessCastlingRights(4)
        val BLACK_QUEENSIDE = ChessCastlingRights(8)
        val ALL = ChessCastlingRights(15)

        fun kingside(color: ChessColor) = if (color == ChessColor.WHITE) WHITE_KINGSIDE else BLACK_KINGSIDE
        fun queenside(color: ChessColor) = if (color == ChessColor.WHITE) WHITE_QUEENSIDE else BLACK_QUEENSIDE

        /** Parses the FEN field; null for unknown or repeated letters. */
        fun fromFen(fen: String): ChessCastlingRights? {
            if (fen == "-") return NONE
            var bits = 0
            for (character in fen) {
                bits = bits or when (character) {
                    'K' -> 1
                    'Q' -> 2
                    'k' -> 4
                    'q' -> 8
                    else -> return null
                }
            }
            if (fen.isEmpty() || fen.toSet().size != fen.length) return null
            return ChessCastlingRights(bits)
        }
    }
}

/** Precomputed lines for the move generator: rays along the eight directions and the jumps of knight and king. */
object ChessTables {
    /** (file, rank) steps; the first four are the rook's directions (up, down, right, left), the last four the bishop's. */
    val directions: List<Pair<Int, Int>> =
        listOf(0 to 1, 0 to -1, 1 to 0, -1 to 0, 1 to 1, -1 to 1, 1 to -1, -1 to -1)

    /** `rays[square][direction]`: the squares from the one next to `square` to the edge. */
    val rays: Array<Array<IntArray>> = Array(64) { index ->
        Array(8) { d ->
            val (df, dr) = directions[d]
            val line = ArrayList<Int>()
            var file = (index and 7) + df
            var rank = (index shr 3) + dr
            while (file in 0..7 && rank in 0..7) {
                line.add(rank * 8 + file)
                file += df
                rank += dr
            }
            line.toIntArray()
        }
    }

    val knightJumps: Array<IntArray> = Array(64) { index ->
        val steps = listOf(1 to 2, 2 to 1, 2 to -1, 1 to -2, -1 to -2, -2 to -1, -2 to 1, -1 to 2)
        steps.mapNotNull { (f, r) -> ChessSquare.of((index and 7) + f, (index shr 3) + r)?.index }.toIntArray()
    }

    val kingSteps: Array<IntArray> = Array(64) { index ->
        directions.mapNotNull { (f, r) -> ChessSquare.of((index and 7) + f, (index shr 3) + r)?.index }.toIntArray()
    }
}
