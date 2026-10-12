// What the student has to find. The engine turns a goal and a position into the accepted moves, so a course never
// states an answer by hand. Port of ChessGoals.swift (ChessMoveFilter, ChessGoal, ChessGoals, ChessGoalCache).

import type { ChessCastleSide } from './analysis';
import type { ChessPosition } from './position';
import { ChessExchange, bestMoves } from './search';
import {
  QUEEN,
  moveUci,
  oppositeColor,
  squareFile,
  squareName,
  type ChessMove,
  type ChessPieceKind,
  type ChessSquare,
} from './types';

/** A description of the legal moves an exercise asks for. All fields that are set must hold at once. */
export interface ChessMoveFilter {
  from?: ChessSquare | null;
  to?: ChessSquare | null;
  /** The kind of the piece that moves. */
  kind?: ChessPieceKind | null;
  capture?: boolean | null;
  promotion?: boolean | null;
  /** The piece a promoting pawn becomes. */
  promotionTo?: ChessPieceKind | null;
  enPassant?: boolean | null;
  castling?: ChessCastleSide | null;
  check?: boolean | null;
  mate?: boolean | null;
}

export function filterMatches(filter: ChessMoveFilter, m: ChessMove, position: ChessPosition): boolean {
  if (filter.from != null && m.from !== filter.from) return false;
  if (filter.to != null && m.to !== filter.to) return false;
  if (filter.kind != null && position.pieceAt(m.from)?.kind !== filter.kind) return false;
  if (filter.capture != null && position.isCapture(m) !== filter.capture) return false;
  if (filter.promotion != null && (m.promotion !== undefined) !== filter.promotion) return false;
  if (filter.promotionTo != null && m.promotion !== filter.promotionTo) return false;
  if (filter.enPassant != null && position.isEnPassant(m) !== filter.enPassant) return false;
  if (filter.castling != null) {
    if (!position.isCastling(m) || (squareFile(m.to) === 6) !== (filter.castling === 'kingside')) return false;
  }
  if (filter.check != null || filter.mate != null) {
    const after = position.applying(m);
    if (filter.check != null && after.isCheck !== filter.check) return false;
    if (filter.mate != null && after.isCheckmate !== filter.mate) return false;
  }
  return true;
}

export type ChessEscape = 'any' | 'kingMoves' | 'captureChecker' | 'interpose';

export type ChessGoal =
  /** Every legal move that fits the filter. */
  | { type: 'moves'; filter: ChessMoveFilter }
  /** Every legal move that checkmates. */
  | { type: 'mateInOne' }
  /** Moves out of check by the king, by capturing the checking piece, or by putting a piece in between. */
  | { type: 'escape'; kind: ChessEscape }
  /** The captures that win the most by the exchange helper. */
  | { type: 'bestCapture' }
  /** The moves with the best result of the material search to this depth (half moves). */
  | { type: 'bestMove'; depth: number };

/** The goal as the exercise carries it for the coach. */
export function goalCoachCode(goal: ChessGoal): string {
  switch (goal.type) {
    case 'moves': return 'moves';
    case 'mateInOne': return 'mate';
    case 'escape':
      switch (goal.kind) {
        case 'any': return 'escape.any';
        case 'kingMoves': return 'escape.king';
        case 'captureChecker': return 'escape.capture';
        case 'interpose': return 'escape.block';
      }
      return 'escape.any';
    case 'bestCapture': return 'capture';
    case 'bestMove': return 'best';
  }
}

/** A canonical string for a goal (the filter's fields in a fixed order), used as cache key. */
export function goalKey(goal: ChessGoal): string {
  if (goal.type !== 'moves') return JSON.stringify(goal);
  const f = goal.filter;
  const fields = [f.from, f.to, f.kind, f.capture, f.promotion, f.promotionTo, f.enPassant, f.castling, f.check, f.mate];
  return 'moves:' + JSON.stringify(fields.map((value) => (value === undefined ? null : value)));
}

const goalCache = new Map<string, ChessMove[]>();

/** Forgets the remembered results (tests only). */
export function clearGoalCache(): void {
  goalCache.clear();
}

function compute(goal: ChessGoal, position: ChessPosition): ChessMove[] {
  const legal = position.legalMoves();
  switch (goal.type) {
    case 'moves':
      return legal.filter((m) => filterMatches(goal.filter, m, position));
    case 'mateInOne':
      return legal.filter((m) => position.applying(m).isCheckmate);
    case 'escape': {
      const king = position.kingSquare(position.sideToMove);
      if (!position.isCheck || king === null) return [];
      const checkers = new Set(position.attackers(king, oppositeColor(position.sideToMove)));
      switch (goal.kind) {
        case 'any': return legal;
        case 'kingMoves': return legal.filter((m) => m.from === king);
        case 'captureChecker': return legal.filter((m) => checkers.has(m.to) && position.isCapture(m));
        case 'interpose': return legal.filter((m) => m.from !== king && !(checkers.has(m.to) && position.isCapture(m)));
      }
      return [];
    }
    case 'bestCapture':
      return ChessExchange.bestCaptures(position).moves;
    case 'bestMove':
      return bestMoves(position, goal.depth).moves;
  }
}

/** The legal moves that reach the goal, in the generator's order. Remembered per position and goal. */
export function acceptedMoves(goal: ChessGoal, position: ChessPosition): ChessMove[] {
  const key = position.fen + '|' + goalKey(goal);
  const known = goalCache.get(key);
  if (known) return known;
  const result = compute(goal, position);
  goalCache.set(key, result);
  return result;
}

/**
 * The answers the app can receive for these moves: coordinate notation, and for a queen promotion also the four
 * characters a tap on the piece and its target square gives. null if some accepted move is an under-promotion without
 * the queen promotion of the same squares beside it, which the app could not tell apart.
 */
export function answersFor(moves: readonly ChessMove[]): string[] | null {
  const result: string[] = [];
  for (const m of moves) {
    if (m.promotion === undefined) {
      result.push(moveUci(m));
      continue;
    }
    const queenAccepted = moves.some((other) => other.from === m.from && other.to === m.to && other.promotion === QUEEN);
    if (!queenAccepted) return null;
    result.push(moveUci(m));
    if (m.promotion === QUEEN) result.push(squareName(m.from) + squareName(m.to));
  }
  return result.filter((answer, index) => result.indexOf(answer) === index);
}
