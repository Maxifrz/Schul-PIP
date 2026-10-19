import { describe, it } from 'vitest';
import { Expression, check, close, match, matches, number, optionsOf, typedAnswer } from './mathMiddleKit';
import type { Problem } from '../../src/lib/learn/math/middle/core';

/** Unit 7, Potenzen und Wurzeln: every expression in a prompt is evaluated by the test's own reader (floating point
 * arithmetic, with letters taken as a number), and the roots are checked by raising the answer to the power again. */
// All the letters the course uses as a base stand for the same number, so a law of powers can be checked by value.
const letters: Record<string, number> = { x: 1.3, a: 1.3, y: 1.3, z: 1.3 };
const evalText = (text: string) => Expression.evaluate(text.split(' ').join(''), letters);
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** "Berechne <expression>." gives the expression. */
const expressionAfter = (prefix: string, prompt: string): string | null => (prompt.startsWith(prefix) && prompt.endsWith('.') ? prompt.slice(prefix.length, -1) : null);

function differ(p: Problem, expected: number, parse: (s: string) => number | null): string | null {
  for (const option of optionsOf(p)) {
    const value = parse(option);
    if (value === null) return `wrong option ${option}`;
    if (close(value, expected)) return `wrong option ${option} is right`;
  }
  return null;
}

/** The exponent of a power written with superscripts: "x⁷" gives 7. */
function exponentOf(power: string): number | null {
  const text = [...power].filter((c) => SUP.includes(c)).map((c) => SUP.indexOf(c)).join('');
  return text === '' ? (power.includes('⁻') ? null : 1) : Number(text);
}

describe('math middle unit 7', () => {
  it('powerValue', () => check('u07.powerValue', (level, p) => {
    const text = expressionAfter('Berechne ', p.prompt);
    const expected = text === null ? null : evalText(text);
    if (text === null || expected === null) return 'prompt';
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed';
    if (p.pairFront !== text) return 'pair front';
    if (level === 3 && !text.startsWith('(')) return 'level 3 is a fraction or decimal in brackets';
    if (level < 3 && text.includes('(')) return 'no brackets below level 3';
    return differ(p, expected, number);
  }));

  it('negativeBase', () => check('u07.negativeBase', (level, p) => {
    const text = expressionAfter('Berechne ', p.prompt);
    const expected = text === null ? null : evalText(text);
    if (text === null || expected === null) return 'prompt';
    // The sign by counting minus factors, another way than evaluating.
    const m = match('^(\\(−(\\d)\\)|−(\\d))(⁰|¹|²|³|⁴)$', text);
    if (m) {
      const base = Number(m[2] === '' ? m[3] : m[2]);
      const n = exponentOf(m[4])!;
      const bracketed = m[2] !== '';
      const magnitude = base ** n;
      const negative = bracketed ? n % 2 === 1 : true;
      if (!close(expected, negative ? -magnitude : magnitude)) return `sign by counting ${expected}`;
    } else if (level !== 3) return `form ${text}`;
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed';
    if (level === 1 && !text.includes('²')) return 'level 1 squares';
    return differ(p, expected, number);
  }));

  it('squareRoot', () => check('u07.squareRoot', (_l, p) => {
    const text = expressionAfter('Berechne ', p.prompt);
    const radicand = text !== null && text.startsWith('√') ? evalText(text.slice(1)) : null;
    if (text === null || radicand === null) return 'prompt';
    const right = number(p.correct);
    if (right === null) return 'correct';
    // Squared again: the answer is the number the radicand comes from.
    if (!close(right * right, radicand) || !(right > 0)) return `squared ${right} is not ${radicand}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, right)) return 'typed';
    if (p.pairFront !== text) return 'pair front';
    return differ(p, right, number);
  }));

  it('estimateRoot', () => check('u07.estimateRoot', (_l, p) => {
    const m = match('liegt √(\\d+)\\?$', p.prompt);
    const c = match('^(\\d+) und (\\d+)$', p.correct);
    if (!m || !c) return 'prompt';
    const n = Number(m[1]);
    const [low, high] = [Number(c[1]), Number(c[2])];
    const root = Math.sqrt(n);
    if (high !== low + 1 || !(low < root) || !(root < high)) return `bounds ${low} ${high} for ${root}`;
    const typed = typedAnswer(p);
    if (typed === null || typed !== Math.round(root)) return `nearest whole number ${typed} for ${root}`;
    for (const option of optionsOf(p)) {
      const w = match('^(\\d+) und (\\d+)$', option);
      if (!w) return `wrong option ${option}`;
      if (Number(w[1]) < root && root < Number(w[2])) return `wrong option ${option} contains the root`;
    }
    if (p.pairFront !== `√${n}`) return 'pair front';
    return null;
  }));

  function checkPower(p: Problem): string | null {
    const lines = p.prompt.split('\n');
    const expected = lines.length === 2 && lines[0] === 'Vereinfache zu einer Potenz:' ? evalText(lines[1]) : null;
    if (expected === null) return 'prompt';
    const right = evalText(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
    const afterBase = [...p.correct].slice([...p.correct].findIndex((c) => SUP.includes(c))).join('');
    const n = [...p.correct].some((c) => SUP.includes(c)) ? exponentOf(afterBase) : p.correct.length <= 2 ? 1 : null;
    if (n === null) return `exponent of ${p.correct}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, n)) return `typed ${typed} expected ${n}`;
    if (p.pairFront !== lines[1]) return 'pair front';
    return differ(p, expected, evalText);
  }

  it('sameBase', () => check('u07.sameBase', (level, p) => {
    const message = checkPower(p);
    if (message) return message;
    const expression = p.prompt.split('\n')[1];
    if (level === 1 && (expression.includes(':') || expression.includes('('))) return 'level 1 multiplies two powers';
    if (level === 3 && !(expression.includes('(') || expression.split(' · ').length === 3)) return 'level 3 form';
    return null;
  }));

  it('powerOfPower', () => check('u07.powerOfPower', (level, p) => {
    const message = checkPower(p);
    if (message) return message;
    const expression = p.prompt.split('\n')[1];
    if (!expression.startsWith('(')) return 'bracket first';
    if (level === 1 && (expression.includes(':') || expression.includes('·'))) return 'level 1 is a plain power of a power';
    return null;
  }));

  it('sameExponent', () => check('u07.sameExponent', (_l, p) => {
    const lines = p.prompt.split('\n');
    const expected = lines.length === 2 && lines[0] === 'Fasse zu einer Potenz zusammen:' ? evalText(lines[1]) : null;
    if (expected === null) return 'prompt';
    const right = evalText(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
    const typed = typedAnswer(p);
    if (!p.typed?.prompt.endsWith('Welche Zahl steht in der Basis?') || typed === null) return 'typed prompt';
    const base = match(`^(\\d+)[${SUP}]+$`, p.correct);
    if (!base || !close(typed, Number(base[1]))) return 'typed answer';
    // Both factors have the same exponent.
    const exponents = matches(`\\d+([${SUP}]+)`, lines[1]).map((m) => m[1]);
    if (exponents.length !== 2 || exponents[0] !== exponents[1]) return 'same exponent';
    return differ(p, expected, evalText);
  }));

  it('negativeExponent', () => check('u07.negativeExponent', (level, p) => {
    const m = match('^Schreibe (.+) als Bruch oder ganze Zahl\\.$', p.prompt);
    const expected = m ? evalText(m[1]) : null;
    if (!m || expected === null) return 'prompt';
    const right = number(p.correct);
    if (right === null || !close(right, expected)) return `correct option ${p.correct} expected ${expected}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed';
    if (!m[1].includes('⁻')) return 'negative exponent';
    if (level < 3 && m[1].includes('(')) return 'brackets only at level 3';
    if (p.pairFront !== m[1]) return 'pair front';
    return differ(p, expected, number);
  }));

  it('scientific', () => check('u07.scientific', (level, p) => {
    const m = match('^Schreibe (.+) in der Form a · 10ⁿ mit 1 ≤ a < 10\\.$', p.prompt);
    if (!m) return 'prompt';
    const target = number(m[1].split(' ').join(''));
    if (target === null) return 'number';
    const parts = (text: string): { mantissa: number; exponent: number } | null => {
      const q = match(`^(\\d+(?:,\\d+)?) · 10(⁻?[${SUP}]+)$`, text);
      const mantissa = q ? number(q[1]) : null;
      if (!q || mantissa === null) return null;
      const e = exponentOf(q[2]);
      return e === null ? null : { mantissa, exponent: q[2].startsWith('⁻') ? -e : e };
    };
    const right = parts(p.correct);
    if (!right || right.mantissa < 1 || right.mantissa >= 10) return `correct option ${p.correct}`;
    if (!close(right.mantissa * 10 ** right.exponent, target)) return `value of ${p.correct} is not ${target}`;
    if (level === 3 && right.exponent >= 0) return 'level 3 is small numbers';
    if (level < 3 && right.exponent < 0) return 'levels 1 and 2 are big numbers';
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, right.exponent)) return 'typed';
    for (const option of optionsOf(p)) {
      const w = parts(option);
      if (!w) return `wrong option ${option}`;
      const sameValue = close(w.mantissa * 10 ** w.exponent, target);
      if (sameValue && w.mantissa >= 1 && w.mantissa < 10) return `wrong option ${option} is right`;
    }
    return null;
  }));

  it('rootOfSum', () => check('u07.rootOfSum', (level, p) => {
    const text = expressionAfter('Berechne ', p.prompt);
    const expected = text !== null && text.startsWith('√(') ? evalText(text) : null;
    if (text === null || expected === null) return 'prompt';
    const right = number(p.correct);
    if (right === null || !close(right, expected) || expected !== Math.round(expected)) return `correct option ${p.correct} expected ${expected}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, expected)) return 'typed';
    // The radicand is a perfect square: the answer squared is the radicand.
    const radicand = evalText(text.slice(1));
    if (radicand === null || !close(expected * expected, radicand)) return 'radicand';
    if (level === 1 && text.includes('−')) return 'level 1 adds';
    if (level === 3 && !text.includes('−')) return 'level 3 subtracts';
    return differ(p, expected, number);
  }));

  it('cubeRoot', () => check('u07.cubeRoot', (level, p) => {
    const text = expressionAfter('Berechne ³√', p.prompt);
    const radicand = text === null ? null : evalText(text);
    if (text === null || radicand === null) return 'prompt';
    const right = number(p.correct);
    if (right === null) return 'correct';
    // Cubed again: the answer is the number the radicand comes from.
    if (!close(right * right * right, radicand)) return `cubed ${right} is not ${radicand}`;
    const typed = typedAnswer(p);
    if (typed === null || !close(typed, right)) return 'typed';
    if (level < 3 && (radicand < 0 || text.includes('/') || text.includes(','))) return 'plain cubes below level 3';
    if (p.pairFront !== `³√${text}`) return `pair front ${p.pairFront ?? ''}`;
    return differ(p, right, number);
  }));
});
