import { describe, expect, it } from 'vitest';
import { dueDate, minimumEase, newState, next, relearnDelayMs } from '../src/lib/sm2';

describe('SM-2 (same cases as the Swift tests)', () => {
  it('grows the interval with successful reviews', () => {
    let state = next(newState, 'good');
    expect(state.intervalDays).toBe(1);
    state = next(state, 'good');
    expect(state.intervalDays).toBe(6);
    state = next(state, 'good');
    expect(state.intervalDays).toBe(15);
    expect(state.repetitions).toBe(3);
    expect(state.easeFactor).toBeCloseTo(2.5, 4);
  });

  it('resets progress on again and counts a lapse', () => {
    const state = next({ intervalDays: 15, easeFactor: 2.5, repetitions: 3, lapses: 0 }, 'again');
    expect(state).toMatchObject({ repetitions: 0, intervalDays: 0, lapses: 1 });
    expect(state.easeFactor).toBeCloseTo(1.7, 4);
  });

  it('never lets ease drop below the minimum', () => {
    let state = newState;
    for (let i = 0; i < 10; i++) state = next(state, 'again');
    expect(state.easeFactor).toBeCloseTo(minimumEase, 4);
  });

  it('lowers ease on hard and raises it on easy', () => {
    expect(next(newState, 'hard').easeFactor).toBeCloseTo(2.36, 4);
    expect(next(newState, 'easy').easeFactor).toBeCloseTo(2.6, 4);
  });

  it('brings a failed card back after ten minutes', () => {
    const now = new Date(1_800_000_000_000);
    const due = dueDate(next(newState, 'again'), now);
    expect(due.getTime() - now.getTime()).toBe(relearnDelayMs);
  });

  it('makes the due date the start of the target day', () => {
    const now = new Date(1_800_000_000_000);
    const due = dueDate({ intervalDays: 6, easeFactor: 2.5, repetitions: 2, lapses: 0 }, now);
    const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
    expect(due.getTime()).toBe(expected.getTime());
  });
});
