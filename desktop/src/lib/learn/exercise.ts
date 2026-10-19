import * as AnswerCheck from '../answerCheck';
import type { ExerciseMedia } from './media';
import { NumberCheck } from './rational';

/** The kinds of exercise in a lesson, from easy to hard. */
export type ExerciseKind = 'multipleChoice' | 'matchPairs' | 'wordBank' | 'typeAnswer' | 'chessMove' | 'pianoKey';

export const exerciseKinds: ExerciseKind[] = ['multipleChoice', 'matchPairs', 'wordBank', 'typeAnswer', 'chessMove', 'pianoKey'];

/** Lessons go from recognising an answer to recalling it. */
export function difficulty(kind: ExerciseKind): number {
  switch (kind) {
    case 'multipleChoice':
    case 'pianoKey':
      return 0;
    case 'matchPairs':
      return 1;
    case 'chessMove':
    case 'wordBank':
      return 2;
    case 'typeAnswer':
      return 3;
  }
}

/** How a typed answer is compared: words with typos (text), numbers by value, or exactly (letters in order, forgiving only capitals, accents and punctuation). */
export type AnswerMode = 'text' | 'number' | 'exact';

export type CompetenceLevel = 'recognise' | 'recall' | 'apply';
export const competenceLevels: CompetenceLevel[] = ['recognise', 'recall', 'apply'];
export const levelOrder = (level: CompetenceLevel): number => competenceLevels.indexOf(level);
/** Points for an answer right on the first try without help. */
export const levelWeight = (level: CompetenceLevel): number => (level === 'recognise' ? 1 : 2);
export const levelTitle = (level: CompetenceLevel): string => (level === 'recognise' ? 'Wiedererkennen' : level === 'recall' ? 'Abrufen' : 'Anwenden');

/** The level an exercise has when the course does not say otherwise. */
export function standardLevel(kind: ExerciseKind): CompetenceLevel {
  switch (kind) {
    case 'multipleChoice':
    case 'matchPairs':
    case 'pianoKey':
      return 'recognise';
    case 'typeAnswer':
      return 'recall';
    case 'wordBank':
    case 'chessMove':
      return 'apply';
  }
}

export interface Pair {
  key: string;
  front: string;
  back: string;
}

/** One step of a lesson. */
export interface LearnExercise {
  /** Unique within its lesson. */
  id: string;
  kind: ExerciseKind;
  cardKeys: string[];
  /** The question; for pairs the instruction. */
  prompt: string;
  /** Multiple choice and typing: the back. Word bank: its words in order. Pairs: the backs in the order of `pairs`. */
  correctAnswers: string[];
  /** Multiple choice: the back and wrong answers. Word bank: the tiles. Pairs: the backs. Typing: none. */
  options: string[];
  /** Pairs only: the cards, in the order their fronts are shown. */
  pairs: Pair[];
  /** What the feedback shows after a wrong answer. */
  solution: string;
  /** Something to look at or listen to above the question. */
  media?: ExerciseMedia;
  /** Typing only: how the answer is compared. */
  mode: AnswerMode;
  /** A sentence of why, shown with the verdict. Empty for none. */
  explanation: string;
  /** The skill this exercise shows evidence of, like "es.u03.vocab"; empty for exercises of cards. */
  skill: string;
  level?: CompetenceLevel;
  /** Help in steps, from a nudge to nearly the answer. */
  hints: string[];
  /** A tag the course reads to explain a wrong answer; empty for none. */
  coach: string;
}

export function exercise(parts: Pick<LearnExercise, 'id' | 'kind' | 'prompt' | 'correctAnswers' | 'solution'> & Partial<LearnExercise>): LearnExercise {
  return { cardKeys: [], options: [], pairs: [], mode: 'text', explanation: '', skill: '', hints: [], coach: '', ...parts };
}

/** What the student gives for an exercise. */
export type LearnAnswer =
  | { type: 'option'; value: string }
  | { type: 'typed'; value: string }
  | { type: 'words'; value: string[] }
  /** The cards whose front was paired with a wrong back at least once. */
  | { type: 'pairs'; missed: Set<string> }
  /** A chess move in coordinate notation, "e2e4". */
  | { type: 'move'; value: string };

export type LearnVerdict = 'right' | 'wrong';

/** Word by word, ignoring case, umlaut spelling and punctuation. */
export const folded = (text: string): string => AnswerCheck.compact(AnswerCheck.normalize(text));

export function sameWords(given: string[], expected: string[]): boolean {
  return given.length === expected.length && given.every((word, i) => folded(word) === folded(expected[i]));
}

/** The cards answered wrong, empty when the answer is right. An exercise without cards stands for itself, so a wrong answer is never an empty set. */
export function missedKeys(item: LearnExercise, answer: LearnAnswer): Set<string> {
  const all = new Set(item.cardKeys.length === 0 ? [item.id] : item.cardKeys);
  const none = new Set<string>();
  if ((item.kind === 'multipleChoice' || item.kind === 'pianoKey') && answer.type === 'option') {
    return item.correctAnswers.includes(answer.value) ? none : all;
  }
  if (item.kind === 'chessMove' && answer.type === 'move') return item.correctAnswers.includes(answer.value) ? none : all;
  if (item.kind === 'typeAnswer' && answer.type === 'typed') {
    if (item.correctAnswers.length === 0) return all;
    if (item.mode === 'number') return item.correctAnswers.some((c) => NumberCheck.matches(answer.value, c)) ? none : all;
    if (item.mode === 'exact') {
      const given = folded(answer.value);
      return given !== '' && item.correctAnswers.some((c) => folded(c) === given) ? none : all;
    }
    return item.correctAnswers.some((c) => AnswerCheck.evaluate(answer.value, c) === 'correct') ? none : all;
  }
  if (item.kind === 'wordBank' && answer.type === 'words') return sameWords(answer.value, item.correctAnswers) ? none : all;
  if (item.kind === 'matchPairs' && answer.type === 'pairs') return new Set([...answer.missed].filter((key) => all.has(key)));
  return all;
}

/** Pairs: whether a back belongs to the card with this key. */
export function isMatch(item: LearnExercise, key: string, back: string): boolean {
  const pair = item.pairs.find((p) => p.key === key);
  return !!pair && folded(pair.back) === folded(back);
}
