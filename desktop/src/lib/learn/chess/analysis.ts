// Castling problems, attack maps and the tactical motifs (pins, skewers, forks, hanging pieces, discovered targets).
// Port of ChessAnalysis.swift.

import type { ChessPosition } from './position';
import { ChessExchange } from './search';
import {
  BISHOP,
  KING,
  KING_STEPS,
  KNIGHT,
  KNIGHT_JUMPS,
  PAWN,
  QUEEN,
  RAYS,
  ROOK,
  homeRank,
  kindSlides,
  kindValue,
  kingsideRight,
  oppositeColor,
  pawnDirection,
  piecesEqual,
  queensideRight,
  squareOffset,
  type ChessColor,
  type ChessMove,
  type ChessSquare,
} from './types';

export type ChessCastleSide = 'kingside' | 'queenside';

/** Why a castling is not possible, one reason each; a position can have several. */
export type ChessCastlingProblem =
  | 'rightLost' // the king or this rook has moved before (or is not on its square)
  | 'piecesBetween' // a piece stands between king and rook
  | 'inCheck' // the king is in check
  | 'crossesAttackedSquare' // the king would cross a square the opponent attacks
  | 'landsOnAttackedSquare'; // the king would land on a square the opponent attacks

export function castleSideGermanName(side: ChessCastleSide): string {
  return side === 'kingside' ? 'kurze' : 'lange';
}
export function castleSideNotation(side: ChessCastleSide): string {
  return side === 'kingside' ? 'O-O' : 'O-O-O';
}

/**
 * The reasons the side to move cannot castle to a side. Computed from the rules of Article 3.8, independently of the
 * move generator; no reasons means the castling is possible.
 */
export function castlingProblems(side: ChessCastleSide, position: ChessPosition): ChessCastlingProblem[] {
  const color = position.sideToMove;
  const rank = homeRank(color);
  const at = (file: number): ChessSquare => rank * 8 + file;
  const rookFile = side === 'kingside' ? 7 : 0;
  const between = side === 'kingside' ? [5, 6] : [1, 2, 3];
  const crossed = side === 'kingside' ? 5 : 3;
  const landing = side === 'kingside' ? 6 : 2;
  const enemy = oppositeColor(color);
  const result: ChessCastlingProblem[] = [];
  const right = side === 'kingside' ? kingsideRight(color) : queensideRight(color);
  if (
    (position.castling & right) === 0 ||
    !piecesEqual(position.pieceAt(at(4)), { color, kind: KING }) ||
    !piecesEqual(position.pieceAt(at(rookFile)), { color, kind: ROOK })
  ) {
    result.push('rightLost');
  }
  if (between.some((file) => position.pieceAt(at(file)) !== null)) result.push('piecesBetween');
  if (position.isAttacked(at(4), enemy)) result.push('inCheck');
  if (position.isAttacked(at(crossed), enemy)) result.push('crossesAttackedSquare');
  if (position.isAttacked(at(landing), enemy)) result.push('landsOnAttackedSquare');
  return result;
}

/** The squares the piece on `square` attacks, occupied or not (a pinned piece still attacks). */
export function attackedSquares(position: ChessPosition, sq: ChessSquare): ChessSquare[] {
  const p = position.pieceAt(sq);
  if (p === null) return [];
  switch (p.kind) {
    case PAWN:
      return [-1, 1]
        .map((df) => squareOffset(sq, df, pawnDirection(p.color)))
        .filter((s): s is ChessSquare => s !== null);
    case KNIGHT:
      return [...KNIGHT_JUMPS[sq]];
    case KING:
      return [...KING_STEPS[sq]];
    default: {
      const [first, end] = p.kind === BISHOP ? [4, 8] : p.kind === ROOK ? [0, 4] : [0, 8];
      const result: ChessSquare[] = [];
      for (let direction = first; direction < end; direction++) {
        for (const target of RAYS[sq][direction]) {
          result.push(target);
          if (position.board[target] !== 0) break;
        }
      }
      return result;
    }
  }
}

/** The enemy pieces the piece on `square` attacks. */
export function attackedEnemies(position: ChessPosition, sq: ChessSquare): ChessSquare[] {
  const p = position.pieceAt(sq);
  if (p === null) return [];
  return attackedSquares(position, sq).filter((target) => {
    const other = position.pieceAt(target);
    return other !== null && other.color !== p.color;
  });
}

/** A line on which a long-range piece looks at an enemy piece and, behind it, at another. */
export interface ChessLineUp {
  attacker: ChessSquare;
  front: ChessSquare;
  back: ChessSquare;
}

export const ChessTactics = {
  /** A piece of `color` that cannot leave a line because its king stands behind it, and the enemy piece on that line. */
  absolutePins(color: ChessColor, position: ChessPosition): { pinned: ChessSquare; pinner: ChessSquare }[] {
    const king = position.kingSquare(color);
    if (king === null) return [];
    const result: { pinned: ChessSquare; pinner: ChessSquare }[] = [];
    for (let direction = 0; direction < 8; direction++) {
      let own: ChessSquare | null = null;
      for (const index of RAYS[king][direction]) {
        const p = position.pieceAt(index);
        if (p === null) continue;
        if (own === null) {
          if (p.color === color) own = index;
          else break;
        } else {
          const slidesThere = p.kind === QUEEN || (direction < 4 ? p.kind === ROOK : p.kind === BISHOP);
          if (p.color !== color && slidesThere) result.push({ pinned: own, pinner: index });
          break;
        }
      }
    }
    return result.sort((a, b) => a.pinned - b.pinned);
  },

  /**
   * Every line on which a rook, bishop or queen of `color` attacks an enemy piece with another enemy piece right
   * behind it. A pin if the front piece is worth less (or the back one is the king), a skewer if it is worth more.
   */
  lineUps(color: ChessColor, position: ChessPosition): ChessLineUp[] {
    const result: ChessLineUp[] = [];
    for (const { square: sq, piece: p } of position.pieces) {
      if (p.color !== color || !kindSlides(p.kind)) continue;
      const [first, end] = p.kind === BISHOP ? [4, 8] : p.kind === ROOK ? [0, 4] : [0, 8];
      for (let direction = first; direction < end; direction++) {
        let front: ChessSquare | null = null;
        for (const target of RAYS[sq][direction]) {
          const found = position.pieceAt(target);
          if (found === null) continue;
          if (front === null) {
            if (found.color === color) break;
            front = target;
          } else {
            if (found.color !== color) result.push({ attacker: sq, front, back: target });
            break;
          }
        }
      }
    }
    return result;
  },

  /** Whether a line-up is a skewer: the front piece is the king or worth more than the one behind it. */
  isSkewer(lineUp: ChessLineUp, position: ChessPosition): boolean {
    const front = position.pieceAt(lineUp.front);
    const back = position.pieceAt(lineUp.back);
    if (!front || !back) return false;
    if (back.kind === KING) return false;
    return front.kind === KING || kindValue(front.kind) > kindValue(back.kind);
  },

  /** Whether a line-up is a pin: the back piece is the king or worth more than the front one. */
  isPin(lineUp: ChessLineUp, position: ChessPosition): boolean {
    const front = position.pieceAt(lineUp.front);
    const back = position.pieceAt(lineUp.back);
    if (!front || !back) return false;
    if (front.kind === KING) return false;
    return back.kind === KING || kindValue(back.kind) > kindValue(front.kind);
  },

  /**
   * The enemy pieces the piece on `square` attacks that are worth attacking: the king, a piece worth more than the
   * attacker, or a piece nothing defends. Two or more of these make a fork.
   */
  forkTargets(sq: ChessSquare, position: ChessPosition): ChessSquare[] {
    const attacker = position.pieceAt(sq);
    if (attacker === null) return [];
    return attackedEnemies(position, sq).filter((target) => {
      const p = position.pieceAt(target);
      if (p === null) return false;
      if (p.kind === KING || kindValue(p.kind) > kindValue(attacker.kind)) return true;
      return position.attackers(target, p.color).length === 0;
    });
  },

  /** The enemy pieces that the pieces other than the mover attack after the move and did not before. */
  discoveredTargets(m: ChessMove, position: ChessPosition): ChessSquare[] {
    const mover = position.pieceAt(m.from);
    if (mover === null) return [];
    const after = position.applying(m);
    const result: ChessSquare[] = [];
    for (const { square: sq, piece: p } of position.pieces) {
      if (p.color !== mover.color || sq === m.from) continue;
      const before = new Set(attackedEnemies(position, sq));
      for (const target of attackedEnemies(after, sq)) {
        if (!before.has(target) && target !== m.to) result.push(target);
      }
    }
    return result.sort((a, b) => a - b);
  },

  /** The pieces of `color` that the other side wins by capturing them (the exchange helper), if it were its turn. */
  hangingPieces(color: ChessColor, position: ChessPosition): ChessSquare[] {
    const opponent = position.withSideToMove(oppositeColor(color));
    const result = new Set<ChessSquare>();
    for (const m of opponent.legalMoves()) {
      if (opponent.isCapture(m) && ChessExchange.gain(m, opponent) > 0) result.add(m.to);
    }
    return [...result].sort((a, b) => a - b);
  },
};
