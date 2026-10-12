import { describe, expect, it } from 'vitest';
import { LearnAnswer, missedKeys } from '../../src/lib/learn/exercise';
import { Exercises } from '../../src/lib/learn/exercises';
import { NumberCheck, Rational } from '../../src/lib/learn/numberCheck';

const same = (a: string, b: string) => NumberCheck.matches(a, b);
const r = (n: number, d: number) => Rational.make(n, d)!;

describe('NumberCheck', () => {
  it('the same number in every writing', () => {
    expect(same('0,75', '3/4')).toBe(true);
    expect(same('0.75', '3/4')).toBe(true);
    expect(same('6/8', '3/4')).toBe(true);
    expect(same('75 %', '0,75')).toBe(false); // a percent sign is dropped, not turned into a fraction
    expect(same('75%', '75')).toBe(true);
    expect(same('90°', '90')).toBe(true);
    expect(same('1 1/2', '3/2')).toBe(true);
    expect(same('1,5', '1 1/2')).toBe(true);
    expect(same('-2', '−2')).toBe(true);
    expect(same('-3/4', '-0,75')).toBe(true);
    expect(same('  12 ', '12')).toBe(true);
    expect(same('+4', '4')).toBe(true);
    expect(same('0,50', '1/2')).toBe(true);
    expect(same(',5', '1/2')).toBe(true);
  });

  it('different numbers and nonsense', () => {
    expect(same('34', '3/4')).toBe(false); // AnswerCheck would accept this; the number check must not
    expect(same('12', '1/2')).toBe(false);
    expect(same('0,7', '3/4')).toBe(false);
    expect(same('3/4', '4/3')).toBe(false);
    expect(same('2x', '2')).toBe(false);
    expect(same('x', '2')).toBe(false);
    expect(same('', '0')).toBe(false);
    expect(same('1/0', '0')).toBe(false);
    expect(same('1,2,3', '1')).toBe(false);
    expect(same('1 2', '12')).toBe(false);
    expect(same('1 3/2', '5/2')).toBe(false); // the fraction of a mixed number is proper
    expect(same('--2', '2')).toBe(false);
    expect(same('2.', '2')).toBe(false);
    expect(same('99999999999999999999', '1')).toBe(false);
    expect(NumberCheck.parse('abc')).toBeNull();
  });

  it('rational arithmetic and text', () => {
    const half = r(1, 2);
    const third = r(1, 3);
    expect(half.plus(third)).toEqual(r(5, 6));
    expect(half.minus(third)).toEqual(r(1, 6));
    expect(half.times(third)).toEqual(r(1, 6));
    expect(half.dividedBy(third)).toEqual(r(3, 2));
    expect(half.dividedBy(Rational.whole(0))).toBeNull();
    expect(r(2, -4)).toEqual(r(-1, 2));
    expect(Rational.make(1, 0)).toBeNull();
    expect(third.lessThan(half)).toBe(true);
    expect(r(3, 4).germanText).toBe('0,75');
    expect(r(-3, 8).germanText).toBe('-0,375');
    expect(r(1, 20).germanText).toBe('0,05');
    expect(third.germanText).toBe('1/3');
    expect(Rational.whole(7).germanText).toBe('7');
    expect(r(5, 2).fractionText).toBe('5/2');
    expect(NumberCheck.parse('0,125')).toEqual(r(1, 8));
  });

  it('typed numbers in an exercise', () => {
    const exercise = Exercises.typed({ id: 'n', prompt: '3/8 + 3/8', answer: '3/4', mode: 'number' })!;
    expect([...missedKeys(exercise, LearnAnswer.typed('0,75'))]).toEqual([]);
    expect([...missedKeys(exercise, LearnAnswer.typed('6/8'))]).toEqual([]);
    expect([...missedKeys(exercise, LearnAnswer.typed('34'))]).toEqual(['n']); // an exercise without cards stands for itself
    expect(Exercises.typed({ id: 'bad', prompt: '?', answer: 'drei', mode: 'number' })).toBeNull();
  });

  // Extra cases: the int64 overflow rules of the Swift code.
  it('returns null where Swift reports overflow', () => {
    const big = Rational.make(9_000_000_000_000_000_000n, 1)!;
    expect(big.plus(big)).toBeNull();
    expect(big.times(Rational.whole(2))).toBeNull();
    expect(Rational.make(-(1n << 63n), 1)).toBeNull();
    expect(Rational.make(1, -(1n << 63n))).toBeNull();
    // Comparing falls back on doubles instead of overflowing.
    expect(r(1, 3).lessThan(big)).toBe(true);
    // 15 digits parse, 16 do not; a 9-digit fraction on a 15-digit whole number overflows the scale.
    expect(NumberCheck.parse('999999999999999')).toEqual(Rational.whole(999999999999999n));
    expect(NumberCheck.parse('9999999999999999')).toBeNull();
    expect(NumberCheck.parse('999999999999999,123456789')).toBeNull();
    expect(NumberCheck.parse('0,1234567890')).toBeNull();
    expect(NumberCheck.parse('٣')).toBeNull();
  });

  it('germanText gives a fraction beyond six digits and the sign of small values', () => {
    expect(r(1, 2_000_000).germanText).toBe('1/2000000');
    expect(r(1, 1_000_000).germanText).toBe('0,000001');
    expect(r(-1, 8).germanText).toBe('-0,125');
    expect(r(3, 1).isWhole).toBe(true);
    expect(r(1, 4).doubleValue).toBe(0.25);
  });
});
