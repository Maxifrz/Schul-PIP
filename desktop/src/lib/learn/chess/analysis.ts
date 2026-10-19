import { ChessColor, ChessMove, Rights, Square, Sq, ChessTables, kindValue, opposite, piece, samePiece, slides } from './types';
import { ChessPosition } from './position';

/** Why a castling is not possible, one reason each; a position can have several. */
export type ChessCastlingProblem =
  /** The king or this rook has moved before (the FEN's castling field lacks the right), or is not on its square. */
  | 'rightLost'
  /** A piece stands between king and rook. */
  | 'piecesBetween'
  /** The king is in check. */
  | 'inCheck'
  /** The king would cross a square the opponent attacks. */
  | 'crossesAttackedSquare'
  /** The king would land on a square the opponent attacks. */
  | 'landsOnAttackedSquare';

export type ChessCastleSide = 'kingside' | 'queenside';

export const ChessCastling = {
  /** The reasons the side to move cannot castle to a side. Computed from the rules of Article 3.8, independently of the move generator; no reasons means the castling is possible. */
  problems(side: ChessCastleSide, position: ChessPosition): ChessCastlingProblem[] {
    const color = position.sideToMove;
    const rank = color === 'white' ? 0 : 7;
    const square = (file: number): Square => rank * 8 + file;
    const rookFile = side === 'kingside' ? 7 : 0;
    const between = side === 'kingside' ? [5, 6] : [1, 2, 3];
    const crossed = side === 'kingside' ? 5 : 3;
    const landing = side === 'kingside' ? 6 : 2;
    const enemy = opposite(color);
    const result: ChessCastlingProblem[] = [];
    const right = side === 'kingside' ? Rights.kingside(color) : Rights.queenside(color);
    if ((position.castling & right) === 0 || !samePiece(position.at(square(4)), piece(color, 'king')) || !samePiece(position.at(square(rookFile)), piece(color, 'rook'))) result.push('rightLost');
    if (between.some((f) => position.at(square(f)) !== null)) result.push('piecesBetween');
    if (position.isAttacked(square(4), enemy)) result.push('inCheck');
    if (position.isAttacked(square(crossed), enemy)) result.push('crossesAttackedSquare');
    if (position.isAttacked(square(landing), enemy)) result.push('landsOnAttackedSquare');
    return result;
  },
};

/** The squares the piece on `square` attacks, occupied or not (a pinned piece still attacks). */
export function attackedSquares(position: ChessPosition, square: Square): Square[] {
  const p = position.at(square);
  if (!p) return [];
  switch (p.kind) {
    case 'pawn':
      return [-1, 1].map((df) => Sq.offset(square, df, p.color === 'white' ? 1 : -1)).filter((s): s is Square => s !== null);
    case 'knight':
      return [...ChessTables.knightJumps[square]];
    case 'king':
      return [...ChessTables.kingSteps[square]];
    default: {
      const [low, high] = p.kind === 'bishop' ? [4, 8] : p.kind === 'rook' ? [0, 4] : [0, 8];
      const result: Square[] = [];
      for (let direction = low; direction < high; direction++) {
        for (const target of ChessTables.rays[square][direction]) {
          result.push(target);
          if (position.board[target] !== 0) break;
        }
      }
      return result;
    }
  }
}

/** The enemy pieces the piece on `square` attacks. */
export function attackedEnemies(position: ChessPosition, square: Square): Square[] {
  const p = position.at(square);
  if (!p) return [];
  return attackedSquares(position, square).filter((s) => {
    const there = position.at(s);
    return !!there && there.color !== p.color;
  });
}

/** A line on which a long-range piece looks at an enemy piece and, behind it, at another. */
export interface ChessLineUp {
  attacker: Square;
  front: Square;
  back: Square;
}

export const ChessTactics = {
  /** A piece of `color` that cannot leave a line because its king stands behind it, and the enemy piece on that line. */
  absolutePins(color: ChessColor, position: ChessPosition): Array<{ pinned: Square; pinner: Square }> {
    const king = position.kingSquare(color);
    if (king === null) return [];
    const result: Array<{ pinned: Square; pinner: Square }> = [];
    for (let direction = 0; direction < 8; direction++) {
      let own: Square | null = null;
      for (const index of ChessTables.rays[king][direction]) {
        const found = position.at(index);
        if (!found) continue;
        if (own === null) {
          if (found.color === color) own = index;
          else break;
        } else {
          const slidesThere = found.kind === 'queen' || (direction < 4 ? found.kind === 'rook' : found.kind === 'bishop');
          if (found.color !== color && slidesThere) result.push({ pinned: own, pinner: index });
          break;
        }
      }
    }
    return result.sort((a, b) => a.pinned - b.pinned);
  },

  /** Every line on which a rook, bishop or queen of `color` attacks an enemy piece with another enemy piece right behind it. A pin if the front piece is worth less (or the back one is the king), a skewer if it is worth more. */
  lineUps(by: ChessColor, position: ChessPosition): ChessLineUp[] {
    const result: ChessLineUp[] = [];
    for (const { square, piece: p } of position.pieces) {
      if (p.color !== by || !slides(p.kind)) continue;
      const [low, high] = p.kind === 'bishop' ? [4, 8] : p.kind === 'rook' ? [0, 4] : [0, 8];
      for (let direction = low; direction < high; direction++) {
        let front: Square | null = null;
        for (const target of ChessTables.rays[square][direction]) {
          const found = position.at(target);
          if (!found) continue;
          if (front === null) {
            if (found.color === by) break;
            front = target;
          } else {
            if (found.color !== by) result.push({ attacker: square, front, back: target });
            break;
          }
        }
      }
    }
    return result;
  },

  /** Whether a line-up is a skewer: the front piece is the king or worth more than the one behind it. */
  isSkewer(lineUp: ChessLineUp, position: ChessPosition): boolean {
    const front = position.at(lineUp.front);
    const back = position.at(lineUp.back);
    if (!front || !back || back.kind === 'king') return false;
    return front.kind === 'king' || kindValue(front.kind) > kindValue(back.kind);
  },

  /** Whether a line-up is a pin: the back piece is the king or worth more than the front one. */
  isPin(lineUp: ChessLineUp, position: ChessPosition): boolean {
    const front = position.at(lineUp.front);
    const back = position.at(lineUp.back);
    if (!front || !back || front.kind === 'king') return false;
    return back.kind === 'king' || kindValue(back.kind) > kindValue(front.kind);
  },

  /** The enemy pieces the piece on `square` attacks that are worth attacking: the king, a piece worth more than the attacker, or a piece nothing defends. Two or more of these make a fork. */
  forkTargets(square: Square, position: ChessPosition): Square[] {
    const attacker = position.at(square);
    if (!attacker) return [];
    return attackedEnemies(position, square).filter((target) => {
      const p = position.at(target);
      if (!p) return false;
      if (p.kind === 'king' || kindValue(p.kind) > kindValue(attacker.kind)) return true;
      return position.attackers(target, p.color).length === 0;
    });
  },

  /** The enemy pieces that the pieces other than the mover attack after the move and did not before: what a move uncovers. */
  discoveredTargets(m: ChessMove, position: ChessPosition): Square[] {
    const mover = position.at(m.from);
    if (!mover) return [];
    const after = position.applying(m);
    const result: Square[] = [];
    for (const { square, piece: p } of position.pieces) {
      if (p.color !== mover.color || square === m.from) continue;
      const before = new Set(attackedEnemies(position, square));
      for (const target of attackedEnemies(after, square)) if (!before.has(target) && target !== m.to) result.push(target);
    }
    return result.sort((a, b) => a - b);
  },

  /** The pieces of `color` that the other side wins by capturing them (the exchange helper), if it were its turn. */
  hangingPieces(color: ChessColor, position: ChessPosition, gain: (m: ChessMove, p: ChessPosition) => number): Square[] {
    const opponent = position.withSideToMove(opposite(color));
    const result = new Set<Square>();
    for (const m of opponent.legalMoves()) if (opponent.isCapture(m) && gain(m, opponent) > 0) result.add(m.to);
    return [...result].sort((a, b) => a - b);
  },
};
