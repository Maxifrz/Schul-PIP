// The building blocks of the chess rules engine: colors, pieces, squares, moves.

export type ChessColor = 'white' | 'black';
export const colors: ChessColor[] = ['white', 'black'];

export const opposite = (c: ChessColor): ChessColor => (c === 'white' ? 'black' : 'white');
/** "Weiß" or "Schwarz". */
export const colorName = (c: ChessColor): string => (c === 'white' ? 'Weiß' : 'Schwarz');
/** The lower-case adjective stem: "weiß" or "schwarz". */
export const adjectiveStem = (c: ChessColor): string => (c === 'white' ? 'weiß' : 'schwarz');
/** Pawns move up the board (towards rank 8) for White and down for Black. */
export const pawnDirection = (c: ChessColor): number => (c === 'white' ? 1 : -1);
/** The rank (0 based) a side's pieces start on. */
export const homeRank = (c: ChessColor): number => (c === 'white' ? 0 : 7);
/** The rank (0 based) a side's pawns start on. */
export const pawnStartRank = (c: ChessColor): number => (c === 'white' ? 1 : 6);
/** The rank (0 based) on which a pawn of this side promotes. */
export const promotionRank = (c: ChessColor): number => (c === 'white' ? 7 : 0);

/** The grammatical case a German piece phrase is put in. */
export type ChessCase = 'nominative' | 'accusative' | 'dative';

export type PieceKind = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export const pieceKinds: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

const rawValues: Record<PieceKind, number> = { pawn: 1, knight: 2, bishop: 3, rook: 4, queen: 5, king: 6 };
/** 1 for the pawn up to 6 for the king. */
export const kindRaw = (k: PieceKind): number => rawValues[k];
export const kindFromRaw = (raw: number): PieceKind | null => pieceKinds.find((k) => rawValues[k] === raw) ?? null;

/** The usual exchange values 1, 3, 3, 5, 9. The king has none: it cannot be captured, only mated. */
export const kindValue = (k: PieceKind): number => ({ pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 })[k];

/** The letter of German notation: K König, D Dame, T Turm, L Läufer, S Springer; none for a pawn. */
export const kindLetter = (k: PieceKind): string => ({ pawn: '', knight: 'S', bishop: 'L', rook: 'T', queen: 'D', king: 'K' })[k];

/** The lower-case letter FEN uses for a black piece (and the one coordinate notation uses for a promotion). */
export const fenLetter = (k: PieceKind): string => ({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' })[k];

export function kindFromFenLetter(letter: string): PieceKind | null {
  const lower = letter.toLowerCase();
  return pieceKinds.find((k) => fenLetter(k) === lower) ?? null;
}

/** "Bauer", "Springer", "Läufer", "Turm", "Dame", "König". */
export const kindName = (k: PieceKind): string => ({ pawn: 'Bauer', knight: 'Springer', bishop: 'Läufer', rook: 'Turm', queen: 'Dame', king: 'König' })[k];

/** The plural: "Bauern", "Springer", "Läufer", "Türme", "Damen", "Könige". */
export const kindPlural = (k: PieceKind): string => ({ pawn: 'Bauern', knight: 'Springer', bishop: 'Läufer', rook: 'Türme', queen: 'Damen', king: 'Könige' })[k];

export const isFeminine = (k: PieceKind): boolean => k === 'queen';

/** The noun in a case; the pawn is a weak noun ("den Bauern"). */
export function kindNoun(k: PieceKind, c: ChessCase): string {
  if (k === 'pawn' && c !== 'nominative') return 'Bauern';
  return kindName(k);
}

/** Definite article: "der Turm", "die Dame", "den Turm", "dem Turm", "der Dame". */
export function kindArticle(k: PieceKind, c: ChessCase): string {
  const feminine = isFeminine(k);
  switch (c) {
    case 'nominative': return feminine ? 'die' : 'der';
    case 'accusative': return feminine ? 'die' : 'den';
    default: return feminine ? 'der' : 'dem';
  }
}

/** Bishop, rook and queen move any number of squares along a line; knight, king and pawn do not. */
export const slides = (k: PieceKind): boolean => k === 'bishop' || k === 'rook' || k === 'queen';

export interface ChessPiece {
  color: ChessColor;
  kind: PieceKind;
}

export const piece = (color: ChessColor, kind: PieceKind): ChessPiece => ({ color, kind });
export const samePiece = (a: ChessPiece | null | undefined, b: ChessPiece | null | undefined): boolean => !!a && !!b && a.color === b.color && a.kind === b.kind;

/** FEN letter: upper case for White. */
export function pieceFenCharacter(p: ChessPiece): string {
  const letter = fenLetter(p.kind);
  return p.color === 'white' ? letter.toUpperCase() : letter;
}

export function pieceFromFen(character: string): ChessPiece | null {
  const kind = kindFromFenLetter(character);
  if (!kind) return null;
  return piece(character === character.toUpperCase() && character !== character.toLowerCase() ? 'white' : 'black', kind);
}

/** "der weiße Springer", "die schwarze Dame", "den weißen Bauern", "dem schwarzen Turm". */
export function piecePhrase(p: ChessPiece, c: ChessCase = 'nominative'): string {
  const feminine = isFeminine(p.kind);
  const ending = c === 'nominative' ? 'e' : c === 'accusative' && feminine ? 'e' : 'en';
  return `${kindArticle(p.kind, c)} ${adjectiveStem(p.color)}${ending} ${kindNoun(p.kind, c)}`;
}

/** A square is a number: 0 is a1, 1 is b1, 8 is a2, 63 is h8. */
export type Square = number;

const fileLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const rankDigits = ['1', '2', '3', '4', '5', '6', '7', '8'];

export const Sq = {
  all: Array.from({ length: 64 }, (_, i) => i) as Square[],
  file: (s: Square): number => s & 7,
  rank: (s: Square): number => s >> 3,
  fileLetter: (s: Square): string => fileLetters[s & 7],
  rankDigit: (s: Square): string => rankDigits[s >> 3],
  name: (s: Square): string => fileLetters[s & 7] + rankDigits[s >> 3],
  /** a1 is a dark square, and the colors alternate from there. */
  isDark: (s: Square): boolean => ((s & 7) + (s >> 3)) % 2 === 0,
  isLight: (s: Square): boolean => ((s & 7) + (s >> 3)) % 2 !== 0,
  at(file: number, rank: number): Square | null {
    return file >= 0 && file < 8 && rank >= 0 && rank < 8 ? rank * 8 + file : null;
  },
  /** "e4"; null for anything else. */
  of(name: string): Square | null {
    const text = name.toLowerCase();
    if (text.length !== 2) return null;
    const file = fileLetters.indexOf(text[0]);
    const rank = rankDigits.indexOf(text[1]);
    return file < 0 || rank < 0 ? null : rank * 8 + file;
  },
  /** The square a step away, null off the board. */
  offset(s: Square, df: number, dr: number): Square | null {
    return Sq.at((s & 7) + df, (s >> 3) + dr);
  },
};

/** The square of a name that is known to be right. */
export function sqr(name: string): Square {
  const found = Sq.of(name);
  if (found === null) throw new Error(`No square ${name}`);
  return found;
}

export interface ChessMove {
  from: Square;
  to: Square;
  /** The piece a pawn becomes on the last rank (queen, rook, bishop or knight). */
  promotion?: PieceKind;
}

export const move = (from: Square, to: Square, promotion?: PieceKind): ChessMove => (promotion ? { from, to, promotion } : { from, to });
export const sameMove = (a: ChessMove, b: ChessMove): boolean => a.from === b.from && a.to === b.to && a.promotion === b.promotion;
export const containsMove = (list: ChessMove[], m: ChessMove): boolean => list.some((x) => sameMove(x, m));

/** Coordinate notation: "e2e4", "e7e8q"; castling is the king's move, "e1g1". */
export const moveUci = (m: ChessMove): string => Sq.name(m.from) + Sq.name(m.to) + (m.promotion ? fenLetter(m.promotion) : '');

export function moveFromUci(uci: string): ChessMove | null {
  const text = uci.toLowerCase();
  if (text.length !== 4 && text.length !== 5) return null;
  const from = Sq.of(text.slice(0, 2));
  const to = Sq.of(text.slice(2, 4));
  if (from === null || to === null) return null;
  let promotion: PieceKind | undefined;
  if (text.length === 5) {
    const kind = kindFromFenLetter(text[4]);
    if (!kind || !['queen', 'rook', 'bishop', 'knight'].includes(kind)) return null;
    promotion = kind;
  }
  return move(from, to, promotion);
}

/** Castling rights as bits: 1 white kingside, 2 white queenside, 4 black kingside, 8 black queenside. */
export const Rights = {
  whiteKingside: 1,
  whiteQueenside: 2,
  blackKingside: 4,
  blackQueenside: 8,
  all: 15,
  kingside: (c: ChessColor): number => (c === 'white' ? 1 : 4),
  queenside: (c: ChessColor): number => (c === 'white' ? 2 : 8),
  /** The FEN field: "KQkq", "Kq", or "-". */
  fen(rights: number): string {
    let text = '';
    if (rights & 1) text += 'K';
    if (rights & 2) text += 'Q';
    if (rights & 4) text += 'k';
    if (rights & 8) text += 'q';
    return text === '' ? '-' : text;
  },
  parse(fen: string): number | null {
    if (fen === '-') return 0;
    let rights = 0;
    for (const character of fen) {
      switch (character) {
        case 'K': rights |= 1; break;
        case 'Q': rights |= 2; break;
        case 'k': rights |= 4; break;
        case 'q': rights |= 8; break;
        default: return null;
      }
    }
    return fen === '' || new Set(fen).size !== fen.length ? null : rights;
  },
};

/** Precomputed lines for the move generator: rays along the eight directions and the jumps of knight and king. */
export const ChessTables = (() => {
  /** The first four are the rook's directions (up, down, right, left), the last four the bishop's. */
  const directions: Array<[number, number]> = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const rays: number[][][] = Sq.all.map((index) => directions.map(([df, dr]) => {
    const line: number[] = [];
    let file = (index & 7) + df;
    let rank = (index >> 3) + dr;
    while (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
      line.push(rank * 8 + file);
      file += df;
      rank += dr;
    }
    return line;
  }));
  const knightSteps: Array<[number, number]> = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const knightJumps: number[][] = Sq.all.map((index) => knightSteps.map(([df, dr]) => Sq.at((index & 7) + df, (index >> 3) + dr)).filter((s): s is number => s !== null));
  const kingSteps: number[][] = Sq.all.map((index) => directions.map(([df, dr]) => Sq.at((index & 7) + df, (index >> 3) + dr)).filter((s): s is number => s !== null));
  return { directions, rays, knightJumps, kingSteps };
})();
