// What an exercise shows or plays above its question. The values are plain data; the screens draw and play them.
// A port of Lernwerk/Services/Learn/ExerciseMedia.swift.

import type { StaffSpec } from './music';

/** A chess position to show. The pieces come from the FEN's first field; the side to move is its second. */
export interface BoardSpec {
  fen: string;
  /** White's side is at the bottom unless this is set. */
  flipped: boolean;
  /** Squares to mark, like "e4". */
  marked: string[];
}

export function boardSpec(fen: string, options: { flipped?: boolean; marked?: string[] } = {}): BoardSpec {
  return { fen, flipped: options.flipped ?? false, marked: options.marked ?? [] };
}

/** Notes to play: one after the other, or all at once as a chord. MIDI numbers, 60 is the middle C. */
export interface ToneSpec {
  midi: number[];
  together: boolean;
}

export function toneSpec(midi: number[], together = false): ToneSpec {
  return { midi, together };
}

export type ExerciseMedia =
  /** A word or sentence to hear by tapping a button; `language` is a BCP 47 tag like "es-ES". No tag, no button. */
  | { type: 'speech'; text: string; language: string }
  /** A chess position. */
  | { type: 'board'; board: BoardSpec }
  /** Notes on a staff. */
  | { type: 'staff'; staff: StaffSpec }
  /** Notes to hear. */
  | { type: 'tones'; tones: ToneSpec };

export const ExerciseMedia = {
  speech: (text: string, language: string): ExerciseMedia => ({ type: 'speech', text, language }),
  board: (board: BoardSpec): ExerciseMedia => ({ type: 'board', board }),
  staff: (staff: StaffSpec): ExerciseMedia => ({ type: 'staff', staff }),
  tones: (tones: ToneSpec): ExerciseMedia => ({ type: 'tones', tones }),
};
