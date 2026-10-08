// SM-2 scheduling; a failed card comes back after a short relearning delay instead of the next day.
// A port of Lernwerk/Services/Review/SpacedRepetition.swift.

export type Grade = 'again' | 'hard' | 'good' | 'easy';

const quality: Record<Grade, number> = { again: 0, hard: 3, good: 4, easy: 5 };

export interface SchedulingState {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
}

export const initialEase = 2.5;
export const minimumEase = 1.3;
export const relearnDelayMs = 10 * 60 * 1000;
export const newState: SchedulingState = { intervalDays: 0, easeFactor: initialEase, repetitions: 0, lapses: 0 };

export function next(state: SchedulingState, grade: Grade): SchedulingState {
  const result = { ...state };
  const q = quality[grade];
  const easeChange = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  result.easeFactor = Math.max(minimumEase, state.easeFactor + easeChange);
  if (grade === 'again') {
    result.repetitions = 0;
    result.intervalDays = 0;
    result.lapses += 1;
    return result;
  }
  result.repetitions += 1;
  if (result.repetitions === 1) result.intervalDays = 1;
  else if (result.repetitions === 2) result.intervalDays = 6;
  else result.intervalDays = Math.max(1, Math.round(state.intervalDays * result.easeFactor));
  return result;
}

/** When the card is due again: ten minutes after a failure, else the start of the day the interval leads to. */
export function dueDate(state: SchedulingState, reviewedAt: Date): Date {
  if (state.intervalDays <= 0) return new Date(reviewedAt.getTime() + relearnDelayMs);
  const due = new Date(reviewedAt.getFullYear(), reviewedAt.getMonth(), reviewedAt.getDate());
  due.setDate(due.getDate() + state.intervalDays);
  return due;
}
