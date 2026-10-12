// The building blocks of the chess rules engine: colors, pieces, squares, moves. Pure TypeScript, port of ChessTypes.swift.
// A square is its index 0...63 (0 is a1, 1 is b1, 8 is a2, 63 is h8); a piece kind is its Swift raw value 1...6.

export type ChessColor = 'white' | 'black';
export const CHESS_COLORS: readonly ChessColor[] = ['white', 'black'];

export function oppositeColor(color: ChessColor): ChessColor {
  return color === 'white' ? 'black' : 'white';
}
/** "Weiß" or "Schwarz". */
export function colorGermanName(color: ChessColor): string {
  return color === 'white' ? 'Weiß' : 'Schwarz';
}
/** The lower-case adjective stem: "weiß" or "schwarz". */
export function colorAdjectiveStem(color: ChessColor): string {
  return color === 'white' ? 'weiß' : 'schwarz';
}
/** Pawns move up the board (towards rank 8) for White and down for Black. */
export function pawnDirection(color: ChessColor): number {
  return color === 'white' ? 1 : -1;
}
/** The rank (0 based) a side's pieces start on. */
export function homeRank(color: ChessColor): number {
  return color === 'white' ? 0 : 7;
}
/** The rank (0 based) a side's pawns start on. */
export function pawnStartRank(color: ChessColor): number {
  return color === 'white' ? 1 : 6;
}
/** The rank (0 based) on which a pawn of this side promotes. */
export function promotionRank(color: ChessColor): number {
  return color === 'white' ? 7 : 0;
}

/** The grammatical case a German piece phrase is put in. */
export type ChessCase = 'nominative' | 'accusative' | 'dative';

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export type ChessPieceKind = 1 | 2 | 3 | 4 | 5 | 6;
/** All kinds in raw-value order (Swift `allCases`). */
export const ALL_PIECE_KINDS: readonly ChessPieceKind[] = [1, 2, 3, 4, 5, 6];

/** The usual exchange values 1, 3, 3, 5, 9. The king has none. */
export function kindValue(kind: ChessPieceKind): number {
  switch (kind) {
    case PAWN: return 1;
    case KNIGHT:
    case BISHOP: return 3;
    case ROOK: return 5;
    case QUEEN: return 9;
    default: return 0;
  }
}

/** The letter of German notation: K König, D Dame, T Turm, L Läufer, S Springer; none for a pawn. */
export function kindLetter(kind: ChessPieceKind): string {
  return ['', '', 'S', 'L', 'T', 'D', 'K'][kind];
}

/** The lower-case letter FEN uses for a black piece (and coordinate notation for a promotion). */
export function kindFenLetter(kind: ChessPieceKind): string {
  return ['', 'p', 'n', 'b', 'r', 'q', 'k'][kind];
}

export function kindFromFenLetter(letter: string): ChessPieceKind | null {
  const index = ['p', 'n', 'b', 'r', 'q', 'k'].indexOf(letter.toLowerCase());
  return index < 0 ? null : ((index + 1) as ChessPieceKind);
}

/** "Bauer", "Springer", "Läufer", "Turm", "Dame", "König". */
export function kindGermanName(kind: ChessPieceKind): string {
  return ['', 'Bauer', 'Springer', 'Läufer', 'Turm', 'Dame', 'König'][kind];
}

/** The plural: "Bauern", "Springer", "Läufer", "Türme", "Damen", "Könige". */
export function kindGermanPlural(kind: ChessPieceKind): string {
  return ['', 'Bauern', 'Springer', 'Läufer', 'Türme', 'Damen', 'Könige'][kind];
}

export function kindIsFeminine(kind: ChessPieceKind): boolean {
  return kind === QUEEN;
}

/** The noun in a case; the pawn is a weak noun ("den Bauern"). */
export function kindNoun(kind: ChessPieceKind, grammaticalCase: ChessCase): string {
  if (kind === PAWN && grammaticalCase !== 'nominative') return 'Bauern';
  return kindGermanName(kind);
}

/** Definite article: "der Turm", "die Dame", "den Turm", "dem Turm", "der Dame". */
export function kindArticle(kind: ChessPieceKind, grammaticalCase: ChessCase): string {
  const feminine = kindIsFeminine(kind);
  switch (grammaticalCase) {
    case 'nominative': return feminine ? 'die' : 'der';
    case 'accusative': return feminine ? 'die' : 'den';
    default: return feminine ? 'der' : 'dem';
  }
}

/** Bishop, rook and queen move any number of squares along a line; knight, king and pawn do not. */
export function kindSlides(kind: ChessPieceKind): boolean {
  return kind === BISHOP || kind === ROOK || kind === QUEEN;
}

export interface ChessPiece {
  readonly color: ChessColor;
  readonly kind: ChessPieceKind;
}

export function piece(color: ChessColor, kind: ChessPieceKind): ChessPiece {
  return { color, kind };
}

export function piecesEqual(a: ChessPiece | null | undefined, b: ChessPiece | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  return a.color === b.color && a.kind === b.kind;
}

/** FEN letter: upper case for White. */
export function pieceFenCharacter(p: ChessPiece): string {
  const letter = kindFenLetter(p.kind);
  return p.color === 'white' ? letter.toUpperCase() : letter;
}

export function pieceFromFenCharacter(character: string): ChessPiece | null {
  const kind = kindFromFenLetter(character);
  if (kind === null) return null;
  const isUpper = character !== character.toLowerCase() && character === character.toUpperCase();
  return { color: isUpper ? 'white' : 'black', kind };
}

/** "der weiße Springer", "die schwarze Dame", "den weißen Bauern", "dem schwarzen Turm". */
export function piecePhrase(p: ChessPiece, grammaticalCase: ChessCase = 'nominative'): string {
  const feminine = kindIsFeminine(p.kind);
  let ending: string;
  switch (grammaticalCase) {
    case 'nominative': ending = 'e'; break;
    case 'accusative': ending = feminine ? 'e' : 'en'; break;
    default: ending = 'en';
  }
  return `${kindArticle(p.kind, grammaticalCase)} ${colorAdjectiveStem(p.color)}${ending} ${kindNoun(p.kind, grammaticalCase)}`;
}

// MARK: Squares

export type ChessSquare = number;

export const FILE_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANK_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
/** All 64 squares from a1 to h8. */
export const ALL_SQUARES: readonly ChessSquare[] = Array.from({ length: 64 }, (_, i) => i);

export function square(file: number, rank: number): ChessSquare | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return rank * 8 + file;
}

/** "e4"; null for anything else (case-insensitive like the Swift initializer). */
export function squareFromName(name: string): ChessSquare | null {
  const characters = Array.from(name.toLowerCase());
  if (characters.length !== 2) return null;
  const file = (FILE_LETTERS as readonly string[]).indexOf(characters[0]);
  const rank = (RANK_DIGITS as readonly string[]).indexOf(characters[1]);
  if (file < 0 || rank < 0) return null;
  return rank * 8 + file;
}

export function squareFile(s: ChessSquare): number {
  return s & 7;
}
export function squareRank(s: ChessSquare): number {
  return s >> 3;
}
export function fileLetter(s: ChessSquare): string {
  return FILE_LETTERS[s & 7];
}
export function rankDigit(s: ChessSquare): string {
  return RANK_DIGITS[s >> 3];
}
export function squareName(s: ChessSquare): string {
  return FILE_LETTERS[s & 7] + RANK_DIGITS[s >> 3];
}
/** a1 is a dark square, and the colors alternate from there. */
export function isDarkSquare(s: ChessSquare): boolean {
  return ((s & 7) + (s >> 3)) % 2 === 0;
}
export function isLightSquare(s: ChessSquare): boolean {
  return !isDarkSquare(s);
}
/** The square a step away, null off the board. */
export function squareOffset(s: ChessSquare, df: number, dr: number): ChessSquare | null {
  return square((s & 7) + df, (s >> 3) + dr);
}

// MARK: Moves

export interface ChessMove {
  readonly from: ChessSquare;
  readonly to: ChessSquare;
  /** The piece a pawn becomes on the last rank (queen, rook, bishop or knight). */
  readonly promotion?: ChessPieceKind;
}

export function move(from: ChessSquare, to: ChessSquare, promotion?: ChessPieceKind): ChessMove {
  return promotion === undefined ? { from, to } : { from, to, promotion };
}

export function movesEqual(a: ChessMove, b: ChessMove): boolean {
  return a.from === b.from && a.to === b.to && a.promotion === b.promotion;
}

/** Coordinate notation: "e2e4", "e7e8q"; castling is the king's move, "e1g1". null when malformed. */
export function moveFromUci(uci: string): ChessMove | null {
  const characters = Array.from(uci.toLowerCase());
  if (characters.length !== 4 && characters.length !== 5) return null;
  const from = squareFromName(characters[0] + characters[1]);
  const to = squareFromName(characters[2] + characters[3]);
  if (from === null || to === null) return null;
  let promotion: ChessPieceKind | undefined;
  if (characters.length === 5) {
    const kind = kindFromFenLetter(characters[4]);
    if (kind === null || ![QUEEN, ROOK, BISHOP, KNIGHT].includes(kind)) return null;
    promotion = kind;
  }
  return move(from, to, promotion);
}

export function moveUci(m: ChessMove): string {
  return squareName(m.from) + squareName(m.to) + (m.promotion === undefined ? '' : kindFenLetter(m.promotion));
}

// MARK: Castling rights (bit set)

export type ChessCastlingRights = number;
export const WHITE_KINGSIDE = 1;
export const WHITE_QUEENSIDE = 2;
export const BLACK_KINGSIDE = 4;
export const BLACK_QUEENSIDE = 8;
export const ALL_CASTLING = 15;

export function kingsideRight(color: ChessColor): number {
  return color === 'white' ? WHITE_KINGSIDE : BLACK_KINGSIDE;
}
export function queensideRight(color: ChessColor): number {
  return color === 'white' ? WHITE_QUEENSIDE : BLACK_QUEENSIDE;
}

/** The FEN field: "KQkq", "Kq", or "-". */
export function castlingFen(rights: ChessCastlingRights): string {
  let text = '';
  if (rights & WHITE_KINGSIDE) text += 'K';
  if (rights & WHITE_QUEENSIDE) text += 'Q';
  if (rights & BLACK_KINGSIDE) text += 'k';
  if (rights & BLACK_QUEENSIDE) text += 'q';
  return text === '' ? '-' : text;
}

/** Parses the FEN castling field; null if it is empty, has a duplicate or an unknown letter. */
export function castlingFromFen(fen: string): ChessCastlingRights | null {
  if (fen === '-') return 0;
  let rights = 0;
  for (const character of fen) {
    switch (character) {
      case 'K': rights |= WHITE_KINGSIDE; break;
      case 'Q': rights |= WHITE_QUEENSIDE; break;
      case 'k': rights |= BLACK_KINGSIDE; break;
      case 'q': rights |= BLACK_QUEENSIDE; break;
      default: return null;
    }
  }
  if (fen.length === 0 || new Set(fen).size !== Array.from(fen).length) return null;
  return rights;
}

// MARK: Tables

/** The first four are the rook's directions (up, down, right, left), the last four the bishop's. */
export const DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1],
];

/** `RAYS[square][direction]`: the squares from the one next to `square` to the edge. */
export const RAYS: readonly (readonly (readonly number[])[])[] = ALL_SQUARES.map((index) =>
  DIRECTIONS.map(([df, dr]) => {
    const line: number[] = [];
    let file = (index & 7) + df;
    let rank = (index >> 3) + dr;
    while (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
      line.push(rank * 8 + file);
      file += df;
      rank += dr;
    }
    return line;
  }),
);

const KNIGHT_STEPS: readonly (readonly [number, number])[] = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

export const KNIGHT_JUMPS: readonly (readonly number[])[] = ALL_SQUARES.map((index) =>
  KNIGHT_STEPS.map(([df, dr]) => square((index & 7) + df, (index >> 3) + dr)).filter((s): s is number => s !== null),
);

export const KING_STEPS: readonly (readonly number[])[] = ALL_SQUARES.map((index) =>
  DIRECTIONS.map(([df, dr]) => square((index & 7) + df, (index >> 3) + dr)).filter((s): s is number => s !== null),
);
