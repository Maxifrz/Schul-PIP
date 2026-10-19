import { describe, it } from 'vitest';
import { bruteGCD, bruteLCM, check, close, integersIn, match, matches, number, optionsOf, typedAnswer } from './mathMiddleKit';
import type { Problem } from '../../src/lib/learn/math/middle/core';

/** Unit 1, Brüche verstehen: every problem is read back from its prompt and recomputed another way. */
const fraction = (text: string): [number, number] | null => {
  const m = match('^(\\d+)/(\\d+)$', text.trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/** All wrong options are numbers that differ from the expected value. */
const wrongDiffer = (p: Problem, expected: number): string | null => {
  for (const option of optionsOf(p)) {
    const value = number(option);
    if (value !== null && close(value, expected)) return `wrong option ${option} equals the answer`;
  }
  return null;
};

describe('math middle unit 1', () => {
  it('fractionOf', () => check('u01.fractionOf', (level, p) => {
    const m = match('Berechne (\\d+)/(\\d+) von (\\d+)', p.prompt);
    if (!m) return 'prompt';
    const [n, d, whole] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const expected = (n * whole) / d;
    if (expected !== Math.round(expected)) return 'not a whole number';
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed answer';
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct}`;
    if (bruteGCD(n, d) !== 1) return 'fraction not reduced';
    if (!p.pairFront?.startsWith(`${m[1]}/${m[2]} von ${m[3]}`)) return 'pair front';
    if (level === 1 && whole > 60) return 'level 1 too big';
    return wrongDiffer(p, expected);
  }));

  it('share', () => check('u01.share', (level, p) => {
    const head = p.prompt.split('\n')[0] ?? '';
    const numbers = integersIn(head);
    if (numbers.length !== 2) return 'numbers';
    const total = Math.max(...numbers);
    const part = Math.min(...numbers);
    if (!(part < total)) return 'numbers';
    const expected = part / total;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed answer';
    const shown = fraction(p.correct);
    if (!shown || !close(shown[0] / shown[1], expected)) return `correct option ${p.correct}`;
    if (bruteGCD(shown[0], shown[1]) !== 1) return 'answer not reduced';
    const divisor = bruteGCD(part, total);
    if (level < 3 && divisor !== 1) return 'levels 1 and 2 need no reducing';
    if (level === 3 && divisor === 1) return 'level 3 reduces';
    if (part * 2 === total) return 'one half';
    if (p.pairFront !== `${part} von ${total}`) return 'pair front';
    return wrongDiffer(p, expected);
  }));

  it('mixedToImproper', () => check('u01.mixedToImproper', (_l, p) => {
    const m = match('Schreibe (\\d+) (\\d+)/(\\d+) als unechten Bruch', p.prompt);
    if (!m) return 'prompt';
    const [whole, n, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const value = whole + n / d;
    const shown = fraction(p.correct);
    if (!shown || !close(shown[0] / shown[1], value) || shown[1] !== d || !(shown[0] > shown[1])) return `correct option ${p.correct}`;
    const t = p.typed ? match('mit dem Nenner (\\d+)', p.typed.prompt) : null;
    if (!t || !close(Number(t[1]), d)) return 'typed prompt';
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, value * d)) return 'typed answer';
    if (p.pairFront !== `${m[1]} ${m[2]}/${m[3]}`) return 'pair front';
    return wrongDiffer(p, value);
  }));

  it('improperToMixed', () => check('u01.improperToMixed', (_l, p) => {
    const m = match('Schreibe (\\d+)/(\\d+) als gemischte Zahl', p.prompt);
    if (!m) return 'prompt';
    const [top, bottom] = [Number(m[1]), Number(m[2])];
    const value = top / bottom;
    const parts = match('^(\\d+) (\\d+)/(\\d+)$', p.correct);
    if (!parts) return `correct option ${p.correct}`;
    const [whole, rest, denominator] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    if (!(denominator === bottom && rest < denominator && whole >= 1 && close(whole + rest / denominator, value))) return 'mixed number wrong';
    const typed = typedAnswer(p);
    const typedPrompt = p.typed?.prompt;
    if (typed === null || typedPrompt === undefined) return 'typed';
    // The count of wholes by counting down, the rest by subtraction.
    let left = top;
    let wholes = 0;
    while (left >= bottom) { left -= bottom; wholes++; }
    const expected = typedPrompt.includes('ganze Einheiten') ? wholes : left;
    if (!close(typed, expected)) return `typed answer ${typed} expected ${expected}`;
    if (p.pairFront !== `${top}/${bottom}`) return 'pair front';
    return wrongDiffer(p, value);
  }));

  it('equivalent', () => check('u01.equivalent', (_l, p) => {
    const m = match('(\\d+)/(\\d+) = (\\d+|\\?)/(\\d+|\\?)', p.prompt);
    if (!m) return 'prompt';
    const [a, b] = [Number(m[1]), Number(m[2])];
    const missingNumerator = m[3] === '?';
    const known = Number(missingNumerator ? m[4] : m[3]);
    const expected = missingNumerator ? (a * known) / b : (b * known) / a;
    if (expected !== Math.round(expected) || !(expected > 0)) return 'no whole answer';
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed answer';
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return 'correct option';
    // Plug the answer in: both fractions are the same number.
    const [c, d] = missingNumerator ? [expected, known] : [known, expected];
    if (!close(a / b, c / d)) return 'fractions differ';
    for (const option of optionsOf(p)) {
      const value = number(option);
      if (value === null) return 'wrong option text';
      const [wc, wd] = missingNumerator ? [value, known] : [known, value];
      if (close(a / b, wc / wd)) return `wrong option ${option} is right`;
    }
    if (p.pairFront !== `${m[1]}/${m[2]} = ${m[3]}/${m[4]}`) return 'pair front';
    return null;
  }));

  it('reduce', () => check('u01.reduce', (level, p) => {
    const m = match('Kürze vollständig:\\n(\\d+)/(\\d+)', p.prompt);
    if (!m) return 'prompt';
    const [a, b] = [Number(m[1]), Number(m[2])];
    const g = bruteGCD(a, b);
    if (!(g > 1 && (level === 1 ? g <= 5 : true))) return `gcd ${g}`;
    const right = fraction(p.correct);
    if (!right || right[0] !== a / g || right[1] !== b / g || bruteGCD(right[0], right[1]) !== 1) return `correct option ${p.correct}`;
    for (const option of optionsOf(p)) {
      const w = fraction(option);
      if (!w) return `wrong option ${option}`;
      if (w[0] * right[1] === w[1] * right[0] && bruteGCD(w[0], w[1]) === 1) return `wrong option ${option} is the reduced fraction`;
      if (w[0] === right[0] && w[1] === right[1]) return 'wrong option equals the answer';
    }
    if (!p.allowsEquivalentWrong) return 'flag';
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, g) || !p.typed?.prompt.includes(`${a}/${b}`)) return 'typed answer';
    if (p.pairFront !== `${a}/${b}`) return 'pair front';
    return null;
  }));

  it('isReduced', () => check('u01.isReduced', (_l, p) => {
    const asksReducible = p.prompt.includes('noch kürzen');
    if (!(asksReducible || p.prompt.includes('nicht mehr kürzen'))) return 'prompt';
    const right = fraction(p.correct);
    if (!right) return 'correct option';
    const rightReducible = bruteGCD(right[0], right[1]) > 1;
    if (rightReducible !== asksReducible) return 'the right option is not the odd one';
    const options = optionsOf(p);
    if (options.length !== 3) return 'needs three wrong options';
    for (const option of options) {
      const w = fraction(option);
      if (!w) return 'wrong option';
      if ((bruteGCD(w[0], w[1]) > 1) === asksReducible) return `wrong option ${option} fits the question`;
      if (w[0] >= w[1]) return 'improper fraction';
    }
    return null;
  }));

  it('compare', () => check('u01.compare', (_l, p) => {
    const m = match('(\\d+)/(\\d+) oder (\\d+)/(\\d+)', p.prompt);
    if (!m) return 'prompt';
    const [a, b, c, d] = m.slice(1).map(Number);
    // Cross products decide, not division.
    const leftLarger = a * d > c * b;
    if (a * d === c * b) return 'equal fractions';
    const larger = leftLarger ? `${a}/${b}` : `${c}/${d}`;
    const smaller = leftLarger ? `${c}/${d}` : `${a}/${b}`;
    const options = optionsOf(p);
    if (p.correct !== larger || options.length !== 2 || options[0] !== smaller || options[1] !== 'Beide sind gleich groß.') return 'options';
    const t = p.typed ? match('auf den Nenner (\\d+)', p.typed.prompt) : null;
    if (!t) return 'typed prompt';
    const common = Number(t[1]);
    if (common !== bruteLCM(b, d)) return 'not the common denominator';
    const expected = Math.max(a * (common / b), c * (common / d));
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed answer';
    if (p.pairFront !== `${a}/${b} oder ${c}/${d}`) return 'pair front';
    return null;
  }));

  it('order', () => check('u01.order', (_l, p) => {
    const listing = p.prompt.split('\n').pop() ?? '';
    const given = matches('(\\d+)/(\\d+)', listing).map((m) => [Number(m[1]), Number(m[2])]);
    if (given.length !== 3) return 'three fractions';
    const sorted = [...given].sort((x, y) => x[0] * y[1] - y[0] * x[1]);
    if (sorted[0][0] * sorted[1][1] === sorted[1][0] * sorted[0][1] || sorted[1][0] * sorted[2][1] === sorted[2][0] * sorted[1][1]) return 'equal fractions';
    const chain = (text: string) => matches('(\\d+)/(\\d+)', text).map((m) => [Number(m[1]), Number(m[2])]);
    const right = chain(p.correct);
    if (right.length !== 3 || !right.every((r, i) => r[0] === sorted[i][0] && r[1] === sorted[i][1])) return `correct chain ${p.correct}`;
    if (p.correct.split(' < ').length !== 3) return 'chain format';
    for (const option of optionsOf(p)) {
      const w = chain(option);
      const set = (list: number[][]) => new Set(list.map((f) => `${f[0]}/${f[1]}`));
      if (w.length !== 3 || [...set(w)].sort().join() !== [...set(given)].sort().join()) return 'wrong chain is no permutation';
      const ascending = w.slice(0, -1).every((f, i) => f[0] * w[i + 1][1] < w[i + 1][0] * f[1]);
      if (ascending) return `wrong chain ${option} is ascending`;
    }
    const t = p.typed ? match('auf den Nenner (\\d+)', p.typed.prompt) : null;
    if (!t) return 'typed prompt';
    const common = Number(t[1]);
    if (!given.every((g) => common % g[1] === 0)) return 'not a common denominator';
    const middle = sorted[1];
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, middle[0] * (common / middle[1]))) return 'typed answer';
    return null;
  }));

  it('between', () => check('u01.between', (_l, p) => {
    const m = match('zwischen (\\d+)/(\\d+) und (\\d+)/(\\d+)', p.prompt);
    if (!m) return 'prompt';
    const lower = Number(m[1]) / Number(m[2]);
    const upper = Number(m[3]) / Number(m[4]);
    const right = number(p.correct);
    if (!(lower < upper) || right === null || !(right > lower) || !(right < upper)) return `correct option ${p.correct}`;
    for (const option of optionsOf(p)) {
      const value = number(option);
      if (value === null) return 'wrong option';
      if (value > lower && value < upper) return `wrong option ${option} lies between`;
    }
    return null;
  }));
});
