import { ChessMove, ChessPiece, Sq, containsMove, kindLetter, samePiece, sameMove } from './types';
import { ChessPosition } from './position';

/** German standard algebraic notation: K König, D Dame, T Turm, L Läufer, S Springer, no letter for a pawn, x for a capture, + for check, # for mate, O-O and O-O-O for castling, a letter after the square for a promotion ("e8D"). */
export const ChessNotation = {
  /** The notation of a legal move in a position, like "Sf3", "exd5", "Tae1", "O-O", "e8D+", "Dh5#". null when the move is not legal there. */
  san(m: ChessMove, position: ChessPosition): string | null {
    return sanIn(m, position, position.legalMoves());
  },

  /** The notation of every legal move of a position, in the generator's order. */
  allSAN(position: ChessPosition): Array<{ move: ChessMove; san: string }> {
    const legal = position.legalMoves();
    const result: Array<{ move: ChessMove; san: string }> = [];
    for (const m of legal) {
      const text = sanIn(m, position, legal);
      if (text !== null) result.push({ move: m, san: text });
    }
    return result;
  },

  /** The legal move a notation names, or null. Check signs, "x", "=" and "e.p." are optional in the input; the letters are the German ones. */
  moveFromSAN(text: string, position: ChessPosition): ChessMove | null {
    const wanted = bare(text);
    if (wanted === '') return null;
    const matches = ChessNotation.allSAN(position).filter((e) => bare(e.san) === wanted);
    return matches.length === 1 ? matches[0].move : null;
  },

  /** The notations of several moves, in order, each played after the one before; null if one is not legal. */
  sanLine(moves: ChessMove[], from: ChessPosition): string[] | null {
    let current = from;
    const result: string[] = [];
    for (const m of moves) {
      const text = ChessNotation.san(m, current);
      if (text === null) return null;
      result.push(text);
      current = current.applying(m);
    }
    return result;
  },

  /** The position after moves given in notation, in order; null if one is not legal or unclear. */
  play(line: string[], from: ChessPosition = ChessPosition.start): ChessPosition | null {
    let current = from;
    for (const text of line) {
      const m = ChessNotation.moveFromSAN(text, current);
      if (!m) return null;
      current = current.applying(m);
    }
    return current;
  },
};

function sanIn(m: ChessMove, position: ChessPosition, legal: ChessMove[]): string | null {
  const mover = position.at(m.from);
  if (!containsMove(legal, m) || !mover) return null;
  let text = '';
  if (position.isCastling(m)) {
    text = Sq.file(m.to) === 6 ? 'O-O' : 'O-O-O';
  } else {
    const capture = position.isCapture(m);
    if (mover.kind === 'pawn') {
      if (capture) text += `${Sq.fileLetter(m.from)}x`;
      text += Sq.name(m.to);
      if (m.promotion) text += kindLetter(m.promotion);
    } else {
      text += kindLetter(mover.kind);
      // Other pieces of the same kind that could also go there make the origin necessary.
      const rivals = legal.filter((o) => o.to === m.to && o.from !== m.from && samePiece(position.at(o.from) as ChessPiece, mover));
      if (rivals.length > 0) {
        if (!rivals.some((o) => Sq.file(o.from) === Sq.file(m.from))) text += Sq.fileLetter(m.from);
        else if (!rivals.some((o) => Sq.rank(o.from) === Sq.rank(m.from))) text += Sq.rankDigit(m.from);
        else text += Sq.name(m.from);
      }
      if (capture) text += 'x';
      text += Sq.name(m.to);
    }
  }
  const after = position.applying(m);
  if (after.isCheck) text += after.hasLegalMove ? '+' : '#';
  return text;
}

/** A notation reduced to what names the move: no signs, no capture mark, zeros read as the letter O. */
function bare(text: string): string {
  let result = text.split('e.p.').join('').split(' ').join('');
  result = result.split('0').join('O');
  return [...result].filter((c) => !'+#x×=!?:'.includes(c)).join('');
}

void sameMove;
