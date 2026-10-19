import { describe, it } from 'vitest';
import { Expression, bruteGCD, check, close, matches, match, number, optionsOf, typedAnswer } from './mathMiddleKit';
import type { Problem } from '../../src/lib/learn/math/middle/core';

/** Unit 2, Bruchrechnung: the expression in every prompt is evaluated again with floating point. */
const lineOf = (prompt: string): string => prompt.split('\n')[1] ?? '';
const valueOf = (prompt: string): number | null => {
  const lines = prompt.split('\n');
  return lines.length >= 2 && lines[0] === 'Berechne:' ? Expression.evaluate(lines[1]) : null;
};

/** Checks an arithmetic template: the expression, the typed answer, the right option, the wrong ones, the pair. */
const checkArithmetic = (id: string, positive = true, more?: (level: number, p: Problem, expected: number) => string | null) =>
  check(id, (level, p) => {
    const expected = valueOf(p.prompt);
    if (expected === null) return 'cannot read the expression';
    if (positive && expected <= 0) return 'result not positive';
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return `typed answer ${typed} expected ${expected}`;
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct}`;
    for (const option of optionsOf(p)) {
      const wrong = number(option);
      if (wrong === null) return `wrong option ${option}`;
      if (close(wrong, expected)) return `wrong option ${option} is right`;
    }
    if (p.pairFront !== lineOf(p.prompt)) return `pair front ${p.pairFront ?? ''}`;
    return more?.(level, p, expected) ?? null;
  });

describe('math middle unit 2', () => {
  it('add', () => checkArithmetic('u02.add', true, (level, p, expected) => {
    // Two proper fractions, and the denominators fit the level.
    const fractions = matches('(\\d+)/(\\d+)', lineOf(p.prompt)).map((m) => [Number(m[1]), Number(m[2])]);
    if (fractions.length !== 2 || !fractions.every((f) => f[0] < f[1] && bruteGCD(f[0], f[1]) === 1)) return 'operands';
    if (level === 1 && fractions[0][1] !== fractions[1][1] && fractions[1][1] % fractions[0][1] !== 0) return 'level 1 denominators';
    if (expected > 2) return 'sum too big';
    return null;
  }));
  it('subtract', () => checkArithmetic('u02.subtract', true, (_l, _p, expected) => (expected < 1 ? null : 'difference too big')));
  it('mixedAddSub', () => checkArithmetic('u02.mixedAddSub', true, (level, p) => {
    const line = lineOf(p.prompt);
    if (level === 3 && !line.includes('−')) return 'level 3 subtracts';
    if (level < 3 && !line.includes('+')) return 'levels 1 and 2 add';
    const parts = match('^(\\d+) (\\d+)/(\\d+) [+−] (\\d+) (\\d+)/(\\d+)$', line);
    if (!parts) return 'operands are two mixed numbers';
    if (!(Number(parts[2]) < Number(parts[3]) && Number(parts[5]) < Number(parts[6]))) return 'improper fraction part';
    return null;
  }));
  it('multiply', () => checkArithmetic('u02.multiply'));
  it('divide', () => checkArithmetic('u02.divide'));
  it('order of operations', () => checkArithmetic('u02.order', true, (_l, p) => (lineOf(p.prompt) === '' ? 'no expression' : null)));
  it('mixedMulDiv', () => checkArithmetic('u02.mixedMulDiv'));

  it('fitsIn', () => check('u02.fitsIn', (_l, p) => {
    const patterns = [
      'Aus (.+?) l Saft werden Gläser zu (\\d+/\\d+) l', 'Ein Band ist (.+?) m lang\\. Daraus werden Stücke zu (\\d+/\\d+) m', 'Ein Sack enthält (.+?) kg Mehl\\. Jede Tüte fasst (\\d+/\\d+) kg',
    ];
    const m = patterns.map((x) => match(x, p.prompt)).find((x) => x !== null);
    if (!m) return 'prompt';
    const total = number(m[1]);
    const portion = number(m[2]);
    if (total === null || portion === null) return 'numbers';
    const expected = total / portion;
    if (!(close(expected, Math.round(expected)) && close(Math.round(expected) * portion, total))) return `not a whole number of portions: ${expected}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed answer';
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return 'correct option';
    for (const option of optionsOf(p)) {
      const wrong = number(option);
      if (wrong === null) return 'wrong option';
      if (close(wrong, expected)) return `wrong option ${option} is right`;
    }
    return null;
  }));

  it('partOfPart', () => check('u02.partOfPart', (_l, p) => {
    const first = p.prompt.split('\n')[0] ?? '';
    const fractions = matches('(\\d+)/(\\d+)', first).map((m) => Number(m[1]) / Number(m[2]));
    if (fractions.length !== 2) return 'two fractions';
    const expected = fractions[0] * fractions[1];
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed answer';
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return 'correct option';
    for (const option of optionsOf(p)) {
      const wrong = number(option);
      if (wrong === null) return 'wrong option';
      if (close(wrong, expected)) return `wrong option ${option} is right`;
    }
    return null;
  }));

  it('word', () => check('u02.word', (_l, p) => {
    const first = p.prompt.split('\n')[0] ?? '';
    let expected: number;
    const m = match('Für (\\d+) Portionen braucht man (\\d+)/(\\d+)', first);
    if (m) expected = Number(m[2]) / Number(m[3]) / Number(m[1]);
    else {
      const fractions = matches('(\\d+)/(\\d+)', first).map((x) => Number(x[1]) / Number(x[2]));
      if (fractions.length !== 2 || !(fractions[0] + fractions[1] < 1)) return 'two fractions';
      expected = 1 - fractions[0] - fractions[1];
    }
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed answer';
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct}`;
    for (const option of optionsOf(p)) {
      const wrong = number(option);
      if (wrong === null) return 'wrong option';
      if (close(wrong, expected)) return `wrong option ${option} is right`;
    }
    return null;
  }));
});
