import { describe, it } from 'vitest';
import { Expression, check, close, match, number, optionsOf, typedAnswer } from './mathMiddleKit';
import type { Problem } from '../../src/lib/learn/math/middle/core';

/** Unit 9, Quadratische Gleichungen und Funktionen: every equation in a prompt is read by the test's own expression
 * reader. The coefficients are found from three function values, the roots and the vertex from them with floating
 * point arithmetic, and the solutions are plugged back into the equation. */
const value = (text: string, x: number) => Expression.evaluate(text, { x });

/** a, b, c of the quadratic function given by the expression, from f(−1), f(0) and f(1). */
function coefficients(expression: string): { a: number; b: number; c: number } | null {
  const [left, middle, right] = [-1, 0, 1].map((x) => value(expression, x));
  if (left === null || middle === null || right === null) return null;
  return { a: (left + right) / 2 - middle, b: (right - left) / 2, c: middle };
}

/** The expression of "left = right" as left − right. */
function difference(equation: string): string | null {
  const sides = equation.split(' = ');
  return sides.length === 2 ? `(${sides[0]}) − (${sides[1]})` : null;
}

function rootsOf(equation: string): number[] | null {
  const expression = difference(equation);
  const k = expression ? coefficients(expression) : null;
  if (!k || Math.abs(k.a) <= 1e-9) return null;
  const d = k.b * k.b - 4 * k.a * k.c;
  if (d < -1e-9) return [];
  if (Math.abs(d) <= 1e-9) return [-k.b / (2 * k.a)];
  return [(-k.b + Math.sqrt(d)) / (2 * k.a), (-k.b - Math.sqrt(d)) / (2 * k.a)].sort((a, b) => a - b);
}

/** "3 und −1" or "5" as numbers, sorted. */
function solutionSet(text: string): number[] | null {
  const parts = text.split(' und ').map((t) => number(t));
  return parts.some((v) => v === null) ? null : (parts as number[]).sort((a, b) => a - b);
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => close(v, b[i]));

/** After the first line of the prompt. */
const body = (p: Problem) => p.prompt.split('\n').slice(1).join('\n');

function vertexOf(equation: string): { x: number; y: number } | null {
  const k = equation.startsWith('y = ') ? coefficients(equation.slice(4)) : null;
  if (!k || Math.abs(k.a) <= 1e-9) return null;
  const x = -k.b / (2 * k.a);
  const y = value(equation.slice(4), x);
  return y === null ? null : { x, y };
}

function typedMatches(p: Problem, expected: number): string | null {
  const typed = typedAnswer(p);
  return typed === null || !close(typed, expected) ? `typed answer ${typed} expected ${expected}` : null;
}

/** The correct option and the typed answer are the roots of the equation; no wrong option is the same set. */
function checkSolutions(p: Problem, equation: string, typedIsLarger: boolean | null): string | null {
  const truth = rootsOf(equation);
  if (!truth || truth.length !== 2) return `roots of ${equation}`;
  const given = solutionSet(p.correct);
  if (!given || !same(given, truth)) return `correct option ${p.correct} roots ${truth}`;
  // The solutions plugged back in.
  for (const x of given) {
    const expression = difference(equation);
    const residual = expression ? value(expression, x) : null;
    if (residual === null || Math.abs(residual) >= 1e-9) return `${x} does not solve ${equation}`;
  }
  for (const option of optionsOf(p)) {
    const set = solutionSet(option);
    if (!set) return `wrong option ${option}`;
    if (same(set, truth)) return `wrong option ${option} is right`;
  }
  if (typedIsLarger !== null) return typedMatches(p, typedIsLarger ? truth[1] : truth[0]);
  return null;
}

describe('math middle unit 9', () => {
  it('vertexForm', () => check('u09.vertexForm', (_l, p) => {
    const m = match('^Lies den Scheitelpunkt ab\\.\\n(y = .+)$', p.prompt);
    const v = m ? vertexOf(m[1]) : null;
    if (!m || !v) return 'prompt';
    const s = match('^S\\((.+)\\|(.+)\\)$', p.correct);
    if (!s || !close(number(s[1])!, v.x) || !close(number(s[2])!, v.y)) return `correct ${p.correct} vertex ${JSON.stringify(v)}`;
    if (p.pairFront !== m[1]) return 'pair front';
    const asksX = p.typed?.prompt.includes('x-Koordinate') === true;
    return typedMatches(p, asksX ? v.x : v.y);
  }));

  it('shift', () => check('u09.shift', (_l, p) => {
    const v = vertexOf(body(p));
    if (!v) return 'prompt';
    const m = match('^(\\d+) nach (rechts|links) und (\\d+) nach (oben|unten)$', p.correct);
    if (!m) return 'correct text';
    const x = (m[2] === 'rechts' ? 1 : -1) * Number(m[1]);
    const y = (m[4] === 'oben' ? 1 : -1) * Number(m[3]);
    if (!close(x, v.x) || !close(y, v.y)) return `${p.correct} vertex ${JSON.stringify(v)}`;
    return optionsOf(p).includes(p.correct) ? 'right option among the wrong' : null;
  }));

  it('functionValue', () => check('u09.functionValue', (_l, p) => {
    const m = match('^Gegeben: f\\(x\\) = (.+)\\nBerechne f\\((.+)\\)\\.$', p.prompt);
    const x = m ? number(m[2]) : null;
    const y = m && x !== null ? value(m[1], x) : null;
    if (!m || x === null || y === null) return 'prompt';
    const right = number(p.correct);
    if (right === null || !close(right, y)) return `correct ${p.correct} expected ${y}`;
    for (const option of optionsOf(p)) {
      const v = number(option);
      if (v === null) return `wrong option ${option}`;
      if (close(v, y)) return `wrong option ${option} is right`;
    }
    return typedMatches(p, y);
  }));

  it('extremum', () => check('u09.extremum', (_l, p) => {
    const equation = body(p);
    const v = vertexOf(equation);
    const k = equation.startsWith('y = ') ? coefficients(equation.slice(4)) : null;
    if (!v || !k) return 'prompt';
    const lowest = k.a > 0;
    if (p.prompt.startsWith('Welchen')) {
      if (!p.prompt.includes(lowest ? 'kleinsten' : 'größten')) return 'wrong extreme';
      const right = number(p.correct);
      if (right === null || !close(right, v.y)) return `correct ${p.correct} vertex ${JSON.stringify(v)}`;
      // The value really is the extreme: compare with nearby points.
      for (const dx of [-1, -0.5, 0.5, 1]) {
        const near = value(equation.slice(4), v.x + dx);
        if (near === null) return 'evaluation';
        if (lowest ? near < v.y - 1e-9 : near > v.y + 1e-9) return 'not the extreme';
      }
      return typedMatches(p, v.y);
    }
    if (!p.prompt.includes(lowest ? 'am kleinsten' : 'am größten')) return 'wrong extreme';
    const right = number(p.correct);
    if (right === null || !close(right, v.x)) return `correct ${p.correct} vertex ${JSON.stringify(v)}`;
    return typedMatches(p, v.x);
  }));

  it('pureQuadratic', () => check('u09.pureQuadratic', (_l, p) => {
    const equation = body(p);
    const message = checkSolutions(p, equation, null);
    if (message) return message;
    const truth = rootsOf(equation);
    return truth ? typedMatches(p, truth[1]) : 'roots';
  }));

  it('factorForm', () => check('u09.factorForm', (_l, p) => {
    const equation = body(p);
    if (!equation.endsWith(' = 0')) return 'prompt';
    return checkSolutions(p, equation, p.typed?.prompt.includes('größere') === true);
  }));

  it('vertexZeros', () => check('u09.vertexZeros', (level, p) => {
    const equation = body(p);
    if (!equation.startsWith('y = ')) return 'prompt';
    const asEquation = `${equation.slice(4)} = 0`;
    if (level === 1 && !p.typed) return 'typed';
    return checkSolutions(p, asEquation, p.typed?.prompt.includes('größere') === true);
  }));

  it('pqSolve', () => check('u09.pqSolve', (_l, p) => {
    const equation = body(p);
    const k = equation.endsWith(' = 0') ? coefficients(equation.slice(0, -4)) : null;
    if (!k || !close(k.a, 1)) return 'normal form';
    if (p.pairFront !== equation) return 'pair front';
    return checkSolutions(p, equation, p.typed?.prompt.includes('größere') === true);
  }));

  it('discriminant', () => check('u09.discriminant', (_l, p) => {
    const equation = body(p);
    const k = coefficients(equation.slice(0, -4));
    if (!k || !close(k.a, 1)) return 'normal form';
    // D = (p/2)² − q, once by that formula and once as the discriminant b² − 4ac divided by 4.
    const d = (k.b / 2) * (k.b / 2) - k.c;
    if (!close(d, (k.b * k.b - 4 * k.a * k.c) / 4)) return 'discriminant formulas';
    const expected = d < -1e-9 ? 'keine Lösung' : Math.abs(d) <= 1e-9 ? 'genau eine Lösung' : 'zwei Lösungen';
    if (p.correct !== expected) return `correct ${p.correct} expected ${expected}`;
    const truth = rootsOf(equation);
    if (!truth || truth.length !== (d < -1e-9 ? 0 : Math.abs(d) <= 1e-9 ? 1 : 2)) return 'root count';
    const typedEquation = p.typed ? match('\\n(.+ = 0)$', p.typed.prompt) : null;
    if (!typedEquation || typedEquation[1] !== equation) return 'typed prompt';
    return typedMatches(p, d);
  }));

  /** The correct equation is the given one with every coefficient divided by a, so x² stands alone. */
  const correctDivides = (p: Problem, given: string, a: number): boolean => {
    const k = coefficients(given.slice(0, -4));
    const c = coefficients(p.correct.slice(0, -4));
    if (!k || !c || !p.correct.endsWith(' = 0')) return false;
    return close(c.a, 1) && close(c.b, k.b / a) && close(c.c, k.c / a);
  };

  it('divideFirst', () => check('u09.divideFirst', (_l, p) => {
    const given = body(p);
    const kGiven = coefficients(given.slice(0, -4));
    if (!kGiven || !(kGiven.a > 1)) return 'prompt';
    if (!correctDivides(p, given, kGiven.a)) return `correct ${p.correct}`;
    for (const option of optionsOf(p)) {
      const truth = rootsOf(option);
      const original = rootsOf(given);
      if (truth && original && same(truth, original)) return `wrong option ${option} keeps the roots`;
    }
    if (!p.typed) return 'typed';
    if (p.typed.prompt.startsWith('Löse')) {
      const original = rootsOf(given);
      return original ? typedMatches(p, original[original.length - 1]) : 'roots';
    }
    const correct = coefficients(p.correct.slice(0, -4));
    if (!correct) return 'correct coefficients';
    return typedMatches(p, p.typed.prompt.includes('vor dem x') ? correct.b : correct.c);
  }));

  it('vertexFromNormal', () => check('u09.vertexFromNormal', (_l, p) => {
    const equation = body(p);
    const v = vertexOf(equation);
    if (!v) return 'prompt';
    const s = match('^S\\((.+)\\|(.+)\\)$', p.correct);
    if (!s || !close(number(s[1])!, v.x) || !close(number(s[2])!, v.y)) return `correct ${p.correct} vertex ${JSON.stringify(v)}`;
    for (const option of optionsOf(p)) {
      const w = match('^S\\((.+)\\|(.+)\\)$', option);
      if (!w) return `wrong option ${option}`;
      if (close(number(w[1])!, v.x) && close(number(w[2])!, v.y)) return `wrong option ${option} is right`;
    }
    return typedMatches(p, p.typed?.prompt.includes('x-Koordinate') === true ? v.x : v.y);
  }));
});
