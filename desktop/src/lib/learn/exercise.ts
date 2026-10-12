// One step of a lesson and what the student gives for it. A port of Lernwerk/Services/Learn/Exercise.swift.

import { compact, evaluate, normalize } from '../answerCheck';
import type { ExerciseMedia } from './media';
import { NumberCheck } from './numberCheck';
import type { CompetenceLevel } from './skills/skill';

/** The kinds of exercise in a lesson, from easy to hard. */
export type ExerciseKind =
  | 'multipleChoice'
  | 'matchPairs'
  | 'wordBank'
  | 'typeAnswer'
  /** Chess: tap a piece, then its square; the answer is a move like "e2e4". */
  | 'chessMove'
  /** A piano keyboard: tap a key; the answer is its MIDI number as text, like "60" for the middle C. */
  | 'pianoKey';

export const ALL_EXERCISE_KINDS: readonly ExerciseKind[] = ['multipleChoice', 'matchPairs', 'wordBank', 'typeAnswer', 'chessMove', 'pianoKey'];

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

/** How a typed answer is compared with the right one. */
export type AnswerMode =
  /** `AnswerCheck`: words, typos, endings, umlauts. */
  | 'text'
  /** `NumberCheck`: the same number, whether typed as a fraction, a decimal fraction or a whole number. */
  | 'number'
  /** The same letters in the same order: forgives capitals, accents and punctuation, nothing else. For answers in a
   * language being learned, where "hermana" is not "hermano" and word order matters. */
  | 'exact';

export interface ExercisePair {
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
  /** Multiple choice: the back and three wrong answers. Word bank: the tiles. Pairs: the backs. Typing: none. */
  options: string[];
  /** Pairs only: the cards, in the order their fronts are shown. */
  pairs: ExercisePair[];
  /** What the feedback shows after a wrong answer. */
  solution: string;
  /** Something to look at or listen to above the question: a spoken word, a position, a staff, notes to play. */
  media: ExerciseMedia | null;
  /** Typing only: how the answer is compared. */
  mode: AnswerMode;
  /** A sentence of why, shown with the verdict ("Nach „weil“ steht das Verb am Ende."). Empty for none. */
  explanation: string;
  /** The skill this exercise shows evidence of, like "es.u03.vocab"; empty for exercises of cards. Set by
   * `lessonExercises`, never by the engines. */
  skill: string;
  /** What kind of knowing it asks for: seeing the answer, producing it, or using it. */
  level: CompetenceLevel | null;
  /** Help in steps, from a nudge to nearly the answer; asking for one means the answer no longer shows the skill alone. */
  hints: string[];
  /** A tag the course reads to explain a wrong answer (`feedback`); empty for none. */
  coach: string;
}

/** Memberwise initializer with Swift's defaults: only the nine core fields are required. */
export type LearnExerciseInit = Pick<
  LearnExercise,
  'id' | 'kind' | 'prompt' | 'correctAnswers' | 'solution'
> &
  Partial<LearnExercise>;

export function learnExercise(init: LearnExerciseInit): LearnExercise {
  return {
    id: init.id,
    kind: init.kind,
    cardKeys: init.cardKeys ?? [],
    prompt: init.prompt,
    correctAnswers: init.correctAnswers,
    options: init.options ?? [],
    pairs: init.pairs ?? [],
    solution: init.solution,
    media: init.media ?? null,
    mode: init.mode ?? 'text',
    explanation: init.explanation ?? '',
    skill: init.skill ?? '',
    level: init.level ?? null,
    hints: init.hints ?? [],
    coach: init.coach ?? '',
  };
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

export const LearnAnswer = {
  option: (value: string): LearnAnswer => ({ type: 'option', value }),
  typed: (value: string): LearnAnswer => ({ type: 'typed', value }),
  words: (value: string[]): LearnAnswer => ({ type: 'words', value }),
  pairs: (missed: Iterable<string> = []): LearnAnswer => ({ type: 'pairs', missed: new Set(missed) }),
  move: (value: string): LearnAnswer => ({ type: 'move', value }),
};

export type LearnVerdict = 'right' | 'wrong';

/** Word by word, ignoring case, umlaut spelling and punctuation. */
export function folded(text: string): string {
  return compact(normalize(text));
}

export function sameWords(given: readonly string[], expected: readonly string[]): boolean {
  return given.length === expected.length && given.every((word, i) => folded(word) === folded(expected[i]));
}

/** The cards answered wrong, empty when the answer is right. An exercise without cards (a course's) stands for
 * itself, so a wrong answer is never an empty set. */
export function missedKeys(exercise: LearnExercise, answer: LearnAnswer): Set<string> {
  const all = new Set(exercise.cardKeys.length === 0 ? [exercise.id] : exercise.cardKeys);
  const none = new Set<string>();
  switch (exercise.kind) {
    case 'multipleChoice':
    case 'pianoKey':
      if (answer.type === 'option') return exercise.correctAnswers.includes(answer.value) ? none : all;
      return all;
    case 'chessMove':
      if (answer.type === 'move') return exercise.correctAnswers.includes(answer.value) ? none : all;
      return all;
    case 'typeAnswer': {
      if (answer.type !== 'typed') return all;
      if (exercise.correctAnswers.length === 0) return all;
      const text = answer.value;
      if (exercise.mode === 'number') {
        return exercise.correctAnswers.some((expected) => NumberCheck.matches(text, expected)) ? none : all;
      }
      if (exercise.mode === 'exact') {
        const given = folded(text);
        return given !== '' && exercise.correctAnswers.some((expected) => folded(expected) === given) ? none : all;
      }
      return exercise.correctAnswers.some((expected) => evaluate(text, expected) === 'correct') ? none : all;
    }
    case 'wordBank':
      if (answer.type === 'words') return sameWords(answer.value, exercise.correctAnswers) ? none : all;
      return all;
    case 'matchPairs':
      if (answer.type === 'pairs') return new Set([...answer.missed].filter((key) => all.has(key)));
      return all;
  }
}

/** Pairs: whether a back belongs to the card with this key. */
export function isMatch(exercise: LearnExercise, key: string, back: string): boolean {
  const pair = exercise.pairs.find((p) => p.key === key);
  if (!pair) return false;
  return folded(pair.back) === folded(back);
}
