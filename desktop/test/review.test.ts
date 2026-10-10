import { describe, expect, it } from 'vitest';
import { Card, ReviewFlow, applyGrade, dueCards, newCard } from '../src/lib/review';

function setup(cards: Card[]) {
  let list = cards;
  const now = 1_800_000_000_000;
  const flow = new ReviewFlow(() => list, (card) => (list = list.map((c) => (c.id === card.id ? card : c))), () => now);
  return { flow, cards: () => list, now };
}

describe('review flow', () => {
  it('grades a right answer good and moves the card to the next day', () => {
    const { flow, cards, now } = setup([newCard('Hauptstadt von Deutschland?', 'Berlin', 1_700_000_000_000, 'a')]);
    flow.answer = 'berlin';
    flow.check();
    expect(flow.verdict).toBe('correct');
    flow.next();
    expect(flow.reviewedThisSession).toBe(1);
    expect(cards()[0].repetitions).toBe(1);
    expect(cards()[0].dueAt).toBeGreaterThan(now);
    expect(flow.current).toBeNull();
  });

  it('grades a wrong answer again, brings it back in ten minutes and lets the student look at the solution', () => {
    const { flow, cards, now } = setup([newCard('f', 'Berlin', 1_700_000_000_000, 'a')]);
    flow.answer = 'Paris';
    flow.check();
    expect(flow.verdict).toBe('wrong');
    flow.showSolution();
    expect(flow.solutionShown).toBe(true);
    flow.next();
    expect(cards()[0].lapses).toBe(1);
    expect(cards()[0].dueAt - now).toBe(10 * 60 * 1000);
    expect(flow.reviewedThisSession).toBe(0);
  });

  it('keeps the card on screen while the verdict shows and grades only once when it is repeated', () => {
    const { flow, cards } = setup([newCard('f', 'Berlin', 1_700_000_000_000, 'a')]);
    flow.answer = 'Paris';
    flow.check();
    expect(flow.current?.id).toBe('a');
    flow.retry();
    expect(flow.current?.id).toBe('a');
    expect(flow.answer).toBe('');
    flow.answer = 'Berlin';
    flow.check();
    expect(flow.verdict).toBe('correct');
    flow.next();
    // The first answer was wrong and decided the schedule; the right retry did not grade again.
    expect(cards()[0].lapses).toBe(1);
    expect(cards()[0].repetitions).toBe(0);
  });

  it('lets the student overrule a wrong verdict', () => {
    const { flow, cards } = setup([newCard('f', 'Ableitung von x^3 ist 3x^2', 1_700_000_000_000, 'a')]);
    flow.answer = 'Ableitung von x^3 ist 3x^3';
    flow.check();
    expect(flow.verdict).toBe('wrong');
    flow.overrule();
    expect(flow.isCorrect).toBe(true);
    flow.next();
    expect(cards()[0].repetitions).toBe(1);
  });

  it('ignores an empty answer', () => {
    const { flow } = setup([newCard('f', 'Berlin', 1_700_000_000_000, 'a')]);
    flow.answer = '   ';
    flow.check();
    expect(flow.verdict).toBeNull();
  });

  it('lists only due cards, oldest first', () => {
    const a = newCard('a', 'a', 100, 'a');
    const b = { ...newCard('b', 'b', 100, 'b'), dueAt: 50 };
    const c = { ...newCard('c', 'c', 100, 'c'), dueAt: 999_999_999_999_999 };
    expect(dueCards([a, b, c], 200).map((x) => x.id)).toEqual(['b', 'a']);
    expect(applyGrade(a, 'good', 1_800_000_000_000).intervalDays).toBe(1);
  });
});
