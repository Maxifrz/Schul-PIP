// German standard algebraic notation: K König, D Dame, T Turm, L Läufer, S Springer, no letter for a pawn, x for a
// capture, + for check, # for mate, O-O and O-O-O for castling, a letter after the square for a promotion ("e8D").
// Port of ChessNotation.swift.

import { ChessPosition } from './position';
import {
  fileLetter,
  kindLetter,
  movesEqual,
  piecesEqual,
  rankDigit,
  squareFile,
  squareName,
  squareRank,
  PAWN,
  type ChessMove,
} from './types';

export interface SanEntry {
  move: ChessMove;
  san: string;
}

function sanWith(m: ChessMove, position: ChessPosition, legal: readonly ChessMove[]): string | null {
  const piece = position.pieceAt(m.from);
  if (!legal.some((candidate) => movesEqual(candidate, m)) || piece === null) return null;
  let text = '';
  if (position.isCastling(m)) {
    text = squareFile(m.to) === 6 ? 'O-O' : 'O-O-O';
  } else {
    const capture = position.isCapture(m);
    if (piece.kind === PAWN) {
      if (capture) text += fileLetter(m.from) + 'x';
      text += squareName(m.to);
      if (m.promotion !== undefined) text += kindLetter(m.promotion);
    } else {
      text += kindLetter(piece.kind);
      // Other pieces of the same kind that could also go there make the origin necessary.
      const rivals = legal.filter(
        (other) => other.to === m.to && other.from !== m.from && piecesEqual(position.pieceAt(other.from), piece),
      );
      if (rivals.length > 0) {
        if (!rivals.some((other) => squareFile(other.from) === squareFile(m.from))) {
          text += fileLetter(m.from);
        } else if (!rivals.some((other) => squareRank(other.from) === squareRank(m.from))) {
          text += rankDigit(m.from);
        } else {
          text += squareName(m.from);
        }
      }
      if (capture) text += 'x';
      text += squareName(m.to);
    }
  }
  const after = position.applying(m);
  if (after.isCheck) text += after.hasLegalMove ? '+' : '#';
  return text;
}

/** The notation of a legal move in a position, like "Sf3", "exd5", "Tae1", "O-O", "e8D+", "Dh5#". null when illegal. */
export function san(m: ChessMove, position: ChessPosition): string | null {
  return sanWith(m, position, position.legalMoves());
}

/** The notation of every legal move of a position, in the generator's order. */
export function allSAN(position: ChessPosition): SanEntry[] {
  const legal = position.legalMoves();
  const result: SanEntry[] = [];
  for (const m of legal) {
    const text = sanWith(m, position, legal);
    if (text !== null) result.push({ move: m, san: text });
  }
  return result;
}

/** A notation reduced to what names the move: no signs, no capture mark, zeros read as the letter O. */
function bare(text: string): string {
  let result = text.split('e.p.').join('').split(' ').join('');
  result = result.split('0').join('O');
  return Array.from(result).filter((c) => !'+#x×=!?:'.includes(c)).join('');
}

/** The legal move a notation names, or null. Check signs, "x", "=" and "e.p." are optional; letters are German. */
export function moveFromSAN(text: string, position: ChessPosition): ChessMove | null {
  const wanted = bare(text);
  if (wanted.length === 0) return null;
  const matches = allSAN(position).filter((entry) => bare(entry.san) === wanted);
  return matches.length === 1 ? matches[0].move : null;
}

/** The notations of several moves, in order, each played after the one before; null if one is not legal. */
export function sanLine(moves: readonly ChessMove[], position: ChessPosition): string[] | null {
  let current = position;
  const result: string[] = [];
  for (const m of moves) {
    const text = san(m, current);
    if (text === null) return null;
    result.push(text);
    current = current.applying(m);
  }
  return result;
}

/** The position after moves given in notation, in order; null if one is not legal or unclear. */
export function play(line: readonly string[], position: ChessPosition = ChessPosition.start): ChessPosition | null {
  let current = position;
  for (const text of line) {
    const m = moveFromSAN(text, current);
    if (m === null) return null;
    current = current.applying(m);
  }
  return current;
}
