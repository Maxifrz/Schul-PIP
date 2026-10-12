// The exercise-building half of ChessKit.swift: the random draw of one node, the makers, boards, choices, pairs and
// the "find the move" exercise whose accepted moves the engine computes from a goal.

import { Exercises } from '../../exercises';
import { ExerciseBuilder } from '../../exerciseConstants';
import type { LearnExercise } from '../../exercise';
import type { BoardSpec, ExerciseMedia } from '../../media';
import { LearnRandom, randomElement, shuffle, shuffled } from '../../random';
import { COACH_PREFIX, coachHints } from '../coach';
import { acceptedMoves, answersFor, goalCoachCode, type ChessGoal } from '../goals';
import { EMPTY_FEN } from '../kit';
import { san } from '../notation';
import type { ChessPosition } from '../position';
import {
  ALL_SQUARES,
  square as squareAt,
  squareFile,
  squareName,
  squareOffset,
  squareRank,
  type ChessMove,
  type ChessSquare,
} from '../types';
import type { ChessSample } from './samples';

/** Makes one exercise from the state of the node being built. A maker returns null when the material cannot make a
 * sound exercise; the builder then tries the next entry of the plan. */
export type ChessMaker = (draw: ChessDraw) => LearnExercise | null;

/** The random numbers of one node and what it has used so far, so a lesson never shows the same position twice for
 * the same kind of question. */
export class ChessDraw {
  readonly random: LearnRandom;
  private readonly used = new Set<string>();

  constructor(seed: bigint) {
    this.random = new LearnRandom(seed);
  }

  /** A random element that was not drawn before under this key. When every element was drawn, any element: the
   * builder then drops the repeated exercise id and asks the next plan entry. */
  pick<T>(items: readonly T[], key: string, id: (item: T) => string): T | null {
    const fresh = items.filter((item) => !this.used.has(key + '|' + id(item)));
    const item = randomElement(fresh.length === 0 ? items : fresh, this.random);
    if (item === undefined) return null;
    this.used.add(key + '|' + id(item));
    return item;
  }

  pickSample(pool: readonly ChessSample[], key: string): ChessSample | null {
    return this.pick(pool, key, (sample) => sample.id);
  }

  pickSquare(key: string): ChessSquare | null {
    return this.pick(ALL_SQUARES, key, squareName);
  }

  /** `Bool.random(using:)`. */
  coin(): boolean {
    return ((this.random.next() >> 17n) & 1n) === 0n;
  }
}

/** A sentence for a word bank: the words in order and plausible wrong tiles. */
export interface ChessSentence {
  key: string;
  words: string[];
  extra: string[];
}

export function sentence(key: string, words: string[], extra: string[]): ChessSentence {
  return { key, words, extra };
}

/** A question with a fixed right answer and fixed wrong ones, for rules that no position can show. */
export interface ChessStatement {
  key: string;
  prompt: string;
  correct: string;
  wrong: string[];
  explanation: string;
}

export function statement(key: string, prompt: string, correct: string, wrong: string[], explanation: string): ChessStatement {
  return { key, prompt, correct, wrong, explanation };
}

// Boards

export function boardSpecOf(position: ChessPosition, marked: string[] = []): BoardSpec {
  return { fen: position.fen, flipped: position.sideToMove === 'black', marked };
}

export function boardMedia(position: ChessPosition, marked: string[] = []): ExerciseMedia {
  return { type: 'board', board: boardSpecOf(position, marked) };
}

/** A board of a FEN with white at the bottom. */
export function fenBoard(fen: string, marked: string[] = []): ExerciseMedia {
  return { type: 'board', board: { fen, flipped: false, marked } };
}

export function emptyBoard(marked: string[] = []): ExerciseMedia {
  return fenBoard(EMPTY_FEN, marked);
}

// Wrong answers

/** Wrong square names a student could pick by mixing up the direction of counting, most likely mistakes first. */
export function squareDistractors(sq: ChessSquare, random: LearnRandom): string[] {
  const file = squareFile(sq);
  const rank = squareRank(sq);
  const ordered: (ChessSquare | null)[] = [
    squareAt(7 - file, rank),
    squareAt(file, 7 - rank),
    squareAt(rank, file),
    squareAt(7 - file, 7 - rank),
  ];
  const near: (ChessSquare | null)[] = [squareOffset(sq, 1, 0), squareOffset(sq, -1, 0), squareOffset(sq, 0, 1), squareOffset(sq, 0, -1)];
  shuffle(near, random);
  ordered.push(...near);
  const seen = new Set<ChessSquare>([sq]);
  const result: string[] = [];
  for (const candidate of ordered) {
    if (candidate !== null && !seen.has(candidate)) {
      seen.add(candidate);
      result.push(squareName(candidate));
    }
  }
  return result;
}

/** Wrong whole numbers around the right one: the likely mistakes first, then neighbours. */
export function numberWrongs(correct: number, likely: number[], random: LearnRandom, minimum = 0): string[] {
  const seen = new Set<number>([correct]);
  const result: number[] = [];
  const add = (n: number): void => {
    if (n >= minimum && !seen.has(n)) {
      seen.add(n);
      result.push(n);
    }
  };
  likely.forEach(add);
  const near = [correct + 1, correct - 1, correct + 2, correct - 2, correct + 3, correct - 3, correct + 4];
  shuffle(near, random);
  near.forEach(add);
  return result.map(String);
}

// Exercises

/** The solution as the feedback shows it: "Sf3 (g1–f3)", up to three accepted moves joined with "oder". */
export function solutionText(moves: readonly ChessMove[], position: ChessPosition, withSquares: boolean, limit = 3): string {
  const texts: string[] = [];
  for (const m of moves) {
    const text = san(m, position);
    if (text === null) continue;
    texts.push(withSquares ? `${text} (${squareName(m.from)}–${squareName(m.to)})` : text);
  }
  const shown = texts.slice(0, limit);
  if (texts.length > limit) shown.push('…');
  return shown.join(' oder ');
}

/** A "find the move" exercise whose accepted moves the engine computes from the goal. */
export function moveExercise(o: {
  id: string;
  prompt: string;
  position: ChessPosition;
  goal: ChessGoal;
  marked?: string[];
  explanation: string;
  withSquares?: boolean;
}): LearnExercise | null {
  const moves = acceptedMoves(o.goal, o.position);
  if (moves.length === 0) return null;
  const answers = answersFor(moves);
  if (answers === null) return null;
  const exercise = Exercises.move({
    id: o.id,
    prompt: o.prompt,
    board: boardSpecOf(o.position, o.marked ?? []),
    accepted: answers,
    solution: solutionText(moves, o.position, o.withSquares ?? true),
    explanation: o.explanation,
  });
  if (!exercise) return null;
  exercise.hints = coachHints(o.goal, moves, o.position);
  exercise.coach = COACH_PREFIX + goalCoachCode(o.goal);
  return exercise;
}

export function choice(
  o: { id: string; prompt: string; correct: string; wrong: string[]; explanation?: string; media?: ExerciseMedia | null; solution?: string | null },
  draw: ChessDraw,
): LearnExercise | null {
  return Exercises.choice(
    { id: o.id, prompt: o.prompt, correct: o.correct, wrong: o.wrong, solution: o.solution ?? null, explanation: o.explanation ?? '', media: o.media ?? null },
    draw.random,
  );
}

/** Ja or Nein. */
export function yesNo(
  o: { id: string; prompt: string; answer: boolean; explanation: string; media?: ExerciseMedia | null },
  draw: ChessDraw,
): LearnExercise | null {
  return choice(
    { id: o.id, prompt: o.prompt, correct: o.answer ? 'Ja' : 'Nein', wrong: [o.answer ? 'Nein' : 'Ja'], explanation: o.explanation, media: o.media },
    draw,
  );
}

/** A whole number to type. */
export function number(o: { id: string; prompt: string; answer: number; explanation: string; media?: ExerciseMedia | null }): LearnExercise | null {
  return Exercises.typed({ id: o.id, prompt: o.prompt, answer: String(o.answer), mode: 'number', explanation: o.explanation, media: o.media ?? null });
}

/** A square name to type; capitals and spaces do not matter, a different square does. */
export function typedSquare(o: { id: string; prompt: string; answer: string; explanation: string; media?: ExerciseMedia | null }): LearnExercise | null {
  return Exercises.typed({ id: o.id, prompt: o.prompt, answer: o.answer, mode: 'exact', explanation: o.explanation, media: o.media ?? null });
}

export function bank(o: { id: string; sentence: ChessSentence; prompt?: string }, draw: ChessDraw): LearnExercise | null {
  return Exercises.bank(
    { id: o.id, prompt: o.prompt ?? 'Setze den Satz zusammen.', words: o.sentence.words, extra: o.sentence.extra },
    draw.random,
  );
}

/** A word bank from a pool of sentences. */
export function sentenceMaker(topic: string, sentences: readonly ChessSentence[]): ChessMaker {
  return (draw) => {
    const picked = draw.pick(sentences, topic, (s) => s.key);
    if (!picked) return null;
    return bank({ id: `${topic}.${picked.key}`, sentence: picked }, draw);
  };
}

/** A choice from a pool of fixed statements. */
export function statementMaker(topic: string, statements: readonly ChessStatement[]): ChessMaker {
  return (draw) => {
    const picked = draw.pick(statements, topic, (s) => s.key);
    if (!picked) return null;
    return choice(
      { id: `${topic}.${picked.key}`, prompt: picked.prompt, correct: picked.correct, wrong: picked.wrong, explanation: picked.explanation },
      draw,
    );
  };
}

export interface PairCandidate {
  key: string;
  front: string;
  back: string;
}

/** Four pairs out of the candidates, which may be more than four. */
export function pairs(o: { id: string; prompt: string; from: PairCandidate[] }, draw: ChessDraw): LearnExercise | null {
  const items = shuffled(o.from, draw.random).slice(0, ExerciseBuilder.pairCount);
  return Exercises.pairs({ id: o.id, prompt: o.prompt, items }, draw.random);
}
