// A complete chess position as FEN holds it, with attacks, move making, legal move generation and the end of the game.
// Port of ChessPosition.swift and ChessMoveGeneration.swift (one class here, since TypeScript has no extensions).
// Immutable: every move makes a new position. The board is a Uint8Array of 64 codes from a1: 0 empty, 1 to 6 White's
// pawn to king, 9 to 14 Black's.

import {
  ALL_SQUARES,
  BISHOP,
  CHESS_COLORS,
  KING,
  KING_STEPS,
  KNIGHT,
  KNIGHT_JUMPS,
  PAWN,
  QUEEN,
  RAYS,
  ROOK,
  castlingFen,
  castlingFromFen,
  colorGermanName,
  homeRank,
  isDarkSquare,
  kindValue,
  kingsideRight,
  movesEqual,
  moveFromUci,
  oppositeColor,
  pawnDirection,
  pawnStartRank,
  pieceFenCharacter,
  pieceFromFenCharacter,
  promotionRank,
  queensideRight,
  squareFile,
  squareName,
  squareFromName,
  squareOffset,
  squareRank,
  WHITE_KINGSIDE,
  WHITE_QUEENSIDE,
  BLACK_KINGSIDE,
  BLACK_QUEENSIDE,
  type ChessCastlingRights,
  type ChessColor,
  type ChessMove,
  type ChessPiece,
  type ChessPieceKind,
  type ChessSquare,
} from './types';

/** Piece code: kind 1...6, plus 8 for Black. */
export function pieceCode(color: ChessColor, kind: ChessPieceKind): number {
  return kind + (color === 'black' ? 8 : 0);
}
export function kindCode(code: number): number {
  return code & 7;
}
export function colorBit(color: ChessColor): number {
  return color === 'black' ? 8 : 0;
}
export function pieceFromCode(code: number): ChessPiece | null {
  if (code === 0) return null;
  const kind = code & 7;
  if (kind < 1 || kind > 6) return null;
  return { color: (code & 8) === 0 ? 'white' : 'black', kind: kind as ChessPieceKind };
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Swift `Int(String)`: optional sign and decimal digits only. */
function parseInteger(text: string): number | null {
  if (!/^[+-]?\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

export class ChessPosition {
  static readonly startFEN = START_FEN;

  readonly board: Uint8Array;
  readonly sideToMove: ChessColor;
  readonly castling: ChessCastlingRights;
  /** The square behind a pawn that has just advanced two squares, as FEN prints it. */
  readonly enPassant: ChessSquare | null;
  /** Half moves since the last capture or pawn move; a draw can be claimed at 100. */
  readonly halfmoveClock: number;
  readonly fullmoveNumber: number;

  constructor(
    board: Uint8Array,
    sideToMove: ChessColor,
    castling: ChessCastlingRights,
    enPassant: ChessSquare | null,
    halfmoveClock: number,
    fullmoveNumber: number,
  ) {
    this.board = board;
    this.sideToMove = sideToMove;
    this.castling = castling;
    this.enPassant = enPassant;
    this.halfmoveClock = halfmoveClock;
    this.fullmoveNumber = fullmoveNumber;
  }

  static get start(): ChessPosition {
    return ChessPosition.fromFen(START_FEN)!;
  }

  static get empty(): ChessPosition {
    return ChessPosition.fromFen('8/8/8/8/8/8/8/8 w - - 0 1')!;
  }

  // MARK: FEN

  /**
   * Parses a FEN with six fields, or with the first four (the counters then start at 0 and 1). null if anything is
   * malformed: not eight ranks of eight squares, an unknown letter, a wrong side, castling or en passant field.
   */
  static fromFen(fen: string): ChessPosition | null {
    const fields = fen.split(' ').filter((field) => field.length > 0);
    if (fields.length !== 4 && fields.length !== 6) return null;
    const ranks = fields[0].split('/');
    if (ranks.length !== 8) return null;
    const board = new Uint8Array(64);
    for (let rowIndex = 0; rowIndex < 8; rowIndex++) {
      const rank = 7 - rowIndex;
      let file = 0;
      for (const character of ranks[rowIndex]) {
        const digit = /^[0-9]$/.test(character) ? Number(character) : null;
        const p = digit === null ? pieceFromFenCharacter(character) : null;
        if (digit !== null && digit >= 1 && digit <= 8) {
          file += digit;
        } else if (p !== null && file < 8) {
          board[rank * 8 + file] = pieceCode(p.color, p.kind);
          file += 1;
        } else {
          return null;
        }
        if (file > 8) return null;
      }
      if (file !== 8) return null;
    }
    let side: ChessColor;
    switch (fields[1]) {
      case 'w': side = 'white'; break;
      case 'b': side = 'black'; break;
      default: return null;
    }
    const rights = castlingFromFen(fields[2]);
    if (rights === null) return null;
    let passant: ChessSquare | null = null;
    if (fields[3] !== '-') {
      const target = squareFromName(fields[3]);
      if (target === null || fields[3] !== squareName(target)) return null;
      const rank = squareRank(target);
      if (rank !== 2 && rank !== 5) return null;
      passant = target;
    }
    let halfmove = 0;
    let fullmove = 1;
    if (fields.length === 6) {
      const half = parseInteger(fields[4]);
      const full = parseInteger(fields[5]);
      if (half === null || half < 0 || full === null || full < 1) return null;
      halfmove = half;
      fullmove = full;
    }
    return new ChessPosition(board, side, rights, passant, halfmove, fullmove);
  }

  /** The six FEN fields. */
  get fen(): string {
    const rows: string[] = [];
    for (let rank = 7; rank >= 0; rank--) {
      let row = '';
      let gap = 0;
      for (let file = 0; file < 8; file++) {
        const p = pieceFromCode(this.board[rank * 8 + file]);
        if (p) {
          if (gap > 0) {
            row += String(gap);
            gap = 0;
          }
          row += pieceFenCharacter(p);
        } else {
          gap += 1;
        }
      }
      if (gap > 0) row += String(gap);
      rows.push(row);
    }
    const side = this.sideToMove === 'white' ? 'w' : 'b';
    const passant = this.enPassant === null ? '-' : squareName(this.enPassant);
    return `${rows.join('/')} ${side} ${castlingFen(this.castling)} ${passant} ${this.halfmoveClock} ${this.fullmoveNumber}`;
  }

  /** The board as eight text lines, rank 8 first; for tests and debugging. */
  get diagram(): string {
    const lines: string[] = [];
    for (let row = 0; row < 8; row++) {
      const rank = 7 - row;
      let line = '';
      for (let file = 0; file < 8; file++) {
        const p = pieceFromCode(this.board[rank * 8 + file]);
        line += p ? pieceFenCharacter(p) : '.';
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  equals(other: ChessPosition): boolean {
    return this.fen === other.fen;
  }

  // MARK: Reading the board

  pieceAt(sq: ChessSquare): ChessPiece | null {
    return pieceFromCode(this.board[sq]);
  }

  /** Every piece with its square, from a1 up. */
  get pieces(): { square: ChessSquare; piece: ChessPiece }[] {
    const result: { square: ChessSquare; piece: ChessPiece }[] = [];
    for (let index = 0; index < 64; index++) {
      const p = pieceFromCode(this.board[index]);
      if (p) result.push({ square: index, piece: p });
    }
    return result;
  }

  squaresOfPiece(p: ChessPiece): ChessSquare[] {
    const wanted = pieceCode(p.color, p.kind);
    return ALL_SQUARES.filter((index) => this.board[index] === wanted);
  }

  squaresOfColor(color: ChessColor): ChessSquare[] {
    const bit = colorBit(color);
    return ALL_SQUARES.filter((index) => this.board[index] !== 0 && (this.board[index] & 8) === bit);
  }

  kingSquare(color: ChessColor): ChessSquare | null {
    const index = this.board.indexOf(pieceCode(color, KING));
    return index < 0 ? null : index;
  }

  /** The total value of a side's pieces with 1, 3, 3, 5, 9 and nothing for the king. */
  material(color: ChessColor): number {
    const bit = colorBit(color);
    let total = 0;
    for (const code of this.board) {
      if (code !== 0 && (code & 8) === bit) total += kindValue((code & 7) as ChessPieceKind);
    }
    return total;
  }

  /** Material of the side to move minus the other side's. */
  get materialBalanceForSideToMove(): number {
    return this.material(this.sideToMove) - this.material(oppositeColor(this.sideToMove));
  }

  count(p: ChessPiece): number {
    const wanted = pieceCode(p.color, p.kind);
    let total = 0;
    for (const code of this.board) if (code === wanted) total += 1;
    return total;
  }

  // MARK: Changing the board

  /** The position with a piece put on a square or taken off it; the counters and rights stay as they are. */
  setting(p: ChessPiece | null, sq: ChessSquare): ChessPosition {
    const board = this.board.slice();
    board[sq] = p ? pieceCode(p.color, p.kind) : 0;
    return new ChessPosition(board, this.sideToMove, this.castling, this.enPassant, this.halfmoveClock, this.fullmoveNumber);
  }

  withSideToMove(side: ChessColor): ChessPosition {
    return new ChessPosition(this.board, side, this.castling, this.enPassant, this.halfmoveClock, this.fullmoveNumber);
  }

  // MARK: Attacks

  /** Whether a piece of `color` attacks the square (a pawn attacks diagonally forward; a pinned piece still attacks). */
  isAttacked(sq: ChessSquare, by: ChessColor): boolean {
    return ChessPosition.isAttackedOn(this.board, sq, by);
  }

  static isAttackedOn(board: Uint8Array, sq: number, by: ChessColor): boolean {
    const bit = colorBit(by);
    const file = sq & 7;
    const rank = sq >> 3;
    // A white pawn attacks the squares one rank above it, so it stands one rank below the target.
    if (by === 'white') {
      if (rank > 0) {
        if (file > 0 && board[sq - 9] === 1) return true;
        if (file < 7 && board[sq - 7] === 1) return true;
      }
    } else if (rank < 7) {
      if (file > 0 && board[sq + 7] === 9) return true;
      if (file < 7 && board[sq + 9] === 9) return true;
    }
    const knight = 2 + bit;
    for (const target of KNIGHT_JUMPS[sq]) if (board[target] === knight) return true;
    const king = 6 + bit;
    for (const target of KING_STEPS[sq]) if (board[target] === king) return true;
    const rays = RAYS[sq];
    for (let direction = 0; direction < 8; direction++) {
      for (const target of rays[direction]) {
        const code = board[target];
        if (code === 0) continue;
        if ((code & 8) === bit) {
          const kind = code & 7;
          if (kind === 5 || (direction < 4 ? kind === 4 : kind === 3)) return true;
        }
        break;
      }
    }
    return false;
  }

  /** The squares of every piece of `color` that attacks the square, from a1 up. */
  attackers(sq: ChessSquare, by: ChessColor): ChessSquare[] {
    const board = this.board;
    const bit = colorBit(by);
    const result: number[] = [];
    const file = sq & 7;
    const rank = sq >> 3;
    if (by === 'white') {
      if (rank > 0) {
        if (file > 0 && board[sq - 9] === 1) result.push(sq - 9);
        if (file < 7 && board[sq - 7] === 1) result.push(sq - 7);
      }
    } else if (rank < 7) {
      if (file > 0 && board[sq + 7] === 9) result.push(sq + 7);
      if (file < 7 && board[sq + 9] === 9) result.push(sq + 9);
    }
    for (const from of KNIGHT_JUMPS[sq]) if (board[from] === 2 + bit) result.push(from);
    for (const from of KING_STEPS[sq]) if (board[from] === 6 + bit) result.push(from);
    for (let direction = 0; direction < 8; direction++) {
      for (const from of RAYS[sq][direction]) {
        const code = board[from];
        if (code === 0) continue;
        if ((code & 8) === bit) {
          const kind = code & 7;
          if (kind === 5 || (direction < 4 ? kind === 4 : kind === 3)) result.push(from);
        }
        break;
      }
    }
    return result.sort((a, b) => a - b);
  }

  /** Whether the side to move is in check. */
  get isCheck(): boolean {
    const king = this.kingSquare(this.sideToMove);
    return king === null ? false : this.isAttacked(king, oppositeColor(this.sideToMove));
  }

  /** Whether `color`'s king is attacked, whoever is to move. */
  isInCheck(color: ChessColor): boolean {
    const king = this.kingSquare(color);
    return king === null ? false : this.isAttacked(king, oppositeColor(color));
  }

  // MARK: Making a move

  /**
   * The position after a move. The move has to be legal in this position; nothing is checked here. A pawn that
   * reaches the last rank without a piece named becomes a queen.
   */
  applying(m: ChessMove): ChessPosition {
    const board = this.board.slice();
    const from = m.from;
    const to = m.to;
    const moving = board[from];
    const target = board[to];
    const kind = moving & 7;
    const color: ChessColor = (moving & 8) === 0 ? 'white' : 'black';
    let isCapture = target !== 0;
    board[from] = 0;
    if (kind === PAWN) {
      if (m.to === this.enPassant && target === 0 && squareFile(m.from) !== squareFile(m.to)) {
        board[squareRank(m.from) * 8 + squareFile(m.to)] = 0;
        isCapture = true;
      }
      if (squareRank(m.to) === promotionRank(color)) {
        board[to] = pieceCode(color, m.promotion ?? QUEEN);
      } else {
        board[to] = moving;
      }
    } else {
      board[to] = moving;
      if (kind === KING && Math.abs(squareFile(m.to) - squareFile(m.from)) === 2) {
        const rank = squareRank(m.from);
        if (squareFile(m.to) === 6) {
          board[rank * 8 + 7] = 0;
          board[rank * 8 + 5] = pieceCode(color, ROOK);
        } else {
          board[rank * 8] = 0;
          board[rank * 8 + 3] = pieceCode(color, ROOK);
        }
      }
    }
    // Castling rights go when the king or a rook leaves its square, or a rook is captured on its square.
    let castling = this.castling;
    for (const sq of [from, to]) {
      switch (sq) {
        case 4: castling &= ~(WHITE_KINGSIDE | WHITE_QUEENSIDE); break;
        case 0: castling &= ~WHITE_QUEENSIDE; break;
        case 7: castling &= ~WHITE_KINGSIDE; break;
        case 60: castling &= ~(BLACK_KINGSIDE | BLACK_QUEENSIDE); break;
        case 56: castling &= ~BLACK_QUEENSIDE; break;
        case 63: castling &= ~BLACK_KINGSIDE; break;
        default: break;
      }
    }
    const enPassant =
      kind === PAWN && Math.abs(squareRank(m.to) - squareRank(m.from)) === 2 ? (from + to) / 2 : null;
    const halfmove = kind === PAWN || isCapture ? 0 : this.halfmoveClock + 1;
    const fullmove = color === 'black' ? this.fullmoveNumber + 1 : this.fullmoveNumber;
    return new ChessPosition(board, oppositeColor(color), castling, enPassant, halfmove, fullmove);
  }

  /** The position after a legal move in coordinate notation like "e2e4" or "e7e8q"; null when it is not legal. */
  playing(uci: string): ChessPosition | null {
    const m = moveFromUci(uci);
    if (m === null || !this.isLegal(m)) return null;
    return this.applying(m);
  }

  /** The position after the moves, in coordinate notation, in order; null when one is not legal. */
  playingLine(line: readonly string[]): ChessPosition | null {
    let position: ChessPosition = this;
    for (const uci of line) {
      const next = position.playing(uci);
      if (next === null) return null;
      position = next;
    }
    return position;
  }

  // MARK: Pseudo-legal moves

  /**
   * Every move the pieces can make by their own rules, castling included, whether or not it leaves the own king in
   * check. `legalMoves()` filters those.
   */
  pseudoLegalMoves(): ChessMove[] {
    const moves: ChessMove[] = [];
    const board = this.board;
    const side = this.sideToMove;
    const bit = colorBit(side);
    for (let from = 0; from < 64; from++) {
      const code = board[from];
      if (code === 0 || (code & 8) !== bit) continue;
      switch (code & 7) {
        case 1:
          this.addPawnMoves(from, side, moves);
          break;
        case 2:
          for (const target of KNIGHT_JUMPS[from]) {
            if (board[target] === 0 || (board[target] & 8) !== bit) moves.push({ from, to: target });
          }
          break;
        case 3: this.addSlidingMoves(from, 4, 8, bit, moves); break;
        case 4: this.addSlidingMoves(from, 0, 4, bit, moves); break;
        case 5: this.addSlidingMoves(from, 0, 8, bit, moves); break;
        default:
          for (const target of KING_STEPS[from]) {
            if (board[target] === 0 || (board[target] & 8) !== bit) moves.push({ from, to: target });
          }
          this.addCastlingMoves(side, moves);
      }
    }
    return moves;
  }

  private addSlidingMoves(from: number, first: number, end: number, bit: number, moves: ChessMove[]): void {
    const rays = RAYS[from];
    const board = this.board;
    for (let direction = first; direction < end; direction++) {
      for (const target of rays[direction]) {
        const code = board[target];
        if (code === 0) {
          moves.push({ from, to: target });
          continue;
        }
        if ((code & 8) !== bit) moves.push({ from, to: target });
        break;
      }
    }
  }

  private addPawnMoves(from: number, side: ChessColor, moves: ChessMove[]): void {
    const board = this.board;
    const step = pawnDirection(side);
    const promotes = squareRank(from) + step === promotionRank(side);
    const add = (target: number): void => {
      if (promotes) {
        for (const kind of [QUEEN, ROOK, BISHOP, KNIGHT] as const) moves.push({ from, to: target, promotion: kind });
      } else {
        moves.push({ from, to: target });
      }
    };
    const ahead = squareOffset(from, 0, step);
    if (ahead !== null && board[ahead] === 0) {
      add(ahead);
      if (squareRank(from) === pawnStartRank(side)) {
        const twice = squareOffset(from, 0, 2 * step);
        if (twice !== null && board[twice] === 0) moves.push({ from, to: twice });
      }
    }
    for (const df of [-1, 1]) {
      const target = squareOffset(from, df, step);
      if (target === null) continue;
      const code = board[target];
      if (code !== 0) {
        if ((code & 8) !== colorBit(side)) add(target);
      } else if (target === this.enPassant) {
        // The captured pawn stands beside the capturing one, on the square the double step ended on.
        const victim = board[squareRank(from) * 8 + squareFile(target)];
        if (victim === pieceCode(oppositeColor(side), PAWN)) moves.push({ from, to: target });
      }
    }
  }

  /**
   * Castling needs the right, king and rook at home, nothing between them, and the king neither in check nor
   * crossing or landing on an attacked square. The rook may be attacked, and the rook's own path may be.
   */
  private addCastlingMoves(side: ChessColor, moves: ChessMove[]): void {
    const board = this.board;
    const base = homeRank(side) * 8;
    const king = pieceCode(side, KING);
    const rook = pieceCode(side, ROOK);
    if (board[base + 4] !== king) return;
    const enemy = oppositeColor(side);
    const kingside =
      (this.castling & kingsideRight(side)) !== 0 && board[base + 7] === rook && board[base + 5] === 0 && board[base + 6] === 0;
    const queenside =
      (this.castling & queensideRight(side)) !== 0 &&
      board[base] === rook && board[base + 1] === 0 && board[base + 2] === 0 && board[base + 3] === 0;
    if (!(kingside || queenside) || ChessPosition.isAttackedOn(board, base + 4, enemy)) return;
    if (kingside && !ChessPosition.isAttackedOn(board, base + 5, enemy) && !ChessPosition.isAttackedOn(board, base + 6, enemy)) {
      moves.push({ from: base + 4, to: base + 6 });
    }
    if (queenside && !ChessPosition.isAttackedOn(board, base + 3, enemy) && !ChessPosition.isAttackedOn(board, base + 2, enemy)) {
      moves.push({ from: base + 4, to: base + 2 });
    }
  }

  // MARK: Legal moves

  /** The moves that do not leave the mover's own king in check. */
  legalMoves(): ChessMove[] {
    const side = this.sideToMove;
    const kingStart = this.kingSquare(side);
    if (kingStart === null) return [];
    let king = kingStart;
    const enemy = oppositeColor(side);
    const work = this.board.slice();
    const result: ChessMove[] = [];
    for (const m of this.pseudoLegalMoves()) {
      const from = m.from;
      const to = m.to;
      const moving = work[from];
      const captured = work[to];
      let victimIndex = -1;
      let victim = 0;
      if ((moving & 7) === 1 && captured === 0 && squareFile(from) !== squareFile(to)) {
        victimIndex = squareRank(from) * 8 + squareFile(to);
        victim = work[victimIndex];
        work[victimIndex] = 0;
      }
      work[to] = moving;
      work[from] = 0;
      const isKingMove = (moving & 7) === 6;
      if (isKingMove) king = to;
      const safe = !ChessPosition.isAttackedOn(work, king, enemy);
      if (isKingMove) king = from;
      work[from] = moving;
      work[to] = captured;
      if (victimIndex >= 0) work[victimIndex] = victim;
      if (safe) result.push(m);
    }
    return result;
  }

  isLegal(m: ChessMove): boolean {
    return this.legalMoves().some((legal) => movesEqual(legal, m));
  }

  /** Whether the move captures something, en passant included. */
  isCapture(m: ChessMove): boolean {
    if (this.board[m.to] !== 0) return true;
    return this.isEnPassant(m);
  }

  isEnPassant(m: ChessMove): boolean {
    return (
      (this.board[m.from] & 7) === 1 && m.to === this.enPassant && this.board[m.to] === 0 &&
      squareFile(m.from) !== squareFile(m.to)
    );
  }

  isCastling(m: ChessMove): boolean {
    return (this.board[m.from] & 7) === 6 && Math.abs(squareFile(m.to) - squareFile(m.from)) === 2;
  }

  /** The piece a move takes, if any (the pawn for en passant). */
  capturedPiece(m: ChessMove): ChessPiece | null {
    const there = this.pieceAt(m.to);
    if (there) return there;
    return this.isEnPassant(m) ? { color: oppositeColor(this.sideToMove), kind: PAWN } : null;
  }

  /** Whether the move gives check or mate to the opponent. */
  givesCheck(m: ChessMove): boolean {
    return this.applying(m).isCheck;
  }

  // MARK: End of the game

  get hasLegalMove(): boolean {
    return this.legalMoves().length > 0;
  }

  get isCheckmate(): boolean {
    return this.isCheck && !this.hasLegalMove;
  }

  /** The side to move is not in check and has no legal move: a draw. */
  get isStalemate(): boolean {
    return !this.isCheck && !this.hasLegalMove;
  }

  /** A draw can be claimed after 50 moves by each side without a capture or a pawn move (100 half moves). */
  get canClaimFiftyMoveDraw(): boolean {
    return this.halfmoveClock >= 100;
  }

  /**
   * No series of legal moves can end in mate: bare kings, a king and one minor piece against a king, or only bishops
   * that all stand on squares of one color. (A knight against a knight can still be mated with help, so it is not
   * counted.)
   */
  get hasInsufficientMaterial(): boolean {
    let knights = 0;
    let bishopsOnDark = 0;
    let bishopsOnLight = 0;
    for (let index = 0; index < 64; index++) {
      const kind = this.board[index] & 7;
      switch (kind) {
        case 0:
        case 6: continue;
        case 2: knights += 1; break;
        case 3:
          if (isDarkSquare(index)) bishopsOnDark += 1;
          else bishopsOnLight += 1;
          break;
        default: return false;
      }
    }
    const bishops = bishopsOnDark + bishopsOnLight;
    if (knights === 0) return bishopsOnDark === 0 || bishopsOnLight === 0;
    return knights === 1 && bishops === 0;
  }

  // MARK: Perft

  /** The number of move sequences of the given length: the engine's proof of correctness against known counts. */
  perft(depth: number): number {
    if (depth <= 0) return 1;
    const moves = this.legalMoves();
    if (depth === 1) return moves.length;
    let total = 0;
    for (const m of moves) total += this.applying(m).perft(depth - 1);
    return total;
  }

  // MARK: Consistency

  /**
   * Reasons a position could not arise in a game or cannot be played on: empty when it is sound. Courses check every
   * authored position with it.
   */
  validationProblems(): string[] {
    const problems: string[] = [];
    for (const color of CHESS_COLORS) {
      const kings = this.count({ color, kind: KING });
      if (kings !== 1) problems.push(`${colorGermanName(color)} has ${kings} kings.`);
      const pawns = this.count({ color, kind: PAWN });
      const total = this.squaresOfColor(color).length;
      if (pawns > 8) problems.push(`${colorGermanName(color)} has ${pawns} pawns.`);
      if (total > 16) problems.push(`${colorGermanName(color)} has ${total} pieces.`);
      // Every piece beyond the starting set must come from a promoted pawn.
      const extras = ([[QUEEN, 1], [ROOK, 2], [BISHOP, 2], [KNIGHT, 2]] as const).reduce(
        (sum, [kind, allowed]) => sum + Math.max(0, this.count({ color, kind }) - allowed),
        0,
      );
      if (extras > 8 - pawns) problems.push(`${colorGermanName(color)} has more pieces than promotions allow.`);
    }
    for (let index = 0; index < 64; index++) {
      if ((this.board[index] & 7) !== 1) continue;
      const rank = squareRank(index);
      if (rank === 0 || rank === 7) problems.push(`A pawn stands on ${squareName(index)}.`);
    }
    // The side that just moved cannot have left its own king in check.
    const other = oppositeColor(this.sideToMove);
    if (this.isInCheck(other)) {
      problems.push(`${colorGermanName(other)} is in check but ${colorGermanName(this.sideToMove)} is to move.`);
    }
    const rights: [number, ChessColor, number, string][] = [
      [WHITE_KINGSIDE, 'white', 7, 'h1'], [WHITE_QUEENSIDE, 'white', 0, 'a1'],
      [BLACK_KINGSIDE, 'black', 63, 'h8'], [BLACK_QUEENSIDE, 'black', 56, 'a8'],
    ];
    for (const [right, color, rookIndex, rookName] of rights) {
      if ((this.castling & right) === 0) continue;
      const kingIndex = homeRank(color) * 8 + 4;
      if (this.board[kingIndex] !== pieceCode(color, KING)) {
        problems.push(`${colorGermanName(color)} may castle but the king is not on its square.`);
      }
      if (this.board[rookIndex] !== pieceCode(color, ROOK)) {
        problems.push(`${colorGermanName(color)} may castle but there is no rook on ${rookName}.`);
      }
    }
    if (this.enPassant !== null) {
      const target = this.enPassant;
      const mover = oppositeColor(this.sideToMove);
      // After White's double step the target is on rank 3 and Black is to move, and the other way round.
      const expectedRank = mover === 'white' ? 2 : 5;
      const name = squareName(target);
      if (squareRank(target) !== expectedRank) problems.push(`The en passant square ${name} does not fit the side to move.`);
      if (this.board[target] !== 0) problems.push(`The en passant square ${name} is occupied.`);
      const pawnIndex = (squareRank(target) + pawnDirection(mover)) * 8 + squareFile(target);
      if (pawnIndex >= 0 && pawnIndex < 64 && this.board[pawnIndex] !== pieceCode(mover, PAWN)) {
        problems.push(`There is no pawn that could have just moved to the square in front of ${name}.`);
      }
      const originIndex = (squareRank(target) - pawnDirection(mover)) * 8 + squareFile(target);
      if (originIndex >= 0 && originIndex < 64 && this.board[originIndex] !== 0) {
        problems.push(`The pawn's start square for ${name} is not empty.`);
      }
    }
    return problems;
  }
}
