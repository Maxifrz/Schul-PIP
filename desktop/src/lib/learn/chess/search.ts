// A small material-only search the course uses to prove that a "best move" really is best: negamax with alpha-beta
// pruning and a capture search at the leaves. Values are the exchange values 1, 3, 3, 5, 9; a mate is worth 1000
// minus the number of half moves to it. Deterministic, no randomness, no clock. Port of ChessSearch.swift.

import type { ChessPosition } from './position';
import { kindValue, QUEEN, type ChessMove, type ChessSquare } from './types';

export const MATE_SCORE = 1000;
const INFINITY = 100_000;
/** How many half moves the capture search may go beyond the nominal depth. */
const CAPTURE_DEPTH = 8;

/** The material balance for the side to move after a position has been searched `depth` half moves. */
export function valueOf(position: ChessPosition, depth: number): number {
  return search(position, depth, -INFINITY, INFINITY, 0);
}

/** Every legal move with its score for the side to move, best first; equal scores keep the generator's order. */
export function scoredMoves(position: ChessPosition, depth: number): { move: ChessMove; score: number }[] {
  const moves = ordered(position.legalMoves(), position);
  const scored = moves.map((m) => ({
    move: m,
    score: 0 - search(position.applying(m), Math.max(0, depth - 1), -INFINITY, INFINITY, 1),
  }));
  return scored.sort((a, b) => b.score - a.score);
}

/** All moves that reach the best score of the search, and that score. Empty when there is no legal move. */
export function bestMoves(position: ChessPosition, depth: number): { moves: ChessMove[]; score: number } {
  const moves = ordered(position.legalMoves(), position);
  if (moves.length === 0) return { moves: [], score: position.isCheck ? -MATE_SCORE : 0 };
  // First find the best score with a normal alpha-beta window, then keep the moves that reach it.
  let best = -INFINITY;
  for (const m of moves) {
    const score = 0 - search(position.applying(m), Math.max(0, depth - 1), -INFINITY, -best, 1);
    best = Math.max(best, score);
  }
  const good: ChessMove[] = [];
  for (const m of moves) {
    // A window of one point around the best score tells whether this move reaches it.
    const score = 0 - search(position.applying(m), Math.max(0, depth - 1), -best - 1, -best + 1, 1);
    if (score >= best) good.push(m);
  }
  return { moves: good, score: best };
}

function search(position: ChessPosition, depth: number, alphaIn: number, beta: number, ply: number): number {
  const moves = position.legalMoves();
  if (moves.length === 0) return position.isCheck ? -(MATE_SCORE - ply) : 0;
  if (position.hasInsufficientMaterial) return 0;
  if (depth <= 0) return quiesce(position, moves, alphaIn, beta, ply, CAPTURE_DEPTH);
  let alpha = alphaIn;
  let best = -INFINITY;
  for (const m of ordered(moves, position)) {
    const score = 0 - search(position.applying(m), depth - 1, -beta, -alpha, ply + 1);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Captures (and promotions) only, so a score is never taken in the middle of an exchange. In check every move is
 * tried, within the budget.
 */
function quiesce(
  position: ChessPosition, moves: readonly ChessMove[], alphaIn: number, beta: number, ply: number, budget: number,
): number {
  let alpha = alphaIn;
  const stand = position.materialBalanceForSideToMove;
  const inCheck = position.isCheck;
  let best: number;
  if (inCheck && budget > 0) {
    best = -INFINITY;
  } else {
    if (budget <= 0 || stand >= beta) return stand;
    best = stand;
    if (stand > alpha) alpha = stand;
  }
  for (const m of ordered(moves, position)) {
    if ((!inCheck || budget <= 0) && !position.isCapture(m) && m.promotion !== QUEEN) continue;
    const next = position.applying(m);
    const replies = next.legalMoves();
    let score: number;
    if (replies.length === 0) {
      score = next.isCheck ? MATE_SCORE - ply - 1 : 0;
    } else if (next.hasInsufficientMaterial) {
      score = 0;
    } else {
      score = 0 - quiesce(next, replies, -beta, -alpha, ply + 1, budget - 1);
    }
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Captures of valuable pieces by cheap ones first, then promotions and checks to the back; stable otherwise. */
function ordered(moves: readonly ChessMove[], position: ChessPosition): ChessMove[] {
  const keyed = moves.map((m, offset) => {
    let key = 0;
    const captured = position.capturedPiece(m);
    const mover = position.pieceAt(m.from);
    if (captured && mover) key = 10 + kindValue(captured.kind) * 10 - kindValue(mover.kind);
    if (m.promotion === QUEEN) key += 50;
    return { key, offset, move: m };
  });
  return keyed.sort((a, b) => (a.key !== b.key ? b.key - a.key : a.offset - b.offset)).map((entry) => entry.move);
}

/**
 * What a capture on one square wins once both sides keep taking on it for as long as that pays. Only the moves onto
 * that square count; every other idea (a threat elsewhere, a check) is outside this helper.
 */
export const ChessExchange = {
  /**
   * The net material the side to move gains by playing the capture, with the best recaptures on the square counted.
   * A pawn that promotes while capturing gains the promoted piece's value minus the pawn's. 0 for a non-capture.
   */
  gain(m: ChessMove, position: ChessPosition): number {
    const captured = position.capturedPiece(m);
    if (!captured) return 0;
    let gain = kindValue(captured.kind);
    if (m.promotion !== undefined) gain += kindValue(m.promotion) - 1;
    const after = position.applying(m);
    return gain - ChessExchange.bestRecapture(after, m.to);
  },

  /** The most the side to move wins by capturing on `square`, or 0 when it is better not to. */
  bestRecapture(position: ChessPosition, sq: ChessSquare): number {
    let best = 0;
    for (const reply of position.legalMoves()) {
      if (reply.to === sq && position.isCapture(reply)) best = Math.max(best, ChessExchange.gain(reply, position));
    }
    return best;
  },

  /** Every capture of the side to move with its gain, best first. */
  captures(position: ChessPosition): { move: ChessMove; gain: number }[] {
    return position
      .legalMoves()
      .filter((m) => position.isCapture(m))
      .map((m) => ({ move: m, gain: ChessExchange.gain(m, position) }))
      .sort((a, b) => b.gain - a.gain);
  },

  /** The captures that win the most, with that gain; empty when no capture wins anything. */
  bestCaptures(position: ChessPosition): { moves: ChessMove[]; gain: number } {
    const all = ChessExchange.captures(position);
    if (all.length === 0 || all[0].gain <= 0) return { moves: [], gain: 0 };
    const top = all[0].gain;
    return { moves: all.filter((entry) => entry.gain === top).map((entry) => entry.move), gain: top };
  },
};
