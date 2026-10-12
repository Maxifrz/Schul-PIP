package de.maxifrz.lernwerk.learn.chess

import kotlin.math.abs

/**
 * A complete chess position as FEN holds it: the board, the side to move, the castling rights, the en passant square
 * and the two move counters. Immutable; every move makes a new position. Port of ChessPosition.swift and
 * ChessMoveGeneration.swift.
 *
 * The board is 64 codes from a1: 0 empty, 1 to 6 White's pawn to king, 9 to 14 Black's.
 */
class ChessPosition private constructor(
    private val board: IntArray,
    val sideToMove: ChessColor,
    val castling: ChessCastlingRights,
    /** The square behind a pawn that has just advanced two squares, as FEN prints it. */
    val enPassant: ChessSquare?,
    /** Half moves since the last capture or pawn move; a draw can be claimed at 100. */
    val halfmoveClock: Int,
    val fullmoveNumber: Int,
) {
    // MARK: Reading the board

    operator fun get(square: ChessSquare): ChessPiece? = pieceFromCode(board[square.index])

    fun pieceAt(square: ChessSquare): ChessPiece? = get(square)

    /** Every piece with its square, from a1 up. */
    val pieces: List<Pair<ChessSquare, ChessPiece>>
        get() {
            val result = ArrayList<Pair<ChessSquare, ChessPiece>>()
            for (index in 0 until 64) {
                val piece = pieceFromCode(board[index]) ?: continue
                result.add(ChessSquare(index) to piece)
            }
            return result
        }

    fun squaresOf(piece: ChessPiece): List<ChessSquare> {
        val wanted = code(piece.color, piece.kind)
        return (0 until 64).filter { board[it] == wanted }.map { ChessSquare(it) }
    }

    fun squaresOf(color: ChessColor): List<ChessSquare> {
        val bit = colorBit(color)
        return (0 until 64).filter { board[it] != 0 && board[it] and 8 == bit }.map { ChessSquare(it) }
    }

    fun kingSquare(color: ChessColor): ChessSquare? {
        val index = kingIndex(color)
        return if (index < 0) null else ChessSquare(index)
    }

    private fun kingIndex(color: ChessColor): Int {
        val wanted = code(color, ChessPieceKind.KING)
        for (i in 0 until 64) if (board[i] == wanted) return i
        return -1
    }

    /** The total value of a side's pieces with 1, 3, 3, 5, 9 and nothing for the king. */
    fun material(color: ChessColor): Int {
        val bit = colorBit(color)
        var total = 0
        for (c in board) if (c != 0 && c and 8 == bit) total += VALUES[c and 7]
        return total
    }

    /** Material of the side to move minus the other side's. */
    val materialBalanceForSideToMove: Int get() = material(sideToMove) - material(sideToMove.opposite)

    fun count(piece: ChessPiece): Int {
        val wanted = code(piece.color, piece.kind)
        return board.count { it == wanted }
    }

    // MARK: FEN

    /** The six FEN fields. */
    val fen: String
        get() {
            val rows = ArrayList<String>()
            for (rank in 7 downTo 0) {
                val row = StringBuilder()
                var gap = 0
                for (file in 0 until 8) {
                    val piece = pieceFromCode(board[rank * 8 + file])
                    if (piece != null) {
                        if (gap > 0) {
                            row.append(gap)
                            gap = 0
                        }
                        row.append(piece.fenCharacter)
                    } else {
                        gap += 1
                    }
                }
                if (gap > 0) row.append(gap)
                rows.add(row.toString())
            }
            val side = if (sideToMove == ChessColor.WHITE) "w" else "b"
            return "${rows.joinToString("/")} $side ${castling.fen} ${enPassant?.name ?: "-"} $halfmoveClock $fullmoveNumber"
        }

    /** The board as eight text lines, rank 8 first; for tests and debugging. */
    val diagram: String
        get() = (0 until 8).joinToString("\n") { row ->
            val rank = 7 - row
            (0 until 8).joinToString("") { file ->
                pieceFromCode(board[rank * 8 + file])?.fenCharacter?.toString() ?: "."
            }
        }

    // MARK: Changing the board

    /** The position with a piece put on a square or taken off it; the counters and rights stay as they are. */
    fun setting(piece: ChessPiece?, square: ChessSquare): ChessPosition {
        val copy = board.copyOf()
        copy[square.index] = if (piece == null) 0 else code(piece.color, piece.kind)
        return ChessPosition(copy, sideToMove, castling, enPassant, halfmoveClock, fullmoveNumber)
    }

    fun withSideToMove(sideToMove: ChessColor): ChessPosition =
        ChessPosition(board, sideToMove, castling, enPassant, halfmoveClock, fullmoveNumber)

    // MARK: Attacks

    /** Whether a piece of `color` attacks the square (a pawn attacks diagonally forward; a pinned piece still attacks). */
    fun isAttacked(square: ChessSquare, by: ChessColor): Boolean = isAttacked(board, square.index, by)

    /** The squares of every piece of `color` that attacks the square, from a1 up. */
    fun attackers(square: ChessSquare, by: ChessColor): List<ChessSquare> {
        val target = square.index
        val bit = colorBit(by)
        val result = ArrayList<Int>()
        val file = target and 7
        val rank = target shr 3
        if (by == ChessColor.WHITE) {
            if (rank > 0) {
                if (file > 0 && board[target - 9] == 1) result.add(target - 9)
                if (file < 7 && board[target - 7] == 1) result.add(target - 7)
            }
        } else if (rank < 7) {
            if (file > 0 && board[target + 7] == 9) result.add(target + 7)
            if (file < 7 && board[target + 9] == 9) result.add(target + 9)
        }
        for (from in ChessTables.knightJumps[target]) if (board[from] == 2 + bit) result.add(from)
        for (from in ChessTables.kingSteps[target]) if (board[from] == 6 + bit) result.add(from)
        for (direction in 0 until 8) {
            for (from in ChessTables.rays[target][direction]) {
                val c = board[from]
                if (c == 0) continue
                if (c and 8 == bit) {
                    val kind = c and 7
                    if (kind == 5 || (if (direction < 4) kind == 4 else kind == 3)) result.add(from)
                }
                break
            }
        }
        result.sort()
        return result.map { ChessSquare(it) }
    }

    /** Whether the side to move is in check. */
    val isCheck: Boolean
        get() {
            val king = kingIndex(sideToMove)
            return king >= 0 && isAttacked(board, king, sideToMove.opposite)
        }

    /** Whether `color`'s king is attacked, whoever is to move. */
    fun isInCheck(color: ChessColor): Boolean {
        val king = kingIndex(color)
        return king >= 0 && isAttacked(board, king, color.opposite)
    }

    // MARK: Making a move

    /**
     * The position after a move. The move has to be legal in this position; nothing is checked here. A pawn that
     * reaches the last rank without a piece named becomes a queen.
     */
    fun applying(move: ChessMove): ChessPosition {
        val next = board.copyOf()
        val from = move.from.index
        val to = move.to.index
        val moving = board[from]
        val target = board[to]
        val kind = moving and 7
        val color = if (moving and 8 == 0) ChessColor.WHITE else ChessColor.BLACK
        var isCapture = target != 0
        next[from] = 0
        if (kind == 1) {
            if (move.to == enPassant && target == 0 && move.from.file != move.to.file) {
                next[move.from.rank * 8 + move.to.file] = 0
                isCapture = true
            }
            next[to] = if (move.to.rank == color.promotionRank) code(color, move.promotion ?: ChessPieceKind.QUEEN) else moving
        } else {
            next[to] = moving
            if (kind == 6 && abs(move.to.file - move.from.file) == 2) {
                val rank = move.from.rank
                if (move.to.file == 6) {
                    next[rank * 8 + 7] = 0
                    next[rank * 8 + 5] = code(color, ChessPieceKind.ROOK)
                } else {
                    next[rank * 8] = 0
                    next[rank * 8 + 3] = code(color, ChessPieceKind.ROOK)
                }
            }
        }
        // Castling rights go when the king or a rook leaves its square, or a rook is captured on its square.
        var rights = castling
        for (square in intArrayOf(from, to)) {
            rights = when (square) {
                4 -> rights.subtracting(ChessCastlingRights.WHITE_KINGSIDE).subtracting(ChessCastlingRights.WHITE_QUEENSIDE)
                0 -> rights.subtracting(ChessCastlingRights.WHITE_QUEENSIDE)
                7 -> rights.subtracting(ChessCastlingRights.WHITE_KINGSIDE)
                60 -> rights.subtracting(ChessCastlingRights.BLACK_KINGSIDE).subtracting(ChessCastlingRights.BLACK_QUEENSIDE)
                56 -> rights.subtracting(ChessCastlingRights.BLACK_QUEENSIDE)
                63 -> rights.subtracting(ChessCastlingRights.BLACK_KINGSIDE)
                else -> rights
            }
        }
        val passant = if (kind == 1 && abs(move.to.rank - move.from.rank) == 2) ChessSquare((from + to) / 2) else null
        val clock = if (kind == 1 || isCapture) 0 else halfmoveClock + 1
        val full = if (color == ChessColor.BLACK) fullmoveNumber + 1 else fullmoveNumber
        return ChessPosition(next, color.opposite, rights, passant, clock, full)
    }

    /** The position after a legal move in coordinate notation like "e2e4" or "e7e8q"; null when it is not legal. */
    fun playing(uci: String): ChessPosition? {
        val move = ChessMove.fromUci(uci) ?: return null
        if (!legalMoves().contains(move)) return null
        return applying(move)
    }

    /** The position after the moves, in coordinate notation, in order; null when one is not legal. */
    fun playing(line: List<String>): ChessPosition? {
        var position = this
        for (uci in line) position = position.playing(uci) ?: return null
        return position
    }

    // MARK: Pseudo-legal moves

    /**
     * Every move the pieces can make by their own rules, castling included, whether or not it leaves the own king in
     * check. `legalMoves()` filters those.
     */
    fun pseudoLegalMoves(): List<ChessMove> {
        val moves = ArrayList<ChessMove>(48)
        val side = sideToMove
        val bit = colorBit(side)
        for (from in 0 until 64) {
            val c = board[from]
            if (c == 0 || c and 8 != bit) continue
            val origin = ChessSquare(from)
            when (c and 7) {
                1 -> addPawnMoves(origin, side, moves)
                2 -> for (target in ChessTables.knightJumps[from]) {
                    if (board[target] == 0 || board[target] and 8 != bit) moves.add(ChessMove(origin, ChessSquare(target)))
                }
                3 -> addSlidingMoves(origin, 4, 8, bit, moves)
                4 -> addSlidingMoves(origin, 0, 4, bit, moves)
                5 -> addSlidingMoves(origin, 0, 8, bit, moves)
                else -> {
                    for (target in ChessTables.kingSteps[from]) {
                        if (board[target] == 0 || board[target] and 8 != bit) moves.add(ChessMove(origin, ChessSquare(target)))
                    }
                    addCastlingMoves(side, moves)
                }
            }
        }
        return moves
    }

    private fun addSlidingMoves(from: ChessSquare, firstDirection: Int, endDirection: Int, bit: Int, moves: MutableList<ChessMove>) {
        val rays = ChessTables.rays[from.index]
        for (direction in firstDirection until endDirection) {
            for (target in rays[direction]) {
                val c = board[target]
                if (c == 0) {
                    moves.add(ChessMove(from, ChessSquare(target)))
                    continue
                }
                if (c and 8 != bit) moves.add(ChessMove(from, ChessSquare(target)))
                break
            }
        }
    }

    private fun addPawnMoves(from: ChessSquare, side: ChessColor, moves: MutableList<ChessMove>) {
        val step = side.pawnDirection
        val promotes = from.rank + step == side.promotionRank
        fun add(target: ChessSquare) {
            if (promotes) {
                for (kind in ChessMove.PROMOTION_KINDS) moves.add(ChessMove(from, target, kind))
            } else {
                moves.add(ChessMove(from, target))
            }
        }
        val ahead = from.offset(0, step)
        if (ahead != null && board[ahead.index] == 0) {
            add(ahead)
            if (from.rank == side.pawnStartRank) {
                val twice = from.offset(0, 2 * step)
                if (twice != null && board[twice.index] == 0) moves.add(ChessMove(from, twice))
            }
        }
        for (df in intArrayOf(-1, 1)) {
            val target = from.offset(df, step) ?: continue
            val c = board[target.index]
            if (c != 0) {
                if (c and 8 != colorBit(side)) add(target)
            } else if (target == enPassant) {
                // The captured pawn stands beside the capturing one, on the square the double step ended on.
                val victim = board[from.rank * 8 + target.file]
                if (victim == code(side.opposite, ChessPieceKind.PAWN)) moves.add(ChessMove(from, target))
            }
        }
    }

    /**
     * Castling needs the right, king and rook at home, nothing between them, and the king neither in check nor
     * crossing or landing on an attacked square. The rook may be attacked, and the rook's own path may be.
     */
    private fun addCastlingMoves(side: ChessColor, moves: MutableList<ChessMove>) {
        val base = side.homeRank * 8
        val king = code(side, ChessPieceKind.KING)
        val rook = code(side, ChessPieceKind.ROOK)
        if (board[base + 4] != king) return
        val enemy = side.opposite
        val kingside = castling.contains(ChessCastlingRights.kingside(side)) && board[base + 7] == rook &&
            board[base + 5] == 0 && board[base + 6] == 0
        val queenside = castling.contains(ChessCastlingRights.queenside(side)) && board[base] == rook &&
            board[base + 1] == 0 && board[base + 2] == 0 && board[base + 3] == 0
        if (!(kingside || queenside) || isAttacked(board, base + 4, enemy)) return
        if (kingside && !isAttacked(board, base + 5, enemy) && !isAttacked(board, base + 6, enemy)) {
            moves.add(ChessMove(ChessSquare(base + 4), ChessSquare(base + 6)))
        }
        if (queenside && !isAttacked(board, base + 3, enemy) && !isAttacked(board, base + 2, enemy)) {
            moves.add(ChessMove(ChessSquare(base + 4), ChessSquare(base + 2)))
        }
    }

    // MARK: Legal moves

    /** The moves that do not leave the mover's own king in check. */
    fun legalMoves(): List<ChessMove> {
        val side = sideToMove
        var king = kingIndex(side)
        if (king < 0) return emptyList()
        val enemy = side.opposite
        val work = board.copyOf()
        val result = ArrayList<ChessMove>(40)
        for (move in pseudoLegalMoves()) {
            val from = move.from.index
            val to = move.to.index
            val moving = work[from]
            val captured = work[to]
            var victimIndex = -1
            var victim = 0
            if (moving and 7 == 1 && captured == 0 && move.from.file != move.to.file) {
                victimIndex = move.from.rank * 8 + move.to.file
                victim = work[victimIndex]
                work[victimIndex] = 0
            }
            work[to] = moving
            work[from] = 0
            val isKingMove = moving and 7 == 6
            if (isKingMove) king = to
            val safe = !isAttacked(work, king, enemy)
            if (isKingMove) king = from
            work[from] = moving
            work[to] = captured
            if (victimIndex >= 0) work[victimIndex] = victim
            if (safe) result.add(move)
        }
        return result
    }

    fun isLegal(move: ChessMove): Boolean = legalMoves().contains(move)

    /** Whether the move captures something, en passant included. */
    fun isCapture(move: ChessMove): Boolean = board[move.to.index] != 0 || isEnPassant(move)

    fun isEnPassant(move: ChessMove): Boolean =
        board[move.from.index] and 7 == 1 && move.to == enPassant && board[move.to.index] == 0 && move.from.file != move.to.file

    fun isCastling(move: ChessMove): Boolean =
        board[move.from.index] and 7 == 6 && abs(move.to.file - move.from.file) == 2

    /** The piece a move takes, if any (the pawn for en passant). */
    fun capturedPiece(move: ChessMove): ChessPiece? {
        get(move.to)?.let { return it }
        return if (isEnPassant(move)) ChessPiece(sideToMove.opposite, ChessPieceKind.PAWN) else null
    }

    /** Whether the move gives check or mate to the opponent. */
    fun givesCheck(move: ChessMove): Boolean = applying(move).isCheck

    // MARK: End of the game

    val hasLegalMove: Boolean get() = legalMoves().isNotEmpty()

    val isCheckmate: Boolean get() = isCheck && !hasLegalMove

    /** The side to move is not in check and has no legal move: a draw. */
    val isStalemate: Boolean get() = !isCheck && !hasLegalMove

    /** A draw can be claimed after 50 moves by each side without a capture or a pawn move (100 half moves). */
    val canClaimFiftyMoveDraw: Boolean get() = halfmoveClock >= 100

    /**
     * No series of legal moves can end in mate: bare kings, a king and one minor piece against a king, or only bishops
     * that all stand on squares of one color. (A knight against a knight can still be mated with help, so it is not
     * counted.)
     */
    val hasInsufficientMaterial: Boolean
        get() {
            var knights = 0
            var bishopsOnDark = 0
            var bishopsOnLight = 0
            for (index in 0 until 64) {
                when (board[index] and 7) {
                    0, 6 -> continue
                    2 -> knights += 1
                    3 -> if (ChessSquare(index).isDark) bishopsOnDark += 1 else bishopsOnLight += 1
                    else -> return false
                }
            }
            val bishops = bishopsOnDark + bishopsOnLight
            if (knights == 0) return bishopsOnDark == 0 || bishopsOnLight == 0
            return knights == 1 && bishops == 0
        }

    // MARK: Perft

    /** The number of move sequences of the given length: the engine's proof of correctness against known counts. */
    fun perft(depth: Int): Long {
        if (depth <= 0) return 1
        val moves = legalMoves()
        if (depth == 1) return moves.size.toLong()
        var total = 0L
        for (move in moves) total += applying(move).perft(depth - 1)
        return total
    }

    // MARK: Consistency

    /**
     * Reasons a position could not arise in a game or cannot be played on: empty when it is sound. Courses check
     * every authored position with it.
     */
    fun validationProblems(): List<String> {
        val problems = ArrayList<String>()
        for (color in ChessColor.entries) {
            val kings = count(ChessPiece(color, ChessPieceKind.KING))
            if (kings != 1) problems.add("${color.germanName} has $kings kings.")
            val pawns = count(ChessPiece(color, ChessPieceKind.PAWN))
            val total = squaresOf(color).size
            if (pawns > 8) problems.add("${color.germanName} has $pawns pawns.")
            if (total > 16) problems.add("${color.germanName} has $total pieces.")
            // Every piece beyond the starting set must come from a promoted pawn.
            val extras = listOf(ChessPieceKind.QUEEN to 1, ChessPieceKind.ROOK to 2, ChessPieceKind.BISHOP to 2, ChessPieceKind.KNIGHT to 2)
                .sumOf { (kind, allowed) -> maxOf(0, count(ChessPiece(color, kind)) - allowed) }
            if (extras > 8 - pawns) problems.add("${color.germanName} has more pieces than promotions allow.")
        }
        for (index in 0 until 64) {
            if (board[index] and 7 != 1) continue
            val rank = ChessSquare(index).rank
            if (rank == 0 || rank == 7) problems.add("A pawn stands on ${ChessSquare(index).name}.")
        }
        // The side that just moved cannot have left its own king in check.
        if (isInCheck(sideToMove.opposite)) {
            problems.add("${sideToMove.opposite.germanName} is in check but ${sideToMove.germanName} is to move.")
        }
        val rights = listOf(
            listOf(ChessCastlingRights.WHITE_KINGSIDE, ChessColor.WHITE, 7, "h1"),
            listOf(ChessCastlingRights.WHITE_QUEENSIDE, ChessColor.WHITE, 0, "a1"),
            listOf(ChessCastlingRights.BLACK_KINGSIDE, ChessColor.BLACK, 63, "h8"),
            listOf(ChessCastlingRights.BLACK_QUEENSIDE, ChessColor.BLACK, 56, "a8"),
        )
        for (entry in rights) {
            val right = entry[0] as ChessCastlingRights
            if (!castling.contains(right)) continue
            val color = entry[1] as ChessColor
            val rookIndex = entry[2] as Int
            val rookName = entry[3] as String
            val kingIndex = color.homeRank * 8 + 4
            if (board[kingIndex] != code(color, ChessPieceKind.KING)) {
                problems.add("${color.germanName} may castle but the king is not on its square.")
            }
            if (board[rookIndex] != code(color, ChessPieceKind.ROOK)) {
                problems.add("${color.germanName} may castle but there is no rook on $rookName.")
            }
        }
        val target = enPassant
        if (target != null) {
            val mover = sideToMove.opposite
            // After White's double step the target is on rank 3 and Black is to move, and the other way round.
            val expectedRank = if (mover == ChessColor.WHITE) 2 else 5
            if (target.rank != expectedRank) problems.add("The en passant square ${target.name} does not fit the side to move.")
            if (board[target.index] != 0) problems.add("The en passant square ${target.name} is occupied.")
            val pawnIndex = (target.rank + mover.pawnDirection) * 8 + target.file
            if (pawnIndex in 0..63 && board[pawnIndex] != code(mover, ChessPieceKind.PAWN)) {
                problems.add("There is no pawn that could have just moved to the square in front of ${target.name}.")
            }
            val originIndex = (target.rank - mover.pawnDirection) * 8 + target.file
            if (originIndex in 0..63 && board[originIndex] != 0) {
                problems.add("The pawn's start square for ${target.name} is not empty.")
            }
        }
        return problems
    }

    override fun equals(other: Any?): Boolean =
        other is ChessPosition && board.contentEquals(other.board) && sideToMove == other.sideToMove &&
            castling == other.castling && enPassant == other.enPassant && halfmoveClock == other.halfmoveClock &&
            fullmoveNumber == other.fullmoveNumber

    override fun hashCode(): Int {
        var h = board.contentHashCode()
        h = 31 * h + sideToMove.hashCode()
        h = 31 * h + castling.rawValue
        h = 31 * h + (enPassant?.index ?: -1)
        h = 31 * h + halfmoveClock
        h = 31 * h + fullmoveNumber
        return h
    }

    override fun toString(): String = fen

    companion object {
        const val START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

        private val VALUES = intArrayOf(0, 1, 3, 3, 5, 9, 0, 0)

        val start: ChessPosition by lazy { fromFen(START_FEN)!! }
        val empty: ChessPosition by lazy { fromFen("8/8/8/8/8/8/8/8 w - - 0 1")!! }

        fun code(color: ChessColor, kind: ChessPieceKind): Int = kind.rawValue + if (color == ChessColor.BLACK) 8 else 0
        fun kindCode(code: Int): Int = code and 7
        fun colorBit(color: ChessColor): Int = if (color == ChessColor.BLACK) 8 else 0

        fun pieceFromCode(code: Int): ChessPiece? {
            if (code == 0) return null
            val kind = ChessPieceKind.fromRawValue(code and 7) ?: return null
            return ChessPiece(if (code and 8 == 0) ChessColor.WHITE else ChessColor.BLACK, kind)
        }

        /**
         * Parses a FEN with six fields, or with the first four (the counters then start at 0 and 1). null if anything
         * is malformed: not eight ranks of eight squares, an unknown letter, a wrong side, castling or en passant field.
         */
        fun fromFen(fen: String): ChessPosition? {
            val fields = fen.split(' ').filter { it.isNotEmpty() }
            if (fields.size != 4 && fields.size != 6) return null
            val ranks = fields[0].split('/')
            if (ranks.size != 8) return null
            val board = IntArray(64)
            for ((rowIndex, row) in ranks.withIndex()) {
                val rank = 7 - rowIndex
                var file = 0
                for (character in row) {
                    if (character in '1'..'8') {
                        file += character - '0'
                    } else {
                        val piece = ChessPiece.fromFenCharacter(character)
                        if (piece == null || file >= 8) return null
                        board[rank * 8 + file] = code(piece.color, piece.kind)
                        file += 1
                    }
                    if (file > 8) return null
                }
                if (file != 8) return null
            }
            val side = when (fields[1]) {
                "w" -> ChessColor.WHITE
                "b" -> ChessColor.BLACK
                else -> return null
            }
            val rights = ChessCastlingRights.fromFen(fields[2]) ?: return null
            var passant: ChessSquare? = null
            if (fields[3] != "-") {
                val square = ChessSquare.fromName(fields[3])
                if (square == null || fields[3] != square.name || (square.rank != 2 && square.rank != 5)) return null
                passant = square
            }
            var halfmove = 0
            var fullmove = 1
            if (fields.size == 6) {
                val half = fields[4].toIntOrNull()
                val full = fields[5].toIntOrNull()
                if (half == null || half < 0 || full == null || full < 1) return null
                halfmove = half
                fullmove = full
            }
            return ChessPosition(board, side, rights, passant, halfmove, fullmove)
        }

        /** Whether a piece of `color` attacks the square on a raw board. */
        fun isAttacked(board: IntArray, square: Int, by: ChessColor): Boolean {
            val bit = colorBit(by)
            val file = square and 7
            val rank = square shr 3
            // Pawns: a white pawn attacks the squares one rank above it, so it stands one rank below the target.
            if (by == ChessColor.WHITE) {
                if (rank > 0) {
                    if (file > 0 && board[square - 9] == 1) return true
                    if (file < 7 && board[square - 7] == 1) return true
                }
            } else if (rank < 7) {
                if (file > 0 && board[square + 7] == 9) return true
                if (file < 7 && board[square + 9] == 9) return true
            }
            val knight = 2 + bit
            for (target in ChessTables.knightJumps[square]) if (board[target] == knight) return true
            val king = 6 + bit
            for (target in ChessTables.kingSteps[square]) if (board[target] == king) return true
            val rays = ChessTables.rays[square]
            for (direction in 0 until 8) {
                for (target in rays[direction]) {
                    val c = board[target]
                    if (c == 0) continue
                    if (c and 8 == bit) {
                        val kind = c and 7
                        if (kind == 5 || (if (direction < 4) kind == 4 else kind == 3)) return true
                    }
                    break
                }
            }
            return false
        }
    }
}
