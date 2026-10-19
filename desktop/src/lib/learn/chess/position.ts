import {
  ChessColor, ChessMove, ChessPiece, ChessTables, PieceKind, Rights, Square, Sq, colorName, containsMove, homeRank, kindFromRaw, kindRaw, kindValue, moveFromUci,
  move as makeMove, opposite, pawnDirection, pawnStartRank, pieceFenCharacter, pieceFromFen, piece as makePiece, promotionRank,
} from './types';

const pieceCode = (color: ChessColor, kind: PieceKind): number => kindRaw(kind) + (color === 'black' ? 8 : 0);
const kindCode = (code: number): number => code & 7;
const colorBit = (color: ChessColor): number => (color === 'black' ? 8 : 0);

export function pieceFromCode(code: number): ChessPiece | null {
  const kind = code === 0 ? null : kindFromRaw(code & 7);
  return kind ? makePiece((code & 8) === 0 ? 'white' : 'black', kind) : null;
}

export const startFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** A complete chess position as FEN holds it: the board, the side to move, the castling rights, the en passant square and the two move counters. Every move makes a new position. */
export class ChessPosition {
  /** 64 squares from a1, one piece code each: 0 empty, 1 to 6 White's pawn to king, 9 to 14 Black's. */
  readonly board: Uint8Array;
  sideToMove: ChessColor;
  castling: number;
  /** The square behind a pawn that has just advanced two squares, as FEN prints it. */
  enPassant: Square | null;
  /** Half moves since the last capture or pawn move; a draw can be claimed at 100. */
  halfmoveClock: number;
  fullmoveNumber: number;

  private constructor(board: Uint8Array, sideToMove: ChessColor, castling: number, enPassant: Square | null, halfmoveClock: number, fullmoveNumber: number) {
    this.board = board;
    this.sideToMove = sideToMove;
    this.castling = castling;
    this.enPassant = enPassant;
    this.halfmoveClock = halfmoveClock;
    this.fullmoveNumber = fullmoveNumber;
  }

  private copy(): ChessPosition {
    return new ChessPosition(new Uint8Array(this.board), this.sideToMove, this.castling, this.enPassant, this.halfmoveClock, this.fullmoveNumber);
  }

  /** Parses a FEN with six fields, or with the first four (the counters then start at 0 and 1). null if anything is malformed. */
  static fromFEN(fen: string): ChessPosition | null {
    const fields = fen.split(' ').filter((f) => f !== '');
    if (fields.length !== 4 && fields.length !== 6) return null;
    const ranks = fields[0].split('/');
    if (ranks.length !== 8) return null;
    const board = new Uint8Array(64);
    for (let rowIndex = 0; rowIndex < ranks.length; rowIndex++) {
      const rank = 7 - rowIndex;
      let file = 0;
      for (const character of ranks[rowIndex]) {
        const digit = Number(character);
        if (/^[1-8]$/.test(character) && digit >= 1 && digit <= 8) file += digit;
        else {
          const p = pieceFromFen(character);
          if (!p || file >= 8) return null;
          board[rank * 8 + file] = pieceCode(p.color, p.kind);
          file += 1;
        }
        if (file > 8) return null;
      }
      if (file !== 8) return null;
    }
    let side: ChessColor;
    if (fields[1] === 'w') side = 'white';
    else if (fields[1] === 'b') side = 'black';
    else return null;
    const rights = Rights.parse(fields[2]);
    if (rights === null) return null;
    let passant: Square | null = null;
    if (fields[3] !== '-') {
      const square = Sq.of(fields[3]);
      if (square === null || fields[3] !== Sq.name(square) || (Sq.rank(square) !== 2 && Sq.rank(square) !== 5)) return null;
      passant = square;
    }
    let halfmove = 0;
    let fullmove = 1;
    if (fields.length === 6) {
      if (!/^\d+$/.test(fields[4]) || !/^\d+$/.test(fields[5])) return null;
      halfmove = Number(fields[4]);
      fullmove = Number(fields[5]);
      if (fullmove < 1) return null;
    }
    return new ChessPosition(board, side, rights, passant, halfmove, fullmove);
  }

  static get start(): ChessPosition { return ChessPosition.fromFEN(startFEN) as ChessPosition; }
  static get empty(): ChessPosition { return ChessPosition.fromFEN('8/8/8/8/8/8/8/8 w - - 0 1') as ChessPosition; }

  // Reading the board

  at(square: Square): ChessPiece | null { return pieceFromCode(this.board[square]); }

  /** Every piece with its square, from a1 up. */
  get pieces(): Array<{ square: Square; piece: ChessPiece }> {
    const result: Array<{ square: Square; piece: ChessPiece }> = [];
    for (let index = 0; index < 64; index++) {
      const p = pieceFromCode(this.board[index]);
      if (p) result.push({ square: index, piece: p });
    }
    return result;
  }

  /** The squares of one kind of piece. */
  squaresOf(p: ChessPiece): Square[] {
    const wanted = pieceCode(p.color, p.kind);
    return Sq.all.filter((i) => this.board[i] === wanted);
  }

  /** The squares of all pieces of a color. */
  squaresOfColor(color: ChessColor): Square[] {
    const bit = colorBit(color);
    return Sq.all.filter((i) => this.board[i] !== 0 && (this.board[i] & 8) === bit);
  }

  kingSquare(color: ChessColor): Square | null {
    const wanted = pieceCode(color, 'king');
    const index = this.board.indexOf(wanted);
    return index < 0 ? null : index;
  }

  /** The total value of a side's pieces with 1, 3, 3, 5, 9 and nothing for the king. */
  material(color: ChessColor): number {
    const bit = colorBit(color);
    let total = 0;
    for (const code of this.board) if (code !== 0 && (code & 8) === bit) total += kindValue(kindFromRaw(code & 7) as PieceKind);
    return total;
  }

  /** Material of the side to move minus the other side's. */
  get materialBalanceForSideToMove(): number { return this.material(this.sideToMove) - this.material(opposite(this.sideToMove)); }

  count(p: ChessPiece): number {
    const wanted = pieceCode(p.color, p.kind);
    let n = 0;
    for (const code of this.board) if (code === wanted) n += 1;
    return n;
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
          if (gap > 0) { row += String(gap); gap = 0; }
          row += pieceFenCharacter(p);
        } else gap += 1;
      }
      if (gap > 0) row += String(gap);
      rows.push(row);
    }
    const side = this.sideToMove === 'white' ? 'w' : 'b';
    return `${rows.join('/')} ${side} ${Rights.fen(this.castling)} ${this.enPassant === null ? '-' : Sq.name(this.enPassant)} ${this.halfmoveClock} ${this.fullmoveNumber}`;
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

  // Changing the board

  /** The position with a piece put on a square or taken off it; the counters and rights stay as they are. */
  setting(p: ChessPiece | null, square: Square): ChessPosition {
    const copy = this.copy();
    copy.board[square] = p ? pieceCode(p.color, p.kind) : 0;
    return copy;
  }

  withSideToMove(side: ChessColor): ChessPosition {
    const copy = this.copy();
    copy.sideToMove = side;
    return copy;
  }

  // Attacks

  /** Whether a piece of `color` attacks the square (a pawn attacks diagonally forward; a pinned piece still attacks). */
  isAttacked(square: Square, by: ChessColor): boolean { return ChessPosition.isAttackedOn(this.board, square, by); }

  static isAttackedOn(board: Uint8Array, square: number, by: ChessColor): boolean {
    const bit = colorBit(by);
    const file = square & 7;
    const rank = square >> 3;
    // Pawns: a white pawn attacks the squares one rank above it, so it stands one rank below the target.
    if (by === 'white') {
      if (rank > 0) {
        if (file > 0 && board[square - 9] === 1) return true;
        if (file < 7 && board[square - 7] === 1) return true;
      }
    } else if (rank < 7) {
      if (file > 0 && board[square + 7] === 9) return true;
      if (file < 7 && board[square + 9] === 9) return true;
    }
    const knight = 2 + bit;
    for (const target of ChessTables.knightJumps[square]) if (board[target] === knight) return true;
    const king = 6 + bit;
    for (const target of ChessTables.kingSteps[square]) if (board[target] === king) return true;
    const rays = ChessTables.rays[square];
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
  attackers(square: Square, by: ChessColor): Square[] {
    const board = this.board;
    const target = square;
    const bit = colorBit(by);
    const result: number[] = [];
    const file = target & 7;
    const rank = target >> 3;
    if (by === 'white') {
      if (rank > 0) {
        if (file > 0 && board[target - 9] === 1) result.push(target - 9);
        if (file < 7 && board[target - 7] === 1) result.push(target - 7);
      }
    } else if (rank < 7) {
      if (file > 0 && board[target + 7] === 9) result.push(target + 7);
      if (file < 7 && board[target + 9] === 9) result.push(target + 9);
    }
    for (const from of ChessTables.knightJumps[target]) if (board[from] === 2 + bit) result.push(from);
    for (const from of ChessTables.kingSteps[target]) if (board[from] === 6 + bit) result.push(from);
    for (let direction = 0; direction < 8; direction++) {
      for (const from of ChessTables.rays[target][direction]) {
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
    return king !== null && this.isAttacked(king, opposite(this.sideToMove));
  }

  /** Whether `color`'s king is attacked, whoever is to move. */
  isInCheck(color: ChessColor): boolean {
    const king = this.kingSquare(color);
    return king !== null && this.isAttacked(king, opposite(color));
  }

  // Making a move

  /** The position after a move. The move has to be legal in this position; nothing is checked here. A pawn that reaches the last rank without a piece named becomes a queen. */
  applying(m: ChessMove): ChessPosition {
    const next = this.copy();
    const from = m.from;
    const to = m.to;
    const moving = this.board[from];
    const target = this.board[to];
    const kind = kindCode(moving);
    const color: ChessColor = (moving & 8) === 0 ? 'white' : 'black';
    let isCapture = target !== 0;
    next.board[from] = 0;
    if (kind === 1) {
      if (m.to === this.enPassant && target === 0 && Sq.file(m.from) !== Sq.file(m.to)) {
        next.board[Sq.rank(m.from) * 8 + Sq.file(m.to)] = 0;
        isCapture = true;
      }
      next.board[to] = Sq.rank(m.to) === promotionRank(color) ? pieceCode(color, m.promotion ?? 'queen') : moving;
    } else {
      next.board[to] = moving;
      if (kind === 6 && Math.abs(Sq.file(m.to) - Sq.file(m.from)) === 2) {
        const rank = Sq.rank(m.from);
        if (Sq.file(m.to) === 6) {
          next.board[rank * 8 + 7] = 0;
          next.board[rank * 8 + 5] = pieceCode(color, 'rook');
        } else {
          next.board[rank * 8] = 0;
          next.board[rank * 8 + 3] = pieceCode(color, 'rook');
        }
      }
    }
    // Castling rights go when the king or a rook leaves its square, or a rook is captured on its square.
    for (const square of [from, to]) {
      switch (square) {
        case 4: next.castling &= ~(Rights.whiteKingside | Rights.whiteQueenside); break;
        case 0: next.castling &= ~Rights.whiteQueenside; break;
        case 7: next.castling &= ~Rights.whiteKingside; break;
        case 60: next.castling &= ~(Rights.blackKingside | Rights.blackQueenside); break;
        case 56: next.castling &= ~Rights.blackQueenside; break;
        case 63: next.castling &= ~Rights.blackKingside; break;
        default: break;
      }
    }
    next.enPassant = kind === 1 && Math.abs(Sq.rank(m.to) - Sq.rank(m.from)) === 2 ? (from + to) / 2 : null;
    next.halfmoveClock = kind === 1 || isCapture ? 0 : this.halfmoveClock + 1;
    if (color === 'black') next.fullmoveNumber += 1;
    next.sideToMove = opposite(color);
    return next;
  }

  /** The position after a legal move in coordinate notation like "e2e4" or "e7e8q"; null when it is not legal. */
  playing(uci: string): ChessPosition | null {
    const m = moveFromUci(uci);
    if (!m || !containsMove(this.legalMoves(), m)) return null;
    return this.applying(m);
  }

  /** The position after the moves, in coordinate notation, in order; null when one is not legal. */
  playingLine(line: string[]): ChessPosition | null {
    let position: ChessPosition = this;
    for (const uci of line) {
      const next = position.playing(uci);
      if (!next) return null;
      position = next;
    }
    return position;
  }

  // Pseudo-legal moves

  /** Every move the pieces can make by their own rules, castling included, whether or not it leaves the own king in check. `legalMoves()` filters those. */
  pseudoLegalMoves(): ChessMove[] {
    const moves: ChessMove[] = [];
    const side = this.sideToMove;
    const bit = colorBit(side);
    const board = this.board;
    for (let from = 0; from < 64; from++) {
      const code = board[from];
      if (code === 0 || (code & 8) !== bit) continue;
      switch (code & 7) {
        case 1: this.addPawnMoves(from, side, moves); break;
        case 2:
          for (const target of ChessTables.knightJumps[from]) if (board[target] === 0 || (board[target] & 8) !== bit) moves.push(makeMove(from, target));
          break;
        case 3: this.addSlidingMoves(from, 4, 8, bit, moves); break;
        case 4: this.addSlidingMoves(from, 0, 4, bit, moves); break;
        case 5: this.addSlidingMoves(from, 0, 8, bit, moves); break;
        default:
          for (const target of ChessTables.kingSteps[from]) if (board[target] === 0 || (board[target] & 8) !== bit) moves.push(makeMove(from, target));
          this.addCastlingMoves(side, moves);
      }
    }
    return moves;
  }

  private addSlidingMoves(from: Square, low: number, high: number, bit: number, moves: ChessMove[]): void {
    const rays = ChessTables.rays[from];
    for (let direction = low; direction < high; direction++) {
      for (const target of rays[direction]) {
        const code = this.board[target];
        if (code === 0) {
          moves.push(makeMove(from, target));
          continue;
        }
        if ((code & 8) !== bit) moves.push(makeMove(from, target));
        break;
      }
    }
  }

  private addPawnMoves(from: Square, side: ChessColor, moves: ChessMove[]): void {
    const step = pawnDirection(side);
    const promotes = Sq.rank(from) + step === promotionRank(side);
    const add = (target: Square) => {
      if (promotes) for (const kind of ['queen', 'rook', 'bishop', 'knight'] as PieceKind[]) moves.push(makeMove(from, target, kind));
      else moves.push(makeMove(from, target));
    };
    const ahead = Sq.offset(from, 0, step);
    if (ahead !== null && this.board[ahead] === 0) {
      add(ahead);
      const twice = Sq.offset(from, 0, 2 * step);
      if (Sq.rank(from) === pawnStartRank(side) && twice !== null && this.board[twice] === 0) moves.push(makeMove(from, twice));
    }
    for (const df of [-1, 1]) {
      const target = Sq.offset(from, df, step);
      if (target === null) continue;
      const code = this.board[target];
      if (code !== 0) {
        if ((code & 8) !== colorBit(side)) add(target);
      } else if (target === this.enPassant) {
        // The captured pawn stands beside the capturing one, on the square the double step ended on.
        const victim = this.board[Sq.rank(from) * 8 + Sq.file(target)];
        if (victim === pieceCode(opposite(side), 'pawn')) moves.push(makeMove(from, target));
      }
    }
  }

  /** Castling needs the right, king and rook at home, nothing between them, and the king neither in check nor crossing or landing on an attacked square. The rook may be attacked, and the rook's own path may be. */
  private addCastlingMoves(side: ChessColor, moves: ChessMove[]): void {
    const base = homeRank(side) * 8;
    const board = this.board;
    const king = pieceCode(side, 'king');
    const rook = pieceCode(side, 'rook');
    if (board[base + 4] !== king) return;
    const enemy = opposite(side);
    const kingside = (this.castling & Rights.kingside(side)) !== 0 && board[base + 7] === rook && board[base + 5] === 0 && board[base + 6] === 0;
    const queenside = (this.castling & Rights.queenside(side)) !== 0 && board[base] === rook && board[base + 1] === 0 && board[base + 2] === 0 && board[base + 3] === 0;
    if (!(kingside || queenside) || ChessPosition.isAttackedOn(board, base + 4, enemy)) return;
    if (kingside && !ChessPosition.isAttackedOn(board, base + 5, enemy) && !ChessPosition.isAttackedOn(board, base + 6, enemy)) moves.push(makeMove(base + 4, base + 6));
    if (queenside && !ChessPosition.isAttackedOn(board, base + 3, enemy) && !ChessPosition.isAttackedOn(board, base + 2, enemy)) moves.push(makeMove(base + 4, base + 2));
  }

  // Legal moves

  /** The moves that do not leave the mover's own king in check. */
  legalMoves(): ChessMove[] {
    const side = this.sideToMove;
    const kingStart = this.kingSquare(side);
    if (kingStart === null) return [];
    let king: number = kingStart;
    const enemy = opposite(side);
    const work = new Uint8Array(this.board);
    const result: ChessMove[] = [];
    for (const m of this.pseudoLegalMoves()) {
      const from = m.from;
      const to = m.to;
      const moving = work[from];
      const captured = work[to];
      let victimIndex = -1;
      let victim = 0;
      if (kindCode(moving) === 1 && captured === 0 && Sq.file(m.from) !== Sq.file(m.to)) {
        victimIndex = Sq.rank(m.from) * 8 + Sq.file(m.to);
        victim = work[victimIndex];
        work[victimIndex] = 0;
      }
      work[to] = moving;
      work[from] = 0;
      const isKingMove = kindCode(moving) === 6;
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

  isLegal(m: ChessMove): boolean { return containsMove(this.legalMoves(), m); }

  /** Whether the move captures something, en passant included. */
  isCapture(m: ChessMove): boolean { return this.board[m.to] !== 0 || this.isEnPassant(m); }

  isEnPassant(m: ChessMove): boolean {
    return kindCode(this.board[m.from]) === 1 && m.to === this.enPassant && this.board[m.to] === 0 && Sq.file(m.from) !== Sq.file(m.to);
  }

  isCastling(m: ChessMove): boolean { return kindCode(this.board[m.from]) === 6 && Math.abs(Sq.file(m.to) - Sq.file(m.from)) === 2; }

  /** The piece a move takes, if any (the pawn for en passant). */
  capturedPiece(m: ChessMove): ChessPiece | null {
    const there = this.at(m.to);
    if (there) return there;
    return this.isEnPassant(m) ? makePiece(opposite(this.sideToMove), 'pawn') : null;
  }

  /** Whether the move gives check or mate to the opponent. */
  givesCheck(m: ChessMove): boolean { return this.applying(m).isCheck; }

  // End of the game

  get hasLegalMove(): boolean { return this.legalMoves().length > 0; }
  get isCheckmate(): boolean { return this.isCheck && !this.hasLegalMove; }
  /** The side to move is not in check and has no legal move: a draw. */
  get isStalemate(): boolean { return !this.isCheck && !this.hasLegalMove; }
  /** A draw can be claimed after 50 moves by each side without a capture or a pawn move (100 half moves). */
  get canClaimFiftyMoveDraw(): boolean { return this.halfmoveClock >= 100; }

  /** No series of legal moves can end in mate: bare kings, a king and one minor piece against a king, or only bishops that all stand on squares of one color. (A knight against a knight can still be mated with help, so it is not counted.) */
  get hasInsufficientMaterial(): boolean {
    let knights = 0;
    let bishopsOnDark = 0;
    let bishopsOnLight = 0;
    for (let index = 0; index < 64; index++) {
      const kind = kindCode(this.board[index]);
      switch (kind) {
        case 0:
        case 6: continue;
        case 2: knights += 1; break;
        case 3:
          if (Sq.isDark(index)) bishopsOnDark += 1;
          else bishopsOnLight += 1;
          break;
        default: return false;
      }
    }
    const bishops = bishopsOnDark + bishopsOnLight;
    if (knights === 0) return bishopsOnDark === 0 || bishopsOnLight === 0;
    return knights === 1 && bishops === 0;
  }

  /** The number of move sequences of the given length: the engine's proof of correctness against known counts. */
  perft(depth: number): number {
    if (depth <= 0) return 1;
    const moves = this.legalMoves();
    if (depth === 1) return moves.length;
    let total = 0;
    for (const m of moves) total += this.applying(m).perft(depth - 1);
    return total;
  }

  /** Reasons a position could not arise in a game or cannot be played on: empty when it is sound. Courses check every authored position with it. */
  validationProblems(): string[] {
    const problems: string[] = [];
    for (const color of ['white', 'black'] as ChessColor[]) {
      const kings = this.count(makePiece(color, 'king'));
      if (kings !== 1) problems.push(`${colorName(color)} has ${kings} kings.`);
      const pawns = this.count(makePiece(color, 'pawn'));
      const total = this.squaresOfColor(color).length;
      if (pawns > 8) problems.push(`${colorName(color)} has ${pawns} pawns.`);
      if (total > 16) problems.push(`${colorName(color)} has ${total} pieces.`);
      // Every piece beyond the starting set must come from a promoted pawn.
      const extras = ([['queen', 1], ['rook', 2], ['bishop', 2], ['knight', 2]] as Array<[PieceKind, number]>).reduce((sum, [kind, own]) => sum + Math.max(0, this.count(makePiece(color, kind)) - own), 0);
      if (extras > 8 - pawns) problems.push(`${colorName(color)} has more pieces than promotions allow.`);
    }
    for (let index = 0; index < 64; index++) {
      if (kindCode(this.board[index]) !== 1) continue;
      const rank = Sq.rank(index);
      if (rank === 0 || rank === 7) problems.push(`A pawn stands on ${Sq.name(index)}.`);
    }
    // The side that just moved cannot have left its own king in check.
    if (this.isInCheck(opposite(this.sideToMove))) problems.push(`${colorName(opposite(this.sideToMove))} is in check but ${colorName(this.sideToMove)} is to move.`);
    const rights: Array<[number, ChessColor, number, string]> = [
      [Rights.whiteKingside, 'white', 7, 'h1'], [Rights.whiteQueenside, 'white', 0, 'a1'],
      [Rights.blackKingside, 'black', 63, 'h8'], [Rights.blackQueenside, 'black', 56, 'a8'],
    ];
    for (const [right, color, rookIndex, rookName] of rights) {
      if ((this.castling & right) === 0) continue;
      const kingIndex = homeRank(color) * 8 + 4;
      if (this.board[kingIndex] !== pieceCode(color, 'king')) problems.push(`${colorName(color)} may castle but the king is not on its square.`);
      if (this.board[rookIndex] !== pieceCode(color, 'rook')) problems.push(`${colorName(color)} may castle but there is no rook on ${rookName}.`);
    }
    if (this.enPassant !== null) {
      const target = this.enPassant;
      const mover = opposite(this.sideToMove);
      // After White's double step the target is on rank 3 and Black is to move, and the other way round.
      const expectedRank = mover === 'white' ? 2 : 5;
      if (Sq.rank(target) !== expectedRank) problems.push(`The en passant square ${Sq.name(target)} does not fit the side to move.`);
      if (this.board[target] !== 0) problems.push(`The en passant square ${Sq.name(target)} is occupied.`);
      const pawnIndex = (Sq.rank(target) + pawnDirection(mover)) * 8 + Sq.file(target);
      if (pawnIndex >= 0 && pawnIndex < 64 && this.board[pawnIndex] !== pieceCode(mover, 'pawn')) problems.push(`There is no pawn that could have just moved to the square in front of ${Sq.name(target)}.`);
      const originIndex = (Sq.rank(target) - pawnDirection(mover)) * 8 + Sq.file(target);
      if (originIndex >= 0 && originIndex < 64 && this.board[originIndex] !== 0) problems.push(`The pawn's start square for ${Sq.name(target)} is not empty.`);
    }
    return problems;
  }

  /** Whether two positions are the same. */
  equals(other: ChessPosition): boolean { return this.fen === other.fen; }
}

export function positionOf(fen: string): ChessPosition {
  const p = ChessPosition.fromFEN(fen);
  if (!p) throw new Error(`Bad FEN ${fen}`);
  return p;
}
