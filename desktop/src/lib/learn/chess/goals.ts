import { ChessMove, PieceKind, Square, Sq, moveUci, sameMove } from './types';
import { ChessPosition } from './position';
import { ChessNotation } from './notation';
import { ChessExchange, ChessSearch } from './search';
import type { ChessCastleSide } from './analysis';

export const castleGermanName = (side: ChessCastleSide): string => (side === 'kingside' ? 'kurze' : 'lange');
export const castleNotation = (side: ChessCastleSide): string => (side === 'kingside' ? 'O-O' : 'O-O-O');

/** A description of the legal moves an exercise asks for. All fields that are set must hold at once. */
export interface ChessMoveFilter {
  from?: Square;
  to?: Square;
  /** The kind of the piece that moves. */
  kind?: PieceKind;
  capture?: boolean;
  promotion?: boolean;
  /** The piece a promoting pawn becomes. */
  promotionTo?: PieceKind;
  enPassant?: boolean;
  castling?: ChessCastleSide;
  check?: boolean;
  mate?: boolean;
}

export function filterMatches(filter: ChessMoveFilter, m: ChessMove, position: ChessPosition): boolean {
  if (filter.from !== undefined && m.from !== filter.from) return false;
  if (filter.to !== undefined && m.to !== filter.to) return false;
  if (filter.kind !== undefined && position.at(m.from)?.kind !== filter.kind) return false;
  if (filter.capture !== undefined && position.isCapture(m) !== filter.capture) return false;
  if (filter.promotion !== undefined && (m.promotion !== undefined) !== filter.promotion) return false;
  if (filter.promotionTo !== undefined && m.promotion !== filter.promotionTo) return false;
  if (filter.enPassant !== undefined && position.isEnPassant(m) !== filter.enPassant) return false;
  if (filter.castling !== undefined) {
    if (!position.isCastling(m) || (Sq.file(m.to) === 6) !== (filter.castling === 'kingside')) return false;
  }
  if (filter.check !== undefined || filter.mate !== undefined) {
    const after = position.applying(m);
    if (filter.check !== undefined && after.isCheck !== filter.check) return false;
    if (filter.mate !== undefined && after.isCheckmate !== filter.mate) return false;
  }
  return true;
}

export type ChessEscape = 'any' | 'kingMoves' | 'captureChecker' | 'interpose';

/** What the student has to find. The engine turns a goal and a position into the accepted moves, so a course never states an answer by hand. */
export type ChessGoal =
  /** Every legal move that fits the filter. */
  | { k: 'moves'; filter: ChessMoveFilter }
  /** Every legal move that checkmates. */
  | { k: 'mateInOne' }
  /** Moves out of check by the king, by capturing the checking piece, or by putting a piece in between. */
  | { k: 'escape'; kind: ChessEscape }
  /** The captures that win the most by the exchange helper. */
  | { k: 'bestCapture' }
  /** The moves with the best result of the material search to this depth (half moves). */
  | { k: 'bestMove'; depth: number };

export const moves = (filter: ChessMoveFilter = {}): ChessGoal => ({ k: 'moves', filter });
export const mateInOne: ChessGoal = { k: 'mateInOne' };
export const escape = (kind: ChessEscape): ChessGoal => ({ k: 'escape', kind });
export const bestCapture: ChessGoal = { k: 'bestCapture' };
export const bestMove = (depth: number): ChessGoal => ({ k: 'bestMove', depth });

const cache = new Map<string, ChessMove[]>();

export const ChessGoals = {
  /** The legal moves that reach the goal, in the generator's order. */
  accepted(goal: ChessGoal, position: ChessPosition): ChessMove[] {
    const key = `${position.fen}|${JSON.stringify(goal)}`;
    const known = cache.get(key);
    if (known) return known;
    const result = compute(goal, position);
    cache.set(key, result);
    return result;
  },

  /** The answers the app can receive for these moves: coordinate notation, and for a queen promotion also the four characters a tap on the piece and its target square gives. null if some accepted move is an under-promotion without the queen promotion of the same squares beside it, which the app could not tell apart. */
  answers(list: ChessMove[]): string[] | null {
    const result: string[] = [];
    for (const m of list) {
      if (!m.promotion) {
        result.push(moveUci(m));
        continue;
      }
      const queenAccepted = list.some((o) => o.from === m.from && o.to === m.to && o.promotion === 'queen');
      if (!queenAccepted) return null;
      result.push(moveUci(m));
      if (m.promotion === 'queen') result.push(Sq.name(m.from) + Sq.name(m.to));
    }
    return [...new Set(result)];
  },

  /** The accepted moves in notation for the feedback: "Dh5#", at most `limit` of them, joined with "oder". */
  solutionText(list: ChessMove[], position: ChessPosition, limit = 3): string {
    const texts = list.map((m) => ChessNotation.san(m, position)).filter((t): t is string => t !== null);
    const shown = texts.slice(0, limit);
    if (texts.length > limit) shown.push('…');
    return shown.join(' oder ');
  },
};

function compute(goal: ChessGoal, position: ChessPosition): ChessMove[] {
  const legal = position.legalMoves();
  switch (goal.k) {
    case 'moves': return legal.filter((m) => filterMatches(goal.filter, m, position));
    case 'mateInOne': return legal.filter((m) => position.applying(m).isCheckmate);
    case 'escape': {
      const king = position.kingSquare(position.sideToMove);
      if (!position.isCheck || king === null) return [];
      const checkers = new Set(position.attackers(king, position.sideToMove === 'white' ? 'black' : 'white'));
      switch (goal.kind) {
        case 'any': return legal;
        case 'kingMoves': return legal.filter((m) => m.from === king);
        case 'captureChecker': return legal.filter((m) => checkers.has(m.to) && position.isCapture(m));
        default: return legal.filter((m) => m.from !== king && !(checkers.has(m.to) && position.isCapture(m)));
      }
    }
    case 'bestCapture': return ChessExchange.bestCaptures(position).moves;
    case 'bestMove': return ChessSearch.bestMoves(position, goal.depth).moves;
  }
}

void sameMove;
